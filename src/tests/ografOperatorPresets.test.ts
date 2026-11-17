// @vitest-environment jsdom
/**
 * Playout presets: each layer keeps its value per preset; the export turns
 * them into one "Preset" choice that sets them all at once on air.
 */
import { describe, expect, test } from 'vitest';
import type { CharacterPart } from '../types/animator';
import type { SceneData, SceneLayer } from '../types/composition';
import { compileOGrafPackage } from '../ograf/packageCompiler';
import {
  addPreset, applyPresetTexts, deletePreset, presetLayers, presetNames, renamePreset, sanitizePresetValues, setPresetValue,
} from '../utils/layers/operatorPresets';

type Result = { statusCode: number; statusMessage?: string };
type LiveGraphic = HTMLElement & {
  load: (params: { renderType: string; data?: Record<string, unknown> }) => Promise<Result>;
  playAction: (params?: { skipAnimation?: boolean }) => Promise<unknown>;
  updateAction: (params: { data: Record<string, unknown> }) => Promise<Result>;
};

const part = (id: string, extra: Partial<CharacterPart> = {}): CharacterPart => ({
  id, name: id, type: 'custom_text', textValue: id.toUpperCase(),
  baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
  ...extra,
} as CharacterPart);

describe('playout presets: the layer edits', () => {
  test('a new preset holds every preset layer\'s current value; other layers are untouched', () => {
    const parts = [part('home'), part('logo', { type: 'custom_rect', operatorToggle: true }), part('box', { type: 'custom_rect' })];
    expect(presetLayers(parts).map((layer) => layer.id)).toEqual(['home', 'logo']);
    const next = addPreset(parts, ' Game 1 ');
    expect(next[0].operatorPresets).toEqual([{ name: 'Game 1', text: 'HOME' }]);
    expect(next[1].operatorPresets).toEqual([{ name: 'Game 1', show: true }]);
    expect(next[2]).toBe(parts[2]);
    expect(addPreset(next, 'Game 1')).toBe(next);
    expect(addPreset(next, '   ')).toBe(next);
    expect(addPreset(next, '__proto__')).toBe(next);
  });

  test('set, rename, show in the editor and delete', () => {
    let parts = addPreset(addPreset([part('home'), part('away')], 'A'), 'B');
    expect(presetNames(parts)).toEqual(['A', 'B']);
    parts = setPresetValue(parts, 'home', 'B', { text: 'Chiefs' });
    parts = renamePreset(parts, 'B', 'KC at NE');
    expect(renamePreset(parts, 'A', 'KC at NE')).toBe(parts);
    expect(presetNames(parts)).toEqual(['A', 'KC at NE']);
    const shown = applyPresetTexts(parts, 'KC at NE');
    expect(shown[0].textValue).toBe('Chiefs');
    expect(shown[1]).toBe(parts[1]);
    parts = deletePreset(parts, 'A');
    parts = deletePreset(parts, 'KC at NE');
    expect(parts.every((layer) => layer.operatorPresets === undefined)).toBe(true);
  });

  test('a stored list keeps only well-formed entries', () => {
    expect(sanitizePresetValues([{ name: 'A', text: 'x', show: 'yes' }, { name: 'A', text: 'dup' }, { name: 3 }, null, { name: 'B', show: false }]))
      .toEqual([{ name: 'A', text: 'x' }, { name: 'B', show: false }]);
    expect(sanitizePresetValues('nope')).toBeUndefined();
    expect(sanitizePresetValues([{ name: '' }])).toBeUndefined();
  });
});

const layer = (id: string, extra: Partial<SceneLayer>): SceneLayer => ({
  id, name: id, type: 'custom_text', fontSize: 72, x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1,
  visible: true, zIndex: 1, fillColor: '#ffffff', strokeColor: '#000000', ...extra,
} as SceneLayer);

