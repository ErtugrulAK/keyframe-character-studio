import React, { useRef } from 'react';
import { Palette, Sun, Crop, Grid3x3, Atom } from 'lucide-react';
import type { CharacterPart } from '../../../types/animator';

interface SmartNumberInputProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (val: number) => void;
}

const SmartNumberInput: React.FC<SmartNumberInputProps> = ({ value, min, max, step = 1, onChange }) => {
  const [editingValue, setEditingValue] = React.useState<string>(String(value));
  const [isFocused, setIsFocused] = React.useState<boolean>(false);

  React.useEffect(() => {
    if (!isFocused) {
      setEditingValue(String(value));
    }
  }, [value, isFocused]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const valStr = e.target.value;
    setEditingValue(valStr);
    let parsed = parseFloat(valStr);
    if (!isNaN(parsed)) {
      onChange(parsed);
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    let parsed = parseFloat(editingValue);
    if (isNaN(parsed)) {
      setEditingValue(String(value));
    } else {
      if (min !== undefined) parsed = Math.max(min, parsed);
      if (max !== undefined) parsed = Math.min(max, parsed);
      setEditingValue(String(parsed));
      onChange(parsed);
    }
  };

  return (
    <input className="input-control"
                type="number"
      value={isFocused ? editingValue : value}
      min={min}
      max={max}
      step={step}
      onFocus={() => setIsFocused(true)}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          (e.target as HTMLInputElement).blur();
        }
      }}
    />
  );
};

interface SmartHexInputProps {
  value: string;
  fallback: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
}

const SmartHexInput: React.FC<SmartHexInputProps> = ({
  value,
  fallback,
  onChange,
  placeholder,
  className,
}) => {
  const [editingValue, setEditingValue] = React.useState<string>(value || fallback);
  const [isFocused, setIsFocused] = React.useState<boolean>(false);

  React.useEffect(() => {
    if (!isFocused) {
      setEditingValue(value || fallback);
    }
  }, [value, fallback, isFocused]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const valStr = e.target.value;
    setEditingValue(valStr);

    if (/^#([0-9A-Fa-f]{3}){1,2}$/.test(valStr)) {
      onChange(valStr);
    } else if (valStr === '') {
      onChange('');
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    if (!editingValue || !/^#([0-9A-Fa-f]{3}){1,2}$/.test(editingValue)) {
      setEditingValue(value || fallback);
    } else {
      onChange(editingValue);
    }
  };

  return (
    <input
      type="text"
      className={className || "input-control color-hex-input"}
      value={isFocused ? editingValue : (value || fallback)}
      placeholder={placeholder}
      onFocus={(e) => {
        setIsFocused(true);
        e.target.select();
      }}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          (e.target as HTMLInputElement).blur();
        }
      }}
    />
  );
};

const COLOR_SWATCHES = [
  '#00d2ff', '#38bdf8', '#6366f1', '#a855f7', '#ec4899', '#f43f5e',
  '#ffb700', '#f59e0b', '#10b981', '#14b8a6', '#0f172a', '#ffffff',
];

interface StyleTabProps {
  selectedPart: CharacterPart;
  handlePartPropChange: (key: keyof CharacterPart, value: any) => void;
  handlePartColorChange: (key: 'fillColor' | 'strokeColor', color: string) => void;
  handleZIndexChange?: (zIndex: number) => void;
}

