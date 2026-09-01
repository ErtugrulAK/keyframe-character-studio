import React, { useId, useState } from 'react';

interface StyleCardProps {
  title: string;
  collapsible?: boolean;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

/**
 * Shared Inspector section shell. Disclosure state is local UI state and is
 * intentionally not connected to project data or history.
 */
export const StyleCard: React.FC<StyleCardProps> = ({
  title,
  collapsible = false,
  defaultOpen = true,
  children,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const contentId = useId();
  const visible = !collapsible || isOpen;

  return (
    <section className={`panel-card inspector-section-card ${collapsible ? 'is-collapsible' : ''}`}>
      <div className="inspector-section-header">
        <span className="inspector-section-title">{title}</span>
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
