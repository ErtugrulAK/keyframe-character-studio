import React from 'react';
import { AlignLeft, AlignCenter, AlignRight, AlignVerticalSpaceAround } from 'lucide-react';
import { useAnimator } from '../../../../context/AnimatorContext';
import { getPartBounds } from '../../../../utils/bounds';

/**
 * Multi-selection alignment bar. Renders nothing when fewer than two parts
 * are selected. Alignment math lives here (not in the parent tab).
 */
export const TransformAlignmentBar: React.FC = () => {
  const { selectedPartIds, characterParts, getComputedTransform, currentFrame, updateCurrentTransform: ctxUpdateCurrentTransform } = useAnimator();

  const handleAlign = (type: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => {
    if (selectedPartIds.length < 2) return;
    const partsAndTransforms = selectedPartIds.map(id => {
      const part = characterParts.find(p => p.id === id);
      const t = getComputedTransform(id, currentFrame);
      if (!part || !t) return null;
      const b = getPartBounds(part);
      const w = b.halfW * Math.abs(t.scaleX);
      const h = b.halfH * Math.abs(t.scaleY);
      return { id, t, left: t.x - w, right: t.x + w, top: t.y - h, bottom: t.y + h, cx: t.x, cy: t.y };
    }).filter(Boolean) as any[];

    if (partsAndTransforms.length < 2) return;

    if (type === 'left') {
      const minLeft = Math.min(...partsAndTransforms.map(p => p.left));
      partsAndTransforms.forEach(p => ctxUpdateCurrentTransform({ x: p.t.x - (p.left - minLeft) }, p.id));
    } else if (type === 'right') {
      const maxRight = Math.max(...partsAndTransforms.map(p => p.right));
      partsAndTransforms.forEach(p => ctxUpdateCurrentTransform({ x: p.t.x + (maxRight - p.right) }, p.id));
    } else if (type === 'center') {
      const cx = partsAndTransforms.reduce((acc, p) => acc + p.cx, 0) / partsAndTransforms.length;
      partsAndTransforms.forEach(p => ctxUpdateCurrentTransform({ x: p.t.x + (cx - p.cx) }, p.id));
    } else if (type === 'top') {
      const minTop = Math.min(...partsAndTransforms.map(p => p.top));
      partsAndTransforms.forEach(p => ctxUpdateCurrentTransform({ y: p.t.y - (p.top - minTop) }, p.id));
    } else if (type === 'bottom') {
      const maxBottom = Math.max(...partsAndTransforms.map(p => p.bottom));
      partsAndTransforms.forEach(p => ctxUpdateCurrentTransform({ y: p.t.y + (maxBottom - p.bottom) }, p.id));
    } else if (type === 'middle') {
      const cy = partsAndTransforms.reduce((acc, p) => acc + p.cy, 0) / partsAndTransforms.length;
      partsAndTransforms.forEach(p => ctxUpdateCurrentTransform({ y: p.t.y + (cy - p.cy) }, p.id));
    }
  };

  if (selectedPartIds.length < 2) return null;

  return (
    <div className="panel-card" style={{ marginBottom: 12, padding: 8, display: 'flex', justifyContent: 'space-between', background: 'var(--bg-card)' }}>
      <button className="btn-icon-small" title="Align Left" onClick={() => handleAlign('left')}><AlignLeft size={14} /></button>
      <button className="btn-icon-small" title="Align Center" onClick={() => handleAlign('center')}><AlignCenter size={14} /></button>
      <button className="btn-icon-small" title="Align Right" onClick={() => handleAlign('right')}><AlignRight size={14} /></button>
      <div style={{ width: 1, height: 16, background: 'var(--border-color)', margin: '0 4px' }} />
      <button className="btn-icon-small" title="Align Top" onClick={() => handleAlign('top')}><AlignLeft size={14} style={{transform:'rotate(90deg)'}} /></button>
      <button className="btn-icon-small" title="Align Middle" onClick={() => handleAlign('middle')}><AlignVerticalSpaceAround size={14} style={{transform:'rotate(90deg)'}} /></button>
      <button className="btn-icon-small" title="Align Bottom" onClick={() => handleAlign('bottom')}><AlignRight size={14} style={{transform:'rotate(90deg)'}} /></button>
    </div>
  );
};
