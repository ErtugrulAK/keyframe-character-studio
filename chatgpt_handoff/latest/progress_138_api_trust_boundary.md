# Progress 138 — Task E: the API trust boundary

Branch: `fix/api-network-trust-boundary` (base `main` at `ac3bda1`).
Finding: **H-06** — the writable API could be exposed on network interfaces without authentication.

## 1. Audit first: what this product is

Before any code, the deployment question the task asks for:

| Question | Evidence |
|---|---|
| Is the editor local-only? | The editor persists through browser local storage (`AUTOSAVE_STORAGE_KEY`); **nothing in `src/` calls this API** — the only `fetch` in the app fetches OGraf legacy assets. The API is a separate documented surface. |
| Is LAN/shared use documented or supported? | No. `README.md` and `docs/API.md` document it at `http://localhost:5000` only; nothing in the repository mentions a LAN, a shared server, a remote host or multiple users. |
| Is there any authentication to build on? | No. `server/` contains no auth, token, session, login or credential code at all. |
| What was actually exposed? | `app.listen(PORT, '0.0.0.0')` — every interface — with `cors()` unrestricted, and `GET/POST/DELETE /api/projects` plus `POST /api/presets` reachable with no credentials. |

**Conclusion: a local, single-user application.** So the task's preferred resolution applies — bind
loopback by default, make network exposure an explicit opt-in, document it — and **no authentication
system was invented**, because the product does not claim a shared deployment and inventing one would
be an unapproved architecture change.

## 2. Applied

- **`server/bindHost.js` (new).** The bind decision, pure and testable: `DEFAULT_API_HOST = '127.0.0.1'`,
  `resolveBindHost(env)` reading the namespaced `KCS_API_HOST` variable, `isLoopbackHost`, and the line
  the server prints. A blank or absent setting is the default; a named address is taken verbatim, so an
  operator can publish one interface instead of all of them.
- **`server/index.js`.** `app.listen(PORT, bind.host)` instead of `'0.0.0.0'`. On a loopback bind it
  reports the URL and says "this machine only"; on anything wider it **warns** with what was published
  and the variable that puts it back.
- **`src/tests/apiBindHost.test.ts` (new).** The default, the blank-value case, the opt-in, the loopback
  set (`127.0.0.1`, `127.0.0.5`, `localhost`, `::1`), the non-loopback set (`0.0.0.0`, `192.168.1.10`,
  `10.0.0.1`), and that the exposure warning appears only for the wider bind.
- **Documentation.** `.env.example` carries `KCS_API_HOST` with its meaning; `README.md` gains a
  "Where the API listens" section; `docs/API.md` gains "Binding and exposure" and stops presenting CORS
  as a protection.

## 3. Evidence (real server, not a simulation)

| Check | Result |
|---|---|
| Default start (`PORT=5099`, no `KCS_API_HOST`) | ready log: `http://127.0.0.1:5099 (this machine only)` |
| `GET /api/health` on `127.0.0.1:5099` | **200** — `{"status":"online","service":"Keyframe Studio API",...}` |
| `GET /api/projects` on `127.0.0.1:5099` | `success: true`, `source: sqlite` |
| Opt-in start (`KCS_API_HOST=127.0.0.2`, `PORT=5098`) | ready log: `http://127.0.0.2:5098` |
| `GET /api/health` on `127.0.0.2:5098` | **200** |
| Same port on `127.0.0.1:5098` | **ECONNREFUSED** — the bind is the named address, not every interface |
| Working tree after running the real server | unchanged (the tracked `server/db/keyframe_studio.sqlite` was not written) |

## 4. Validation

| Check | Result |
|---|---|
| `src/tests/apiBindHost.test.ts` | PASS — 12 tests |
| `npm test` | PASS — 126 files / 1,926 tests |
| `npm run build` (`tsc -b` + vite) | PASS |
| `npm run lint` | clean |
| `npm run validate:ograf` | PASS |
| `npm run qa:release` | PASS — 2 Chromium tests, candidate `ac3bda1` (the gate starts the real server, which now binds loopback) |
| `node scripts/check-state-consistency.mjs` | PASS |
| `git diff --check` | clean |

## 5. Self-review (read-only, same model)

- **Why the bind test is a unit test plus a recorded manual run.** A test that starts the real server
  would open `server/db/keyframe_studio.sqlite`, which is **tracked in git** — a write there would leave
  a modified binary in the tree. The pure decision is unit-tested; the real behaviour (default bind,
  health, opt-in, refusal on the default address) was exercised against a running server and is recorded
  above with its output. The tracked database file is itself a hygiene question, and it is not this
  finding's to change.
- **`KCS_API_HOST`, not `HOST`.** A bare `HOST` is commonly exported by shells and terminal tooling; a
  stray value would have widened the bind silently. The namespaced variable cannot be set by accident.
- **CORS is deliberately unchanged, and is not presented as protection.** `cors()` still allows any
  origin. Narrowing it would change behaviour for anyone running the API against a different frontend
  origin, and the finding is about *network* exposure — but the risk it does not close is worth stating:
  a page in a browser on this machine can still reach a local API, and CORS does not stop a non-browser
  client. `docs/API.md` now says exactly that, so no reader mistakes it for access control. Recorded
  here as an adjacent risk that needs its own product decision.
- **`vite --host` in `npm run dev` still publishes the frontend dev server to the network.** That is a
  deliberate dev convenience for a static editor with no server-side data, and it is not the writable
  API; left as it is.
- **Preserved workflow:** `npm run dev`, `npm run server` and the release gate's webServer all keep
  working unchanged, because a loopback bind is what they were documented to use.

## 6. Not changed

- No authentication or authorization was added (out of scope by the task's own instruction).
- No route, payload limit, database access, CORS configuration or package dependency changed.
- No new dependency, workflow, tag or release action.
