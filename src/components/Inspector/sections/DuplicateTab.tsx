import React from 'react';
import { CopyPlus, FlipHorizontal2, FlipVertical2, RotateCw } from 'lucide-react';
import { useAnimator } from '../../../context/AnimatorContext';

/**
 * Duplicate inspector tab: normal copy plus mirror copies (Y axis, X axis,
 * origin). All operations act on the currently selected part.
 */
export const DuplicateTab: React.FC = () => {
  const { duplicateSelectedPart, duplicateMirrored } = useAnimator();

  const options = [
    {
      icon: <CopyPlus size={16} className="text-cyan" />,
      label: 'Duplicate',
      hint: 'Same shape copy, offset by 20px (Ctrl+D)',
      run: () => duplicateSelectedPart(),
    },
    {
      icon: <FlipHorizontal2 size={16} className="text-cyan" />,
      label: 'Mirror Y',
      hint: 'Horizontal flip — mirrored across the Y axis',
      run: () => duplicateMirrored('y'),
    },
    {
      icon: <FlipVertical2 size={16} className="text-cyan" />,
      label: 'Mirror X',
      hint: 'Vertical flip — mirrored across the X axis',
      run: () => duplicateMirrored('x'),
    },
    {
      icon: <RotateCw size={16} className="text-cyan" />,
      label: 'Mirror Origin',
      hint: '180° point reflection through the origin',
      run: () => duplicateMirrored('origin'),
    },
  ];

  return (
    <div className="inspector-section" style={{ paddingTop: 8 }}>
      <div className="panel-card" style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {options.map((opt) => (
            <button
              key={opt.label}
              type="button"
              className="btn-secondary"
              style={{
                justifyContent: 'flex-start',
                gap: 10,
                padding: '10px 12px',
                fontSize: 13,
                fontWeight: 700,
                borderRadius: 6,
                background: 'var(--bg-panel)',
                border: '1px solid var(--border-color)',
              }}
              onClick={opt.run}
              title={opt.hint}
            >
              {opt.icon}
              <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1 }}>
                <span>{opt.label}</span>
                <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-muted)' }}>{opt.hint}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
