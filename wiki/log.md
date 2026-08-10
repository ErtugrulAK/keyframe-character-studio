# Wiki Log

> Chronological record of all wiki actions. Append-only.
> Format: `## [YYYY-MM-DD] action | subject`
> Actions: ingest, update, query, lint, create, archive, delete

## [2026-08-08] create | Wiki initialized
- Domain: Keyframe Character Studio — staj projesi + yazılım mühendisliği bilgi tabanı
- Structure created with SCHEMA.md, index.md, log.md
- Location: `keyframe-character-studio/wiki/` (inside KCS repo, git-tracked)

## [2026-08-08] ingest | Work-machine KB seed → wiki pages (batch 1)
- Created: entities/keyframe-character-studio.md, concepts/long-term-memory.md, concepts/render-pipeline.md
- Sources: raw/notes/hermes-kb/*.md (5 KB files from work PC)

## [2026-08-08] ingest | Work-machine assets → wiki pages (batch 2)
- Created: entities/bookmarks.md, entities/video-card-inventory.md, concepts/test-checklist.md, entities/kcs-ui-screenshots.md
- Sources: raw/assets/bookmarks-edge.json, raw/assets/vidfeo card.xlsx, raw/assets/test-checklist.xlsx, raw/assets/screenshots/ (59 files)
- Updated: index.md (7 pages), log.md
- Total pages after ingest: 7 (4 entities, 3 concepts)

## [2026-08-09] update | Keyframe Character Studio — M11/M12 durum güncellemesi
- Updated: entities/keyframe-character-studio.md (eski 106-test/mask sistemi bilgisi → güncel 316 test, canonical channels, Track Matte)
- İçerik: M1-M10 RELEASE READY, M11 Track Matte MVP COMPLETE, M12 audit "kapatılabilir"
- Not: M11 track matte değişiklikleri push edildi (feat commit) — iş PC'sinden pull ile erişilebilir
