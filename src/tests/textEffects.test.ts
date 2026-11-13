import { describe, expect, it } from 'vitest';
import { parseSingleNumber, resolveDisplayedText, type TextEffect } from '../utils/animation/textEffects';

const typewriter: TextEffect = { kind: 'typewriter', startFrame: 10, durationFrames: 10 };
const count = (from?: number): TextEffect => ({ kind: 'count', startFrame: 0, durationFrames: 30, from });
const at = (text: string, effect: TextEffect | undefined, frame: number) => resolveDisplayedText(text, effect, frame);

describe('typewriter', () => {
  it('reveals the characters over its duration and keeps the rest as hidden text', () => {
    expect(at('HELLO WORLD', typewriter, 0)).toEqual({ shown: '', hidden: 'HELLO WORLD' });
    expect(at('HELLO WORLD', typewriter, 15)).toEqual({ shown: 'HELLO', hidden: ' WORLD' });
    expect(at('HELLO WORLD', typewriter, 20)).toEqual({ shown: 'HELLO WORLD', hidden: '' });
    expect(at('HELLO WORLD', typewriter, 99)).toEqual({ shown: 'HELLO WORLD', hidden: '' });
  });

  it('never splits a character made of several code points', () => {
    const text = 'İ👍🏽é';
    for (let frame = 10; frame <= 20; frame += 1) {
      const { shown, hidden } = at(text, typewriter, frame);
      expect(shown + hidden).toBe(text);
      expect(['', 'İ', 'İ👍🏽', 'İ👍🏽é']).toContain(shown);
    }
  });

  it('shows everything at once when its duration is zero', () => {
    expect(at('ABC', { kind: 'typewriter', startFrame: 5, durationFrames: 0 }, 5)).toEqual({ shown: 'ABC', hidden: '' });
  });
});

describe('count', () => {
  it('counts the one number from 0 to the written value and lands on it exactly', () => {
    expect(at('87 %', count(), 0).shown).toBe('0 %');
    const middle = Number(at('87 %', count(), 15).shown.replace(' %', ''));
    expect(middle).toBeGreaterThan(43);
    expect(middle).toBeLessThan(87);
    expect(at('87 %', count(), 30).shown).toBe('87 %');
  });

  it('keeps decimals, separators, signs and the words around the number', () => {
    expect(at('€3,50', count(), 0).shown).toBe('€0,00');
    expect(at('1.250 oy', count(), 0).shown).toBe('0 oy');
    expect(at('1.250 oy', count(1000), 1).shown).toMatch(/^1\.\d{3} oy$/);
    expect(at('Total: 1,234,567.5', count(1_000_000), 1).shown).toMatch(/^Total: 1,\d{3},\d{3}\.\d$/);
    expect(at('Score 007', count(), 0).shown).toBe('Score 000');
    expect(at('-12 °C', count(), 30).shown).toBe('-12 °C');
    expect(at('-12 °C', count(), 0).shown).toBe('0 °C');
  });

  it('counts down when it starts above the written value', () => {
    expect(at('0', count(10), 0).shown).toBe('10');
    expect(at('0', count(10), 30).shown).toBe('0');
  });

  it('leaves a text with no number or several numbers as written', () => {
    expect(at('GOAL!', count(), 0).shown).toBe('GOAL!');
    expect(at('12:34', count(), 0).shown).toBe('12:34');
  });
});

describe('reading the number', () => {
  it('tells thousands from decimals', () => {
    expect(parseSingleNumber('1.250')?.value).toBe(1250);
    expect(parseSingleNumber('1,250')?.value).toBe(1250);
    expect(parseSingleNumber('3,50')?.value).toBe(3.5);
    expect(parseSingleNumber('3.5')?.value).toBe(3.5);
    expect(parseSingleNumber('1.250,75')?.value).toBe(1250.75);
    expect(parseSingleNumber('1 250 000')?.value).toBe(1_250_000);
  });
});

it('a text without an effect is shown as written', () => {
  expect(at('Hello', undefined, 5)).toEqual({ shown: 'Hello', hidden: '' });
});
