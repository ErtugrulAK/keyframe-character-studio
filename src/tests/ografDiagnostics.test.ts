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
import type {
  OGrafDiagnosticCode,
  OGrafExportDiagnostic,
  OGrafPackageWriteFailureCode,
} from '../ograf/types';

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

const ALL_PACKAGE_WRITE_FAILURE_CODES: OGrafPackageWriteFailureCode[] = [
  'OGRAF_UNSAFE_OUTPUT_DIRECTORY',
  'OGRAF_UNSAFE_OUTPUT_TARGET',
  'OGRAF_UNSAFE_ASSET_SOURCE',
  'OGRAF_UNSAFE_PACKAGE_PATH',
  'OGRAF_MISSING_PACKAGE_SOURCE',
  'OGRAF_PACKAGE_SOURCE_UNREADABLE',
  'OGRAF_OUTPUT_WRITE_FAILED',
  'OGRAF_BLOCKED_PACKAGE',
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

  it.each([
    [
      'Asset "C:\\Users\\alice\\private\\logo.png" uses a machine-absolute path and cannot be packaged portably.',
      'Asset "logo.png" uses a machine-absolute path and cannot be packaged portably.',
    ],
    [
      'Asset "C:\\Users\\Alice Smith\\private\\logo.png" uses a machine-absolute path and cannot be packaged portably.',
      'Asset "logo.png" uses a machine-absolute path and cannot be packaged portably.',
    ],
    [
      'Asset "\\\\server\\share\\private folder\\logo.png" uses a machine-absolute path and cannot be packaged portably.',
      'Asset "logo.png" uses a machine-absolute path and cannot be packaged portably.',
    ],
    [
      'Asset "/home/alice/private/logo.png" uses a machine-absolute path and cannot be packaged portably.',
      'Asset "logo.png" uses a machine-absolute path and cannot be packaged portably.',
    ],
    [
      'Asset "/home/Alice Smith/private/logo.png" uses a machine-absolute path and cannot be packaged portably.',
      'Asset "logo.png" uses a machine-absolute path and cannot be packaged portably.',
    ],
    [
      'Asset "/secret.png" uses a machine-absolute path and cannot be packaged portably.',
      'Asset "secret.png" uses a machine-absolute path and cannot be packaged portably.',
    ],
  ])('reduces a machine path in a diagnostic message to its final segment: %s', (message, expected) => {
    expect(describeOGrafExportDiagnostic(makeDiagnostic({ message })).message).toBe(expected);
  });

  it.each([
    [
      'External image asset "https://user:password@example.test/logo.png?token=secret" is rejected by the default portable export policy.',
      'External image asset "https://example.test/logo.png" is rejected by the default portable export policy.',
    ],
    [
      'External image asset "//user:password@example.test?token=secret" is rejected by the default portable export policy.',
      'External image asset "//example.test" is rejected by the default portable export policy.',
    ],
    [
      'External image asset "https://example.test/logo.png#access_token" is rejected by the default portable export policy.',
      'External image asset "https://example.test/logo.png" is rejected by the default portable export policy.',
    ],
    [
      'External image asset "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB" is rejected by the default portable export policy.',
      'External image asset "data:image/png (payload omitted)" is rejected by the default portable export policy.',
    ],
    [
      'External image asset "data:image/svg+xml,<svg>TOP_SECRET</svg>" is rejected by the default portable export policy.',
      'External image asset "data:image/svg+xml (payload omitted)" is rejected by the default portable export policy.',
    ],
    [
      'External image asset "data:image/svg+xml,<svg id="TOP_SECRET"/>" is rejected by the default portable export policy.',
      'External image asset "data:image/svg+xml (payload omitted)" is rejected by the default portable export policy.',
    ],
    [
      'External image asset "data:image/svg+xml,<svg onload="alert(1)">SECRET</svg>" is rejected by the default portable export policy.',
      'External image asset "data:image/svg+xml (payload omitted)" is rejected by the default portable export policy.',
    ],
    [
      'External image asset "data:image/svg+xml,<svg id="TOP_SECRET" onload="alert(1)">SECOND_SECRET</svg>" is rejected by the default portable export policy.',
      'External image asset "data:image/svg+xml (payload omitted)" is rejected by the default portable export policy.',
    ],
    [
      'External image asset "https://example.test?email=alice@private.test&token=TOP_SECRET" is rejected by the default portable export policy.',
      'External image asset "https://example.test" is rejected by the default portable export policy.',
    ],
    [
      'External image asset "https://alice:TOP@SECRET@example.test/logo.png?token=QUERY_SECRET" is rejected by the default portable export policy.',
      'External image asset "https://example.test/logo.png" is rejected by the default portable export policy.',
    ],
    [
      'Asset "file:///home/alice/private/logo.png" is not a supported local asset reference.',
      'Asset "file:///logo.png" is not a supported local asset reference.',
    ],
  ])('strips URL and embedded-payload secrets from a diagnostic message: %s', (message, expected) => {
    expect(describeOGrafExportDiagnostic(makeDiagnostic({ code: 'OGRAF_EXTERNAL_ASSET_REJECTED', message })).message).toBe(expected);
  });

  it.each([
    ['/home/alice/private/logo.png: permission denied', 'logo.png: permission denied'],
    ['C:\\Users\\alice\\private\\logo.png could not be opened', 'logo.png could not be opened'],
    ['/var/kcs/out: EACCES', 'out: EACCES'],
  ])('reduces a machine path that opens the text: %s', (message, expected) => {
    expect(describeOGrafExportDiagnostic(makeDiagnostic({ message })).message).toBe(expected);
  });

  it('redacts a bare machine path used as display context', () => {
    expect(describeOGrafExportDiagnostic(makeDiagnostic({ layerName: '/home/alice/private/logo.png' })).context).toBe('logo.png');
    expect(describeOGrafExportDiagnostic(makeDiagnostic({ layerName: 'C:\\Users\\alice\\logo.png' })).context).toBe('logo.png');
  });

  it('withholds a value that cannot be displayed safely', () => {
    const remediation = describeOGrafExportDiagnostic(makeDiagnostic({
      message: 'Asset "data:image/svg%2C%3Csvg%20onload%3Dalert(1)%3E" is not a supported local asset reference.',
      layerName: 'data:image/svg%2C%3Csvg%20onload%3Dalert(1)%3E',
    }));

    expect(remediation.message).not.toContain('onload');
    expect(remediation.message).toContain('withheld');
    expect(remediation.title.length).toBeGreaterThan(0);
    expect(remediation.action.length).toBeGreaterThan(0);
    expect(remediation.context).toBeUndefined();

    const writeFailure = describeOGrafPackageWriteFailure(new OGrafPackageWriteError(
      'OGRAF_UNSAFE_OUTPUT_TARGET',
      'Unsafe output target: data:image/svg%2C%3Csvg%20onload%3Dalert(1)%3E',
    ));

    expect(writeFailure?.message).toContain('withheld');
    expect(writeFailure?.message).not.toContain('onload');
    expect(writeFailure?.context).toBeUndefined();
  });

  it('keeps authored relative and package-relative paths readable', () => {
    const relative = describeOGrafExportDiagnostic(makeDiagnostic({
      message: 'Image asset "assets/missing.png" cannot be packaged without a verified local source or browser bytes.',
    }));
    expect(relative.message).toContain('assets/missing.png');

    const packaged = describeOGrafExportDiagnostic(makeDiagnostic({
      message: 'Packaged asset path "assets/images/logo.png" escapes the package root.',
    }));
    expect(packaged.message).toContain('assets/images/logo.png');

    const fontMessage = describeOGrafExportDiagnostic(makeDiagnostic({
      code: 'OGRAF_FONT_UNVERIFIED',
      message: 'Display Title uses Inter, but KCS has no portable font file for this font.',
    }));
    expect(fontMessage.message).toBe('Display Title uses Inter, but KCS has no portable font file for this font.');
  });

  it('redacts a machine path inside a wrapped filesystem failure message', () => {
    const remediation = describeOGrafPackageWriteFailure(new OGrafPackageWriteError(
      'OGRAF_PACKAGE_SOURCE_UNREADABLE',
      "Local asset source could not be read: ENOENT: no such file or directory, lstat 'C:\\Users\\alice\\private\\logo.png'",
    ));

    expect(remediation?.message).toContain('Local asset source could not be read');
    expect(remediation?.message).toContain('logo.png');
    expect(remediation?.message).not.toContain('C:\\Users');
    expect(remediation?.message).not.toContain('alice');
    expect(remediation?.context).toBeUndefined();

    const permissionFailure = describeOGrafPackageWriteFailure(new OGrafPackageWriteError(
      'OGRAF_OUTPUT_WRITE_FAILED',
      "OGraf package output could not be written: EACCES: permission denied, open '/home/alice/private/out'",
    ));

    expect(permissionFailure?.message).toContain('OGraf package output could not be written');
    expect(permissionFailure?.message).toContain('out');
    expect(permissionFailure?.message).not.toContain('/home/alice');
    expect(permissionFailure?.context).toBeUndefined();
  });

  it('gives every package write failure code a stable title and next step', () => {
    for (const code of ALL_PACKAGE_WRITE_FAILURE_CODES) {
      const remediation = describeOGrafPackageWriteFailure(new OGrafPackageWriteError(code, 'Failure without a path detail.'));

      expect(remediation?.code).toBe(code);
      expect(remediation?.severity).toBe('ERROR');
      expect(remediation?.title.length).toBeGreaterThan(0);
      expect(remediation?.action.length).toBeGreaterThan(0);
    }
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
