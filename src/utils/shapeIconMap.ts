import type { ComponentType, CSSProperties } from 'react';
import type { BodyPartType } from '../types/animator';
import {
  Circle,
  Diamond,
  PenTool,
  Pill,
  RectangleHorizontal,
  Square,
  Star,
  Triangle,
} from 'lucide-react';
import { ParallelogramIcon } from './shapeIcons';

export const SHAPE_ICON_SIZE = 18;
export const SHAPE_ICON_STROKE_WIDTH = 2;

type ShapeIconProps = {
  size?: number;
  className?: string;
  strokeWidth?: number;
  style?: CSSProperties;
};

type ShapeIcon = ComponentType<ShapeIconProps>;

/** Canonical icon authority for every shape/freeform part type. */
export const SHAPE_ICON_MAP: Partial<Record<BodyPartType, ShapeIcon>> = {
  custom_rect: RectangleHorizontal,
  custom_capsule: Pill,
  custom_box: Square,
  custom_circle: Circle,
  custom_triangle: Triangle,
  custom_star: Star,
  custom_diamond: Diamond,
  custom_parallelogram: ParallelogramIcon,
  custom_freeform: PenTool,
};
