import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { CharacterPart, Track } from '../types/animator';
import { makeEmptyChannels } from '../utils/animation/defaults';

const log: string[] = [];
let tracks: Track[] = [];
vi.mock('../context/useAnimator', () => ({
  useAnimatorSlice: () => ({
    tracks,
    setTracks: (update: (previous: Track[]) => Track[]) => { log.push('tracks'); tracks = update(tracks); },
    currentFrame: 30,
    totalFrames: 60,
    activeTemplateId: 'Sequence',
    startBatchInteraction: () => log.push('start'),
    endBatchInteraction: () => log.push('end'),
  }),
}));
import { MotionPathCard, motionPathCandidates } from '../components/Inspector/sections/style/MotionPathCard';

const pose = { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 };
const part = (id: string, type: CharacterPart['type'], extra: Partial<CharacterPart> = {}): CharacterPart => (
  { id, name: id.toUpperCase(), type, zIndex: 1, baseTransform: pose, ...extra } as CharacterPart
);
const road = part('road', 'custom_freeform');
const nested = part('nested', 'custom_freeform', { parentId: 'box' });
const ball = (extra: Partial<CharacterPart> = {}) => part('ball', 'custom_circle', extra);
const track = (keys: Track['channels']['motionPathProgress'] = []): Track => ({
  id: 'track-ball', partId: 'ball', name: 'Ball', color: '#fff', visible: true, locked: false,
  channels: { ...makeEmptyChannels(), motionPathProgress: keys },
});

const open = () => fireEvent.click(screen.getByRole('button', { name: 'Expand MOTION PATH' }));

describe('the MOTION PATH card', () => {
  beforeEach(() => { log.length = 0; tracks = [track()]; });

  it('offers only other path layers in the same parent', () => {
    expect(motionPathCandidates(ball(), [road, nested, ball(), part('box', 'custom_rect')]).map((item) => item.id)).toEqual(['road']);
    expect(motionPathCandidates(road, [road, nested]).map((item) => item.id)).toEqual([]);
  });

  it('following a path links it and keys 0% at the start and 100% at the end, in one undo step', () => {
    const change = vi.fn();
    render(<MotionPathCard part={ball()} characterParts={[road, ball()]} onPartPropChange={change} />);
    open();
    fireEvent.change(screen.getByLabelText('Follow path'), { target: { value: 'road' } });
    expect(change).toHaveBeenCalledWith('motionPath', { sourcePartId: 'road', progress: 0 });
    expect(tracks[0].channels.motionPathProgress.map((key) => [key.frame, key.value])).toEqual([[0, 0], [60, 1]]);
    expect(log).toEqual(['start', 'tracks', 'end']);
  });

  it('keeps existing progress keys, shows the progress at the playhead and turns orient on', () => {
    tracks = [track([
      { id: 'a', frame: 0, value: 0, easing: 'linear', templateId: 'Sequence' },
      { id: 'b', frame: 60, value: 1, easing: 'linear', templateId: 'Sequence' },
    ])];
    const change = vi.fn();
    render(<MotionPathCard part={ball({ motionPath: { sourcePartId: 'road' } })} characterParts={[road, ball()]} onPartPropChange={change} />);
    open();
    expect((screen.getByLabelText('Path progress') as HTMLInputElement).value).toBe('50');
    fireEvent.click(screen.getByLabelText('Orient to path'));
    expect(change).toHaveBeenLastCalledWith('motionPath', { sourcePartId: 'road', orient: true });
  });

  it('None removes the link and its progress keys together', () => {
    tracks = [track([{ id: 'a', frame: 0, value: 0, easing: 'linear', templateId: 'Sequence' }])];
    const change = vi.fn();
    render(<MotionPathCard part={ball({ motionPath: { sourcePartId: 'road' } })} characterParts={[road, ball()]} onPartPropChange={change} />);
    open();
    fireEvent.change(screen.getByLabelText('Follow path'), { target: { value: '' } });
    expect(change).toHaveBeenLastCalledWith('motionPath', undefined);
    expect(tracks[0].channels.motionPathProgress).toEqual([]);
    expect(log).toEqual(['start', 'tracks', 'end']);
  });

  it('says so when the linked path is gone, instead of moving the layer', () => {
    render(<MotionPathCard part={ball({ motionPath: { sourcePartId: 'gone' } })} characterParts={[road, ball()]} onPartPropChange={vi.fn()} />);
    open();
    expect(screen.getByRole('note').textContent).toMatch(/missing/i);
  });
});
