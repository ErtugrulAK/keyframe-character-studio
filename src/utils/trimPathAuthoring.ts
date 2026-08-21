import type { CharacterPart } from '../types/animator';
import { isTrimPathEligible } from './trimPath';

export type TrimPathAuthoringPatch = Partial<Pick<CharacterPart, 'trimPathEnabled' | 'trimPathStart' | 'trimPathEnd' | 'trimPathOffset'>>;

/** Materialize the V2 fields on the first explicit Trim Path edit. */
export const updateTrimPath = (part: CharacterPart, patch: TrimPathAuthoringPatch): CharacterPart => {
  if (!isTrimPathEligible(part.type)) return { ...part, ...patch };
  return {
    ...part,
    trimPathEnabled: part.trimPathEnabled ?? false,
    trimPathStart: part.trimPathStart ?? 0,
    trimPathEnd: part.trimPathEnd ?? 1,
    trimPathOffset: part.trimPathOffset ?? 0,
    ...patch,
  };
};
