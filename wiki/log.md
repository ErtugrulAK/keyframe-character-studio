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

## [2026-08-11] update | KCS — M17 Gradient Track Matte (iş PC)
- M17 ✅ COMPLETE: matte source'a linear gradient (userSpaceOnUse, world-space endpoints)
- 3A: spike — gradient-in-mask Chromium kanıtı (12/12 pixel: alpha/evenodd/luminance/
  inv-lum/feather/strength/freeform/rotation/scale/neg-scale/animasyon/dedupe)
- 3B: PartMatte.gradient?{angle} + normalizeGradientAngle (undefined→undefined;
  NaN/±Inf→0; mod 360 — 360≡0, -315≡45) + gradientId kcs-mg-{src}-{angle}-{mode}
  + default stops (alpha white→transparent; luminance white→black); 486/486
- 3C: StagePartLayers — linearGradient defs (lokal bbox → 2 nokta → applyWorld;
  source'la taşınır/döner/ölçeklenir/flip; animasyonda stale yok) + mask fill=url +
  -g{angle} mask suffixi; V-G1..V-G10 pixel; 496/496 + 45/45
- 3D: Inspector GRADIENT toggle + ANGLE slider (0-360, clip disabled, field
  preservation, local state yok); 510/510
- 3E: serialization (0/45/90/360-raw/malformed/full/freeform/channels-only/legacy)
  + V-G11 (neg scale) + V-G12 (dedupe); 518/518 + 47/47 ×2 deterministik
- Baseline: 518/518 vitest + 47/47 track-matte playwright; full suite tek fail:
  workflow.spec.ts:88 ölü container testi (M17 dışı)
- Updated: entities/keyframe-character-studio.md, skills/keyframe-studio/kcs-track-matte (v5.0.0), README.md

## [2026-08-12] update | KCS — M18 Text Track Matte (iş PC)
- M18 ✅ COMPLETE (4A-4F) — **COMMIT/PUSH YAPILMADI** (onay bekliyor)
- 4A: browser spike — text part matte source; mask content `<text>` Chromium kanıtı; kritik
  bulgular: inverted alpha+text → luminance yapısı zorunlu (alpha mask 2. elemanı ignore);
  gradient text lokal uzayda çözülüyor → lokal endpoint kararı; font determinizm
  (fonts.ready + HHH/80px) — **13/13 ×2 spike** (17.5s/17.1s)
- 4B: data/pure — isMatteEligible(custom_text), MatteMask.text render-data (pathD null),
  textMaskContent/buildMatteTextMask/worldToLocal/gradientEndpointsLocal;
  buildMattePath text→null korundu; **533/533 + 47/47 ×2**
- 4C: render — StagePartLayers text content branch (transform bake her frame; inverted→luminance;
  gradient lokal; feather/strength; dedupe; clip yok); **543/543 + 51/51 ×2**
- 4D: UI — text listede; text+clip option disabled + not; field preservation; local state yok;
  **552/552 + 51/51 ×2**
- 4E: serialization (runtime text data persist edilmez; sourcePartId tek bağlantı;
  useSerialization değişmedi) + V-T1..V-T17 tam pixel matrisi (import-reload EXACT parity);
  **558/558 + 64/64 ×2 deterministik**
- 4F: docs — SKILL v6.0.0 (M18 bölümü + deferred güncellemesi), wiki entity/log, README;
  final audit: 8 korumalı dosya untouched, ikinci geometry sistemi yok, M8 korundu
- Full suite: **66 passed / 1 failed** — tek fail workflow.spec.ts:88 ölü container (M18 dışı)
- Commit/push: YOK (HEAD hâlâ `1f6c7ba` — M17)

## [2026-08-12] update | KCS — M19 Custom / Multi-stop Gradient (iş PC)
- M19 ✅ COMPLETE (5A-5F) — **COMMIT/PUSH YAPILMADI** (onay bekliyor)
- 5A: spike — N-stop linearGradient-in-mask Chromium kanıtı **15/15 ×2** (unsorted doc order
  farklı ramp → sıralama şart; duplicate offset sonraki stop kazanır; aynı id + farklı stops →
  COLLISION — id stops hash taşımalı; determinizm byte-identical)
- 5B: data/pure — gradient.stops? (additive), normalizeGradientStops (clamp/stabil sort/salvage/
  drop/<2→default), canonicalStopsKey + gradientStopsHash (FNV-1a), gradientId -s{hash};
  legacy {angle} id byte-for-byte; **572/572**
- 5C: render — def'e normalize stops (mevcut stops.map), gerçek gradient nesnesi id'ye,
  mask id -g{angle}-s{hash} (matteMaskGradientSuffix); farklı stops ayrı def+mask, aynı set dedupe;
  **582/582 + 66/66**
- 5D: UI — STOPS editörü (2-4: Add midpoint+sol miras, Remove min 2, color/offset/opacity,
  field preservation, local state yok, legacy {angle} dokunulmaz); **594/594 + 66/66**
- 5E: serialization (4-stop EXACT, legacy stops uydurmaz, malformed pass-through, runtime veri yok)
  + V-H1..V-H12; **BLOCKER bulundu**: inverted TEXT + multi-stop → dış alan transparan
  (local endpoint'ler world rect'e uygulanıyor) — onaylı fix: def WORLD endpoint + `-luminance-inv`
  identity + text düz siyah (fill="black", url() yok); V-H8 pixel-kanıtlı; **599/599 + 76/76 ×2**
- 5F: docs — SKILL v7.0.0 (M19 bölümü + inverted-text koordinat kontratı + deferred güncellemesi),
  wiki entity/log, README; final audit: korumalı dosyalar untouched, M8 korundu, hash deterministik
- Full suite: **78 passed / 1 failed** — tek fail workflow.spec.ts:88 ölü container (M19 dışı)
- Commit/push: YOK (HEAD hâlâ `e88517f` — M18)

## [2026-08-12] update | KCS — M20 DISCOVERY (radial gradient, audit only)
- M20 discovery iş PC'de TAMAMLANDI — **KOD YAZILMADI, commit YOK** (onay bekliyor)
- Baseline: HEAD=origin=`28d0e94` (M19), tree CLEAN, 599/599 + 76/76 ×2 + full 78/1
- Bulgular: stops modeli / normalizeGradientStops / canonicalStopsKey + gradientStopsHash /
  dedupe / serialization → radial için %100 REUSE; yeni data yalnızca `gradient.type?:
  'linear' | 'radial'` + fraction centerX/centerY/radius (0-1, default 0.5'ler)
- Önerilen identity: `kcs-mg-{src}-radial[-c{cx}-cy{cy}-r{radius}]-s{hash}-{structure}`
  (`-radial` discriminator — linear `-g{angle}` ile collision YOK); mask suffix benzer
- Koordinat kontratı: shape/freeform + inverted text → WORLD center (applyWorld), non-inverted
  text → LOCAL (0,0 + bbox yarı-boyutu); inverted-text `-luminance-inv` + düz siyah text (5E fix) AYNEN
- Kritik SVG gerçeği: radialGradient'te rX/rY YOK (SVG1.1 daire + gradientTransform) —
  world def = gerçek dünya dairesi; non-uniform scale spike'ın birincil kanıt noktası
- M8 SAFE (paint-only), geometry SAFE (center/radius bbox noktalarından — M17 math),
  serialization additive (legacy {angle} byte-for-byte, migration YOK)
- Öneri: Option 2 (type + fraction center/radius) — 6A spike → 6B data → 6C render →
  6D UI → 6E serialization + V-R pixel matrisi → 6F docs (SKILL v8.0.0)
- Karar: M20 BAŞLATILMADI — kullanıcı onayı bekliyor
