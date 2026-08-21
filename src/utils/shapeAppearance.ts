import type { BodyPartType, CharacterPart, StrokeAlignment } from '../types/animator';

export interface ResolvedShapeAppearance {
  fillEnabled: boolean;
  fillColor: string;
  fillOpacity: number;
  strokeEnabled: boolean;
  strokeColor: string;
  strokeWidth: number;
  strokeOpacity: number;
  strokeAlignment: StrokeAlignment;
  isModernAppearance: boolean;
}

export type ShapeAppearancePatch = Partial<Pick<CharacterPart,
  'fillEnabled' | 'fillColor' | 'fillOpacity' | 'strokeEnabled' | 'strokeColor' | 'strokeWidth' | 'strokeOpacity' | 'strokeAlignment'>>;

export const MODERN_SHAPE_APPEARANCE_TYPES: ReadonlySet<BodyPartType> = new Set([
  'custom_rect',
  'custom_box',
  'custom_circle',
  'custom_triangle',
  'custom_star',
  'custom_diamond',
  'custom_parallelogram',
  'custom_capsule',
  'custom_freeform',
]);

export const isShapeAppearanceEligible = (type: BodyPartType): boolean =>
  MODERN_SHAPE_APPEARANCE_TYPES.has(type);

const normalizeOpacity = (value: number | undefined): number =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.min(1, Math.max(0, value))
    : 1;

const normalizeStrokeWidth = (value: number | undefined): number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 1.5;

const normalizeStrokeAlignment = (value: StrokeAlignment | undefined): StrokeAlignment =>
  value === 'outside' ? 'outside' : 'center';

const hasVisibleStrokeColor = (strokeColor: string): boolean =>
  strokeColor !== 'none' && strokeColor !== 'transparent';

const legacyStrokeEnabled = (part: Pick<CharacterPart, 'type' | 'strokeColor'>): boolean => {
  if (!hasVisibleStrokeColor(part.strokeColor)) return false;

  // These renderers retain the legacy distinction where a custom stroke color
  // suppresses the normal authored outline (selection styling is separate).
  const customStrokeUsesFallback = new Set<BodyPartType>([
    'custom_star',
    'custom_circle',
    'custom_box',
    'custom_rect',
    'custom_triangle',
    'custom_parallelogram',
    'custom_freeform',
  ]);
  return customStrokeUsesFallback.has(part.type)
    ? part.strokeColor === '#101218'
    : true;
};

/** Resolve static shape appearance without React or renderer-specific state. */
export const resolveShapeAppearance = (
  part: Pick<CharacterPart, 'type' | 'fillColor' | 'strokeColor' | 'fillEnabled' | 'fillOpacity' | 'strokeEnabled' | 'strokeOpacity' | 'strokeWidth' | 'strokeAlignment'>,
): ResolvedShapeAppearance => {
  const isModernAppearance = part.fillEnabled !== undefined
    || part.fillOpacity !== undefined
    || part.strokeEnabled !== undefined
    || part.strokeOpacity !== undefined
    || part.strokeAlignment !== undefined;

  if (isModernAppearance) {
    return {
      fillEnabled: typeof part.fillEnabled === 'boolean' ? part.fillEnabled : true,
      fillColor: part.fillColor,
      fillOpacity: normalizeOpacity(part.fillOpacity),
      strokeEnabled: typeof part.strokeEnabled === 'boolean' ? part.strokeEnabled : true,
      strokeColor: part.strokeColor,
      strokeWidth: normalizeStrokeWidth(part.strokeWidth),
      strokeOpacity: normalizeOpacity(part.strokeOpacity),
      strokeAlignment: normalizeStrokeAlignment(part.strokeAlignment),
      isModernAppearance: true,
    };
  }

  return {
    fillEnabled: true,
    fillColor: part.fillColor,
    fillOpacity: 1,
    strokeEnabled: legacyStrokeEnabled(part),
    strokeColor: part.strokeColor,
    strokeWidth: 1.5,
    strokeOpacity: 1,
    strokeAlignment: 'center',
    isModernAppearance: false,
  };
};

/** Apply one explicit authoring edit, materializing legacy appearance atomically. */
export const updateShapeAppearance = (part: CharacterPart, patch: ShapeAppearancePatch): CharacterPart => {
  if (!isShapeAppearanceEligible(part.type)) return { ...part, ...patch };
  const resolved = resolveShapeAppearance(part);
  return {
    ...part,
    fillEnabled: resolved.fillEnabled,
    fillOpacity: resolved.fillOpacity,
    strokeEnabled: resolved.strokeEnabled,
    strokeWidth: resolved.strokeWidth,
    strokeOpacity: resolved.strokeOpacity,
    strokeAlignment: resolved.strokeAlignment,
    ...patch,
  };
};
