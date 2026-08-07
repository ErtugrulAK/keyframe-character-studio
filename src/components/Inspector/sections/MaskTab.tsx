import React from 'react';
import type { CharacterPart, Transform, MaskPoint } from '../../../types/animator';
import { useAnimator } from '../../../context/AnimatorContext';
import { getPartBounds } from '../../../utils/bounds';
import { Scissors, Move, Feather, Eye, Layers, Box, MousePointerClick } from 'lucide-react';

interface SmartNumberInputProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (val: number) => void;
}

const SmartNumberInput: React.FC<SmartNumberInputProps> = ({ value, min, max, step = 1, onChange }) => {
  const roundedVal = Math.round((value ?? 0) * 100) / 100;
  const [editingValue, setEditingValue] = React.useState<string>(String(roundedVal));
  const [isFocused, setIsFocused] = React.useState<boolean>(false);

  React.useEffect(() => {
    if (!isFocused) {
      setEditingValue(String(roundedVal));
    }
  }, [roundedVal, isFocused]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const valStr = e.target.value;
    setEditingValue(valStr);
    const parsed = parseFloat(valStr);
    if (!isNaN(parsed)) {
      const rounded = Math.round(parsed * 100) / 100;
      onChange(rounded);
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    let parsed = parseFloat(editingValue);
    if (isNaN(parsed)) {
      setEditingValue(String(roundedVal));
    } else {
      if (min !== undefined) parsed = Math.max(min, parsed);
      if (max !== undefined) parsed = Math.min(max, parsed);
      const rounded = Math.round(parsed * 100) / 100;
      setEditingValue(String(rounded));
      onChange(rounded);
    }
  };

  return (
    <input
      type="number"
      className="input-control"
      value={editingValue}
      min={min}
      max={max}
      step={step}
      onFocus={(e) => {
        setIsFocused(true);
        e.target.select();
      }}
      onBlur={handleBlur}
      onChange={handleChange}
      style={{
        flex: 1,
        width: '100%',
        minWidth: 50,
        height: 24,
        textAlign: 'right',
        fontSize: 11,
        fontWeight: 700,
        background: 'var(--bg-darkest)',
        border: '1px solid var(--border-color)',
        borderRadius: 4,
        color: '#38bdf8',
        padding: '0 6px',
      }}
    />
  );
};

interface MaskTabProps {
  selectedPart: CharacterPart;
  transform: Transform;
  updateCurrentTransform: (newTransform: Partial<Transform>, partIdOverride?: string) => void;
  handlePartPropChange?: (key: keyof CharacterPart, value: any) => void;
}

/**
 * Framing card for an element that lives inside a container shape — mirrors the
 * INNER MEDIA FRAMING controls (offset / scale / rotation) but edits the child's
 * container-local transform so the user can move & resize shapes inside a shape.
 */
const ChildFrameCard: React.FC<{
  child: CharacterPart;
  parentName: string;
  transform: Transform;
  onUpdate: (partial: Partial<Transform>) => void;
  onSelect?: () => void;
}> = ({ child, parentName, transform, onUpdate, onSelect }) => {
  const avgScale = (Math.abs(transform.scaleX) + Math.abs(transform.scaleY)) / 2;
  const labelStyle: React.CSSProperties = {
    fontSize: 10,
    fontWeight: 700,
    color: '#14b8a6',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  };
  return (
    <div
      style={{
        background: 'var(--bg-panel)',
        border: '1px solid var(--border-color)',
        borderRadius: 6,
        padding: 8,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
        <span style={labelStyle}>
          <Box size={11} /> {child.name}
          <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>· inside {parentName}</span>
        </span>
        {onSelect && (
          <button
            type="button"
            className="btn-secondary"
            style={{ height: 20, fontSize: 9, fontWeight: 700, padding: '0 8px', display: 'flex', alignItems: 'center', gap: 4 }}
            onClick={onSelect}
          >
            <MousePointerClick size={10} /> SELECT
          </button>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        <div className="form-field-group" style={{ background: 'var(--bg-darkest)', border: '1px solid var(--border-color)', padding: '4px 8px', borderRadius: 'var(--radius-sm)', justifyContent: 'space-between', margin: 0 }}>
          <span className="param-label">OFFSET X</span>
          <SmartNumberInput value={transform.x} step={1} onChange={(val) => onUpdate({ x: val })} />
        </div>
        <div className="form-field-group" style={{ background: 'var(--bg-darkest)', border: '1px solid var(--border-color)', padding: '4px 8px', borderRadius: 'var(--radius-sm)', justifyContent: 'space-between', margin: 0 }}>
          <span className="param-label">OFFSET Y</span>
          <SmartNumberInput value={transform.y} step={1} onChange={(val) => onUpdate({ y: val })} />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        <div className="form-field-group" style={{ background: 'var(--bg-darkest)', border: '1px solid var(--border-color)', padding: '4px 8px', borderRadius: 'var(--radius-sm)', justifyContent: 'space-between', margin: 0 }}>
          <span className="param-label">SCALE (%)</span>
          <SmartNumberInput value={Math.round(avgScale * 100)} min={1} step={10} onChange={(val) => onUpdate({ scaleX: val / 100, scaleY: val / 100 })} />
        </div>
        <div className="form-field-group" style={{ background: 'var(--bg-darkest)', border: '1px solid var(--border-color)', padding: '4px 8px', borderRadius: 'var(--radius-sm)', justifyContent: 'space-between', margin: 0 }}>
          <span className="param-label">ROTATION (°)</span>
          <SmartNumberInput value={transform.rotation} step={1} onChange={(val) => onUpdate({ rotation: val })} />
        </div>
      </div>
    </div>
  );
};

export const MaskTab: React.FC<MaskTabProps> = ({ selectedPart, transform, updateCurrentTransform, handlePartPropChange }) => {
  const { activeTool, setActiveTool, characterParts, getComputedTransform, currentFrame, handleSelectPart } = useAnimator();

  const children = characterParts.filter((c) => c.parentId === selectedPart.id);
  const parent = selectedPart.parentId ? characterParts.find((p) => p.id === selectedPart.parentId) : null;
  
  const mask = transform.mask || selectedPart.mask || {
    enabled: false,
    inverted: false,
    feather: 0,
    opacity: 1,
    closed: true,
    points: []
  };

  const handleToggleMask = () => {
    if (!mask.enabled && mask.points.length === 0) {
      // The default mask should MEAN something for the shape it is applied to:
      // freeform polygons start with the mask on their own vertices; other
      // shapes get a rectangle that matches their actual bounds.
      let defaultPoints: MaskPoint[];
      if (selectedPart.type === 'custom_freeform' && selectedPart.points && selectedPart.points.length >= 3) {
        defaultPoints = selectedPart.points.map((p) => ({ x: p.x, y: p.y }));
      } else {
        const bounds = getPartBounds(selectedPart);
        const w = bounds.halfW * 2;
        const h = bounds.halfH * 2;
        defaultPoints = [
          { x: -w / 2, y: -h / 2 },
          { x: w / 2, y: -h / 2 },
          { x: w / 2, y: h / 2 },
          { x: -w / 2, y: h / 2 },
        ];
      }
      updateCurrentTransform({ mask: { ...mask, enabled: true, points: defaultPoints } });
      setActiveTool('mask');
    } else {
      updateCurrentTransform({ mask: { ...mask, enabled: !mask.enabled } });
      if (!mask.enabled) {
        setActiveTool('mask');
      } else if (activeTool === 'mask') {
        setActiveTool('select');
      }
    }
  };

  return (
    <div className="inspector-section" style={{ paddingTop: 6 }}>
      {/* ── SECTION 0: INNER MEDIA FRAMING (top — the image inside the shape) ── */}
      {selectedPart.innerMediaUrl && (
        <>
          <div className="section-title-bar" style={{ marginBottom: 8 }}>
            <div className="section-title">
              <Move size={13} className="text-teal" />
              <span>INNER MEDIA FRAMING</span>
            </div>
          </div>

          <div className="panel-card" style={{ marginBottom: 8, padding: 10 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, width: "100%" }}>
              <div className="form-field-group" style={{ background: "var(--bg-panel)", border: "1px solid var(--border-color)", padding: "4px 8px", borderRadius: "var(--radius-sm)", justifyContent: "space-between", margin: 0 }}>
                <span className="param-label">OFFSET X</span>
                <SmartNumberInput
                  value={transform?.maskOffsetX ?? selectedPart.maskOffsetX ?? 0}
                  step={1}
                  onChange={(val) => {
                    if (handlePartPropChange) handlePartPropChange('maskOffsetX', val);
                    updateCurrentTransform({ maskOffsetX: val });
                  }}
                />
              </div>
              <div className="form-field-group" style={{ background: "var(--bg-panel)", border: "1px solid var(--border-color)", padding: "4px 8px", borderRadius: "var(--radius-sm)", justifyContent: "space-between", margin: 0 }}>
                <span className="param-label">OFFSET Y</span>
                <SmartNumberInput
                  value={transform?.maskOffsetY ?? selectedPart.maskOffsetY ?? 0}
                  step={1}
                  onChange={(val) => {
                    if (handlePartPropChange) handlePartPropChange('maskOffsetY', val);
                    updateCurrentTransform({ maskOffsetY: val });
                  }}
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, width: "100%", marginTop: 8 }}>
              <div className="form-field-group" style={{ background: "var(--bg-panel)", border: "1px solid var(--border-color)", padding: "4px 8px", borderRadius: "var(--radius-sm)", justifyContent: "space-between", margin: 0 }}>
                <span className="param-label">SCALE (%)</span>
                <SmartNumberInput
                  value={Math.round((transform?.maskScale ?? selectedPart.maskScale ?? 1) * 100)}
                  min={1}
                  step={10}
                  onChange={(val) => {
                    if (handlePartPropChange) handlePartPropChange('maskScale', val / 100);
                    updateCurrentTransform({ maskScale: val / 100 });
                  }}
                />
              </div>
              <div className="form-field-group" style={{ background: "var(--bg-panel)", border: "1px solid var(--border-color)", padding: "4px 8px", borderRadius: "var(--radius-sm)", justifyContent: "space-between", margin: 0 }}>
                <span className="param-label">OPACITY (%)</span>
                <SmartNumberInput
                  value={Math.round((selectedPart.innerMediaOpacity ?? 1) * 100)}
                  min={0}
                  max={100}
                  step={10}
                  onChange={(val) => {
                    if (handlePartPropChange) handlePartPropChange('innerMediaOpacity', val / 100);
                  }}
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, width: "100%", marginTop: 8 }}>
              <div className="form-field-group" style={{ background: "var(--bg-panel)", border: "1px solid var(--border-color)", padding: "4px 8px", borderRadius: "var(--radius-sm)", justifyContent: "space-between", margin: 0 }}>
                <span className="param-label">ROTATION (°)</span>
                <SmartNumberInput
                  value={transform?.maskRotation ?? selectedPart.maskRotation ?? 0}
                  step={1}
                  onChange={(val) => {
                    if (handlePartPropChange) handlePartPropChange('maskRotation', val);
                    updateCurrentTransform({ maskRotation: val });
                  }}
                />
              </div>
              <button
                type="button"
                className="btn-secondary"
                style={{ height: 28, fontSize: 10, fontWeight: 700, padding: '0 10px', color: '#f59e0b', background: '#0e1118', border: '1px solid #232836', borderRadius: 4 }}
                onClick={() => {
                  if (handlePartPropChange) {
                    handlePartPropChange('maskOffsetX', 0);
                    handlePartPropChange('maskOffsetY', 0);
                    handlePartPropChange('maskScale', 1);
                    handlePartPropChange('maskRotation', 0);
                    handlePartPropChange('innerMediaOpacity', 1);
                  }
                  updateCurrentTransform({ maskOffsetX: 0, maskOffsetY: 0, maskScale: 1, maskRotation: 0 });
                }}
              >
                RESET FRAME
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── SECTION 0.5: SHAPES INSIDE (container children framing) ── */}
      {(selectedPart.parentId || children.length > 0) && (
        <>
          <div className="section-title-bar" style={{ marginBottom: 8 }}>
            <div className="section-title">
              <Box size={13} className="text-teal" />
              <span>{selectedPart.parentId ? 'ELEMENT INSIDE SHAPE' : 'SHAPES INSIDE THIS SHAPE'}</span>
            </div>
          </div>
          <div className="panel-card" style={{ marginBottom: 8, padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {selectedPart.parentId && (
              <ChildFrameCard
                child={selectedPart}
                parentName={parent?.name ?? 'shape'}
                transform={transform}
                onUpdate={(p) => updateCurrentTransform(p, selectedPart.id)}
              />
            )}
            {children.map((child) => {
              const childT = getComputedTransform(child.id, currentFrame);
              return (
                <ChildFrameCard
                  key={child.id}
                  child={child}
                  parentName={selectedPart.name}
                  transform={childT}
                  onUpdate={(p) => updateCurrentTransform(p, child.id)}
                  onSelect={() => handleSelectPart(child.id)}
                />
              );
            })}
          </div>
        </>
      )}

      {/* ── SECTION 1: VECTOR PATH MASKING ── */}
      <div className="section-title-bar" style={{ marginBottom: 8 }}>
        <div className="section-title">
          <Scissors size={13} className="text-cyan" />
          <span>VECTOR PATH MASKING</span>
        </div>
      </div>

      <div className="panel-card" style={{ marginBottom: 8, padding: 10 }}>
        {/* Toggle Enable Mask */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Layers size={13} className="text-teal" /> ENABLE VECTOR MASK
          </span>
          <button
            type="button"
            className="btn-secondary"
            style={{
              height: 24,
              fontSize: 10,
              fontWeight: 700,
              padding: '0 10px',
              color: mask.enabled ? '#10b981' : '#64748b',
              background: mask.enabled ? 'rgba(16, 185, 129, 0.15)' : '#0e1118',
              border: `1px solid ${mask.enabled ? '#10b981' : '#232836'}`,
              borderRadius: 4,
            }}
            onClick={handleToggleMask}
          >
            {mask.enabled ? 'Enabled' : 'Disabled'}
          </button>
        </div>

        {mask.enabled && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border-color)' }}>
            
            {/* Edit Points Mode Button */}
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setActiveTool(activeTool === 'mask' ? 'select' : 'mask')}
              style={{
                width: '100%',
                height: 28,
                fontSize: 11,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                color: activeTool === 'mask' ? '#38bdf8' : '#e2e8f0',
                background: activeTool === 'mask' ? 'rgba(56, 189, 248, 0.15)' : 'var(--bg-panel)',
                border: `1px solid ${activeTool === 'mask' ? '#38bdf8' : 'var(--border-color)'}`,
                borderRadius: 4,
              }}
            >
              <Scissors size={13} />
              <span>{activeTool === 'mask' ? 'Exit Edit Mode' : 'Edit Mask Points on Canvas'}</span>
            </button>

            {/* Invert Mask Checkbox */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-panel)', padding: '6px 10px', borderRadius: 4, border: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)' }}>INVERT MASK AREA</span>
              <button
                type="button"
                className="btn-secondary"
                style={{
                  height: 22,
                  fontSize: 10,
                  fontWeight: 700,
                  padding: '0 8px',
                  color: mask.inverted ? '#c084fc' : '#64748b',
                  background: mask.inverted ? 'rgba(192, 132, 252, 0.15)' : '#0e1118',
                  border: `1px solid ${mask.inverted ? '#c084fc' : '#232836'}`,
                  borderRadius: 3,
                }}
                onClick={() => updateCurrentTransform({ mask: { ...mask, inverted: !mask.inverted } })}
              >
                {mask.inverted ? 'Inverted (On)' : 'Normal (Off)'}
              </button>
            </div>

            {/* Feather & Mask Opacity Controls */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div className="form-field-group" style={{ background: "var(--bg-panel)", border: "1px solid var(--border-color)", padding: "4px 8px", borderRadius: "var(--radius-sm)", justifyContent: "space-between", margin: 0 }}>
                <span className="param-label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Feather size={11} className="text-purple" /> FEATHER
                </span>
                <SmartNumberInput
                  value={mask.feather}
                  min={0}
                  max={100}
                  step={1}
                  onChange={(val) => updateCurrentTransform({ mask: { ...mask, feather: val } })}
                />
              </div>

              <div className="form-field-group" style={{ background: "var(--bg-panel)", border: "1px solid var(--border-color)", padding: "4px 8px", borderRadius: "var(--radius-sm)", justifyContent: "space-between", margin: 0 }}>
                <span className="param-label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Eye size={11} className="text-gold" /> OPACITY
                </span>
                <SmartNumberInput
                  value={mask.opacity}
                  min={0}
                  max={1}
                  step={0.05}
                  onChange={(val) => updateCurrentTransform({ mask: { ...mask, opacity: val } })}
                />
              </div>
            </div>

          </div>
        )}
      </div>

    </div>
  );
};
