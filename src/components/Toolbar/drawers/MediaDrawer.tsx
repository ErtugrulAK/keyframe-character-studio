import React, { useRef, useState } from 'react';
import { useAnimator } from '../../../context/AnimatorContext';
import { Upload } from 'lucide-react';

export const MediaDrawer: React.FC = () => {
  const { characterParts, addCustomPart } = useAnimator();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);

  const processFiles = (files: FileList | File[]) => {
    Array.from(files).forEach((file) => {
      const cleanName = file.name.replace(/\.[^/.]+$/, '');
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const dataUrl = e.target?.result as string;
          addCustomPart('custom_image', cleanName, { imageUrl: dataUrl });
        };
        reader.readAsDataURL(file);
      } else if (file.type.startsWith('video/') || /\.(mp4|webm|mov|ogg)$/i.test(file.name)) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const dataUrl = e.target?.result as string;
          addCustomPart('custom_video', cleanName, { videoUrl: dataUrl });
        };
        reader.readAsDataURL(file);
      }
    });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const recentMedia = Array.from(
    new Set(
      characterParts
        .filter((p) => p.type === 'custom_image' || p.type === 'custom_video')
        .map((p) => p.imageUrl || p.videoUrl)
        .filter((url): url is string => Boolean(url))
    )
  );

  return (
    <div className="drawer-content">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        accept="image/*,video/*,.mp4,.webm,.mov"
        multiple
        style={{ display: 'none' }}
      />

      <div
        className={`dropzone-box ${isDragOver ? 'drag-over' : ''}`}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
      >
        <Upload size={28} className="text-teal mb-2" />
        <span className="dropzone-title">Select media (Images & Videos)</span>
        <span className="dropzone-sub">Click to browse or drag MP4, WebM, PNG, JPG files here</span>
      </div>

      {recentMedia.length > 0 && (
        <>
          <div className="drawer-subtitle" style={{ marginTop: 20 }}>
            RECENTLY ADDED MEDIA
          </div>
          <div className="media-preview-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginTop: 8 }}>
            {recentMedia.map((url, i) => {
              const isVideo = url.startsWith('data:video') || url.match(/\.(mp4|webm|mov|ogg)$/i);
              return (
                <div
                  key={i}
                  className="media-preview-item"
                  title="Click to add to canvas"
                  style={{
                    height: 60,
                    background: 'var(--bg-input)',
                    borderRadius: 6,
                    overflow: 'hidden',
                    cursor: 'pointer',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s',
                  }}
                  onClick={() => {
                    const type = isVideo ? 'custom_video' : 'custom_image';
                    addCustomPart(type, `Media ${i + 1}`, isVideo ? { videoUrl: url } : { imageUrl: url });
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--accent-teal)')}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-color)')}
                >
                  {isVideo ? (
                    <video src={url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted />
                  ) : (
                    <img src={url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="recent" />
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};
