#!/usr/bin/env python3
"""Generate IMG-xx assets via gpt-image-2 (route fixed by state/asset-routing.json).

Usage (API lane — the caller Bash must have sourced .env first):
    python3 generate.py IMG-01 IMG-04 ...      # specific ids
    python3 generate.py all                    # every not-yet-done asset

- Writes PNGs to game/assets/images/<file> and appends one progress JSON line
  per asset to game/assets/tools/gen_progress.jsonl (attempts, http status,
  response kind). MANIFEST.jsonl is written later by validate_manifest.py.
- Retries 429/5xx/timeout with exponential backoff; every attempt (route +
  status) is recorded, nothing is silently swallowed.
"""
import base64
import json
import os
import sys
import time
import urllib.error
import urllib.request
import uuid

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from assets_spec import ASSETS, ASSET_BY_ID, OUT_DIR, PROGRESS, full_prompt, resolve_ref  # noqa: E402

BASE = os.environ.get("OPENAI_BASE_URL", "https://api.openai.com/v1")
MODEL = "gpt-image-2"
RETRY_DELAYS = [15, 30, 60, 120, 180]
TRANSIENT = {408, 429, 500, 502, 503, 504}


def log_progress(entry):
    with open(PROGRESS, "a", encoding="utf-8") as fh:
        fh.write(json.dumps(entry, ensure_ascii=False) + "\n")


def done_ids():
    done = set()
    if os.path.exists(PROGRESS):
        with open(PROGRESS, "r", encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if not line:
                    continue
                e = json.loads(line)
                if e.get("status") == "ok":
                    done.add(e["id"])
    return done


def http_post_json(url, payload, key):
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": "Bearer " + key,
            "Content-Type": "application/json",
        },
        method="POST",
    )
    return req


def http_post_multipart(url, fields, files, key):
    boundary = "----arcaderelay" + uuid.uuid4().hex
    body = b""
    for name, value in fields.items():
        body += (
            f"--{boundary}\r\nContent-Disposition: form-data; name=\"{name}\"\r\n\r\n{value}\r\n"
        ).encode("utf-8")
    for name, path in files.items():
        fname = os.path.basename(path)
        with open(path, "rb") as fh:
            data = fh.read()
        body += (
            f"--{boundary}\r\nContent-Disposition: form-data; name=\"{name}\"; "
            f"filename=\"{fname}\"\r\nContent-Type: image/png\r\n\r\n"
        ).encode("utf-8") + data + b"\r\n"
    body += f"--{boundary}--\r\n".encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        headers={
            "Authorization": "Bearer " + key,
            "Content-Type": "multipart/form-data; boundary=" + boundary,
        },
        method="POST",
    )
    return req


def fetch_url(url):
    with urllib.request.urlopen(url, timeout=120) as resp:
        return resp.read()


def call_api(asset, key):
    """Returns (png_bytes, meta). Raises RuntimeError with attempt log."""
    attempts = []
    ref_path = resolve_ref(asset["ref"])
    prompt = full_prompt(asset)
    url = BASE + ("/images/edits" if ref_path else "/images/generations")
    route = "openai:gpt-image-2:" + ("edits" if ref_path else "generations")
    last_err = None
    for attempt, delay in enumerate([0] + RETRY_DELAYS):
        if delay:
            time.sleep(delay)
        try:
            if ref_path:
                req = http_post_multipart(
                    url,
                    fields={
                        "model": MODEL,
                        "prompt": prompt,
                        "size": asset["size"],
                        "quality": "high",
                        "background": asset["background"],
                        "output_format": "png",
                        "n": "1",
                    },
                    files={"image": ref_path},
                    key=key,
                )
            else:
                req = http_post_json(
                    url,
                    {
                        "model": MODEL,
                        "prompt": prompt,
                        "size": asset["size"],
                        "quality": "high",
                        "background": asset["background"],
                        "output_format": "png",
                        "n": 1,
                    },
                    key,
                )
            with urllib.request.urlopen(req, timeout=600) as resp:
                body = json.loads(resp.read().decode("utf-8"))
            item = body["data"][0]
            if item.get("b64_json"):
                png = base64.b64decode(item["b64_json"])
            elif item.get("url"):
                png = fetch_url(item["url"])
            else:
                raise RuntimeError("response has neither b64_json nor url")
            attempts.append({"route": route, "http": 200, "ok": True})
            meta = {
                "route": route,
                "endpoint": url,
                "response_kind": "b64_json" if item.get("b64_json") else "url",
                "usage": body.get("usage"),
                "revised_prompt": item.get("revised_prompt"),
                "size": asset["size"],
                "background": asset["background"],
            }
            return png, meta, attempts
        except urllib.error.HTTPError as e:
            status = e.code
            detail = ""
            try:
                detail = e.read().decode("utf-8")[:500]
            except Exception:
                pass
            attempts.append({"route": route, "http": status, "ok": False, "detail": detail})
            last_err = f"{route} -> HTTP {status}: {detail}"
            if status not in TRANSIENT:
                break
        except Exception as e:  # timeout / URLError / json errors
            attempts.append({"route": route, "http": None, "ok": False, "detail": str(e)[:500]})
            last_err = f"{route} -> {type(e).__name__}: {e}"
    err = RuntimeError(last_err or "unknown failure")
    err.attempts = attempts
    raise err


def generate(asset_id, key):
    asset = ASSET_BY_ID[asset_id]
    out_path = os.path.join(OUT_DIR, asset["file"])
    if os.path.exists(out_path) and os.path.getsize(out_path) > 0:
        print(f"[skip] {asset_id} already exists: {out_path}", flush=True)
        return True
    ref = resolve_ref(asset["ref"])
    if asset["ref"] and (not ref or not os.path.exists(ref)):
        print(f"[error] {asset_id} reference missing: {ref}", flush=True)
        return False
    try:
        png, meta, attempts = call_api(asset, key)
    except Exception as e:
        attempts = getattr(e, "attempts", [])
        print(f"[fail] {asset_id}: {e}", flush=True)
        log_progress({"id": asset_id, "status": "fail", "attempts": attempts, "error": str(e)[:500]})
        return False
    os.makedirs(OUT_DIR, exist_ok=True)
    with open(out_path, "wb") as fh:
        fh.write(png)
    log_progress({
        "id": asset_id,
        "status": "ok",
        "file": "assets/images/" + asset["file"],
        "prompt": full_prompt(asset),
        "ref": "assets/images/" + os.path.basename(ref) if ref else None,
        "meta": meta,
        "attempts": attempts,
        "bytes": len(png),
    })
    print(f"[ok] {asset_id} -> {out_path} ({len(png)} bytes)", flush=True)
    return True


def main():
    if not os.environ.get("OPENAI_API_KEY"):
        print("OPENAI_API_KEY not set", flush=True)
        sys.exit(2)
    key = os.environ["OPENAI_API_KEY"]
    args = sys.argv[1:]
    ids = [a["id"] for a in ASSETS] if args == ["all"] else args
    os.makedirs(OUT_DIR, exist_ok=True)
    failed = []
    for asset_id in ids:
        if asset_id not in ASSET_BY_ID:
            print(f"[error] unknown id {asset_id}", flush=True)
            failed.append(asset_id)
            continue
        ok = generate(asset_id, key)
        if not ok:
            failed.append(asset_id)
        time.sleep(3)
    print("FAILED: " + ",".join(failed) if failed else "ALL OK", flush=True)


if __name__ == "__main__":
    main()
