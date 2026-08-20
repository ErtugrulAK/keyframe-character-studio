import React from 'react';
import { useAnimator } from '../../../context/AnimatorContext';
import type { BodyPartType } from '../../../types/animator';
import { Type } from 'lucide-react';

interface TextPreset {
  label: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  fontStyle?: string;
  colorClass: string;
  /** Preview font stack used for the card label. */
  previewFamily: string;
  description: string;
}

const TEXT_PRESETS: TextPreset[] = [
  {
    label: 'Display Title',
    fontFamily: 'Bebas Neue',
    fontSize: 64,
    fontWeight: 400,
    colorClass: 'text-cyan',
    previewFamily: "'Bebas Neue', sans-serif",
    description: 'Bebas Neue · 64px',
  },
  {
    label: 'Heading',
    fontFamily: 'Outfit',
    fontSize: 48,
    fontWeight: 800,
    colorClass: 'text-cyan',
    previewFamily: 'Outfit',
    description: 'Outfit · 48px',
  },
  {
    label: 'Cinematic Title',
    fontFamily: 'Playfair Display',
    fontSize: 42,
    fontWeight: 400,
    fontStyle: 'italic',
    colorClass: 'text-gold',
    previewFamily: "'Playfair Display', serif",
    description: 'Playfair Display · 42px',
  },
  {
    label: 'Subheading',
    fontFamily: 'Inter',
    fontSize: 24,
    fontWeight: 600,
    colorClass: 'text-teal',
    previewFamily: 'Inter',
    description: 'Inter · 24px',
  },
  {
    label: 'Body Text',
    fontFamily: 'Inter',
    fontSize: 16,
    fontWeight: 400,
    colorClass: 'text-green',
    previewFamily: 'Inter',
    description: 'Inter · 16px',
  },
  {
    label: 'Button Label',
    fontFamily: 'Montserrat',
    fontSize: 16,
    fontWeight: 700,
    colorClass: 'text-purple',
    previewFamily: 'Montserrat',
    description: 'Montserrat · 16px',
  },
];

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
      <div className="drawer-grid" style={{ gridTemplateColumns: '1fr' }}>
        {TEXT_PRESETS.map((preset) => (
          <button
            key={preset.label}
            className="drawer-item-card"
            style={{ justifyContent: 'flex-start', alignItems: 'center', padding: '18px 20px' }}
            draggable={true}
            onDragStart={(e) =>
              handleDragStart(e, 'custom_text', preset.label, { fontFamily: preset.fontFamily, fontSize: preset.fontSize })
            }
            onClick={() =>
              addCustomPart('custom_text', preset.label, { fontFamily: preset.fontFamily, fontSize: preset.fontSize })
            }
          >
            <Type size={26} className={preset.colorClass} />
            <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
              <span
                className="item-label"
                style={{
                  fontFamily: preset.previewFamily,
                  fontSize: 23,
                  fontWeight: preset.fontWeight,
                  fontStyle: preset.fontStyle,
                  letterSpacing: preset.label === 'Button Label' ? 0.5 : undefined,
                }}
              >
                {preset.label}
              </span>
              <span style={{ fontSize: 14, color: 'var(--text-muted)', letterSpacing: '0.4px' }}>{preset.description}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};
