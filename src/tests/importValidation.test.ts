import { describe, expect, it } from 'vitest';
import {
  MAX_IMPORT_CHARACTERS,
  MAX_IMPORT_LAYERS,
  validateImportedDocument,
} from '../utils/importValidation';

/**
 * The import boundary is the only place untrusted project text becomes a typed
 * document, so these cases pin the refusal contract: what is refused, with which
 * code, and that a legitimate document of either kind still passes.
 */
const refusalCode = (text: string): string | undefined => {
  const result = validateImportedDocument(text);
  return result.ok ? undefined : result.diagnostics[0]?.code;
};

describe('project import boundary', () => {
  it('accepts a current scene document', () => {
    const result = validateImportedDocument(JSON.stringify({ version: 1, name: 'Scene', layers: [], tracks: [] }));

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.document.kind).toBe('scene');
  });

  it('accepts a legacy project document', () => {
    const result = validateImportedDocument(JSON.stringify({ characterParts: [{ id: 'p1' }], tracks: [{ partId: 'p1', channels: {} }] }));

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.document.kind).toBe('legacy-project');
  });

  it('refuses malformed JSON with a stable code', () => {
    expect(refusalCode('{ not json')).toBe('KCS_IMPORT_MALFORMED_JSON');
  });

  it('refuses a document that is neither scene nor legacy project', () => {
    expect(refusalCode(JSON.stringify({ hello: 'world' }))).toBe('KCS_IMPORT_UNKNOWN_SHAPE');
  });

  it('refuses a document larger than the import limit before parsing it', () => {
    const oversized = `{"pad":"${'x'.repeat(MAX_IMPORT_CHARACTERS)}"}`;

    expect(refusalCode(oversized)).toBe('KCS_IMPORT_TOO_LARGE');
  });

  it('refuses a prototype-sensitive key at the top level', () => {
    expect(refusalCode('{"__proto__": {"polluted": true}}')).toBe('KCS_IMPORT_UNSAFE_KEY');
  });

  it('refuses a prototype-sensitive key nested inside the document', () => {
    const document = JSON.stringify({ version: 1, layers: [{ id: 'l1', nested: { list: [{ constructor: {} }] } }], tracks: [] });

    expect(refusalCode(document)).toBe('KCS_IMPORT_UNSAFE_KEY');
  });

  it('names the offending path so the author can find it', () => {
    const result = validateImportedDocument(JSON.stringify({ version: 1, layers: [{ prototype: {} }], tracks: [] }));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.diagnostics[0].path).toContain('layers');
      expect(result.diagnostics[0].message).toContain('prototype');
      expect(result.diagnostics[0].action.length).toBeGreaterThan(0);
    }
  });

  it('refuses a document above the declared layer limit', () => {
    const characterParts = Array.from({ length: MAX_IMPORT_LAYERS + 1 }, (_, index) => ({ id: `p${index}` }));

    expect(refusalCode(JSON.stringify({ characterParts, tracks: [] }))).toBe('KCS_IMPORT_TOO_MANY_LAYERS');
  });
});
