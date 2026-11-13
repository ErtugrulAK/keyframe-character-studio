import { useCallback } from 'react';
import { useAnimatorSlice } from '../context/useAnimator';
import type { ImageContentBounds } from '../types/animator';
import { contentBoundsInLocalUnits, visibleContentRectOfImage } from '../utils/geometry/imageContentBounds';
import { fitImageSize, replacedImageSize } from '../utils/geometry/imageLayerSize';

interface LoadedImage {
  dataUrl: string;
  naturalWidth: number;
  naturalHeight: number;
  image: HTMLImageElement;
}

/** Reads an image file into a data URL and a decoded image; rejects when the file cannot be read or decoded. */
const loadImageFile = (file: File): Promise<LoadedImage> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = () => reject(new Error('read'));
  reader.onload = (event) => {
    const dataUrl = event.target?.result as string;
    const image = new Image();
    image.onload = () => resolve({ dataUrl, naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight, image });
    image.onerror = () => reject(new Error('decode'));
    image.src = dataUrl;
  };
  reader.readAsDataURL(file);
});

/**
 * The drawn box is the whole bitmap, transparent padding included. Measuring
 * the visible pixels is what keeps the layer's bounds — control points, gizmo,
 * resize handles — on the art.
 */
const contentBoundsFor = (loaded: LoadedImage, width: number, height: number): ImageContentBounds | undefined => {
  if (!loaded.naturalWidth || !loaded.naturalHeight) return undefined;
  const content = visibleContentRectOfImage(loaded.image);
  return content ? contentBoundsInLocalUnits(content, loaded.naturalWidth, loaded.naturalHeight, width, height) : undefined;
};

/**
 * Adds picked or dropped image and video files as layers: an image is sized to
 * fit 150 px with its visible content measured, a video is added as is. The
 * toolbar's Media button uses it.
 */
export const useMediaImport = () => {
  const { addCustomPart, showToast } = useAnimatorSlice('addCustomPart', 'showToast');
  return useCallback((files: FileList | File[]) => {
    Array.from(files).forEach((file) => {
      const cleanName = file.name.replace(/\.[^/.]+$/, '');
      // The same words the stage's own drop uses, so a file that cannot be
      // added says so whichever way it came in instead of doing nothing.
      const refuse = () => showToast(`"${file.name}" could not be read.`, 'error');
      if (file.type.startsWith('image/')) {
        loadImageFile(file).then((loaded) => {
          const { width, height } = fitImageSize(loaded.naturalWidth, loaded.naturalHeight);
          const imageContentBounds = contentBoundsFor(loaded, width, height);
          addCustomPart('custom_image', cleanName, {
            imageUrl: loaded.dataUrl,
            width,
            height,
            ...(imageContentBounds ? { imageContentBounds } : {}),
          });
        }, refuse);
      } else if (file.type.startsWith('video/') || /\.(mp4|webm|mov|ogg)$/i.test(file.name)) {
        const reader = new FileReader();
        reader.onerror = refuse;
        reader.onload = (e) => {
          const dataUrl = e.target?.result as string;
          addCustomPart('custom_video', cleanName, { videoUrl: dataUrl });
        };
        reader.readAsDataURL(file);
      }
    });
  }, [addCustomPart, showToast]);
};

/**
 * Replaces an image layer's picture and keeps everything else: position,
 * rotation, scale, animation, masks, mattes and effects. The layer keeps its
 * width; its height follows the new picture's proportions, so nothing is
 * cropped. One undo step.
 */
export const useReplaceImage = () => {
  const { setCharacterParts, showToast } = useAnimatorSlice('setCharacterParts', 'showToast');
  return useCallback((partId: string, file: File) => {
    if (!file.type.startsWith('image/')) {
      showToast(`"${file.name}" is not an image.`, 'error');
      return;
    }
    loadImageFile(file).then((loaded) => {
      setCharacterParts((parts) => parts.map((part) => {
        if (part.id !== partId || part.type !== 'custom_image') return part;
        const { width, height } = replacedImageSize(part.width, part.height, loaded.naturalWidth, loaded.naturalHeight);
        const imageContentBounds = contentBoundsFor(loaded, width, height);
        const { imageContentBounds: _previous, ...rest } = part;
        return { ...rest, imageUrl: loaded.dataUrl, width, height, ...(imageContentBounds ? { imageContentBounds } : {}) };
      }));
    }, () => showToast(`"${file.name}" could not be read.`, 'error'));
  }, [setCharacterParts, showToast]);
};
