import { describe, expect, it } from 'vitest';
import { closeDocksForNarrowStage, MIN_OPENING_STAGE_WIDTH } from '../utils/workspaceLayout';

describe('C11 closeDocksForNarrowStage — docks give the stage its room', () => {
  const run = (initial: number, gains: number[]) => {
    let width = initial;
    const closed: number[] = [];
    const result = closeDocksForNarrowStage(() => width, gains.map((gain, index) => () => {
      closed.push(index);
      width += gain;
    }));
    return { result, closed, width };
  };

  it('does nothing while the stage is wide enough, or not laid out at all', () => {
    expect(run(MIN_OPENING_STAGE_WIDTH, [200, 300])).toEqual({ result: false, closed: [], width: MIN_OPENING_STAGE_WIDTH });
    expect(run(0, [200, 300])).toEqual({ result: false, closed: [], width: 0 });
  });

  it('closes in order and stops as soon as the stage has its minimum', () => {
    expect(run(250, [200, 300])).toEqual({ result: true, closed: [0], width: 450 });
    expect(run(50, [200, 300])).toEqual({ result: true, closed: [0, 1], width: 550 });
  });

  it('closes every dock when none of them frees enough room', () => {
    expect(run(100, [50, 50])).toEqual({ result: true, closed: [0, 1], width: 200 });
  });
});
