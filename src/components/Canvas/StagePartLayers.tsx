import React, { useMemo } from 'react';
import type {
  AppMode,
  BroadcastObjectState,
  CharacterPart,
  CustomMotionPreset,
  AnimationTrackData,
} from '../../types/animator';
import type { RuntimeData, BroadcastRuntime, RuntimeTrackState } from '../../types/composition';
import { PartRenderer } from './renderers/PartRenderer';
import { evaluateFrame } from '../../utils/evaluateFrame';
import { validateCritical, hasCriticalErrors } from '../../utils/validateScene';
import {
  buildMattePath,
  buildMatteClipPath,
  buildMatteMaskFromPath,
  buildMatteTextMask,
  normalizeFeather,
  normalizeStrength,
  normalizeGradientAngle,
  gradientId,
  gradientEndpoints,
  gradientEndpointsLocal,
  normalizeGradientStops,
  matteMaskGradientSuffix,
  textMaskContent,
  matteClipPathId,
  matteMaskId,
  isMatteActive,
  resolveMatteMode,
} from '../../utils/matte';
import type { MatteClipPath, MatteMask, MatteGradientStop } from '../../utils/matte';
import type { WorldTransform } from '../../types/composition';
import { CANVAS_CENTER } from '../../utils/constants';

interface StagePartLayersProps {
  sortedParts: CharacterPart[];
  appMode: AppMode;
  broadcastState: Record<string, BroadcastObjectState>;
  currentFrame: number;
  selectedPartId: string | null;
  totalFrames: number;
  onSelect: (id: string) => void;
  onStartTranslateDrag: (partId: string, e: React.MouseEvent) => void;
  tracks: (AnimationTrackData & RuntimeTrackState)[];
  customPresets: CustomMotionPreset[];
  liveStuntsState: Record<string, { stunt: string; progress: number; loop?: boolean; customPresetId?: string }>;
  /** Project resolution — world-space artboard region for inverted masks.
   *  Same computation as StageCanvas's artboard-clip. */
  projectResolution?: { width: number; height: number };
}

function toBroadcastRuntime(bs: Record<string, BroadcastObjectState>): Record<string, BroadcastRuntime> {
  const result: Record<string, BroadcastRuntime> = {};
  for (const [id, s] of Object.entries(bs)) {
    result[id] = { state: s.state, progress: s.progress };
  }
  return result;
}

function toLiveStuntsRuntime(
  ls: Record<string, { stunt: string; progress: number; customPresetId?: string }>,
): Record<string, { stunt: string; progress: number; customPresetId?: string }> {
  const result: Record<string, { stunt: string; progress: number; customPresetId?: string }> = {};
  for (const [id, s] of Object.entries(ls)) {
    result[id] = { stunt: s.stunt, progress: s.progress, customPresetId: s.customPresetId };
  }
  return result;
}

