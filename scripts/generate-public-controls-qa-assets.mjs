#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const qaRoot = resolve(process.argv[2] || 'kcs-ograf-public-controls-qa');
const assetRoot = join(qaRoot, 'ASSET');
const manifestPath = join(assetRoot, 'kcs-public-controls-asset.ograf.json');
const runtimePath = join(assetRoot, 'graphic.mjs');
const alternatePath = join(assetRoot, 'assets', 'images', 'logo_alt.svg');

const alternateSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="180" viewBox="0 0 420 180" role="img" aria-label="KCS alternate public controls test image">
  <rect width="420" height="180" rx="24" fill="#1d4ed8"/>
  <circle cx="90" cy="90" r="48" fill="#facc15"/>
  <path d="M180 55h180v24H180zm0 46h130v24H180z" fill="#ffffff"/>
</svg>
`;

await mkdir(join(assetRoot, 'assets', 'images'), { recursive: true });
await writeFile(alternatePath, alternateSvg, 'utf8');

const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const imageProperty = manifest.schema?.properties?.image_image;
if (!imageProperty || !Array.isArray(imageProperty.enum)) {
  throw new Error('ASSET manifest does not expose image_image as an enum field.');
}
if (!imageProperty.enum.includes('assets/images/logo.png')) imageProperty.enum.unshift('assets/images/logo.png');
if (!imageProperty.enum.includes('assets/images/logo_alt.svg')) imageProperty.enum.push('assets/images/logo_alt.svg');
imageProperty.default = 'assets/images/logo.png';
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

let runtime = await readFile(runtimePath, 'utf8');
runtime = runtime.replace(
  /"allowedValues":\["assets\/images\/logo\.png"\]/u,
  '"allowedValues":["assets/images/logo.png","assets/images/logo_alt.svg"]',
);
runtime = runtime.replace(
  /const IMAGE_REFERENCES = \{"source\/logo\.png":"assets\/images\/logo\.png","assets\/images\/logo\.png":"assets\/images\/logo\.png"\};/u,
  'const IMAGE_REFERENCES = {"source/logo.png":"assets/images/logo.png","assets/images/logo.png":"assets/images/logo.png","assets/images/logo_alt.svg":"assets/images/logo_alt.svg"};',
);
if (!runtime.includes('assets/images/logo_alt.svg')) throw new Error('ASSET runtime update did not expose the alternate image.');
await writeFile(runtimePath, runtime, 'utf8');

console.log(`Generated ${alternatePath}`);
console.log(`Updated ${manifestPath}`);
console.log(`Updated ${runtimePath}`);
