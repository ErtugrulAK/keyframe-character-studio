# Keyframe Character Studio Sticky Rules

- Repository-root `AGENTS.md` is the main engineering authority; follow its approval boundaries and protected contracts.
- Speak with the user only in Turkish. Keep repository code, tests, documentation, UI text, and commit messages in English.
- Never create or switch branches, commit, push, merge, rebase, reset, stash, or otherwise alter Git state without explicit approval.
- Stop and report unexpected working-tree changes. Existing unrelated files under `.hermes/desktop-attachments/` are local artifacts only; never modify, move, stage, delete, stash, reset, or commit them.
- Implement only the explicitly approved scope. Preserve public APIs, runtime behavior, and backward compatibility unless explicitly approved otherwise.
- Reuse canonical utilities, domain hooks, and state authorities before creating anything new. Never add a parallel animation, evaluation, playback, state, serialization, clipboard, or timing engine when the existing authority can be extended.
- Never weaken assertions or hide failures with skips, extra retries, arbitrary sleeps, tolerance/threshold hacks, or fallback behavior.
- Production code and tests must never depend on `.omp` harness files.
