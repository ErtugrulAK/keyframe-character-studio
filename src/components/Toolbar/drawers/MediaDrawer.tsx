import React, { useRef, useState } from 'react';
import { useAnimator } from '../../../context/useAnimator';
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
          const img = new Image();
          img.onload = () => {
            let w = 140;
            let h = 140;
            if (img.naturalWidth && img.naturalHeight) {
              const maxDim = 150;
              if (img.naturalWidth >= img.naturalHeight) {
                w = maxDim;
                h = Math.round(maxDim * (img.naturalHeight / img.naturalWidth));
              } else {
                h = maxDim;
                w = Math.round(maxDim * (img.naturalWidth / img.naturalHeight));
              }
            }
            addCustomPart('custom_image', cleanName, { imageUrl: dataUrl, width: w, height: h });
          };
          img.src = dataUrl;
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
        <span className="dropzone-icon" aria-hidden="true">
          <Upload size={20} />
        </span>
        <span className="dropzone-title">Select media (Images & Videos)</span>
        <span className="dropzone-sub">Click to browse or drag MP4, WebM, PNG, JPG files here</span>
        <button
          type="button"
          className="dropzone-browse"
          onClick={(event) => {
            // The card itself opens the picker; stop the bubble so a click on
            // this control never opens the dialog twice.
            event.stopPropagation();
            fileInputRef.current?.click();
          }}
        >
          Browse files
        </button>
      </div>

      {recentMedia.length > 0 && (
        <>
          <div className="drawer-subtitle">RECENTLY ADDED MEDIA</div>
          <div className="media-preview-grid">
            {recentMedia.map((url, i) => {
              const isVideo = url.startsWith('data:video') || url.match(/\.(mp4|webm|mov|ogg)$/i);
              return (
                <button
                  key={url}
                  type="button"
                  className="media-preview-item"
                  title="Click to add to canvas"
                  aria-label={`Add media ${i + 1} to canvas`}
                  onClick={() => {
                    const type = isVideo ? 'custom_video' : 'custom_image';
                    addCustomPart(type, `Media ${i + 1}`, isVideo ? { videoUrl: url } : { imageUrl: url });
                  }}
                >
                  {isVideo ? (
                    <video src={url} muted />
                  ) : (
                    <img src={url} alt="" />
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};
