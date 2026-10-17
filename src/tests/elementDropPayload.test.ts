// N3 PR-2a — Stage JSON drop boundary.
//
// The `application/json` drop channel is fed ONLY by the app's own drawer
// drag sources (ElementsDrawer shapes, TextsDrawer text presets). Anything
// else that reaches it (DevTools, an embedder, a hostile page) must be
// rejected without ever reaching the document-mutating path. This module is
// the single authority for that decision; StageCanvas consumes it verbatim.

import { describe, expect, it } from 'vitest';
import {
  ELEMENT_DROP_TYPES,
  parseElementDropPayload,
} from '../utils/elementDropPayload';

describe('parseElementDropPayload — legitimate drawer payloads (anti-regression)', () => {
  it('accepts every ElementsDrawer/TextsDrawer drag payload unchanged', () => {
    for (const type of ELEMENT_DROP_TYPES) {
      const parsed = parseElementDropPayload(JSON.stringify({ type, name: 'Cow' }));
      expect(parsed).toEqual({ type, name: 'Cow' });
    }
  });

  it('accepts the TextsDrawer shape with extra style fields but keeps only the contract fields', () => {
    const raw = JSON.stringify({
      type: 'custom_text',
      name: 'Title',
      fontFamily: 'Impact',
      fontSize: 48,
    });
    expect(parseElementDropPayload(raw)).toEqual({ type: 'custom_text', name: 'Title' });
  });

  it('defaults the name when the payload omits it, matching the old fallback', () => {
    expect(parseElementDropPayload(JSON.stringify({ type: 'custom_star' }))).toEqual({
      type: 'custom_star',
      name: 'Dropped Element',
    });
  });

  it('coerces a numeric name to string instead of forwarding a non-string', () => {
    expect(parseElementDropPayload(JSON.stringify({ type: 'custom_box', name: 42 }))).toEqual({
      type: 'custom_box',
      name: '42',
    });
  });

  it('clamps an overlong name to 80 characters', () => {
    const parsed = parseElementDropPayload(
      JSON.stringify({ type: 'custom_box', name: 'x'.repeat(200) }),
    );
    expect(parsed?.name).toHaveLength(80);
  });
});

describe('parseElementDropPayload — malformed and hostile payloads', () => {
  const reject = (raw: string) => expect(parseElementDropPayload(raw)).toBeNull();

  it('rejects malformed JSON', () => {
    reject('{type:custom_box');
  });

  it('rejects non-object JSON roots', () => {
    reject('null');
    reject('"custom_box"');
    reject('42');
    reject('[{"type":"custom_box","name":"Cow"}]');
  });

  it('rejects unknown or absent type identifiers', () => {
    reject(JSON.stringify({ name: 'Cow' }));
    reject(JSON.stringify({ type: 'not_a_part_type', name: 'Cow' }));
    reject(JSON.stringify({ type: 'function', name: 'Cow' }));
  });

  it('rejects media and tool-only types that never legitimately ride the JSON channel', () => {
    for (const type of ['custom_image', 'custom_video', 'custom_freeform', 'mograph_cloner', 'particle_system']) {
      reject(JSON.stringify({ type, name: 'Cow' }));
    }
  });

  it('rejects prototype-sensitive type identifiers instead of coercing them', () => {
    for (const type of ['__proto__', 'constructor', 'prototype']) {
      reject(JSON.stringify({ type, name: 'Cow' }));
    }
  });

  it('rejects prototype-sensitive or non-string names instead of forwarding objects', () => {
    reject(JSON.stringify({ type: 'custom_box', name: { toString: () => 'sneaky' } }));
    reject(JSON.stringify({ type: 'custom_box', name: ['a', 'b'] }));
    reject(JSON.stringify({ type: 'custom_box', name: true }));
  });

  it('rejects a __proto__-keyed payload even though JSON.parse keeps it inert', () => {
    reject('{"__proto__":{"polluted":true},"type":"custom_box","name":"Cow"}');
  });

  it('rejects an empty-string name, which the old `||` fallback covered', () => {
    expect(parseElementDropPayload(JSON.stringify({ type: 'custom_box', name: '' }))).toEqual({
      type: 'custom_box',
      name: 'Dropped Element',
    });
  });

  it('never returns extra payload fields (no spread channel into the document)', () => {
    const parsed = parseElementDropPayload(
      JSON.stringify({ type: 'custom_box', name: 'Cow', baseTransform: 'XSS', zIndex: 999 }),
    );
    expect(Object.keys(parsed ?? {})).toEqual(['type', 'name']);
  });
});
