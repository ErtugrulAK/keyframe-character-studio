import type { CharacterPart, Track, Transform } from '../types/animator';

interface UseInspectorOptions {
  selectedPartId: string | null;
  selectedPartIds: string[];
  activeTemplateId: string;
  currentFrame: number;
  tracks: Track[];
  setTracks: React.Dispatch<React.SetStateAction<Track[]>>;
  setCharacterParts: React.Dispatch<React.SetStateAction<CharacterPart[]>>;
  getComputedTransform: (partId: string, frame: number) => Transform;
  addKeyframeToTrack: (trackId: string, frame: number) => void;
}

export const useInspector = ({
  selectedPartId,
  selectedPartIds,
  activeTemplateId,
  currentFrame,
  tracks,
  setTracks,
  setCharacterParts,
  getComputedTransform,
  addKeyframeToTrack,
}: UseInspectorOptions) => {
  const applyTransformToPart = (id: string, newTransform: Partial<Transform>, activeTmpl: string) => {
    const track = tracks.find((t) => t.partId === id);
    if (!track) return;
    const activeKfs = (track.keyframes || []).filter((k) => (k.templateId || 'Sequence') === activeTmpl);
    const hasActiveKfOnFrame = activeKfs.some((k) => k.frame === currentFrame);

    if (hasActiveKfOnFrame) {
      setTracks((prev) =>
        prev.map((tr) => {
          if (tr.id !== track.id) return tr;
          return {
            ...tr,
            keyframes: tr.keyframes.map((k) =>
              k.frame === currentFrame && (k.templateId || 'Sequence') === activeTmpl
                ? { ...k, transform: { ...k.transform, ...newTransform } }
                : k
            ),
          };
        })
      );
    } else if (activeKfs.length > 0) {
      setCharacterParts((prev) =>
        prev.map((p) =>
          p.id === id ? { ...p, baseTransform: { ...p.baseTransform, ...newTransform } } : p
        )
      );
      addKeyframeToTrack(track.id, currentFrame);
    } else {
      setCharacterParts((prev) =>
        prev.map((p) =>
          p.id === id ? { ...p, baseTransform: { ...p.baseTransform, ...newTransform } } : p
        )
      );
    }
  };

  const updateCurrentTransform = (newTransform: Partial<Transform>, partIdOverride?: string) => {
    const targetPartId = partIdOverride || selectedPartId;
    if (!targetPartId) return;

    const partsToUpdate = (!partIdOverride && selectedPartIds.length > 1)
      ? selectedPartIds
      : [targetPartId];

    const activeTmpl = activeTemplateId || 'Sequence';

    // If updating multiple parts via inspector delta
    if (!partIdOverride && selectedPartIds.length > 1) {
      const primaryPartT = getComputedTransform(targetPartId, currentFrame);
      
      const deltaX = newTransform.x !== undefined ? newTransform.x - primaryPartT.x : 0;
      const deltaY = newTransform.y !== undefined ? newTransform.y - primaryPartT.y : 0;
      const deltaRot = newTransform.rotation !== undefined ? newTransform.rotation - primaryPartT.rotation : 0;
      const deltaScaleX = newTransform.scaleX !== undefined ? newTransform.scaleX - primaryPartT.scaleX : 0;
      const deltaScaleY = newTransform.scaleY !== undefined ? newTransform.scaleY - primaryPartT.scaleY : 0;
      const deltaOpacity = newTransform.opacity !== undefined ? newTransform.opacity - primaryPartT.opacity : 0;

      partsToUpdate.forEach(id => {
        const t = getComputedTransform(id, currentFrame);
        const relativeUpdate: Partial<Transform> = {};
        if (newTransform.x !== undefined) relativeUpdate.x = t.x + deltaX;
        if (newTransform.y !== undefined) relativeUpdate.y = t.y + deltaY;
        if (newTransform.rotation !== undefined) relativeUpdate.rotation = t.rotation + deltaRot;
        if (newTransform.scaleX !== undefined) relativeUpdate.scaleX = t.scaleX + deltaScaleX;
        if (newTransform.scaleY !== undefined) relativeUpdate.scaleY = t.scaleY + deltaScaleY;
        if (newTransform.opacity !== undefined) relativeUpdate.opacity = t.opacity + deltaOpacity;
        
        applyTransformToPart(id, relativeUpdate, activeTmpl);
      });
      return;
    }

    applyTransformToPart(targetPartId, newTransform, activeTmpl);
  };

  const updateCharacterPart = (partId: string, updates: Partial<CharacterPart>) => {
    setCharacterParts((prev) => prev.map((p) => (p.id === partId ? { ...p, ...updates } : p)));
  };

  const updatePartMedia = (partId: string, url: string, type: 'image' | 'video') => {
    setCharacterParts((prev) =>
      prev.map((p) => (p.id === partId ? { ...p, innerMediaUrl: url, innerMediaType: type } : p))
    );
  };

  return {
    updateCurrentTransform,
    updateCharacterPart,
    updatePartMedia,
  };
};
