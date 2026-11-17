/**
 * Playout presets: named sets of values the operator picks with one choice in
 * the exported OGraf graphic ("Game 1" fills both team names and the score).
 *
 * Each layer carries its own value per preset (`CharacterPart.operatorPresets`),
 * so presets need no project-level state: they are saved, undone and copied
 * with the layer like any other property. The preset list is the union of the
 * names on the layers, in the order they first appear.
 *
 * A preset can set:
 * - `text`: what a text layer shows (a counter only takes a whole number);
 * - `show`: a layer's show/hide switch (`operatorToggle`).
 */
import type { CharacterPart } from '../../types/animator';
import { isPrototypeSensitiveKey } from '../persistence/pathSafety';
import { counterUnavailableReason, counterValueOf } from './operatorCounter';

export interface OperatorPresetValue {
  name: string;
  text?: string;
  show?: boolean;
}

export const MAX_PRESET_NAME_LENGTH = 40;
export const MAX_PRESET_TEXT_LENGTH = 500;

type PresetLayer = Pick<CharacterPart, 'id' | 'name' | 'type' | 'textValue' | 'textEffect' | 'operatorToggle' | 'operatorCounter' | 'operatorPresets'>;

/** A usable preset name, or undefined. */
export const cleanPresetName = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const name = value.trim().slice(0, MAX_PRESET_NAME_LENGTH);
  return name && !isPrototypeSensitiveKey(name) ? name : undefined;
};

/** What a preset may set on this layer. */
export const presetSlotsOf = (part: PresetLayer): { text: boolean; counter: boolean; show: boolean } => {
  const counter = part.operatorCounter === true && !counterUnavailableReason(part);
  return {
    text: part.type === 'custom_text' && !part.textEffect,
    counter,
    show: part.operatorToggle === true,
  };
};

/** Layers a preset can set something on, in layer order. */
export const presetLayers = <P extends PresetLayer>(parts: readonly P[]): P[] => parts.filter((part) => {
  const slots = presetSlotsOf(part);
  return slots.text || slots.show;
});

/** The preset names, in the order they first appear on the layers. */
export const presetNames = (parts: readonly { operatorPresets?: OperatorPresetValue[] }[]): string[] => {
  const names: string[] = [];
  for (const part of parts) {
    for (const entry of part.operatorPresets ?? []) {
      if (!names.includes(entry.name)) names.push(entry.name);
    }
  }
  return names;
};

/** The entries of a stored list that are well formed, first one per name; undefined when none is. */
export const sanitizePresetValues = (value: unknown): OperatorPresetValue[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const entries: OperatorPresetValue[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const record = item as Record<string, unknown>;
    const name = cleanPresetName(record.name);
    if (!name || entries.some((entry) => entry.name === name)) continue;
    entries.push({
      name,
      ...(typeof record.text === 'string' ? { text: record.text.slice(0, MAX_PRESET_TEXT_LENGTH) } : {}),
      ...(typeof record.show === 'boolean' ? { show: record.show } : {}),
    });
  }
  return entries.length > 0 ? entries : undefined;
};

const withEntries = <P extends PresetLayer>(part: P, entries: OperatorPresetValue[]): P => {
  if (entries.length > 0) return { ...part, operatorPresets: entries };
  const { operatorPresets: _dropped, ...rest } = part;
  return rest as P;
};

/** A new preset holding every preset layer's current value. Refused (same array) for a bad or taken name. */
export const addPreset = <P extends PresetLayer>(parts: P[], rawName: string): P[] => {
  const name = cleanPresetName(rawName);
  if (!name || presetNames(parts).includes(name)) return parts;
  const ids = new Set(presetLayers(parts).map((part) => part.id));
  return parts.map((part) => {
    if (!ids.has(part.id)) return part;
    const slots = presetSlotsOf(part);
    const entry: OperatorPresetValue = {
      name,
      ...(slots.text ? { text: part.textValue ?? '' } : {}),
      ...(slots.show ? { show: true } : {}),
    };
    return withEntries(part, [...(part.operatorPresets ?? []), entry]);
  });
};

/** Renames a preset on every layer. Refused (same array) for a bad or taken name. */
export const renamePreset = <P extends PresetLayer>(parts: P[], from: string, rawTo: string): P[] => {
  const to = cleanPresetName(rawTo);
  if (!to || to === from || presetNames(parts).includes(to)) return parts;
  return parts.map((part) => (part.operatorPresets?.some((entry) => entry.name === from)
    ? withEntries(part, part.operatorPresets.map((entry) => (entry.name === from ? { ...entry, name: to } : entry)))
    : part));
};

/** Removes a preset from every layer. */
export const deletePreset = <P extends PresetLayer>(parts: P[], name: string): P[] => parts.map((part) => (
  part.operatorPresets?.some((entry) => entry.name === name)
    ? withEntries(part, part.operatorPresets.filter((entry) => entry.name !== name))
    : part
));

/** Sets one layer's value in one preset (adding the entry if the layer had none). */
export const setPresetValue = <P extends PresetLayer>(parts: P[], layerId: string, name: string, patch: { text?: string; show?: boolean }): P[] => (
  parts.map((part) => {
    if (part.id !== layerId) return part;
    const entries = part.operatorPresets ?? [];
    const text = patch.text === undefined ? undefined : patch.text.slice(0, MAX_PRESET_TEXT_LENGTH);
    const has = entries.some((entry) => entry.name === name);
    const next = has
      ? entries.map((entry) => (entry.name === name ? { ...entry, ...(text !== undefined ? { text } : {}), ...(patch.show !== undefined ? { show: patch.show } : {}) } : entry))
      : [...entries, { name, ...(text !== undefined ? { text } : {}), ...(patch.show !== undefined ? { show: patch.show } : {}) }];
    return withEntries(part, next);
  })
);

/** Shows a preset's texts in the editor (the show/hide values only act on air). */
export const applyPresetTexts = <P extends PresetLayer>(parts: P[], name: string): P[] => parts.map((part) => {
  const entry = part.operatorPresets?.find((candidate) => candidate.name === name);
  if (!entry || entry.text === undefined || !presetSlotsOf(part).text || part.textValue === entry.text) return part;
  if (part.operatorCounter === true && counterValueOf(entry.text) === undefined) return part;
  return { ...part, textValue: entry.text };
});
