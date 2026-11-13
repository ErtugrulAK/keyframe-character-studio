/**
 * K5 — matte visibility safety (read-only affordances, zero behavior change).
 *
 * Track Matte V2 carries one explicit hidden state: `sourceVisible:false` —
 * the AE matte switch, "do not paint the source as its own layer, keep
 * clipping" (StagePartLayers filters it out of the layer list; the def loop
 * keeps using its geometry). Today that truth is invisible in the UI: the
 * outliner tooltip and the V2 picker label a suppressed source exactly like a
 * painted one. K5 surfaces it with one helper and one wording; rendering,
 * serialization, and validation do not move. (Layer-level `visible` lives on
 * the TRACK, not the part — track visibility is a sequencer concern and is
 * deliberately out of this slice, see the semantics map DEFER list.)
 */
import { render, fireEvent, cleanup } from '@testing-library/react';
import { isMatteSourceSuppressed, suppressedMatteSourceIds } from '../utils/layers/matte';
import { StyleMatteSection } from '../components/Inspector/sections/style/StyleMatteSection';
import type { CharacterPart } from '../types/animator';

const partOf = (over: Partial<CharacterPart>): CharacterPart => ({
  id: 'p1',
  name: 'Shape 1',
  type: 'custom_rect',
  zIndex: 1,
  ...over,
} as CharacterPart);

describe('K5 — isMatteSourceSuppressed', () => {
  it('reads the V2 matte-switch flag, and only when the relationship is active', () => {
    expect(isMatteSourceSuppressed(partOf({ trackMatte: { sourceLayerId: 'p2', mode: 'alpha', sourceVisible: false } }))).toBe(true);
    expect(isMatteSourceSuppressed(partOf({ trackMatte: { sourceLayerId: 'p2', mode: 'alpha' } }))).toBe(false);
    expect(isMatteSourceSuppressed(partOf({ trackMatte: { sourceLayerId: 'p2', mode: 'alpha', sourceVisible: true } }))).toBe(false);
    // Disabled V2 = no active relationship = no suppression claim.
    expect(isMatteSourceSuppressed(partOf({ trackMatte: { sourceLayerId: 'p2', mode: 'alpha', sourceVisible: false, enabled: false } }))).toBe(false);
    // Legacy matte has no sourceVisible semantics.
    expect(isMatteSourceSuppressed(partOf({ matte: { sourcePartId: 'p2', mode: 'alpha' } }))).toBe(false);
    expect(isMatteSourceSuppressed(partOf({}))).toBe(false);
  });
});

describe('K5 — suppressedMatteSourceIds (the TARGET-direction truth the picker needs)', () => {
  const v2 = (sourceLayerId: string, over: Record<string, unknown> = {}) =>
    ({ sourceLayerId, mode: 'alpha', ...over });

  it('collects the SOURCE ids of active switched-off V2 relationships only', () => {
    const ids = suppressedMatteSourceIds([
      { id: 'A', trackMatte: v2('B', { sourceVisible: false }) },
      { id: 'B' },
      { id: 'C', trackMatte: v2('D') },
    ]);
    expect(ids.has('B')).toBe(true); // A hides B
    expect(ids.has('C')).toBe(false); // C hiding nothing says nothing about C
    expect(ids.has('D')).toBe(false); // C's source is visible
  });

  it('respects enabled:false and ignores legacy matte entirely', () => {
    const ids = suppressedMatteSourceIds([
      { id: 'A', trackMatte: v2('B', { sourceVisible: false, enabled: false }) },
      { id: 'E', matte: { sourcePartId: 'F', mode: 'alpha' } },
    ]);
    expect(ids.has('B')).toBe(false);
    expect(ids.has('F')).toBe(false);
  });

  it('one switched-off target suppresses even when another target shows the same source', () => {
    const ids = suppressedMatteSourceIds([
      { id: 'T1', trackMatte: v2('S', { sourceVisible: false }) },
      { id: 'T2', trackMatte: v2('S', { sourceVisible: true }) },
    ]);
    expect(ids.has('S')).toBe(true); // mirrors StagePartLayers: suppression is per-source-id
  });
});

describe('K5 — V2 picker labels reflect WHO IS SUPPRESSED AS A SOURCE (target direction)', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  // Review fix: the label must answer "is this candidate hidden because some
  // TARGET uses it with sourceVisible:false" — not the candidate's OWN
  // relationship flag. p4 suppresses p2; p3's own switch hiding p5 must NOT
  // mark p3; legacy matte (p6→p7) has no suppression semantics.
  const parts = (): CharacterPart[] => [
    partOf({ id: 'p1', trackMatte: { sourceLayerId: 'p2', mode: 'alpha' } }),
    partOf({ id: 'p2', name: 'Suppressed source' }),
    partOf({ id: 'p3', name: 'Hides another', trackMatte: { sourceLayerId: 'p5', mode: 'alpha', sourceVisible: false } }),
    partOf({ id: 'p4', name: 'Suppressor', trackMatte: { sourceLayerId: 'p2', mode: 'alpha', sourceVisible: false } }),
    partOf({ id: 'p5', name: 'Also suppressed' }),
    partOf({ id: 'p6', name: 'Legacy user', matte: { sourcePartId: 'p7', mode: 'alpha' } }),
    partOf({ id: 'p7', name: 'Legacy source' }),
  ];

  function picker(view: ReturnType<typeof render>) {
    fireEvent.click(view.getByRole('button', { name: 'Expand TRACK MATTE' }));
    return view.container.querySelector('select[aria-label="Track matte source"]') as HTMLSelectElement;
  }

  it('marks the candidate suppressed by another part, and NOT a candidate that merely suppresses someone else', () => {
    const all = parts();
    const view = render(
      <StyleMatteSection selectedPart={all[0]} characterParts={all} onPartPropChange={vi.fn()} />,
    );
    const select = picker(view);
    expect(select).not.toBeNull();
    const labels = Array.from(select.options).map((option) => option.textContent ?? '');
    expect(labels).toContain('Suppressed source (hidden)'); // p2 via p4
    expect(labels).toContain('Hides another');               // p3: no label
    expect(labels).toContain('Suppressor');                  // p4: no label
    expect(labels).toContain('Also suppressed (hidden)');   // p5: suppressed BY p3 — target direction
    expect(labels).toContain('Legacy source');              // p7: legacy hides nothing
  });

  it('a source suppressed by multiple targets carries one label; the option values are the raw ids and selection is preserved', () => {
    const all = parts();
    const view = render(
      <StyleMatteSection selectedPart={all[0]} characterParts={all} onPartPropChange={vi.fn()} />,
    );
    const select = picker(view);
    const hidden = Array.from(select.options).filter((option) => (option.textContent ?? '').endsWith(' (hidden)')).map((option) => option.value);
    expect(hidden).toEqual(['p2', 'p5']);
    expect(select.value).toBe('p2'); // p1's own relationship stays selected
    expect(Array.from(select.options).map((option) => option.value))
      .toEqual(['', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7']);
  });

  it('label rendering mutates nothing: parts, callbacks, history, storage all untouched', () => {
    const all = parts();
    const before = JSON.stringify(all);
    const onPartPropChange = vi.fn();
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const view = render(
      <StyleMatteSection selectedPart={all[0]} characterParts={all} onPartPropChange={onPartPropChange} />,
    );
    picker(view);
    expect(JSON.stringify(all)).toBe(before);
    expect(onPartPropChange).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
  });
});
