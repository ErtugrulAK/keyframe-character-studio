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

## [2026-08-13] update | KCS — M20 RADIAL GRADIENT COMPLETE (iş PC, 6A-6F)
- M20 ✅ 6A-6F tamamlandı — **COMMIT/PUSH PENDING (onay bekliyor)** — HEAD=origin=`d7324ad`
- 6A spike 17/17 ×2 (geçici, silindi): radial mask'te çalışır; **r ötesi = SON stop** (linear
  before-start = ilk stop'tan farklı); world daire elips olmaz → rX/rY gerekmez; mask+transform
  content LOCAL space'te çözülür (OUTER/INNER deseni doğru); text+url fill mask'ta çalışır
- 6B data/pure (644/644): `gradient.type?: 'linear'|'radial'` (yok = linear — legacy byte-for-byte)
  + `normalizeGradientType` + `radialGradientGeometry` (bbox merkezi applyWorld; r = sqrt(w²+h²)/2
  × max(|sx|,|sy|); rotation r'yi değiştirmez; neg |abs|; zero → 1) + `sourceLocalPoints`
  (gradientEndpoints ile aynı kaynak); identity `kcs-mg-{src}-radial[-s{hash}]` / `-radial[-s{hash}]`
- 6C render (657/657): StagePartLayers minimal branch `<radialGradient userSpaceOnUse cx cy r>`;
  shape/freeform WORLD · non-inverted text LOCAL (0,0/104.4) · inverted text WORLD + siyah +
  `-luminance-inv`; feather/strength/dedupe/collision korundu; animasyonlu source her frame
  EVALUATED transform'dan (stale yok)
- 6D UI (671/671): TYPE [Linear|Radial] — radial'de ANGLE gizli; Linear'a dönüş type OMIT
  (canonical legacy); field preservation; local state YOK; M19 stop editörü birebir
- 6E (678/678): serialization 80/80 EXACT (derived cx/cy/radius/rX/rY ASLA serialize edilmez,
  legacy korunur); **R-V1..R-V23 23/23 ×2** (`e2e/m20-radial.spec.ts` kalıcı matrix);
  import/reload EXACT parity 3/3 (R-V22)
- 6F: SKILL **v8.0.0** (M20 bölümü + deferred — radial çıkarıldı, presets/geometry controls
  eklendi), wiki, README
- Bilinen parity limitation (M19/M20 ortak — M20 regression DEĞİL): gradient'li inverted TEXT
  delik üretmez (linear'de de; gradient'siz delik üretir — V-T3); text siyah + world rect +
  dış alan ramp doğrulandı (R-V10 pin'ler)
- Baseline: 678/678 vitest · R-V 23/23 ×2 · track-matte 76/76 (full'da V-T17 timing flake —
  M18 import/reload yolu, makine yükünde; izole PASS; M20 değiştirmedi) · tsc/build/oxlint PASS

## [2026-08-13] update | KCS — M21 IMAGE MATTE COMPLETE (iş PC, 7A-7F)
- M21 ✅ 7A-7F tamamlandı — **COMMIT/PUSH PENDING (onay bekliyor)** — HEAD `668a3b3`, working tree 8 dosya dirty (7B-7F)
- 7A spike (17/17 ×2, geçici, silindi): SVG `<image>` mask CONTENT olarak pixel-kanıtlı —
  alpha/luminance deterministik; **nested-mask multiplication** (image × gradient);
  **image strength = `opacity`** (fill-opacity INERT); **inverted image = luminance semantiği**
  (parlak görünür / koyu delik — siyah repaint YOK); Canvas/foreignObject/ikinci-geometry yok
- 7B data/pure: isMatteEligible(custom_image) → true (tek authority); imageMaskContent
  (imageUrl || innerMediaUrl tek URL authority; layout box bounds); MatteMask.image runtime-only
  (PartMatte'e alan yok); buildMattePath(image) → null; image+clip kapalı
- 7C render: StagePartLayers image content branch; inverted image → mask-type luminance
  (koşul text||image'e genişletildi); strength → opacity; gradient → `kcs-mask-{src}-img`
  nested composition; feather reuse; M18/M19/M20 byte-compatible
- 7D UI: image listede; Clip disabled + uyarı (text deseni); tüm kontroller destekli;
  field preservation; local state yok
- 7E: serialization **91/91** (runtime descriptor asla persist edilmez); V-M1..V-M26
  **26/26 ×2** (dedupe, coexist, Inspector real-user V-M20, clip güvenli, import/reload EXACT
  V-M24, animated radial V-M22/23, legacy linear/text regression)
- 7F: docs — SKILL **v9.0.0** (M21 bölümü + mimari + baseline + deferred'den image matte çıkarıldı),
  wiki entity, README
- Baseline: **738/738 vitest** (91/91 serialization dahil) + R-V 23/23 ×2 + V-M 26/26 ×2 +
  track-matte 76/76 (V-T17 bilinen M18 timing flake — izole PASS, M20/M21 değiştirmedi)
- Commit/push YOK — hash icat edilmedi

## [2026-08-13] update | KCS — M22 MATTE RELATIONSHIP UX + INTEGRITY COMPLETE (iş PC, 8A-8C)
- M22 ✅ 8A-8C tamamlandı — **COMMIT/PUSH PENDING (onay bekliyor)** — HEAD `64eb14c`, working tree 5 dosya dirty (8A-8C)
- 8A UI: Outliner matte relationship indicator — VALID: Scissors + source CharacterPart.name
  (track.name ASLA); MISSING: AlertTriangle + "Missing" + aria-label/title; render anında
  derive (sourcePartId + characterParts; state/cache/mirror YOK); selection/eye/reorder/drag
  etkilenmez; 13 unit test (outlinerPanel.test.tsx)
- 8B validation: `MATTE_CYCLE` (recoverable) — parent-cycle chain-walk deseni; self-ref
  (A→A) dahil uzun cycle'lar; **disabled matte (enabled:false) cycle graph'da YOK**
  (runtime inactive semantiği); missing ≠ cycle (MATTE_MISSING_SOURCE korunur); asiklik
  zincirler VALID; deterministik; 15 unit test (validateScene.test.ts)
- 8C E2E: `e2e/m22-matte-relationship.spec.ts` E2E-1..E2E-10 **10/10 ×2** — gerçek Chromium
  + gerçek UI akışları (outliner row tıklama, Style tab, matte select, Delete butonu,
  eye/reorder): valid/missing/self-ref/direct-cycle/valid-chain/tip-agnostik/source-switch/
  delete-restore/outliner regresyonu/cycle-vs-missing; production değişikliği 0
- Kapsam: renderer/geometry/serialization DEĞİŞMEDİ; M8 SAFE; UI + validation hardening
- Baseline: **766/766 vitest** + R-V 23/23 ×2 + V-M 26/26 ×2 + M22 E2E **10/10 ×2** +
  track-matte 76/76 (V-T17 bilinen M18 flake — izole PASS)
- Commit/push YOK — hash icat edilmedi

## [2026-08-14] update | KCS — M23 BASIC IN/OUT PRESET UX COMPLETE (iş PC, 9A-9C)
- M23 ✅ 9A-9C tamamlandı — **COMMIT/PUSH PENDING (onay bekliyor)** — HEAD `6a0c767`, working tree 5 dosya dirty (9B-9C)
- 9A discovery: preset engine ZATEN VAR (inAnimPreset/outAnimPreset/inAnimDuration/outAnimDuration +
  computeProceduralDelta/applyEditPreset — broadcast state makinesi + edit timeline preview) ama
  kullanıcıya KAPALI (hiçbir UI yok); **Option B: mevcut engine'e UI bağlama** — keyframe üretimi YOK
- 9B UI: Transform tab'ında ANIMATION IN / OUT kartı — IN/OUT preset (None/Fade/Slide L/R/U/D/Pop/
  Spin) + duration (SmartNumberInput deferCommit, 0-1000, default 30); derive-only; tek
  onPartPropChange → atomic history; custom_timeline GİZLİ (korunur); a11y (ariaLabel);
  **20 unit test** (transformInOutPreset.test.tsx)
- 9C E2E: E2E-1..E2E-15 **15/15 ×2** — IN/OUT preview (frame 0'da IN opacity 0 → part invisible —
  renderer skip — **test dersi, bug değil**; frame 1'de ölçüm), duration BUG 2 regression, undo,
  field preservation, save/reload parity (mevcut schema — useSerialization değişmedi), broadcast
  uyumu, keyframe'siz kanıtı (channel count 0→0), custom_timeline, clear, no-selection;
  production değişikliği 0 (geçici debug kaldırıldı)
- Baseline: **786/786 vitest** + R-V 23/23 ×2 + V-M 26/26 ×2 + M22 10/10 ×2 + M23 **15/15 ×2** +
  track-matte 76/76 (V-T17 bilinen M18 flake — izole PASS)
- Commit/push YOK — hash icat edilmedi

## [2026-08-14] update | KCS — M24 BUILTIN COMBINATION PRESETS COMPLETE (iş PC, 10A-10E)
- M24 ✅ 10A-10E tamamlandı — **COMMIT/PUSH PENDING (onay bekliyor)** — HEAD `47f7dce`, working tree 5+ dosya dirty (10B-10E)
- 10A discovery: tüm mevcut builtin'ler opacity=eased içeriyor → **Fade+Slide ≡ slide, Fade+Scale ≡
  pop, Pop+Fade ≡ pop — duplicate'ler KASITLI eklenmedi** (eksik feature değil); gerçek yeni:
  slide+scale ailesi + soft-pop; **Option A (yeni builtin ID'ler)** seçildi
- 10B pure: `applyBuiltin`'e 3 case (slide-scale-left/right: x=±300·(1-eased)·sign + sx=sy=opacity=
  eased; soft-pop: sx=sy=0.85+0.15·eased + opacity=eased) — atomic'lar byte-for-byte;
  **12 pure test** (proceduralAnimationCombos.test.ts)
- 10C UI: M23 kartında `<optgroup label="Basic">` (8 builtin aynı) + `<optgroup
  label="Combinations">` (Slide + Scale Left/Right, Soft Pop); **+12 UI test**
  (transformInOutPreset.test.tsx M24 describe)
- 10D E2E: E2E-1..E2E-17 **17/17 ×2** — IN/OUT ters yönler, soft-pop eğrisi, keyframe'siz kanıtı
  (channel 0→0), save/reload parity, broadcast uyumu, field preservation, sahte preset yok,
  basic regression; production değişikliği 0
- 10E docs: SKILL v12, wiki, README
- Kapsam: production'daki tek animasyon değişikliği `applyBuiltin`; M8 SAFE; yeni engine/keyframe/
  channel/schema/broadcast state YOK
- Baseline: **810/810 vitest** + R-V 23/23 ×2 + V-M 26/26 ×2 + M22 10/10 ×2 + M23 15/15 ×2 +
  M24 **17/17 ×2** + track-matte 76/76 (V-T17 bilinen M18 flake — izole PASS)
- Commit/push YOK — hash icat edilmedi

## [2026-08-14] update | KCS — M25 USER-SAVED ANIMATION PRESETS COMPLETE (ev PC, 25A-25F)
- M25 ✅ 25A-25F tamamlandı — **COMMIT/PUSH PENDING (onay bekliyor)** — HEAD `4a77ba4`, working tree M25 kapsamı dirty (hash icat edilmedi)
- 25A data: `usePresets.savePreset/deletePreset` — mevcut `CustomMotionPreset` modeli + `keyframe_custom_motion_presets` key; deterministic `generateId('preset')` + collision guard (builtin id çakışması yok); name trim + boş reject; keyframes deep-clone; malformed storage fallback (invalid JSON + non-array); **23 test**
- 25B runtime proof + **gerçek bugfix**: `applyEditPreset` customPresets almıyordu → custom preset broadcast'te çalışıp **edit-mode preview'da çalışmıyordu** (kanıt: x=0, beklenen -150); fix: `applyEditPreset(id, progress, mode, presets)` → `applyPreset` delegasyonu (aynı lookup/scope/clamp/sampler) — yeni engine YOK; **18 test**
- 25C UI: Custom optgroup (IN/OUT type filtreli, value=id/label=name) + Save Current as Preset dialog (name validation) + Delete (yalnızca custom — builtin korunur); `presetConversion.ts` builtin→custom (deterministik 0/0.25/0.5/0.75/1 örnekleme, builtin id'den bağımsız); runtime equivalence test'leri (slide-scale-left/soft-pop 0/0.5/1 exact); **27 UI + 5 conversion test**
- 25D E2E: `e2e/m25-user-saved-presets.spec.ts` **18/18 ×2** — save≠apply, apply IN/OUT, equivalence, reload, delete, referenced-delete, type filtering, multi-part isolation, undo, broadcast, schema pollution; production değişikliği 0
- 25E regression + fix: **DEFAULT_INITIAL_PRESETS Custom optgroup'ta görünüyordu** (M24 E2E-17 deterministik kırıldı — timing değil) → kartta id-eşitliğiyle user-only filtre (default'lar runtime/broadcast'te aynen korunur, seed mekanizması değişmedi); **+4 test**, M24 **17/17** geri yeşil
- 25F docs: SKILL v13, wiki entity + log, README
- Baseline: **879/879 vitest** + M25 18/18 ×2 + M24 17/17 + M23 15/15 + M22 10/10 + M20 23/23 + M21 26/26 + tsc/build/oxlint PASS; track-matte bilinen ev-PC timing-flake'leri (V-T15/T17/H12 — izole PASS, testlere dokunulmadı)
- Mimari: ikinci engine YOK; save/delete = library (history dışı), apply = normal part edit (history/undo); custom kütüphane AnimationProject'ta DEĞİL; M8 SAFE; geometry/matte/serialization/broadcast değişmedi

## [2026-08-15] update | KCS — M26 COPY/PASTE ANIMATION ONTO SELECTED PART + CLEAR COMPLETE (ev PC, 26A-26E)
- M26 ✅ 26A-26E tamamlandı — **COMMIT/PUSH PENDING** (HEAD 147ba8a)
- Discovery: en büyük tekrarlı iş = mevcut karakterin tam animasyonunu (channel keyframe'leri dahil — M25 preset yalnızca IN/OUT davranışını kapsıyordu) başka karaktere aktarma; clipboard %70 hazırdı
- 26A data: `animationTransfer.ts` `cloneAnimationOntoTarget` (saf; fresh id remap; track reuse/oluşturma; nested deep-clone) + `useClipboard.pasteAnimationOntoSelected` — **16 pure test**
- 26B UI: kartta Copy/Paste/Clear butonları (aria-label+title; paste disabled: clipboard yok/source===target); paste+clear tek batch undo; **Clear duration policy A: 30** (M23 default'u); **11 UI test**
- 26C E2E: `e2e/m26-copy-paste-animation.spec.ts` **13/13 ×2** — identity/transfer/fresh-id/undo/clear/copy-part regression/multi-select(primary-only)/broadcast/reload
- 26D: Vitest **906/906** · full e2e **194 passed** (M20 23+M21 26+M22 10+M23 15+M24 17+M25 18+M26 13+track 72); track-matte V-T15/T17/V-H12 bilinen ev-PC timing (M26'sız koşularda da vardı — pre-existing, testlere dokunulmadı)
- 26E: SKILL v14 + wiki + README
- M26 deferred: timeline keyframe copy/paste/duplicate, multi-select paste, preset export/import/rename, delay/offset, wipe, multi/nested/video matte, gradient anim, text stagger, gizmo'lar, spring/3D/motion blur
