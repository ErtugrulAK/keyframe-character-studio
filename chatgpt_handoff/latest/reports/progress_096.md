# Progress 096 — Local Tooling PATH Audit

## Task

Task 6: audit MarkItDown, Strix, and Skill UI PATH availability without activation.

## Baseline and Branch

- Baseline `main`: `b0d0177`
- Branch: `chore/tooling-path-audit-fix`
- Scope: read-only command availability audit; no installation or global configuration change.

## Results

- `where.exe markitdown`: not found on PATH.
- `where.exe strix`: not found on PATH.
- `where.exe skill-ui`: not found on PATH.
- `uv tool list`: reports installed tools:
  - `markitdown v0.1.7` / command `markitdown`
  - `strix-agent v1.6.2` / command `strix`
  - `trafilatura v2.2.0` / command `trafilatura`
- Safe command lookup found `uv.exe`, Python, and Node; no secret or environment value was printed.

Conclusion: MarkItDown and Strix appear installed through uv but their executable directory is not exposed through the current PATH. Skill UI was not found in PATH or the uv tool list. No PATH/profile/global OMP modification was made.

## Safety

- Strix scan was not run.
- Skill UI crawl/init was not run.
- No tool installation, admin action, global OMP config change, hook/routing change, server activation, secret access, release, or tag operation.
- `without-mask` was untouched.