export const StyleTab: React.FC<StyleTabProps> = ({
  selectedPart,
  handlePartPropChange,
  handlePartColorChange,
}) => {
  const imageFileInputRef = useRef<HTMLInputElement>(null);
  const videoFileInputRef = useRef<HTMLInputElement>(null);

  const handleImageFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target?.result) {
          handlePartPropChange('imageUrl', ev.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleVideoFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target?.result) {
          handlePartPropChange('videoUrl', ev.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="inspector-section">
      <div className="section-title">
        <Palette size={13} className="text-cyan" />
        <span>SURFACE & MATERIAL DESIGN</span>
      </div>

      <div className="style-controls-list">
        {/* FILL & STROKE COLOR GRID */}
        <div className="color-grid-two-col">
          <div className="color-picker-card">
            <label className="color-card-label">FILL COLOR</label>
            <div className="color-picker-compact">
              <input
                type="color"
                className="color-swatch-input"
                value={selectedPart.fillColor || '#00d2ff'}
                onChange={(e) => handlePartColorChange('fillColor', e.target.value)}
              />
              <SmartHexInput
                value={selectedPart.fillColor || ''}
                fallback="#00d2ff"
                onChange={(val) => handlePartColorChange('fillColor', val)}
              />
            </div>
          </div>

          <div className="color-picker-card">
            <label className="color-card-label">STROKE COLOR</label>
            <div className="color-picker-compact">
              <input
                type="color"
                className="color-swatch-input"
                value={selectedPart.strokeColor || '#1e293b'}
                onChange={(e) => handlePartColorChange('strokeColor', e.target.value)}
              />
              <SmartHexInput
                value={selectedPart.strokeColor || ''}
                fallback="#1e293b"
                onChange={(val) => handlePartColorChange('strokeColor', val)}
              />
            </div>
          </div>
        </div>

        {/* PALETTE SWATCHES */}
        <div className="form-field-group">
          <label className="form-label">QUICK PALETTE SWATCHES</label>
          <div className="swatches-grid">
            {COLOR_SWATCHES.map((color) => (
              <button
                key={color}
                type="button"
                className="color-swatch-btn"
                style={{ backgroundColor: color }}
                onClick={() => handlePartColorChange('fillColor', color)}
                title={`Set Fill to ${color}`}
              />
            ))}
          </div>
        </div>



        
        {/* UI CARD CUSTOMIZATION FIELDS */}
        {selectedPart.type === 'custom_card' && (
          <>
            <div className="form-field-group">
              <label className="form-label">CARD HEADER / CATEGORY</label>
              <input className="input-control"
                type="text"
                value={selectedPart.cardCategory || selectedPart.textValue || ''}
                placeholder="e.g. STUDIO CARD"
                onFocus={(e) => e.target.select()}
                onChange={(e) => {
                  handlePartPropChange('cardCategory', e.target.value);
                  handlePartPropChange('textValue', e.target.value);
                }}
              />
            </div>

            <div className="form-field-group">
              <label className="form-label">MAIN TITLE TEXT</label>
              <input className="input-control"
                type="text"
                value={selectedPart.cardTitle || ''}
                placeholder="e.g. MOTION GRAPHIC"
                onFocus={(e) => e.target.select()}
                onChange={(e) => handlePartPropChange('cardTitle', e.target.value)}
              />
            </div>

            <div className="form-field-group">
              <label className="form-label">ACTION BUTTON TEXT</label>
              <input className="input-control"
                type="text"
                value={selectedPart.cardButtonText || ''}
                placeholder="e.g. ACTIVE"
                onFocus={(e) => e.target.select()}
                onChange={(e) => handlePartPropChange('cardButtonText', e.target.value)}
              />
            </div>
          </>
        )}

        {/* Standard Text Input Control if object is Text or Banner */}
        {(selectedPart.type === 'custom_text' || selectedPart.type === 'custom_banner') && (
          <div className="form-field-group">
            <label className="form-label">TEXT CONTENT</label>
            <input className="input-control"
                type="text"
              value={selectedPart.textValue || ''}
              placeholder="Enter text..."
              onFocus={(e) => e.target.select()}
              onChange={(e) => handlePartPropChange('textValue', e.target.value)}
            />
          </div>
        )}

        {(selectedPart.type === 'custom_text' || selectedPart.type === 'custom_banner' || selectedPart.type === 'custom_card') && (
          <>
            <div className="form-field-group">
              <label className="form-label">FONT FAMILY</label>
              <select className="select-control"
                value={selectedPart.fontFamily || 'Outfit'}
                onChange={(e) => handlePartPropChange('fontFamily', e.target.value)}
              >
                <option value="Outfit">Outfit</option>
                <option value="Inter">Inter</option>
                <option value="Roboto">Roboto</option>
                <option value="Montserrat">Montserrat</option>
                <option value="'Playfair Display'">Playfair Display</option>
                <option value="'Bebas Neue'">Bebas Neue</option>
                <option value="'JetBrains Mono'">JetBrains Mono</option>
              </select>
            </div>

            <div className="form-field-group">
              <label className="form-label">FONT SIZE (PX)</label>
              <SmartNumberInput
                value={selectedPart.fontSize ?? 20}
                min={8}
                max={120}
                onChange={(val) => handlePartPropChange('fontSize', val)}
              />
            </div>

            {/* STAGGERED TEXT ANIMATION */}
            <div className="form-field-group">
              <label className="form-label">STAGGERED TEXT ANIMATION</label>
              <select className="select-control"
                value={selectedPart.textAnimMode || 'none'}
                onChange={(e) => handlePartPropChange('textAnimMode', e.target.value)}
              >
                <option value="none">None (Standard Static Text)</option>
                <option value="chars">Character by Character (Stagger Chars)</option>
                <option value="words">Word by Word (Stagger Words)</option>
              </select>
            </div>

            {selectedPart.textAnimMode && selectedPart.textAnimMode !== 'none' && (
              <div className="form-field-group">
                <label className="form-label">STAGGER DELAY (MS)</label>
                <SmartNumberInput
                  value={selectedPart.textStaggerDelay || 60}
                  min={10}
                  max={500}
                  step={10}
                  onChange={(val) => handlePartPropChange('textStaggerDelay', val)}
                />
              </div>
            )}
          </>
        )}

        {/* TRIM PATH / STROKE PROGRESS ANIMATION */}
        <div className="form-field-group">
          <label className="form-label">TRIM PATH / STROKE DRAW (0-100%)</label>
          <SmartNumberInput
            value={Math.round((selectedPart.strokeProgress ?? 1) * 100)}
            min={0}
            max={100}
            step={5}
            onChange={(val) => handlePartPropChange('strokeProgress', val / 100)}
          />
        </div>

        {/* CORNER RADIUS CONTROL */}
        {(selectedPart.type === 'custom_rect' ||
          selectedPart.type === 'custom_box' ||
          selectedPart.type === 'custom_card' ||
          selectedPart.type === 'custom_banner') && (
          <div className="form-field-group">
            <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>CORNER RADIUS</span>
              <span style={{ color: 'var(--accent-teal)', fontWeight: 800 }}>{selectedPart.borderRadius ?? 0}px</span>
            </label>
            <input
              type="range"
              min={0}
              max={40}
              value={selectedPart.borderRadius ?? 0}
              onChange={(e) => handlePartPropChange('borderRadius', parseInt(e.target.value, 10))}
              style={{ width: '100%', cursor: 'pointer' }}
            />
          </div>
        )}

        {/* MOGRAPH CLONER INSPECTOR CONTROLS */}
        {selectedPart.type === 'mograph_cloner' && selectedPart.clonerConfig && (
          <>
            <div className="section-title" style={{ marginTop: 12 }}>
              <Grid3x3 size={13} className="text-purple" />
              <span>MOGRAPH CLONER CONFIG</span>
            </div>

            <div className="form-field-group">
              <label className="form-label">CLONER LAYOUT MODE</label>
              <select className="select-control"
                value={selectedPart.clonerConfig.mode}
                onChange={(e) =>
                  handlePartPropChange('clonerConfig', {
                    ...selectedPart.clonerConfig,
                    mode: e.target.value as any,
                  })
                }
                style={{
                  width: '100%',
                  height: 28,
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 4,
                  color: '#fff',
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '0 6px',
                }}
              >
                <option value="grid">2D Grid Layout</option>
                <option value="circle">Circular Radial Layout</option>
                <option value="linear">Linear Strip Layout</option>
              </select>
            </div>

            {selectedPart.clonerConfig.mode === 'grid' && (
              <div className="input-grid">
                <div className="form-field-group">
                  <label className="form-label">COUNT X</label>
                  <SmartNumberInput
                    value={selectedPart.clonerConfig.countX}
                    min={1}
                    max={10}
                    onChange={(val) =>
                      handlePartPropChange('clonerConfig', {
                        ...selectedPart.clonerConfig,
                        countX: val,
                      })
                    }
                  />
                </div>
                <div className="form-field-group">
                  <label className="form-label">COUNT Y</label>
                  <SmartNumberInput
                    value={selectedPart.clonerConfig.countY}
                    min={1}
                    max={10}
                    onChange={(val) =>
                      handlePartPropChange('clonerConfig', {
                        ...selectedPart.clonerConfig,
                        countY: val,
                      })
                    }
                  />
                </div>
              </div>
            )}

            {selectedPart.clonerConfig.mode === 'circle' && (
              <div className="input-grid">
                <div className="form-field-group">
                  <label className="form-label">CIRCLE COUNT</label>
                  <SmartNumberInput
                    value={selectedPart.clonerConfig.countCircle}
                    min={3}
                    max={24}
                    onChange={(val) =>
                      handlePartPropChange('clonerConfig', {
                        ...selectedPart.clonerConfig,
                        countCircle: val,
                      })
                    }
                  />
                </div>
                <div className="form-field-group">
                  <label className="form-label">RADIUS (PX)</label>
                  <SmartNumberInput
                    value={selectedPart.clonerConfig.radius}
                    min={10}
                    max={200}
                    onChange={(val) =>
                      handlePartPropChange('clonerConfig', {
                        ...selectedPart.clonerConfig,
                        radius: val,
                      })
                    }
                  />
                </div>
              </div>
            )}

            <div className="form-field-group">
              <label className="form-label">EFFECTOR TYPE</label>
              <select className="select-control"
                value={selectedPart.clonerConfig.effector}
                onChange={(e) =>
                  handlePartPropChange('clonerConfig', {
                    ...selectedPart.clonerConfig,
                    effector: e.target.value as any,
                  })
                }
                style={{
                  width: '100%',
                  height: 28,
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 4,
                  color: '#fff',
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '0 6px',
                }}
              >
                <option value="none">None (Static Grid)</option>
                <option value="wave">Sinusoidal Wave Motion</option>
                <option value="random">Random Noise Motion</option>
              </select>
            </div>

            {selectedPart.clonerConfig.effector === 'wave' && (
              <div className="input-grid">
                <div className="form-field-group">
                  <label className="form-label">WAVE SPEED</label>
                  <SmartNumberInput
                    value={selectedPart.clonerConfig.waveSpeed}
                    min={0.2}
                    max={5}
                    step={0.2}
                    onChange={(val) =>
                      handlePartPropChange('clonerConfig', {
                        ...selectedPart.clonerConfig,
                        waveSpeed: val,
                      })
                    }
                  />
                </div>
                <div className="form-field-group">
                  <label className="form-label">AMPLITUDE</label>
                  <SmartNumberInput
                    value={selectedPart.clonerConfig.waveAmplitude}
                    min={2}
                    max={50}
                    onChange={(val) =>
                      handlePartPropChange('clonerConfig', {
                        ...selectedPart.clonerConfig,
                        waveAmplitude: val,
                      })
                    }
                  />
                </div>
              </div>
            )}
          </>
        )}

        {/* PARTICLE SYSTEM INSPECTOR CONTROLS */}
        {selectedPart.type === 'particle_system' && selectedPart.particleConfig && (
          <>
            <div className="section-title" style={{ marginTop: 12 }}>
              <Atom size={13} className="text-teal" />
              <span>PARTICLE SYSTEM CONFIG</span>
            </div>

            <div className="input-grid">
              <div className="form-field-group">
                <label className="form-label">PARTICLE COUNT</label>
                <SmartNumberInput
                  value={selectedPart.particleConfig.count}
                  min={5}
                  max={150}
                  onChange={(val) =>
                    handlePartPropChange('particleConfig', {
                      ...selectedPart.particleConfig,
                      count: val,
                    })
                  }
                />
              </div>
              <div className="form-field-group">
                <label className="form-label">SPEED (PX/S)</label>
                <SmartNumberInput
                  value={selectedPart.particleConfig.speed}
                  min={5}
                  max={120}
                  onChange={(val) =>
                    handlePartPropChange('particleConfig', {
                      ...selectedPart.particleConfig,
                      speed: val,
                    })
                  }
                />
              </div>
            </div>

            <div className="form-field-group">
              <label className="form-label">PARTICLE SHAPE</label>
              <select className="select-control"
                value={selectedPart.particleConfig.shape}
                onChange={(e) =>
                  handlePartPropChange('particleConfig', {
                    ...selectedPart.particleConfig,
                    shape: e.target.value as any,
                  })
                }
                style={{
                  width: '100%',
                  height: 28,
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 4,
                  color: '#fff',
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '0 6px',
                }}
              >
                <option value="dot">Solid Dot</option>
                <option value="cross">Cross (+)</option>
                <option value="triangle">Triangle (▲)</option>
                <option value="circle_outline">Circle Ring (○)</option>
              </select>
            </div>
          </>
        )}

        {/* Image URL Input Control if object is Custom Image */}
        {selectedPart.type === 'custom_image' && (
          <div className="form-field-group">
            <label className="form-label">IMAGE SOURCE (URL / DATA URL)</label>
            <div style={{ display: 'flex', gap: 6, flex: 1, width: '100%' }}>
              <input className="input-control"
                type="text"
                value={selectedPart.imageUrl || ''}
                placeholder="Paste image URL..."
                onFocus={(e) => e.target.select()}
                onChange={(e) => handlePartPropChange('imageUrl', e.target.value)}
                style={{ flex: 1 }}
              />
              <button
                className="btn-secondary"
                onClick={() => imageFileInputRef.current?.click()}
                style={{ fontSize: 11, whiteSpace: 'nowrap' }}
              >
                Upload File
              </button>
              <input
                type="file"
                ref={imageFileInputRef}
                accept="image/*"
                onChange={handleImageFileSelect}
                style={{ display: 'none' }}
              />
            </div>
          </div>
        )}

        {/* Video URL Input Control if object is Custom Video */}
        {selectedPart.type === 'custom_video' && (
          <div className="form-field-group">
            <label className="form-label">VIDEO SOURCE (URL / MP4 / WEBM)</label>
            <div style={{ display: 'flex', gap: 6, flex: 1, width: '100%' }}>
              <input className="input-control"
                type="text"
                value={selectedPart.videoUrl || ''}
                placeholder="Paste video URL..."
                onFocus={(e) => e.target.select()}
                onChange={(e) => handlePartPropChange('videoUrl', e.target.value)}
                style={{ flex: 1 }}
              />
              <button
                className="btn-secondary"
                onClick={() => videoFileInputRef.current?.click()}
                style={{ fontSize: 11, whiteSpace: 'nowrap' }}
              >
                Upload File
              </button>
              <input
                type="file"
                ref={videoFileInputRef}
                accept="video/*,.mp4,.webm,.mov"
                onChange={handleVideoFileSelect}
                style={{ display: 'none' }}
              />
            </div>
          </div>
        )}

        {/* SHAPE MASK MEDIA SETTINGS */}
        {(selectedPart.type === 'custom_circle' ||
          selectedPart.type === 'custom_box' ||
          selectedPart.type === 'custom_rect' ||
          selectedPart.type === 'custom_triangle') && (
          <>
            <div className="section-title" style={{ marginTop: 12 }}>
              <Crop size={13} className="text-teal" />
              <span>SHAPE MEDIA MASKING (CANVA STYLE)</span>
            </div>

            <div className="form-field-group">
              <label className="form-label">MASKED MEDIA TYPE</label>
              <select className="select-control"
                value={selectedPart.innerMediaType || 'image'}
                onChange={(e) => handlePartPropChange('innerMediaType', e.target.value)}
                style={{
                  width: '100%',
                  height: 28,
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 4,
                  color: '#fff',
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '0 6px',
                }}
              >
                <option value="image">Image</option>
                <option value="video">Video</option>
              </select>
            </div>

            <div className="form-field-group">
              <label className="form-label">MEDIA SOURCE (URL)</label>
              <div style={{ display: 'flex', gap: 6, flex: 1, width: '100%' }}>
                <input className="input-control"
                type="text"
                  value={selectedPart.innerMediaUrl || ''}
                  placeholder="Paste media URL..."
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => handlePartPropChange('innerMediaUrl', e.target.value)}
                  style={{ flex: 1 }}
                />
              </div>
            </div>
            
            <p style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 15 }}>
              Media will be masked to perfectly fit inside this shape.
            </p>
          </>
        )}

        {/* DROP SHADOW / GLOW CONTROLS */}
        <div className="section-title" style={{ marginTop: 12 }}>
          <Sun size={13} className="text-gold" />
          <span>DROP SHADOW & GLOW EFFECTS</span>
        </div>

        <div className="form-field-group">
          <label className="form-label">SHADOW / GLOW COLOR</label>
          <div className="color-picker-compact">
            <input
              type="color"
              className="color-swatch-input"
              value={selectedPart.shadowColor || '#000000'}
              onChange={(e) => handlePartPropChange('shadowColor', e.target.value)}
            />
            <SmartHexInput
              value={selectedPart.shadowColor || ''}
              fallback="#000000"
              placeholder="NONE"
              onChange={(val) => handlePartPropChange('shadowColor', val)}
            />
            <button
              type="button"
              className="btn-secondary"
              style={{ padding: '2px 8px', fontSize: 10, height: 32, whiteSpace: 'nowrap' }}
              onClick={() => handlePartPropChange('shadowColor', undefined)}
            >
              Clear Shadow
            </button>
          </div>
        </div>

        {selectedPart.shadowColor && (
          <div className="input-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <div className="form-field-group">
              <label className="form-label">BLUR RADIUS (PX)</label>
              <SmartNumberInput
                value={selectedPart.shadowBlur ?? 8}
                min={0}
                max={50}
                onChange={(val) => handlePartPropChange('shadowBlur', val)}
              />
            </div>
            <div className="form-field-group">
              <label className="form-label">OFFSET X (PX)</label>
              <SmartNumberInput
                value={selectedPart.shadowOffsetX ?? 0}
                min={-50}
                max={50}
                onChange={(val) => handlePartPropChange('shadowOffsetX', val)}
              />
            </div>
            <div className="form-field-group">
              <label className="form-label">OFFSET Y (PX)</label>
              <SmartNumberInput
                value={selectedPart.shadowOffsetY ?? 4}
                min={-50}
                max={50}
                onChange={(val) => handlePartPropChange('shadowOffsetY', val)}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
