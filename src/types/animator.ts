import type { MatteGradientStop } from '../utils/matte';

export type EasingType = 
  | 'linear' 
  | 'easeIn' 
  | 'easeOut' 
  | 'easeInOut' 
  | 'bounce' 
  | 'elastic' 
  | 'anticipate' 
  | 'overshoot'
  | 'cubic_bezier';

export interface ProjectTemplate {
  id: string;
  name: string;
}

export interface MaskPoint {
  x: number;
  y: number;
  handleIn?: { x: number; y: number };
  handleOut?: { x: number; y: number };
}

/** M11/M13 — Track matte modes. `'clip'` (MVP) clips the target with the
 *  source's world-space geometry via SVG clipPath; `'alpha'` and `'luminance'`
 *  use an SVG <mask> (alpha channel / luminance of the source's fill). */
export type MatteMode = 'clip' | 'alpha' | 'luminance';

/** Static placement of a modern shape stroke relative to its authored path. */
export type StrokeAlignment = 'center' | 'inside' | 'outside';

/** M11 — Track matte: this part is clipped by another part's (the source's)
 *  evaluated world-space shape geometry. Legacy data may omit `mode` (treated
 *  as 'clip' at runtime — see `resolveMatteMode`) and `inverted`. */
export interface PartMatte {
  /** The part whose shape clips this part */
  sourcePartId: string;
  /** 'clip' (clipPath) | 'alpha' | 'luminance' (SVG <mask>). Absent in
   *  legacy data → resolved as 'clip'. */
  mode?: MatteMode;
  /** Invert the matte (hide INSIDE the source geometry). Requires the
   *  <mask> pipeline — clipPath cannot express negative area. */
  inverted?: boolean;
  /** When false the matte is not applied. Undefined defaults to active
   *  (backward-compatible: absent/partial matte data must not hide content). */
  enabled?: boolean;
  /** Soft-edge feather in world-space pixels. Absent/0 = sharp M13 edge.
   * Applied via feGaussianBlur on the mask content (browser-verified).
   * Geometry is NOT affected — this is a render parameter only. */
  feather?: number;
  /** M16: matte strength 0-1 (render parameter only — NOT geometry, NOT a
   *  channel). undefined = legacy behavior = full strength (1). Malformed
   *  values normalize to 1 via normalizeStrength. */
  strength?: number;
  /** M17: linear gradient matte (render parameter only — paint definition,
   *  NEVER geometry). undefined = legacy behavior (no gradient).
   *  Angle is source-local degrees; 0 = left→right, 90 = top→bottom.
   *  M19: optional custom stops (2-4 MVP, render-only paint data — NEVER
   *  animated, NEVER a channel). Absent stops = legacy default 2-stop ramp
   *  (byte-for-byte).
   *  M20: optional type discriminator. Absent/undefined = LINEAR (legacy
   *  angle-only projects stay byte-for-byte). 'radial' = center/radius are
   *  DERIVED deterministically from the source bounds (never persisted);
   *  angle is ignored for radial (harmless when present). */
  gradient?: {
    type?: 'linear' | 'radial';
    angle?: number;
    stops?: MatteGradientStop[];
  };
}

export interface MaskData {
  enabled: boolean;
  inverted: boolean;
  feather: number;
  opacity: number;
  closed: boolean;
  points: MaskPoint[];
}

export interface Transform {
  x: number;
  y: number;
  rotation: number; // In degrees
  scaleX: number;
  scaleY: number;
  opacity: number;
  maskOffsetX?: number;
  maskOffsetY?: number;
  maskScale?: number;
  maskRotation?: number;
  mask?: MaskData;
}

export interface Keyframe {
  id: string;
  frame: number; // 0 to totalFrames
  transform: Transform;
  easing: EasingType;
  bezierControlPoints?: [number, number, number, number]; // [x1, y1, x2, y2]
  templateId?: string; // Isolated to specific motion sequence template
}

// Per-property (channel) keyframe for Unreal-style independent property animation
export interface PropertyKeyframe {
  id: string;
  frame: number;
  value: number;
  easing: EasingType;
  bezierControlPoints?: [number, number, number, number];
  templateId?: string; // Isolated to specific motion sequence template
}

// Channel keys match Transform property names
export type TrackChannel = 'x' | 'y' | 'rotation' | 'scaleX' | 'scaleY' | 'opacity' | 'maskOffsetX' | 'maskOffsetY' | 'maskScale' | 'maskRotation' | 'trimPathStart' | 'trimPathEnd' | 'trimPathOffset';

export const TRACK_CHANNELS: TrackChannel[] = ['x', 'y', 'rotation', 'scaleX', 'scaleY', 'opacity', 'maskOffsetX', 'maskOffsetY', 'maskScale', 'maskRotation', 'trimPathStart', 'trimPathEnd', 'trimPathOffset'];

/**
 * Track data model (Phase 3 Step 5).
 *
 * Split into two orthogonal concerns:
 *   - AnimationTrackData: everything the animation/composition engine needs
 *   - EditorTrackState:    everything the editor/UI needs (no animation logic)
 *
 * `Track` is the union of both — structurally identical to the previous
 * single interface, so no consumer changes are required.
 */

