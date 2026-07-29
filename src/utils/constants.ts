import type { MotionTemplate, ClonerConfig, ParticleConfig } from '../types/animator';

// ---------------------------------------------------------
// 1. Storage Keys
// ---------------------------------------------------------
export const AUTOSAVE_STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';

// ---------------------------------------------------------
// 2. Default Project / Template Configurations
// ---------------------------------------------------------
export const DEFAULT_MOTION_TEMPLATES: MotionTemplate[] = [
  { 
    id: 'Sequence', 
    name: 'Sequence', 
    type: 'in', 
    durationFrames: 60, 
    description: 'Default Sequence Timeline' 
  }
];

export const TOOLBAR_COLORS = [
  '#00d2ff', '#ffb700', '#ff3366', '#a855f7', '#10b981', '#ff7b00', '#ec4899'
];

export const DEFAULT_CLONER_CONFIG: ClonerConfig = {
  mode: 'grid',
  countX: 4,
  countY: 3,
  spacingX: 45,
  spacingY: 45,
  countCircle: 8,
  radius: 70,
  countLinear: 6,
  spacingLinear: 40,
  childShape: 'circle',
  childSize: 12,
  childColor: '#00d2ff', // Will be overridden dynamically
  childStroke: '#ffffff',
  childStrokeWidth: 1.5,
  effector: 'wave',
  waveSpeed: 1.5,
  waveAmplitude: 15,
  waveAxis: 'y',
  randomSeed: 42,
  randomAmplitude: 10,
  stepPhase: 0,
};

export const DEFAULT_PARTICLE_CONFIG: ParticleConfig = {
  count: 40,
  shape: 'dot',
  minSize: 3,
  maxSize: 8,
  color: '#00d2ff', // Will be overridden dynamically
  minOpacity: 0.2,
  maxOpacity: 0.85,
  speed: 35,
  direction: 'up',
  spread: 300,
  loop: true,
  fadeIn: true,
  fadeOut: true,
  randomSeed: 123,
};

// ---------------------------------------------------------
// 3. Legacy Mathematical Anchors
// ---------------------------------------------------------
// Original rigid offsets used for legacy Stickman rigs
export const PART_ANCHOR_OFFSETS: Record<string, { ax: number; ay: number }> = {
  'top-left': { ax: -250, ay: -190 },
  'top-center': { ax: 0, ay: -190 },
  'top-right': { ax: 250, ay: -190 },
  'center-left': { ax: -250, ay: 0 },
  'center': { ax: 0, ay: 0 },
  'center-right': { ax: 250, ay: 0 },
  'bottom-left': { ax: -250, ay: 190 },
  'bottom-center': { ax: 0, ay: 190 },
  'bottom-right': { ax: 250, ay: 190 },
  'none': { ax: 0, ay: 0 }
};
