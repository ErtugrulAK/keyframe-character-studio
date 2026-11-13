import { describe, expect, it } from 'vitest';
import { formatTimeDisplay, formatTimecode, parseTimeInput } from '../utils/editor/timeInput';

describe('timeline time field', () => {
  it('reads frames, seconds and milliseconds', () => {
    expect(parseTimeInput('25', 25)).toBe(25);
    expect(parseTimeInput('25f', 25)).toBe(25);
    expect(parseTimeInput(' 25 F ', 25)).toBe(25);
    expect(parseTimeInput('1s', 25)).toBe(25);
    expect(parseTimeInput('1.5s', 30)).toBe(45);
    expect(parseTimeInput('1,5s', 30)).toBe(45);
    expect(parseTimeInput('500ms', 50)).toBe(25);
    expect(parseTimeInput('0s', 25)).toBe(0);
  });

  it('reads timecode with two, three or four fields', () => {
    expect(parseTimeInput('01:10', 25)).toBe(35);
    expect(parseTimeInput('00:01:00', 25)).toBe(25);
    expect(parseTimeInput('01:02:03', 30)).toBe((60 + 2) * 30 + 3);
    expect(parseTimeInput('00:00:01:00', 25)).toBe(25);
    expect(parseTimeInput('01:00:00:00', 25)).toBe(3600 * 25);
  });

  it('refuses text that is not a time', () => {
    for (const text of ['', 'abc', '1.5', '1.5f', '-3', '1:2:3:4:5', '00:01:30', '00:61:00', '1s2']) {
      expect(parseTimeInput(text, 25), text).toBeNull();
    }
  });

  it('shows timecode or a frame count', () => {
    expect(formatTimecode(0, 25)).toBe('00:00:00');
    expect(formatTimecode(25 * 61 + 7, 25)).toBe('01:01:07');
    expect(formatTimeDisplay(37, 25, 'frames')).toBe('37f');
    expect(formatTimeDisplay(37, 25, 'timecode')).toBe('00:01:12');
  });

  it('reads back what it shows', () => {
    for (const frame of [0, 1, 24, 25, 1499, 9000]) {
      expect(parseTimeInput(formatTimeDisplay(frame, 25, 'timecode'), 25)).toBe(frame);
      expect(parseTimeInput(formatTimeDisplay(frame, 25, 'frames'), 25)).toBe(frame);
    }
  });
});
