import { describe, expect, it } from 'vitest';
import {
  OGRAF_TRUSTED_DIRECTORY_NOTE,
  OGrafPackageWriteError,
  describeOGrafExportDiagnostic,
  describeOGrafPackageWriteFailure,
  getOGrafExportRemediationReport,
  getUniqueOGrafExportErrors,
  getUniqueOGrafExportWarnings,
  sanitizeOGrafPathForDisplay,
} from '../ograf/diagnostics';
import type { OGrafDiagnosticCode, OGrafExportDiagnostic } from '../ograf/types';

const ALL_OGRAF_DIAGNOSTIC_CODES: OGrafDiagnosticCode[] = [
  'OGRAF_UNSUPPORTED_SHAPE',
  'OGRAF_UNSUPPORTED_VIDEO',
  'OGRAF_UNSUPPORTED_PARTICLE',
  'OGRAF_UNSUPPORTED_CLONER',
  'OGRAF_UNSUPPORTED_BOOLEAN',
  'OGRAF_UNSUPPORTED_ALPHA_MATTE',
  'OGRAF_UNSUPPORTED_LUMINANCE_MATTE',
  'OGRAF_UNSUPPORTED_INVERTED_MATTE',
  'OGRAF_CONDITIONAL_CLIP_MATTE',
  'OGRAF_UNSUPPORTED_FEATHER_MATTE',
  'OGRAF_UNSUPPORTED_GRADIENT_MATTE',
  'OGRAF_INVALID_TRACK_MATTE',
  'OGRAF_UNSUPPORTED_NONDETERMINISTIC_PROCEDURAL',
  'OGRAF_EXTERNAL_ASSET_REJECTED',
  'OGRAF_MISSING_ASSET',
  'OGRAF_ASSET_UNVERIFIED',
  'OGRAF_FONT_UNVERIFIED',
  'OGRAF_INVALID_PROJECT',
  'OGRAF_INVALID_PUBLIC_FIELD',
  'OGRAF_INVALID_MAIN',
];

function makeDiagnostic(overrides: Partial<OGrafExportDiagnostic> = {}): OGrafExportDiagnostic {
  return {
    code: 'OGRAF_MISSING_ASSET',
    severity: 'ERROR',
    message: 'Image asset "assets/missing.png" cannot be packaged without a verified local source or browser bytes.',
    ...overrides,
  };
}

