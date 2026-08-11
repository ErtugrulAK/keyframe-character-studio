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

## [2026-08-10] update | KCS — M14 Feather (iş PC — 2D/2E)
- M14 ✅ COMPLETE: Feather — PartMatte.feather (world-space px), normalizeFeather (negatif/NaN/Inf → 0),
  mask id -f{feather} suffixi (çakışma yok), feGaussianBlur stdDeviation=feather/2, geniş filter region
- 2D: StyleMatteSection FEATHER slider (0-100, clip modunda disabled — renderer clip feather desteklemez)
- 2E: serialization round-trip (feather 0/12/100, undefined-key yok, negative/NaN guard) +
  V-K (inverted alpha feather — evenodd delik + yumuşak geçiş) + V-L (luminance feather — white fill tam güç)
- Baseline: 382/382 vitest + 19/19 track-matte playwright; full suite'te workflow.spec.ts:88
  ölü container testi fail (b60f1ca sonrası, M14 dışı)
- Updated: entities/keyframe-character-studio.md, skills/keyframe-studio/kcs-track-matte (v2.1.0)

## [2026-08-10] update | KCS — M15 Freeform Track Matte (iş PC)
- M15 ✅ COMPLETE: Free Draw (custom_freeform) artık matte source
- 3A: spike — freeform points → world polygon math kanıtı (12/12)
- 3B: buildMattePath freeform dalı (CharacterPart.points — renderer'ın buildFreeformPath
  ile AYNI kaynak; ikinci geometry sistemi yok) + isMatteEligible; 403/403
- 3C: StagePartLayers'a DOKUNMADAN Chromium pixel kanıtı (V-M1..V-M6: clip/alpha/
  inverted/feather/rotated+scaled/animated) — 25/25
- 3D: StyleMatteSection isMatteEligible filtresi + source swap field preservation
  ({...matte, sourcePartId} — mode/inverted/enabled/feather korunur); 408/408
- 3E: serialization round-trip (points + matte kayıpsız) + gerçek import→render pixel
  parity (V-M7/V-M8 — autosave/export + reload/import); 411/411 + 27/27
- Baseline: 411/411 vitest + 27/27 track-matte playwright; full suite tek fail:
  workflow.spec.ts:88 ölü container testi (M15 dışı)
- Updated: entities/keyframe-character-studio.md, skills/keyframe-studio/kcs-track-matte (v3.0.0), README.md

## [2026-08-10] update | KCS — M16 Matte Strength / Opacity (iş PC)
- M16 ✅ COMPLETE: matte etkisi 0-100% arasında ayarlanabilir (mask content fill-opacity)
- 2A: PartMatte.strength? (0-1) + normalizeStrength (undefined/NaN/±Inf/negatif/>1 → 1;
  0 geçerli — `|| 1` yasak) + MatteMask.strength; geometry parity; 426/426
- 2B: StagePartLayers mask content'e fillOpacity (yalnızca strength<1; undefined/1 =
  canonical DOM) + `-s{strength}` id suffixi (farklı strength → ayrı mask, çakışma yok);
  clip etkisiz; evenodd/luminance korundu; V-S1..V-S5 pixel (0/0.5/1 + inverted + feather
  ramp); 435/435 + 32/32
- 2C: StyleMatteSection STRENGTH slider (0-100%, clip disabled, field preservation,
  local state yok, undefined→100%); 447/447
- 2E: serialization round-trip (strength 0/0.5/1/undefined/malformed; 0 falsy kaybolmaz;
  M8: strength sadece layers[].matte) + V-S6..V-S8 (import→reload: strength+feather+
  inverted korunur, fill-opacity DOM, pixel parity EXACT); 454/454 + 35/35 ×2 deterministik
- Baseline: 454/454 vitest + 35/35 track-matte playwright; full suite tek fail:
  workflow.spec.ts:88 ölü container testi (M16 dışı)
- Updated: entities/keyframe-character-studio.md, skills/keyframe-studio/kcs-track-matte (v4.0.0), README.md
