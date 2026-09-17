import type {
  OGrafDiagnosticCode,
  OGrafDiagnosticSeverity,
  OGrafExportDiagnostic,
  OGrafPackageWriteFailureCode,
} from './types';

const OGRAF_URL_PATTERN = /(?:[a-z][a-z0-9+.-]*:)?\/\/[^\s"'<>]*/giu;
const OGRAF_QUOTED_SPAN_PATTERN = /"[^"]*"|'[^']*'/gu;
/** A drive, UNC, or leading-slash value whose spaces continue only into further segments. */
const OGRAF_WHOLE_ABSOLUTE_PATH_PATTERN = /^(?:(?:[a-z]:[\\/]|\\\\)|\/)(?:[^\s"'<>]|\s(?=[^\s"'<>]*[\\/]))*$/iu;
const OGRAF_UNQUOTED_WINDOWS_PATH_PATTERN = /(?<![\w+.-])(?:[a-z]:[\\/]|\\\\)[^\s"'<>]*(?:\s+[^\s"'<>]*[\\/][^\s"'<>]*)*/giu;
const OGRAF_UNQUOTED_POSIX_PATH_PATTERN = /(?:^|(?<=[\s"'<(]))\/(?!\/)(?:[^\s"'<>]|\s(?=[^\s"'<>]*\/))+/gu;
/** Text that still resembles a machine path, URL secret, or embedded payload after redaction. */
const OGRAF_RESIDUAL_SECRET_PATTERN = /(?:(?<![\w+.-])[a-z]:[\\/]|\\\\|(?:^|[\s"'<(])\/(?!\/)[^\s"'<>]*\/|(?:[a-z][a-z0-9+.-]*:)?\/\/[^\s"'<>]*[@?#]|data:[^\s"'<>]*(?:[;,%]|[^\s"'<>]{60,}))/iu;
const OGRAF_WITHHELD_VALUE_MESSAGE = 'The reported value is withheld because it cannot be displayed safely.';

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
    action: 'Remove the layer, or convert it to a supported shape layer (box, rectangle, circle, triangle, star, diamond, parallelogram, capsule, freeform, text, or image), then export again.',
  },
  OGRAF_UNSUPPORTED_VIDEO: {
    title: 'Unsupported video layer',
    action: 'Remove the layer, or replace it with an image asset you author outside KCS; OGraf Export V1 packages images, fonts, and generated runtime files only.',
  },
  OGRAF_UNSUPPORTED_PARTICLE: {
    title: 'Unsupported particle system',
    action: 'Remove the layer, or replace it with the supported shape or image layers it should export as, then export again.',
  },
  OGRAF_UNSUPPORTED_CLONER: {
    title: 'Unsupported cloner',
    action: 'Remove the layer, or replace it with the individual supported layers it should export as, then export again.',
  },
  OGRAF_UNSUPPORTED_BOOLEAN: {
    title: 'Unsupported boolean group',
    action: 'Dissolve the boolean group into its operand layers, adjust them so the exported result still reads correctly, then export again.',
  },
  OGRAF_UNSUPPORTED_ALPHA_MATTE: {
    title: 'Unsupported matte strength',
    action: 'Set the legacy matte strength back to 1 on this layer, then export again.',
  },
  OGRAF_UNSUPPORTED_LUMINANCE_MATTE: {
    title: 'Unsupported luminance matte',
    action: 'Switch this layer to clip-mode matte, or remove the legacy matte, then export again.',
  },
  OGRAF_UNSUPPORTED_INVERTED_MATTE: {
    title: 'Unsupported inverted matte',
    action: 'Turn off matte inversion on this layer, then export again.',
  },
  OGRAF_UNSUPPORTED_FEATHER_MATTE: {
    title: 'Unsupported matte feather',
    action: 'Set the legacy matte feather to 0 on this layer, then export again.',
  },
  OGRAF_UNSUPPORTED_GRADIENT_MATTE: {
    title: 'Unsupported matte gradient',
    action: 'Remove the legacy matte gradient from this layer, then export again.',
  },
  OGRAF_INVALID_TRACK_MATTE: {
    title: 'Invalid track matte',
    action: 'Point the track matte at an existing layer that is not this layer and does not create a matte cycle, then export again.',
  },
  OGRAF_CONDITIONAL_CLIP_MATTE: {
    title: 'Clip matte approximated',
    action: 'No action required: the clip matte is exported as a portable SVG clipPath. Check the matte in the host if it is critical.',
  },
  OGRAF_UNSUPPORTED_NONDETERMINISTIC_PROCEDURAL: {
    title: 'Unsupported procedural animation',
    action: 'Replace the shake/random preset on this layer with explicit keyframes, then export again.',
  },
  OGRAF_EXTERNAL_ASSET_REJECTED: {
    title: 'External asset rejected',
    action: `Re-import the file as a local asset and keep it in a trusted dedicated source directory, then export again. ${OGRAF_TRUSTED_DIRECTORY_NOTE}`,
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
    action: 'Import or upload the font file so KCS owns a portable copy, switch the layer to a font that already has a file, or replace the text layer with an image asset.',
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
  OGRAF_PACKAGE_SOURCE_UNREADABLE: {
    title: 'Asset source could not be read',
    action: `Confirm the reported asset still exists, is readable, and is a regular file inside a trusted dedicated source directory, then re-import it. ${OGRAF_TRUSTED_DIRECTORY_NOTE}`,
  },
  OGRAF_OUTPUT_WRITE_FAILED: {
    title: 'Package could not be written',
    action: `Verify the output directory exists, is writable, and stays inside the trusted project directory, then export again. ${OGRAF_TRUSTED_DIRECTORY_NOTE}`,
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
  const message = sanitizeOGrafDiagnosticText(diagnostic.message);
  const context = sanitizeOGrafDiagnosticText(diagnostic.layerName || diagnostic.feature || '');

  return {
    code: diagnostic.code,
    severity: diagnostic.severity,
    title: template.title,
    message: OGRAF_RESIDUAL_SECRET_PATTERN.test(message) ? OGRAF_WITHHELD_VALUE_MESSAGE : message,
    action: template.action,
    ...(context && !OGRAF_RESIDUAL_SECRET_PATTERN.test(context) ? { context } : {}),
  };
}

/** Splits the diagnostics into blocking and warning remediation groups. */
export function getOGrafExportRemediationReport(diagnostics: OGrafExportDiagnostic[]): OGrafExportRemediationReport {
  const blocking = getUniqueOGrafExportErrors(diagnostics).map(describeOGrafExportDiagnostic);
  const warnings = getUniqueOGrafExportWarnings(diagnostics).map(describeOGrafExportDiagnostic);

  return { blocking, warnings, hasBlocking: blocking.length > 0 };
}

/**
 * Pre-flight answer for the first-export guidance: what the existing diagnostics
 * authority already says about the current scene, expressed as one user-facing
 * status. This reads the same report the export handlers use, so the check and
 * the export can never disagree, and it never implies that a package was written.
 */
export interface OGrafExportReadiness {
  status: 'ready' | 'warnings' | 'blocked';
  /** Stable short title, same shape as a diagnostic title. */
  title: string;
  message: string;
  action: string;
  /** The blocking finding the user has to fix first, when there is one. */
  blocking?: OGrafDiagnosticRemediation;
}

/** Copy for the readiness check. The package name is shown, never claimed as written. */
const OGRAF_READINESS_ACTION = 'Choose "OGraf Package" in the Export menu to write the archive.';

export function summarizeOGrafExportReadiness(
  diagnostics: OGrafExportDiagnostic[],
  /** Already sanitized archive base name (no extension); the caller owns that authority. */
  packageBaseName?: string,
): OGrafExportReadiness {
  const report = getOGrafExportRemediationReport(diagnostics);
  // Same naming rule as the ZIP writer in ./browserZip: <sanitized name>-ograf.zip.
  const target = packageBaseName ? `${packageBaseName}-ograf.zip` : 'the -ograf.zip archive';

  if (report.hasBlocking) {
    const blocking = report.blocking[0];
    return {
      status: 'blocked',
      title: `Export blocked: ${blocking.title}`,
      message: blocking.context ? `${blocking.context}: ${blocking.message}` : blocking.message,
      action: blocking.action,
      blocking,
    };
  }

  if (report.warnings.length > 0) {
    return {
      status: 'warnings',
      title: `Ready to export with ${report.warnings.length} warning${report.warnings.length === 1 ? '' : 's'}`,
      message: `No blocking problem was found. Exporting writes ${target}; warnings do not block the package.`,
      action: OGRAF_READINESS_ACTION,
    };
  }

  return {
    status: 'ready',
    title: 'Ready to export',
    message: `No blocking problem was found. Exporting writes ${target} with the generated runtime.`,
    action: OGRAF_READINESS_ACTION,
  };
}

/**
 * Returns a display-safe path: machine-absolute paths are reduced to their final
 * segment, package-relative paths are kept as authored.
 */
export function sanitizeOGrafPathForDisplay(value: string): string {
  const trimmed = value.trim().split(/[?#]/u)[0];
  const segments = trimmed.split(/[\\/]+/u).filter(Boolean);
  if (segments.length === 0) return '';
  return /^(?:[a-z]:[\\/]|[\\/])/iu.test(trimmed) ? segments[segments.length - 1] : segments.join('/');
}

/** Strips credentials, query, and fragment secrets from an absolute or protocol-relative URL. */
function redactOGrafUrlSecrets(token: string): string {
  const prefixMatch = token.match(/^(?:[a-z][a-z0-9+.-]*:)?\/\//iu);
  const prefix = prefixMatch ? prefixMatch[0] : '//';
  const withoutQuery = token.slice(prefix.length).split(/[?#]/u)[0];
  const pathIndex = withoutQuery.indexOf('/');
  const atIndex = withoutQuery.lastIndexOf('@', pathIndex === -1 ? withoutQuery.length : pathIndex);
  const authority = atIndex === -1 ? withoutQuery : withoutQuery.slice(atIndex + 1);
  // A URL with an empty host keeps the machine path in its path component.
  if (authority.startsWith('/')) return `${prefix}/${sanitizeOGrafPathForDisplay(authority)}`;
  return `${prefix}${authority}`;
}

/**
 * Keeps only the media type of an embedded payload. A trailing quote that delimits
 * the value in the surrounding message is preserved.
 */
function redactOGrafDataUrl(token: string): string {
  const closingQuote = /["']$/u.test(token) ? token.slice(-1) : '';
  const body = closingQuote ? token.slice(0, -1) : token;
  const rest = body.slice(5);
  const mediaType = rest.split(/[;,]/u)[0].trim();
  // An empty payload, or a value already reduced to its media type, stays as is.
  if (mediaType.length === rest.length) return token;
  return mediaType
    ? `data:${mediaType} (payload omitted)${closingQuote}`
    : `data:(payload omitted)${closingQuote}`;
}

/**
 * Redacts every embedded data URL payload. A quoted payload ends at the last quote
 * of the text, which is the closing quote of the value the message is quoting, so
 * payloads holding inner quotes and markup are consumed whole.
 */
function redactEmbeddedDataUrls(value: string): string {
  const start = value.indexOf('data:');
  if (start === -1) return value;

  const openingQuote = value.lastIndexOf('"', start);
  const closingQuote = value.lastIndexOf('"');
  let end: number;
  if (openingQuote !== -1 && closingQuote > start) {
    end = closingQuote + 1;
  } else {
    const whitespace = value.slice(start).search(/\s/u);
    end = whitespace === -1 ? value.length : start + whitespace;
  }

  return value.slice(0, start)
    + redactOGrafDataUrl(value.slice(start, end))
    + redactEmbeddedDataUrls(value.slice(end));
}

/**
 * Renders a user-authored reference so a diagnostic can quote it without carrying a
 * machine path, URL credentials, query secrets, or an embedded payload.
 */
export function describeOGrafValueForDiagnostics(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) return '<empty>';
  if (/^data:/iu.test(trimmed)) return redactOGrafDataUrl(trimmed);
  if (trimmed.startsWith('//')) return redactOGrafUrlSecrets(trimmed);
  // A drive letter is not a URI scheme, so machine paths are checked before schemes.
  if (/^(?:[a-z]:[\\/]|\\\\|[\\/])/iu.test(trimmed)) return sanitizeOGrafPathForDisplay(trimmed);

  const schemeMatch = trimmed.match(/^[a-z][a-z0-9+.-]*:/iu);
  if (schemeMatch) {
    return trimmed.slice(schemeMatch[0].length).startsWith('//')
      ? redactOGrafUrlSecrets(trimmed)
      : `${schemeMatch[0]}(value omitted)`;
  }
  return trimmed;
}

/**
 * Redacts machine paths and URL secrets from diagnostic text before it reaches a
 * user-facing surface. Authored relative and package-relative paths are preserved.
 *
 * A path is redacted when it is machine-absolute: a drive, UNC, or leading-slash
 * prefix. Spaces inside such a path are kept only while a further separator follows,
 * so ordinary message words are never swallowed, and quoted spans are redacted
 * wholesale, which covers paths whose own segments contain spaces.
 */
export function sanitizeOGrafDiagnosticText(value: string): string {
  const trimmed = value.trim();
  if (OGRAF_WHOLE_ABSOLUTE_PATH_PATTERN.test(trimmed)) return sanitizeOGrafPathForDisplay(trimmed);

  return redactEmbeddedDataUrls(value)
    .replace(OGRAF_QUOTED_SPAN_PATTERN, (span) => {
      const inner = span.slice(1, -1).trim();
      const looksLikeUrl = inner.startsWith('//') || inner.includes('://');
      return !looksLikeUrl && OGRAF_WHOLE_ABSOLUTE_PATH_PATTERN.test(inner)
        ? `${span[0]}${sanitizeOGrafPathForDisplay(inner)}${span[0]}`
        : span;
    })
    .replace(OGRAF_URL_PATTERN, redactOGrafUrlSecrets)
    .replace(OGRAF_UNQUOTED_WINDOWS_PATH_PATTERN, (match) => sanitizeOGrafPathForDisplay(match))
    .replace(OGRAF_UNQUOTED_POSIX_PATH_PATTERN, (match) => sanitizeOGrafPathForDisplay(match));
}

/**
 * Converts a package materialization failure into user-facing remediation, or
 * null when the failure is not a recognized OGraf package write failure.
 */
export function describeOGrafPackageWriteFailure(error: unknown): OGrafDiagnosticRemediation | null {
  if (!(error instanceof OGrafPackageWriteError)) return null;
  const template = WRITE_FAILURE_REMEDIATIONS[error.code];
  const separator = error.message.indexOf(': ');
  const reason = (separator === -1 ? error.message : error.message.slice(0, separator)).trim();
  const rawDetail = separator === -1 ? '' : error.message.slice(separator + 2).trim();
  // KCS-owned failures carry a path detail; a wrapped OS message carries a sentence
  // (it always has its own "ERRNO: ..." colon), so it must go through text redaction.
  const detailIsPath = rawDetail.length > 0 && !rawDetail.includes(': ');
  const sanitizedDetail = sanitizeOGrafDiagnosticText(rawDetail);
  const detail = detailIsPath ? sanitizeOGrafPathForDisplay(sanitizedDetail) : sanitizedDetail;
  const message = sanitizeOGrafDiagnosticText(detail ? `${reason}: ${detail}` : reason);

  return {
    code: error.code,
    severity: 'ERROR',
    title: template.title,
    message: OGRAF_RESIDUAL_SECRET_PATTERN.test(message) ? OGRAF_WITHHELD_VALUE_MESSAGE : message,
    action: template.action,
    ...(detailIsPath && detail && !OGRAF_RESIDUAL_SECRET_PATTERN.test(detail) ? { context: detail } : {}),
  };
}
