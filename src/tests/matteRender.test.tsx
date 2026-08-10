/**
 * M11 Step 2B — StagePartLayers track matte render integration.
 *
 * Behavior-level (renderToString) checks:
 *   - matte target gets clip-path="url(#kcs-clip-{sourceId})"
 *   - ONE clipPath per source in <defs>, shared by multiple targets
 *   - enabled=false → no clip
 *   - missing source → no clip, no crash
 *   - matte source itself still renders normally
 *   - no matte → no clip defs at all
 */
import React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, it, expect } from 'vitest';
import { StagePartLayers } from '../components/Canvas/StagePartLayers';
import { makeEmptyChannels } from '../utils/defaults';
import { matteClipPathId } from '../utils/matte';
import type { CharacterPart, Track } from '../types/animator';

function makePart(id: string, type: string, matte?: CharacterPart['matte']): CharacterPart {
  return {
    id,
    type,
    name: id,
    zIndex: 1,
    baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
    fillColor: '#ff0000',
    strokeColor: '#101218',
    matte,
  } as CharacterPart;
}

function makeTrack(partId: string): Track {
  return {
    id: `t_${partId}`, partId, name: 'T', color: '#f00', visible: true,
    keyframes: [], channels: makeEmptyChannels(),
  } as Track;
}

function renderStage(parts: CharacterPart[]) {
  const tracks = parts.map((p) => makeTrack(p.id));
  return renderToString(
    <StagePartLayers
      sortedParts={parts}
      appMode="edit"
      broadcastState={{}}
      currentFrame={0}
      selectedPartId={null}
      totalFrames={60}
      onSelect={() => {}}
      onStartTranslateDrag={() => {}}
      tracks={tracks}
      customPresets={[]}
      liveStuntsState={{}}
    />
  );
}

describe('StagePartLayers — track matte render', () => {
  it('applies clip-path to the matte target and defines the clip', () => {
    const source = makePart('src', 'custom_box');
    const target = makePart('tgt', 'custom_circle', { sourcePartId: 'src', mode: 'clip' });
    const html = renderStage([source, target]);

    expect(html).toContain(`<clipPath id="${matteClipPathId('src')}"`);
    expect(html).toContain(`clip-path="url(#${matteClipPathId('src')})"`);
  });

  it('renders the matte source normally (its own <g> is present)', () => {
    const source = makePart('src', 'custom_box');
    const target = makePart('tgt', 'custom_circle', { sourcePartId: 'src', mode: 'clip' });
    const html = renderStage([source, target]);

    // Source still renders its shape (box rect) — not hidden, not re-parented
    expect(html).toContain('width="60"');
  });

  it('one source shared by multiple targets → ONE clipPath, two clip-path refs', () => {
    const source = makePart('src', 'custom_box');
    const targetA = makePart('tgtA', 'custom_circle', { sourcePartId: 'src', mode: 'clip' });
    const targetB = makePart('tgtB', 'custom_rect', { sourcePartId: 'src', mode: 'clip' });
    const html = renderStage([source, targetA, targetB]);

    const clipDefs = html.match(/<clipPath id="kcs-clip-src"/g);
    expect(clipDefs).toHaveLength(1);
    const refs = html.match(/clip-path="url\(#kcs-clip-src\)"/g);
    expect(refs).toHaveLength(2);
  });

  it('enabled=false → target renders WITHOUT clip', () => {
    const source = makePart('src', 'custom_box');
    const target = makePart('tgt', 'custom_circle', { sourcePartId: 'src', mode: 'clip', enabled: false });
    const html = renderStage([source, target]);

    expect(html).not.toContain(`clip-path="url(#${matteClipPathId('src')})"`);
    expect(html).not.toContain(`<clipPath id="${matteClipPathId('src')}"`);
  });

  it('missing source → no crash, target renders WITHOUT clip', () => {
    const target = makePart('tgt', 'custom_circle', { sourcePartId: 'ghost_source', mode: 'clip' });
    const html = renderStage([target]);

    expect(html).toContain('r="30"'); // target still renders
    expect(html).not.toContain('clip-path=');
  });

  it('freeform source → no clip (deferred), target renders normally', () => {
    const source = makePart('src', 'custom_freeform');
    const target = makePart('tgt', 'custom_circle', { sourcePartId: 'src', mode: 'clip' });
    const html = renderStage([source, target]);

    expect(html).toContain('r="30"');
    expect(html).not.toContain('clip-path=');
  });

  it('no matte anywhere → no clipPath defs', () => {
    const a = makePart('a', 'custom_box');
    const b = makePart('b', 'custom_circle');
    const html = renderStage([a, b]);

    expect(html).not.toContain('<clipPath');
    expect(html).not.toContain('clip-path=');
  });
});
