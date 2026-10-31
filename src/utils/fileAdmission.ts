import { MAX_IMPORT_CHARACTERS } from './importValidation';
import { OGRAF_PACKAGE_LIMITS } from '../ograf/packageLimits';

/**
 * Pre-admission limits for imported files.
 *
 * `FileReader` materializes a whole file in memory before any content check
 * can run, so the size contract has to be enforced on `File.size` BEFORE a
 * reader is created. The limits deliberately DERIVE from the authorities that
 * already govern the formats, instead of inventing parallel numbers:
 *
 * - Projects/Lottie/legacy text imports are validated post-read at
 *   `MAX_IMPORT_CHARACTERS` characters; a byte ceiling of twice that is the
 *   conservative outer guard (UTF-16 encoded text is the widest realistic
 *   expansion: 2 bytes per character, so any file that can pass the
 *   character check fits under the byte guard).
 * - OGraf packages already carry their own authoritative archive ceiling in
 *   `OGRAF_PACKAGE_LIMITS.bytes`; the same number is applied before the bytes
 *   are read, so the pre-admission and the decompression guard cannot drift.
 */

export const PROJECT_IMPORT_MAX_FILE_BYTES = MAX_IMPORT_CHARACTERS * 2;
export const PACKAGE_IMPORT_MAX_FILE_BYTES = OGRAF_PACKAGE_LIMITS.bytes;

interface FileAdmissionProblem {
  message: string;
}

/**
 * Returns a refusal (message only) when a text-import candidate cannot fit
 * the pre-read byte ceiling. `null` admits the file — shape and content are
 * still decided by the post-read import authorities, unchanged.
 */
export function projectFileAdmissionProblem(file: { size: number }): FileAdmissionProblem | null {
  if (file.size > PROJECT_IMPORT_MAX_FILE_BYTES) {
    return {
      message: `The project file is too large (over ${formatMebibytes(PROJECT_IMPORT_MAX_FILE_BYTES)}). Choose a file the exporter produced.`,
    };
  }
  return null;
}

/** The same contract for the binary package channel, on the importer's own ceiling. */
export function packageFileAdmissionProblem(file: { size: number }): FileAdmissionProblem | null {
  if (file.size > PACKAGE_IMPORT_MAX_FILE_BYTES) {
    return {
      message: `The OGraf package is too large (over ${formatMebibytes(PACKAGE_IMPORT_MAX_FILE_BYTES)}). Re-export it from a smaller scene.`,
    };
  }
  return null;
}

function formatMebibytes(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))} MiB`;
}
