import React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { StagePartLayers } from '../components/Canvas/StagePartLayers';
import type { CharacterPart, Track } from '../types/animator';
import type { NamedSequenceRuntimeState } from '../utils/broadcastEngine';
import { makeEmptyChannels } from '../utils/defaults';

const makePart = (id: string, overrides: Partial<CharacterPart> = {}): CharacterPart => ({
  id,
  name: id,
  type: 'custom_box',
  zIndex: 1,
  baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
  fillColor: '#ffffff',
  ...overrides,
} as CharacterPart);

const makeSequenceTrack = (
  partId: string,
  channel: 'x' | 'y',
  start: number,
  end: number,
  sequenceId = 'SPECIAL',
): Track => {
  const channels = makeEmptyChannels();
  channels[channel] = [
    { id: `${partId}-${channel}-0`, frame: 0, value: start, easing: 'linear', templateId: sequenceId },
    { id: `${partId}-${channel}-30`, frame: 30, value: end, easing: 'linear', templateId: sequenceId },
  ];
  return {
    id: `track-${partId}`,
    partId,
    name: partId,
    color: '#ffffff',
    visible: true,
    keyframes: [],
    channels,
  } as Track;
};

const renderBroadcastFrame = (
  parts: CharacterPart[],
  tracks: Track[],
  namedSequenceRuntime: NamedSequenceRuntimeState,
): string => renderToString(
  <StagePartLayers
    sortedParts={parts}
    appMode="broadcast"
    broadcastState={Object.fromEntries(parts.map((part) => [part.id, { state: 'visible', progress: 1 }]))}
    namedSequenceRuntime={namedSequenceRuntime}
    currentFrame={999}
    selectedPartId={null}
    totalFrames={30}
    onSelect={() => {}}
    onStartTranslateDrag={() => {}}
    tracks={tracks}
    customPresets={[]}
    liveStuntsState={{}}
  />
);

