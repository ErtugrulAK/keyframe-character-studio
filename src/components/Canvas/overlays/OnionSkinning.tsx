import React from 'react';
import type { CharacterPart, Transform } from '../../../types/animator';
import { PartRenderer } from '../renderers/PartRenderer';

interface OnionSkinningProps {
  sortedParts: CharacterPart[];
  currentFrame: number;
  totalFrames: number;
  selectedPartId: string | null;
  getComputedTransform: (partId: string, frame: number) => Transform;
  onSelect: (partId: string) => void;
  onStartTranslateDrag: (partId: string, e: React.MouseEvent) => void;
}

export const OnionSkinning: React.FC<OnionSkinningProps> = ({
  sortedParts,
  currentFrame,
  totalFrames,
  selectedPartId,
  getComputedTransform,
  onSelect,
  onStartTranslateDrag,
}) => {
  return (
    <>
      {currentFrame > 0 &&
        sortedParts.map((part) => {
          const prevTransform = getComputedTransform(part.id, currentFrame - 1);
          return (
            <PartRenderer
              key={`ghost-prev-${part.id}`}
              part={part}
              transform={prevTransform}
              isGhost={true}
              ghostColor="#00d2ff"
              isSelected={selectedPartId === part.id}
              currentFrame={currentFrame - 1}
              totalFrames={totalFrames}
              onSelect={onSelect}
              onStartTranslateDrag={onStartTranslateDrag}
            />
          );
        })}
      {sortedParts.map((part) => {
        const nextTransform = getComputedTransform(part.id, currentFrame + 1);
        return (
          <PartRenderer
            key={`ghost-next-${part.id}`}
            part={part}
            transform={nextTransform}
            isGhost={true}
            ghostColor="#ff3366"
            isSelected={selectedPartId === part.id}
            currentFrame={currentFrame + 1}
            totalFrames={totalFrames}
            onSelect={onSelect}
            onStartTranslateDrag={onStartTranslateDrag}
          />
        );
      })}
    </>
  );
};
