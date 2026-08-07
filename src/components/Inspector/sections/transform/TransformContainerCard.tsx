import React from 'react';
import { Box } from 'lucide-react';
import type { CharacterPart, Transform } from '../../../../types/animator';
import { ContainerAssignControl } from '../../shared/ContainerAssignControl';

interface TransformContainerCardProps {
  selectedPart: CharacterPart;
  transform: Transform;
  onPartPropChange: (key: keyof CharacterPart, value: any) => void;
}

/**
 * "CONTAINER" card: puts the selected part inside another shape (clipped to
 * the shape's outline, moving with it). Uses the existing parentId mechanism;
 * the child's baseTransform is stored container-relative.
 */
export const TransformContainerCard: React.FC<TransformContainerCardProps> = ({ selectedPart, transform, onPartPropChange }) => {
  return (
    <div className="panel-card" style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#14b8a6', display: 'flex', alignItems: 'center', gap: 6, letterSpacing: '0.4px' }}>
          <Box size={13} /> CONTAINER
        </span>
      </div>
      <ContainerAssignControl selectedPart={selectedPart} transform={transform} onPartPropChange={onPartPropChange} />
    </div>
  );
};
