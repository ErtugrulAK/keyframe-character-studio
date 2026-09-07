import type { OGrafExportDiagnostic } from './types';

/** Returns export-blocking diagnostics once per root cause. */
export function getUniqueOGrafExportErrors(diagnostics: OGrafExportDiagnostic[]): OGrafExportDiagnostic[] {
  const seen = new Set<string>();

  return diagnostics.filter((diagnostic) => {
    if (diagnostic.severity !== 'ERROR') return false;
    const key = `${diagnostic.code}:${diagnostic.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
