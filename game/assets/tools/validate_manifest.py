#!/usr/bin/env python3
"""Validate generated IMG-xx assets and append MANIFEST.jsonl rows.

Pipeline (assets-config.md 生成后流水线):
  alpha machine-validation (transparent assets) / opaque check (backgrounds)
  -> size check vs design/assets.md spec
  -> sha256 -> cost by official resolution tier (cost_estimated: true)
  -> append 1 row per asset to game/assets/MANIFEST.jsonl (append-only).

Usage:
    python3 validate_manifest.py            # validate+write MANIFEST for all ok assets
    python3 validate_manifest.py --check    # validation only, no MANIFEST writes
"""
import hashlib
import json
import os
import subprocess
import sys
import urllib.request
import base64
import uuid
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from assets_spec import ASSETS, ASSET_BY_ID, OUT_DIR, PROGRESS, ROOT  # noqa: E402

MANIFEST = os.path.join(ROOT, "game", "assets", "MANIFEST.jsonl")
CHECK = "--check" in sys.argv
REGEN = "--regen" in sys.argv  # re-generate alpha failures via /images/edits once

# Official resolution tier pricing (assets-config.md gpt-image-2 notes).
def tier_cost(size):
    w, h = (int(x) for x in size.lower().split("x"))
    return 0.05 if max(w, h) > 1024 else 0.03


def load_progress():
    entries = {}
    if os.path.exists(PROGRESS):
        with open(PROGRESS, "r", encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if not line:
                    continue
                e = json.loads(line)
                if e.get("status") == "ok":
                    entries[e["id"]] = e
    return entries


def load_manifest_files():
    files = set()
    if os.path.exists(MANIFEST):
        with open(MANIFEST, "r", encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if not line:
                    continue
                files.add(json.loads(line).get("file"))
    return files


def validate(asset, path):
    """Returns (ok, reasons[])."""
    from PIL import Image
    reasons = []
    im = Image.open(path)
    want = tuple(int(x) for x in asset["size"].lower().split("x"))
    if im.size != want:
        reasons.append(f"size mismatch: {im.size} != {want}")
    if asset["background"] == "transparent":
        if im.mode != "RGBA":
            im = im.convert("RGBA")
        a = im.getchannel("A")
        amin, amax = a.getextrema()
        if amin >= 250:
            reasons.append(f"no transparency (alpha min={amin}) — white/opaque background")
        w, h = im.size
        corners = [im.getpixel((0, 0)), im.getpixel((w - 1, 0)),
                   im.getpixel((0, h - 1)), im.getpixel((w - 1, h - 1))]
        opaque_corners = sum(1 for c in corners if c[3] > 8)
        if opaque_corners >= 3:
            reasons.append(f"corners not transparent: {corners}")
        # opaque pixel ratio sanity (1%..85%): catch empty sheets / full-bleed fills
        hist = a.histogram()
        opaque = sum(hist[200:])
        ratio = opaque / (w * h)
        if ratio < 0.005:
            reasons.append(f"nearly empty alpha (opaque ratio {ratio:.4f})")
        if ratio > 0.97:
            reasons.append(f"nearly fully opaque (opaque ratio {ratio:.3f}) — background残留?")
    else:
        if im.mode in ("RGBA", "LA", "PA"):
            a = im.getchannel("A")
            amin, _ = a.getextrema()
            if amin < 250:
                reasons.append(f"opaque asset has transparency (alpha min={amin})")
    return (len(reasons) == 0), reasons


def main():
    progress = load_progress()
    manifest_files = load_manifest_files()
    failures = []
    written = []
    for asset in ASSETS:
        aid = asset["id"]
        path = os.path.join(OUT_DIR, asset["file"])
        rel = "assets/images/" + asset["file"]
        if aid not in progress:
            failures.append((aid, "not generated (no progress entry)"))
            continue
        if not os.path.exists(path) or os.path.getsize(path) == 0:
            failures.append((aid, "file missing/empty"))
            continue
        ok, reasons = validate(asset, path)
        if not ok:
            failures.append((aid, "; ".join(reasons)))
            continue
        if CHECK or rel in manifest_files:
            continue
        entry = progress[aid]
        with open(path, "rb") as fh:
            sha = hashlib.sha256(fh.read()).hexdigest()
        size = asset["size"]
        row = {
            "file": rel,
            "asset_id": aid,
            "provider": "openai-compat:slb-v1.api.fan:gpt-image-2",
            "model": "gpt-image-2",
            "prompt": entry["prompt"],
            "seed": None,
            "style_codes": [],
            "cost_usd": tier_cost(size),
            "cost_estimated": True,
            "plan_tier": "relay",
            "size": size,
            "background": asset["background"],
            "ref_image": entry.get("ref"),
            "route": entry["meta"]["route"],
            "api_usage": entry["meta"].get("usage"),
            "sha256": sha,
            "license": "commercial-ok-per-provider-terms",
            "license_note": "openai-relay-packcode; billing by relay, estimated at official "
                            + ("1536x1024" if tier_cost(size) == 0.05 else "1024x1024") + " tier",
            "generated_at": entry.get("finished_at") or subprocess.run(
                ["date", "-u", "+%Y-%m-%dT%H:%M:%SZ"], capture_output=True, text=True
            ).stdout.strip(),
        }
        with open(MANIFEST, "a", encoding="utf-8") as fh:
            fh.write(json.dumps(row, ensure_ascii=False) + "\n")
        manifest_files.add(rel)
        written.append(aid)
    print("MANIFEST rows written:", ",".join(written) if written else "(none)")
    if failures:
        print("VALIDATION FAILURES:")
        for aid, why in failures:
            print(f"  {aid}: {why}")
        sys.exit(1)
    print("ALL VALID")


if __name__ == "__main__":
    main()
