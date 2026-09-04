import type { SceneData } from '../types/composition';
import { compileOGrafManifest } from './compiler';
import { generateGraphicModule } from './runtimeTemplate';
import { validateSceneForOGraf } from './validation';
import type {
  OGrafAssetPlan,
  OGrafExportDiagnostic,
  OGrafExportOptions,
  OGrafGeneratedPackage,
  OGrafManifest,
  OGrafPackageFile,
} from './types';

function hashString(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function isSafePackagePath(value: string): boolean {
  const normalized = value.replace(/\\/gu, '/');
  return Boolean(value)
    && !normalized.startsWith('/')
    && !/^[a-zA-Z]:\//u.test(normalized)
    && !normalized.split('/').includes('..');
}

function uniqueAssetPlans(assets: OGrafAssetPlan[], diagnostics: OGrafExportDiagnostic[]): OGrafAssetPlan[] {
  const used = new Set<string>();
  return assets.map((asset) => {
    let packagedPath = asset.packagedPath.replace(/\\/gu, '/');
    if (!isSafePackagePath(packagedPath)) {
      diagnostics.push({
        code: 'OGRAF_MISSING_ASSET',
        severity: 'ERROR',
        message: `Packaged asset path "${packagedPath}" escapes the package root.`,
        feature: 'asset-path',
      });
      packagedPath = `assets/${asset.kind}s/${hashString(asset.source)}`;
    }
    if (used.has(packagedPath)) {
      const dot = packagedPath.lastIndexOf('.');
      const suffix = `-${hashString(asset.source)}`;
      packagedPath = dot > 0 ? `${packagedPath.slice(0, dot)}${suffix}${packagedPath.slice(dot)}` : `${packagedPath}${suffix}`;
    }
    used.add(packagedPath);
    return { ...asset, packagedPath };
  });
}
function packageAssetDiagnostics(sceneData: SceneData, options: OGrafExportOptions, assets: OGrafAssetPlan[], diagnostics: OGrafExportDiagnostic[]): void {
  for (const layer of sceneData.layers) {
    if (layer.type === 'custom_image' && layer.imageUrl) {
      const entry = options.assetCatalog?.[layer.imageUrl];
      const asset = assets.find((candidate) => candidate.source === layer.imageUrl);
      if (!entry || entry.kind !== 'local' || (!entry.sourcePath && !entry.binaryContent) || !asset) {
        diagnostics.push({
          code: entry?.kind === 'external' ? 'OGRAF_EXTERNAL_ASSET_REJECTED' : 'OGRAF_MISSING_ASSET',
          severity: 'ERROR',
          message: `Image asset "${layer.imageUrl}" cannot be packaged without a verified local source or browser bytes.`,
          layerId: layer.id,
          layerName: layer.name,
          feature: 'image',
        });
      }
    }
  }
  for (const asset of assets) {
    if ((asset.sourcePath || asset.binaryContent) && !isSafePackagePath(asset.packagedPath)) {
      diagnostics.push({ code: 'OGRAF_MISSING_ASSET', severity: 'ERROR', message: `Asset path "${asset.packagedPath}" is unsafe.`, feature: 'asset-path' });
    }
  }
}

function generatedFiles(sceneData: SceneData, options: OGrafExportOptions, assets: OGrafAssetPlan[], manifest: OGrafManifest): OGrafPackageFile[] {
  const graphicName = (options.name?.trim() || sceneData.name?.trim() || 'graphic').toLowerCase().replace(/[^a-z0-9._-]+/gu, '-').replace(/-+/gu, '-') || 'graphic';
  const imageReferences = Object.fromEntries(assets.filter((asset) => asset.kind === 'image').map((asset) => [asset.source, asset.packagedPath]));
  const fontReferences = Object.fromEntries(assets.filter((asset) => asset.kind === 'font').map((asset) => [asset.source.slice('font:'.length), asset.packagedPath]));
  const runtime = generateGraphicModule(sceneData, options.publicTextFields, options.publicImageFields, imageReferences, fontReferences);
  return [
    { path: `${graphicName}.ograf.json`, kind: 'manifest', status: 'generated', content: `${JSON.stringify(manifest, null, 2)}\n` },
    { path: 'scene.kcs', kind: 'scene', status: 'generated', content: `${JSON.stringify(sceneData, null, 2)}\n` },
    { path: manifest.main, kind: 'runtime', status: 'generated', content: runtime },
    ...assets.map((asset) => ({ path: asset.packagedPath, kind: 'asset' as const, status: 'planned' as const, ...(asset.binaryContent ? { binaryContent: asset.binaryContent } : {}) })),
  ];
}
export function compileOGrafPackage(sceneData: SceneData, options: OGrafExportOptions = {}): OGrafGeneratedPackage {
  const packageOptions = { ...options, requirePortableAssets: true };
  const validated = validateSceneForOGraf(sceneData, packageOptions);
  const compiled = compileOGrafManifest(sceneData, packageOptions);
  const diagnostics = [...compiled.diagnostics];
  const assets = uniqueAssetPlans(validated.assets, diagnostics);
  packageAssetDiagnostics(sceneData, packageOptions, assets, diagnostics);
  const hasErrors = diagnostics.some((diagnostic) => diagnostic.severity === 'ERROR');
  return {
    status: hasErrors ? 'blocked' : 'ready-to-materialize',
    isComplete: false,
    manifest: compiled.manifest,
    internalScenePayload: sceneData,
    files: hasErrors ? [] : generatedFiles(sceneData, packageOptions, assets, compiled.manifest),
    assets,
    diagnostics,
  };
}


