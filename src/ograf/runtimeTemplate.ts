import type { SceneData } from '../types/composition';
import type { OGrafPublicColorField, OGrafPublicImageField, OGrafPublicTextField } from './types';
import { TEXT_BOX_CENTRE_EM } from '../utils/textOrigin';
import {
  runtimeCompareByStackingOrder,
  runtimeGraphicFactory,
  runtimeResolveMatteSource,
  runtimeWorldAffineAlgebra,
} from './runtimeSnippets';

function imageReferenceLookup(imageReferences: Record<string, string>): Record<string, string> {
  return Object.entries(imageReferences).reduce<Record<string, string>>((lookup, [source, packagedPath]) => {
    Object.defineProperty(lookup, source, { value: packagedPath, enumerable: true, configurable: true, writable: true });
    Object.defineProperty(lookup, packagedPath, { value: packagedPath, enumerable: true, configurable: true, writable: true });
    return lookup;
  }, Object.create(null));
}
/**
 * Emit a standalone OGraf graphic module: the scene and its public bindings as
 * data, then the runtime factory (`runtime/graphicRuntime.ts`) called with them.
 */
export function generateGraphicModule(
  sceneData: SceneData,
  textFields: OGrafPublicTextField[] = [],
  imageFields: OGrafPublicImageField[] = [],
  colorFields: OGrafPublicColorField[] = [],
  imageReferences: Record<string, string> = {},
  fontReferences: Record<string, string | Array<{ path: string; unicodeRange?: string; fontWeight?: string }>> = {},
): string {
  const bindings = {
    text: Object.fromEntries(textFields.map((field) => [field.id, { layerId: field.layerId, property: 'textValue' }])),
    image: Object.fromEntries(imageFields.map((field) => [field.id, {
      layerId: field.layerId,
      property: 'imageUrl',
      allowedValues: field.options || (field.defaultValue ? [field.defaultValue] : []),
    }])),
    color: Object.fromEntries(colorFields.map((field) => [field.id, { layerId: field.layerId, property: field.property }])),
  };

  return `const SCENE = ${JSON.stringify(sceneData)};
const PUBLIC_BINDINGS = { text: Object.fromEntries(${JSON.stringify(Object.entries(bindings.text))}), image: Object.fromEntries(${JSON.stringify(Object.entries(bindings.image))}), color: Object.fromEntries(${JSON.stringify(Object.entries(bindings.color))}) };
const IMAGE_REFERENCES = Object.fromEntries(${JSON.stringify(Object.entries(imageReferenceLookup(imageReferences)))});
const FONT_REFERENCES = Object.fromEntries(${JSON.stringify(Object.entries(fontReferences))});
// The runtime is one self-contained factory (src/ograf/runtime/graphicRuntime.ts),
// embedded from its own source and called once with this package's data and
// the editor helpers it shares, each embedded from its single definition.
const RUNTIME = (${runtimeGraphicFactory()})({
  scene: SCENE,
  bindings: PUBLIC_BINDINGS,
  imageReferences: IMAGE_REFERENCES,
  fontReferences: FONT_REFERENCES,
  moduleUrl: import.meta.url,
  elementBase: HTMLElement,
  textBoxCentreEm: ${TEXT_BOX_CENTRE_EM},
  compareByStackingOrder: ${runtimeCompareByStackingOrder()},
  resolveMatteSource: ${runtimeResolveMatteSource()},
  affine: ${runtimeWorldAffineAlgebra()},
});
export default class Graphic extends RUNTIME.Graphic {}
`;
}
