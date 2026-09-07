/**
 * Phase 2/V6 — Canonical composition boundary types.
 *
 * These types are consumed incrementally by the runtime. Legacy fields remain
 * optional where migration requires backward-compatible scene loading.
 */

// Animation track model is defined once in `animator.ts` as `AnimationTrackData`
// (partId-based, canonical). `SceneData.tracks` references it directly —
// there is no separate AnimationTrack type (P4-S3).
import type { AnimationTrackData, BezierPath, LayerMask, MotionTemplate, PartMatte, TrackMatteV2 } from './animator';
/**
 * Coordinate-unit semantics for persisted scene data.
 *
 * The origin remains center-relative for all known contracts.  The legacy
 * contract records the historical Inspector centi-unit representation, while
 * the project-unit contract is the future raw project-space representation.
 * `legacy-unknown` is used for untagged/mixed v1 data and must not be guessed.
 */
export type SceneCoordinateSystem =
  | 'legacy-unknown'
  | 'legacy-centi-unit'
  | 'project-unit-center-v1';

// ─── Scene Data (persistent, serializable) ───────────────────────────────

export interface SceneData {
  /** Schema version for forward-compatible migration */
  version: 1 | 2;
  /** Explicit coordinate-unit semantics; absent on historical v1 files. */
  coordinateSystem?: SceneCoordinateSystem;
  /** Human-readable scene name */
  name?: string;
  /** Canvas dimensions (default 1920×1080) */
  width: number;
  height: number;
  /** Playback */
  fps: number;
  totalFrames: number;
  /** All compositable layers (shapes, text, images) */
  layers: SceneLayer[];
  /** Animation tracks — one per animated layer (canonical: AnimationTrackData) */
  tracks: AnimationTrackData[];
  /** Motion design templates (preserved for editor use; not used by composition engine) */
  motionTemplates?: MotionTemplate[];
  /** Active authoring sequence ID; runtime playback state is never serialized. */
  activeTemplateId?: string;
}

// ─── Layer ───────────────────────────────────────────────────────────────

export interface SceneLayer {
  id: string;
  name: string;
  /** Shape type — matches current BodyPartType union */
  type: string;

  // Base transform (static, pre-animation)
  x: number;
  y: number;
  rotation: number;   // degrees
  scaleX: number;
  scaleY: number;
  opacity: number;    // 0–1

  // Hierarchy
  parentId?: string;

  matte?: PartMatte;
  /** V6 ordered same-layer masks. */
  masks?: LayerMask[];
  /** V6 track matte relationship. */
  trackMatte?: TrackMatteV2;
  booleanGroupId?: string;
  booleanOperation?: 'union' | 'subtract' | 'intersect' | 'exclude';
  booleanOperandIds?: string[];
  booleanContours?: { x: number; y: number }[][];
  // Visibility (editor toggle)
  visible: boolean;

  // Z-order
  zIndex: number;

  // Style — all fields verified against current CharacterPart usage in renderers
  fillColor: string;
  strokeColor: string;
  fillEnabled?: boolean;
  fillOpacity?: number;
  strokeEnabled?: boolean;
  strokeWidth?: number;
  strokeOpacity?: number;
  strokeAlignment?: 'center' | 'inside' | 'outside';
  trimPathEnabled?: boolean;
  trimPathStart?: number;
  trimPathEnd?: number;
  trimPathOffset?: number;
  shadowColor?: string;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  borderRadius?: number;

  // Content — type-dependent; only fields actually read by PartRenderer sub-renderers
  textValue?: string;
  fontSize?: number;
  fontFamily?: string;
  imageUrl?: string;
  videoUrl?: string;
  /** Freeform polygon vertices (center-relative) */
  points?: { x: number; y: number }[];
  /** V6 canonical freeform path. */
  path?: import('./animator').BezierPath;
  /** Explicit dimensions for rect / card shapes */
  width?: number;
  height?: number;

