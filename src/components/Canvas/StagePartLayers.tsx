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
import { perfCount } from '../../perf/perfMonitor';
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
  normalizeGradientType,
  radialGradientGeometry,
  imageMaskContent,
  buildMatteImageMask,
  matteClipPathId,
  matteMaskId,
  isMatteActive,
  resolveMatteMode,
} from '../../utils/matte';
import type { MatteClipPath, MatteMask, MatteGradientStop, MatteImageContent } from '../../utils/matte';
import { buildLayerMaskDefinition, layerMaskFilterId, layerMaskRenderKeys } from '../../utils/layerMasks';
import { colorCorrectionFilter, colorCorrectionIds, isEffectOnlyMask, resolveColorCorrection, resolvedParameters } from '../../utils/colorCorrection';
import type { ColorCorrectionRender } from './renderers/PartRenderer';
import type { LayerMaskSvgDefinition } from '../../utils/layerMasks';
import type { WorldTransform } from '../../types/composition';
import type { NamedSequenceRuntimeState } from '../../utils/broadcastEngine';
import { EDITOR_CAMERA_CENTER, getProjectCenter, type CoordinatePoint } from '../../utils/projectCoordinates';
import { deriveBooleanGeometry } from '../../utils/booleanGeometry';
import { affineSvgTransform, worldAffineOf } from '../../utils/containerMath';

interface StagePartLayersProps {
  sortedParts: CharacterPart[];
  appMode: AppMode;
  broadcastState: Record<string, BroadcastObjectState>;
  broadcastSessionActivated?: boolean;
  namedSequenceRuntime?: NamedSequenceRuntimeState;
  activeTemplateId: string;
  currentFrame: number;
  selectedPartId: string | null;
  selectedPartIds?: string[];
  booleanOperandEditingGroupId?: string | null;
  totalFrames: number;
  onSelect: (id: string, event: React.MouseEvent) => void;
  onStartTranslateDrag: (partId: string, e: React.MouseEvent) => void;
  /**
   * R4-09 — the explicit drill-in of the canvas: a double-click on a layer
   * selects that layer instead of the group it belongs to.
   */
  onDrillIn: (partId: string) => void;
  /** `locked` (the layer lock switch) only steers canvas picking, never the evaluation. */
  tracks: (AnimationTrackData & RuntimeTrackState & { locked?: boolean })[];
  customPresets: CustomMotionPreset[];
  liveStuntsState: Record<string, { stunt: string; progress: number; loop?: boolean; customPresetId?: string }>;
  /** Project resolution — world-space artboard region for inverted masks.
   *  Same computation as StageCanvas's artboard-clip. */
  projectResolution?: { width: number; height: number };
}

function toBroadcastRuntime(bs: Record<string, BroadcastObjectState>): Record<string, BroadcastRuntime> {
  const result: Record<string, BroadcastRuntime> = Object.create(null);
  for (const [id, s] of Object.entries(bs)) {
    result[id] = { state: s.state, progress: s.progress };
  }
  return result;
}

function toLiveStuntsRuntime(
  ls: Record<string, { stunt: string; progress: number; customPresetId?: string }>,
): Record<string, { stunt: string; progress: number; customPresetId?: string }> {
  const result: Record<string, { stunt: string; progress: number; customPresetId?: string }> = Object.create(null);
  for (const [id, s] of Object.entries(ls)) {
    result[id] = { stunt: s.stunt, progress: s.progress, customPresetId: s.customPresetId };
  }
  return result;
}
function getEffectiveMatte(part: CharacterPart): CharacterPart['matte'] {
  if (part.trackMatte && part.trackMatte.enabled !== false) {
    return {
      sourcePartId: part.trackMatte.sourceLayerId,
      mode: part.trackMatte.mode,
      inverted: part.trackMatte.inverted === true,
      enabled: true,
    };
  }
  return part.matte;
}

