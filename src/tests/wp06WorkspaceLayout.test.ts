/** WP-06 — the Outliner/Details split keeps Details usable when the sidebar has room. */
import { describe, expect, it } from 'vitest';
import { resolveOutlinerHeight } from '../utils/workspaceLayout';

describe('WP-06 outliner height bound', () => {
  // C4: Details keeps at least 140 px (was 160) — a short window gives the layer list the 20 px.
  it('leaves at least 140 px to Details when the sidebar can hold both panes', () => {
    // A 720 px window: the sidebar is ~281 px tall.
    expect(resolveOutlinerHeight(240, 281)).toBe(141);
    // Tall sidebars keep the stored height.
    expect(resolveOutlinerHeight(240, 700)).toBe(240);
    // Never below the Outliner's own minimum.
    expect(resolveOutlinerHeight(240, 280)).toBe(140);
  });

  it('keeps the historic layout in a squeezed sidebar or before it is measured', () => {
    expect(resolveOutlinerHeight(240, 160)).toBe(240);
    expect(resolveOutlinerHeight(240, null)).toBe(240);
  });

  it('C4: the window cap is applied at render time only in a squeezed sidebar, never written back', () => {
    // The historic cap: max(160, window − 320).
    expect(resolveOutlinerHeight(240, 200, 450)).toBe(160);
    expect(resolveOutlinerHeight(240, 200, 900)).toBe(240);
    // A sidebar that holds both panes ignores the window height.
    expect(resolveOutlinerHeight(240, 400, 450)).toBe(240);
  });
});