  // Procedural animation configuration (stored in scene, consumed by evaluation)
  inAnimPreset?: string;
  outAnimPreset?: string;
  inAnimDuration?: number;
  outAnimDuration?: number;
  // MoGraph cloner / particle system config (set via Inspector UI — serialized since BUG #6)
  clonerConfig?: any;
  particleConfig?: any;
  // NOTE: inAnimTimelineStart/End and outAnimTimelineStart/End exist on
  // CharacterPart but are consumed by StagePartLayers (not PartRenderer).
  // They remain on the current CharacterPart type and will be evaluated
  // in the migration step that moves broadcast logic into evaluateFrame.
}

// ─── Runtime State (transient, passed into evaluation) ───────────────────

export interface RuntimeData {
  appMode: 'edit' | 'broadcast';
  broadcast: Record<string, BroadcastRuntime>;
  liveStunts: Record<string, LiveStuntRuntime>;
}

/**
 * Render-relevant track state consumed by the composition engine.
 *
 * A deliberate subset of `EditorTrackState` — only the fields that
 * actually affect frame output (visibility/opacity). Editor-only fields
 * (id, name, color, locked, expanded) never cross into the evaluation
 * pipeline.
 */
export interface RuntimeTrackState {
  /** Broadcast mute state */
  visible: boolean;
  /** Edit canvas hard-hide state */
  editVisible?: boolean;
}

export interface BroadcastRuntime {
  state: string;  // 'hidden' | 'animating_in' | 'visible' | 'animating_out'
  progress: number;
}

export interface LiveStuntRuntime {
  stunt: string;
  progress: number;  // 0..1
  customPresetId?: string;
}

// ─── Evaluation Output ───────────────────────────────────────────────────

export type EvaluatedFrame = {
  frame: number;
  layers: EvaluatedLayer[];
};

export interface EvaluatedLayer {
  id: string;
  type: string;

  /** Fully resolved world transform (animation + hierarchy + procedural) */
  transform: WorldTransform;

  /** Final opacity (keyframe × broadcast × editVisible × hierarchy) */
  opacity: number;

  /** Whether the renderer should draw this layer */
  visible: boolean;

  /** Renderer-ready content — passthrough from SceneLayer, no resolution needed */
  content: LayerContent;

  /** Resolved z-order position */
  zIndex: number;
}

export type WorldTransform = {
  x: number;
  y: number;
  rotation: number;  // degrees
  scaleX: number;
  scaleY: number;
  /** Evaluated opacity (base + keyframe/channel interpolation). Not multiplied by procedural deltas. */
  opacity: number;
};

export interface LayerContent {
  fillColor?: string;
  strokeColor?: string;
  fillEnabled?: boolean;
  fillOpacity?: number;
  strokeEnabled?: boolean;
  strokeWidth?: number;
  strokeOpacity?: number;
  strokeAlignment?: 'center' | 'inside' | 'outside';
  /** Static matte relationship/paint descriptor for renderer adapters. */
  matte?: PartMatte;
  /** Legacy freeform vertices retained for import compatibility. */
  points?: { x: number; y: number }[];
  /** V6 canonical freeform path. */
  path?: BezierPath;
  textValue?: string;
  fontSize?: number;
  fontFamily?: string;
  imageUrl?: string;
  videoUrl?: string;
  /** V6 same-layer mask stack. */
  masks?: LayerMask[];
  /** V6 track matte relationship. */
  trackMatte?: TrackMatteV2;
  shadowColor?: string;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  borderRadius?: number;
  trimPathEnabled?: boolean;
  trimPathStart?: number;
  trimPathEnd?: number;
  trimPathOffset?: number;
  width?: number;
  height?: number;
  /** MoGraph cloner / particle system config passthrough */
  clonerConfig?: any;
  particleConfig?: any;
  inCustomPresetId?: string;
  outCustomPresetId?: string;
}

// ─── Validation ──────────────────────────────────────────────────────────

export interface ValidationError {
  type: string;
  layerId?: string;
  message: string;
  /** 'critical' = evaluation cannot proceed; 'recoverable' = fallback applied */
  severity: 'critical' | 'recoverable';
}
