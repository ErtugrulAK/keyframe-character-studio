import React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { StagePartLayers } from '../components/Canvas/StagePartLayers';
import type { CharacterPart, Track } from '../types/animator';
import { makeEmptyChannels } from '../utils/defaults';

const part = (id: string, overrides: Partial<CharacterPart> = {}): CharacterPart => ({
  id,
  name: id,
  type: 'custom_box',
  zIndex: 1,
  baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
  fillColor: '#fff',
  strokeColor: '#000',
  width: 60,
  height: 60,
  ...overrides,
} as CharacterPart);

const render = (
  resolution: { width: number; height: number },
  transform: Partial<CharacterPart['baseTransform']> = {},
  partOverrides: Partial<CharacterPart> = {},
) => renderToString(
  <StagePartLayers
    sortedParts={[part('A', { ...partOverrides, baseTransform: { ...part('A').baseTransform, ...transform } })]}
    appMode="broadcast"
    broadcastSessionActivated
    broadcastState={{ A: { state: 'visible', progress: 1 } }}
    currentFrame={0}
    selectedPartId={null}
    totalFrames={60}
    onSelect={() => {}}
    onStartTranslateDrag={() => {}}
    tracks={[{ id: 't', partId: 'A', name: 'A', color: '#fff', keyframes: [], channels: makeEmptyChannels(), visible: true, locked: false } as any]}
    customPresets={[]}
    liveStuntsState={{}}
    projectResolution={resolution}
  />,
);

describe('resolution-derived renderer origin', () => {
  it.each([
    [{ width: 1920, height: 1080 }, 'translate(960, 540)'],
    [{ width: 1280, height: 720 }, 'translate(640, 360)'],
    [{ width: 3840, height: 2160 }, 'translate(1920, 1080)'],
    [{ width: 1080, height: 1920 }, 'translate(540, 960)'],
    [{ width: 1000, height: 1000 }, 'translate(500, 500)'],
  ] as const)('maps canonical origin to the project center for %j', (resolution, expected) => {
    expect(render(resolution)).toContain(expected);
  });


  it('preserves authored image placement and dimensions across resolution changes', () => {
    const image = {
      type: 'custom_image' as const,
      imageUrl: 'photo.png',
      width: 320,
      height: 180,
    };
    const wide = render({ width: 1920, height: 1080 }, { x: 300, y: -100 }, image);
    const larger = render({ width: 3840, height: 2160 }, { x: 300, y: -100 }, image);
    const smaller = render({ width: 1280, height: 720 }, { x: 300, y: -100 }, image);
    const portrait = render({ width: 1080, height: 1920 }, { x: 300, y: -100 }, image);

    expect(wide).toContain('translate(1260, 440)');
    expect(larger).toContain('translate(2220, 980)');
    expect(smaller).toContain('translate(940, 260)');
    expect(portrait).toContain('translate(840, 860)');
    for (const html of [wide, larger, smaller, portrait]) {
      expect(html).toContain('width="320"');
      expect(html).toContain('height="180"');
      expect(html).toContain('href="photo.png"');
    }
  });

  it('preserves parent-relative image transforms across resolution changes', () => {
    const parent = part('parent', {
      baseTransform: { x: 100, y: 50, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
    });
    const image = part('image', {
      type: 'custom_image',
      parentId: 'parent',
      imageUrl: 'photo.png',
      width: 320,
      height: 180,
      baseTransform: { x: 20, y: 10, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
    });
    const renderParented = (resolution: { width: number; height: number }) => renderToString(
      <StagePartLayers
        sortedParts={[parent, image]}
        appMode="broadcast"
        broadcastSessionActivated
        broadcastState={{ parent: { state: 'visible', progress: 1 }, image: { state: 'visible', progress: 1 } }}
        currentFrame={0}
        selectedPartId={null}
        totalFrames={60}
        onSelect={() => {}}
        onStartTranslateDrag={() => {}}
        tracks={[
          { id: 'parent-track', partId: 'parent', name: 'Parent', color: '#fff', keyframes: [], channels: makeEmptyChannels(), visible: true, locked: false },
          { id: 'image-track', partId: 'image', name: 'Image', color: '#fff', keyframes: [], channels: makeEmptyChannels(), visible: true, locked: false },
        ] satisfies Track[]}
        customPresets={[]}
        liveStuntsState={{}}
        projectResolution={resolution}
      />,
    );

    const wide = renderParented({ width: 1920, height: 1080 });
    const larger = renderParented({ width: 3840, height: 2160 });
    expect(wide).toContain('translate(1080, 600)');
    expect(larger).toContain('translate(2040, 1140)');
    expect(wide).toContain('width="320"');
    expect(larger).toContain('height="180"');
  });
  it('maps non-zero canonical transforms without rewriting stored values', () => {
    const html = render({ width: 1920, height: 1080 }, { x: 300, y: -100 });
    expect(html).toContain('translate(1260, 440)');
  });

  it('keeps the edit camera output at the historical 600×480 center', () => {
    const html = renderToString(
      <StagePartLayers
        sortedParts={[part('A')]}
        appMode="edit"
        broadcastState={{}}
        currentFrame={0}
        selectedPartId={null}
        totalFrames={60}
        onSelect={() => {}}
        onStartTranslateDrag={() => {}}
        tracks={[]}
        customPresets={[]}
        liveStuntsState={{}}
        projectResolution={{ width: 1080, height: 1920 }}
      />,
    );
    expect(html).toContain('translate(300, 240)');
  });
});
