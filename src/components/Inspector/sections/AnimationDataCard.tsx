import React from 'react';
import { StyleCard } from './style/StyleCard';

interface AnimationDataCardProps {
  partId: string;
  onCopyAnimation: () => void;
  onPasteAnimation?: () => void;
  onClearAnimation?: () => void;
  clipboardSourceId?: string | null;
}

/**
 * The canonical animation-data actions (copy, paste onto this layer,
 * clear). Named sequences still use them; the legacy procedural IN/OUT editor
 * is intentionally de-emphasized without removing its data model or runtime
 * support.
 */
export const AnimationDataCard: React.FC<AnimationDataCardProps> = ({
  partId,
  onCopyAnimation,
  onPasteAnimation,
  onClearAnimation,
  clipboardSourceId,
}) => (
  <StyleCard title="ANIMATION DATA" collapsible retainKey="animation-data">
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
      <button
        type="button"
        className="btn-secondary"
        title="Copy animation from this element"
        aria-label="Copy Animation"
        data-lock-exempt
        onClick={onCopyAnimation}
      >
        Copy Animation
      </button>
      <button
        type="button"
        className="btn-secondary"
        title="Paste animation onto selected element"
        aria-label="Paste Animation"
        disabled={!clipboardSourceId || clipboardSourceId === partId}
        onClick={onPasteAnimation}
      >
        Paste Animation
      </button>
      {onClearAnimation && (
        <button
          type="button"
          className="btn-secondary"
          style={{ color: '#f87171' }}
          title="Clear animation (IN/OUT presets, durations and keyframes)"
          aria-label="Clear Animation"
          onClick={onClearAnimation}
        >
          Clear Animation
        </button>
      )}
    </div>
  </StyleCard>
);
