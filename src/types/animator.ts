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
  | 'accessory'
  | 'custom_star'
  | 'custom_circle'
  | 'custom_box'
  | 'custom_triangle'
  | 'custom_text'
  | 'custom_banner'
  | 'custom_capsule'
  | 'custom_diamond'
  | 'custom_card'
  | 'custom_image';

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
  textValue?: string; // Content string for text/banner objects
  fontSize?: number; // Font size in px
  cardCategory?: string; // e.g. "STUDIO CARD"
  cardTitle?: string; // e.g. "MOTION GRAPHIC"
  cardButtonText?: string; // e.g. "ACTIVE"
  imageUrl?: string; // Image URL / Data URL for custom_image
  shadowColor?: string; // Drop shadow or glow color
  shadowBlur?: number; // Shadow blur radius in px
  shadowOffsetX?: number; // Shadow offset X in px
  shadowOffsetY?: number; // Shadow offset Y in px
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
  tracks: Track[];
  characterParts: CharacterPart[];
}
