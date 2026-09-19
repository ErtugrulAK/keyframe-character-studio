import React from 'react';
import { useAnimator } from '../../../context/useAnimator';
import type { BodyPartType } from '../../../types/animator';
import { Type } from 'lucide-react';

interface TextPreset {
  label: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  fontStyle?: string;
  /** Accent tone of the card's icon badge; the CSS owns the colours. */
  tone: 'cyan' | 'gold' | 'teal' | 'green' | 'purple';
  /** Preview font stack used for the card label. */
  previewFamily: string;
  /** Tracking applied to the preview label, for presets that need it. */
  letterSpacing?: number;
  description: string;
}

const TEXT_PRESETS: TextPreset[] = [
  {
    label: 'Display Title',
    fontFamily: 'Bebas Neue',
    fontSize: 64,
    fontWeight: 400,
    tone: 'cyan',
    previewFamily: "'Bebas Neue', sans-serif",
    description: 'Bebas Neue · 64px',
  },
  {
    label: 'Heading',
    fontFamily: 'Outfit',
    fontSize: 48,
    fontWeight: 800,
    tone: 'cyan',
    previewFamily: 'Outfit',
    description: 'Outfit · 48px',
  },
  {
    label: 'Cinematic Title',
    fontFamily: 'Playfair Display',
    fontSize: 42,
    fontWeight: 400,
    fontStyle: 'italic',
    tone: 'gold',
    previewFamily: "'Playfair Display', serif",
    description: 'Playfair Display · 42px',
  },
  {
    label: 'Subheading',
    fontFamily: 'Inter',
    fontSize: 24,
    fontWeight: 600,
    tone: 'teal',
    previewFamily: 'Inter',
    description: 'Inter · 24px',
  },
  {
    label: 'Body Text',
    fontFamily: 'Inter',
    fontSize: 16,
    fontWeight: 400,
    tone: 'green',
    previewFamily: 'Inter',
    description: 'Inter · 16px',
  },
  {
    label: 'Button Label',
    fontFamily: 'Montserrat',
    fontSize: 16,
    fontWeight: 700,
    tone: 'purple',
    previewFamily: 'Montserrat',
    letterSpacing: 0.5,
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
            type="button"
            className={`text-preset-card tone-${preset.tone}`}
            title="Click to add, or drag onto the canvas"
            draggable={true}
            onDragStart={(e) =>
              handleDragStart(e, 'custom_text', preset.label, { fontFamily: preset.fontFamily, fontSize: preset.fontSize })
            }
            onClick={() =>
              addCustomPart('custom_text', preset.label, { fontFamily: preset.fontFamily, fontSize: preset.fontSize })
            }
          >
            <span className="text-preset-icon" aria-hidden="true">
              <Type size={17} />
            </span>
            <span className="text-preset-text">
              <span
                className="text-preset-label"
                style={{
                  fontFamily: preset.previewFamily,
                  fontWeight: preset.fontWeight,
                  fontStyle: preset.fontStyle,
                  letterSpacing: preset.letterSpacing,
                }}
              >
                {preset.label}
              </span>
              <span className="text-preset-meta">{preset.description}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};
