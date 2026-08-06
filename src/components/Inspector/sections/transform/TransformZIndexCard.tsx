import React from 'react';

interface TransformZIndexCardProps {
  zIndex: number;
  onZIndexChange: (zIndex: number) => void;
}

export const TransformZIndexCard: React.FC<TransformZIndexCardProps> = ({ zIndex, onZIndexChange }) => {
  return (
    <div className="panel-card" style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.4px' }}>
          LAYER Z-INDEX ORDER
        </label>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#38bdf8' }}>
          Index {zIndex}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button
          type="button"
          className="btn-secondary"
          style={{ flex: 1, padding: '5px 8px', fontSize: 11, fontWeight: 700 }}
          onClick={() => onZIndexChange(zIndex + 1)}
        >
          Bring Forward (+1)
        </button>
        <button
          type="button"
          className="btn-secondary"
          style={{ flex: 1, padding: '5px 8px', fontSize: 11, fontWeight: 700 }}
          onClick={() => onZIndexChange(Math.max(1, zIndex - 1))}
        >
          Send Backward (-1)
        </button>
      </div>
    </div>
  );
};
