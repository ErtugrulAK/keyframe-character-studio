import React, { useEffect } from 'react';
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AnimatorProvider, useAnimator } from '../context/AnimatorContext';
import userEvent from '@testing-library/user-event';

// Dummy consumer to access and manipulate context
const ContextConsumer = ({ callback }: { callback: (ctx: any) => void }) => {
  const ctx = useAnimator();
  useEffect(() => {
    callback(ctx);
  });
  return null;
};

describe('AnimatorContext Integration Tests', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', (cb: any) => setTimeout(() => cb(performance.now()), 16));
    vi.stubGlobal('cancelAnimationFrame', (id: any) => clearTimeout(id));
    vi.stubGlobal('navigator', {
      clipboard: {
        writeText: vi.fn(),
        readText: vi.fn().mockResolvedValue(''),
      }
    });
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);
    vi.spyOn(Storage.prototype, 'setItem');
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('Playback + Timeline: playing advances frames and stopping freezes playback', () => {
    let context: any;
    render(
      <AnimatorProvider>
        <ContextConsumer callback={(ctx) => { context = ctx; }} />
      </AnimatorProvider>
    );

    act(() => {
      context.setIsPlaying(true);
    });

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(context.currentFrame).toBeGreaterThan(0);
    const frameWhilePlaying = context.currentFrame;

    act(() => {
      context.setIsPlaying(false);
    });

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(context.currentFrame).toBe(frameWhilePlaying);
  });

  it('Selection + Inspector: selecting a part updates inspector state and deselection clears it', () => {
    let context: any;
    render(
      <AnimatorProvider>
        <ContextConsumer callback={(ctx) => { context = ctx; }} />
      </AnimatorProvider>
    );

    // Initial state: nothing selected, empty parts
    expect(context.selectedPartId).toBeNull();

    // Create part via toolbar
    act(() => {
      context.addCustomPart('head', 'My Head');
    });

    expect(context.characterParts.length).toBe(1);
    const newPartId = context.characterParts[0].id;
    
    // Auto-selects on creation
    expect(context.selectedPartId).toBe(newPartId);

    // Update via Inspector
    act(() => {
      context.updateCurrentTransform({ x: 100 });
    });

    // Deselect
    act(() => {
      context.handleSelectPart(null, false);
    });
    expect(context.selectedPartId).toBeNull();
  });

  it('Timeline + History: adding/deleting keyframes creates undo history and undo/redo works', () => {
    let context: any;
    render(
      <AnimatorProvider>
        <ContextConsumer callback={(ctx) => { context = ctx; }} />
      </AnimatorProvider>
    );

    expect(context.canUndo).toBe(false);

    // Create a part
    act(() => {
      context.addCustomPart('head', 'My Head');
    });

    // History should record creation
    expect(context.canUndo).toBe(true);
    const partId = context.characterParts[0].id;
    const track = context.tracks[0];

    // Add keyframe
    act(() => {
      context.addKeyframeToTrack(track.id, 10);
    });

    const keyframesCount = context.tracks[0].keyframes.length;

    // Undo keyframe add
    act(() => {
      context.undo();
    });

    expect(context.tracks[0].keyframes.length).toBe(keyframesCount - 1);

    // Redo keyframe add
    act(() => {
      context.redo();
    });

    expect(context.tracks[0].keyframes.length).toBe(keyframesCount);
  });

  it('Clipboard + Timeline: copy, paste, duplicate works while selection remains valid', async () => {
    let context: any;
    render(
      <AnimatorProvider>
        <ContextConsumer callback={(ctx) => { context = ctx; }} />
      </AnimatorProvider>
    );

    // Create part
    act(() => {
      context.addCustomPart('head', 'My Head');
    });

    const initialLength = context.characterParts.length;

    act(() => {
      context.copySelectedPart();
    });
    expect(context.clipboardData).not.toBeNull();

    await act(async () => {
      context.pasteCopiedPart();
    });

    expect(context.characterParts.length).toBe(initialLength + 1);
    
    // Duplicate directly
    await act(async () => {
      context.duplicateSelectedPart();
    });

    expect(context.characterParts.length).toBe(initialLength + 2);
  });

  it('Templates + Serialization: switching templates, saving, importing, exporting', () => {
    let context: any;
    render(
      <AnimatorProvider>
        <ContextConsumer callback={(ctx) => { context = ctx; }} />
      </AnimatorProvider>
    );

    act(() => {
      context.addMotionTemplate('Outro', 'out');
    });
    
    expect(context.motionTemplates.length).toBe(2);

    act(() => {
      context.setActiveTemplateId(context.motionTemplates[1].id);
    });

    expect(context.activeTemplateId).toBe(context.motionTemplates[1].id);

    // Export
    const exportedData = context.exportProject();
    expect(exportedData).toContain('Outro');

    // Import back
    act(() => {
      context.importProject(exportedData);
    });

    // BUG #5: verify the imported templates were actually restored (content,
    // not just count — count would pass even if import left state untouched).
    expect(context.motionTemplates.length).toBe(2);
    expect(context.motionTemplates.some((t: any) => t.name === 'Outro')).toBe(true);
  });

  it('Broadcast: state transitions and animation tick interactions', () => {
    let context: any;
    render(
      <AnimatorProvider>
        <ContextConsumer callback={(ctx) => { context = ctx; }} />
      </AnimatorProvider>
    );

    act(() => {
      context.addCustomPart('head', 'My Head');
    });

    const partId = context.characterParts[0].id;

    act(() => {
      context.setAppMode('broadcast');
    });
    expect(context.appMode).toBe('broadcast');

    act(() => {
      context.triggerBroadcastIn(partId);
    });

    expect(context.broadcastState[partId]).toBeDefined();
    expect(context.broadcastState[partId].state).toBe('animating_in');
  });
});
