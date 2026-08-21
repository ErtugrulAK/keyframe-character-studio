import { describe, expect, it } from 'vitest';
import { getTrimPathDashProps, normalizeTrimPathOffset, resolveTrimPath } from '../utils/trimPath';

describe('Trim Path V2 pure contract', () => {
  it('resolves modern defaults without mutating legacy absence', () => {
    expect(resolveTrimPath({})).toEqual({ enabled: false, start: 0, end: 1, offset: 0, isModern: false });
    expect(resolveTrimPath({ trimPathEnabled: true })).toEqual({ enabled: true, start: 0, end: 1, offset: 0, isModern: true });
  });

  it.each([
    [{ trimPathEnabled: true, trimPathStart: 0, trimPathEnd: 1, trimPathOffset: 0 }, { pathLength: 1 }],
    [{ trimPathEnabled: true, trimPathStart: 0, trimPathEnd: 0, trimPathOffset: 0 }, { pathLength: 1, strokeDasharray: '0 1', strokeDashoffset: 0 }],
    [{ trimPathEnabled: true, trimPathStart: 0, trimPathEnd: 0.5, trimPathOffset: 0 }, { pathLength: 1, strokeDasharray: '0.5 0.5', strokeDashoffset: 0 }],
    [{ trimPathEnabled: true, trimPathStart: 0.5, trimPathEnd: 1, trimPathOffset: 0 }, { pathLength: 1, strokeDasharray: '0.5 0.5', strokeDashoffset: -0.5 }],
    [{ trimPathEnabled: true, trimPathStart: 0.25, trimPathEnd: 0.75, trimPathOffset: 0 }, { pathLength: 1, strokeDasharray: '0.5 0.5', strokeDashoffset: -0.25 }],
    [{ trimPathEnabled: true, trimPathStart: 0.75, trimPathEnd: 0.25, trimPathOffset: 0 }, { pathLength: 1, strokeDasharray: '0.5 0.5', strokeDashoffset: -0.75 }],
  ] as const)('maps interval %j to native dash semantics', (input, expected) => {
    expect(getTrimPathDashProps(resolveTrimPath(input))).toEqual(expected);
  });

  it('normalizes positive and negative offset degrees deterministically', () => {
    expect(normalizeTrimPathOffset(450)).toBe(90);
    expect(normalizeTrimPathOffset(-90)).toBe(270);
    expect(normalizeTrimPathOffset(-450)).toBe(270);
  });
});
