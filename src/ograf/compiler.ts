import type { SceneData } from '../types/composition';
import { validateSceneForOGraf } from './validation';
import {
  OGRAF_DEFAULT_MAIN,
  OGRAF_DEFAULT_VERSION,
  OGRAF_GRAPHICS_SCHEMA_URL,
  type OGrafExportDiagnostic,
  type OGrafExportOptions,
  type OGrafManifest,
  type OGrafPackagePlan,
} from './types';

function hashString(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function sanitizeOGrafId(value: string): string {
  const sanitized = value
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]+/gu, '-')
    .replace(/-+/gu, '-')
    .replace(/^[-.]+|[-.]+$/gu, '')
    .toLowerCase();
  return sanitized || 'graphic';
}

function getGraphicId(sceneData: SceneData, options: OGrafExportOptions): string {
  const explicit = options.graphicId?.trim();
  if (explicit) return sanitizeOGrafId(explicit);
  const base = sanitizeOGrafId(sceneData.name?.trim() || 'graphic');
  const fingerprint = hashString(JSON.stringify(sceneData));
  return `${base}-${fingerprint}`;
}

function getGraphicName(sceneData: SceneData, options: OGrafExportOptions): string {
  return options.name?.trim() || sceneData.name?.trim() || 'Keyframe Character Studio Graphic';
}
function collectCompilerDiagnostics(
  options: OGrafExportOptions,
  publicFields: Array<{ id: string }>,
): OGrafExportDiagnostic[] {
  const diagnostics: OGrafExportDiagnostic[] = [];
  for (const field of publicFields) {
    if (field.id.includes('/')) {
      diagnostics.push({
        code: 'OGRAF_INVALID_PUBLIC_FIELD',
        severity: 'ERROR',
        message: `Public field "${field.id}" must not contain a slash.`,
        feature: 'public-state',
      });
    }
  }
  const main = options.main?.trim() || OGRAF_DEFAULT_MAIN;
  if (!isSafeOGrafPackagePath(main)) {
    diagnostics.push({
      code: 'OGRAF_INVALID_MAIN',
      severity: 'ERROR',
      message: `Manifest main path "${main}" must be a safe package-relative file path.`,
      feature: 'manifest',
    });
  }
  return diagnostics;
}

export function isSafeOGrafPackagePath(value: string): boolean {
  const normalized = value.replace(/\\/gu, '/');
  return Boolean(normalized)
    && !normalized.startsWith('/')
    && !/^[a-zA-Z]:/u.test(normalized)
    && !normalized.split('/').some((segment) => segment === '..' || segment === '' || segment === '.')
    && !/[?#%]/u.test(normalized)
    && !/[^\x20-\x7E]/u.test(normalized)
    && !normalized.endsWith('/');
}

export interface OGrafManifestCompilation {
  manifest: OGrafManifest;
  diagnostics: OGrafExportDiagnostic[];
}

export function compileOGrafManifest(sceneData: SceneData, options: OGrafExportOptions = {}): OGrafManifestCompilation {
  const validated = validateSceneForOGraf(sceneData, options);
  const publicFields = [...validated.publicTextFields, ...validated.publicImageFields, ...validated.publicColorFields];
  const diagnostics = [...validated.diagnostics, ...collectCompilerDiagnostics(options, publicFields)];
  const manifest: OGrafManifest = {
    $schema: OGRAF_GRAPHICS_SCHEMA_URL,
    id: getGraphicId(sceneData, options),
    name: getGraphicName(sceneData, options),
    main: (options.main?.trim() || OGRAF_DEFAULT_MAIN).replace(/\\/gu, '/'),
    version: options.version?.trim() || OGRAF_DEFAULT_VERSION,
    supportsRealTime: true,
    supportsNonRealTime: false,
    stepCount: 1,
    schema: validated.publicStateSchema,
    ...(options.description?.trim() ? { description: options.description.trim() } : {}),
    ...(options.emitRenderRequirements === false ? {} : {
      renderRequirements: [{
        resolution: {
          width: { ideal: sceneData.width },
          height: { ideal: sceneData.height },
        },
        frameRate: { ideal: sceneData.fps },
      }],
    }),
  };
  return { manifest, diagnostics };
}

export function compileOGrafPackagePlan(sceneData: SceneData, options: OGrafExportOptions = {}): OGrafPackagePlan {
  const validated = validateSceneForOGraf(sceneData, options);
  const compiled = compileOGrafManifest(sceneData, options);
  const diagnostics = compiled.diagnostics;
  const graphicName = sanitizeOGrafId(options.name?.trim() || sceneData.name?.trim() || 'graphic');
  const manifestPath = `${graphicName}.ograf.json`;

  return {
    status: 'skeleton',
    isComplete: false,
    manifest: compiled.manifest,
    internalScenePayload: sceneData,
    diagnostics,
    assets: validated.assets,
    files: [
      { path: manifestPath, kind: 'manifest', status: 'planned' },
      { path: 'scene.kcs', kind: 'scene', status: 'planned' },
      { path: compiled.manifest.main, kind: 'runtime', status: 'pending-phase-2' },
    ],
  };
}
