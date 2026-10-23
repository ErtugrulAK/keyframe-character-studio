import React, { useId } from 'react';
import { useRetainedUiState } from '../../../../hooks/useRetainedUiState';

interface StyleCardProps {
  title: string;
  collapsible?: boolean;
  defaultOpen?: boolean;
  /**
   * A stable, unique name for this card kind (titles repeat, e.g. APPEARANCE).
   * With it, the open/closed state is session UI memory: it survives the
   * Inspector being unmounted (Edit → Broadcast → Edit) and selecting another
   * layer that shows the same card. Without it the state lives per mount.
   */
  retainKey?: string;
  /** C6 — a short status next to the title ("In use", "Advanced"); not part of the card's name. */
  badge?: string;
  /** C6 — 'quiet' de-emphasises a card that is kept for compatibility and unused here. */
  tone?: 'default' | 'quiet';
  children: React.ReactNode;
}

/**
 * Shared Inspector section shell. Disclosure state is UI state only and is
 * intentionally not connected to project data or history.
 */
export const StyleCard: React.FC<StyleCardProps> = ({
  title,
  collapsible = false,
  defaultOpen = true,
  retainKey,
  badge,
  tone = 'default',
  children,
}) => {
  const [isOpen, setIsOpen] = useRetainedUiState(retainKey ? `inspector-card:${retainKey}` : null, defaultOpen);
  const contentId = useId();
  const visible = !collapsible || isOpen;

  return (
    <section className={`panel-card inspector-section-card ${collapsible ? 'is-collapsible' : ''}${tone === 'quiet' ? ' is-quiet' : ''}`}>
      <div className="inspector-section-header">
        <span className="inspector-section-title">{title}</span>
        {badge && <span className="inspector-section-badge">{badge}</span>}
        {collapsible && (
          <button
            type="button"
            className="inspector-disclosure-button"
            aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${title}`}
            aria-expanded={isOpen}
            aria-controls={contentId}
            onClick={() => setIsOpen((open) => !open)}
          >
            <span aria-hidden="true">{isOpen ? '▾' : '▸'}</span>
          </button>
        )}
      </div>
      {visible && <div id={contentId} className="inspector-section-content">{children}</div>}
    </section>
  );
};
