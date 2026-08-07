import React from 'react';
import { useAnimator } from '../../../context/AnimatorContext';
import type { CharacterPart, Transform } from '../../../types/animator';
import { worldToContainerLocal, containerLocalToWorld } from '../../../utils/containerMath';
import { CONTAINER_SHAPE_TYPES } from '../../../utils/containerOutline';

interface ContainerAssignControlProps {
  selectedPart: CharacterPart;
  transform: Transform;
  onPartPropChange: (key: keyof CharacterPart, value: any) => void;
}

/**
 * Shared "put this element inside a shape" control (used by the Transform tab's
 * CONTAINER card and the Style tab's MEDIA & MASKING section). Assigning stores
 * the child's transform container-relative so nothing jumps; removing converts
 * back to world space. Rendering/clipping lives in PartRenderer (parentId).
 */
export const ContainerAssignControl: React.FC<ContainerAssignControlProps> = ({ selectedPart, transform, onPartPropChange }) => {
  const { characterParts, getComputedTransform, currentFrame, updateCurrentTransform } = useAnimator();

  const container = selectedPart.parentId ? characterParts.find((p) => p.id === selectedPart.parentId) : null;
  const containers = characterParts.filter(
    (p) => p.id !== selectedPart.id && p.type !== 'custom_image' && p.type !== 'custom_video' && CONTAINER_SHAPE_TYPES.includes(p.type)
  );

  const assignContainer = (containerId: string) => {
    if (!containerId || containerId === selectedPart.parentId) return;
    const containerT = getComputedTransform(containerId, currentFrame);
    const local = worldToContainerLocal(transform, containerT);
    onPartPropChange('parentId', containerId);
    updateCurrentTransform({
      x: local.x,
      y: local.y,
      rotation: local.rotation,
      scaleX: local.scaleX,
      scaleY: local.scaleY,
      opacity: local.opacity,
    });
  };

  const removeContainer = () => {
    if (!selectedPart.parentId) return;
    const containerT = getComputedTransform(selectedPart.parentId, currentFrame);
    const world = containerLocalToWorld(transform, containerT);
    onPartPropChange('parentId', undefined);
    updateCurrentTransform({
      x: world.x,
      y: world.y,
      rotation: world.rotation,
      scaleX: world.scaleX,
      scaleY: world.scaleY,
      opacity: world.opacity,
    });
  };

  if (container) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div
          style={{
            fontSize: 11,
            color: 'var(--text-primary)',
            background: 'rgba(20, 184, 166, 0.12)',
            border: '1px solid rgba(20, 184, 166, 0.35)',
            borderRadius: 5,
            padding: '6px 8px',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#14b8a6', display: 'inline-block' }} />
          Inside: <strong>{container.name}</strong>
        </div>
        <button
          type="button"
          className="btn-secondary"
          style={{ height: 24, fontSize: 10, fontWeight: 700, padding: '0 10px', color: '#f43f5e', background: '#0e1118', border: '1px solid #232836', borderRadius: 4 }}
          onClick={removeContainer}
        >
          REMOVE FROM CONTAINER
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {containers.length === 0 ? (
        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
          Add a shape (rectangle, circle, free draw…) first — then this element can live inside it.
        </div>
      ) : (
        <>
          <select
            className="input-control"
            value=""
            style={{ width: '100%', height: 26, fontSize: 11 }}
            onChange={(e) => assignContainer(e.target.value)}
          >
            <option value="">Put into a shape…</option>
            {containers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>
            The element gets clipped to the shape's outline and moves together with it.
          </div>
        </>
      )}
    </div>
  );
};
