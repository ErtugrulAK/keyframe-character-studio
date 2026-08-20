/**
 * Phase 2 — Canonical Composition Types
 *
 * These types define the TARGET architecture for the scene model,
 * composition engine, and renderer boundary. They are NOT yet wired
 * into runtime code — they serve as the specification that migration
 * steps will incrementally implement.
 *
 * Current runtime types (CharacterPart, Track, Transform) in
 * `animator.ts` remain unchanged and continue to power the editor.
 *
 * Fields are included ONLY when they have a verified counterpart in
 * the current `CharacterPart` / `PartRenderer` codebase.
 */

// Animation track model is defined once in `animator.ts` as `AnimationTrackData`
// (partId-based, canonical). `SceneData.tracks` references it directly —
// there is no separate AnimationTrack type (P4-S3).
import type { AnimationTrackData, PartMatte } from './animator';

// ─── Scene Data (persistent, serializable) ───────────────────────────────

export interface SceneData {
  /** Schema version for forward-compatible migration */
  version: 1;
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
  motionTemplates?: any[];
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

  // M11 — Track matte (clipped by another layer's shape)
  matte?: PartMatte;

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
  textValue?: string;
  fontSize?: number;
  fontFamily?: string;
  imageUrl?: string;
  videoUrl?: string;
  points?: { x: number; y: number }[];
  shadowColor?: string;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  borderRadius?: number;
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
