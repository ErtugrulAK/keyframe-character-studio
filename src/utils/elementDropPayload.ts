import type { BodyPartType } from '../types/animator';

/**
 * The single authority for `application/json` drops on the stage.
 *
 * The JSON drop channel is written only by the app's own drawer drag sources
 * (ElementsDrawer shapes, TextsDrawer text presets). Because any script with
 * DOM access — or any embedder hosting the editor — can synthesize the same
 * MIME type, the boundary parses and narrows the payload here instead of
 * handing a raw `JSON.parse` result to the document-mutating path.
 *
 * Rules:
 * - `type` must be a drop-creatable `BodyPartType` literal (allowlist below);
 *   prototype-sensitive identifiers such as `__proto__` can never pass.
 * - `name` keeps the historical `Dropped Element` fallback for absent, null or
 *   empty values, accepts a string or a finite number, rejects every other
 *   shape, and is clamped to 80 characters.
 * - The root must be a plain JSON object with no prototype-sensitive keys.
 * - Any extra payload fields are dropped, never forwarded.
 *
 * Anything that fails returns `null`; the caller applies nothing.
 */

/**
 * Types the drawer drag sources can legitimately send. Media types ride the
 * file-drop path instead, `custom_freeform` is guarded out at drag start
 * (drawing is a tool, not a draggable element), and the cloner/particle
 * renderers are created from the toolbar, never from a drop.
 */
export const ELEMENT_DROP_TYPES: readonly BodyPartType[] = Object.freeze([
  'custom_star',
  'custom_circle',
  'custom_box',
  'custom_rect',
  'custom_triangle',
  'custom_text',
  'custom_banner',
  'custom_capsule',
  'custom_diamond',
  'custom_parallelogram',
  'custom_card',
]);

const ELEMENT_DROP_NAME_FALLBACK = 'Dropped Element';

const DROP_NAME_MAX_LENGTH = 80;

const ELEMENT_DROP_TYPE_SET: ReadonlySet<string> = new Set(ELEMENT_DROP_TYPES);

/** Keys whose presence in a JSON payload root signals a prototype-pollution attempt. */
const PROTOTYPE_SENSITIVE_KEYS: ReadonlySet<string> = new Set([
  '__proto__',
  'constructor',
  'prototype',
]);

interface ElementDropPayload {
  type: BodyPartType;
  name: string;
}

export function parseElementDropPayload(raw: unknown): ElementDropPayload | null {
  if (typeof raw !== 'string' || raw.length === 0) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return null;
  }

  const record = parsed as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (PROTOTYPE_SENSITIVE_KEYS.has(key)) {
      return null;
    }
  }

  const type = record.type;
  if (typeof type !== 'string' || !ELEMENT_DROP_TYPE_SET.has(type)) {
    return null;
  }

  const rawName = record.name;
  if (
    rawName !== undefined &&
    rawName !== null &&
    typeof rawName !== 'string' &&
    !(typeof rawName === 'number' && Number.isFinite(rawName))
  ) {
    return null;
  }

  const name = rawName === undefined || rawName === null || rawName === ''
    ? ELEMENT_DROP_NAME_FALLBACK
    : String(rawName);
  return {
    type: type as BodyPartType,
    name: name.slice(0, DROP_NAME_MAX_LENGTH),
  };
}
