/**
 * Text effects: what a text layer shows at a frame.
 *
 * The ONE authority for text that changes over time. The editor's evaluation
 * (`evaluateFrame`) and the OGraf graphic's evaluation call it, so the stage,
 * the exported graphic and a non-real-time render show the same characters;
 * renderers only draw the result and keep no clock of their own.
 *
 * - Typewriter: the characters (grapheme clusters, so an emoji or a combining
 *   accent is never split) appear one after another. The rest of the text is
 *   returned as `hidden`; renderers draw it transparent, so the text keeps its
 *   place and size while it types (a centred text does not drift).
 * - Count: the text's one number counts from `from` to the written value,
 *   keeping what surrounds it ("87 %", "€3,50", "1.250 votes"), its decimal
 *   places, thousands separator and leading zeros. A text with no number, or
 *   with more than one (12:34), is shown as written.
 * - Clock: a stopwatch counting up from its start, or a countdown from a number
 *   of seconds to zero, in a chosen format. It runs on the timeline's own time
 *   (frames and the frame rate), so the stage, a scrub and a non-real-time
 *   render agree; it holds its first value before the start.
 *
 * Layout (bounds, Text Box, Auto Size, mattes) always measures the full text.
 */
export type TextEffect =
  | { kind: 'typewriter'; startFrame: number; durationFrames: number }
  | { kind: 'count'; startFrame: number; durationFrames: number; from?: number }
  | { kind: 'clock'; mode: 'stopwatch' | 'countdown'; startFrame: number; seconds?: number; format: ClockFormat };

export type ClockFormat = 'mm:ss' | 'hh:mm:ss' | 'ss' | 'mm:ss.t';

export const CLOCK_FORMATS: readonly ClockFormat[] = ['mm:ss', 'hh:mm:ss', 'ss', 'mm:ss.t'];

export interface DisplayedText {
  /** The characters drawn normally. */
  shown: string;
  /** The characters that follow, drawn transparent (typewriter); empty otherwise. */
  hidden: string;
}

/**
 * Self-contained (no module-scope references), so the OGraf graphic runtime
 * embeds this exact source (`ograf/runtimeSnippets`) and runs the same rules.
 */
