import React from 'react';

interface TransformZIndexCardProps {
  zIndex: number;
  onZIndexChange: (zIndex: number) => void;
}

/**
 * Layer stacking order controls: bring forward / send backward.
 */
export const TransformZIndexCard: React.FC<TransformZIndexCardProps> = ({ zIndex, onZIndexChange }) => {
  return (
    <div className="panel-card" style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: 6, letterSpacing: '0.4px' }}>
          LAYER ORDER
        </span>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#38bdf8', background: 'rgba(56, 189, 248, 0.12)', padding: '2px 6px', borderRadius: 4, border: '1px solid rgba(56, 189, 248, 0.3)' }}>
          Index {zIndex}
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        <button
          type="button"
          className="btn-secondary"
          style={{ height: 28, fontSize: 11, fontWeight: 700, padding: '0 10px', borderRadius: 4 }}
          onClick={() => onZIndexChange(zIndex + 1)}
        >
          Bring Forward (+1)
        </button>
        <button
          type="button"
          className="btn-secondary"
          style={{ height: 28, fontSize: 11, fontWeight: 700, padding: '0 10px', borderRadius: 4 }}
          onClick={() => onZIndexChange(Math.max(1, zIndex - 1))}
        >
          Send Backward (-1)
        </button>
      </div>
    </div>
  );
};
