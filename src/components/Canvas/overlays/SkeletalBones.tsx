import React from 'react';
import type { CharacterPart, Transform } from '../../../types/animator';

interface SkeletalBonesProps {
  characterParts: CharacterPart[];
  selectedPartId: string | null;
  currentFrame: number;
  zScale: number;
  getComputedTransform: (partId: string, frame: number) => Transform;
}

export const SkeletalBones: React.FC<SkeletalBonesProps> = ({
  characterParts,
  selectedPartId,
  currentFrame,
  zScale,
  getComputedTransform,
}) => {
  return (
    <>
      {characterParts.map((part) => {
        if (!part.parentId) return null;
        const parentPart = characterParts.find((p) => p.id === part.parentId);
        if (!parentPart) return null;

        const pT = getComputedTransform(parentPart.id, currentFrame);
        const cT = getComputedTransform(part.id, currentFrame);

        const isSelectedLink = selectedPartId === part.id || selectedPartId === parentPart.id;

        return (
          <g key={`bone-${part.id}`}>
            <line
              x1={300 + pT.x}
              y1={240 + pT.y}
              x2={300 + cT.x}
              y2={240 + cT.y}
              stroke={isSelectedLink ? '#ffb700' : 'rgba(0, 210, 255, 0.4)'}
              strokeWidth={(isSelectedLink ? 2.5 : 1.5) * zScale}
              strokeDasharray={isSelectedLink ? 'none' : `${4 * zScale} ${3 * zScale}`}
            />
            <circle cx={300 + pT.x} cy={240 + pT.y} r={3 * zScale} fill="#00d2ff" />
            <circle cx={300 + cT.x} cy={240 + cT.y} r={3 * zScale} fill="#ffb700" />
          </g>
        );
      })}
    </>
  );
};
