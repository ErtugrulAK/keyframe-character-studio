import React from 'react';

interface StyleCardProps {
  title: string;
  icon?: React.ReactNode;
  color?: string;
  children: React.ReactNode;
}

/**
 * Titled rectangle card used by every Style tab section — the same visual
 * language as the LAYER ORDER card in the Transform tab.
 */
export const StyleCard: React.FC<StyleCardProps> = ({ title, icon, color = '#38bdf8', children }) => (
  <div className="panel-card" style={{ marginBottom: 10 }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color, display: 'flex', alignItems: 'center', gap: 6, letterSpacing: '0.4px' }}>
        {icon} {title}
      </span>
    </div>
    {children}
  </div>
);
