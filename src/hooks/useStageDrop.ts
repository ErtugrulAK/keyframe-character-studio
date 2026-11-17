import { useState } from 'react';
import type { AnimatorContextType } from '../context/AnimatorContext';
import { parseElementDropPayload } from '../utils/editor/elementDropPayload';
import { getPartBounds } from '../utils/geometry/bounds';
import { EDITOR_CAMERA_CENTER } from '../utils/geometry/projectCoordinates';

type StageDropInput = Pick<AnimatorContextType, 'appMode' | 'characterParts' | 'currentFrame' | 'getComputedTransform' | 'showToast' | 'updatePartMedia' | 'addCustomPart'> & {
  clientToSVG: (clientX: number, clientY: number) => { svgX: number; svgY: number };
};

/**
 * Dropping onto the stage: a media file fills the shape under the pointer or
 * becomes a new media layer, and an element dragged from a panel becomes a new
 * layer where it lands. Moved out of `StageCanvas` unchanged.
 */
export const useStageDrop = ({ appMode, clientToSVG, characterParts, currentFrame, getComputedTransform, showToast, updatePartMedia, addCustomPart }: StageDropInput) => {
  const [isDropTargetHover, setIsDropTargetHover] = useState<boolean>(false);
  const handleDragOverStage = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    if (!isDropTargetHover) setIsDropTargetHover(true);
  };

  const handleDragLeaveStage = () => {
    setIsDropTargetHover(false);
  };

  const handleDropStage = (e: React.DragEvent) => {
    e.preventDefault();
    if (appMode === 'broadcast') return;
    setIsDropTargetHover(false);

    const { svgX, svgY } = clientToSVG(e.clientX, e.clientY);

    // Handle Files (Canva-style Masking or New Media)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      const isVideo = file.type.startsWith('video/');
      const isImage = file.type.startsWith('image/');

      if (isVideo || isImage) {
        // Which shape the drop landed on has to be decided now: the transfer's
        // file list is emptied as soon as the handler returns.
        const dropX = Math.round(svgX - EDITOR_CAMERA_CENTER.x);
        const dropY = Math.round(svgY - EDITOR_CAMERA_CENTER.y);
        let targetShapeId = null;
        for (let i = characterParts.length - 1; i >= 0; i--) {
          const part = characterParts[i];
          const transform = getComputedTransform(part.id, currentFrame);

          const dx = svgX - (EDITOR_CAMERA_CENTER.x + transform.x);
          const dy = svgY - (EDITOR_CAMERA_CENTER.y + transform.y);
          const rad = -transform.rotation * Math.PI / 180;
          const localX = dx * Math.cos(rad) - dy * Math.sin(rad);
          const localY = dx * Math.sin(rad) + dy * Math.cos(rad);
          const unscaledX = localX / Math.abs(transform.scaleX || 1);
          const unscaledY = localY / Math.abs(transform.scaleY || 1);

          const { halfW, halfH } = getPartBounds(part, transform);

          if (Math.abs(unscaledX) <= halfW && Math.abs(unscaledY) <= halfH) {
            // Only mask if it's a shape type
            if (part.type === 'custom_rect' || part.type === 'custom_card' || part.type === 'custom_banner') {
              targetShapeId = part.id;
              break;
            }
          }
        }

        // A `blob:` URL belongs to this document only: persisting one left the
        // saved project pointing at an address that dies with the page, so the
        // media came back as a broken image after a reload. The Media drawer
        // already stores self-contained data URLs, so a drop uses that same
        // durable form and keeps the file's bytes in the document.
        const reader = new FileReader();
        reader.onload = () => {
          const url = reader.result;
          if (typeof url !== 'string') {
            showToast(`"${file.name}" could not be read.`, 'error');
            return;
          }
          if (targetShapeId) {
            updatePartMedia(targetShapeId, url, isVideo ? 'video' : 'image');
          } else {
            // Drop in empty area -> create new media part
            addCustomPart(isVideo ? 'custom_video' : 'custom_image', file.name, {
              baseTransform: { x: dropX, y: dropY, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
              ...(isVideo ? { videoUrl: url } : { imageUrl: url }),
            });
          }
        };
        reader.onerror = () => showToast(`"${file.name}" could not be read.`, 'error');
        reader.readAsDataURL(file);
        return;
      }
    }

    // Handle UI Panel JSON drops. The payload rides an attacker-creatable MIME
    // type, so elementDropPayload.ts is the single authority that narrows it;
    // anything it refuses changes nothing in the document.
    const rawData = e.dataTransfer.getData('application/json');
    if (!rawData) return;
    const dropPayload = parseElementDropPayload(rawData);
    if (!dropPayload) {
      console.warn("Invalid drop payload");
      return;
    }
    addCustomPart(dropPayload.type, dropPayload.name, {
      baseTransform: {
        x: Math.round(svgX - EDITOR_CAMERA_CENTER.x),
        y: Math.round(svgY - EDITOR_CAMERA_CENTER.y),
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        opacity: 1,
      },
    });
  };

  return { isDropTargetHover, handleDragOverStage, handleDragLeaveStage, handleDropStage };
};
