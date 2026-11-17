import React, { useRef } from 'react';
import type { CharacterPart } from '../../../../types/animator';
import { useReplaceImage } from '../../../../hooks/useMediaImport';
import { StyleCard } from './StyleCard';

/**
 * An image layer's picture: Replace Image… swaps it for another file and keeps
 * the layer's position, animation, masks, matte and effects.
 */
export const ReplaceImageCard: React.FC<{ part: CharacterPart; readOnlyReason?: string }> = ({ part, readOnlyReason }) => {
  const replaceImage = useReplaceImage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  return (
    <StyleCard title="IMAGE" collapsible retainKey="image-source">
      <p className="matte-section-intro">Swap the picture for another file. Position, animation, masks, matte and effects stay; the height follows the new picture's proportions.</p>
      <button
        type="button"
        className="btn-secondary"
        disabled={Boolean(readOnlyReason)}
        title={readOnlyReason ?? 'Choose another image for this layer'}
        onClick={() => fileInputRef.current?.click()}
      >
        Replace Image…
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        hidden
        data-testid="replace-image-input"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) replaceImage(part.id, file);
          event.target.value = '';
        }}
      />
    </StyleCard>
  );
};
