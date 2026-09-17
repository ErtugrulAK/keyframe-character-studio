import { describe, expect, it } from 'vitest';
import { summarizeOGrafExportReadiness, OGRAF_TRUSTED_DIRECTORY_NOTE } from '../ograf/diagnostics';
import type { OGrafExportDiagnostic } from '../ograf/types';

/**
 * Milestone C — the first-export readiness check reads the SAME diagnostics
 * authority the export uses, so a blocked export can never be reported ready.
 */

const error = (overrides: Partial<OGrafExportDiagnostic> = {}): OGrafExportDiagnostic => ({
  severity: 'ERROR',
  code: 'OGRAF_UNSUPPORTED_SHAPE',
  message: 'Layer "Badge" uses a shape OGraf cannot describe.',
  layerName: 'Badge',
  ...overrides,
} as OGrafExportDiagnostic);

const warning = (overrides: Partial<OGrafExportDiagnostic> = {}): OGrafExportDiagnostic => ({
  severity: 'WARNING',
  code: 'OGRAF_FONT_UNVERIFIED',
  message: 'Display Title uses Inter, which is not packaged.',
  layerName: 'Display Title',
  ...overrides,
} as OGrafExportDiagnostic);

describe('summarizeOGrafExportReadiness', () => {
  it('reports ready with the archive it would write when nothing blocks', () => {
    const readiness = summarizeOGrafExportReadiness([], 'my-project');

    expect(readiness.status).toBe('ready');
    expect(readiness.title).toBe('Ready to export');
    expect(readiness.message).toContain('my-project-ograf.zip');
    expect(readiness.message).not.toContain('Exported');
    expect(readiness.action).toContain('OGraf Package');
  });

  it('never reports success when a blocking diagnostic exists', () => {
    const readiness = summarizeOGrafExportReadiness([error()], 'my-project');

    expect(readiness.status).toBe('blocked');
    expect(readiness.title).toContain('Export blocked');
    expect(readiness.title).toContain('Unsupported shape layer');
    expect(readiness.message).toContain('Badge');
    expect(readiness.action).toContain('Remove the layer');
    expect(readiness.blocking?.code).toBe('OGRAF_UNSUPPORTED_SHAPE');
    expect(readiness.message.toLowerCase()).not.toContain('ready to export');
    expect(readiness.message).not.toContain('-ograf.zip');
  });

  it('keeps warnings non-blocking and says so', () => {
    const readiness = summarizeOGrafExportReadiness([warning()], 'my-project');

    expect(readiness.status).toBe('warnings');
    expect(readiness.title).toContain('1 warning');
    expect(readiness.message).toContain('warnings do not block');
    expect(readiness.blocking).toBeUndefined();
  });

  it('counts warnings per root cause, in order, and stays blocked when an error exists', () => {
    const readiness = summarizeOGrafExportReadiness([warning(), warning({ layerName: 'Second' }), error()], 'my-project');
    expect(readiness.status).toBe('blocked');

    // Same code = same root cause, so the report deduplicates it (Task 105 rule).
    expect(summarizeOGrafExportReadiness([warning(), warning({ layerName: 'Second' })]).title).toBe('Ready to export with 1 warning');
    // Distinct root causes count separately.
    const twoCauses = summarizeOGrafExportReadiness([
      warning(),
      warning({ code: 'OGRAF_ASSET_UNVERIFIED', layerName: 'Card' }),
    ]);
    expect(twoCauses.title).toBe('Ready to export with 2 warnings');
  });

  it('uses the shared trusted-directory wording when no name is supplied', () => {
    const readiness = summarizeOGrafExportReadiness([]);
    expect(readiness.message).toContain('the -ograf.zip archive');
    expect(OGRAF_TRUSTED_DIRECTORY_NOTE).toContain('trusted dedicated source and output directories');
  });
});
