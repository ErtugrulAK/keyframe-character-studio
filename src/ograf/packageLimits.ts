import { MAX_IMPORT_CHARACTERS } from '../utils/importValidation';

/**
 * Bounds for an imported package; reported, never silently truncated.
 *
 * Kept apart from the package reader so the file admission check can read the
 * limits without pulling the reader and its ZIP inflater into the editor's
 * initial chunk.
 */
export const OGRAF_PACKAGE_LIMITS = {
  /** Refuse an archive larger than this before decompressing anything. */
  bytes: 64 * 1024 * 1024,
  /** Refuse an archive with more entries than this. */
  entries: 512,
  /** Refuse a single entry larger than the scene import limit. */
  entryBytes: MAX_IMPORT_CHARACTERS,
  /** Refuse an archive whose declared contents add up to more than this. */
  totalBytes: 64 * 1024 * 1024,
} as const;
