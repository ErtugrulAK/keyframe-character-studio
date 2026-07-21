export type EasingType = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | 'bounce';

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
}

export interface Track {
  id: string;
  partId: string;
  name: string;
  color: string;
  keyframes: Keyframe[];
  visible: boolean;
  locked: boolean;
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
  | 'accessory';

export interface CharacterPart {
  id: string;
  name: string;
  type: BodyPartType;
  zIndex: number;
  fillColor: string;
  strokeColor: string;
  pivot: { x: number; y: number }; // Relative pivot point
  parentId?: string; // Parent part for FK hierarchy
  baseTransform: Transform;
}

export type ToolType = 'select' | 'move' | 'rotate' | 'scale';

export interface PresetPose {
  id: string;
  name: string;
  transforms: Record<string, Partial<Transform>>;
}

export interface AnimationProject {
  name: string;
  fps: number;
  totalFrames: number;
  tracks: Track[];
  characterParts: CharacterPart[];
}
