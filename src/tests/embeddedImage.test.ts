import { describe, expect, it } from 'vitest';
import { decodeDataUrl, isSafeEmbeddedImage, isSupportedEmbeddedImage } from '../utils/persistence/embeddedImage';

/**
 * The embedded-image policy shared by the OGraf export and the Lottie import:
 * which data URLs become package bytes, and the SVG script check.
 */
const SVG_NS = 'xmlns="http://www.w3.org/2000/svg"';
const text = (bytes: Uint8Array | undefined) => (bytes ? new TextDecoder().decode(bytes) : undefined);
const svgBytes = (source: string) => new TextEncoder().encode(source);
const PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

describe('decodeDataUrl', () => {
  it('decodes a base64 image to its bytes and lower-cased MIME type', () => {
    const decoded = decodeDataUrl(`data:IMAGE/PNG;base64,${PNG_BASE64}`);
    expect(decoded?.mimeType).toBe('image/png');
    expect(Array.from(decoded!.bytes.subarray(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47]);
  });

  it('keeps non-ASCII text of a percent-encoded SVG (UTF-8, as a browser reads it)', () => {
    const svg = `<svg ${SVG_NS}><text>Işık ğüş — 50 %</text></svg>`;
    expect(text(decodeDataUrl(`data:image/svg+xml,${encodeURIComponent(svg)}`)?.bytes)).toBe(svg);
    // Unescaped non-ASCII characters are UTF-8 too.
    expect(text(decodeDataUrl(`data:image/svg+xml,${svg}`)?.bytes)).toBe(svg);
  });

  it('a bare % that starts no escape is a literal character, not a broken image', () => {
    const svg = `<svg ${SVG_NS} width="100%" height="50%"/>`;
    expect(text(decodeDataUrl(`data:image/svg+xml,${svg}`)?.bytes)).toBe(svg);
    expect(text(decodeDataUrl(`data:image/svg+xml,<svg ${SVG_NS}>%zz%4</svg>`)?.bytes)).toBe(`<svg ${SVG_NS}>%zz%4</svg>`);
  });

  it('accepts parameters such as charset before the base64 flag', () => {
    const svg = `<svg ${SVG_NS}/>`;
    expect(text(decodeDataUrl(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`)?.bytes)).toBe(svg);
    expect(text(decodeDataUrl(`data:image/svg+xml;charset=utf-8;base64,${btoa(svg)}`)?.bytes)).toBe(svg);
    expect(decodeDataUrl(`data:image/png;name=dot.png;base64,${PNG_BASE64}`)?.mimeType).toBe('image/png');
  });

  it('refuses MIME types outside the allowlist, malformed URLs, broken base64 and empty bodies', () => {
    expect(decodeDataUrl('data:text/html,<p>hi</p>')).toBeUndefined();
    expect(decodeDataUrl('data:image/bmp;base64,Qk0=')).toBeUndefined();
    expect(decodeDataUrl('https://example.com/a.png')).toBeUndefined();
    expect(decodeDataUrl('data:image/png;base64')).toBeUndefined();
    expect(decodeDataUrl('data:image/png;base64,***')).toBeUndefined();
    expect(decodeDataUrl('data:image/png;base64,')).toBeUndefined();
  });

  it('refuses an SVG with script however its body is encoded', () => {
    const evil = `<svg ${SVG_NS}><script>alert(1)</script></svg>`;
    expect(decodeDataUrl(`data:image/svg+xml,${encodeURIComponent(evil)}`)).toBeUndefined();
    expect(decodeDataUrl(`data:image/svg+xml;base64,${btoa(evil)}`)).toBeUndefined();
    expect(decodeDataUrl(`data:image/svg+xml;charset=utf-8,${evil}`)).toBeUndefined();
    expect(isSupportedEmbeddedImage(`data:image/svg+xml,${encodeURIComponent(evil)}`)).toBe(false);
    expect(isSupportedEmbeddedImage(`data:image/png;base64,${PNG_BASE64}`)).toBe(true);
  });
});

describe('isSafeEmbeddedImage', () => {
  it('passes raster formats untouched and a plain SVG', () => {
    expect(isSafeEmbeddedImage(svgBytes('<script>'), 'image/png')).toBe(true);
    expect(isSafeEmbeddedImage(svgBytes(`<svg ${SVG_NS}><rect width="1" height="1"/></svg>`), 'image/svg+xml')).toBe(true);
  });

  it.each([
    ['a script element', '<svg><script>x()</script></svg>'],
    ['an upper-case script element', '<svg><SCRIPT>x()</SCRIPT></svg>'],
    ['an event handler', '<svg onload="x()"/>'],
    ['an event handler with spaces', '<svg><rect onclick = "x()"/></svg>'],
    ['a javascript: link', '<svg><a href="javascript:x()"><text>t</text></a></svg>'],
    ['an xlink data: link', "<svg><use xlink:href='data:image/svg+xml,x'/></svg>"],
    ['foreignObject', '<svg><foreignObject><div/></foreignObject></svg>'],
    ['an iframe', '<svg><iframe src="x"/></svg>'],
    ['a DOCTYPE', '<!DOCTYPE svg><svg/>'],
    ['an ENTITY declaration', '<!ENTITY x "y"><svg/>'],
  ])('refuses %s', (_label, source) => {
    expect(isSafeEmbeddedImage(svgBytes(source), 'image/svg+xml')).toBe(false);
  });
});
