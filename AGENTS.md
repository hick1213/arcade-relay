# ArcadeRelay — Codex project instructions

ArcadeRelay is a multi-agent game-production harness. Codex should treat the
file-backed state under `state/` and the contract under `.codex/docs/` as the
source of truth.

## Required project rules

- Read `.codex/docs/contract.md` before changing names, IDs, paths, stages, or
  workflow interfaces.
- Apply the `produce → review → revise` loop in `.codex/docs/review-loops.md`.
- Select the engine from `state/engine.txt`; follow the matching
  `.codex/docs/tech-stack*.md` and `.codex/rules/` file.
- Read `state/active.md` and `state/stage.txt` before continuing a pipeline
  phase, then update `state/active.md` after work.
- Keep generated asset provenance in the engine-specific MANIFEST path defined
  by the contract.

## Codex entry points

- Project skills live under `.agents/skills/` and are invoked explicitly as
  `$forge`, `$forge-status`, `$forge-brainstorm`, `$forge-concept`,
  `$forge-prototype`, or `$forge-build`.
- Custom subagents are defined by `.codex/agents/*.toml`; their detailed role
  instructions remain in the adjacent `.md` files.
- The orchestration sources are `.codex/workflows/*.js`. Preserve their JSON
  schemas, phase labels, and review semantics when changing them.
- Project configuration and lifecycle hooks are in `.codex/config.toml` and
  `.codex/hooks.json`. Review new or changed hooks with Codex's `/hooks`
  command before relying on them.

## Verification

- Run `git diff --check` for every change.
- For workflow changes, run `node --check` on each changed workflow and
  `node --test '.codex/tests/workflows/**/*.test.mjs'`.
- Do not run generated-game checks unless the corresponding engine marker is
  present; then use the commands in the matching `.codex/docs/tech-stack*.md`.

## Collaboration and safety

- Prefer `rg` and targeted reads; never read an entire large file without need.
- Keep unrelated working-tree changes intact and stage only files belonging to
  the current task.
- Use Codex subagents for independent read-heavy review or investigation, and
  wait for all requested findings before deciding.
- Do not commit `.env`, credentials, generated secrets, or private provider
  output.
