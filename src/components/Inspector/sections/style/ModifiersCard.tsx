import React from 'react';
import type { CharacterPart } from '../../../../types/animator';
import type { FitToTextSettings, FollowSettings, HorizontalAlign, RepeaterSettings, TextFitSettings } from '../../../../utils/layers/layoutModifiers';
import { SHAPE_EXTENTS } from '../../../../utils/layers/layoutModifiers';
import type { ModifierPatch } from '../../../../hooks/useModifierEditing';
import { SmartNumberInput } from '../../inputs/SmartNumberInput';
import { StyleCard } from './StyleCard';

/** The box-like shapes a text can size (`utils/layers/layoutModifiers`). */
const SIZABLE: ReadonlyArray<CharacterPart['type']> = ['custom_box', 'custom_rect', 'custom_banner', 'custom_capsule', 'custom_card'];
const DEFAULT_PADDING = 24;

type ModifierKind = 'textBox' | 'hideWhenEmpty' | 'autoSize' | 'follow' | 'justify' | 'repeater';
const MODIFIER_NAMES: Record<ModifierKind, string> = {
  textBox: 'Text Box',
  hideWhenEmpty: 'Hide When Empty',
  autoSize: 'Auto Size',
  follow: 'Auto Follow',
  justify: 'Justify',
  repeater: 'Repeater',
};

/** 0 in a limit field means "no limit": the setting is removed. */
const limitOrUndefined = (value: number): number | undefined => (Number.isFinite(value) && value > 0 ? value : undefined);

/** A settings object without its absent fields. */
const compact = <T extends object>(settings: T): T => Object.fromEntries(Object.entries(settings).filter(([, value]) => value !== undefined)) as T;

const ALIGN_OPTIONS: Array<{ value: HorizontalAlign; label: string }> = [
  { value: 'left', label: 'Left' },
  { value: 'center', label: 'Center' },
  { value: 'right', label: 'Right' },
];

/** Every layer that follows `id`, directly or through others: none of them may become its target. */
const followersOf = (parts: CharacterPart[], id: string): Set<string> => {
  const result = new Set<string>();
  let grew = true;
  while (grew) {
    grew = false;
    for (const part of parts) {
      const target = part.follow?.targetLayerId;
      if (target && (target === id || result.has(target)) && !result.has(part.id)) {
        result.add(part.id);
        grew = true;
      }
    }
  }
  return result;
};

const sameParent = (a: CharacterPart, b: CharacterPart) => (a.parentId || '') === (b.parentId || '');

interface ModifiersCardProps {
  selectedPart: CharacterPart;
  characterParts: CharacterPart[];
  /** Writes modifier settings as one edit that keeps the picture still (`useModifierEditing`). */
  onChangeModifiers: (partId: string, patch: ModifierPatch) => void;
  readOnly?: boolean;
}

/**
 * MODIFIERS: layout behaviour a layer takes from other layers, live in the
 * editor and in the OGraf graphic (`utils/layers/layoutModifiers`).
 */
