import { describe, expect, it } from 'vitest';
import {
  buildGifPalette,
  collectPaletteSamples,
  GifWriter,
  GIF_ALPHA_THRESHOLD,
  quantizeFrame,
  type RgbaFrame,
} from '../export/gifEncoder';

/**
 * An independent GIF89a reader, written here so the encoder is checked by
 * something that only knows the FORMAT (not the encoder's own bookkeeping). It
 * decodes the header, the global colour table, every frame's delay and
 * transparency, and the LZW data back to palette indices — the same path a
 * viewer takes.
 */
interface ParsedGifFrame {
  left: number;
  top: number;
  width: number;
  height: number;
  delayCentiseconds: number;
  transparentIndex: number;
  indices: number[];
}

interface ParsedGif {
  version: string;
  width: number;
  height: number;
  globalColorTable: number[];
  loops: number;
  frames: ParsedGifFrame[];
}

const readUint16 = (bytes: Uint8Array, offset: number): number => bytes[offset] | (bytes[offset + 1] << 8);

const lzwDecode = (bytes: Uint8Array, offset: number, minCodeSize: number, pixelCount: number): { indices: number[]; next: number } => {
  const clearCode = 1 << minCodeSize;
  const endCode = clearCode + 1;
  /**
   * The width a decoder mirrors: the plain rule is "grow when the table reaches
   * 2^codeSize entries", and a decoder's table lags the encoder's by exactly one
   * entry (it cannot add an entry for the first code it reads). Expressed
   * against the decoder's own length that is
   * `ceil(log2(length + 1))`, floored at min+1 and capped at 12 — the same
   * width the encoder uses, verified against Chromium's decoder.
   */
  const codeSizeFor = (tableLength: number) => Math.min(12, Math.max(minCodeSize + 1, Math.ceil(Math.log2(tableLength + 1))));
  let codeSize = codeSizeFor(clearCode + 2);
  let dictionary: number[][] = [];
  const resetDictionary = () => {
    dictionary = [];
    for (let index = 0; index < clearCode; index += 1) dictionary.push([index]);
    dictionary.push([], []);
    codeSize = codeSizeFor(dictionary.length);
  };
  resetDictionary();

  const data: number[] = [];
  // Sub-blocks: length-prefixed, terminated by a zero-length block.
  let cursor = offset;
  while (cursor < bytes.length) {
    const size = bytes[cursor];
    cursor += 1;
    if (size === 0) break;
    for (let index = 0; index < size; index += 1) data.push(bytes[cursor + index]);
    cursor += size;
  }

  const indices: number[] = [];
  let bitBuffer = 0;
  let bitCount = 0;
  let dataOffset = 0;
  const readCode = (): number | null => {
    while (bitCount < codeSize) {
      if (dataOffset >= data.length) return null;
      bitBuffer |= data[dataOffset] << bitCount;
      dataOffset += 1;
      bitCount += 8;
    }
    const code = bitBuffer & ((1 << codeSize) - 1);
    bitBuffer >>= codeSize;
    bitCount -= codeSize;
    return code;
  };

  let previous: number[] | null = null;
  for (;;) {
    const code = readCode();
    if (code === null || code === endCode) break;
    if (code === clearCode) {
      resetDictionary();
      previous = null;
      continue;
    }
    let entry: number[];
    if (code < dictionary.length && dictionary[code].length > 0) entry = dictionary[code];
    else if (previous) entry = [...previous, previous[0]];
    else throw new Error(`Invalid LZW code ${code}.`);
    indices.push(...entry);
    if (previous) {
      dictionary.push([...previous, entry[0]]);
      codeSize = codeSizeFor(dictionary.length);
    }
    previous = entry;
    if (indices.length > pixelCount * 2) throw new Error('LZW stream produced far too many pixels.');
  }
  return { indices, next: cursor };
};