/** Animation/composition-domain track fields */
export interface AnimationTrackData {
  /** Which layer this track animates */
  partId: string;
  /** Legacy composite keyframes — kept ONLY for legacy import compatibility.
   *  M8e: no longer exported (channels-only policy); may be absent on modern
   *  tracks. */
  keyframes?: Keyframe[];
  /** Per-property keyframe channels (canonical animation format) */
  channels: Record<TrackChannel, PropertyKeyframe[]>;
  /** Motion Design template ID (e.g. In_V1, Out_V1) — which sequence's keyframes are active */
  sequencerTemplateId?: string;
}

/** Editor/UI-domain track fields (no animation logic) */
export interface EditorTrackState {
  /** Editor track identity */
  id: string;
  /** Display name in the timeline */
  name: string;
  /** Timeline lane color */
  color: string;
  /** Broadcast mute state */
  visible: boolean;
  /** Edit canvas hard-hide state */
  editVisible?: boolean;
  /** Prevent editing this track */
  locked: boolean;
  /** Unreal-style collapse/expand state */
  expanded?: boolean;
}

/** Full track = animation data + editor state */
export type Track = AnimationTrackData & EditorTrackState;

export type BodyPartType = 
  | 'custom_star'
  | 'custom_circle'
  | 'custom_box'
  | 'custom_rect'
  | 'custom_triangle'
  | 'custom_text'
  | 'custom_banner'
  | 'custom_capsule'
  | 'custom_diamond'
  | 'custom_parallelogram'
  | 'custom_freeform'
  | 'custom_card'
  | 'custom_image'
  | 'custom_video'
  | 'mograph_cloner'   // MoGraph Cloner
  | 'particle_system'; // Particle System // Particle System

// ─── Feature 1: Trim Path / Stroke Animation ────────────────────────────────
// strokeProgress 0..1 → how much of the outline is drawn

// ─── Feature 2: Anchor Points ───────────────────────────────────────────────
export type AnchorPreset =
  | 'none'
  | 'top-left'    | 'top-center'    | 'top-right'
  | 'center-left' | 'center'        | 'center-right'
  | 'bottom-left' | 'bottom-center' | 'bottom-right';

// ─── Feature 3: Text Stagger Animation ──────────────────────────────────────
export type TextAnimMode = 'none' | 'chars' | 'words' | 'lines';

// ─── Feature 5: MoGraph Cloner ───────────────────────────────────────────────
export type ClonerMode = 'grid' | 'circle' | 'linear';
export type ClonerShape = 'circle' | 'rect' | 'triangle' | 'dot' | 'cross' | 'line';
export type ClonerEffector = 'none' | 'wave' | 'random' | 'step';

export interface ClonerConfig {
  mode: ClonerMode;
  countX: number;
  countY: number;
  spacingX: number;
  spacingY: number;
  countCircle: number;
  radius: number;
  countLinear: number;
  spacingLinear: number;
  childShape: ClonerShape;
  childSize: number;
  childColor: string;
  childStroke: string;
  childStrokeWidth: number;
  effector: ClonerEffector;
  waveSpeed: number;
  waveAmplitude: number;
  waveAxis: 'y' | 'x' | 'scale' | 'rotation';
  randomSeed: number;
  randomAmplitude: number;
  stepPhase: number;
}

// ─── Feature 6: Particle System ─────────────────────────────────────────────
export type ParticleShape = 'dot' | 'cross' | 'triangle' | 'line' | 'circle_outline';
export type ParticleDirection = 'up' | 'down' | 'left' | 'right' | 'random' | 'radial';

export interface ParticleConfig {
  count: number;
  shape: ParticleShape;
  minSize: number;
  maxSize: number;
  color: string;
  minOpacity: number;
  maxOpacity: number;
  speed: number;
  direction: ParticleDirection;
  spread: number;
  loop: boolean;
  fadeIn: boolean;
  fadeOut: boolean;
  randomSeed: number;
}

// ─── Freeform Drawing ─────────────────────────────────────────────────────────
export interface FreeformPoint {
  x: number;
  y: number;
}

// ─── CharacterPart ────────────────────────────────────────────────────────────
export interface CharacterPart {
  id: string;
  name: string;
  type: BodyPartType;
  zIndex: number;
  fillColor: string;
  strokeColor: string;
  /** Optional V1 static shape appearance controls. */
  fillEnabled?: boolean;
  fillOpacity?: number;
  strokeEnabled?: boolean;
  strokeOpacity?: number;
  /** V2 static stroke placement. Missing values resolve to center. */
  strokeAlignment?: StrokeAlignment;
  pivot: { x: number; y: number };
  parentId?: string;
  baseTransform: Transform;
  textValue?: string;
  fontSize?: number;
  cardCategory?: string;
  cardTitle?: string;
  cardButtonText?: string;
  imageUrl?: string;
  videoUrl?: string;
  shadowColor?: string;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  borderRadius?: number;
  width?: number;
  height?: number;
  // Freeform drawn shape: vertices relative to the part center (stage units)
  points?: FreeformPoint[];

