/**
 * Loss report for the Lottie importer (Milestone F, item 10).
 *
 * One entry per affected construct, shaped like the existing export diagnostics
 * (`src/ograf/diagnostics.ts`) so the import UI needs no second reporting model.
 * The design's contract (`docs/design/KCS_LOTTIE_IMPORT_MAPPING.md` §8) requires
 * a stable code, the source document path, a severity, a message and a concrete
 * action for every entry — an entry without an action is not actionable and
 * therefore not allowed here.
 */
export interface LottieImportDiagnostic {
  code: string;
  severity: 'error' | 'warning';
  feature: string;
  /** Path inside the Lottie document, for example `layers[3].shapes[1].ef[0]`. */
  path: string;
  message: string;
  action: string;
}

export const lottieWarning = (code: string, path: string, message: string, action: string): LottieImportDiagnostic => ({
  code,
  severity: 'warning',
  feature: 'lottie-import',
  path,
  message,
  action,
});

export const lottieError = (code: string, path: string, message: string, action: string): LottieImportDiagnostic => ({
  code,
  severity: 'error',
  feature: 'lottie-import',
  path,
  message,
  action,
});

/** Limits from the design's first cut (§7): reported, never silently reduced. */
export const LOTTIE_IMPORT_LIMITS = {
  keyframesPerChannel: 512,
  /** Masks imported per layer; further masks are reported per mask. */
  masksPerLayer: 8,
  /** Parent-chain depth; deeper chains are reported. */
  hierarchyDepth: 32,
  verticesPerPath: 4096,
  /** Refuse documents larger than this before parsing them. */
  characters: 32 * 1024 * 1024,
} as const;

export const summarizeLottieDiagnostics = (diagnostics: LottieImportDiagnostic[]): { errors: number; warnings: number } => ({
  errors: diagnostics.filter((entry) => entry.severity === 'error').length,
  warnings: diagnostics.filter((entry) => entry.severity === 'warning').length,
});
