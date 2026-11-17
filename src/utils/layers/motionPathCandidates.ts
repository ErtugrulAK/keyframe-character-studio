import type { CharacterPart } from '../../types/animator';

const placementParentOf = (part: CharacterPart): string | undefined => part.parentId ?? part.booleanGroupId;

/** The layers a part can follow on a motion path: other path (freeform) layers placed in the same parent. */
export const motionPathCandidates = (part: CharacterPart, parts: readonly CharacterPart[]): CharacterPart[] =>
  parts.filter((candidate) => candidate.id !== part.id
    && candidate.type === 'custom_freeform'
    && placementParentOf(candidate) === placementParentOf(part));