  // Media Overlay Text Caption
  overlayText?: string;
  overlayTextPosition?: 'top' | 'center' | 'bottom';
  overlayTextColor?: string;
  overlayTextBg?: string;

  // Video & Image Crop Box / Aspect Mask
  cropEnabled?: boolean;
  cropMode?: 'custom' | '9:16' | '1:1' | '4:5' | '16:9';
  cropX?: number;
  cropY?: number;
  cropWidth?: number;
  cropHeight?: number;

  // ── Feature 1: Trim Path / Stroke Animation ──
  strokeProgress?: number;    // 0..1 (0=hidden, 1=full outline)
  strokeWidth?: number;       // override stroke width for animated outline
  strokeAnimColor?: string;   // override color for animated stroke
  /** V2 normalized Trim Path authoring fields. Missing fields preserve legacy strokeProgress behavior. */
  trimPathEnabled?: boolean;
  trimPathStart?: number;      // normalized 0..1
  trimPathEnd?: number;        // normalized 0..1
  trimPathOffset?: number;     // degrees, normalized at evaluation/render time

  // ── Feature 2: Responsive Anchor Points ──
  anchor?: AnchorPreset;
  anchorOffsetX?: number;
  anchorOffsetY?: number;

  // ── Feature 3: Text Stagger Animation ──
  textAnimMode?: TextAnimMode;
  textStaggerDelay?: number;   // ms between each char/word/line
  textAnimDuration?: number;   // ms for each unit animation
  textAnimEasing?: EasingType;
  textAnimStartFrame?: number; // timeline frame when stagger begins

  // ── Feature 5: MoGraph Cloner ──
  clonerConfig?: ClonerConfig;

  // ── Feature 6: Particle System ──
  particleConfig?: ParticleConfig;

  // ── Feature 7: Broadcast In/Out Animations ──
  inAnimPreset?: string;
  inAnimDuration?: number; // duration in frames
  inAnimTimelineStart?: number;
  inAnimTimelineEnd?: number;

  outAnimPreset?: string;
  outAnimDuration?: number; // duration in frames
  outAnimTimelineStart?: number;
  outAnimTimelineEnd?: number;

  // ── Feature 8: Canva-Style Shape Masking ──
  innerMediaUrl?: string;
  innerMediaType?: 'image' | 'video';
  /** Opacity (0-1) of the media masked inside a shape — independent of the shape's own opacity */
  innerMediaOpacity?: number;
  maskOffsetX?: number;
  maskOffsetY?: number;
  maskScale?: number;
  maskRotation?: number;

  fontFamily?: string;

  // ── Feature 9: Advanced Masking ──
  mask?: MaskData;

  // ── M11: Track Matte (SVG clipPath) ──
  /** Track matte reference — this part is clipped by another part's shape. */
  matte?: PartMatte;

  // ── Feature 10: Custom Preset Animation Engine ──
  inCustomPresetId?: string;
  outCustomPresetId?: string;

  // ── Feature 11: Dynamic Mask Shapes & Live Stunts ──
  maskShape?: MaskShapeType;
  enableMaskShape?: boolean;
  enableMotionAnim?: boolean;
}

export type MaskShapeType = 'none' | 'rectangle' | 'circle' | 'pill' | 'star' | 'hexagon' | 'heart';
export type LiveStuntType = 'bounce' | 'pulse' | 'wobble' | 'spin' | 'shake' | 'float' | string;

export interface CustomMotionPresetKeyframe {
  progress: number; // 0..1
  deltaX: number;
  deltaY: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  opacity: number;
  easing?: string;
}

export interface CustomMotionPreset {
  id: string;
  name: string;
  type: 'in' | 'out' | 'stunt';
  durationFrames: number;
  /** Optional user-defined library category. Absent/blank means uncategorized. */
  category?: string;
  scope?: 'both' | 'motion_only' | 'shape_only' | 'none';
  maskShape?: 'none' | 'circle' | 'pill' | 'star' | 'hexagon' | 'heart';
  showInDirector?: boolean;
  keyframes: CustomMotionPresetKeyframe[];
}

export type ToolType = 'select' | 'move' | 'rotate' | 'scale' | 'pan' | 'mask' | 'freeform_draw';

export interface AnimationProject {
  name: string;
  templateId?: string;
  fps: number;
  totalFrames: number;
  projectResolution?: { width: number; height: number }; // 1920x1080 default
  motionTemplates?: MotionTemplate[];
  tracks: Track[];
  characterParts: CharacterPart[];
}

export type AppMode = 'edit' | 'broadcast';

export interface BroadcastObjectState {
  state: 'hidden' | 'animating_in' | 'visible' | 'animating_out';
  progress: number; // 0 to 1
}

// ── Motion Design Sequencer Templates (In_V1, Out_V1, Loop_V1) ──
export interface MotionTemplate {
  id: string;
  name: string;
  type: 'in' | 'out' | 'stunt';
  durationFrames: number;
  description?: string;
}
