import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LiveDirectorPanel } from '../components/Broadcast/LiveDirectorPanel';

const mocks = vi.hoisted(() => ({
  setActiveTemplateId: vi.fn(),
  playNamedSequence: vi.fn(),
  triggerAllBroadcastIn: vi.fn(),
}));

vi.mock('../context/AnimatorContext', () => ({
  useAnimator: () => ({
    sceneTitle: 'Template',
    motionTemplates: [
      { id: 'IN', name: 'IN', type: 'in', durationFrames: 30 },
      { id: 'OUT', name: 'OUT', type: 'out', durationFrames: 45 },
      { id: 'SPECIAL', name: 'SPECIAL', type: 'stunt', durationFrames: 60 },
    ],
    activeTemplateId: 'IN',
    setActiveTemplateId: mocks.setActiveTemplateId,
    playNamedSequence: mocks.playNamedSequence,
    triggerAllBroadcastIn: mocks.triggerAllBroadcastIn,
  }),
}));

describe('LiveDirectorPanel — named sequence trigger wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    ['IN', 30],
    ['OUT', 45],
    ['SPECIAL', 60],
  ])('selects and plays %s with its authored duration', (sequenceId, durationFrames) => {
    render(<LiveDirectorPanel />);

    fireEvent.click(screen.getByRole('button', { name: sequenceId }));

    expect(mocks.setActiveTemplateId).toHaveBeenCalledWith(sequenceId);
    expect(mocks.playNamedSequence).toHaveBeenCalledWith(sequenceId, durationFrames);
    expect(mocks.triggerAllBroadcastIn).not.toHaveBeenCalled();
  });

  it('replays the same sequence and switches arbitrary sequence identities independently', () => {
    render(<LiveDirectorPanel />);

    fireEvent.click(screen.getByRole('button', { name: 'SPECIAL' }));
    fireEvent.click(screen.getByRole('button', { name: 'SPECIAL' }));
    fireEvent.click(screen.getByRole('button', { name: 'OUT' }));

    expect(mocks.playNamedSequence.mock.calls).toEqual([
      ['SPECIAL', 60],
      ['SPECIAL', 60],
      ['OUT', 45],
    ]);
    expect(mocks.triggerAllBroadcastIn).not.toHaveBeenCalled();
  });
});
