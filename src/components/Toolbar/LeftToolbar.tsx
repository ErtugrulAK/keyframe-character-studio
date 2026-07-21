import React from 'react';
import { useAnimator } from '../../context/AnimatorContext';
import {
  MousePointer,
  Move,
  RotateCw,
  Maximize2,
  PlusCircle,
} from 'lucide-react';
import './LeftToolbar.css';

export const LeftToolbar: React.FC = () => {
  const { activeTool, setActiveTool, addKeyframeForSelected, selectedPartId } = useAnimator();

  return (
    <aside className="left-toolbar">
      <div className="tool-group">
        <button
          className={`btn-icon tool-btn ${activeTool === 'select' ? 'active' : ''}`}
          title="Seç (Select)"
          onClick={() => setActiveTool('select')}
        >
          <MousePointer size={18} />
        </button>

        <button
          className={`btn-icon tool-btn ${activeTool === 'move' ? 'active' : ''}`}
          title="Taşı (Move / Translate)"
          onClick={() => setActiveTool('move')}
        >
          <Move size={18} />
        </button>

        <button
          className={`btn-icon tool-btn ${activeTool === 'rotate' ? 'active' : ''}`}
          title="Döndür (Rotate)"
          onClick={() => setActiveTool('rotate')}
        >
          <RotateCw size={18} />
        </button>

        <button
          className={`btn-icon tool-btn ${activeTool === 'scale' ? 'active' : ''}`}
          title="Ölçeklendir (Scale)"
          onClick={() => setActiveTool('scale')}
        >
          <Maximize2 size={18} />
        </button>
      </div>

      <div className="toolbar-divider" />

      <div className="tool-group">
        <button
          className="btn-icon tool-btn text-gold"
          title="Seçili parçaya Keyframe ekle"
          onClick={addKeyframeForSelected}
          disabled={!selectedPartId}
        >
          <PlusCircle size={18} />
        </button>
      </div>
    </aside>
  );
};
