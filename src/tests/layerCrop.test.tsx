import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { CharacterPart } from '../types/animator';
import type { SceneData, SceneLayer } from '../types/composition';
import { cropClipMarkup, isLayerCrop } from '../utils/layers/layerCrop';
import { generateGraphicModule } from '../ograf/runtimeTemplate';
import { renderOGrafSvg } from '../ograf/svgRenderer';
import { evaluateOGrafScene } from '../ograf/evaluation';
import { runtimeLayerCrop } from '../ograf/runtimeSnippets';
import { validateImportedDocument } from '../utils/persistence/importValidation';
import { LayerCropCard } from '../components/Inspector/sections/style/LayerCropCard';

describe('the crop rectangle', () => {
  it('is a clip path in the layer units, and only for a real rectangle', () => {
    expect(cropClipMarkup({ x: -60, y: -30, width: 60, height: 60 }, 'c')).toBe('<clipPath id="c" clipPathUnits="userSpaceOnUse"><rect x="-60" y="-30" width="60" height="60"></rect></clipPath>');
    expect(cropClipMarkup(undefined, 'c')).toBe('');
    for (const bad of [{ x: 0, y: 0, width: 0, height: 5 }, { x: 0, y: 0, width: 5 }, { x: 'a', y: 0, width: 5, height: 5 }]) expect(isLayerCrop(bad)).toBe(false);
  });
});

const rect = (crop?: unknown): SceneLayer => ({
  id: 'card', name: 'Card', type: 'custom_rect', x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, visible: true, zIndex: 1,
  fillColor: '#ff0000', strokeColor: '#000000', ...(crop ? { crop } : {}),
} as SceneLayer);
const scene = (layer: SceneLayer): SceneData => ({
  version: 1, coordinateSystem: 'project-unit-center-v1', name: 'Crop', width: 400, height: 300, fps: 30, totalFrames: 30,
  layers: [layer], tracks: [{ partId: layer.id, channels: {} as never }],
} as SceneData);

type Generated = HTMLElement & { _render: () => void };
let counter = 0;
const runtimeMarkup = (authored: SceneData): string => {
  const source = generateGraphicModule(authored);
  const Graphic = new Function('HTMLElement', source.replace('export default class Graphic', 'return class Graphic').replaceAll('import.meta.url', 'location.href'))(HTMLElement) as new () => Generated;
  counter += 1;
  customElements.define(`x-layer-crop-${counter}`, Graphic);
  const graphic = document.createElement(`x-layer-crop-${counter}`) as Generated;
  graphic._render();
  return graphic.innerHTML;
};
const cropRect = (markup: string) => (/<clipPath id="[^"]*crop[^"]*"[^>]*>(<rect[^>]*>)/iu.exec(markup) ?? [])[1];

describe('every exporter cuts the same area', () => {
  it('static SVG and runtime clip with the crop rectangle; no crop, no clip', () => {
    const crop = { x: -60, y: -30, width: 60, height: 60 };
    const expected = '<rect x="-60" y="-30" width="60" height="60">';
    expect(cropRect(renderOGrafSvg(evaluateOGrafScene(scene(rect(crop)), 0)))).toBe(expected);
    expect(cropRect(runtimeMarkup(scene(rect(crop))))).toBe(expected);
    expect(runtimeMarkup(scene(rect()))).not.toMatch(/crop/iu);
  });

  it('the runtime runs the embedded source of the same helper', () => {
    const embedded = new Function(`return ${runtimeLayerCrop()}`)() as { cropClipMarkup: typeof cropClipMarkup };
    expect(embedded.cropClipMarkup({ x: 1, y: 2, width: 3, height: 4 }, 'k')).toBe(cropClipMarkup({ x: 1, y: 2, width: 3, height: 4 }, 'k'));
  });

  it('the scene file keeps a crop and refuses an empty one', () => {
    expect(validateImportedDocument(JSON.stringify(scene(rect({ x: 0, y: 0, width: 10, height: 10 })))).ok).toBe(true);
    expect(validateImportedDocument(JSON.stringify(scene(rect({ x: 0, y: 0, width: -1, height: 10 })))).ok).toBe(false);
  });
});

describe('the CROP card', () => {
  const part = (extra: Partial<CharacterPart> = {}): CharacterPart => ({
    id: 'r', name: 'R', type: 'custom_rect', zIndex: 1, fillColor: '#f00',
    baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 }, ...extra,
  } as CharacterPart);

  it('turns the crop on at the layer bounds, trims a side and turns it off', () => {
    const change = vi.fn();
    const { rerender } = render(<LayerCropCard part={part()} onPartPropChange={change} />);
    fireEvent.click(screen.getByRole('button', { name: 'Expand CROP' }));
    fireEvent.click(screen.getByLabelText('Crop Enabled'));
    // A rectangle is 120 × 60 around its origin.
    expect(change).toHaveBeenLastCalledWith('crop', { x: -60, y: -30, width: 120, height: 60 });
    rerender(<LayerCropCard part={part({ crop: { x: -60, y: -30, width: 120, height: 60 } })} onPartPropChange={change} />);
    const right = screen.getByLabelText('Crop right') as HTMLInputElement;
    fireEvent.focus(right);
    fireEvent.change(right, { target: { value: '60' } });
    fireEvent.keyDown(right, { key: 'Enter' });
    expect(change).toHaveBeenLastCalledWith('crop', { x: -60, y: -30, width: 60, height: 60 });
    fireEvent.click(screen.getByLabelText('Crop Enabled'));
    expect(change).toHaveBeenLastCalledWith('crop', undefined);
  });
});
