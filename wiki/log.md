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

## [2026-08-10] update | Keyframe Character Studio — M13 milestone (clip|alpha|luminance + inverted)
- Updated: entities/keyframe-character-studio.md (Track Matte M13 mimarisi), skills/keyframe-studio/kcs-track-matte/SKILL.md (v2.0)
- M13 kapsamı: PartMatte.mode 'clip'|'alpha'|'luminance' + inverted?; buildMattePath tek geometry çekirdeği; StagePartLayers mask pipeline (matteMasks + maskPathCache); StyleMatteSection Mode/Inverted UI; serialization round-trip; 354/354 vitest
- KRİTİK browser kararları (Chromium pixel-verified):
  1. userSpaceOnUse clipPath/mask, transform'lu target g'de referans edilince TARGET'IN LOCAL uzayında çözülüyor → clip/mask transform'suz OUTER <g>'de (PartRenderer iki katman)
  2. Chromium ALPHA mask'ta region rect + ikinci eleman birlikteyken ikinci eleman yok sayılıyor (transparent/rgba/hex8/fill-opacity hepsi FAILED) → inverted alpha = TEK fill-rule="evenodd" path (region konturu + matte konturu)
  3. Luminance inverted (white region rect + black path) DOĞRU — değişmedi
- E2E: e2e/track-matte.spec.ts — 7 DOM + 7 gerçek pixel compositing testi (world→screen CTM + PNG decode) — 14/14 PASS
- Not: M13 2A-2B iş PC'den (dff30d2), 2C-2F ev PC'de (push bekliyor)
