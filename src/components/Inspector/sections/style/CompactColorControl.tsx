import React from 'react';
import { ColorPickerPopover } from '../../inputs/ColorPickerPopover';

interface CompactColorControlProps {
  /** The picker's accessible name ("FILL COLOR" → "FILL COLOR Color Preview"). */
  label: string;
  value: string | undefined;
  /** Omit, with `onAlphaChange`, for a paint that carries no alpha (the shadow). */
  alpha?: number;
  fallback: string;
  onColorChange: (value: string) => void;
  onAlphaChange?: (value: number) => void;
  onInteractionStart?: () => void;
  onInteractionEnd?: () => void;
}

/**
 * A small swatch with its hex value beside it, as the Appearance card shows
 * fill, stroke and shadow; the full picker opens on click.
 */
export const CompactColorControl: React.FC<CompactColorControlProps> = ({
  label,
  value,
  alpha,
  fallback,
  onColorChange,
  onAlphaChange,
  onInteractionStart,
  onInteractionEnd,
}) => (
  <div className="appearance-color-field appearance-color-compact">
    <ColorPickerPopover
      label={label}
      color={value || fallback}
      alpha={alpha}
      fallback={fallback}
      onColorChange={onColorChange}
      onAlphaChange={onAlphaChange}
      onInteractionStart={onInteractionStart}
      onInteractionEnd={onInteractionEnd}
    />
    <span className="appearance-color-hex" aria-hidden="true">
      {(value || fallback).toUpperCase()}{alpha !== undefined && alpha < 1 ? ` · ${Math.round(alpha * 100)}%` : ''}
    </span>
  </div>
);
