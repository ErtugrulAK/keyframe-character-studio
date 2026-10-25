import React from 'react';
import { CopyPlus, FlipHorizontal2, FlipVertical2, RotateCw } from 'lucide-react';
import { useAnimator } from '../../../context/useAnimator';

/**
 * Duplicate card of the Layer tab: a plain copy plus mirror copies of the
 * selected layer. C8: it moved here from the Details header; the mirror copies
 * reflect across the STAGE's centre lines (x = 0, y = 0), which the titles say,
 * so a mirrored copy lands on the other side of the stage. Flipping a layer in
 * place is the toolbar's Flip.
 */
export const DuplicateTab: React.FC = () => {
  const { duplicateSelectedPart, duplicateMirrored } = useAnimator();

  const options = [
    {
      icon: <CopyPlus size={14} className="text-cyan" />,
      label: 'Duplicate',
      title: 'Same layer, offset by 20 units (Ctrl+D)',
      run: () => duplicateSelectedPart(),
    },
    {
      icon: <FlipHorizontal2 size={14} className="text-cyan" />,
      label: 'Mirror Y',
      title: 'Copy mirrored left ↔ right across the stage\'s vertical centre line (x = 0)',
      run: () => duplicateMirrored('y'),
    },
    {
      icon: <FlipVertical2 size={14} className="text-cyan" />,
      label: 'Mirror X',
      title: 'Copy mirrored top ↔ bottom across the stage\'s horizontal centre line (y = 0)',
      run: () => duplicateMirrored('x'),
    },
    {
      icon: <RotateCw size={14} className="text-cyan" />,
      label: 'Mirror Origin',
      title: 'Copy turned 180° around the stage centre (0, 0)',
      run: () => duplicateMirrored('origin'),
    },
  ];

  return (
    <div className="duplicate-options" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 6 }}>
      {options.map((opt) => (
        <button
          key={opt.label}
          type="button"
          className="btn-secondary"
          style={{ justifyContent: 'center', gap: 6, minHeight: 28 }}
          onClick={opt.run}
          title={opt.title}
        >
          {opt.icon}
          <span>{opt.label}</span>
        </button>
      ))}
    </div>
  );
};