const parseGif = (bytes: Uint8Array): ParsedGif => {
  const version = String.fromCharCode(...bytes.subarray(0, 6));
  const width = readUint16(bytes, 6);
  const height = readUint16(bytes, 8);
  const packed = bytes[10];
  const tableSize = 2 ** ((packed & 0x07) + 1);
  const globalColorTable = Array.from(bytes.subarray(13, 13 + tableSize * 3));
  let offset = 13 + tableSize * 3;
  const frames: ParsedGifFrame[] = [];
  let loops = -1;
  while (offset < bytes.length) {
    const marker = bytes[offset];
    if (marker === 0x3B) break;
    if (marker === 0x21) {
      const label = bytes[offset + 1];
      if (label === 0xFF) {
        offset += 2;
        const size = bytes[offset];
        offset += 1 + size;
        while (bytes[offset] !== 0) {
          const blockSize = bytes[offset];
          if (blockSize === 3 && bytes[offset + 1] === 1) loops = readUint16(bytes, offset + 2);
          offset += 1 + blockSize;
        }
        offset += 1;
        continue;
      }
      if (label === 0xF9) {
        const size = bytes[offset + 2];
        const packedControl = bytes[offset + 3];
        const delay = readUint16(bytes, offset + 4);
        const transparentIndex = bytes[offset + 6];
        offset += 3 + size;
        while (bytes[offset] !== 0) offset += 1 + bytes[offset];
        offset += 1;
        if (bytes[offset] !== 0x2C) throw new Error('Expected an image descriptor after the control extension.');
        const left = readUint16(bytes, offset + 1);
        const top = readUint16(bytes, offset + 3);
        const frameWidth = readUint16(bytes, offset + 5);
        const frameHeight = readUint16(bytes, offset + 7);
        const imagePacked = bytes[offset + 9];
        if ((imagePacked & 0x80) !== 0) throw new Error('The encoder is expected to use only the global colour table.');
        offset += 10;
        const minCodeSize = bytes[offset];
        offset += 1;
        const { indices, next } = lzwDecode(bytes, offset, minCodeSize, frameWidth * frameHeight);
        offset = next;
        frames.push({
          left,
          top,
          width: frameWidth,
          height: frameHeight,
          delayCentiseconds: delay,
          transparentIndex: (packedControl & 0x01) === 1 ? transparentIndex : -1,
          indices,
        });
        continue;
      }
      offset += 2;
      while (bytes[offset] !== 0) offset += 1 + bytes[offset];
      offset += 1;
      continue;
    }
    throw new Error(`Unexpected GIF block marker 0x${marker.toString(16)}.`);
  }
  return { version, width, height, globalColorTable, loops, frames };
};

/** One solid frame: a single colour across the whole box. */
const solidFrame = (width: number, height: number, [red, green, blue]: [number, number, number], alpha = 255): RgbaFrame => {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    data[pixel * 4] = red;
    data[pixel * 4 + 1] = green;
    data[pixel * 4 + 2] = blue;
    data[pixel * 4 + 3] = alpha;
  }
  return { data, width, height };
};

const encode = (frames: RgbaFrame[], width: number, height: number, delays: number[]): Uint8Array => {
  const palette = buildGifPalette(collectPaletteSamples(frames));
  const writer = new GifWriter({ width, height, palette });
  frames.forEach((frame, index) => writer.writeFrame(quantizeFrame(palette, frame), delays[index]));
  return writer.finish();
};

