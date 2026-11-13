import type { OGrafExportDiagnostic } from './types';

/**
 * A per-layer reading of what an OGraf export would do, BEFORE the
 * user exports. It is derived only from the diagnostics the real export
 * pipeline produces (the same compile the Export command runs), so the report
 * can never promise more than the exporter delivers:
 *
 * - blocked:     at least one ERROR — the package will not be written;
 * - conditional: WARNINGs only — it exports, with the stated caveats;
 * - supported:   no diagnostic names the layer.
 *
 * "Supported" means "this exporter raised nothing for it", not that any OGraf
 * host renders it pixel-identically; host behaviour is not verified here.
 */
export type OGrafLayerCapability = 'supported' | 'conditional' | 'blocked';

export interface OGrafLayerCapabilityEntry {
  id: string;
  name: string;
  status: OGrafLayerCapability;
  issues: OGrafExportDiagnostic[];
}

export interface OGrafCapabilityReport {
  layers: OGrafLayerCapabilityEntry[];
  /** Diagnostics not tied to a layer of the scene (project-wide). */
  sceneIssues: OGrafExportDiagnostic[];
  counts: Record<OGrafLayerCapability, number>;
  /** False when any ERROR exists — the same rule the Export command applies. */
  canExport: boolean;
}

export const buildOGrafCapabilityReport = (
  layers: readonly { id: string; name?: string }[],
  diagnostics: readonly OGrafExportDiagnostic[],
): OGrafCapabilityReport => {
  const layerIds = new Set(layers.map((layer) => layer.id));
  const byLayer = new Map<string, OGrafExportDiagnostic[]>();
  const sceneIssues: OGrafExportDiagnostic[] = [];
  for (const diagnostic of diagnostics) {
    if (diagnostic.layerId && layerIds.has(diagnostic.layerId)) {
      byLayer.set(diagnostic.layerId, [...(byLayer.get(diagnostic.layerId) ?? []), diagnostic]);
    } else {
      sceneIssues.push(diagnostic);
    }
  }
  const entries = layers.map((layer): OGrafLayerCapabilityEntry => {
    const issues = byLayer.get(layer.id) ?? [];
    const status: OGrafLayerCapability = issues.some((issue) => issue.severity === 'ERROR')
      ? 'blocked'
      : issues.length > 0 ? 'conditional' : 'supported';
    return { id: layer.id, name: layer.name || layer.id, status, issues };
  });
  const counts: Record<OGrafLayerCapability, number> = { supported: 0, conditional: 0, blocked: 0 };
  entries.forEach((entry) => { counts[entry.status] += 1; });
  return {
    layers: entries,
    sceneIssues,
    counts,
    canExport: diagnostics.every((diagnostic) => diagnostic.severity !== 'ERROR'),
  };
};