export const ModifiersCard: React.FC<ModifiersCardProps> = ({ selectedPart, characterParts, onChangeModifiers, readOnly = false }) => {
  const part = selectedPart;
  const write = (patch: ModifierPatch) => onChangeModifiers(part.id, patch);
  const isText = part.type === 'custom_text';
  const isSizable = SIZABLE.includes(part.type);
  const isGroup = Boolean(part.isGroup);
  const texts = characterParts.filter((candidate) => candidate.type === 'custom_text' && candidate.id !== part.id);
  const excluded = followersOf(characterParts, part.id);
  const followTargets = characterParts.filter((candidate) => candidate.id !== part.id && !excluded.has(candidate.id) && sameParent(candidate, part));

  // A text box is any text setting but Hide When Empty, which is its own modifier.
  const hasTextBox = Boolean(part.textFit && Object.keys(part.textFit).some((key) => key !== 'hideWhenEmpty'));
  const active: ModifierKind[] = [];
  if (isText && hasTextBox) active.push('textBox');
  if (isText && part.textFit?.hideWhenEmpty) active.push('hideWhenEmpty');
  if (isSizable && part.fitToText) active.push('autoSize');
  if (!isGroup && part.follow) active.push('follow');
  if (isGroup && part.justify) active.push('justify');
  if (!isGroup && part.repeater) active.push('repeater');

  const available: Array<{ kind: ModifierKind; disabled?: string }> = [];
  if (isText && !hasTextBox) available.push({ kind: 'textBox' });
  if (isText && !part.textFit?.hideWhenEmpty) available.push({ kind: 'hideWhenEmpty' });
  if (isSizable && !part.fitToText) available.push({ kind: 'autoSize', disabled: texts.length === 0 ? 'needs a text layer' : undefined });
  if (!isGroup && !part.follow) available.push({ kind: 'follow', disabled: followTargets.length === 0 ? 'needs another layer' : undefined });
  if (isGroup && !part.justify) available.push({ kind: 'justify' });
  if (!isGroup && !part.repeater && part.type !== 'mograph_cloner' && part.type !== 'particle_system') available.push({ kind: 'repeater' });

  const textFit: TextFitSettings = part.textFit ?? {};
  const writeTextFit = (patch: Partial<TextFitSettings>) => write({ textFit: compact({ ...textFit, ...patch }) });

  const add = (kind: ModifierKind) => {
    switch (kind) {
      case 'textBox':
        writeTextFit({ align: 'center' });
        break;
      case 'hideWhenEmpty':
        writeTextFit({ hideWhenEmpty: true });
        break;
      case 'autoSize': {
        // The nearest text above the shape, else the first one; the shape's
        // width today is its maximum, so nothing grows past what was drawn.
        const above = texts.filter((text) => text.zIndex > part.zIndex).sort((a, b) => a.zIndex - b.zIndex)[0] ?? texts[0];
        const extent = SHAPE_EXTENTS[part.type];
        const width = Math.round((extent ? extent.maxX - extent.minX : 120) * Math.abs(part.baseTransform.scaleX || 1));
        write({ fitToText: { textLayerId: above.id, padding: DEFAULT_PADDING, maxWidth: width } });
        break;
      }
      case 'follow': {
        const target = followTargets.find((candidate) => candidate.type === 'custom_text') ?? followTargets[0];
        write({ follow: { targetLayerId: target.id, side: 'right' } });
        break;
      }
      case 'justify':
        write({ justify: { horizontal: 'center' } });
        break;
      case 'repeater':
        write({ repeater: { count: 3, layout: 'line', offsetX: 100, offsetY: 0 } });
        break;
    }
  };

  const remove = (kind: ModifierKind) => {
    switch (kind) {
      case 'textBox': {
        // Hide When Empty is its own modifier: it outlives the box.
        write({ textFit: textFit.hideWhenEmpty ? { hideWhenEmpty: true } : undefined });
        break;
      }
      case 'hideWhenEmpty': {
        const rest = compact({ ...textFit, hideWhenEmpty: undefined });
        write({ textFit: Object.keys(rest).length > 0 ? rest : undefined });
        break;
      }
      case 'autoSize':
        write({ fitToText: undefined });
        break;
      case 'follow':
        write({ follow: undefined });
        break;
      case 'justify':
        write({ justify: undefined });
        break;
      case 'repeater':
        write({ repeater: undefined });
        break;
    }
  };

  const block = (kind: ModifierKind, children?: React.ReactNode) => (
    <div className="modifier-block" key={kind} data-modifier={kind}>
      <div className="modifier-block-header">
        <span className="form-label">{MODIFIER_NAMES[kind].toUpperCase()}</span>
        <button type="button" className="btn-icon-small danger" aria-label={`Remove ${MODIFIER_NAMES[kind]}`} title={`Remove ${MODIFIER_NAMES[kind]}`} disabled={readOnly} onClick={() => remove(kind)}>
          ×
        </button>
      </div>
      {children}
    </div>
  );

  const fit = part.fitToText;
  const writeFit = (patch: Partial<FitToTextSettings>) => fit && write({ fitToText: compact({ ...fit, ...patch }) });
  const follow = part.follow;
  const writeFollow = (patch: Partial<FollowSettings>) => follow && write({ follow: { ...follow, ...patch } });
  const repeater = part.repeater;
  const writeRepeater = (patch: Partial<RepeaterSettings>) => repeater && write({ repeater: compact({ ...repeater, ...patch }) });
  const repeaterLayout = repeater?.layout ?? 'line';

  return (
    <StyleCard title="MODIFIERS" collapsible retainKey="modifiers" badge={active.length > 0 ? String(active.length) : undefined}>
      <p className="matte-section-intro" data-testid="modifiers-intro">
        Modifiers size, place, hide or repeat this layer from other layers, in the editor and in the OGraf graphic.
      </p>
      <div className="form-field-group">
        <select
          className="select-control"
          aria-label="Add modifier"
          value=""
          disabled={readOnly || available.length === 0}
          onChange={(event) => {
            const kind = event.target.value as ModifierKind;
            if (kind) add(kind);
          }}
        >
          <option value="">Add modifier…</option>
          {available.map(({ kind, disabled }) => (
            <option key={kind} value={kind} disabled={Boolean(disabled)}>
              {MODIFIER_NAMES[kind]}{disabled ? ` (${disabled})` : ''}
            </option>
          ))}
        </select>
      </div>

      {active.includes('textBox') && block('textBox', (
        <>
          <p className="matte-section-intro">
            Past the max width the text gets smaller (down to the min size), then narrower; it never leaves the box. 0 means no limit.
          </p>
          <div className="form-field-group">
            <label className="form-label">MAX WIDTH (PX)</label>
            <SmartNumberInput ariaLabel="Text max width" value={textFit.maxWidth ?? 0} min={0} max={10000} deferCommit onChange={(value) => writeTextFit({ maxWidth: limitOrUndefined(value) })} />
          </div>
          <div className="form-field-group">
            <label className="form-label">MIN SIZE (%)</label>
            <SmartNumberInput ariaLabel="Text min size percent" value={Math.round((textFit.minScale ?? 0.5) * 100)} min={5} max={100} deferCommit onChange={(value) => writeTextFit({ minScale: value / 100 === 0.5 ? undefined : value / 100 })} />
          </div>
          <div className="form-field-group">
            <label className="form-label">MAX CHARACTERS</label>
            <SmartNumberInput ariaLabel="Text max characters" value={textFit.maxLength ?? 0} min={0} max={1000} deferCommit onChange={(value) => writeTextFit({ maxLength: limitOrUndefined(Math.round(value)) })} />
          </div>
          <div className="form-field-group">
            <label className="form-label">ALIGN</label>
            <select className="select-control" aria-label="Text align" value={textFit.align ?? 'center'} disabled={readOnly} onChange={(event) => writeTextFit({ align: event.target.value as HorizontalAlign })}>
              {ALIGN_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>
        </>
      ))}

      {active.includes('hideWhenEmpty') && block('hideWhenEmpty', (
        <p className="matte-section-intro">An empty text is hidden, and so is every shape sized to it.</p>
      ))}

      {active.includes('autoSize') && fit && block('autoSize', (
        <>
          <p className="matte-section-intro">
            The width follows the text plus the padding, up to the max width; past it the text gets smaller.
          </p>
          <div className="form-field-group">
            <label className="form-label">TEXT LAYER</label>
            <select className="select-control" aria-label="Fit to text layer" value={fit.textLayerId} disabled={readOnly} onChange={(event) => writeFit({ textLayerId: event.target.value })}>
              {!texts.some((text) => text.id === fit.textLayerId) && <option value={fit.textLayerId}>(missing layer)</option>}
              {texts.map((text) => <option key={text.id} value={text.id}>{text.name || text.id}</option>)}
            </select>
          </div>
          <div className="form-field-group">
            <label className="form-label">GROW FROM</label>
            <select className="select-control" aria-label="Fit grow from" value={fit.anchor ?? 'center'} disabled={readOnly} onChange={(event) => writeFit({ anchor: event.target.value === 'center' ? undefined : event.target.value as HorizontalAlign })}>
              <option value="center">Center (both sides)</option>
              <option value="left">Left edge (grows right)</option>
              <option value="right">Right edge (grows left)</option>
            </select>
          </div>
          <div className="form-field-group">
            <label className="form-label">PADDING (PX)</label>
            <SmartNumberInput ariaLabel="Fit padding" value={fit.padding ?? DEFAULT_PADDING} min={0} max={1000} deferCommit onChange={(value) => writeFit({ padding: value })} />
          </div>
          <div className="form-field-group">
            <label className="form-label">MIN WIDTH (PX)</label>
            <SmartNumberInput ariaLabel="Fit min width" value={fit.minWidth ?? 0} min={0} max={10000} deferCommit onChange={(value) => writeFit({ minWidth: limitOrUndefined(value) })} />
          </div>
          <div className="form-field-group">
            <label className="form-label">MAX WIDTH (PX)</label>
            <SmartNumberInput ariaLabel="Fit max width" value={fit.maxWidth ?? 0} min={0} max={10000} deferCommit onChange={(value) => writeFit({ maxWidth: limitOrUndefined(value) })} />
          </div>
        </>
      ))}

      {active.includes('follow') && follow && block('follow', (
        <>
          <p className="matte-section-intro">
            Sits next to the target's edge and moves when it grows. X is now the gap to that edge.
          </p>
          <div className="form-field-group">
            <label className="form-label">TARGET</label>
            <select className="select-control" aria-label="Follow target" value={follow.targetLayerId} disabled={readOnly} onChange={(event) => writeFollow({ targetLayerId: event.target.value })}>
              {!followTargets.some((target) => target.id === follow.targetLayerId) && <option value={follow.targetLayerId}>(missing layer)</option>}
              {followTargets.map((target) => <option key={target.id} value={target.id}>{target.name || target.id}</option>)}
            </select>
          </div>
          <div className="form-field-group">
            <label className="form-label">SIDE</label>
            <select className="select-control" aria-label="Follow side" value={follow.side ?? 'right'} disabled={readOnly} onChange={(event) => writeFollow({ side: event.target.value as 'left' | 'right' })}>
              <option value="right">Right of the target</option>
              <option value="left">Left of the target</option>
            </select>
          </div>
        </>
      ))}

      {active.includes('justify') && part.justify && block('justify', (
        <>
          <p className="matte-section-intro">
            The group's layers stay aligned on the group's origin as their sizes change.
          </p>
          <div className="form-field-group">
            <label className="form-label">ALIGN</label>
            <select className="select-control" aria-label="Justify align" value={part.justify.horizontal} disabled={readOnly} onChange={(event) => write({ justify: { horizontal: event.target.value as HorizontalAlign } })}>
              {ALIGN_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>
        </>
      ))}

      {active.includes('repeater') && repeater && block('repeater', (
        <>
          <p className="matte-section-intro">
            Copies of this layer, each a step further: offset, turned, scaled, faded and delayed.
          </p>
          <div className="form-field-group">
            <label className="form-label">COUNT</label>
            <SmartNumberInput ariaLabel="Repeater count" value={repeater.count} min={1} max={200} deferCommit onChange={(value) => writeRepeater({ count: Math.max(1, Math.round(value)) })} />
          </div>
          <div className="form-field-group">
            <label className="form-label">LAYOUT</label>
            <select className="select-control" aria-label="Repeater layout" value={repeaterLayout} disabled={readOnly} onChange={(event) => writeRepeater({ layout: event.target.value as RepeaterSettings['layout'] })}>
              <option value="line">Line</option>
              <option value="grid">Grid</option>
              <option value="radial">Ring</option>
            </select>
          </div>
          {repeaterLayout !== 'radial' && (
            <>
              <div className="form-field-group">
                <label className="form-label">OFFSET X (PX)</label>
                <SmartNumberInput ariaLabel="Repeater offset x" value={repeater.offsetX ?? 0} min={-10000} max={10000} deferCommit onChange={(value) => writeRepeater({ offsetX: value })} />
              </div>
              <div className="form-field-group">
                <label className="form-label">OFFSET Y (PX)</label>
                <SmartNumberInput ariaLabel="Repeater offset y" value={repeater.offsetY ?? 0} min={-10000} max={10000} deferCommit onChange={(value) => writeRepeater({ offsetY: value })} />
              </div>
            </>
          )}
          {repeaterLayout === 'grid' && (
            <div className="form-field-group">
              <label className="form-label">COLUMNS</label>
              <SmartNumberInput ariaLabel="Repeater columns" value={repeater.columns ?? repeater.count} min={1} max={200} deferCommit onChange={(value) => writeRepeater({ columns: Math.max(1, Math.round(value)) })} />
            </div>
          )}
          {repeaterLayout === 'radial' && (
            <div className="form-field-group">
              <label className="form-label">RADIUS (PX)</label>
              <SmartNumberInput ariaLabel="Repeater radius" value={repeater.radius ?? 0} min={0} max={10000} deferCommit onChange={(value) => writeRepeater({ radius: value })} />
            </div>
          )}
          <div className="form-field-group">
            <label className="form-label">TURN PER COPY (°)</label>
            <SmartNumberInput ariaLabel="Repeater rotation" value={repeater.rotation ?? 0} min={-360} max={360} deferCommit onChange={(value) => writeRepeater({ rotation: value || undefined })} />
          </div>
          <div className="form-field-group">
            <label className="form-label">SCALE PER COPY (%)</label>
            <SmartNumberInput ariaLabel="Repeater scale percent" value={Math.round((repeater.scale ?? 1) * 100)} min={1} max={400} deferCommit onChange={(value) => writeRepeater({ scale: value === 100 ? undefined : value / 100 })} />
          </div>
          <div className="form-field-group">
            <label className="form-label">FADE PER COPY (%)</label>
            <SmartNumberInput ariaLabel="Repeater fade percent" value={Math.round((repeater.fade ?? 0) * 100)} min={0} max={100} deferCommit onChange={(value) => writeRepeater({ fade: value ? value / 100 : undefined })} />
          </div>
          <div className="form-field-group">
            <label className="form-label">DELAY PER COPY (FRAMES)</label>
            <SmartNumberInput ariaLabel="Repeater delay frames" value={repeater.delay ?? 0} min={0} max={1000} deferCommit onChange={(value) => writeRepeater({ delay: value ? Math.round(value) : undefined })} />
          </div>
        </>
      ))}
    </StyleCard>
  );
};
