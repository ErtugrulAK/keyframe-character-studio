import React from 'react';
import type { CharacterPart } from '../../../../types/animator';
import type { FitToTextSettings, FollowSettings, HorizontalAlign, RepeaterSettings, TextFitSettings } from '../../../../utils/layers/layoutModifiers';
import { fitTextIds, SHAPE_EXTENTS } from '../../../../utils/layers/layoutModifiers';
import { SHAPE_BOUNDS } from '../../../../ograf/trackMatteMarkup';
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
const MODIFIER_HINTS: Record<ModifierKind, string> = {
  textBox: 'Keeps the text inside a width: it shrinks, then stops.',
  hideWhenEmpty: 'Hides the text, and every shape sized to it, when it is empty.',
  autoSize: 'The width follows the texts on it, plus padding.',
  follow: "Sits next to another layer's edge and moves as it grows or moves.",
  justify: "Keeps the group's layers aligned on its origin as they resize.",
  repeater: 'Copies of this layer, each a step further.',
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

/** Whether a text's anchor point lies inside a shape's box (same parent, the shape unturned). */
const liesOn = (text: CharacterPart, shape: CharacterPart): boolean => {
  const bounds = SHAPE_BOUNDS[shape.type];
  if (!bounds || !sameParent(text, shape)) return false;
  const { x, y, scaleX, scaleY } = shape.baseTransform;
  const dx = (text.baseTransform.x - x) / (Math.abs(scaleX) || 1);
  const dy = (text.baseTransform.y - y) / (Math.abs(scaleY) || 1);
  return dx >= bounds.minX && dx <= bounds.maxX && dy >= bounds.minY && dy <= bounds.maxY;
};

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
  // Every modifier this layer can take, switched on or off; one it cannot
  // take yet says why.
  const offered: Array<{ kind: ModifierKind; on: boolean; unavailable?: string }> = [];
  if (isText) offered.push({ kind: 'textBox', on: hasTextBox });
  if (isText) offered.push({ kind: 'hideWhenEmpty', on: Boolean(part.textFit?.hideWhenEmpty) });
  if (isSizable) offered.push({ kind: 'autoSize', on: Boolean(part.fitToText), unavailable: texts.length === 0 ? 'Needs a text layer in the scene.' : undefined });
  if (!isGroup) offered.push({ kind: 'follow', on: Boolean(part.follow), unavailable: followTargets.length === 0 ? 'Needs another layer at the same level.' : undefined });
  if (isGroup) offered.push({ kind: 'justify', on: Boolean(part.justify) });
  if (!isGroup && part.type !== 'mograph_cloner' && part.type !== 'particle_system') offered.push({ kind: 'repeater', on: Boolean(part.repeater) });
  const activeCount = offered.filter((entry) => entry.on).length;

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
        // Every text drawn on the shape (a title and a subtitle), top first;
        // else the nearest text above it, else the first one. The shape's
        // width today is its maximum, so nothing grows past what was drawn.
        const onShape = texts.filter((text) => liesOn(text, part)).sort((a, b) => a.baseTransform.y - b.baseTransform.y);
        const above = texts.filter((text) => text.zIndex > part.zIndex).sort((a, b) => a.zIndex - b.zIndex)[0] ?? texts[0];
        const [first, ...extra] = onShape.length > 0 ? onShape : [above];
        const extent = SHAPE_EXTENTS[part.type];
        const width = Math.round((extent ? extent.maxX - extent.minX : 120) * Math.abs(part.baseTransform.scaleX || 1));
        write({ fitToText: compact({ textLayerId: first.id, extraTextLayerIds: extra.length > 0 ? extra.map((text) => text.id) : undefined, padding: DEFAULT_PADDING, maxWidth: width }) });
        break;
      }
      case 'follow': {
        const target = followTargets.find((candidate) => candidate.type === 'custom_text') ?? followTargets[0];
        write({ follow: { targetLayerId: target.id, side: 'right', vertical: true } });
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

  const fit = part.fitToText;
  const writeFit = (patch: Partial<FitToTextSettings>) => fit && write({ fitToText: compact({ ...fit, ...patch }) });
  const follow = part.follow;
  const writeFollow = (patch: Partial<FollowSettings>) => follow && write({ follow: { ...follow, ...patch } });
  const repeater = part.repeater;
  const writeRepeater = (patch: Partial<RepeaterSettings>) => repeater && write({ repeater: compact({ ...repeater, ...patch }) });
  const repeaterLayout = repeater?.layout ?? 'line';

  const fitIds = fit ? fitTextIds(fit) : [];
  /** Turns one text on or off for Auto Size; the last one stays. */
  const toggleFitText = (id: string, on: boolean) => {
    if (!fit) return;
    const ids = on ? [...fitIds, id] : fitIds.filter((candidate) => candidate !== id);
    if (ids.length === 0) return;
    const [textLayerId, ...extra] = ids;
    write({ fitToText: compact({ ...fit, textLayerId, extraTextLayerIds: extra.length > 0 ? extra : undefined }) });
  };
  const missingFitIds = fitIds.filter((id) => !texts.some((text) => text.id === id));
  const FIT_TEXTS_FIELD = fit && (
    <div className="appearance-field matte-span-full">
      <span className="appearance-field-label">SIZE TO TEXTS</span>
      <div className="modifier-text-list" role="group" aria-label="Fit to text layers">
        {texts.map((text) => {
          const checked = fitIds.includes(text.id);
          return (
            <label key={text.id} className="modifier-text-option" title={text.textValue || ''}>
              <input
                type="checkbox"
                aria-label={`Size to ${text.name || text.id}`}
                checked={checked}
                disabled={readOnly || (checked && fitIds.length === 1)}
                onChange={(event) => toggleFitText(text.id, event.target.checked)}
              />
              <span>{text.name || text.id}</span>
            </label>
          );
        })}
        {missingFitIds.map((id) => <span key={id} className="modifier-text-option is-missing">(missing layer)</span>)}
      </div>
      {fitIds.length > 1 && <span className="modifier-note">The widest checked text sets the width.</span>}
    </div>
  );

  const field = (label: string, control: React.ReactNode, options: { wide?: boolean; title?: string } = {}) => (
    <div className={`appearance-field${options.wide ? ' matte-span-full' : ''}`} title={options.title}>
      <span className="appearance-field-label">{label}</span>
      {control}
    </div>
  );
  const NO_LIMIT = '0 means no limit';

  const settingsOf = (kind: ModifierKind): React.ReactNode => {
    switch (kind) {
      case 'textBox':
        return (
          <>
            {field('MAX WIDTH (PX)', <SmartNumberInput ariaLabel="Text max width" value={textFit.maxWidth ?? 0} min={0} max={10000} deferCommit onChange={(value) => writeTextFit({ maxWidth: limitOrUndefined(value) })} />, { title: NO_LIMIT })}
            {field('MIN SIZE (%)', <SmartNumberInput ariaLabel="Text min size percent" value={Math.round((textFit.minScale ?? 0.5) * 100)} min={5} max={100} deferCommit onChange={(value) => writeTextFit({ minScale: value / 100 === 0.5 ? undefined : value / 100 })} />, { title: 'How small the text may get before it is cut' })}
            {field('MAX CHARACTERS', <SmartNumberInput ariaLabel="Text max characters" value={textFit.maxLength ?? 0} min={0} max={1000} deferCommit onChange={(value) => writeTextFit({ maxLength: limitOrUndefined(Math.round(value)) })} />, { title: NO_LIMIT })}
            {field('ALIGN', (
              <select className="select-control" aria-label="Text align" value={textFit.align ?? 'center'} disabled={readOnly} onChange={(event) => writeTextFit({ align: event.target.value as HorizontalAlign })}>
                {ALIGN_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            ))}
          </>
        );
      case 'autoSize':
        return fit && (
          <>
            {FIT_TEXTS_FIELD}
            {field('GROW FROM', (
              <select className="select-control" aria-label="Fit grow from" value={fit.anchor ?? 'center'} disabled={readOnly} onChange={(event) => writeFit({ anchor: event.target.value === 'center' ? undefined : event.target.value as HorizontalAlign })}>
                <option value="center">Center (both sides)</option>
                <option value="left">Left edge (grows right)</option>
                <option value="right">Right edge (grows left)</option>
              </select>
            ), { wide: true })}
            {field('PADDING (PX)', <SmartNumberInput ariaLabel="Fit padding" value={fit.padding ?? DEFAULT_PADDING} min={0} max={1000} deferCommit onChange={(value) => writeFit({ padding: value })} />)}
            {field('MIN WIDTH (PX)', <SmartNumberInput ariaLabel="Fit min width" value={fit.minWidth ?? 0} min={0} max={10000} deferCommit onChange={(value) => writeFit({ minWidth: limitOrUndefined(value) })} />, { title: NO_LIMIT })}
            {field('MAX WIDTH (PX)', <SmartNumberInput ariaLabel="Fit max width" value={fit.maxWidth ?? 0} min={0} max={10000} deferCommit onChange={(value) => writeFit({ maxWidth: limitOrUndefined(value) })} />, { title: `${NO_LIMIT}; past it the text gets smaller` })}
          </>
        );
      case 'follow':
        return follow && (
          <>
            {field('TARGET', (
              <select className="select-control" aria-label="Follow target" value={follow.targetLayerId} disabled={readOnly} onChange={(event) => writeFollow({ targetLayerId: event.target.value })}>
                {!followTargets.some((target) => target.id === follow.targetLayerId) && <option value={follow.targetLayerId}>(missing layer)</option>}
                {followTargets.map((target) => <option key={target.id} value={target.id}>{target.name || target.id}</option>)}
              </select>
            ), { wide: true })}
            {field('SIDE', (
              <select className="select-control" aria-label="Follow side" value={follow.side ?? 'right'} disabled={readOnly} onChange={(event) => writeFollow({ side: event.target.value as 'left' | 'right' })}>
                <option value="right">Right of the target</option>
                <option value="left">Left of the target</option>
              </select>
            ), { wide: true })}
            <label className="modifier-text-option matte-span-full">
              <input
                type="checkbox"
                aria-label="Follow up and down"
                checked={follow.vertical === true}
                disabled={readOnly}
                onChange={(event) => writeFollow({ vertical: event.target.checked || undefined })}
              />
              <span>Also follow up and down</span>
            </label>
            <p className="modifier-note matte-span-full">
              {follow.vertical === true
                ? 'X is now the gap to the target’s edge, Y the offset from the target.'
                : 'X is now the gap to the target’s edge.'}
            </p>
          </>
        );
      case 'justify':
        return part.justify && field('ALIGN', (
          <select className="select-control" aria-label="Justify align" value={part.justify.horizontal} disabled={readOnly} onChange={(event) => write({ justify: { horizontal: event.target.value as HorizontalAlign } })}>
            {ALIGN_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        ));
      case 'repeater':
        return repeater && (
          <>
            {field('COUNT', <SmartNumberInput ariaLabel="Repeater count" value={repeater.count} min={1} max={200} deferCommit onChange={(value) => writeRepeater({ count: Math.max(1, Math.round(value)) })} />)}
            {field('LAYOUT', (
              <select className="select-control" aria-label="Repeater layout" value={repeaterLayout} disabled={readOnly} onChange={(event) => writeRepeater({ layout: event.target.value as RepeaterSettings['layout'] })}>
                <option value="line">Line</option>
                <option value="grid">Grid</option>
                <option value="radial">Ring</option>
              </select>
            ))}
            {repeaterLayout !== 'radial' && field('OFFSET X (PX)', <SmartNumberInput ariaLabel="Repeater offset x" value={repeater.offsetX ?? 0} min={-10000} max={10000} deferCommit onChange={(value) => writeRepeater({ offsetX: value })} />)}
            {repeaterLayout !== 'radial' && field('OFFSET Y (PX)', <SmartNumberInput ariaLabel="Repeater offset y" value={repeater.offsetY ?? 0} min={-10000} max={10000} deferCommit onChange={(value) => writeRepeater({ offsetY: value })} />)}
            {repeaterLayout === 'grid' && field('COLUMNS', <SmartNumberInput ariaLabel="Repeater columns" value={repeater.columns ?? repeater.count} min={1} max={200} deferCommit onChange={(value) => writeRepeater({ columns: Math.max(1, Math.round(value)) })} />)}
            {repeaterLayout === 'radial' && field('RADIUS (PX)', <SmartNumberInput ariaLabel="Repeater radius" value={repeater.radius ?? 0} min={0} max={10000} deferCommit onChange={(value) => writeRepeater({ radius: value })} />)}
            {field('TURN / COPY (°)', <SmartNumberInput ariaLabel="Repeater rotation" value={repeater.rotation ?? 0} min={-360} max={360} deferCommit onChange={(value) => writeRepeater({ rotation: value || undefined })} />)}
            {field('SCALE / COPY (%)', <SmartNumberInput ariaLabel="Repeater scale percent" value={Math.round((repeater.scale ?? 1) * 100)} min={1} max={400} deferCommit onChange={(value) => writeRepeater({ scale: value === 100 ? undefined : value / 100 })} />)}
            {field('FADE / COPY (%)', <SmartNumberInput ariaLabel="Repeater fade percent" value={Math.round((repeater.fade ?? 0) * 100)} min={0} max={100} deferCommit onChange={(value) => writeRepeater({ fade: value ? value / 100 : undefined })} />)}
            {field('DELAY / COPY (FR)', <SmartNumberInput ariaLabel="Repeater delay frames" value={repeater.delay ?? 0} min={0} max={1000} deferCommit onChange={(value) => writeRepeater({ delay: value ? Math.round(value) : undefined })} />)}
          </>
        );
      default:
        return null;
    }
  };

  return (
    <StyleCard key={`modifiers:${part.id}`} title="MODIFIERS" collapsible retainKey={`modifiers:${part.id}`} badge={activeCount > 0 ? String(activeCount) : undefined}>
      <div className="modifier-list" data-testid="modifiers-list">
        {offered.map(({ kind, on, unavailable }) => {
          const settings = on ? settingsOf(kind) : null;
          const checkboxId = `modifier-${kind}-${part.id}`;
          return (
            <div key={kind} className={`modifier-group${on ? ' is-on' : ''}`} data-modifier={kind}>
              <div className="modifier-group-header">
                <input
                  id={checkboxId}
                  type="checkbox"
                  aria-label={`${MODIFIER_NAMES[kind]} modifier`}
                  checked={on}
                  disabled={readOnly || (!on && Boolean(unavailable))}
                  onChange={(event) => (event.target.checked ? add(kind) : remove(kind))}
                />
                <label htmlFor={checkboxId} className="modifier-group-title">
                  <span className="modifier-group-name">{MODIFIER_NAMES[kind].toUpperCase()}</span>
                  <span className="modifier-group-hint">{!on && unavailable ? unavailable : MODIFIER_HINTS[kind]}</span>
                </label>
              </div>
              {settings && <div className="modifier-group-fields">{settings}</div>}
            </div>
          );
        })}
      </div>
    </StyleCard>
  );
};
