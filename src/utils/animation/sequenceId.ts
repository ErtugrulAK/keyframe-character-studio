/**
 * Which sequence a keyframe belongs to.
 *
 * A keyframe written before named sequences existed has no `templateId`; it
 * belongs to the first sequence, whose id is `'Sequence'`. Every reader that
 * scopes keyframes to a sequence goes through this, so the fallback is spelled
 * once.
 *
 * `evaluateTransform`, the matte helpers and the OGraf runtime keep their own
 * inline spelling on purpose: the first is the evaluation authority, and the
 * other two are embedded in the exported graphic as source text and cannot
 * import this module.
 */
export const DEFAULT_SEQUENCE_ID = 'Sequence';

export const sequenceIdOf = (keyframe: { templateId?: string }): string => keyframe.templateId || DEFAULT_SEQUENCE_ID;
