# wiki/raw — Work-Machine Knowledge Base Seed

Collected from the **work PC** on 2026-08-07 to be carried to the home PC.

## Source machine

| Field | Value |
|---|---|
| OS | Windows 10 (Turkish UI) |
| Work PC username | `ertugrul.ak` |
| KCS repo path (work) | `C:\Users\ertugrul.ak\Desktop\keyframe-character-studio` |
| Home PC username | `senmu` (separate machine; sync via GitHub pull + Hermes profile import) |

## File origins

| File / Folder | Came from |
|---|---|
| `notes/hermes-kb/*.md` | Hermes KB (the assistant's long-term memory notes) — `C:\Users\ertugrul.ak\AppData\Local\hermes\profiles\ertu\notes\` (index, projeler, tercihler, ogrenilenler, kararlar) |
| `assets/test-checklist.xlsx` | Desktop — KCS test checklist |
| `assets/vidfeo card.xlsx` | Desktop — KCS video card design doc |
| `assets/bookmarks-edge.json` | Microsoft Edge bookmarks — `C:\Users\ertugrul.ak\AppData\Local\Microsoft\Edge\User Data\Default\Bookmarks` (Chrome had no bookmarks file) |
| `assets/screenshots/*.png` (59) | Hermes composer images (KCS UI screenshots) — `C:\Users\ertugrul.ak\AppData\Roaming\Hermes\composer-images\` |
| `scripts/ocr-image.ps1` | Windows OCR helper used for reading screenshots (WinRT OCR; copy target PNG to a short path like `C:\temp\img.png` first) |

## Environment variables

**No `.env` file exists on the work machine** — only the public template `.env.example`
(`PORT=5000`, `DATABASE_URL`). Nothing sensitive to redact. The `.env.local` is
gitignored and not present.

## Git config (work machine, sensitive values omitted)

```
user.name=ErtugrulAK
user.email=102478080+ErtugrulAK@users.noreply.github.com
core.autocrlf=<value omitted>
pull.rebase=<value omitted>
init.defaultbranch=main
credential.helper=<value omitted>
```

## Notes for the home PC

- Pull this repo, then move/copy `wiki/raw/*` contents into the home machine's own
  wiki if desired (do not commit personal files back unless intended).
- Hermes KB on the home PC syncs via **profile export/import**, not via this folder.
- Screenshots are session snapshots from 2026-08-06/07 (KCS UI states).
