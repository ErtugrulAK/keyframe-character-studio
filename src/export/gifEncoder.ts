/**
 * A GIF89a encoder, written for KCS so the editor needs no encoder dependency.
 *
 * The format is small, frozen and fully specified, and KCS's artwork is flat
 * vector colour, so the whole pipeline is: build ONE palette for the whole
 * animation (exact colours when the scene has at most 255 of them, median cut
 * otherwise), map each frame to palette indices, and LZW-compress each frame.
 *
 * GIF has exactly ONE transparent palette index and no alpha channel. Slot 0 of
 * the palette is therefore always the transparent key: a pixel whose alpha is
 * below {@link GIF_ALPHA_THRESHOLD} becomes transparent and every other pixel
 * becomes fully opaque in its own colour. A semi-transparent pixel (a soft
 * shadow, a 50% layer) therefore snaps to one side or the other — that is the
 * format's limitation, and the export UI states it.
 */

/** Alpha at or above this is opaque; below it is the transparent index. */
export const GIF_ALPHA_THRESHOLD = 128;

/** The most colours a GIF palette can hold, one of which is the transparent key. */
export const GIF_MAX_COLORS = 255;

/** How many pixels of a frame are sampled when the palette is built. */
const PALETTE_SAMPLE_LIMIT = 32768;

export interface RgbaFrame {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

export interface GifPalette {
  /** RGB triplets, one per palette slot, in slot order. */
  colors: Uint8Array;
  /** Palette slots: a power of two, 2…256. Slot 0 is the transparent key. */
  size: number;
}

const rgbKey = (red: number, green: number, blue: number): number => (red << 16) | (green << 8) | blue;

/** The palette slots for a colour count: a power of two, at least 2. */
const nextPaletteSize = (colorCount: number): number => {
  let size = 2;
  while (size < colorCount) size *= 2;
  return size;
};

interface ColorBox {
  /** The sample slice this box owns. */
  start: number;
  end: number;
}

/** The channel with the widest spread in a box, or -1 when it cannot be split. */
const widestChannel = (samples: Uint32Array, box: ColorBox): { channel: number; spread: number } => {
  let minRed = 255; let maxRed = 0;
  let minGreen = 255; let maxGreen = 0;
  let minBlue = 255; let maxBlue = 0;
  for (let index = box.start; index < box.end; index += 1) {
    const value = samples[index];
    const red = (value >> 16) & 0xFF;
    const green = (value >> 8) & 0xFF;
    const blue = value & 0xFF;
    if (red < minRed) minRed = red;
    if (red > maxRed) maxRed = red;
    if (green < minGreen) minGreen = green;
    if (green > maxGreen) maxGreen = green;
    if (blue < minBlue) minBlue = blue;
    if (blue > maxBlue) maxBlue = blue;
  }
  const spreads = [maxRed - minRed, maxGreen - minGreen, maxBlue - minBlue];
  const widest = Math.max(spreads[0], spreads[1], spreads[2]);
  if (widest === 0) return { channel: -1, spread: 0 };
  return { channel: spreads.indexOf(widest), spread: widest };
};

/**
 * Median cut: split the sample set until there are `maxColors` boxes, each box
 * contributing its average colour. Deterministic for a given sample set — the
 * split always chooses the widest channel and the median of the sorted slice.
 */
const medianCut = (samples: Uint32Array, maxColors: number): number[] => {
  const boxes: ColorBox[] = [{ start: 0, end: samples.length }];
  while (boxes.length < maxColors) {
    let target = -1;
    let bestSpread = 0;
    let bestChannel = -1;
    for (let index = 0; index < boxes.length; index += 1) {
      const box = boxes[index];
      if (box.end - box.start < 2) continue;
      const { channel, spread } = widestChannel(samples, box);
      if (channel < 0 || spread <= bestSpread) continue;
      bestSpread = spread;
      bestChannel = channel;
      target = index;
    }
    if (target < 0) break;
    const box = boxes[target];
    const shift = bestChannel === 0 ? 16 : bestChannel === 1 ? 8 : 0;
    const slice = Array.from(samples.subarray(box.start, box.end));
    slice.sort((left, right) => ((left >> shift) & 0xFF) - ((right >> shift) & 0xFF));
    samples.set(slice, box.start);
    const middle = box.start + (slice.length >> 1);
    boxes.splice(target, 1, { start: box.start, end: middle }, { start: middle, end: box.end });
  }
  return boxes.map((box) => {
    let reds = 0; let greens = 0; let blues = 0;
    const count = Math.max(1, box.end - box.start);
    for (let index = box.start; index < box.end; index += 1) {
      const value = samples[index];
      reds += (value >> 16) & 0xFF;
      greens += (value >> 8) & 0xFF;
      blues += value & 0xFF;
    }
    return rgbKey(Math.round(reds / count), Math.round(greens / count), Math.round(blues / count));
  });
};

/** The distinct opaque colours of a set of frames, sampled evenly. */
export const collectPaletteSamples = (frames: readonly RgbaFrame[]): Uint32Array => {
  const totalPixels = frames.reduce((sum, frame) => sum + frame.width * frame.height, 0);
  const stride = Math.max(1, Math.floor(totalPixels / PALETTE_SAMPLE_LIMIT));
  const samples: number[] = [];
  for (const frame of frames) {
    const { data } = frame;
    for (let pixel = 0; pixel < frame.width * frame.height; pixel += stride) {
      const offset = pixel * 4;
      if (data[offset + 3] < GIF_ALPHA_THRESHOLD) continue;
      samples.push(rgbKey(data[offset], data[offset + 1], data[offset + 2]));
    }
  }
  return Uint32Array.from(samples.length > 0 ? samples : [0, 0, 0]);
};

/**
 * One palette for the whole animation. An artwork with at most 255 distinct
 * colours is reproduced exactly; anything richer goes through median cut.
 */
export const buildGifPalette = (samples: Uint32Array, maxColors: number = GIF_MAX_COLORS): GifPalette => {
  const distinct = Array.from(new Set(samples)).sort((left, right) => left - right);
  const colors = distinct.length <= maxColors ? distinct : medianCut(samples, maxColors);
  // Slot 0 is the transparent key; real colours start at slot 1.
  const size = nextPaletteSize(Math.max(2, colors.length + 1));
  const table = new Uint8Array(size * 3);
  colors.forEach((value, index) => {
    const slot = (index + 1) * 3;
    table[slot] = (value >> 16) & 0xFF;
    table[slot + 1] = (value >> 8) & 0xFF;
    table[slot + 2] = value & 0xFF;
  });
  return { colors: table, size };
};

/** The nearest palette slot for a colour, remembering answers per frame. */
const makeColorMapper = (palette: GifPalette) => {
  const cache = new Map<number, number>();
  return (red: number, green: number, blue: number): number => {
    const key = rgbKey(red, green, blue);
    const cached = cache.get(key);
    if (cached !== undefined) return cached;
    let bestSlot = 1;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let slot = 1; slot < palette.size; slot += 1) {
      const offset = slot * 3;
      const deltaRed = red - palette.colors[offset];
      const deltaGreen = green - palette.colors[offset + 1];
      const deltaBlue = blue - palette.colors[offset + 2];
      const distance = deltaRed * deltaRed + deltaGreen * deltaGreen + deltaBlue * deltaBlue;
      if (distance < bestDistance) {
        bestDistance = distance;
        bestSlot = slot;
      }
    }
    cache.set(key, bestSlot);
    return bestSlot;
  };
};

