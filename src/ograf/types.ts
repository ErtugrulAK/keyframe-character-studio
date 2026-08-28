import type { SceneData } from '../types/composition';

export const OGRAF_GRAPHICS_SCHEMA_URL = 'https://ograf.ebu.io/v1/specification/json-schemas/graphics/schema.json';
export const OGRAF_DEFAULT_MAIN = 'graphic.mjs';
export const OGRAF_DEFAULT_VERSION = '1.0.0';

export type OGrafDiagnosticSeverity = 'ERROR' | 'WARNING';

export type OGrafDiagnosticCode =
  | 'OGRAF_UNSUPPORTED_SHAPE'
  | 'OGRAF_UNSUPPORTED_VIDEO'
  | 'OGRAF_UNSUPPORTED_PARTICLE'
  | 'OGRAF_UNSUPPORTED_CLONER'
  | 'OGRAF_UNSUPPORTED_BOOLEAN'
  | 'OGRAF_UNSUPPORTED_ALPHA_MATTE'
  | 'OGRAF_UNSUPPORTED_LUMINANCE_MATTE'
  | 'OGRAF_UNSUPPORTED_INVERTED_MATTE'
  | 'OGRAF_CONDITIONAL_CLIP_MATTE'
  | 'OGRAF_UNSUPPORTED_FEATHER_MATTE'
  | 'OGRAF_UNSUPPORTED_GRADIENT_MATTE'
  | 'OGRAF_UNSUPPORTED_NONDETERMINISTIC_PROCEDURAL'
  | 'OGRAF_EXTERNAL_ASSET_REJECTED'
  | 'OGRAF_MISSING_ASSET'
  | 'OGRAF_ASSET_UNVERIFIED'
  | 'OGRAF_FONT_UNVERIFIED'
  | 'OGRAF_INVALID_PROJECT'
  | 'OGRAF_INVALID_PUBLIC_FIELD';

export interface OGrafExportDiagnostic {
  code: OGrafDiagnosticCode;
  severity: OGrafDiagnosticSeverity;
  message: string;
  layerId?: string;
  layerName?: string;
  feature?: string;
}

export interface OGrafAssetCatalogEntry {
  kind: 'local' | 'external' | 'missing';
  packagedPath?: string;
  /** Filesystem source used only by the Phase 2B materializer. */
  sourcePath?: string;
}

export interface OGrafPublicTextField {
  id: string;
  title?: string;
  defaultValue?: string;
  layerId: string;
}

export interface OGrafPublicImageField {
  id: string;
  title?: string;
  defaultValue?: string;
  layerId: string;
}

export interface OGrafPublicStateSchema {
  type: 'object';
  properties: Record<string, Record<string, unknown>>;
  required?: string[];
}

export interface OGrafExportOptions {
  /** Stable, portable override. It is never generated randomly. */
  graphicId?: string;
  version?: string;
  name?: string;
  description?: string;

  /** Active canonical animation sequence used by the evaluator. */
  sequenceId?: string;
  main?: string;
  allowExternalResources?: boolean;
  /** Pure caller-provided asset ownership information. No filesystem access is performed. */
  assetCatalog?: Record<string, OGrafAssetCatalogEntry>;
  publicTextFields?: OGrafPublicTextField[];
  publicImageFields?: OGrafPublicImageField[];
  emitRenderRequirements?: boolean;
}

export interface OGrafManifest {
  $schema: typeof OGRAF_GRAPHICS_SCHEMA_URL;
  id: string;
  name: string;
  main: string;
  version: string;
  supportsRealTime: true;
  supportsNonRealTime: false;
  stepCount: 1;
  schema: OGrafPublicStateSchema;
  renderRequirements?: Array<{
    resolution: {
      width: { ideal: number };
      height: { ideal: number };
    };
    frameRate: { ideal: number };
  }>;
  description?: string;
}

export interface OGrafPackageFile {
  path: string;
  kind: 'manifest' | 'scene' | 'runtime' | 'asset';
  status: 'planned' | 'generated' | 'pending-phase-2';
  content?: string;
  binaryContent?: Uint8Array;
}

export interface OGrafAssetPlan {
  source: string;
  packagedPath: string;
  kind: 'image' | 'font';
  sourcePath?: string;
}

export interface OGrafPackagePlan {
  status: 'skeleton';
  isComplete: false;
  manifest: OGrafManifest;
  internalScenePayload: SceneData;
  files: OGrafPackageFile[];
  assets: OGrafAssetPlan[];
  diagnostics: OGrafExportDiagnostic[];
}

export interface OGrafGeneratedPackage {
  status: 'ready-to-materialize' | 'blocked';
  isComplete: false;
  manifest: OGrafManifest;
  internalScenePayload: SceneData;
  files: OGrafPackageFile[];
  assets: OGrafAssetPlan[];
  diagnostics: OGrafExportDiagnostic[];
}

export interface OGrafMaterializedPackage {
  status: 'complete' | 'blocked';
  isComplete: boolean;
  outputDirectory: string;
  manifest: OGrafManifest;
  files: OGrafPackageFile[];
  diagnostics: OGrafExportDiagnostic[];
}

export interface ValidatedOGrafScene {
  sceneData: SceneData;
  diagnostics: OGrafExportDiagnostic[];
  assets: OGrafAssetPlan[];
  publicStateSchema: OGrafPublicStateSchema;
  canCompile: boolean;
}