describe('OGraf export diagnostics remediation', () => {
  it('gives every diagnostic code a stable title and a next step', () => {
    for (const code of ALL_OGRAF_DIAGNOSTIC_CODES) {
      const source = makeDiagnostic({ code });
      const remediation = describeOGrafExportDiagnostic(source);

      expect(remediation.code).toBe(code);
      expect(remediation.title.length).toBeGreaterThan(0);
      expect(remediation.message).toBe(source.message);
      expect(remediation.action.length).toBeGreaterThan(0);
    }
  });

  it('keeps blocking diagnostics unique per root cause and separates warnings', () => {
    const fontMessage = 'Display Title uses Inter, but KCS has no portable font file for this font. Import/upload the font file or choose a portable font before OGraf export.';
    const report = getOGrafExportRemediationReport([
      makeDiagnostic({ code: 'OGRAF_FONT_UNVERIFIED', message: fontMessage }),
      makeDiagnostic({ code: 'OGRAF_FONT_UNVERIFIED', message: fontMessage }),
      makeDiagnostic({ code: 'OGRAF_UNSUPPORTED_VIDEO', message: 'Layer type "custom_video" is not supported by OGraf Export V1.' }),
      makeDiagnostic({ code: 'OGRAF_CONDITIONAL_CLIP_MATTE', severity: 'WARNING', message: 'Clip matte is emitted as a portable SVG clipPath.' }),
    ]);

    expect(report.hasBlocking).toBe(true);
    expect(report.blocking.map((remediation) => remediation.code)).toEqual([
      'OGRAF_FONT_UNVERIFIED',
      'OGRAF_UNSUPPORTED_VIDEO',
    ]);
    expect(report.warnings.map((remediation) => remediation.code)).toEqual(['OGRAF_CONDITIONAL_CLIP_MATTE']);
  });

  it('reports warning-only diagnostics as non-blocking', () => {
    const report = getOGrafExportRemediationReport([
      makeDiagnostic({ code: 'OGRAF_CONDITIONAL_CLIP_MATTE', severity: 'WARNING', message: 'Clip matte is emitted as a portable SVG clipPath.' }),
    ]);

    expect(report.hasBlocking).toBe(false);
    expect(report.blocking).toEqual([]);
    expect(report.warnings).toHaveLength(1);
    expect(report.warnings[0].action).toContain('No action required');
  });

  it('prefers the layer name as display context and falls back to the feature', () => {
    expect(describeOGrafExportDiagnostic(makeDiagnostic({ layerName: 'Background', feature: 'image' })).context).toBe('Background');
    expect(describeOGrafExportDiagnostic(makeDiagnostic({ feature: 'image' })).context).toBe('image');
    expect(describeOGrafExportDiagnostic(makeDiagnostic()).context).toBeUndefined();
  });

  it('keeps the public dedupe helpers split by severity', () => {
    const diagnostics = [
      makeDiagnostic(),
      makeDiagnostic({ code: 'OGRAF_ASSET_UNVERIFIED', severity: 'WARNING', message: 'Local image asset "assets/logo.png" has no supplied asset catalog entry; packaging must verify it later.' }),
      makeDiagnostic({ code: 'OGRAF_ASSET_UNVERIFIED', severity: 'WARNING', message: 'Local image asset "assets/logo.png" has no supplied asset catalog entry; packaging must verify it later.' }),
    ];

    expect(getUniqueOGrafExportErrors(diagnostics)).toHaveLength(1);
    expect(getUniqueOGrafExportWarnings(diagnostics)).toHaveLength(1);
  });

  it('reduces machine paths to a display-safe form', () => {
    expect(sanitizeOGrafPathForDisplay('C:\\Users\\dev\\kcs-output')).toBe('kcs-output');
    expect(sanitizeOGrafPathForDisplay('/tmp/kcs/output')).toBe('output');
    expect(sanitizeOGrafPathForDisplay('\\\\server\\share\\assets')).toBe('assets');
    expect(sanitizeOGrafPathForDisplay('assets/images/logo.png')).toBe('assets/images/logo.png');
    expect(sanitizeOGrafPathForDisplay('   ')).toBe('');
  });

  it('states the accepted trusted-directory constraints without leaking machine paths', () => {
    const remediation = describeOGrafPackageWriteFailure(new OGrafPackageWriteError(
      'OGRAF_UNSAFE_OUTPUT_DIRECTORY',
      'Unsafe output directory: C:\\Users\\dev\\shared output',
    ));

    expect(remediation).not.toBeNull();
    expect(remediation?.severity).toBe('ERROR');
    expect(remediation?.title).toBe('Unsafe output location');
    expect(remediation?.message).toBe('Unsafe output directory: shared output');
    expect(remediation?.context).toBe('shared output');
    expect(remediation?.action).toContain('trusted dedicated source and output directories');
    expect(remediation?.action).toContain('concurrent filesystem mutation by other processes is unsupported');
    expect(remediation?.action).toContain('does not claim perfect OS-level protection');
    expect(remediation?.action).toContain(OGRAF_TRUSTED_DIRECTORY_NOTE);
  });

  it('ignores failures that are not OGraf package write failures', () => {
    expect(describeOGrafPackageWriteFailure(new Error('Unsafe output directory: /tmp/out'))).toBeNull();
    expect(describeOGrafPackageWriteFailure('Unsafe output directory: /tmp/out')).toBeNull();
    expect(describeOGrafPackageWriteFailure(undefined)).toBeNull();
  });

  it('keeps a write failure without a path detail readable', () => {
    const remediation = describeOGrafPackageWriteFailure(new OGrafPackageWriteError('OGRAF_BLOCKED_PACKAGE', 'OGraf package validation failed.'));

    expect(remediation?.message).toBe('OGraf package validation failed.');
    expect(remediation?.context).toBeUndefined();
    expect(remediation?.action).toContain('blocking diagnostics');
  });
});
