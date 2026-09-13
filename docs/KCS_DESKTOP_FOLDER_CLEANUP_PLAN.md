# Desktop KCS Folder Cleanup Plan

## Decision

Use archive-only cleanup. Do not permanently delete any item.

## Approved move

Move this high-confidence stale generated backup:

```text
C:\Users\senmu\Masaüstü\KCS\kcs-ograf-public-controls-qa.before-fix-20260913-152710\
```

to a timestamped archive directory:

```text
C:\Users\senmu\Masaüstü\KCS\_archive\cleanup-YYYYMMDD-HHMMSS\kcs-ograf-public-controls-qa.before-fix-20260913-152710\
```

The archive must contain `MANIFEST.txt` with the original relative path, archived relative path, file count, and SHA-256 for every moved file.

## Retain in place

- `kcs-ograf-public-controls-qa/` — current user-validated QA folder.
- `kcs-ograf-host-compat-qa/` — earlier host compatibility evidence.
- `kcs-ograf-downstream-qa/` — downstream packages, ZIPs, and unique font diagnostics.
- `ograf-graphics/` — copied read-only graphics corpus.
- All current QA assets, screenshots if later discovered, fonts, diagnostics, and configuration evidence.

## Do not remove duplicate bytes

The inventory found exact duplicates across retained QA folders. They are not removed because the containing folder identifies the QA stage and import context. Removing them would destroy evidence context without reducing a verified product risk.

## User-decision items

The following remain in place and require a future explicit retention decision:

- Whether the earlier `kcs-ograf-host-compat-qa/` set can be archived.
- Whether the earlier `kcs-ograf-downstream-qa/` set and its ZIPs can be archived after downstream retention is confirmed.
- Whether any project under `ograf-graphics/` has an external owner or retention requirement.

## Safety rules

- Preserve relative paths under `_archive/cleanup-<timestamp>/`.
- Write the manifest before reporting completion.
- Verify source absence and archive presence after the move.
- Never touch the repository checkout, `.omp/backups`, secrets, or the protected `ograf-graphics` corpus.
- No permanent deletion.