export function createTextEffects() {
  const segmenter = typeof Intl !== 'undefined' && 'Segmenter' in Intl
    ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    : null;

  /** The text's user-perceived characters. */
  const graphemes = (text: string): string[] =>
    segmenter ? Array.from(segmenter.segment(text), (part) => part.segment) : Array.from(text);

  /** 0 before the effect, 1 after it, linear in between (a zero-length effect is done at its start). */
  const progressAt = (frame: number, startFrame: number, durationFrames: number): number => {
    if (frame < startFrame) return 0;
    if (durationFrames <= 0) return 1;
    return Math.min(1, (frame - startFrame) / durationFrames);
  };

  const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

  interface ParsedNumber {
    prefix: string;
    suffix: string;
    value: number;
    decimals: number;
    decimalSeparator: string;
    thousandsSeparator: string | null;
    integerDigits: number;
    /** Written with leading zeros ("007"): the count keeps that width. */
    zeroPadded: boolean;
    negative: boolean;
  }

  const NUMBER_TOKEN = /\d+(?:[.,'\u00a0\u202f ]\d+)*/g;

  /** The text's one number and how it is written, or null (no number, or several). */
  const parseSingleNumber = (text: string): ParsedNumber | null => {
    const tokens = [...text.matchAll(NUMBER_TOKEN)];
    if (tokens.length !== 1) return null;
    const token = tokens[0][0];
    const start = tokens[0].index ?? 0;
    const separators = [...token.matchAll(/[.,'\u00a0\u202f ]/g)].map((match) => match[0]);
    let decimalSeparator = '.';
    let thousandsSeparator: string | null = null;
    let integerPart = token;
    let fractionPart = '';
    if (separators.length > 0) {
      const last = separators[separators.length - 1];
      const lastIndex = token.lastIndexOf(last);
      const digitsAfterLast = token.length - lastIndex - 1;
      const kinds = new Set(separators);
      // Mixed separators: the last one is the decimal point ("1.250,75", "1,250.75").
      // One kind used once with exactly three digits after it is a thousands
      // separator ("1.250", "1,250"); once with other digits, a decimal ("3,50").
      // Used several times, it groups thousands ("1 250 000").
      const lastIsDecimal = (last === '.' || last === ',')
        && (kinds.size > 1 || (separators.length === 1 && digitsAfterLast !== 3));
      if (lastIsDecimal) {
        decimalSeparator = last;
        integerPart = token.slice(0, lastIndex);
        fractionPart = token.slice(lastIndex + 1);
        const grouping = separators.slice(0, -1);
        thousandsSeparator = grouping[0] ?? null;
      } else {
        thousandsSeparator = separators[0];
        decimalSeparator = thousandsSeparator === '.' ? ',' : '.';
      }
    }
    const integerDigits = integerPart.replace(/\D/g, '');
    const value = Number(`${integerDigits}${fractionPart ? `.${fractionPart}` : ''}`);
    if (!Number.isFinite(value)) return null;
    const before = text.slice(0, start);
    const negative = /[-\u2212]\s*$/.test(before);
    return {
      prefix: negative ? before.replace(/[-\u2212]\s*$/, '') : before,
      suffix: text.slice(start + token.length),
      value: negative ? -value : value,
      decimals: fractionPart.length,
      decimalSeparator,
      thousandsSeparator,
      integerDigits: integerDigits.length,
      zeroPadded: integerDigits.length > 1 && integerDigits.startsWith('0'),
      negative,
    };
  };

  const formatLike = (value: number, like: ParsedNumber): string => {
    const negative = value < 0 && Math.abs(value) >= 10 ** -like.decimals / 2;
    const fixed = Math.abs(value).toFixed(like.decimals);
    const [rawInteger, fraction = ''] = fixed.split('.');
    // Leading zeros are kept ("007"); otherwise the integer part grows freely.
    const padded = like.zeroPadded ? rawInteger.padStart(like.integerDigits, '0') : rawInteger;
    const grouped = like.thousandsSeparator
      ? padded.replace(/\B(?=(\d{3})+(?!\d))/g, like.thousandsSeparator)
      : padded;
    return `${negative ? '-' : ''}${grouped}${like.decimals > 0 ? `${like.decimalSeparator}${fraction}` : ''}`;
  };

  /** A number of seconds in a clock format; whole seconds round down (a stopwatch) unless `roundUp` (a countdown shows 5:00 until it has run a full second). */
  const formatClock = (totalSeconds: number, format: ClockFormat, roundUp: boolean): string => {
    const pad = (value: number) => String(value).padStart(2, '0');
    const tenths = format === 'mm:ss.t';
    const units = tenths ? Math.floor(totalSeconds * 10 + 1e-9) : (roundUp ? Math.ceil(totalSeconds - 1e-9) : Math.floor(totalSeconds + 1e-9));
    const whole = tenths ? Math.floor(units / 10) : units;
    if (format === 'ss') return String(whole);
    const seconds = whole % 60;
    const minutes = Math.floor(whole / 60);
    if (format === 'hh:mm:ss') return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}:${pad(seconds)}`;
    return `${pad(minutes)}:${pad(seconds)}${tenths ? `.${units % 10}` : ''}`;
  };

  /** What a text with this effect shows at `frame` (`fps`: the timeline's frame rate, for a clock). No effect: the text as written. */
  const resolveDisplayedText = (text: string, effect: TextEffect | undefined, frame: number, fps = 30): DisplayedText => {
    if (effect && effect.kind === 'clock') {
      const elapsed = Math.max(0, frame - effect.startFrame) / (fps > 0 ? fps : 30);
      const value = effect.mode === 'countdown' ? Math.max(0, (effect.seconds ?? 0) - elapsed) : elapsed;
      return { shown: formatClock(value, effect.format, effect.mode === 'countdown'), hidden: '' };
    }
    if (!effect || !text) return { shown: text, hidden: '' };
    const t = progressAt(frame, effect.startFrame, effect.durationFrames);
    if (effect.kind === 'typewriter') {
      const characters = graphemes(text);
      const count = Math.floor(characters.length * t);
      return { shown: characters.slice(0, count).join(''), hidden: characters.slice(count).join('') };
    }
    const parsed = parseSingleNumber(text);
    if (!parsed) return { shown: text, hidden: '' };
    if (t >= 1) return { shown: text, hidden: '' };
    const from = effect.from ?? 0;
    const value = from + (parsed.value - from) * easeOutCubic(t);
    const step = 10 ** -parsed.decimals;
    const rounded = Math.round(value / step) * step;
    return { shown: `${parsed.prefix}${formatLike(rounded, parsed)}${parsed.suffix}`, hidden: '' };
  };

  return { graphemes, parseSingleNumber, resolveDisplayedText, formatClock };
}

export const { graphemes, parseSingleNumber, resolveDisplayedText, formatClock } = createTextEffects();
