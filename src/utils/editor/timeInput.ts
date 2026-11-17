/**
 * The timeline's time field: what it shows and what it accepts.
 *
 * It shows a frame as timecode (mm:ss:ff, the frames of the current second)
 * or as a plain frame count. It accepts either, plus seconds and
 * milliseconds, so a time can be typed the way it is thought of:
 *
 *   25 · 25f        frames
 *   1s · 1.5s       seconds
 *   500ms           milliseconds
 *   01:00           seconds:frames
 *   00:01:00        minutes:seconds:frames
 *   00:00:01:00     hours:minutes:seconds:frames
 */
export type TimeDisplayMode = 'timecode' | 'frames';

const pad = (value: number) => String(value).padStart(2, '0');

export function formatTimecode(frame: number, fps: number): string {
  const whole = Math.max(0, Math.round(frame));
  const totalSeconds = Math.floor(whole / fps);
  const subFrames = whole % fps;
  return `${pad(Math.floor(totalSeconds / 60))}:${pad(totalSeconds % 60)}:${pad(subFrames)}`;
}

export function formatTimeDisplay(frame: number, fps: number, mode: TimeDisplayMode): string {
  return mode === 'frames' ? `${Math.max(0, Math.round(frame))}f` : formatTimecode(frame, fps);
}

/** The frame a typed time names, or null when the text is not a time. Not clamped. */
export function parseTimeInput(text: string, fps: number): number | null {
  const value = text.trim().toLowerCase().replace(/\s+/g, '').replace(',', '.');
  if (value === '' || !(fps > 0)) return null;

  const unit = /^(\d+(?:\.\d+)?)(f|s|ms)?$/.exec(value);
  if (unit) {
    const amount = Number(unit[1]);
    switch (unit[2]) {
      case 's': return Math.round(amount * fps);
      case 'ms': return Math.round((amount / 1000) * fps);
      default: return Number.isInteger(amount) ? amount : null;
    }
  }

  if (!/^\d+(:\d+){1,3}$/.test(value)) return null;
  const parts = value.split(':').map(Number);
  const frames = parts.pop()!;
  if (frames >= fps) return null;
  const [seconds = 0, minutes = 0, hours = 0] = parts.reverse();
  if (parts.length > 1 && seconds >= 60) return null;
  if (parts.length > 2 && minutes >= 60) return null;
  return ((hours * 60 + minutes) * 60 + seconds) * fps + frames;
}
