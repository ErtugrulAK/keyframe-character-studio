# Desktop KCS Folder Cleanup Result

## Result

Archive-only cleanup applied successfully. No permanent deletion occurred.

## Moved to archive

- `kcs-ograf-public-controls-qa.before-fix-20260913-152710/`
  - Moved to `C:\Users\senmu\Masaüstü\KCS\_archive\cleanup-20260913-165024\kcs-ograf-public-controls-qa.before-fix-20260913-152710\`.
  - 11 files preserved.
  - `MANIFEST.txt` records original/archived paths, sizes, and SHA-256 values.

Post-move verification:

- Archive directory: present.
- Archive manifest: present.
- Archived file count: 11.
- Original stale-backup path: absent.
- Current public-controls path: present.

## Kept in place

- `C:\Users\senmu\Masaüstü\KCS\kcs-ograf-public-controls-qa\` — current BASIC/ASSET/COMPOSITING host QA; all three reported PASS.
- `C:\Users\senmu\Masaüstü\KCS\kcs-ograf-host-compat-qa\` — prior host compatibility evidence.
- `C:\Users\senmu\Masaüstü\KCS\kcs-ograf-downstream-qa\` — downstream ZIPs, extracted packages, and unique font diagnostics.
- `C:\Users\senmu\Masaüstü\KCS\ograf-graphics\` — protected copied corpus; untouched.

## Needs user decision

- Whether to archive the older host-compatibility folder.
- Whether to archive the downstream QA folder and ZIPs after downstream retention is confirmed.
- Whether any project in `ograf-graphics` has an external retention owner.

## Permanent deletion statement

No file or folder was permanently deleted. Exact duplicate files inside retained QA folders were left in place because their folder context is evidence.
