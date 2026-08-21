import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CharacterPart } from '../types/animator';
import { StyleGeometrySection } from '../components/Inspector/sections/style/StyleGeometrySection';

const makePart = (type: CharacterPart['type']): CharacterPart => ({
  id: 'part',
  name: 'Part',
  type,
  zIndex: 1,
  baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
} as CharacterPart);

describe('StyleGeometrySection', () => {
  it.each(['custom_triangle', 'custom_circle', 'custom_star', 'custom_diamond', 'custom_parallelogram', 'custom_freeform'] as const)(
    'does not render an empty Geometry card for %s',
    (type) => {
      render(<StyleGeometrySection selectedPart={makePart(type)} onPartPropChange={vi.fn()} />);
      expect(screen.queryByText('GEOMETRY')).toBeNull();
    },
  );

  it.each(['custom_rect', 'custom_box', 'custom_card', 'custom_banner'] as const)(
    'preserves the corner-radius control for %s',
    (type) => {
      render(<StyleGeometrySection selectedPart={makePart(type)} onPartPropChange={vi.fn()} />);
      expect(screen.getByText('GEOMETRY')).toBeVisible();
      expect(screen.getByText('CORNER RADIUS')).toBeVisible();
    },
  );
});
