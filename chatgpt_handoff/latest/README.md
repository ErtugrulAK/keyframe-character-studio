# KCS Minimal ChatGPT Upload Bundle — Task 106B

This is a minimal, task-specific ChatGPT upload bundle. It was clean-refreshed for this conversation only.

## What this bundle is for

Task 106B: correct the ChatGPT handoff policy, clean `C:\Users\ertugrul.ak\Desktop\KCS`, and report the GitHub CI failure investigation.

## What it deliberately does NOT include

- Task 105 source and test files (flattened copies). Those copies were the root cause of the failing CI runs: the files named `src__*test*` matched the Vitest default include glob and failed to resolve their imports from `chatgpt_handoff/latest/`. They also exist in the repository under `src/`, so they are not needed here.
- `package.json`, `ci.yml`, `release-smoke.yml`, `CHANGELOG.md`, and the older release/current-state documents. They belong to earlier bundles and are unchanged by this task.
- Old reports, QA output, archives, assets, screenshots, zip files, secrets, and caches.

Omitted files were not deleted from the repository; they are simply not part of this bundle.

## Desktop note

`C:\Users\ertugrul.ak\Desktop\KCS` is the user's project/asset workspace, not the handoff dump. The 35 handoff files that were accidentally copied there have been moved into `_archive_chatgpt_handoff_dump_20260916-123414`, and no bundle is copied back there by default.

## How to use it

Upload only the files in this folder when ChatGPT needs this cleanup and CI context. For a new task, clean this folder first and place only the files that task needs.

Upload the contents of `chatgpt_handoff/latest/` to ChatGPT.
