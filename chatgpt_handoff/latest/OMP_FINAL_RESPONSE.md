# KCS Authoring Publication — 2026-10-05

## Scope

Publication starts from synchronized main at `703e45ab209530f20928cf5e13287b759276a33f`. The owner approved publication of the pending authoring changes, the active-sequence stage correction, six meaningful dated commits, fast-forward integration, and a normal push.

- Text Appearance supports stroke consistently in the canvas and OGraf renderer.
- Position-only layer bonds reuse the existing inspector/history pipeline. Text and freeform layers participate in Boolean geometry through the existing geometry authority.
- Opacity has an authoring control. Motion Curves edits the incoming segment selected by its end keyframe; a first keyframe has no incoming segment.
- Sidebar transitions, transport controls, and Media/Texts drawers are reconciled with the current UI.
- Same-frame property writes match the sequence identity. Edit-mode painted layers use the active sequence, matching their selection gizmos; Broadcast keeps its runtime sequence selection.
- Browser contracts select valid incoming segments. Obsolete inspector wording/field-absence assertions were removed. Matte region probes capture one image per exact sample grid without changing thresholds or parity assertions.

## Runtime evidence

A real browser drag moved the second-sequence circle by +100/+40 screen pixels while the default sequence retained x=-100. A bonded circle/text pair moved by the same -60/+20 screen-pixel delta. The named-sequence browser regression also checks painted geometry when switching sequences.

Current validation results are recorded in `PROJECT_STATE.md` and `NEXT_SESSION.md`. Historical Astra evidence in `progress_151_astra_remediation.md` remains a historical record, not this publication's verification report.

## Dating provenance

The six author dates are owner-approved retrospective metadata: August 29, September 5, 12, 19, 26, and October 5, 2026. Committer dates reflect actual creation. Earlier author dates do not represent earlier uploads or prove work occurred on those days. Every group contains real changes; there are no empty contribution-filling commits.

No old-branch patch replay, rebase, reset, shared-history rewrite, force push, or branch deletion is authorized by this publication. Historical review branches remain intact. Publication uses `feature/studio-authoring-fixes`, a fast-forward into main, and a normal push. Remote publication and its CI result are verified separately after the local gate; this document does not predict their success.

## Protected release state

H7 remains HOLD. Release tags, the draft prerelease, the private package, npm publication, external QA folders, `.hermes/desktop-attachments/`, and OMP configuration are unchanged.

Upload only `chatgpt_handoff\CHATGPT_UPLOAD_ONEFILE.md` to ChatGPT.