const StagePartLayersView: React.FC<StagePartLayersProps> = ({
  sortedParts,
  appMode,
  broadcastState,
  broadcastSessionActivated = true,
  namedSequenceRuntime,
  activeTemplateId,
  currentFrame,
  selectedPartId,
  selectedPartIds = [],
  booleanOperandEditingGroupId = null,
  totalFrames,
  onSelect,
  onStartTranslateDrag,
  onDrillIn,
  tracks,
  customPresets,
  liveStuntsState,
  projectResolution,
}) => {
  // Build frame overrides for custom_timeline presets
  const frameOverrides: Record<string, number> = Object.create(null);
  for (const part of sortedParts) {
    if (appMode === 'broadcast') {
      const bState = Object.prototype.hasOwnProperty.call(broadcastState, part.id)
        ? broadcastState[part.id]
        : { state: 'hidden', progress: 0 };
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
  perfCount('stageRenders');


  const runtime: RuntimeData = {
    appMode,
    broadcast: toBroadcastRuntime(broadcastState),
    liveStunts: toLiveStuntsRuntime(liveStuntsState),
  };

  const outputOrigin: CoordinatePoint = appMode === 'broadcast'
    ? getProjectCenter(projectResolution ?? { width: 1920, height: 1080 })
    : EDITOR_CAMERA_CENTER;

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

  // Broadcast is a runtime-controlled output surface. Entering the mode must
  // not leak the authored Edit pose before the first explicit sequence,
  // procedural transition, or live-stunt trigger of this session.
  if (appMode === 'broadcast' && !broadcastSessionActivated) {
    return null;
  }

  const activeNamedSequence = appMode === 'broadcast' && namedSequenceRuntime?.sequenceId
    ? namedSequenceRuntime
    : null;

  const evaluatedFrame = evaluateFrame(
    sortedParts,
    tracks,
    totalFrames,
    activeNamedSequence?.frame ?? currentFrame,
    runtime,
    customPresets,
    activeNamedSequence ? undefined : frameOverrides,
    appMode === 'edit' ? activeTemplateId : activeNamedSequence?.sequenceId ?? 'Sequence',
  );
  perfCount('partEvaluations', evaluatedFrame.layers.length);
  const booleanContoursByGroup = new Map<string, CharacterPart['booleanContours']>();
  for (const group of sortedParts) {
    if (!group.booleanOperandIds || !group.booleanOperation) continue;
    const operands = group.booleanOperandIds
      .map((id) => sortedParts.find((part) => part.id === id))
      .filter((part): part is CharacterPart => Boolean(part));
    const transforms = Object.fromEntries(
      operands.map((operand) => [
        operand.id,
        evaluatedFrame.layers.find((layer) => layer.id === operand.id)?.transform ?? operand.baseTransform,
      ]),
    );
    const groupTransform = evaluatedFrame.layers.find((layer) => layer.id === group.id)?.transform ?? group.baseTransform;
    const derived = deriveBooleanGeometry(
      group.booleanOperation,
      operands,
      transforms,
      groupTransform,
    );
    booleanContoursByGroup.set(group.id, derived.localContours);
  }
  const layerMaskDefinitions = new Map<string, LayerMaskSvgDefinition>();
  const layerMaskIdsByPart = new Map<string, string[]>();
  const layerMaskRenderKeyById = new Map<string, string>();
  for (const part of sortedParts) {
    const evaluated = evaluatedFrame.layers.find((layer) => layer.id === part.id);
    const evaluatedMasks = evaluated?.content.masks ?? part.masks;
    if (!evaluated || !evaluatedMasks?.length) continue;
    const ids: string[] = [];
    const stack: LayerMaskSvgDefinition[] = [];
    let previousId: string | undefined;
    for (const mask of evaluatedMasks) {
      // WP-08 — an effect-only mask scopes an effect; it never cuts the layer.
      if (isEffectOnlyMask(mask)) continue;
      const definition = buildLayerMaskDefinition(part, mask, evaluated.transform, outputOrigin);
      if (!definition) continue;
      const id = `kcs-layer-mask-${part.id}-${mask.id}${definition.mode === 'add' && !previousId ? '-add' : ''}`;
      const compositeMode = definition.inverted
        ? definition.mode === 'add' ? 'subtract' : definition.mode === 'subtract' ? 'add' : 'difference'
        : definition.mode;
      const step = { ...definition, id, previousId, compositeMode };
      layerMaskDefinitions.set(id, step);
      stack.push(step);
      previousId = id;
    }
    layerMaskRenderKeys(stack).forEach((key, index) => layerMaskRenderKeyById.set(stack[index].id, key));
    if (previousId) {
      ids.push(previousId);
      layerMaskIdsByPart.set(part.id, ids);
    }
  }

  // WP-08 — colour correction: per corrected layer one sRGB filter (F) and,
  // for a mask scope, a coverage mask (w) and its inverse (1 - w), both
  // luminance masks in the same world space as the layer masks. A correction
  // that resolves to anything but 'applied' (off, neutral, missing or
  // disabled mask) gets no defs and renders the layer untouched.
  const colorCorrections = new Map<string, ColorCorrectionRender & {
    matrix: string;
    slope: number;
    intercept: number;
    coverage?: LayerMaskSvgDefinition & { amount: number };
  }>();
  for (const part of sortedParts) {
    if (!part.effects?.length) continue;
    const evaluated = evaluatedFrame.layers.find((layer) => layer.id === part.id);
    if (!evaluated) continue;
    const status = resolveColorCorrection(part, evaluated.content.masks ?? part.masks);
    if (status.kind !== 'applied') continue;
    const ids = colorCorrectionIds(part.id, status.effect.id);
    const { amount } = resolvedParameters(status.effect);
    const filter = colorCorrectionFilter(status.effect);
    if (status.mask) {
      const definition = buildLayerMaskDefinition(part, status.mask, evaluated.transform, outputOrigin);
      if (!definition) continue;
      colorCorrections.set(part.id, { filterId: ids.filter, coverageMaskId: ids.coverage, inverseMaskId: ids.inverse, amount, ...filter, coverage: { ...definition, id: ids.coverage, amount } });
    } else {
      colorCorrections.set(part.id, { filterId: ids.filter, amount, ...filter });
    }
  }

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
  // M20 — radial gradients share the same Map/dedupe; the def value is a
  // discriminated union (kind: 'linear' → x1/y1/x2/y2, kind: 'radial' →
  // cx/cy/r) so linear and radial variants of the same source never collide.
  const matteGradients = new Map<string, { id: string; kind: 'linear' | 'radial'; stops: MatteGradientStop[]; x1?: number; y1?: number; x2?: number; y2?: number; cx?: number; cy?: number; r?: number }>();
  // M18/M21 — TEXT/IMAGE masks carry NO path geometry; the mask content is a
  // transform-baked <text> or <image> element. The source's evaluated world
  // transform is stored per mask id (render-only, recomputed every frame —
  // never stale).
  const contentTransforms = new Map<string, WorldTransform>();
  // M21 — nested content masks for image × gradient composition (7A): the
  // image alpha rides its own <mask> def (kcs-mask-{src}-img) that the final
  // mask wraps around the gradient rect — pure SVG multiplication, no canvas.
  const imageContentMasks = new Map<string, { id: string; content: MatteImageContent; transform: WorldTransform; opacity?: number }>();
  for (const layer of sortedParts) {
    const matte = getEffectiveMatte(layer);
    if (!matte || !isMatteActive(matte)) continue;
    const source = sortedParts.find((p) => p.id === matte.sourcePartId);
    if (!source) continue; // missing source → no clip/mask (recoverable validation warns)
    const sourceEl = evaluatedFrame.layers.find((el) => el.id === source.id);
    if (!sourceEl) continue;
    const mode = resolveMatteMode(matte);

    if (mode === 'clip') {
      if (matte.inverted === true) {
        // clipPath cannot represent a negative area. Preserve Clip's binary
        // geometry semantics by using the existing alpha evenodd-hole mask
        // structure, without enabling feather/strength/gradient parameters.
        const pathD = buildMattePath(source, sourceEl.transform, outputOrigin);
        if (pathD) {
          const maskId = matteMaskId(source.id, 'alpha', true);
          if (!matteMasks.has(maskId)) {
            matteMasks.set(maskId, buildMatteMaskFromPath(source.id, pathD, 'alpha', true, '#ffffff'));
          }
        }
      } else {
        const clipId = matteClipPathId(source.id);
        if (matteClips.has(clipId)) continue; // already built for this source (1 source → N targets)
        const clip = buildMatteClipPath(source, sourceEl.transform, outputOrigin);
        if (clip) matteClips.set(clip.id, clip);
      }
      continue;
    }

    // alpha | luminance
    if (mode !== 'alpha' && mode !== 'luminance') continue; // TS narrowing (unreachable)
    const inverted = matte.inverted === true;
    const feather = normalizeFeather(matte.feather);
    // M16: strength < 1 gets a deterministic -s{strength} suffix so the same
    // (source, mode, inverted, feather) with DIFFERENT strengths never
    // collides. strength undefined/1 = legacy behavior = full strength (1).
    const strength = normalizeStrength(matte.strength);
    // M17: gradient (mask modes only) — the -g suffix keeps gradient variants apart.
    const gradientAngle = matte.gradient
      ? normalizeGradientAngle(matte.gradient.angle) ?? 0
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
    const maskId = `${baseMaskId}${feather > 0 ? `-f${feather}` : ''}${strength < 1 ? `-s${strength}` : ''}${matteMaskGradientSuffix(matte.gradient)}`;
    if (matteMasks.has(maskId)) continue; // same (source, mode, inverted, feather, strength, gradient) already built

    // M18 — TEXT source: buildMattePath stays null (text has NO path
    // geometry). The glyphs become the mask CONTENT element; content/fonts
    // are read from the source at runtime (never persisted — sourcePartId is
    // the only persistent link).
    let mask: MatteMask;
    const fillColor = sourceEl.content.fillColor ?? source.fillColor ?? '#ffffff';
    if (source.type === 'custom_text') {
      const content = textMaskContent(source);
      if (!content) continue;
      mask = buildMatteTextMask(
        source.id, content, mode, inverted, fillColor,
        feather > 0 ? feather : undefined,
        strength < 1 ? strength : undefined,
      );
    } else if (source.type === 'custom_image') {
      // M21 — IMAGE source: buildMattePath stays null (no path geometry); the
      // <image> is the mask CONTENT element (7A pixel-verified). href/dims are
      // read from the source at runtime (never persisted — sourcePartId is the
      // only persistent link).
      const content = imageMaskContent(source);
      if (!content) continue;
      mask = buildMatteImageMask(
        source.id, content, mode, inverted,
        feather > 0 ? feather : undefined,
        strength < 1 ? strength : undefined,
      );
    } else {
      let pathD = maskPathCache.get(source.id);
      if (pathD === undefined) {
        pathD = buildMattePath(source, sourceEl.transform, outputOrigin) ?? undefined;
        if (pathD === undefined) continue;
        maskPathCache.set(source.id, pathD);
      }
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
    // M20 — radial gradients plug into the SAME pass: <radialGradient> with
    // the 6B-derived geometry (WORLD for shape/freeform/inverted text, LOCAL
    // for non-inverted text). Geometry is recomputed from the EVALUATED
    // transform every frame — animated sources never go stale.
    let maskGradientId: string | undefined;
    if (matte.gradient) {
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
      // TEXT def (which stays LOCAL). The same rule applies to radial.
      const isInvertedText = source.type === 'custom_text' && inverted;
      const gradId = `${gradientId(source.id, matte.gradient)!}-${structure}${isInvertedText ? '-inv' : ''}`;
      if (!matteGradients.has(gradId)) {
        const isRadial = normalizeGradientType(matte.gradient.type) === 'radial';
        if (isRadial) {
          // WORLD for shape/freeform AND inverted text (region rect consumes
          // the def); LOCAL only for the non-inverted text element (4A).
          const geo = isInvertedText || source.type !== 'custom_text'
            ? radialGradientGeometry(source, sourceEl.transform, false, outputOrigin)
            : radialGradientGeometry(source, sourceEl.transform, true, outputOrigin);
          if (geo) {
            matteGradients.set(gradId, {
              id: gradId,
              kind: 'radial',
              cx: geo.cx,
              cy: geo.cy,
              r: geo.r,
              stops: normalizeGradientStops(matte.gradient?.stops, structure),
            });
            maskGradientId = gradId;
          }
        } else {
          const eps = isInvertedText
            ? gradientEndpoints(source, sourceEl.transform, gradientAngle!, outputOrigin)      // WORLD (rect)
            : source.type === 'custom_text'
              ? gradientEndpointsLocal(source, sourceEl.transform, gradientAngle!, outputOrigin) // LOCAL (text element)
              : gradientEndpoints(source, sourceEl.transform, gradientAngle!, outputOrigin);
          if (eps) {
            matteGradients.set(gradId, {
              id: gradId,
              kind: 'linear',
              ...eps,
              stops: normalizeGradientStops(matte.gradient?.stops, structure),
            });
            maskGradientId = gradId;
          }
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
    if (mask.text || mask.image) contentTransforms.set(maskId, sourceEl.transform);
    // M21 — nested content mask (image alpha) for the image × gradient
    // composition: only non-inverted image + gradient needs the separate def.
    // Deduped by the deterministic kcs-mask-{src}-img id (one def per source).
    if (mask.image && maskGradientId && !mask.inverted && mask.imageContentMaskId) {
      if (!imageContentMasks.has(mask.imageContentMaskId)) {
        imageContentMasks.set(mask.imageContentMaskId, {
          id: mask.imageContentMaskId,
          content: mask.image,
          transform: sourceEl.transform,
          opacity: strength < 1 ? strength : undefined,
        });
      }
    }
  }

  const matteAttrFor = (part: CharacterPart): { clipId?: string; maskId?: string } => {
    const matte = getEffectiveMatte(part);
    if (!matte || !isMatteActive(matte)) return {};
    if (!sortedParts.some((p) => p.id === matte.sourcePartId)) return {};
    const mode = resolveMatteMode(matte);
    if (mode === 'clip') {
      if (matte.inverted === true) {
        const id = matteMaskId(matte.sourcePartId, 'alpha', true);
        return matteMasks.has(id) ? { maskId: id } : {};
      }
      const id = matteClipPathId(matte.sourcePartId);
      return matteClips.has(id) ? { clipId: id } : {};
    }
    if (mode === undefined) return {}; // unreachable when matte exists; TS narrowing
    const feather = normalizeFeather(matte.feather);
    const strength = normalizeStrength(matte.strength);
    const base = matteMaskId(matte.sourcePartId, mode, matte.inverted === true);
    const id = `${base}${feather > 0 ? `-f${feather}` : ''}${strength < 1 ? `-s${strength}` : ''}${matteMaskGradientSuffix(matte.gradient)}`;
    return matteMasks.has(id) ? { maskId: id } : {};
  };

  // Every userSpaceOnUse mask gets the same explicit project/stage coverage
  // region. SVG's implicit percentage mask region is viewport-relative and
  // can impose an unrelated rectangular cutoff on otherwise valid target
  // content. The region is derived from the active output origin and project
  // resolution, never from target or selection bounds.
  const region = {
    x: outputOrigin.x - (projectResolution?.width ?? 1920) / 2,
    y: outputOrigin.y - (projectResolution?.height ?? 1080) / 2,
    width: projectResolution?.width ?? 1920,
    height: projectResolution?.height ?? 1080,
  };
  const layerMaskOuterPath = `M ${region.x} ${region.y} H ${region.x + region.width} V ${region.y + region.height} H ${region.x} Z`;
  const layerMaskFilterUrl = (definition: LayerMaskSvgDefinition): string | undefined =>
    definition.feather > 0 || definition.expansion !== 0
      ? `url(#${layerMaskFilterId(definition.id)})`
      : undefined;

  // M14 feather: deterministic filter id derived from the mask id (which
  // already encodes source + mode + inverted + feather). The filter region
  // remains broad; the explicit mask region above prevents default mask
  // coverage from clipping the softened edge.
  const featherFilterId = (maskId: string) => `kcs-matte-feather-${maskId.slice('kcs-mask-'.length)}`;
  const featherUrl = (mask: MatteMask): string | undefined =>
    (mask.feather ?? 0) > 0 ? `url(#${featherFilterId(mask.id)})` : undefined;

  // M18 — the TEXT mask content: a <text> element baked through the SAME
  // world-map spelling the app's text renderer uses (PartRenderer inner <g>,
  // via the shared affineSvgTransform: the historical
  // translate(CX+tx, CY+ty) rotate(r) scale(sx,sy) form whenever a TRS
  // reproduces the layer's world map, the exact matrix otherwise; x=0/y=0,
  // centred on the baseline like the visible text). The evaluated world transform comes from
  // evaluatedFrame — the same pipeline that drives the geometry sources, so
  // parent composition / animation / negative scale are all preserved.
  // Content/fonts live on the source part (read at runtime via
  // textMaskContent — never duplicated here).
  const renderTextMaskContent = (mask: MatteMask, t: WorldTransform): React.ReactNode => {
    if (!mask.text) return null;
    return (
      <g transform={affineSvgTransform(worldAffineOf(t), t, outputOrigin)}>
        <text
          x={mask.text.x}
          y={mask.text.y}
          textAnchor={mask.text.textAnchor}
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

  // M21 — the IMAGE mask content: an <image> element baked through the SAME
  // transform spelling as text (the shared affineSvgTransform)
  // and the app's MediaPartRenderer layout convention (width×height centered
  // at the local origin, preserveAspectRatio xMidYMid slice). STRENGTH
  // CONTRACT (7A pixel-verified): fill-opacity is INERT on <image> — strength
  // renders as `opacity` (never fillOpacity). Feather reuses the same filter.
  const renderImageMaskContent = (mask: MatteMask, t: WorldTransform): React.ReactNode => {
    if (!mask.image) return null;
    return (
      <g transform={affineSvgTransform(worldAffineOf(t), t, outputOrigin)}>
        <image
          href={mask.image.href}
          x={-mask.image.width / 2}
          y={-mask.image.height / 2}
          width={mask.image.width}
          height={mask.image.height}
          preserveAspectRatio={mask.image.preserveAspectRatio}
          opacity={mask.strength}
          filter={featherUrl(mask)}
        />
      </g>
    );
  };

  return (
    <g clipPath={appMode === 'broadcast' ? 'url(#artboard-clip)' : undefined}>
      <defs>
        {[...layerMaskDefinitions.values()]
          .filter((definition) => definition.feather > 0 || definition.expansion !== 0)
          .map((definition) => (
            <filter
              key={layerMaskFilterId(definition.id)}
              id={layerMaskFilterId(definition.id)}
              filterUnits="userSpaceOnUse"
              x={region.x - definition.feather - Math.abs(definition.expansion)}
              y={region.y - definition.feather - Math.abs(definition.expansion)}
              width={region.width + (definition.feather + Math.abs(definition.expansion)) * 2}
              height={region.height + (definition.feather + Math.abs(definition.expansion)) * 2}
            >
              {definition.expansion !== 0 && (
                <feMorphology
                  operator={definition.expansion > 0 ? 'dilate' : 'erode'}
                  radius={Math.abs(definition.expansion)}
                />
              )}
              {definition.feather > 0 && <feGaussianBlur stdDeviation={definition.feather / 2} />}
            </filter>
          ))}
        {[...layerMaskDefinitions.values()].map((definition) => {
          const operation = definition.compositeMode ?? definition.mode;
          const hole = operation === 'subtract' || operation === 'difference';
          const shapeId = `${definition.id}-shape`;
          const inverseId = `${definition.previousId ?? definition.id}-inverse`;
          const currentInverse = `${definition.id}-inverse`;
          const body = !definition.previousId
            ? <path d={hole ? `${layerMaskOuterPath} ${definition.pathD}` : definition.pathD} fill="white" fillOpacity={hole ? 1 : definition.opacity} fillRule={hole ? 'evenodd' : undefined} filter={layerMaskFilterUrl(definition)} />
            : operation === 'add'
              ? <><rect x={region.x} y={region.y} width={region.width} height={region.height} fill="white" mask={`url(#${definition.previousId})`} /><path d={definition.pathD} fill="white" fillOpacity={definition.opacity} filter={layerMaskFilterUrl(definition)} /></>
              : operation === 'intersect'
                ? <path d={definition.pathD} fill="white" fillOpacity={definition.opacity} mask={`url(#${definition.previousId})`} filter={layerMaskFilterUrl(definition)} />
                : operation === 'difference'
                  ? <><g mask={`url(#${currentInverse})`}><rect x={region.x} y={region.y} width={region.width} height={region.height} fill="white" mask={`url(#${definition.previousId})`} /></g><g mask={`url(#${inverseId})`}><rect x={region.x} y={region.y} width={region.width} height={region.height} fill="white" mask={`url(#${shapeId})`} /></g></>
                  : <><rect x={region.x} y={region.y} width={region.width} height={region.height} fill="white" mask={`url(#${definition.previousId})`} /><path d={definition.pathD} fill="black" fillOpacity={definition.opacity} filter={layerMaskFilterUrl(definition)} /></>;
          const auxiliary = definition.previousId && operation === 'difference'
            ? <><mask id={shapeId} x={region.x} y={region.y} width={region.width} height={region.height} maskUnits="userSpaceOnUse"><path d={definition.pathD} fill="white" /></mask><mask id={inverseId} x={region.x} y={region.y} width={region.width} height={region.height} maskUnits="userSpaceOnUse"><rect x={region.x} y={region.y} width={region.width} height={region.height} fill="white" /><rect x={region.x} y={region.y} width={region.width} height={region.height} fill="black" mask={`url(#${definition.previousId})`} /></mask><mask id={`${definition.id}-inverse`} x={region.x} y={region.y} width={region.width} height={region.height} maskUnits="userSpaceOnUse"><rect x={region.x} y={region.y} width={region.width} height={region.height} fill="white" /><path d={definition.pathD} fill="black" /></mask></>
            : null;
          // C12 — luminance, not alpha: a hole step paints its shape BLACK over
          // the previous stack, and in an alpha mask opaque black still shows
          // the layer (the "Cut a hole" of a second mask cut nothing). White
          // content keeps every other step identical.
          return <React.Fragment key={layerMaskRenderKeyById.get(definition.id) ?? definition.id}>{auxiliary}<mask id={definition.id} x={region.x} y={region.y} width={region.width} height={region.height} maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" mask-type="luminance" data-mask-operation={operation}>{body}</mask></React.Fragment>;
        })}
        {[...colorCorrections.values()].map((correction) => {
          const coverage = correction.coverage;
          const coverageFilter = coverage && (coverage.feather > 0 || coverage.expansion !== 0) ? layerMaskFilterId(coverage.id) : undefined;
          // The coverage shape: the mask's own outline (or, inverted, everything outside it).
          const shapeD = coverage ? (coverage.inverted ? `${layerMaskOuterPath} ${coverage.pathD}` : coverage.pathD) : '';
          const weight = coverage ? coverage.opacity * coverage.amount : 0;
          return (
            <React.Fragment key={correction.filterId}>
              <filter id={correction.filterId} colorInterpolationFilters="sRGB" data-color-correction-filter="true">
                <feComponentTransfer>
                  <feFuncR type="linear" slope={correction.slope} intercept={correction.intercept} />
                  <feFuncG type="linear" slope={correction.slope} intercept={correction.intercept} />
                  <feFuncB type="linear" slope={correction.slope} intercept={correction.intercept} />
                </feComponentTransfer>
                <feColorMatrix type="matrix" values={correction.matrix} />
              </filter>
              {coverage && coverageFilter && (
                <filter
                  id={coverageFilter}
                  filterUnits="userSpaceOnUse"
                  x={region.x - coverage.feather - Math.abs(coverage.expansion)}
                  y={region.y - coverage.feather - Math.abs(coverage.expansion)}
                  width={region.width + (coverage.feather + Math.abs(coverage.expansion)) * 2}
                  height={region.height + (coverage.feather + Math.abs(coverage.expansion)) * 2}
                >
                  {coverage.expansion !== 0 && <feMorphology operator={coverage.expansion > 0 ? 'dilate' : 'erode'} radius={Math.abs(coverage.expansion)} />}
                  {coverage.feather > 0 && <feGaussianBlur stdDeviation={coverage.feather / 2} />}
                </filter>
              )}
              {coverage && (
                <>
                  <mask id={correction.coverageMaskId} x={region.x} y={region.y} width={region.width} height={region.height} maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" mask-type="luminance">
                    <path d={shapeD} fillRule={coverage.inverted ? 'evenodd' : undefined} fill="white" fillOpacity={weight} filter={coverageFilter ? `url(#${coverageFilter})` : undefined} />
                  </mask>
                  <mask id={correction.inverseMaskId} x={region.x} y={region.y} width={region.width} height={region.height} maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" mask-type="luminance">
                    <rect x={region.x} y={region.y} width={region.width} height={region.height} fill="white" />
                    <path d={shapeD} fillRule={coverage.inverted ? 'evenodd' : undefined} fill="black" fillOpacity={weight} filter={coverageFilter ? `url(#${coverageFilter})` : undefined} />
                  </mask>
                </>
              )}
            </React.Fragment>
          );
        })}
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
        {[...matteGradients.values()].map((g) =>
          g.kind === 'radial' ? (
            <radialGradient
              key={g.id}
              id={g.id}
              gradientUnits="userSpaceOnUse"
              cx={g.cx}
              cy={g.cy}
              r={g.r}
            >
              {g.stops.map((s, i) => (
                <stop key={i} offset={`${s.offset * 100}%`} stop-color={s.color} stop-opacity={s.opacity} />
              ))}
            </radialGradient>
          ) : (
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
          ),
        )}
        {[...imageContentMasks.values()].map((c) => (
          <mask
            key={c.id}
            id={c.id}
            x={region.x}
            y={region.y}
            width={region.width}
            height={region.height}
            maskUnits="userSpaceOnUse"
            maskContentUnits="userSpaceOnUse"
            mask-type="alpha"
          >
            <g transform={affineSvgTransform(worldAffineOf(c.transform), c.transform, outputOrigin)}>
              <image
                href={c.content.href}
                x={-c.content.width / 2}
                y={-c.content.height / 2}
                width={c.content.width}
                height={c.content.height}
                preserveAspectRatio={c.content.preserveAspectRatio}
                opacity={c.opacity}
              />
            </g>
          </mask>
        ))}
        {[...matteMasks.values()].map((mask) => (
          <mask
            key={mask.id}
            id={mask.id}
            x={region.x}
            y={region.y}
            width={region.width}
            height={region.height}
            maskUnits="userSpaceOnUse"
            maskContentUnits="userSpaceOnUse"
            // M18/M21 — inverted TEXT/IMAGE always render the luminance
            // structure (4A decision: alpha masks ignore a second element —
            // a white rect + black text hole only works as a luminance mask;
            // 7A: an inverted IMAGE cannot be repainted black — the luminance
            // structure makes dark image pixels punch the hole).
            mask-type={(mask.text || mask.image) && mask.inverted ? 'luminance' : mask.mode}
          >
            {mask.text ? (
              mask.inverted ? (
                <>
                  <rect x={region.x} y={region.y} width={region.width} height={region.height} fill={mask.gradientId ? `url(#${mask.gradientId})` : 'white'} fillOpacity={mask.strength} />
                  {renderTextMaskContent(mask, contentTransforms.get(mask.id)!)}
                </>
              ) : (
                renderTextMaskContent(mask, contentTransforms.get(mask.id)!)
              )
            ) : mask.image ? (
              // M21 — IMAGE mask content (7A pixel-verified semantics):
              // inverted → luminance structure: white/graduated region rect
              // BELOW the real image (dark image pixels punch the hole —
              // the image is NEVER repainted black).
              // non-inverted + gradient → nested-mask multiplication: the
              // image alpha mask wraps the gradient rect (image × gradient).
              // non-inverted plain → the transform-baked <image> is the mask.
              mask.inverted ? (
                <>
                  <rect x={region.x} y={region.y} width={region.width} height={region.height} fill={mask.gradientId ? `url(#${mask.gradientId})` : 'white'} fillOpacity={mask.strength} />
                  {renderImageMaskContent(mask, contentTransforms.get(mask.id)!)}
                </>
              ) : mask.gradientId && mask.imageContentMaskId ? (
                <g mask={`url(#${mask.imageContentMaskId})`}>
                  <rect x={region.x} y={region.y} width={region.width} height={region.height} fill={`url(#${mask.gradientId})`} />
                </g>
              ) : (
                renderImageMaskContent(mask, contentTransforms.get(mask.id)!)
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
      {(() => {
        const operandEditingActive = appMode !== 'broadcast' && Boolean(booleanOperandEditingGroupId);
        const hiddenMatteSources = new Set(
          sortedParts
            .filter((part) => part.trackMatte?.sourceVisible === false && part.trackMatte.enabled !== false)
            .map((part) => part.trackMatte!.sourceLayerId),
        );
        const layers = evaluatedFrame.layers.filter((el) => {
          const part = sortedParts.find((candidate) => candidate.id === el.id);
          return !hiddenMatteSources.has(el.id) && (!part?.booleanGroupId || !operandEditingActive);
        });
          layers.push(...evaluatedFrame.layers.filter((el) => {
            const part = sortedParts.find((candidate) => candidate.id === el.id);
            return !hiddenMatteSources.has(el.id) && part?.booleanGroupId === booleanOperandEditingGroupId;
          }));
        // C4 — a locked layer is drawn exactly as before but is not picked on
        // the canvas: clicks fall through to the layer beneath (edit mode only).
        const lockedIds = appMode === 'edit' ? new Set(tracks.filter((track) => track.locked).map((track) => track.partId)) : null;
        return layers.map((el) => {
          const part = sortedParts.find(p => p.id === el.id);
          if (!part) return null;
          if (part.booleanGroupId && part.booleanGroupId !== booleanOperandEditingGroupId) return null;
          const matteAttrs = matteAttrFor(part);
          const booleanContours = booleanContoursByGroup.get(part.id);
          const layerMaskIds = layerMaskIdsByPart.get(part.id);

          return (
            <PartRenderer
              key={el.id}
              part={part}
              currentFrame={currentFrame}
              onSelect={onSelect}
              onStartTranslateDrag={onStartTranslateDrag}
              onDrillIn={onDrillIn}
              isSelected={selectedPartIds.includes(el.id) || selectedPartId === el.id}
              evaluatedLayer={el}
              booleanContours={booleanContours}
              layerMaskIds={layerMaskIds}
              matteClipPathId={matteAttrs.clipId}
              matteMaskId={matteAttrs.maskId}
              colorCorrection={colorCorrections.get(part.id)}
              outputOrigin={outputOrigin}
              isLocked={lockedIds?.has(el.id) ?? false}
            />
          );
        });
      })()}
    </g>
  );
};

/**
 * C3 — rendering is a pure function of these props (no context read here), so
 * the layers re-render only when one of them changes: a camera pan/zoom or a
 * dock-layout frame of the canvas does not re-evaluate and re-render every
 * part. Evaluation and SVG output are unchanged.
 */
export const StagePartLayers = React.memo(StagePartLayersView);
