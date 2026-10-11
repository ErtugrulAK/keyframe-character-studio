import { useAnimator } from '../context/useAnimator';
import { layerMaskChannel } from '../types/animator';
import type { CharacterPart } from '../types/animator';
import { isShapeAppearanceEligible, updateShapeAppearance, type ShapeAppearancePatch } from '../utils/shapeAppearance';
import { isTrimPathEligible } from '../utils/trimPath';
import { updateTrimPath, type TrimPathAuthoringPatch } from '../utils/trimPathAuthoring';

/**
 * The one authored-property write path for the selected part.
 *
 * This is the authority the Inspector's property/colour fields have always
 * used: shape appearance and Trim Path edits are routed through their own
 * update helpers, mask scalar edits are folded back onto the base mask while a
 * keyframe at the current frame owns the displayed value, and everything else
 * is a plain part patch. It was lifted out of `DetailsPanel` unchanged so the
 * authoring toolbar can reach the SAME write path instead of a second one.
 */
export interface PartPropertyAuthoring {
  handlePartPropChange: (key: keyof CharacterPart, value: unknown) => void;
  handleDisplayedPartPropChange: (key: keyof CharacterPart, value: unknown) => void;
  handlePartColorChange: (key: 'fillColor' | 'strokeColor', color: string) => void;
  handleZIndexChange: (zIndex: number) => void;
}

export const usePartPropertyAuthoring = (): PartPropertyAuthoring => {
  const {
    selectedPartId,
    characterParts,
    setCharacterParts,
    tracks,
    currentFrame,
    activeTemplateId,
    updatePropertyKeyframeValue,
  } = useAnimator();

  const selectedTrack = selectedPartId ? tracks.find((track) => track.partId === selectedPartId) : undefined;

  const handlePartPropChange = (key: keyof CharacterPart, value: unknown) => {
    if (!selectedPartId) return;
    setCharacterParts((prev) =>
      prev.map((p) => {
        if (p.id !== selectedPartId) return p;
        if (isShapeAppearanceEligible(p.type) && [
          'fillEnabled', 'fillColor', 'fillOpacity', 'strokeEnabled', 'strokeColor', 'strokeWidth', 'strokeOpacity', 'strokeAlignment',
        ].includes(key)) {
          return updateShapeAppearance(p, { [key]: value } as ShapeAppearancePatch);
        }
        if (isTrimPathEligible(p.type) && [
          'trimPathEnabled', 'trimPathStart', 'trimPathEnd', 'trimPathOffset',
        ].includes(key)) {
          return updateTrimPath(p, { [key]: value } as TrimPathAuthoringPatch);
        }
        return { ...p, [key]: value };
      })
    );
  };

  const handleDisplayedPartPropChange = (key: keyof CharacterPart, value: unknown) => {
    if (key === 'masks' && Array.isArray(value)) {
      const baseMasks = characterParts.find((part) => part.id === selectedPartId)?.masks ?? [];
      const maskScalarProperties = ['feather', 'opacity', 'expansion'] as const;
      const baseValue = value.map((mask) => {
        const baseMask = baseMasks.find((candidate) => candidate.id === mask.id);
        if (!baseMask || !selectedTrack) return mask;
        const nextMask = { ...mask };
        for (const property of maskScalarProperties) {
          const channel = layerMaskChannel(mask.id, property);
          const keyframe = selectedTrack.maskChannels?.[channel]?.find(
            (candidate) => candidate.frame === currentFrame && (candidate.templateId || 'Sequence') === (activeTemplateId || 'Sequence'),
          );
          if (keyframe && mask[property] !== keyframe.value) {
            updatePropertyKeyframeValue(selectedTrack.id, channel, keyframe.id, Number(mask[property]));
            nextMask[property] = baseMask[property];
          }
        }
        return nextMask;
      });
      const mergedMasks = baseValue.map((mask) => {
        const baseMask = baseMasks.find((candidate) => candidate.id === mask.id);
        return baseMask ? { ...mask, path: baseMask.path } : mask;
      });
      handlePartPropChange(key, mergedMasks);
      return;
    }
    handlePartPropChange(key, value);
  };

  const handlePartColorChange = (key: 'fillColor' | 'strokeColor', color: string) => {
    handlePartPropChange(key, color);
  };

  const handleZIndexChange = (zIndex: number) => {
    handlePartPropChange('zIndex', zIndex);
  };

  return { handlePartPropChange, handleDisplayedPartPropChange, handlePartColorChange, handleZIndexChange };
};