const scene: SceneData = {
  version: 1, coordinateSystem: 'project-unit-center-v1', name: 'Match',
  width: 1920, height: 1080, fps: 30, totalFrames: 30,
  layers: [
    layer('home', { name: 'Home', textValue: 'Home team', operatorPresets: [{ name: 'Game 1', text: 'Chiefs' }, { name: 'Game 2', text: 'Packers' }] }),
    layer('score', { name: 'Score', textValue: '0', zIndex: 2, operatorCounter: true, operatorPresets: [{ name: 'Game 1', text: '7' }, { name: 'Game 2', text: 'seven' }] }),
    layer('badge', { name: 'Badge', type: 'custom_rect', zIndex: 3, operatorToggle: true, operatorPresets: [{ name: 'Game 2', show: false }] }),
  ],
  tracks: [],
};

const mount = (data: SceneData): LiveGraphic => {
  const source = compileOGrafPackage(data).files.find((file) => file.path === 'graphic.mjs')?.content || '';
  const Graphic = new Function('HTMLElement', `${source.replace('export default class Graphic', 'return class Graphic').replaceAll('import.meta.url', 'location.href')}`)(HTMLElement) as new () => LiveGraphic;
  const tag = `x-ograf-operator-presets-${Math.random().toString(36).slice(2)}`;
  customElements.define(tag, Graphic);
  const graphic = document.createElement(tag) as LiveGraphic;
  document.body.appendChild(graphic);
  return graphic;
};

const shown = (graphic: Element, id: string) => graphic.querySelector(`[data-layer-id="${id}"] text`)?.textContent ?? '';
const drawn = (graphic: Element, id: string) => graphic.querySelector(`[data-layer-id="${id}"]`) !== null;

describe('playout presets in the OGraf package', () => {
  test('one Preset choice, None by default, listing the presets in order', () => {
    expect(compileOGrafPackage(scene).manifest.schema.properties.preset).toEqual({
      type: 'string', gddType: 'select', title: 'Preset', label: 'Preset',
      description: 'Sets the values saved in the chosen preset. Choose None to use the fields as typed.',
      enum: ['', 'Game 1', 'Game 2'],
      gddOptions: { labels: { '': 'None', 'Game 1': 'Game 1', 'Game 2': 'Game 2' } },
      default: '',
    });
  });

  test('a chosen preset sets its values over the typed fields; None leaves the fields; an unknown name is refused', async () => {
    const graphic = mount(scene);
    expect((await graphic.load({ renderType: 'realtime' })).statusCode).toBe(200);
    await graphic.playAction({ skipAnimation: true });
    expect(shown(graphic, 'home')).toBe('Home team');

    expect((await graphic.updateAction({ data: { preset: 'Game 1', text_home: 'Typed' } })).statusCode).toBe(200);
    expect(shown(graphic, 'home')).toBe('Chiefs');
    expect(shown(graphic, 'score')).toBe('7');
    expect(drawn(graphic, 'badge')).toBe(true);

    // A counter only takes a whole number, so "seven" is not exported.
    expect((await graphic.updateAction({ data: { preset: 'Game 2' } })).statusCode).toBe(200);
    expect(shown(graphic, 'home')).toBe('Packers');
    expect(shown(graphic, 'score')).toBe('7');
    expect(drawn(graphic, 'badge')).toBe(false);

    expect((await graphic.updateAction({ data: { preset: '', text_home: 'Typed' } })).statusCode).toBe(200);
    expect(shown(graphic, 'home')).toBe('Typed');

    expect(await graphic.updateAction({ data: { preset: 'Game 9' } })).toEqual({ statusCode: 400, statusMessage: 'Unknown preset: Game 9' });
  });

  test('a scene without presets has no Preset field', () => {
    const plain: SceneData = { ...scene, layers: scene.layers.map(({ operatorPresets: _ignored, ...rest }) => rest as SceneLayer) };
    expect(compileOGrafPackage(plain).manifest.schema.properties.preset).toBeUndefined();
  });
});
