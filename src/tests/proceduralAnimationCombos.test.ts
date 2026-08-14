import { describe, it, expect } from 'vitest';
import { computeProceduralDelta } from '../utils/proceduralAnimation';
import type { CharacterPart } from '../types/animator';

/**
 * M24 10B — builtin COMBINATION presets (pure engine).
 *
 * applyBuiltin is module-private, so the presets are exercised through the
 * public computeProceduralDelta in EDIT mode, where:
 *   IN : p = frame / inDur            eased = 1-(1-p)³
 *   OUT: p = (totalFrames-frame)/outDur  eased = p³
 *
 * We invert the easing to hit exact eased values:
 *   IN  eased=e → frame = inDur × (1 - ∛(1-e))
 *   OUT eased=e → frame = total - outDur × ∛e
 */

const DUR = 15;
const TOTAL = 90;

function part(inAnimPreset?: string, outAnimPreset?: string): CharacterPart {
  return {
    id: 'a', name: 'A', type: 'custom_box', x: 0, y: 0, rotation: 0,
    scaleX: 1, scaleY: 1, opacity: 1, visible: true, zIndex: 1,
    fillColor: '#fff', strokeColor: '#000', strokeWidth: 2,
    width: 60, height: 60, borderRadius: 0,
    inAnimPreset, outAnimPreset,
    inAnimDuration: DUR, outAnimDuration: DUR,
  } as CharacterPart;
}

function editDelta(layer: CharacterPart, frame: number) {
  return computeProceduralDelta(
    layer, [], TOTAL, frame,
    { appMode: 'edit', broadcast: {}, liveStunts: {} },
    [],
  );
}

function frameForInEased(eased: number): number {
  return DUR * (1 - Math.cbrt(1 - eased));
}

function frameForOutEased(eased: number): number {
  return TOTAL - DUR * Math.cbrt(eased);
}