/** One RGBA frame as palette indices: slot 0 where the pixel is (mostly) transparent. */
export const quantizeFrame = (palette: GifPalette, frame: RgbaFrame): Uint8Array => {
  const mapColor = makeColorMapper(palette);
  const indices = new Uint8Array(frame.width * frame.height);
  for (let pixel = 0; pixel < indices.length; pixel += 1) {
    const offset = pixel * 4;
    indices[pixel] = frame.data[offset + 3] < GIF_ALPHA_THRESHOLD
      ? 0
      : mapColor(frame.data[offset], frame.data[offset + 1], frame.data[offset + 2]);
  }
  return indices;
};

/**
 * The palette's own bit depth: the size field of the logical screen descriptor is
 * `depth - 1`. It is NOT the LZW minimum code size — that one has a floor of 2
 * (a 2-slot palette still compresses with 2-bit codes), while a 2-slot palette
 * declares depth 1.
 */
const paletteDepth = (palette: GifPalette): number => Math.max(1, Math.round(Math.log2(palette.size)));

/** The LZW minimum code size the GIF stores per frame. */
const paletteBits = (palette: GifPalette): number => Math.max(2, paletteDepth(palette));

/**
 * The code width for a dictionary that has just been assigned code
 * `nextCode - 1`: the smallest width that still covers the next code to be
 * assigned, never below `minCodeSize + 1` and never above the format's 12.
 *
 * This is the rule a decoder mirrors (verified against Chromium's own GIF
 * decoder): the width grows when the next code to be assigned no longer fits,
 * so the code that needed the wider field is always written wide enough.
 */
const lzwCodeSize = (nextCode: number, minCodeSize: number): number =>
  Math.min(12, Math.max(minCodeSize + 1, Math.ceil(Math.log2(nextCode))));

