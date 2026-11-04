import { useCallback } from 'react';
import { useAnimatorSlice } from '../context/useAnimator';
import type { ImageContentBounds } from '../types/animator';
import { contentBoundsInLocalUnits, visibleContentRectOfImage } from '../utils/geometry/imageContentBounds';

/**
 * Adds picked or dropped image and video files as layers: an image is sized to
 * fit 150 px with its visible content measured, a video is added as is. The
 * toolbar's Media button uses it.
 */
export const useMediaImport = () => {
  const { addCustomPart } = useAnimatorSlice('addCustomPart');
  return useCallback((files: FileList | File[]) => {
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
            let imageContentBounds: ImageContentBounds | undefined;
            if (img.naturalWidth && img.naturalHeight) {
              const maxDim = 150;
              if (img.naturalWidth >= img.naturalHeight) {
                w = maxDim;
                h = Math.round(maxDim * (img.naturalHeight / img.naturalWidth));
              } else {
                h = maxDim;
                w = Math.round(maxDim * (img.naturalWidth / img.naturalHeight));
              }
              // The drawn box is the whole bitmap, transparent padding included.
              // Measuring the visible pixels here is what keeps the layer's
              // bounds — control points, gizmo, resize handles — on the art.
              const content = visibleContentRectOfImage(img);
              if (content) {
                imageContentBounds = contentBoundsInLocalUnits(content, img.naturalWidth, img.naturalHeight, w, h);
              }
            }
            addCustomPart('custom_image', cleanName, {
              imageUrl: dataUrl,
              width: w,
              height: h,
              ...(imageContentBounds ? { imageContentBounds } : {}),
            });
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
  }, [addCustomPart]);
};
