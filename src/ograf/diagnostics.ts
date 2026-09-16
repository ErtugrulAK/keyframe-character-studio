import type {
  OGrafDiagnosticCode,
  OGrafDiagnosticSeverity,
  OGrafExportDiagnostic,
  OGrafPackageWriteFailureCode,
} from './types';

/**
 * Accepted filesystem constraint. Every trusted-directory surface must state it
 * without claiming protection KCS does not provide.
 */
export const OGRAF_TRUSTED_DIRECTORY_NOTE = 'KCS requires trusted dedicated source and output directories; concurrent filesystem mutation by other processes is unsupported, and KCS does not claim perfect OS-level protection against it.';

/** Stable failure raised by the OGraf package materialization boundaries. */
export class OGrafPackageWriteError extends Error {
  readonly code: OGrafPackageWriteFailureCode;

  constructor(code: OGrafPackageWriteFailureCode, message: string) {
    super(message);
    this.name = 'OGrafPackageWriteError';
    this.code = code;
  }
}

interface OGrafDiagnosticRemediationTemplate {
  title: string;
  action: string;
}

const DIAGNOSTIC_REMEDIATIONS: Record<OGrafDiagnosticCode, OGrafDiagnosticRemediationTemplate> = {
  OGRAF_UNSUPPORTED_SHAPE: {
    title: 'Unsupported shape layer',
    action: 'Remove the layer, convert it to a supported shape, or bake it into an image asset before exporting again.',
  },
  OGRAF_UNSUPPORTED_VIDEO: {
    title: 'Unsupported video layer',
    action: 'Remove the video layer or replace it with exported image frames; OGraf Export V1 packages images, fonts, and generated runtime files only.',
  },
  OGRAF_UNSUPPORTED_PARTICLE: {
    title: 'Unsupported particle system',
    action: 'Remove the particle system, or bake its result into supported shape layers or an image sequence, then export again.',
  },
  OGRAF_UNSUPPORTED_CLONER: {
    title: 'Unsupported cloner',
    action: 'Remove the cloner, or bake its result into individual supported layers, then export again.',
  },
  OGRAF_UNSUPPORTED_BOOLEAN: {
    title: 'Unsupported boolean group',
    action: 'Dissolve or bake the boolean group into a supported shape, or export the boolean result as an image asset.',
  },
  OGRAF_UNSUPPORTED_ALPHA_MATTE: {
    title: 'Unsupported matte strength',
    action: 'Set the legacy matte strength back to 1, or bake the matted result into an image asset.',
  },
  OGRAF_UNSUPPORTED_LUMINANCE_MATTE: {
    title: 'Unsupported luminance matte',
    action: 'Switch the legacy matte to clip mode, or bake the matted result into an image asset.',
  },
  OGRAF_UNSUPPORTED_INVERTED_MATTE: {
    title: 'Unsupported inverted matte',
    action: 'Turn off matte inversion, or bake the matted result into an image asset.',
  },
  OGRAF_UNSUPPORTED_FEATHER_MATTE: {
    title: 'Unsupported matte feather',
    action: 'Set the legacy matte feather to 0, or bake the feathered result into an image asset.',
  },
  OGRAF_UNSUPPORTED_GRADIENT_MATTE: {
    title: 'Unsupported matte gradient',
    action: 'Remove the legacy matte gradient, or bake the matted result into an image asset.',
  },
  OGRAF_INVALID_TRACK_MATTE: {
    title: 'Invalid track matte',
    action: 'Point the track matte at a different existing layer; a layer cannot use itself as its matte source.',
  },
  OGRAF_CONDITIONAL_CLIP_MATTE: {
    title: 'Clip matte approximated',
    action: 'No action required: the clip matte is exported as a portable SVG clipPath. Check the host result if the matte is critical.',
  },
  OGRAF_UNSUPPORTED_NONDETERMINISTIC_PROCEDURAL: {
    title: 'Unsupported procedural animation',
    action: 'Replace shake/random animation presets with deterministic keyframes, then export again.',
  },
  OGRAF_EXTERNAL_ASSET_REJECTED: {
    title: 'External asset rejected',
    action: `Re-import the reported file as a local asset and keep it in a trusted dedicated source directory, then export again. ${OGRAF_TRUSTED_DIRECTORY_NOTE}`,
  },
  OGRAF_MISSING_ASSET: {
    title: 'Missing or unusable asset',
    action: `Re-select or re-import the reported file, confirm it still exists on disk, and keep local assets in a trusted dedicated source directory. ${OGRAF_TRUSTED_DIRECTORY_NOTE}`,
  },
  OGRAF_ASSET_UNVERIFIED: {
    title: 'Asset not verified',
    action: `Keep the reported asset in a trusted dedicated source directory so packaging can verify it; the generated package cannot fetch it at runtime. ${OGRAF_TRUSTED_DIRECTORY_NOTE}`,
  },
  OGRAF_FONT_UNVERIFIED: {
    title: 'Font is not portable',
    action: 'Import or upload the font file so KCS owns a portable copy, switch the layer to a font with an available file, or bake the text into an image asset.',
  },
  OGRAF_INVALID_PROJECT: {
    title: 'Invalid project data',
    action: 'Fix the reported project or layer field, then export again.',
  },
  OGRAF_INVALID_PUBLIC_FIELD: {
    title: 'Invalid public field',
    action: 'Give every public field a unique id without a slash and keep its layer in the scene.',
  },
  OGRAF_INVALID_MAIN: {
    title: 'Invalid package path',
    action: 'Rename the reported package file so it stays inside the package root and stays unique.',
  },
};

