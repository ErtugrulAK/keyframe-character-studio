# KCS Minimal ChatGPT Upload Bundle — Task E (API trust boundary)

This is a minimal, task-specific ChatGPT upload bundle. It was clean-refreshed for this task.

## What this bundle covers

H-06 from the full-project review, on `fix/api-network-trust-boundary` from `main` at `ac3bda1`:

- **Audit first:** the editor persists through browser local storage and **nothing in `src/` calls the
  API**; the API is documented at `localhost:5000` only; nothing mentions a LAN, a shared server or
  multiple users; `server/` contains no authentication code at all. The product is a local,
  single-user application, so the task's preferred resolution applies and no authentication system was
  invented.
- The REST API now binds **`127.0.0.1`** instead of every interface, so the unauthenticated project
  store is reachable from this machine only. Reaching a wider interface is an explicit opt-in
  (`KCS_API_HOST`), and the server warns with what it published and how to undo it.
- Proven against a running server: the default binds loopback and `GET /api/health` returns 200; the
  opt-in binds exactly the address named and the same port on the default address refuses
  (`ECONNREFUSED`).
- `README.md` and `docs/API.md` now state that the API has no authentication and that CORS is not
  access control; `.env.example` documents the variable. No dependency, workflow, tag or release
  change.

## Files

- `OMP_FINAL_RESPONSE.md` — the final response for this task
- `progress_138_api_trust_boundary.md` — the task record
- `KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md` — the roadmap with the milestone status
- `CHANGELOG.md` — the repository changelog
- `NEXT_SESSION.md` — repository state and the current next action
- `PROJECT_STATE.md` — project state, validation status and the handoff policy
- `manifest.txt` — this bundle's inventory

`NEXT_SESSION.md`, `PROJECT_STATE.md`, `KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md` and `CHANGELOG.md`
are copies of their root documents; `node scripts/check-state-consistency.mjs` compares them after
CRLF→LF normalization and a whole-document `trim()` and fails on content drift.

## Deliberately not included

Source, test and design files are intentionally omitted (they live in the repository). Flattened
copies named `src__*test*` previously matched Vitest's default include glob and broke CI. Also
omitted: `package.json`, `package-lock.json`, CI/release workflows, older reports,
release/current-state documents, QA output, assets, archives, and caches.

Omitted files were not deleted from the repository; they are simply not part of this bundle.

## Staging note

`C:\Users\ertugrul.ak\Desktop\KCS` is the user's project/asset workspace, not a handoff destination.
Nothing was copied there, and nothing should be.

Upload only `chatgpt_handoff\CHATGPT_UPLOAD_ONEFILE.md` to ChatGPT. The files in this folder are its sources.
