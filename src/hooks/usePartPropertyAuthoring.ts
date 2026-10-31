import { useAnimator } from '../context/useAnimator';
import { layerMaskChannel } from '../types/animator';
import type { CharacterPart, LayerMask, LayerMaskChannel } from '../types/animator';
import { evaluateLayerMasks } from '../utils/evaluateLayerMasks';
import { authorPropertyValueAtFrameMutator } from '../utils/trackMutations';
import { isShapeAppearanceEligible, updateShapeAppearance, type ShapeAppearancePatch } from '../utils/shapeAppearance';
import { isTrimPathEligible } from '../utils/trimPath';
import { updateTrimPath, type TrimPathAuthoringPatch } from '../utils/trimPathAuthoring';

/**
 * The one authored-property write path for the selected part.
 *
 * This is the authority the Inspector's property/colour fields have always
 * used: shape appearance and Trim Path edits are routed through their own
 * update helpers, mask scalar edits author the active sequence's channel at the
 * playhead once it is animated (the base mask otherwise), and everything else
 * is a plain part patch. It was lifted out of `DetailsPanel` unchanged so the
 * authoring toolbar can reach the SAME write path instead of a second one.
 */
interface PartPropertyAuthoring {
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
    setTracks,
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

  /**
   * The mask fields display the ACTIVE sequence's evaluated masks, so an
   * edit is resolved against that same evaluation. Only a scalar the user
   * CHANGED is written: to its channel at the playhead when the channel is
   * animated in the active sequence (an exact key keeps its metadata, a
   * between-key edit inserts one key), to the base mask otherwise. Every
   * unchanged scalar and the path keep their BASE values — an evaluated value is
   * never copied onto the base mask.
   */
  const handleDisplayedPartPropChange = (key: keyof CharacterPart, value: unknown) => {
    if (key === 'masks' && Array.isArray(value)) {
      const selectedPart = characterParts.find((part) => part.id === selectedPartId);
      const baseMasks = selectedPart?.masks ?? [];
      const scope = activeTemplateId || 'Sequence';
      const displayedMasks = selectedPart ? evaluateLayerMasks(selectedPart, selectedTrack, currentFrame, scope) ?? [] : [];
      const maskScalarProperties = ['feather', 'opacity', 'expansion'] as const;
      const keyedWrites: { channel: LayerMaskChannel; value: number }[] = [];
      const nextMasks = (value as LayerMask[]).map((mask) => {
        const baseMask = baseMasks.find((candidate) => candidate.id === mask.id);
        if (!baseMask) return mask;
        const displayedMask = displayedMasks.find((candidate) => candidate.id === mask.id) ?? baseMask;
        const nextMask: LayerMask = { ...mask, path: baseMask.path };
        for (const property of maskScalarProperties) {
          if (property in baseMask) nextMask[property] = baseMask[property];
          else delete nextMask[property];
          if (mask[property] === displayedMask[property]) continue;
          const channel = layerMaskChannel(mask.id, property);
          const animated = selectedTrack?.maskChannels?.[channel]?.some((keyframe) => (keyframe.templateId || 'Sequence') === scope);
          if (animated) keyedWrites.push({ channel, value: Number(mask[property]) });
          else nextMask[property] = mask[property];
        }
        return nextMask;
      });
      if (selectedTrack && keyedWrites.length > 0) {
        setTracks((prev) => keyedWrites.reduce(
          (tracksSoFar, write) => authorPropertyValueAtFrameMutator(tracksSoFar, selectedTrack.id, write.channel, currentFrame, write.value, scope),
          prev,
        ));
      }
      handlePartPropChange(key, nextMasks);
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
