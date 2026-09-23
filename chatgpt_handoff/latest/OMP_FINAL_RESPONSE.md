# KCS Post-Review Correctness Fix — Task E Final Response (API trust boundary)

This file is the OMP final response for this task. It is copied into `chatgpt_handoff/latest/` and included verbatim in `chatgpt_handoff/CHATGPT_UPLOAD_ONEFILE.md`.

## 1) RESULT

- **Status:** implemented on `fix/api-network-trust-boundary` (base `main` at `ac3bda1`); the merge decision is with the user.
- **Report:** `reports/progress_138_api_trust_boundary.md`.
- **Finding closed:** H-06 — the writable API could be exposed on network interfaces without authentication.

## 2) AUDIT FIRST: WHAT THE PRODUCT IS

- The editor persists through browser local storage; **nothing in `src/` calls this API** (the only `fetch` in the app fetches OGraf legacy assets).
- `README.md` and `docs/API.md` document the API at `http://localhost:5000` only. Nothing in the repository mentions a LAN, a shared server, a remote host or multiple users.
- `server/` contains no authentication, authorization, token, session, login or credential code at all.
- What was actually exposed: `app.listen(PORT, '0.0.0.0')` — every interface — with `cors()` unrestricted and the project routes reachable with no credentials.

**Conclusion: a local, single-user application**, so the task's preferred resolution applies. No authentication system was invented, because the product does not claim a shared deployment and that would be an unapproved architecture change.

## 3) WHAT CHANGED

- `server/bindHost.js` (new): the bind decision, pure and testable — `DEFAULT_API_HOST = '127.0.0.1'`, `resolveBindHost(env)` reading the namespaced `KCS_API_HOST`, `isLoopbackHost`, and the line the server prints. Blank or absent means the default; a named address is taken verbatim.
- `server/index.js`: `app.listen(PORT, bind.host)`. A loopback bind reports the URL and says "this machine only"; anything wider **warns** with what was published and the variable that puts it back.
- `src/tests/apiBindHost.test.ts` (new): the default, the blank-value case, the opt-in, the loopback set, the non-loopback set, and that the warning appears only for the wider bind.
- `.env.example`, `README.md` and `docs/API.md` document the bind, the opt-in, and that the API has no authentication and that CORS is not access control.

## 4) EVIDENCE (real server, not a simulation)

| Check | Result |
|---|---|
| Default start (`PORT=5099`, no `KCS_API_HOST`) | ready log: `http://127.0.0.1:5099 (this machine only)` |
| `GET /api/health` on `127.0.0.1:5099` | **200** — `{"status":"online",...}` |
| `GET /api/projects` on `127.0.0.1:5099` | `success: true`, `source: sqlite` |
| Opt-in start (`KCS_API_HOST=127.0.0.2`, `PORT=5098`) | ready log: `http://127.0.0.2:5098` |
| `GET /api/health` on `127.0.0.2:5098` | **200** |
| Same port on `127.0.0.1:5098` | **ECONNREFUSED** — the bind is the named address, not every interface |
| Working tree after running the real server | unchanged (the tracked SQLite file was not written) |

## 5) VALIDATION

| Check | Result |
|---|---|
| `src/tests/apiBindHost.test.ts` | PASS — 12 tests |
| `npm test` | PASS — 126 files / 1,926 tests |
| `npm run build` (`tsc -b` + vite) | PASS |
| `npm run lint` | clean |
| `npm run validate:ograf` | PASS |
| `npm run qa:release` | PASS — 2 Chromium tests, candidate `ac3bda1` |
| `node scripts/check-state-consistency.mjs` | PASS |
| `git diff --check` | clean |

## 6) SELF-REVIEW NOTES

- **The bind test is a unit test plus a recorded manual run.** A test that starts the real server opens `server/db/keyframe_studio.sqlite`, which is **tracked in git**; a write there would leave a modified binary in the tree. The pure decision is unit-tested and the real behaviour was exercised against a running server, with its output recorded above.
- **`KCS_API_HOST`, not `HOST`:** a bare `HOST` is commonly exported by shells, and a stray value would have widened the bind silently.
- **CORS is deliberately unchanged and is not presented as protection.** Narrowing it would change behaviour for anyone running the API against a different frontend origin; the finding is about network exposure. The risk it does not close — a page in a browser on this machine can still reach a local API, and CORS does not stop a non-browser client — is now stated in `docs/API.md`. Recorded as an adjacent risk needing its own product decision.
- `vite --host` in `npm run dev` still publishes the frontend dev server to the network: a deliberate dev convenience for a static editor with no server-side data, and not the writable API.

## 7) NEXT

- Task F (profiler fixtures: M-04), then G (live docs and the state checker: M-05) — each on its own branch with its own validation and merge gate.