/** The LZW-compressed sub-block stream of one frame's indices. */
const lzwCompress = (indices: Uint8Array, minCodeSize: number): Uint8Array => {
  const clearCode = 1 << minCodeSize;
  const endCode = clearCode + 1;
  const bytes: number[] = [];
  let codeSize = lzwCodeSize(endCode + 1, minCodeSize);
  let nextCode = endCode + 1;
  let dictionary = new Map<number, number>();
  let bitBuffer = 0;
  let bitCount = 0;

  const writeCode = (code: number) => {
    bitBuffer |= code << bitCount;
    bitCount += codeSize;
    while (bitCount >= 8) {
      bytes.push(bitBuffer & 0xFF);
      bitBuffer >>= 8;
      bitCount -= 8;
    }
  };

  writeCode(clearCode);
  let prefix = indices[0];
  for (let index = 1; index < indices.length; index += 1) {
    const next = indices[index];
    const key = (prefix << 8) | next;
    const found = dictionary.get(key);
    if (found !== undefined) {
      prefix = found;
      continue;
    }
    writeCode(prefix);
    if (nextCode < 4096) {
      dictionary.set(key, nextCode);
      nextCode += 1;
      codeSize = lzwCodeSize(nextCode, minCodeSize);
    } else {
      // The dictionary is full: the format's escape is a clear code, then a
      // fresh dictionary at the initial width.
      writeCode(clearCode);
      dictionary = new Map<number, number>();
      nextCode = endCode + 1;
      codeSize = lzwCodeSize(nextCode, minCodeSize);
    }
    prefix = next;
  }
  writeCode(prefix);
  writeCode(endCode);
  if (bitCount > 0) bytes.push(bitBuffer & 0xFF);
  return Uint8Array.from(bytes);
};

const writeUint16 = (target: number[], value: number): void => {
  target.push(value & 0xFF, (value >> 8) & 0xFF);
};

/** Splits compressed data into the format's 255-byte sub-blocks. */
const toSubBlocks = (compressed: Uint8Array): number[] => {
  const out: number[] = [];
  for (let offset = 0; offset < compressed.length; offset += 255) {
    const size = Math.min(255, compressed.length - offset);
    out.push(size);
    for (let index = 0; index < size; index += 1) out.push(compressed[offset + index]);
  }
  out.push(0);
  return out;
};

export interface GifWriterOptions {
  width: number;
  height: number;
  palette: GifPalette;
  /** 0 repeats forever; the export always loops. */
  loopCount?: number;
}

/**
 * Streaming GIF89a writer: one shared global colour table, one frame at a time,
 * so a long animation never has to be held in memory at once.
 */
export class GifWriter {
  private readonly chunks: number[][] = [];

  private readonly width: number;

  private readonly height: number;

  private readonly palette: GifPalette;

  private finalized = false;

  constructor({ width, height, palette, loopCount = 0 }: GifWriterOptions) {
    this.width = width;
    this.height = height;
    this.palette = palette;
    const header: number[] = [];
    for (const character of 'GIF89a') header.push(character.charCodeAt(0));
    writeUint16(header, width);
    writeUint16(header, height);
    header.push(0xF0 | (paletteDepth(palette) - 1), 0x00, 0x00);
    header.push(...Array.from(palette.colors));
    // NETSCAPE2.0 application extension: the animation loops.
    header.push(0x21, 0xFF, 0x0B);
    for (const character of 'NETSCAPE2.0') header.push(character.charCodeAt(0));
    header.push(0x03, 0x01);
    writeUint16(header, loopCount);
    header.push(0x00);
    this.chunks.push(header);
  }

  /** Appends one frame: indices into the shared palette, shown for `delayCentiseconds`. */
  writeFrame(indices: Uint8Array, delayCentiseconds: number): void {
    if (this.finalized) throw new Error('The GIF writer was already finished.');
    if (indices.length !== this.width * this.height) {
      throw new Error(`A GIF frame must carry ${this.width * this.height} pixels, received ${indices.length}.`);
    }
    const frame: number[] = [];
    // Graphic Control Extension: disposal 2 (restore to background, which is what
    // keeps the transparent key transparent between frames), then the delay.
    frame.push(0x21, 0xF9, 0x04, (2 << 2) | 0x01);
    writeUint16(frame, Math.max(0, Math.round(delayCentiseconds)));
    frame.push(0x00, 0x00);
    // Image Descriptor: full frame, no local colour table, not interlaced.
    frame.push(0x2C);
    writeUint16(frame, 0);
    writeUint16(frame, 0);
    writeUint16(frame, this.width);
    writeUint16(frame, this.height);
    frame.push(0x00);
    const minCodeSize = paletteBits(this.palette);
    frame.push(minCodeSize);
    frame.push(...toSubBlocks(lzwCompress(indices, minCodeSize)));
    this.chunks.push(frame);
  }

  /** The trailer and the assembled bytes. */
  finish(): Uint8Array {
    this.finalized = true;
    this.chunks.push([0x3B]);
    const total = this.chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of this.chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    return bytes;
  }
}
