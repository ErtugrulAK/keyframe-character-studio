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

export interface Transform {
  x: number;
  y: number;
  rotation: number; // In degrees
  scaleX: number;
  scaleY: number;
  opacity: number;
}

export interface Keyframe {
  id: string;
  frame: number; // 0 to totalFrames
  transform: Transform;
  easing: EasingType;
  bezierControlPoints?: [number, number, number, number]; // [x1, y1, x2, y2]
}

// Per-property (channel) keyframe for Unreal-style independent property animation
export interface PropertyKeyframe {
  id: string;
  frame: number;
  value: number;
  easing: EasingType;
  bezierControlPoints?: [number, number, number, number];
}

// Channel keys match Transform property names
export type TrackChannel = 'x' | 'y' | 'rotation' | 'scaleX' | 'scaleY' | 'opacity';

export const TRACK_CHANNELS: TrackChannel[] = ['x', 'y', 'rotation', 'scaleX', 'scaleY', 'opacity'];

export interface Track {
  id: string;
  partId: string;
  name: string;
  color: string;
  keyframes: Keyframe[]; // legacy composite keyframes kept for backward compatibility
  channels: Record<TrackChannel, PropertyKeyframe[]>; // per-property keyframe channels
  visible: boolean; // Broadcast Mute State
  editVisible?: boolean; // Edit Canvas Hard Hide State
  locked: boolean;
  expanded?: boolean; // Unreal-style collapse/expand state
}

export type BodyPartType = 
  | 'head' 
  | 'hair'
  | 'torso' 
  | 'upper_arm_l' 
  | 'lower_arm_l' 
  | 'hand_l'
  | 'upper_arm_r' 
  | 'lower_arm_r' 
  | 'hand_r'
  | 'upper_leg_l' 
  | 'lower_leg_l' 
  | 'foot_l'
  | 'upper_leg_r' 
  | 'lower_leg_r' 
  | 'foot_r'
  | 'accessory'
  | 'custom_star'
  | 'custom_circle'
  | 'custom_box'
  | 'custom_rect'
  | 'custom_triangle'
  | 'custom_text'
  | 'custom_banner'
  | 'custom_capsule'
  | 'custom_diamond'
  | 'custom_card'
  | 'custom_image'
  | 'custom_video'
  | 'mograph_cloner'   // MoGraph Cloner
  | 'particle_system'; // Particle System

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

// ─── CharacterPart ────────────────────────────────────────────────────────────
export interface CharacterPart {
  id: string;
  name: string;
  type: BodyPartType;
  zIndex: number;
  fillColor: string;
  strokeColor: string;
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

  // ── Feature 4: Spring Physics ──
  springEnabled?: boolean;
  springStiffness?: number;   // 0..100
  springDamping?: number;     // 0..100
  springDelay?: number;       // ms delay

  // ── Feature 5: MoGraph Cloner ──
  clonerConfig?: ClonerConfig;

  // ── Feature 6: Particle System ──
  particleConfig?: ParticleConfig;

  // ── Feature 7: Broadcast In/Out Animations ──
  inAnimPreset?: 'none' | 'fade' | 'slide-left' | 'slide-right' | 'slide-up' | 'slide-down' | 'pop' | 'spin' | 'custom_timeline';
  inAnimDuration?: number; // duration in frames
  inAnimTimelineStart?: number;
  inAnimTimelineEnd?: number;

  outAnimPreset?: 'none' | 'fade' | 'slide-left' | 'slide-right' | 'slide-up' | 'slide-down' | 'pop' | 'spin' | 'custom_timeline';
  outAnimDuration?: number; // duration in frames
  outAnimTimelineStart?: number;
  outAnimTimelineEnd?: number;

  // ── Feature 8: Canva-Style Shape Masking ──
  innerMediaUrl?: string;
  innerMediaType?: 'image' | 'video';

  // ── Feature 9: Layer Appearance Timing (Start/End Frame) ──
  visibleStartFrame?: number;
  visibleEndFrame?: number;

  fontFamily?: string;

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
  scope?: 'both' | 'motion_only' | 'shape_only';
  keyframes: CustomMotionPresetKeyframe[];
}

export type ToolType = 'select' | 'move' | 'rotate' | 'scale' | 'pan';

export interface PresetPose {
  id: string;
  name: string;
  transforms: Record<string, Partial<Transform>>;
}

export interface AnimationProject {
  name: string;
  fps: number;
  totalFrames: number;
  projectResolution?: { width: number; height: number }; // 1920x1080 default
  tracks: Track[];
  characterParts: CharacterPart[];
}

export type AppMode = 'edit' | 'broadcast';

export interface BroadcastObjectState {
  state: 'hidden' | 'animating_in' | 'visible' | 'animating_out';
  progress: number; // 0 to 1
}
