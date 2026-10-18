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
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { isMatteSourceSuppressed } from '../utils/matte';
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

describe('K5 — V2 picker option labels state the suppressed truth', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it('suffixes (hidden) for candidates whose matte switch is off', () => {
    const target = partOf({ id: 'p1', trackMatte: { sourceLayerId: 'p2', mode: 'alpha' } });
    const candidates: CharacterPart[] = [
      target,
      partOf({ id: 'p2', name: 'Plain source' }),
      partOf({ id: 'p3', name: 'Switched off', trackMatte: { sourceLayerId: 'p1', mode: 'alpha', sourceVisible: false } }),
    ];
    const view = render(
      <StyleMatteSection
        selectedPart={target}
        characterParts={candidates}
        onPartPropChange={vi.fn()}
      />,
    );
    // Two cards, two `.matte-source-field`s: open TRACK MATTE V2 and read
    // its select by its own accessible name.
    fireEvent.click(view.getByRole('button', { name: 'Expand TRACK MATTE V2' }));
    const select = view.container.querySelector('select[aria-label="Track matte source"]') as HTMLSelectElement;
    expect(select).not.toBeNull();
    const labels = Array.from(select.options).map((option) => option.textContent ?? '');
    expect(labels).toContain('Plain source');
    expect(labels).toContain('Switched off (hidden)');
  });
});