const WRITE_FAILURE_REMEDIATIONS: Record<OGrafPackageWriteFailureCode, OGrafDiagnosticRemediationTemplate> = {
  OGRAF_UNSAFE_OUTPUT_DIRECTORY: {
    title: 'Unsafe output location',
    action: `Choose a dedicated output directory owned by this project instead of a shared or temporary location. ${OGRAF_TRUSTED_DIRECTORY_NOTE}`,
  },
  OGRAF_UNSAFE_OUTPUT_TARGET: {
    title: 'Unsafe output target',
    action: `Write the package into a dedicated output directory owned by this project; existing symbolic links or non-regular files there are rejected. ${OGRAF_TRUSTED_DIRECTORY_NOTE}`,
  },
  OGRAF_UNSAFE_ASSET_SOURCE: {
    title: 'Unsafe asset source',
    action: `Move the asset into a trusted dedicated source directory as a regular file with no symbolic links, then import it again. ${OGRAF_TRUSTED_DIRECTORY_NOTE}`,
  },
  OGRAF_UNSAFE_PACKAGE_PATH: {
    title: 'Invalid packaged file path',
    action: 'Fix the reported package file path so it stays inside the package root and is unique, then export again.',
  },
  OGRAF_MISSING_PACKAGE_SOURCE: {
    title: 'Packaged file has no content',
    action: 'Re-import the reported asset so KCS owns its bytes, then export again.',
  },
  OGRAF_BLOCKED_PACKAGE: {
    title: 'Export blocked',
    action: 'Resolve the blocking diagnostics reported for this scene, then export again.',
  },
};

export interface OGrafDiagnosticRemediation {
  code: OGrafDiagnosticCode | OGrafPackageWriteFailureCode;
  severity: OGrafDiagnosticSeverity;
  /** Short, stable user-facing title. */
  title: string;
  /** Explanation carried by the export diagnostic authority. */
  message: string;
  /** Concrete next step for the user. */
  action: string;
  /** Safe display context: layer name or feature slug. */
  context?: string;
}

export interface OGrafExportRemediationReport {
  blocking: OGrafDiagnosticRemediation[];
  warnings: OGrafDiagnosticRemediation[];
  hasBlocking: boolean;
}

/** Deduplicates diagnostics of one severity once per root cause. */
function uniqueByRootCause(
  diagnostics: OGrafExportDiagnostic[],
  severity: OGrafDiagnosticSeverity,
): OGrafExportDiagnostic[] {
  const seen = new Set<string>();

  return diagnostics.filter((diagnostic) => {
    if (diagnostic.severity !== severity) return false;
    const fontRoot = diagnostic.code === 'OGRAF_FONT_UNVERIFIED'
      ? diagnostic.message.match(/uses (.*), but KCS has no portable font file/u)?.[1]
      : undefined;
    const key = `${diagnostic.code}:${fontRoot || diagnostic.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Returns export-blocking diagnostics once per root cause. */
export function getUniqueOGrafExportErrors(diagnostics: OGrafExportDiagnostic[]): OGrafExportDiagnostic[] {
  return uniqueByRootCause(diagnostics, 'ERROR');
}

/** Returns non-blocking diagnostics once per root cause. */
export function getUniqueOGrafExportWarnings(diagnostics: OGrafExportDiagnostic[]): OGrafExportDiagnostic[] {
  return uniqueByRootCause(diagnostics, 'WARNING');
}

/** Adds the user-facing title and next step for a single export diagnostic. */
export function describeOGrafExportDiagnostic(diagnostic: OGrafExportDiagnostic): OGrafDiagnosticRemediation {
  const template = DIAGNOSTIC_REMEDIATIONS[diagnostic.code];
  const context = diagnostic.layerName || diagnostic.feature;

  return {
    code: diagnostic.code,
    severity: diagnostic.severity,
    title: template.title,
    message: diagnostic.message,
    action: template.action,
    ...(context ? { context } : {}),
  };
}

/** Splits the diagnostics into blocking and warning remediation groups. */
export function getOGrafExportRemediationReport(diagnostics: OGrafExportDiagnostic[]): OGrafExportRemediationReport {
  const blocking = getUniqueOGrafExportErrors(diagnostics).map(describeOGrafExportDiagnostic);
  const warnings = getUniqueOGrafExportWarnings(diagnostics).map(describeOGrafExportDiagnostic);

  return { blocking, warnings, hasBlocking: blocking.length > 0 };
}

/**
 * Returns a display-safe path: machine-absolute paths are reduced to their final
 * segment, package-relative paths are kept as authored.
 */
export function sanitizeOGrafPathForDisplay(value: string): string {
  const trimmed = value.trim();
  const segments = trimmed.split(/[\\/]+/u).filter(Boolean);
  if (segments.length === 0) return '';
  return /^(?:[a-z]:[\\/]|[\\/])/iu.test(trimmed) ? segments[segments.length - 1] : segments.join('/');
}

/**
 * Converts a package materialization failure into user-facing remediation, or
 * null when the failure is not a recognized OGraf package write failure.
 */
export function describeOGrafPackageWriteFailure(error: unknown): OGrafDiagnosticRemediation | null {
  if (!(error instanceof OGrafPackageWriteError)) return null;
  const template = WRITE_FAILURE_REMEDIATIONS[error.code];
  const separator = error.message.indexOf(': ');
  const detail = separator === -1 ? '' : sanitizeOGrafPathForDisplay(error.message.slice(separator + 2));
  const message = separator === -1
    ? error.message
    : `${error.message.slice(0, separator)}${detail ? `: ${detail}` : ''}`;

  return {
    code: error.code,
    severity: 'ERROR',
    title: template.title,
    message,
    action: template.action,
    ...(detail ? { context: detail } : {}),
  };
}
