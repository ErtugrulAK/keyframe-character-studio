/**
 * A text the playout operator can count up and down (OGraf "+1" / "-1"
 * buttons). Only a text that is a whole number can be a counter: its value is
 * that number, and an empty text counts as 0.
 *
 * The generated OGraf runtime repeats this rule inline (it cannot import
 * application modules); `src/tests/ografOperatorCounter.test.ts` keeps the two
 * in step.
 */
export const COUNTER_LIMIT = 999_999;

/** The counter value of a text, or undefined when the text is not a whole number. */
export const counterValueOf = (text: string | undefined): number | undefined => {
  const trimmed = (text ?? '').trim();
  if (trimmed === '') return 0;
  if (!/^-?\d{1,6}$/u.test(trimmed)) return undefined;
  return Number(trimmed);
};

/** Why a layer cannot be a counter, or undefined when it can. */
export const counterUnavailableReason = (part: { type: string; textValue?: string; textEffect?: unknown }): string | undefined => {
  if (part.type !== 'custom_text') return 'Only a text layer can be a counter';
  if (part.textEffect) return 'A text with an ANIMATE TEXT effect cannot also be a counter';
  if (counterValueOf(part.textValue) === undefined) return `The text must be a whole number from -${COUNTER_LIMIT} to ${COUNTER_LIMIT}, e.g. 0`;
  return undefined;
};