export const StagePartLayers: React.FC<StagePartLayersProps> = ({
  sortedParts,
  appMode,
  broadcastState,
  currentFrame,
  selectedPartId,
  totalFrames,
  onSelect,
  onStartTranslateDrag,
  tracks,
  customPresets,
  liveStuntsState,
  projectResolution,
}) => {
  // Build frame overrides for custom_timeline presets
  const frameOverrides: Record<string, number> = {};
  for (const part of sortedParts) {
    if (appMode === 'broadcast') {
      const bState = broadcastState[part.id] || { state: 'hidden', progress: 0 };
      if (bState.state === 'animating_in' && part.inAnimPreset === 'custom_timeline') {
        const st = part.inAnimTimelineStart || 0;
        const en = part.inAnimTimelineEnd || 30;
        frameOverrides[part.id] = st + bState.progress * (en - st);
      } else if (bState.state === 'visible' && part.inAnimPreset === 'custom_timeline') {
        frameOverrides[part.id] = part.inAnimTimelineEnd || 30;
      } else if (bState.state === 'animating_out' && part.outAnimPreset === 'custom_timeline') {
        const st = part.outAnimTimelineStart || 0;
        const en = part.outAnimTimelineEnd || 30;
        frameOverrides[part.id] = st + bState.progress * (en - st);
      }
    }
  }

  const runtime: RuntimeData = {
    appMode,
    broadcast: toBroadcastRuntime(broadcastState),
    liveStunts: toLiveStuntsRuntime(liveStuntsState),
  };

  // Phase 3 Step 7: critical validation before evaluation.
  // useMemo keeps it O(1) on re-renders when layer list reference is unchanged,
  // so valid scenes pay no repeated validation cost.
  const criticalErrors = useMemo(() => validateCritical({ layers: sortedParts }), [sortedParts]);
  const hasCritical = useMemo(() => hasCriticalErrors(criticalErrors), [criticalErrors]);

  // Safety: if the scene is structurally broken (duplicate IDs, parent cycles),
  // skip evaluation entirely. evaluateTransform would infinite-loop on cycles.
  if (hasCritical) {
    return null;
  }

  const evaluatedFrame = evaluateFrame(
    sortedParts,
    tracks,
    totalFrames,
    currentFrame,
    runtime,
    customPresets,
    frameOverrides,
  );

  // M11 Step 2B / M13 Step 2C — Track matte: build ONE world-space clipPath
  // or <mask> def per (source, mode, inverted) from the source's evaluated
  // world transform. Non-shape sources (freeform/text/image/video) yield null
  // and produce no clip/mask.
  // Geometry is computed ONCE per source: clips reuse buildMatteClipPath's
  // internal computation (M11 Step 5 dedupe), masks share a pathD cache
  // across modes so alpha + luminance + inverted on the same source run a
  // single buildMattePath.
  const matteClips = new Map<string, MatteClipPath>();
  const matteMasks = new Map<string, MatteMask>();
  const maskPathCache = new Map<string, string>(); // sourceId → pathD (shared across mask modes)
  // M17 — world-space <linearGradient> defs, deduped by deterministic id
  // kcs-mg-{sourceId}-{normalizedAngle}-{mode} (mode is part of the identity:
  // alpha/luminance use different default stops).
  const matteGradients = new Map<string, { id: string; x1: number; y1: number; x2: number; y2: number; stops: MatteGradientStop[] }>();
  // M18 — text masks carry NO path geometry; the mask content is a
  // transform-baked <text>. The source's evaluated world transform is stored
  // per mask id (render-only, recomputed every frame — never stale).
  const textTransforms = new Map<string, WorldTransform>();
  for (const layer of sortedParts) {
    if (!layer.matte || !isMatteActive(layer.matte)) continue;
    const source = sortedParts.find((p) => p.id === layer.matte!.sourcePartId);
    if (!source) continue; // missing source → no clip/mask (recoverable validation warns)
    const sourceEl = evaluatedFrame.layers.find((el) => el.id === source.id);
    if (!sourceEl) continue;
    const mode = resolveMatteMode(layer.matte);

    if (mode === 'clip') {
      const clipId = matteClipPathId(source.id);
      if (matteClips.has(clipId)) continue; // already built for this source (1 source → N targets)
      const clip = buildMatteClipPath(source, sourceEl.transform);
      if (clip) matteClips.set(clip.id, clip);
      continue;
    }

    // alpha | luminance
    if (mode !== 'alpha' && mode !== 'luminance') continue; // TS narrowing (unreachable)
    const inverted = layer.matte.inverted === true;
    const feather = normalizeFeather(layer.matte.feather);
    // M16: strength < 1 gets a deterministic -s{strength} suffix so the same
    // (source, mode, inverted, feather) with DIFFERENT strengths never
    // collides. strength undefined/1 = canonical (legacy id, byte-for-byte).
    const strength = normalizeStrength(layer.matte.strength);
    // M17: gradient (mask modes only) — the -g{angle} suffix (NORMALIZED
    // angle) keeps gradient variants apart; no gradient → canonical id.
    const gradientAngle = layer.matte.gradient
      ? normalizeGradientAngle(layer.matte.gradient.angle) ?? 0
      : undefined;
    // M14: when feathered, the mask id gets a deterministic -f{feather} suffix
    // so the same (source, mode, inverted) with DIFFERENT feather values never
    // collides (each target's mask keeps its own blur). feather 0/undefined →
    // M13 id, byte-for-byte.
    // M19 — the -g suffix carries the STOPS identity too (matteMaskGradientSuffix):
    // two targets with the same source+mode+inverted+feather+strength+angle but
    // DIFFERENT stops must never share one mask (dedupe Map key). Legacy
    // gradients (no stops) keep the byte-for-byte `-g{angle}` suffix.
    const baseMaskId = matteMaskId(source.id, mode, inverted);
    const maskId = `${baseMaskId}${feather > 0 ? `-f${feather}` : ''}${strength < 1 ? `-s${strength}` : ''}${matteMaskGradientSuffix(layer.matte.gradient)}`;
    if (matteMasks.has(maskId)) continue; // same (source, mode, inverted, feather, strength, gradient) already built

    // M18 — TEXT source: buildMattePath stays null (text has NO path
    // geometry). The glyphs become the mask CONTENT element; content/fonts
    // are read from the source at runtime (never persisted — sourcePartId is
    // the only persistent link).
    let mask: MatteMask;
    if (source.type === 'custom_text') {
      const content = textMaskContent(source);
      if (!content) continue;
      mask = buildMatteTextMask(
        source.id, content, mode, inverted,
        feather > 0 ? feather : undefined,
        strength < 1 ? strength : undefined,
      );
    } else {
      let pathD = maskPathCache.get(source.id);
      if (pathD === undefined) {
        pathD = buildMattePath(source, sourceEl.transform) ?? undefined;
        if (pathD === undefined) continue;
        maskPathCache.set(source.id, pathD);
      }
      const fillColor = sourceEl.content.fillColor ?? source.fillColor ?? '#ffffff';
      mask = buildMatteMaskFromPath(
        source.id, pathD, mode, inverted, fillColor,
        feather > 0 ? feather : undefined,
        strength < 1 ? strength : undefined,
      );
    }

    // M17 — build (or reuse) the world-space <linearGradient> def. The mode is
    // part of the def identity: alpha and luminance masks use DIFFERENT
    // default stops, so the same (source, angle) across modes must NOT share
    // one def. Endpoints follow the source's evaluated world transform.
    // M18 — TEXT sources: (a) inverted text always renders the LUMINANCE
    // structure (4A: alpha masks ignore a second element — white rect + black
    // text, mask-type luminance), so the def key/stops follow that structure;
    // (b) the def coords are the source-LOCAL endpoints (a gradient referenced
    // from a <text> inside a transformed <g> resolves in the text's local
    // space — 4A pixel-verified) via gradientEndpointsLocal.
    let maskGradientId: string | undefined;
    if (gradientAngle !== undefined) {
      const structure = source.type === 'custom_text' && inverted ? 'luminance' : mode;
      // M19 5E BLOCKER FIX — coordinate-space mismatch: in the inverted TEXT
      // structure the ONLY gradient consumer is the WORLD-space region rect
      // (the text itself is BLACK — it never references the def). A LOCAL
      // endpoint def (correct for the non-inverted text element) resolves
      // against the rect at world coordinates → clamps → transparent outer
      // region (V-H8 pixel-proven). Inverted text therefore uses WORLD
      // endpoints (gradientEndpoints — the same text-box→applyWorld math as
      // shapes), and its def identity gets a distinct `-luminance-inv`
      // structure key so it can never collide with a non-inverted luminance
      // TEXT def (which stays LOCAL).
      const isInvertedText = source.type === 'custom_text' && inverted;
      const gradId = `${gradientId(source.id, layer.matte.gradient)!}-${structure}${isInvertedText ? '-inv' : ''}`;
      if (!matteGradients.has(gradId)) {
        const eps = isInvertedText
          ? gradientEndpoints(source, sourceEl.transform, gradientAngle)      // WORLD (rect)
          : source.type === 'custom_text'
            ? gradientEndpointsLocal(source, sourceEl.transform, gradientAngle) // LOCAL (text element)
            : gradientEndpoints(source, sourceEl.transform, gradientAngle);
        if (eps) {
          matteGradients.set(gradId, {
            id: gradId,
            ...eps,
            stops: normalizeGradientStops(layer.matte.gradient?.stops, structure),
          });
          maskGradientId = gradId;
        }
      } else {
        maskGradientId = gradId;
      }
    }

    matteMasks.set(maskId, {
      ...mask,
      id: maskId,
      ...(maskGradientId ? { gradientId: maskGradientId } : {}),
    });
    if (mask.text) textTransforms.set(maskId, sourceEl.transform);
  }

  const matteAttrFor = (part: CharacterPart): { clipId?: string; maskId?: string } => {
    if (!part.matte || !isMatteActive(part.matte)) return {};
    if (!sortedParts.some((p) => p.id === part.matte!.sourcePartId)) return {};
    const mode = resolveMatteMode(part.matte);
    if (mode === 'clip') {
      const id = matteClipPathId(part.matte.sourcePartId);
      return matteClips.has(id) ? { clipId: id } : {};
    }
    if (mode === undefined) return {}; // unreachable when matte exists; TS narrowing
    const feather = normalizeFeather(part.matte.feather);
    const strength = normalizeStrength(part.matte.strength);
    // M19 — matteMaskGradientSuffix carries the stops identity into the lookup
    // id, keeping it byte-for-byte aligned with the def-building loop.
    const base = matteMaskId(part.matte.sourcePartId, mode, part.matte.inverted === true);
    const id = `${base}${feather > 0 ? `-f${feather}` : ''}${strength < 1 ? `-s${strength}` : ''}${matteMaskGradientSuffix(part.matte.gradient)}`;
    return matteMasks.has(id) ? { maskId: id } : {};
  };

  // Inverted masks need an explicit full-artboard region (default mask bbox
  // would leave the outer area unmasked). Same computation as StageCanvas's
  // artboard-clip: CANVAS_CENTER ± projectResolution / 2. No pan/zoom.
  const region = {
    x: CANVAS_CENTER.x - (projectResolution?.width ?? 1920) / 2,
    y: CANVAS_CENTER.y - (projectResolution?.height ?? 1080) / 2,
    width: projectResolution?.width ?? 1920,
    height: projectResolution?.height ?? 1080,
  };

  // M14 feather: deterministic filter id derived from the mask id (which
  // already encodes source + mode + inverted + feather). Wide explicit
  // userSpaceOnUse region = artboard bounds inflated by the feather, so the
  // Gaussian blur is never clipped (spike-verified: tight regions cut it).
  const featherFilterId = (maskId: string) => `kcs-matte-feather-${maskId.slice('kcs-mask-'.length)}`;
  const featherUrl = (mask: MatteMask): string | undefined =>
    (mask.feather ?? 0) > 0 ? `url(#${featherFilterId(mask.id)})` : undefined;

  // M18 — the TEXT mask content: a <text> element baked through the SAME
  // transform math the app's text renderer uses (PartRenderer inner <g>:
  // translate(CX+tx, CY+ty) rotate(r) scale(sx,sy); x=0/y=0 middle/middle
  // anchor). The evaluated world transform comes from evaluatedFrame — the
  // same pipeline that drives the geometry sources, so parent composition /
  // animation / negative scale are all preserved. Content/fonts live on the
  // source part (read at runtime via textMaskContent — never duplicated here).
  const renderTextMaskContent = (mask: MatteMask, t: WorldTransform): React.ReactNode => {
    if (!mask.text) return null;
    return (
      <g transform={`translate(${CANVAS_CENTER.x + t.x}, ${CANVAS_CENTER.y + t.y}) rotate(${t.rotation}) scale(${t.scaleX}, ${t.scaleY})`}>
        <text
          x={0}
          y={0}
          textAnchor={mask.text.textAnchor}
          dominantBaseline={mask.text.dominantBaseline}
          fontSize={mask.text.fontSize}
          fontWeight={mask.text.fontWeight}
          fontFamily={mask.text.fontFamily}
          // M19 5E BLOCKER FIX — inverted text is ALWAYS plain black (4A
          // decision: white region rect + black text hole). The gradient
          // belongs to the WORLD-space region rect only — the text element
          // must never reference it (it would punch a BRIGHT hole instead of
          // a dark one). Non-inverted text keeps the gradient fill.
          fill={mask.inverted ? mask.fill : mask.gradientId ? `url(#${mask.gradientId})` : mask.fill}
          fillOpacity={mask.strength}
          filter={featherUrl(mask)}
        >
          {mask.text.content}
        </text>
      </g>
    );
  };

  return (
    <g clipPath={appMode === 'broadcast' ? 'url(#artboard-clip)' : undefined}>
      <defs>
        {[...matteMasks.values()]
          .filter((m) => (m.feather ?? 0) > 0)
          .map((mask) => {
            const f = normalizeFeather(mask.feather);
            return (
              <filter
                key={featherFilterId(mask.id)}
                id={featherFilterId(mask.id)}
                filterUnits="userSpaceOnUse"
                x={region.x - f}
                y={region.y - f}
                width={region.width + f * 2}
                height={region.height + f * 2}
              >
                {/* stdDeviation = feather/2 → visible transition ≈ feather world px */}
                <feGaussianBlur stdDeviation={f / 2} />
              </filter>
            );
          })}
        {[...matteClips.values()].map((clip) => (
          <clipPath key={clip.id} id={clip.id} clipPathUnits="userSpaceOnUse">
            <path d={clip.pathD} />
          </clipPath>
        ))}
        {[...matteGradients.values()].map((g) => (
          <linearGradient
            key={g.id}
            id={g.id}
            gradientUnits="userSpaceOnUse"
            x1={g.x1}
            y1={g.y1}
            x2={g.x2}
            y2={g.y2}
          >
            {g.stops.map((s, i) => (
              <stop key={i} offset={`${s.offset * 100}%`} stop-color={s.color} stop-opacity={s.opacity} />
            ))}
          </linearGradient>
        ))}
        {[...matteMasks.values()].map((mask) => (
          <mask
            key={mask.id}
            id={mask.id}
            maskUnits="userSpaceOnUse"
            maskContentUnits="userSpaceOnUse"
            // M18 — inverted TEXT always renders the luminance structure
            // (4A decision: alpha masks ignore a second element — a white
            // rect + black text hole only works as a luminance mask).
            mask-type={mask.text && mask.inverted ? 'luminance' : mask.mode}
          >
            {mask.text ? (
              mask.inverted ? (
                <>
                  <rect x={region.x} y={region.y} width={region.width} height={region.height} fill={mask.gradientId ? `url(#${mask.gradientId})` : 'white'} fillOpacity={mask.strength} />
                  {renderTextMaskContent(mask, textTransforms.get(mask.id)!)}
                </>
              ) : (
                renderTextMaskContent(mask, textTransforms.get(mask.id)!)
              )
            ) : mask.inverted ? (
              mask.mode === 'alpha' ? (
                // H fix (pixel-verified): in Chromium, an ALPHA mask that
                // combines a region rect with a second geometry element never
                // forms the inverted hole — the second element is ignored no
                // matter its fill (transparent/rgba/hex/fill-opacity all
                // FAILED in browser tests). A SINGLE evenodd path carrying the
                // outer region contour + the matte contour yields the real
                // hole: outer area alpha 1, matte area alpha 0.
                <path
                  d={`M ${region.x} ${region.y} H ${region.x + region.width} V ${region.y + region.height} H ${region.x} Z ${mask.pathD}`}
                  fillRule="evenodd"
                  fill={mask.gradientId ? `url(#${mask.gradientId})` : 'white'}
                  fillOpacity={mask.strength}
                  filter={featherUrl(mask)}
                />
              ) : (
                <>
                  <rect x={region.x} y={region.y} width={region.width} height={region.height} fill={mask.gradientId ? `url(#${mask.gradientId})` : 'white'} fillOpacity={mask.strength} />
                  <path d={mask.pathD ?? undefined} fill="black" fillOpacity={mask.strength} filter={featherUrl(mask)} />
                </>
              )
            ) : (
              <path d={mask.pathD ?? undefined} fill={mask.gradientId ? `url(#${mask.gradientId})` : mask.fill} fillOpacity={mask.strength} filter={featherUrl(mask)} />
            )}
          </mask>
        ))}
      </defs>
      {evaluatedFrame.layers.map((el) => {
        const part = sortedParts.find(p => p.id === el.id);
        if (!part) return null;
        const matteAttrs = matteAttrFor(part);

        return (
          <PartRenderer
            key={el.id}
            part={part}
            isSelected={selectedPartId === el.id}
            currentFrame={currentFrame}
            onSelect={onSelect}
            onStartTranslateDrag={onStartTranslateDrag}
            evaluatedLayer={el}
            matteClipPathId={matteAttrs.clipId}
            matteMaskId={matteAttrs.maskId}
          />
        );
      })}
    </g>
  );
};
