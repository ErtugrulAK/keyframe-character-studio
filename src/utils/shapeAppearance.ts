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
  // Text authors the same fill/stroke paint as shapes: the editor renderer and
  // the OGraf SVG export both paint text with a 0.5 outline by default.
  'custom_text',
]);

export const isShapeAppearanceEligible = (type: BodyPartType): boolean =>
  MODERN_SHAPE_APPEARANCE_TYPES.has(type);

/**
 * Types whose renderer cannot split a centered stroke into inside/outside
 * halves (no geometry mask), so the Appearance section must not offer the
 * alignment control for them.
 */
export const supportsStrokeAlignment = (type: BodyPartType): boolean =>
  isShapeAppearanceEligible(type) && type !== 'custom_text';

const DEFAULT_STROKE_WIDTH = 1.5;
const TEXT_STROKE_WIDTH = 0.5;

/** Canonical outline width used when a layer has never authored one. */
export const defaultStrokeWidth = (type: BodyPartType): number =>
  type === 'custom_text' ? TEXT_STROKE_WIDTH : DEFAULT_STROKE_WIDTH;

const normalizeOpacity = (value: number | undefined): number =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.min(1, Math.max(0, value))
    : 1;

const normalizeStrokeWidth = (value: number | undefined, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback;

const normalizeStrokeAlignment = (value: StrokeAlignment | undefined): StrokeAlignment =>
  value === 'inside' || value === 'outside' ? value : 'center';

/** UI-compatible alignment values. Center remains an internal legacy value. */
export type StrokeAlignmentControlValue = 'inside' | 'outside';

/** Map legacy/missing center alignment to the supported Outside control. */
export const toStrokeAlignmentControlValue = (value: StrokeAlignment | undefined): StrokeAlignmentControlValue =>
  value === 'inside' ? 'inside' : 'outside';

/** Keep the existing centered stroke renderer behavior behind the Outside control. */
export const toAuthoringStrokeAlignment = (value: StrokeAlignmentControlValue): StrokeAlignment =>
  value === 'inside' ? 'inside' : 'center';
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

  const strokeWidthFallback = defaultStrokeWidth(part.type);

  if (isModernAppearance) {
    return {
      fillEnabled: typeof part.fillEnabled === 'boolean' ? part.fillEnabled : true,
      fillColor: part.fillColor,
      fillOpacity: normalizeOpacity(part.fillOpacity),
      strokeEnabled: typeof part.strokeEnabled === 'boolean' ? part.strokeEnabled : true,
      strokeColor: part.strokeColor,
      strokeWidth: normalizeStrokeWidth(part.strokeWidth, strokeWidthFallback),
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
    strokeWidth: strokeWidthFallback,
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
