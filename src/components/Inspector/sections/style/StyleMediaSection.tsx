import React, { useRef } from 'react';
import { Crop, Upload } from 'lucide-react';
import type { CharacterPart, Transform } from '../../../../types/animator';
import { StyleCard } from './StyleCard';
import { ContainerAssignControl } from '../../shared/ContainerAssignControl';

interface StyleMediaSectionProps {
  selectedPart: CharacterPart;
  transform: Transform;
  onPartPropChange: (key: keyof CharacterPart, value: any) => void;
}

/**
 * Media source controls: image/video URL inputs with file upload, plus the
 * shape media masking (Canva-style) section. Owns the file input refs and the
 * FileReader handling for uploaded media.
 */
export const StyleMediaSection: React.FC<StyleMediaSectionProps> = ({ selectedPart, transform, onPartPropChange }) => {
  const imageFileInputRef = useRef<HTMLInputElement>(null);
  const videoFileInputRef = useRef<HTMLInputElement>(null);
  const innerMediaFileInputRef = useRef<HTMLInputElement>(null);

  const applies =
    selectedPart.type === 'custom_image' ||
    selectedPart.type === 'custom_video' ||
    selectedPart.type === 'custom_circle' ||
    selectedPart.type === 'custom_box' ||
    selectedPart.type === 'custom_rect' ||
    selectedPart.type === 'custom_triangle' ||
    selectedPart.type === 'custom_freeform';
  if (!applies) return null;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, propName: 'imageUrl' | 'videoUrl' | 'innerMediaUrl') => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target && ev.target.result) {
          const dataUrl = ev.target.result as string;
          onPartPropChange(propName, dataUrl);

          if (propName === 'imageUrl' && file.type.startsWith('image/')) {
            const img = new Image();
            img.onload = () => {
              if (img.naturalWidth && img.naturalHeight) {
                const maxDim = 150;
                let w = maxDim;
                let h = maxDim;
                if (img.naturalWidth >= img.naturalHeight) {
                  h = Math.round(maxDim * (img.naturalHeight / img.naturalWidth));
                } else {
                  w = Math.round(maxDim * (img.naturalWidth / img.naturalHeight));
                }
                onPartPropChange('width', w);
                onPartPropChange('height', h);
              }
            };
            img.src = dataUrl;
          }
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <StyleCard title="MEDIA & MASKING" icon={<Crop size={13} />} color="#14b8a6">
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
              onChange={(e) => onPartPropChange('imageUrl', e.target.value)}
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
              onChange={(e) => handleFileSelect(e, 'imageUrl')}
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
              onChange={(e) => onPartPropChange('videoUrl', e.target.value)}
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
              onChange={(e) => handleFileSelect(e, 'videoUrl')}
              style={{ display: 'none' }}
            />
          </div>
        </div>
      )}

      {/* SHAPE MASK MEDIA SETTINGS */}
      {(selectedPart.type === 'custom_circle' ||
        selectedPart.type === 'custom_box' ||
        selectedPart.type === 'custom_rect' ||
        selectedPart.type === 'custom_triangle' ||
        selectedPart.type === 'custom_parallelogram' ||
        selectedPart.type === 'custom_freeform') && (
        <>
          <div className="form-field-group">
            <label className="form-label">MEDIA SOURCE (URL / FILE)</label>
            <div style={{ display: 'flex', gap: 6, flex: 1, width: '100%' }}>
              <input className="input-control"
              type="text"
                value={selectedPart.innerMediaUrl || ''}
                placeholder="Paste media URL..."
                onFocus={(e) => e.target.select()}
                onChange={(e) => onPartPropChange('innerMediaUrl', e.target.value)}
                style={{ flex: 1 }}
              />
              <button
                className="btn-secondary"
                onClick={() => innerMediaFileInputRef.current?.click()}
                title="Upload file from computer"
                style={{ fontSize: 11, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4 }}
              >
                <Upload size={12} />
                Upload
              </button>
              <input
                type="file"
                ref={innerMediaFileInputRef}
                accept={(selectedPart.innerMediaType || 'image') === 'video' ? 'video/*' : 'image/*'}
                onChange={(e) => handleFileSelect(e, 'innerMediaUrl')}
                style={{ display: 'none' }}
              />
            </div>
          </div>

          {/* Element inside (container): put another element into this shape,
              just like a photo — clipped to the outline and moving together */}
          <div className="form-field-group" style={{ marginTop: 8 }}>
            <label className="form-label">ELEMENT INSIDE (CONTAINER)</label>
            <ContainerAssignControl selectedPart={selectedPart} transform={transform} onPartPropChange={onPartPropChange} />
          </div>
        </>
      )}
    </StyleCard>
  );
};