describe('StagePartLayers — named sequence broadcast evaluation', () => {
  it('keeps a new Broadcast session empty until an explicit runtime trigger', () => {
    const part = makePart('A');
    const track = makeSequenceTrack('A', 'x', 100, 300, 'OPEN');
    const before = JSON.stringify(track.channels);
    const commonProps = {
      sortedParts: [part],
      broadcastState: { A: { state: 'animating_in' as const, progress: 0 } },
      namedSequenceRuntime: { sequenceId: null, status: 'idle' as const, frame: 0, durationFrames: 0 },
      currentFrame: 60,
      selectedPartId: null,
      totalFrames: 30,
      onSelect: () => {},
      onStartTranslateDrag: () => {},
      tracks: [track],
      customPresets: [],
      liveStuntsState: {},
    };

    const editHtml = renderToString(<StagePartLayers {...commonProps} appMode="edit" />);
    expect(editHtml).toContain('<rect');

    const initialBroadcastHtml = renderToString(
      <StagePartLayers {...commonProps} appMode="broadcast" broadcastSessionActivated={false} />,
    );
    expect(initialBroadcastHtml).toBe('');

    const activeBroadcastHtml = renderToString(
      <StagePartLayers
        {...commonProps}
        appMode="broadcast"
        broadcastSessionActivated
        namedSequenceRuntime={{ sequenceId: 'OPEN', status: 'playing', frame: 0, durationFrames: 30 }}
      />,
    );
    expect(activeBroadcastHtml).toContain('<rect');
    expect(activeBroadcastHtml).toContain('translate(400, 240)');

    const reenteredBroadcastHtml = renderToString(
      <StagePartLayers {...commonProps} appMode="broadcast" broadcastSessionActivated={false} />,
    );
    expect(reenteredBroadcastHtml).toBe('');
    expect(JSON.stringify(track.channels)).toBe(before);
  });

  it.each([
    ['frame 0', 'playing', 0, 100],
    ['intermediate frame', 'playing', 15, 200],
    ['final holding frame', 'holding', 30, 300],
  ] as const)('renders the selected non-default sequence at %s', (_label, status, frame, expectedX) => {
    const part = makePart('A');
    const html = renderBroadcastFrame(
      [part],
      [makeSequenceTrack('A', 'x', 100, 300)],
      { sequenceId: 'SPECIAL', status, frame, durationFrames: 30 },
    );

    expect(html).toContain(`translate(${300 + expectedX}, 240)`);
  });

  it('uses the same runtime frame for parent composition and matte source/target evaluation', () => {
    const parent = makePart('PARENT');
    const source = makePart('SOURCE', { parentId: 'PARENT' });
    const target = makePart('TARGET', {
      matte: { sourcePartId: 'SOURCE', mode: 'clip', enabled: true },
    });
    const html = renderBroadcastFrame(
      [parent, source, target],
      [
        makeSequenceTrack('PARENT', 'x', 50, 150),
        makeSequenceTrack('SOURCE', 'x', 10, 30),
        makeSequenceTrack('TARGET', 'y', 20, 40),
      ],
      { sequenceId: 'SPECIAL', status: 'playing', frame: 15, durationFrames: 30 },
    );

    expect(html).toContain('translate(420, 240)');
    expect(html).toContain('translate(300, 270)');
    expect(html).toContain('clip-path="url(#kcs-clip-SOURCE)"');
  });

  it('switches between independent canonical sequences and preserves each frame contract', () => {
    const part = makePart('A');
    const inTrack = makeSequenceTrack('A', 'x', 100, 300, 'IN');
    const outKeyframes = makeSequenceTrack('A', 'x', 500, 700, 'OUT').channels.x;
    inTrack.channels.x.push(...outKeyframes);

    for (const [sequenceId, frame, expectedX] of [
      ['IN', 0, 100], ['IN', 15, 200], ['IN', 30, 300],
      ['OUT', 0, 500], ['OUT', 15, 600], ['OUT', 30, 700],
      ['IN', 0, 100],
    ] as const) {
      const html = renderBroadcastFrame(
        [part],
        [inTrack],
        { sequenceId, status: frame === 30 ? 'holding' : 'playing', frame, durationFrames: 30 },
      );
      expect(html).toContain(`translate(${300 + expectedX}, 240)`);
    }
  });

  it('gives an active named sequence precedence over legacy custom_timeline frame overrides', () => {
    const part = makePart('A', {
      inAnimPreset: 'custom_timeline',
      inAnimTimelineStart: 0,
      inAnimTimelineEnd: 30,
    });
    const namedTrack = makeSequenceTrack('A', 'x', 100, 300, 'SPECIAL');
    namedTrack.channels.x.push(...makeSequenceTrack('A', 'x', 1000, 1200, 'Sequence').channels.x);

    const html = renderToString(
      <StagePartLayers
        sortedParts={[part]}
        appMode="broadcast"
        broadcastState={{ A: { state: 'animating_in', progress: 0.5 } }}
        namedSequenceRuntime={{ sequenceId: 'SPECIAL', status: 'playing', frame: 0, durationFrames: 30 }}
        currentFrame={999}
        selectedPartId={null}
        totalFrames={30}
        onSelect={() => {}}
        onStartTranslateDrag={() => {}}
        tracks={[namedTrack]}
        customPresets={[]}
        liveStuntsState={{}}
      />
    );

    expect(html).toContain('translate(400, 240)');
    expect(html).not.toContain('translate(500, 240)');
  });

  it('preserves legacy custom_timeline frame overrides while named sequence runtime is idle', () => {
    const part = makePart('A', {
      inAnimPreset: 'custom_timeline',
      inAnimTimelineStart: 0,
      inAnimTimelineEnd: 30,
    });
    const track = makeSequenceTrack('A', 'x', 1000, 1200, 'Sequence');

    const html = renderToString(
      <StagePartLayers
        sortedParts={[part]}
        appMode="broadcast"
        broadcastState={{ A: { state: 'animating_in', progress: 0.5 } }}
        namedSequenceRuntime={{ sequenceId: null, status: 'idle', frame: 0, durationFrames: 0 }}
        currentFrame={999}
        selectedPartId={null}
        totalFrames={30}
        onSelect={() => {}}
        onStartTranslateDrag={() => {}}
        tracks={[track]}
        customPresets={[]}
        liveStuntsState={{}}
      />
    );

    expect(html).toContain('translate(1400, 240)');
  });
});
