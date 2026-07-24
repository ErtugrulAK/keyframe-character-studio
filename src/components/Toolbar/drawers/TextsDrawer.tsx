import React from 'react';
import { useAnimator } from '../../../context/AnimatorContext';
import type { BodyPartType } from '../../../types/animator';
import { Type } from 'lucide-react';

export const TextsDrawer: React.FC = () => {
  const { addCustomPart } = useAnimator();

  const handleDragStart = (e: React.DragEvent, type: BodyPartType, label: string, extraData?: Record<string, any>) => {
    e.dataTransfer.setData(
      'application/json',
      JSON.stringify({
        type,
        name: label,
        ...extraData,
      })
    );
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <div className="drawer-content">
      <div className="drawer-header">
        <span className="drawer-title">Text Elements</span>
      </div>

      <div className="drawer-subtitle" style={{ marginBottom: 10 }}>TYPOGRAPHY PRESETS</div>
      <div className="drawer-grid" style={{ gridTemplateColumns: '1fr' }}>
        <button
          className="drawer-item-card"
          style={{ justifyContent: 'flex-start', padding: '10px 14px' }}
          draggable={true}
          onDragStart={(e) => handleDragStart(e, 'custom_text', 'HEADING', { fontFamily: 'Outfit', fontSize: 48 })}
          onClick={() => addCustomPart('custom_text', 'HEADING', { fontFamily: 'Outfit', fontSize: 48 })}
        >
          <Type size={16} className="text-cyan" />
          <span className="item-label" style={{ fontFamily: 'Outfit', fontSize: 16, fontWeight: 800 }}>Add Heading</span>
        </button>

        <button
          className="drawer-item-card"
          style={{ justifyContent: 'flex-start', padding: '10px 14px' }}
          draggable={true}
          onDragStart={(e) => handleDragStart(e, 'custom_text', 'Cinematic Title', { fontFamily: 'Playfair Display', fontSize: 42 })}
          onClick={() => addCustomPart('custom_text', 'Cinematic Title', { fontFamily: 'Playfair Display', fontSize: 42 })}
        >
          <Type size={16} className="text-gold" />
          <span className="item-label" style={{ fontFamily: '"Playfair Display", serif', fontSize: 16, fontStyle: 'italic' }}>Cinematic Title</span>
        </button>

        <button
          className="drawer-item-card"
          style={{ justifyContent: 'flex-start', padding: '10px 14px' }}
          draggable={true}
          onDragStart={(e) => handleDragStart(e, 'custom_text', 'Subheading', { fontFamily: 'Inter', fontSize: 24 })}
          onClick={() => addCustomPart('custom_text', 'Subheading', { fontFamily: 'Inter', fontSize: 24 })}
        >
          <Type size={16} className="text-teal" />
          <span className="item-label" style={{ fontFamily: 'Inter', fontSize: 14, fontWeight: 600 }}>Add Subheading</span>
        </button>

        <button
          className="drawer-item-card"
          style={{ justifyContent: 'flex-start', padding: '10px 14px' }}
          draggable={true}
          onDragStart={(e) => handleDragStart(e, 'custom_text', 'Body text block', { fontFamily: 'Roboto', fontSize: 16 })}
          onClick={() => addCustomPart('custom_text', 'Body text block', { fontFamily: 'Roboto', fontSize: 16 })}
        >
          <Type size={16} className="text-purple" />
          <span className="item-label" style={{ fontFamily: 'Roboto', fontSize: 12, fontWeight: 400 }}>Add Body Text</span>
        </button>

        <button
          className="drawer-item-card"
          style={{ justifyContent: 'flex-start', padding: '10px 14px' }}
          draggable={true}
          onDragStart={(e) => handleDragStart(e, 'custom_text', 'function_call()', { fontFamily: 'JetBrains Mono', fontSize: 14 })}
          onClick={() => addCustomPart('custom_text', 'function_call()', { fontFamily: 'JetBrains Mono', fontSize: 14 })}
        >
          <Type size={16} className="text-red" />
          <span className="item-label" style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 12 }}>Code Snippet</span>
        </button>
      </div>
    </div>
  );
};
