import React, { useState } from 'react';
import { Eye, EyeOff, Lock, PenLine, X } from 'lucide-react';
import type { BezierPath, CharacterPart, LayerMask, MatteMode, PartMatte, Track } from '../../../../types/animator';
import { maskPathTopologyLockReason } from '../../../../utils/geometry/maskPathCreation';
import { BezierPathEditor } from '../../BezierPathEditor';
import { NumberField } from '../../inputs/NumberField';
import { pickedTrackMatte, trackMattePickVerdict } from '../../../../utils/layers/trackMattePick';
import { requestMaskPointsFocus } from '../../../../utils/geometry/maskPointFocus';
import type { PathOrderCommand } from '../../../../utils/geometry/maskPathOrder';
import type { MaskDrawShape } from '../../../../hooks/useMaskEditing';
import { resolveMatteSource, resolveMatteMode, isMatteEligible, suppressedMatteSourceIds } from '../../../../utils/layers/matte';
import { StyleCard } from './StyleCard';
import { TrackMatteSummary } from './TrackMatteSummary';
import { MatteRenderControls, type MatteChannelKeys } from './MatteRenderControls';
interface StyleMatteSectionProps {
  /** Opens/closes ONE undo entry around a continuous pointer gesture in this section. */
  onInteractionStart?: () => void;
  onInteractionEnd?: () => void;
  selectedPart: CharacterPart;
  characterParts: CharacterPart[];
  onPartPropChange: (key: keyof CharacterPart, value: any) => void;
  onChangeMaskPath?: (maskId: string, path: BezierPath) => void;
  /** The mask of THIS layer edited on the canvas, if any. */
  maskEditTargetId?: string | null;
  onEditMaskOnCanvas?: (maskId: string) => void;
  onExitMaskEditing?: () => void;
  /** The shape a new mask is being drawn as on the canvas, if any. */
  maskDrawShape?: MaskDrawShape | null;
  onStartMaskDraw?: (shape: MaskDrawShape) => void;
  /** Rotates/scales the active mask path about its own centre (layer pivot untouched). */
  /** Transient Track Matte navigation (selection only). */
  matteReturnTargetId?: string | null;
  onSelectMatteSource?: (targetId: string, sourceId: string) => void;
  onBackToMatteTarget?: () => void;
  /** Tells why a Track Matte source choice was refused (C10: from the source list). */
  onPickRefused?: (reason: string) => void;
  /** A mask path structure command; returns the selected point's new index, undefined when refused. */
  onMaskPathOrder?: (maskId: string, command: PathOrderCommand, selectedIndex: number | null) => number | null | undefined;
  onSelectMatteTarget?: (targetId: string) => void;
  /** The layer's mask path keys (the topology guard reads them) and the canvas-selected point. */
  maskPathChannels?: Track['maskPathChannels'];
  maskVertexIndex?: number | null;
  onSelectMaskVertex?: (index: number | null) => void;
  /** The keyframe buttons of the Track Matte's FEATHER and STRENGTH. */
  matteChannelKeys?: MatteChannelKeys;
}

const MASK_DRAW_SHAPES: { shape: MaskDrawShape; label: string }[] = [
  { shape: 'rectangle', label: 'Rectangle' },
  { shape: 'ellipse', label: 'Ellipse' },
  { shape: 'pen', label: 'Pen' },
];

/**
 * A mask either shows the layer inside it or cuts a hole ("Cut a hole":
 * subtract). Intersect and Difference are kept for older projects: they render
 * as before and are named here, but are no longer offered.
 */
const LAYER_MASK_MODE_LABEL: Record<LayerMask['mode'], string> = {
  add: '',
  subtract: 'Hole',
  intersect: 'Intersect',
  difference: 'Difference',
};
const isLegacyMaskMode = (mode: LayerMask['mode']) => mode === 'intersect' || mode === 'difference';

