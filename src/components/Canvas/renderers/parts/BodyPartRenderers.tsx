import React from 'react';
import type { CharacterPart } from '../../../../types/animator';

interface BodyPartProps {
  part: CharacterPart;
  fill: string;
  stroke: string;
  isSelected: boolean;
  isGhost: boolean;
}

export const renderBodyPart = ({ part, fill, stroke, isSelected, isGhost }: BodyPartProps): React.ReactNode => {
  switch (part.type) {
    case 'hair':
      return (
        <path
          d="M -35 -20 Q -45 -60 0 -65 Q 45 -60 35 -20 Q 40 10 25 25 Q 0 35 -25 25 Q -40 10 -35 -20 Z"
          fill={fill}
          stroke={stroke}
          strokeWidth={isSelected ? 3 : 2}
        />
      );

    case 'head':
      return (
        <g>
          <ellipse
            cx={0}
            cy={0}
            rx={30}
            ry={35}
            fill={fill}
            stroke={stroke}
            strokeWidth={isSelected ? 3 : 2}
          />
          {!isGhost && (
            <>
              <circle cx={-10} cy={-5} r={4} fill="#222" />
              <circle cx={10} cy={-5} r={4} fill="#222" />
              <circle cx={-8} cy={-7} r={1.5} fill="#fff" />
              <circle cx={12} cy={-7} r={1.5} fill="#fff" />
              <path d="M -8 12 Q 0 20 8 12" fill="none" stroke="#aa5533" strokeWidth={2.5} strokeLinecap="round" />
            </>
          )}
        </g>
      );

    case 'torso':
      return (
        <path
          d="M -30 -45 L 30 -45 L 22 45 L -22 45 Z"
          fill={fill}
          stroke={stroke}
          strokeWidth={isSelected ? 3 : 2}
        />
      );

    case 'upper_arm_l':
    case 'upper_arm_r':
      return (
        <rect
          x={-12}
          y={0}
          width={24}
          height={55}
          rx={10}
          fill={fill}
          stroke={stroke}
          strokeWidth={isSelected ? 3 : 2}
        />
      );

    case 'lower_arm_l':
    case 'lower_arm_r':
      return (
        <rect
          x={-10}
          y={0}
          width={20}
          height={50}
          rx={8}
          fill={fill}
          stroke={stroke}
          strokeWidth={isSelected ? 3 : 2}
        />
      );

    case 'hand_l':
    case 'hand_r':
      return (
        <circle
          cx={0}
          cy={10}
          r={12}
          fill={fill}
          stroke={stroke}
          strokeWidth={isSelected ? 3 : 2}
        />
      );

    case 'upper_leg_l':
    case 'upper_leg_r':
      return (
        <rect
          x={-14}
          y={0}
          width={28}
          height={65}
          rx={12}
          fill={fill}
          stroke={stroke}
          strokeWidth={isSelected ? 3 : 2}
        />
      );

    case 'lower_leg_l':
    case 'lower_leg_r':
      return (
        <rect
          x={-12}
          y={0}
          width={24}
          height={60}
          rx={10}
          fill={fill}
          stroke={stroke}
          strokeWidth={isSelected ? 3 : 2}
        />
      );

    case 'foot_l':
    case 'foot_r':
      return (
        <path
          d="M -10 0 L 25 0 L 25 15 L -10 15 Z"
          fill={fill}
          stroke={stroke}
          strokeWidth={isSelected ? 3 : 2}
        />
      );

    case 'accessory':
      return (
        <path
          d="M -15 -15 L 15 -15 L 0 20 Z"
          fill={fill}
          stroke={stroke}
          strokeWidth={isSelected ? 3 : 2}
        />
      );

    default:
      return null;
  }
};
