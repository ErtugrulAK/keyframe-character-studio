/**
 * D4 — the public-controls resolver, pinned directly.
 *
 * V1.1 shipped `resolveOGrafPublicControls` with only indirect coverage
 * (export/package parity). The exclusion rules, id policy and hex
 * normalisation below are the externally visible manifest contract; they
 * now fail here first instead of inside an export golden.
 */

import { describe, expect, it } from 'vitest';
import { resolveOGrafPublicControls } from '../ograf/publicControls';
import type { OGrafAssetPlan, OGrafExportOptions } from '../ograf/types';
import type { SceneData, SceneLayer } from '../types/composition';

const layer = (over: Partial<SceneLayer>): SceneLayer => ({
  id: over.id ?? 'l1',
  name: over.name ?? 'Layer',
  type: over.type ?? 'custom_rect',
  x: 0,
  y: 0,
  rotation: 0,
  scaleX: 1,
  scaleY: 1,
  opacity: 1,
  visible: true,
  zIndex: 1,
  fillColor: '#22d3ee',
  strokeColor: '#101218',
  fillEnabled: true,
  strokeEnabled: false,
  width: 160,
  height: 120,
  ...over,
} as SceneLayer);

const scene = (layers: SceneLayer[]): SceneData => ({
  version: 1,
  coordinateSystem: 'project-unit-center-v1',
  width: 1920,
  height: 1080,
  fps: 30,
  totalFrames: 60,
  layers,
  tracks: [],
});

const options = (over: Partial<OGrafExportOptions> = {}): OGrafExportOptions => over;

const imageAssets: OGrafAssetPlan[] = [
  { source: 'https://cdn.example/logo.png', packagedPath: 'assets/logo.png', kind: 'image' },
];

describe('resolveOGrafPublicControls — automatic fields', () => {
  it('exposes a visible shape fill as a normalized hex color field', () => {
    const result = resolveOGrafPublicControls(
      scene([layer({ fillColor: '#ABC' })]),
      options(),
      [],
    );
    expect(result.colorFields).toHaveLength(1);
    expect(result.colorFields[0].property).toBe('fillColor');
    expect(result.colorFields[0].defaultValue).toBe('#aabbcc');
    expect(result.colorFields[0].id).toBe('fill_l1');
  });

  it('skips disabled fills, malformed colors and non-hex formats', () => {
    const result = resolveOGrafPublicControls(
      scene([
        layer({ id: 'off', fillEnabled: false }),
        layer({ id: 'rgb', fillColor: 'rgb(1,2,3)' }),
        layer({ id: 'none', fillColor: 'transparent' }),
      ]),
      options(),
      [],
    );
    expect(result.colorFields.filter((field) => field.property === 'fillColor')).toHaveLength(0);
  });

  it('offers the stroke field only when the stroke is enabled', () => {
    const result = resolveOGrafPublicControls(
      scene([layer({ id: 'st', strokeEnabled: true, strokeColor: '#ffffff' })]),
      options(),
      [],
    );
    const stroke = result.colorFields.find((field) => field.property === 'strokeColor');
    expect(stroke?.defaultValue).toBe('#ffffff');
    expect(stroke?.title).toBe('Layer Stroke Color');
  });

  it('turns a visible text layer into a text field and keeps the headline id policy', () => {
    const result = resolveOGrafPublicControls(
      scene([
        layer({ id: 'h1', name: 'Headline', type: 'custom_text', textValue: 'Hello' }),
        layer({ id: 't2', name: 'Sub', type: 'custom_text', textValue: 'Bye' }),
      ]),
      options(),
      [],
    );
    expect(result.textFields.map((field) => field.id)).toEqual(['headline', 'text_t2']);
    expect(result.textFields[0].defaultValue).toBe('Hello');
  });

  it('only offers image choices that were actually packaged', () => {
    const result = resolveOGrafPublicControls(
      scene([
        layer({ id: 'img', type: 'custom_image', imageUrl: 'https://cdn.example/logo.png' }),
        layer({ id: 'ext', type: 'custom_image', imageUrl: 'https://elsewhere/x.png' }),
      ]),
      options(),
      imageAssets,
    );
    const packaged = result.imageFields.find((field) => field.layerId === 'img');
    expect(packaged?.defaultValue).toBe('assets/logo.png');
    expect(packaged?.options).toEqual(['assets/logo.png']);
    expect(result.imageFields.some((field) => field.layerId === 'ext')).toBe(false);
  });
});

describe('resolveOGrafPublicControls — exclusions and dedupe', () => {
  it('hides matte sources — the user cannot edit what renders as a mask', () => {
    const result = resolveOGrafPublicControls(
      scene([
        layer({ id: 'matte', type: 'custom_text', textValue: 'M', name: 'Matte' }),
        layer({ id: 'user', trackMatte: { mode: 'alpha', enabled: true, sourceLayerId: 'matte' } as SceneLayer['trackMatte'] }),
      ]),
      options(),
      [],
    );
    expect(result.textFields).toHaveLength(0);
    expect(result.colorFields.every((field) => field.layerId !== 'matte')).toBe(true);
  });

  it('keeps a matte source visible again when the matte is disabled', () => {
    const result = resolveOGrafPublicControls(
      scene([
        layer({ id: 'matte', type: 'custom_text', textValue: 'M', name: 'Matte' }),
        layer({ id: 'user', trackMatte: { mode: 'alpha', enabled: false, sourceLayerId: 'matte' } as SceneLayer['trackMatte'] }),
      ]),
      options(),
      [],
    );
    expect(result.textFields.map((field) => field.layerId)).toEqual(['matte']);
  });

  it('skips invisible layers entirely', () => {
    const result = resolveOGrafPublicControls(
      scene([layer({ id: 'hid', visible: false, type: 'custom_text', textValue: 'x' })]),
      options(),
      [],
    );
    expect(result.textFields).toHaveLength(0);
    expect(result.colorFields).toHaveLength(0);
  });

  it('respects caller-provided fields and their ids — no duplicates, no override', () => {
    const result = resolveOGrafPublicControls(
      scene([layer({ id: 'l1', name: 'Card', type: 'custom_text', textValue: 'auto' })]),
      options({
        publicTextFields: [{ id: 'my_title', title: 'Title', defaultValue: 'fixed', layerId: 'l1' }],
        publicColorFields: [{ id: 'my_fill', title: 'Tint', defaultValue: '#101010', layerId: 'l1', property: 'fillColor' }],
      }),
      [],
    );
    expect(result.textFields).toEqual([{ id: 'my_title', title: 'Title', defaultValue: 'fixed', layerId: 'l1' }]);
    expect(result.colorFields.filter((field) => field.layerId === 'l1' && field.property === 'fillColor')).toHaveLength(1);
  });

  it('suffixes automatic ids that would collide', () => {
    const result = resolveOGrafPublicControls(
      scene([
        layer({ id: 'fill_l1', name: 'A' }),
        layer({ id: 'l1', name: 'B' }),
      ]),
      options({
        publicColorFields: [{ id: 'fill_l1', title: 'Explicit', defaultValue: '#000000', layerId: 'other', property: 'fillColor' }],
      }),
      [],
    );
    const ids = result.colorFields.map((field) => field.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('fill_l1');
  });
});