const selectStyle: React.CSSProperties = {
  width: '100%',
  height: 28,
  background: 'var(--bg-input)',
  border: '1px solid var(--border-color)',
  borderRadius: 4,
  color: '#fff',
  fontSize: 11,
  fontWeight: 500,
  padding: '0 6px',
};
const compactSelectStyle: React.CSSProperties = {
  ...selectStyle,
  width: 'var(--inspector-control-sm)',
  maxWidth: '100%',
};

/**
 * M11 Step 3 — Track Matte editor UI.
 *
 * Lets the user assign another SHAPE part as this part's clip source.
 * Only parts with static shape geometry (shapeGeometry single source) are
 * eligible; the part itself is never listed; freeform/text/image/video
 * sources are excluded for the MVP.
 *
 * Updates go through the generic part-prop channel (handlePartPropChange)
 * so undo/redo is captured automatically by the existing history system.
 */
export const StyleMatteSection: React.FC<StyleMatteSectionProps> = ({
  selectedPart,
  characterParts,
  onPartPropChange,
  onInteractionStart,
  onInteractionEnd,
  onChangeMaskPath,
  maskEditTargetId = null,
  onEditMaskOnCanvas,
  onExitMaskEditing,
  maskDrawShape = null,
  onStartMaskDraw,
  matteReturnTargetId = null,
  onSelectMatteSource,
  onBackToMatteTarget,
  onMaskPathOrder,
  onPickRefused,
  onSelectMatteTarget,
  maskPathChannels,
  maskVertexIndex,
  onSelectMaskVertex,
  matteChannelKeys,
}) => {
  /**
   * A slider is one continuous gesture: the transaction opens when the pointer
   * goes down and closes when it comes up, so the whole drag is one undo entry
   * while a keyboard step stays a discrete edit of its own.
   */
  const rangeGesture = {
    onPointerDown: onInteractionStart,
    onPointerUp: onInteractionEnd,
    onPointerCancel: onInteractionEnd,
    onBlur: onInteractionEnd,
  };
  const matte = selectedPart.matte;
  // M15 3D: eligible = static shape geometry OR custom_freeform (points-based).
  // Self-reference still excluded. Text/image/video stay ineligible.
  const eligibleSources = characterParts.filter(
    (p) => p.id !== selectedPart.id && isMatteEligible(p),
  );

  const sourceMissing = !!matte && !characterParts.some((p) => p.id === matte.sourcePartId);

  // Text sources have NO path geometry, so Clip is not a valid mode for
  // them (buildMattePath → null; the renderer ignores text+clip). The Clip
  // option is disabled at the UI level while a text source is selected — no
  // renderer fallback, no new eligibility logic (isMatteEligible stays the
  // single authority for the source LIST).
  // IMAGE sources are the same: buildMattePath(image) → null (the
  // <image> is mask CONTENT, never a clip contour — 7B/7C contract). Same
  // UI-level disabled-Clip pattern; alpha/luminance/inverted/feather/
  // strength/gradient all stay enabled.
  const selectedSourceType = matte && !sourceMissing
    ? characterParts.find((p) => p.id === matte.sourcePartId)?.type
    : undefined;
  const noClipSource = selectedSourceType === 'custom_text' || selectedSourceType === 'custom_image';

  const setMatte = (next: PartMatte | undefined) => {
    onPartPropChange('matte', next);
  };

  const onSelectSource = (sourcePartId: string) => {
    if (!sourcePartId) {
      // "None" → remove the matte entirely (no half/empty matte object)
      setMatte(undefined);
      return;
    }
    if (matte) {
      // M15 3D — field preservation: only sourcePartId changes; mode /
      // inverted / enabled / feather are kept (source swap must not reset).
      setMatte({ ...matte, sourcePartId });
    } else {
      setMatte({ sourcePartId, mode: 'clip', enabled: true });
    }
  };

  const onToggleEnabled = () => {
    if (!matte) return;
    setMatte({ ...matte, enabled: matte.enabled === false ? true : false });
  };

  const onChangeMode = (mode: MatteMode) => {
    if (!matte) return;
    // Preserve sourcePartId / enabled / inverted — only mode changes
    setMatte({ ...matte, mode });
  };

  const onToggleInverted = () => {
    if (!matte) return;
    setMatte({ ...matte, inverted: matte.inverted === true ? false : true });
  };

  const onRemove = () => setMatte(undefined);

  const selectValue = matte && !sourceMissing ? matte.sourcePartId : '';
  // Runtime-resolved values — legacy data without mode/inverted shows Clip / OFF
  const modeValue = matte ? resolveMatteMode(matte) ?? 'clip' : 'clip';
  const invertedValue = matte?.inverted === true;
  const layerMasks = selectedPart.masks ?? [];
  const [selectedLayerMaskId, setSelectedLayerMaskId] = useState<string | undefined>(layerMasks[0]?.id);
  // While a mask is edited on the canvas, the Inspector shows that same mask:
  // Canvas, Inspector and Timeline never point at two different masks.
  const activeLayerMask = layerMasks.find((layerMask) => layerMask.id === (maskEditTargetId ?? selectedLayerMaskId)) ?? layerMasks[0];
  const isEditingActiveMaskOnCanvas = !!maskEditTargetId && activeLayerMask?.id === maskEditTargetId;
  const setLayerMasks = (next: LayerMask[]) => onPartPropChange('masks', next);
  const updateLayerMask = (maskId: string, patch: Partial<LayerMask>) => {
    setLayerMasks(layerMasks.map((layerMask) => layerMask.id === maskId ? { ...layerMask, ...patch } : layerMask));
  };
  const updateActiveLayerMask = (patch: Partial<LayerMask>) => {
    if (!activeLayerMask) return;
    updateLayerMask(activeLayerMask.id, patch);
  };
  const trackMatte = selectedPart.trackMatte;
  const trackMatteSourceMissing = !!trackMatte && !characterParts.some((part) => part.id === trackMatte.sourceLayerId);
  const trackMatteSources = characterParts.filter((part) => part.id !== selectedPart.id);
  // K5 (review fix): the (hidden) label answers the TARGET-direction question —
  // is this CANDIDATE suppressed because some other part uses it as a
  // switched-off matte source — never the candidate's own relationship flag.
  const suppressedSourceIds = suppressedMatteSourceIds(characterParts);
  const setTrackMatte = (next: CharacterPart['trackMatte'] | undefined) => onPartPropChange('trackMatte', next);

  // The effective relationship (and the layers this one is the matte
  // of) is always visible above the settings, so the user never has to know
  // which stored representation is in effect.
  const showMatteSummary = Boolean(resolveMatteSource(selectedPart))
    || characterParts.some((part) => part.id !== selectedPart.id && resolveMatteSource(part)?.sourceId === selectedPart.id);

  return (
    <>
    <StyleCard title="LAYER MASKS" collapsible retainKey="layer-masks">
      <div className="matte-control-grid">
        {/* C3 — one compact row per mask (order, name, mode, off state); the
            selected row is the mask the settings below edit. C5/C10 — each row
            also carries its own actions: on/off and Edit on canvas. A path lock
            from an older project shows its unlock button; new locks are not
            offered. */}
        <div className="matte-span-full layer-mask-list" role="group" aria-label="Layer masks of this layer">
          {layerMasks.map((layerMask, index) => {
            const isOn = layerMask.enabled !== false;
            const isLockedMask = layerMask.locked === true;
            const isEditingThis = isEditingActiveMaskOnCanvas && layerMask.id === activeLayerMask?.id;
            return (
            <div key={layerMask.id} className="layer-mask-row-wrap">
            <button
              type="button"
              className={`layer-mask-row${layerMask.id === activeLayerMask?.id ? ' is-active' : ''}${layerMask.enabled === false ? ' is-off' : ''}`}
              // Choosing which mask to look at is inspection: it works on a locked layer.
              data-lock-exempt
              aria-pressed={layerMask.id === activeLayerMask?.id}
              aria-label={`${index + 1}. ${layerMask.name}${layerMask.locked ? ' (locked)' : ''}`}
              title={`${layerMask.name}${LAYER_MASK_MODE_LABEL[layerMask.mode] ? ` — ${LAYER_MASK_MODE_LABEL[layerMask.mode]}` : ''}${layerMask.enabled === false ? ', disabled' : ''}${layerMask.locked ? ', path locked' : ''}`}
              onClick={() => {
                setSelectedLayerMaskId(layerMask.id);
                if (maskEditTargetId && layerMask.id !== maskEditTargetId) onEditMaskOnCanvas?.(layerMask.id);
              }}
            >
              <span className="layer-mask-row-index" aria-hidden="true">{index + 1}</span>
              <span className="layer-mask-row-name">{layerMask.name}</span>
              {LAYER_MASK_MODE_LABEL[layerMask.mode] && <span className="layer-mask-row-mode" aria-hidden="true">{LAYER_MASK_MODE_LABEL[layerMask.mode]}</span>}
              {layerMask.affectsAlpha === false && <span className="layer-mask-row-effect" title="Effect-only: scopes an effect, does not cut the layer">Effect</span>}
              {layerMask.enabled === false && <span className="layer-mask-row-off" aria-hidden="true">Off</span>}
              {layerMask.locked && <Lock size={10} className="layer-mask-row-lock" aria-hidden="true" />}
            </button>
            <button
              type="button"
              className={`layer-mask-row-action${isOn ? '' : ' is-off'}`}
              aria-label={`Enable ${layerMask.name}`}
              aria-pressed={isOn}
              title={isOn ? 'Enabled — click to switch this mask off' : 'Off — click to switch this mask on'}
              onClick={() => updateLayerMask(layerMask.id, { enabled: !isOn })}
            >
              {isOn ? <Eye size={12} aria-hidden="true" /> : <EyeOff size={12} aria-hidden="true" />}
            </button>
            {isLockedMask && (
              <button
                type="button"
                className="layer-mask-row-action is-locked"
                aria-label={`Unlock path of ${layerMask.name}`}
                title="Path locked (older project) — click to unlock"
                onClick={() => updateLayerMask(layerMask.id, { locked: false })}
              >
                <Lock size={12} aria-hidden="true" />
              </button>
            )}
            {onEditMaskOnCanvas && (
              <button
                type="button"
                className={`layer-mask-row-action${isEditingThis ? ' is-active' : ''}`}
                aria-label={`Edit ${layerMask.name} on the canvas`}
                aria-pressed={isEditingThis}
                disabled={!isEditingThis && isLockedMask}
                title={isLockedMask && !isEditingThis ? 'This mask path is locked — unlock it to edit' : isEditingThis ? 'Finish editing this mask (Esc)' : 'Edit this mask on the canvas'}
                onClick={() => {
                  if (isEditingThis) {
                    onExitMaskEditing?.();
                    return;
                  }
                  setSelectedLayerMaskId(layerMask.id);
                  onEditMaskOnCanvas(layerMask.id);
                }}
              >
                <PenLine size={12} aria-hidden="true" />
              </button>
            )}
            </div>
            );
          })}
        </div>
        {onStartMaskDraw && (
          <div className="matte-span-full" role="group" aria-label="Draw a new mask on the canvas" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <span className="form-label" style={{ margin: 0 }}>DRAW MASK</span>
            {MASK_DRAW_SHAPES.map(({ shape, label }) => (
              <button
                key={shape}
                type="button"
                className={maskDrawShape === shape ? 'btn-primary' : 'btn-secondary'}
                aria-pressed={maskDrawShape === shape}
                aria-label={`Draw ${label.toLowerCase()} mask`}
                title={`Draw a ${label.toLowerCase()} mask on this layer, on the canvas`}
                onClick={() => onStartMaskDraw(shape)}
              >
                {label}
              </button>
            ))}
          </div>
        )}
        {activeLayerMask && (
          <>
            {onEditMaskOnCanvas && (
              <div className="matte-span-full">
                <button
                  type="button"
                  className={isEditingActiveMaskOnCanvas ? 'btn-primary' : 'btn-secondary'}
                  aria-pressed={isEditingActiveMaskOnCanvas}
                  // Where keyboard focus returns when mask editing ends on the canvas.
                  data-mask-edit-entry
                  disabled={!isEditingActiveMaskOnCanvas && activeLayerMask.locked === true}
                  title={activeLayerMask.locked
                    ? 'This mask is locked'
                    : isEditingActiveMaskOnCanvas
                      ? 'Return to layer editing (Esc)'
                      : 'Move the mask path and its points directly on the canvas; the layer stays in place'}
                  onClick={(event) => {
                    if (isEditingActiveMaskOnCanvas) {
                      onExitMaskEditing?.();
                      return;
                    }
                    // A keyboard activation (no pointer: detail 0) continues on the points.
                    if (event.detail === 0) requestMaskPointsFocus();
                    onEditMaskOnCanvas(activeLayerMask.id);
                  }}
                >
                  {isEditingActiveMaskOnCanvas ? 'Exit Mask Editing' : 'Edit on Canvas'}
                </button>
              </div>
            )}
            <label
              className="matte-toggle-field matte-span-full"
              title="Off: the layer shows only inside the mask. On: the mask cuts a hole and the layer shows outside it."
            >
              <input
                type="checkbox"
                checked={activeLayerMask.mode === 'subtract'}
                onChange={(event) => updateActiveLayerMask({ mode: event.target.checked ? 'subtract' : 'add' })}
              />
              Cut a hole
              {isLegacyMaskMode(activeLayerMask.mode) && (
                <span className="matte-field-hint">
                  From an older project: {LAYER_MASK_MODE_LABEL[activeLayerMask.mode]}. Ticking or clearing the box replaces it.
                </span>
              )}
            </label>
            <div className="matte-field matte-compact-field">
              <label className="form-label">FEATHER</label>
              <NumberField className="input-control" aria-label="Mask feather" min={0} step={0.5} value={activeLayerMask.feather ?? 0} onValue={(feather) => updateActiveLayerMask({ feather })} />
            </div>
            <div className="matte-field matte-compact-field">
              <label className="form-label">OPACITY</label>
              <NumberField className="input-control" aria-label="Mask opacity" min={0} max={1} step={0.05} value={activeLayerMask.opacity ?? 1} onValue={(opacity) => updateActiveLayerMask({ opacity })} />
            </div>
            <div className="matte-field matte-compact-field">
              <label className="form-label">EXPANSION</label>
              <NumberField className="input-control" aria-label="Mask expansion" step={1} value={activeLayerMask.expansion ?? 0} onValue={(expansion) => updateActiveLayerMask({ expansion })} />
            </div>
            <div className="matte-span-full">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label className="form-label">MASK PATH</label>
              </div>
              <BezierPathEditor
                // The mask's shape is edited on the canvas: no pad here, only its commands.
                showShape={false}
                onInteractionStart={onInteractionStart}
                onInteractionEnd={onInteractionEnd}
                path={activeLayerMask.path}
                aspectRatio={(selectedPart.width ?? 260) / Math.max(1, selectedPart.height ?? 160)}
                topologyLockReason={maskPathTopologyLockReason({ maskPathChannels }, activeLayerMask.id)}
                readOnlyReason={activeLayerMask.locked ? 'This mask is locked. Unlock its path to edit it.' : null}
                {...(onMaskPathOrder ? { onOrderCommand: (command: PathOrderCommand, index: number | null) => onMaskPathOrder(activeLayerMask.id, command, index) } : {})}
                {...(isEditingActiveMaskOnCanvas && onSelectMaskVertex
                  ? { selectedIndex: maskVertexIndex ?? null, onSelectIndex: onSelectMaskVertex }
                  : {})}
                onChange={(path) => onChangeMaskPath
                  ? onChangeMaskPath(activeLayerMask.id, path)
                  : updateActiveLayerMask({ path })}
              />
            </div>
          </>
        )}
      </div>
    </StyleCard>
    {/* C5 — the effective relationship sits with the Track Matte card it
        belongs to (after the layer's own masks), not ahead of them. */}
    {showMatteSummary && (
      <TrackMatteSummary
        selectedPart={selectedPart}
        characterParts={characterParts}
        returnTargetId={matteReturnTargetId}
        onSelectSource={onSelectMatteSource}
        onBackToTarget={onBackToMatteTarget}
        onSelectTarget={onSelectMatteTarget}
      />
    )}
    <StyleCard key={`track-matte:${selectedPart.id}`} title="TRACK MATTE" collapsible retainKey={`track-matte:${selectedPart.id}`} badge={trackMatte && !trackMatteSourceMissing ? (trackMatte.enabled !== false ? 'On' : 'Off') : undefined}>
      <p className="matte-section-intro" data-testid="track-matte-intro">
        Shows this layer only where another layer is (its alpha) or as bright as it is (its luminance),
        with an optional soft edge, strength and gradient.
      </p>
      <div className="matte-control-grid">
        <div className="matte-field matte-source-field matte-span-full">
          <label className="form-label">SOURCE LAYER</label>
          {/* C10 — the list is the one way to pick a source (the canvas
              pick-whip is gone); a choice the validator refuses says why. */}
          <select
            className="select-control"
            style={selectStyle}
            aria-label="Track matte source"
            value={trackMatte && !trackMatteSourceMissing ? trackMatte.sourceLayerId : ''}
            onChange={(event) => {
              const sourceLayerId = event.target.value;
              if (!sourceLayerId) {
                setTrackMatte(undefined);
                return;
              }
              const verdict = sourceLayerId === trackMatte?.sourceLayerId
                ? null
                : trackMattePickVerdict(characterParts, selectedPart.id, sourceLayerId);
              if (verdict && !verdict.ok) {
                onPickRefused?.(verdict.reason);
                return;
              }
              setTrackMatte(pickedTrackMatte(trackMatte, sourceLayerId));
            }}
          >
            <option value="">None</option>
            {trackMatteSources.map((part) => <option key={part.id} value={part.id}>{`${part.name || part.id}${suppressedSourceIds.has(part.id) ? ' (hidden)' : ''}`}</option>)}
          </select>
        </div>
        {trackMatteSourceMissing && (
          <div className="matte-span-full" style={{ fontSize: 11, color: '#f59e0b' }}>
            Missing source ({trackMatte!.sourceLayerId}) — track matte not applied
          </div>
        )}
        {trackMatte && !trackMatteSourceMissing && (
          <>
            <div className="matte-field matte-compact-field">
              <label className="form-label">MODE</label>
              <select className="select-control" style={compactSelectStyle} value={trackMatte.mode} onChange={(event) => setTrackMatte({ ...trackMatte, mode: event.target.value as 'alpha' | 'luminance' })}>
                <option value="alpha">Alpha</option>
                <option value="luminance">Luminance</option>
              </select>
            </div>
            <label className="matte-toggle-field matte-compact-field">
              <input type="checkbox" checked={trackMatte.enabled !== false} onChange={(event) => setTrackMatte({ ...trackMatte, enabled: event.target.checked })} />
              Enabled
            </label>
            <label className="matte-toggle-field matte-compact-field">
              <input type="checkbox" checked={trackMatte.inverted === true} onChange={(event) => setTrackMatte({ ...trackMatte, inverted: event.target.checked })} />
              Inverted
            </label>
            <label className="matte-toggle-field matte-compact-field">
              <input type="checkbox" checked={trackMatte.sourceVisible !== false} onChange={(event) => setTrackMatte({ ...trackMatte, sourceVisible: event.target.checked })} />
              Show source
            </label>
            <MatteRenderControls
              partId={selectedPart.id}
              channelKeys={matteChannelKeys}
              value={trackMatte}
              mode={trackMatte.mode}
              onChange={(patch) => setTrackMatte({ ...trackMatte, ...patch })}
              rangeGesture={rangeGesture}
              compactSelectStyle={compactSelectStyle}
            />
          </>
        )}
      </div>
    </StyleCard>
    {/* One matte card for new work: the Track Matte carries every matte
        setting. The legacy card shows only on a layer that already has a legacy
        matte, so older projects stay editable and render as before. */}
    {matte && (
    <StyleCard
      title="LEGACY CLIP MATTE"
      collapsible
      retainKey="legacy-clip-matte"
      badge={trackMatte && trackMatte.enabled !== false ? 'Kept · not applied' : matte.enabled === false ? 'Off' : 'In use'}
    >
      <p className="matte-section-intro" data-testid="legacy-matte-intro">
        The older matte of this layer, kept so the project looks the same. New mattes are made in the
        Track Matte card above, which has the same settings; a Track Matte that is on always wins over this one.
        Remove this matte and the card goes away.
      </p>
      {matte && trackMatte && trackMatte.enabled !== false && (
        <div className="matte-span-full matte-legacy-status" role="note" style={{ fontSize: 11, color: '#f59e0b', marginBottom: 8 }}>
          Not applied right now: the <strong>Track Matte</strong> above is on. These settings are kept unchanged;
          turn the Track Matte off (or clear it) to use them again.
        </div>
      )}
      <div className="matte-control-grid">
        <div className="matte-field matte-source-field matte-span-full">
          <label className="form-label">MASK SOURCE</label>
          <select className="select-control" style={selectStyle} value={selectValue} onChange={(e) => onSelectSource(e.target.value)}>
            <option value="">None</option>
            {eligibleSources.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name || p.id}
              </option>
            ))}
          </select>
        </div>

        {sourceMissing && (
          <div className="matte-span-full" style={{ fontSize: 11, color: '#f59e0b' }}>
            Missing source ({matte!.sourcePartId}) — clip not applied
          </div>
        )}
        {matte && !sourceMissing && (
          <>
            <div className="matte-field matte-compact-field">
              <label className="form-label">MODE</label>
              <select
                className="select-control"
                style={compactSelectStyle}
                value={modeValue}
                onChange={(e) => onChangeMode(e.target.value as MatteMode)}
              >
                <option value="clip" disabled={noClipSource}>Clip</option>
                <option value="alpha">Alpha</option>
                <option value="luminance">Luminance</option>
              </select>
              {noClipSource && modeValue === 'clip' && (
                <div style={{ marginTop: 6, fontSize: 11, color: '#f59e0b' }}>
                  {selectedSourceType === 'custom_text'
                    ? 'Text sources require Alpha or Luminance mode — Clip is not supported.'
                    : 'Image sources require Alpha or Luminance mode — Clip is not supported.'}
                </div>
              )}
            </div>

            <div className="matte-toggle-field">
              <label className="form-label" style={{ margin: 0 }}>INVERTED</label>
              <input
                type="checkbox"
                aria-label="Inverted"
                checked={invertedValue}
                onChange={onToggleInverted}
                style={{ accentColor: '#4a8fe8' }}
              />
            </div>

            <MatteRenderControls
              partId={selectedPart.id}
              value={matte}
              mode={modeValue}
              onChange={(patch) => setMatte({ ...matte, ...patch })}
              rangeGesture={rangeGesture}
              compactSelectStyle={compactSelectStyle}
            />

            <label className="matte-toggle-field matte-span-full" style={{ fontSize: 11, color: '#d6d6d6', cursor: 'pointer' }}>
              <input
                type="checkbox"
                aria-label="Enabled"
                checked={matte.enabled !== false}
                onChange={onToggleEnabled}
                style={{ accentColor: '#4a8fe8' }}
              />
              Enabled
            </label>
          </>
        )}
      </div>

      {matte && (
        <div style={{ marginTop: 8 }}>
          <button
            className="btn-icon-small danger"
            onClick={onRemove}
            title="Remove the legacy clip matte (the source layer is not changed)"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11 }}
          >
            <X size={12} />
            Remove
          </button>
        </div>
      )}
    </StyleCard>
    )}
    </>
  );
};