describe('gif encoder', () => {
  it('writes a GIF89a header, one global colour table and a looping animation', () => {
    const frames = [
      solidFrame(4, 3, [255, 0, 0]),
      solidFrame(4, 3, [0, 0, 255]),
      solidFrame(4, 3, [0, 255, 0]),
    ];
    const parsed = parseGif(encode(frames, 4, 3, [20, 10, 5]));

    expect(parsed.version).toBe('GIF89a');
    expect(parsed.width).toBe(4);
    expect(parsed.height).toBe(3);
    expect(parsed.loops).toBe(0);
    expect(parsed.frames).toHaveLength(3);
    expect(parsed.frames.map((frame) => frame.delayCentiseconds)).toEqual([20, 10, 5]);
    expect(parsed.frames.map((frame) => [frame.width, frame.height])).toEqual([[4, 3], [4, 3], [4, 3]]);
    // Three colours plus the transparent key need four slots.
    expect(parsed.globalColorTable).toHaveLength(12);
  });

  it('reproduces flat artwork exactly and round-trips through the format', () => {
    const palette = buildGifPalette(Uint32Array.from([0xFF0000, 0x00FF00, 0x0000FF]));
    expect(palette.size).toBe(4);
    expect(Array.from(palette.colors)).toEqual([
      0, 0, 0, // the transparent key
      0x00, 0x00, 0xFF,
      0x00, 0xFF, 0x00,
      0xFF, 0x00, 0x00,
    ]);

    const frame = solidFrame(8, 2, [0, 0, 255]);
    const indices = quantizeFrame(palette, frame);
    expect(new Set(indices)).toEqual(new Set([1]));

    const writer = new GifWriter({ width: 8, height: 2, palette });
    writer.writeFrame(indices, 4);
    const parsed = parseGif(writer.finish());
    expect(parsed.frames[0].indices).toEqual(Array.from({ length: 16 }, () => 1));
  });

  it('maps a pixel below the alpha threshold to the transparent key and keeps the rest opaque', () => {
    const transparent = solidFrame(2, 1, [10, 20, 30], GIF_ALPHA_THRESHOLD - 1);
    const opaque = solidFrame(2, 1, [10, 20, 30], GIF_ALPHA_THRESHOLD);
    const palette = buildGifPalette(collectPaletteSamples([transparent, opaque]));

    expect(Array.from(quantizeFrame(palette, transparent))).toEqual([0, 0]);
    expect(Array.from(quantizeFrame(palette, opaque))).toEqual([1, 1]);

    const writer = new GifWriter({ width: 2, height: 1, palette });
    writer.writeFrame(quantizeFrame(palette, transparent), 5);
    const parsed = parseGif(writer.finish());
    expect(parsed.frames[0].transparentIndex).toBe(0);
  });

  it('quantizes more than 255 colours to a full palette without losing the darkest pixel', () => {
    const width = 300;
    const frame: RgbaFrame = { data: new Uint8ClampedArray(width * 4), width, height: 1 };
    for (let pixel = 0; pixel < width; pixel += 1) {
      const value = pixel % 256;
      frame.data[pixel * 4] = value;
      frame.data[pixel * 4 + 1] = value;
      frame.data[pixel * 4 + 2] = value;
      frame.data[pixel * 4 + 3] = 255;
    }
    const palette = buildGifPalette(collectPaletteSamples([frame]));
    expect(palette.size).toBe(256);
    const indices = quantizeFrame(palette, frame);
    expect(indices).toHaveLength(width);
    const firstSlot = indices[0];
    const firstColor = Array.from(palette.colors.subarray(firstSlot * 3, firstSlot * 3 + 3));
    expect(Math.max(...firstColor)).toBeLessThanOrEqual(4);
  });

  it('refuses a frame whose pixel count does not match the writer', () => {
    const palette = buildGifPalette(Uint32Array.from([0x123456]));
    const writer = new GifWriter({ width: 4, height: 4, palette });
    expect(() => writer.writeFrame(new Uint8Array(15), 4)).toThrow(/must carry 16 pixels/);
  });

  it('keeps a long single-colour run compressed through a dictionary reset', () => {
    const frame = solidFrame(200, 200, [12, 34, 56]);
    const palette = buildGifPalette(collectPaletteSamples([frame]));
    const indices = quantizeFrame(palette, frame);
    const writer = new GifWriter({ width: 200, height: 200, palette });
    writer.writeFrame(indices, 4);
    const bytes = writer.finish();
    const parsed = parseGif(bytes);

    expect(parsed.frames[0].indices).toEqual(Array.from(indices));
    // The compressed stream is far smaller than the pixel data it carries.
    expect(bytes.length).toBeLessThan(frame.data.length / 10);
  });
});
