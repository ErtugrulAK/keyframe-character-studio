import { afterEach, describe, expect, it, vi } from 'vitest';
import { consumeMaskPointsFocusRequest, requestMaskPointsFocus } from '../utils/geometry/maskPointFocus';
import { OUTLINER_COMMAND_EVENT, requestOutlinerCommand, type OutlinerCommand } from '../utils/layers/outlinerCommands';

/**
 * Two transient hand-overs between editor surfaces that never touch scene
 * data: the keyboard's mask-points focus request and the layer tree's
 * command event.
 */
describe('mask point focus request', () => {
  afterEach(() => {
    consumeMaskPointsFocusRequest();
  });

  it('is consumed once: the overlay that mounts next takes focus, a later one does not', () => {
    expect(consumeMaskPointsFocusRequest()).toBe(false);
    requestMaskPointsFocus();
    expect(consumeMaskPointsFocusRequest()).toBe(true);
    expect(consumeMaskPointsFocusRequest()).toBe(false);
  });

  it('several requests before a mount are still one hand-over', () => {
    requestMaskPointsFocus();
    requestMaskPointsFocus();
    expect(consumeMaskPointsFocusRequest()).toBe(true);
    expect(consumeMaskPointsFocusRequest()).toBe(false);
  });
});

describe('outliner commands', () => {
  it('reach the layer tree as a window event carrying the command', () => {
    const heard = vi.fn();
    const listener = (event: Event) => heard((event as CustomEvent<OutlinerCommand>).detail);
    window.addEventListener(OUTLINER_COMMAND_EVENT, listener);
    requestOutlinerCommand({ type: 'rename', partId: 'arm' });
    window.removeEventListener(OUTLINER_COMMAND_EVENT, listener);
    requestOutlinerCommand({ type: 'rename', partId: 'leg' });
    expect(heard).toHaveBeenCalledOnce();
    expect(heard).toHaveBeenCalledWith({ type: 'rename', partId: 'arm' });
  });
});