describe('M24 — builtin combination presets (pure delta semantics)', () => {
  it('1-3. slide-scale-left IN: eased 0 / 0.5 / 1', () => {
    const d0 = editDelta(part('slide-scale-left'), frameForInEased(0));
    expect(d0.x).toBeCloseTo(300, 5);   // existing slide-left direction
    expect(d0.scaleX).toBeCloseTo(0, 5);
    expect(d0.scaleY).toBeCloseTo(0, 5);
    expect(d0.opacityMul).toBeCloseTo(0, 5);

    const d05 = editDelta(part('slide-scale-left'), frameForInEased(0.5));
    expect(d05.x).toBeCloseTo(150, 5);  // 300 × (1-0.5)
    expect(d05.scaleX).toBeCloseTo(0.5, 5);
    expect(d05.scaleY).toBeCloseTo(0.5, 5);
    expect(d05.opacityMul).toBeCloseTo(0.5, 5);

    const d1 = editDelta(part('slide-scale-left'), frameForInEased(1));
    expect(d1.x).toBeCloseTo(0, 3);
    expect(d1.scaleX).toBeCloseTo(1, 3);
    expect(d1.opacityMul).toBeCloseTo(1, 3);
  });

  it('4-6. slide-scale-right IN: eased 0 / 0.5 / 1 (existing slide-right direction)', () => {
    const d0 = editDelta(part('slide-scale-right'), frameForInEased(0));
    expect(d0.x).toBeCloseTo(-300, 5);  // existing slide-right direction
    expect(d0.scaleX).toBeCloseTo(0, 5);
    expect(d0.opacityMul).toBeCloseTo(0, 5);

    const d05 = editDelta(part('slide-scale-right'), frameForInEased(0.5));
    expect(d05.x).toBeCloseTo(-150, 5);
    expect(d05.scaleX).toBeCloseTo(0.5, 5);
    expect(d05.opacityMul).toBeCloseTo(0.5, 5);

    const d1 = editDelta(part('slide-scale-right'), frameForInEased(1));
    expect(d1.x).toBeCloseTo(0, 3);
    expect(d1.scaleX).toBeCloseTo(1, 3);
    expect(d1.opacityMul).toBeCloseTo(1, 3);
  });

  it('7-9. soft-pop IN: scale 0.85+0.15eased, opacity eased', () => {
    const d0 = editDelta(part('soft-pop'), frameForInEased(0));
    expect(d0.x).toBe(0);
    expect(d0.scaleX).toBeCloseTo(0.85, 5);
    expect(d0.scaleY).toBeCloseTo(0.85, 5);
    expect(d0.opacityMul).toBeCloseTo(0, 5);

    const d05 = editDelta(part('soft-pop'), frameForInEased(0.5));
    expect(d05.scaleX).toBeCloseTo(0.925, 5); // 0.85 + 0.15×0.5
    expect(d05.scaleY).toBeCloseTo(0.925, 5);
    expect(d05.opacityMul).toBeCloseTo(0.5, 5);

    const d1 = editDelta(part('soft-pop'), frameForInEased(1));
    expect(d1.scaleX).toBeCloseTo(1, 5);
    expect(d1.scaleY).toBeCloseTo(1, 5);
    expect(d1.opacityMul).toBeCloseTo(1, 3);
  });

  it('10. slide-scale-left OUT: direction reversed, scale shrinks at the end', () => {
    // out: p = (T-f)/D, eased = p³ — eased=0.5 → f = 90 - 15×∛0.5
    const d = editDelta(part(undefined, 'slide-scale-left'), frameForOutEased(0.5));
    expect(d.x).toBeCloseTo(-150, 5); // 300×(1-0.5)×(-1) — reversed like slide-left OUT
    expect(d.scaleX).toBeCloseTo(0.5, 5);
    expect(d.opacityMul).toBeCloseTo(0.5, 5);
  });

  it('11. slide-scale-right OUT: direction reversed (positive, toward right)', () => {
    const d = editDelta(part(undefined, 'slide-scale-right'), frameForOutEased(0.5));
    expect(d.x).toBeCloseTo(150, 5); // -300×(1-0.5)×(-1)
    expect(d.scaleX).toBeCloseTo(0.5, 5);
  });

  it('12. soft-pop OUT: scale shrinks toward 0.85, opacity 0 at the end', () => {
    const d0 = editDelta(part(undefined, 'soft-pop'), frameForOutEased(0));
    expect(d0.scaleX).toBeCloseTo(0.85, 5);
    expect(d0.opacityMul).toBeCloseTo(0, 5);
    const d1 = editDelta(part(undefined, 'soft-pop'), frameForOutEased(1));
    expect(d1.scaleX).toBeCloseTo(1, 5);
    expect(d1.opacityMul).toBeCloseTo(1, 5);
  });

  it('13. x/y direction matches the existing slide convention exactly', () => {
    const comboL = editDelta(part('slide-scale-left'), frameForInEased(0.5));
    const plainL = editDelta(part('slide-left'), frameForInEased(0.5));
    expect(comboL.x).toBe(plainL.x);
    const comboR = editDelta(part('slide-scale-right'), frameForInEased(0.5));
    const plainR = editDelta(part('slide-right'), frameForInEased(0.5));
    expect(comboR.x).toBe(plainR.x);
  });

  it('14. soft-pop scaleX === scaleY at every eased point', () => {
    for (const eased of [0, 0.25, 0.5, 0.75, 1]) {
      const d = editDelta(part('soft-pop'), frameForInEased(eased));
      expect(d.scaleX).toBe(d.scaleY);
    }
  });

  it('15. opacity=eased for all three combinations', () => {
    for (const id of ['slide-scale-left', 'slide-scale-right', 'soft-pop']) {
      const d = editDelta(part(id), frameForInEased(0.5));
      expect(d.opacityMul).toBeCloseTo(0.5, 5);
    }
  });

  it('16-19. existing builtins unchanged at eased=0.5', () => {
    const e = frameForInEased(0.5);
    const fade = editDelta(part('fade'), e);
    expect(fade.x).toBeCloseTo(0, 5);
    expect(fade.y).toBeCloseTo(0, 5);
    expect(fade.rotation).toBeCloseTo(0, 5);
    expect(fade.scaleX).toBeCloseTo(1, 5);
    expect(fade.scaleY).toBeCloseTo(1, 5);
    expect(fade.opacityMul).toBeCloseTo(0.5, 5);
    const pop = editDelta(part('pop'), e);
    expect(pop.scaleX).toBeCloseTo(0.5, 5);
    expect(pop.scaleY).toBeCloseTo(0.5, 5);
    expect(pop.opacityMul).toBeCloseTo(0.5, 5);
    const slideL = editDelta(part('slide-left'), e);
    expect(slideL.x).toBeCloseTo(150, 5);
    expect(slideL.scaleX).toBe(1); // slide-left has NO scale delta
    const slideR = editDelta(part('slide-right'), e);
    expect(slideR.x).toBeCloseTo(-150, 5);
    expect(slideR.scaleX).toBe(1);
  });

  it('20. no keyframe/channel data involved (pure delta, empty tracks untouched)', () => {
    // computeProceduralDelta takes tracks only for visibility checks — the
    // result is a plain delta object; nothing writes keyframes/channels.
    const d = editDelta(part('soft-pop'), frameForInEased(0.5));
    expect(Object.keys(d).sort()).toEqual(['opacityMul', 'rotation', 'scaleX', 'scaleY', 'x', 'y']);
  });

  it('21. deterministic repeated result', () => {
    const a = editDelta(part('slide-scale-left'), frameForInEased(0.3));
    const b = editDelta(part('slide-scale-left'), frameForInEased(0.3));
    expect(a).toEqual(b);
  });
});
