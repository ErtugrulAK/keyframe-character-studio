import type { CharacterPart, Track, Transform, TrackChannel } from '../types/animator';
import { affineOfTransform, composeAffine, composeWorldTransform, withWorldAffine, worldAffineOf, worldToContainerLocal } from '../utils/geometry/containerMath';
import { resolveBoundPartners } from '../utils/layers/partBinding';
import { generateId } from '../utils/layers/idGenerator';
import { resolveAuthoredBasePose } from '../utils/animation/channelKeyframeGroups';
import { migrateLegacyKeyframesToCanonical, migrateTrackLegacyKeyframes } from '../utils/animation/trackMutations';

interface UseInspectorOptions {
  selectedPartId: string | null;
  selectedPartIds: string[];
  activeTemplateId: string;
  currentFrame: number;
  tracks: Track[];
  characterParts?: CharacterPart[];
  setTracks: React.Dispatch<React.SetStateAction<Track[]>>;
  setCharacterParts: React.Dispatch<React.SetStateAction<CharacterPart[]>>;
  getComputedTransform: (partId: string, frame: number) => Transform;
}

// Transform fields → canonical channel names (6 animated properties)
const TRANSFORM_TO_CHANNEL: [keyof Transform, TrackChannel][] = [
  ['x', 'x'],
  ['y', 'y'],
  ['rotation', 'rotation'],
  ['scaleX', 'scaleX'],
  ['scaleY', 'scaleY'],
  ['opacity', 'opacity'],
];

export const useInspector = ({
  selectedPartId,
  selectedPartIds,
  activeTemplateId,
  currentFrame,
  tracks,
  characterParts,
  setTracks,
  setCharacterParts,
  getComputedTransform,
}: UseInspectorOptions) => {
  const applyTransformToPart = (id: string, newTransform: Partial<Transform>, activeTmpl: string) => {
    const track = tracks.find((t) => t.partId === id);
    if (!track) return;

    // ONE canonical authored truth. A track whose animation still
    // lives in the legacy composite list is migrated into the canonical channels
    // first, so the edit lands on the channel the timeline and the evaluator
    // read, and no other channel's keys can disappear or hide. The authored base
    // pose is the proof the conversion needs before it may leave a composite
    // property that only re-states the layer's own pose out of the channels.
    const basePose = resolveAuthoredBasePose(characterParts, id);
    if (track.keyframes && track.keyframes.length > 0) {
      setTracks((prev) => migrateTrackLegacyKeyframes(prev, track.id, basePose));
    }

    // Channel-aware path — the ONLY transform write path. Inspector edits write
    // to a channel that already carries keys for the active sequence (updating
    // or inserting a keyframe at the playhead) and to the base transform for a
    // channel that carries none, so a layer with no animation stays static.
    applyTransformToChannels(id, migrateLegacyKeyframesToCanonical(track, basePose), newTransform, activeTmpl);
  };

  /**
   * Write Inspector transform edits into canonical channels.
   * - Channel has keyframes for this template → update value at current frame
   *   (or add a new keyframe there if the frame is empty), keeping easing/bezier.
   * - Channel is completely empty for this template → fall back to baseTransform
   *   (same defensive behavior as legacy no-keyframe path).
   */
  const applyTransformToChannels = (
    id: string,
    track: Track,
    newTransform: Partial<Transform>,
    activeTmpl: string,
  ) => {
    const channelUpdates: { channel: TrackChannel; value: number }[] = [];
    const baseUpdates: Record<string, number> = {};

    for (const [prop, channel] of TRANSFORM_TO_CHANNEL) {
      const newVal = newTransform[prop];
      if (typeof newVal !== 'number') continue; // skip undefined + non-numeric (e.g. mask)
      const tmplKfs = (track.channels?.[channel] || []).filter((k) => (k.templateId || 'Sequence') === activeTmpl);
      if (tmplKfs.length === 0) {
        baseUpdates[prop] = newVal;
      } else {
        channelUpdates.push({ channel, value: newVal });
      }
    }

    if (channelUpdates.length > 0) {
      setTracks((prev) =>
        prev.map((tr) => {
          if (tr.id !== track.id) return tr;
          const channels = { ...tr.channels };
          for (const u of channelUpdates) {
            const list = [...(channels[u.channel] || [])];
            const frameKf = list.find((k) => k.frame === currentFrame && (k.templateId || 'Sequence') === activeTmpl);
            if (frameKf) {
              // update value only — easing/bezier/templateId preserved
              channels[u.channel] = list.map((k) => (k.id === frameKf.id ? { ...k, value: u.value } : k));
            } else {
              // add a new keyframe at current frame, reusing the template's easing
              const templateEasing = list.find((k) => (k.templateId || 'Sequence') === activeTmpl)?.easing || 'easeInOut';
              channels[u.channel] = [
                ...list,
                {
                  id: generateId(`pkf_${u.channel}`),
                  frame: currentFrame,
                  value: u.value,
                  easing: templateEasing,
                  templateId: activeTmpl,
                },
              ].sort((a, b) => a.frame - b.frame);
            }
          }
          return { ...tr, channels };
        })
      );
    }

    if (Object.keys(baseUpdates).length > 0) {
      setCharacterParts((prev) =>
        prev.map((p) =>
          p.id === id ? { ...p, baseTransform: { ...p.baseTransform, ...baseUpdates } } : p
        )
      );
    }
  };

  /**
   * Bonded layers follow the same world-space position delta.
   *
   * ONE contract: every patch that reaches this helper is world-space, so the
   * delta is measured against the source's current world position. `writtenIds`
   * accumulates every part this gesture already wrote — the dragged layer(s)
   * and every partner already moved — so a part moves exactly once even when
   * two selected sources share a partner. `postWorld` carries the world
   * transform a part will have AFTER this gesture, so a partner parented to a
   * layer that is moving in the same gesture is converted against the parent's
   * new world and does not receive the delta twice.
   */
  const applyBondedPositionDelta = (
    sourcePartId: string,
    requested: Partial<Transform>,
    writtenIds: string[],
    activeTmpl: string,
    toLocalPatch: (id: string, patch: Partial<Transform>) => Partial<Transform>,
  ) => {
    if (requested.x === undefined && requested.y === undefined) return;
    const partners = resolveBoundPartners(characterParts ?? [], sourcePartId)
      .filter((partner) => !writtenIds.includes(partner.id));
    if (partners.length === 0) return;

    const sourceWorld = getComputedTransform(sourcePartId, currentFrame);
    const deltaX = requested.x === undefined ? 0 : requested.x - sourceWorld.x;
    const deltaY = requested.y === undefined ? 0 : requested.y - sourceWorld.y;
    if (deltaX === 0 && deltaY === 0) return;

    for (const partner of partners) {
      const partnerWorld = getComputedTransform(partner.id, currentFrame);
      const worldPatch: Partial<Transform> = {};
      if (requested.x !== undefined) worldPatch.x = partnerWorld.x + deltaX;
      if (requested.y !== undefined) worldPatch.y = partnerWorld.y + deltaY;
      const localPatch = toLocalPatch(partner.id, worldPatch);

      // Write only the axes that actually move. A world-space X edit on an
      // unrotated parent leaves local Y untouched, so the partner's Y
      // animation must not gain a keyframe; a rotated parent genuinely changes
      // local Y, so both axes are written there.
      if (localPatch.x === undefined && localPatch.y === undefined) {
        writtenIds.push(partner.id);
        continue;
      }
      applyTransformToPart(partner.id, localPatch, activeTmpl);
      writtenIds.push(partner.id);
    }
  };

  const updateCurrentTransform = (newTransform: Partial<Transform>, partIdOverride?: string) => {
    const targetPartId = partIdOverride || selectedPartId;
    if (!targetPartId) return;

    const activeTmpl = activeTemplateId || 'Sequence';
    // ONE coordinate contract: x/y (and rotation/scale/opacity) arrive in WORLD
    // space, and this helper converts every written part into its own
    // container-local space. `partIdOverride` only picks the target part; it
    // never changes the coordinate space.
    const postWorld: Record<string, Transform> = {};
    const writtenIds: string[] = [];

    const toLocalPatch = (id: string, worldPatch: Partial<Transform>): Partial<Transform> => {
      const part = characterParts?.find((p) => p.id === id);
      const parentId = part?.parentId ?? part?.booleanGroupId;
      const currentWorld = getComputedTransform(id, currentFrame);
      if (!parentId) {
        postWorld[id] = { ...currentWorld, ...worldPatch };
        return worldPatch;
      }
      const originalContainer = getComputedTransform(parentId, currentFrame);
      const containerT = postWorld[parentId] ?? originalContainer;
      const currentLocal = worldToContainerLocal(currentWorld, originalContainer);
      const local = worldToContainerLocal({ ...currentWorld, ...worldPatch }, containerT);
      const localPatch: Partial<Transform> = {};
      if (worldPatch.x !== undefined || worldPatch.y !== undefined) {
        // A world-axis edit can move both authored axes inside a rotated parent.
        if (local.x !== currentLocal.x) localPatch.x = local.x;
        if (local.y !== currentLocal.y) localPatch.y = local.y;
      }
      (['rotation', 'scaleX', 'scaleY', 'opacity'] as const).forEach((key) => {
        if (worldPatch[key] !== undefined) localPatch[key] = local[key];
      });
      const nextLocal = { ...currentLocal, ...localPatch };
      // Cache the POST-write map, not a spread carrying the pre-write affine.
      postWorld[id] = withWorldAffine(
        composeWorldTransform(containerT, nextLocal),
        composeAffine(worldAffineOf(containerT), affineOfTransform(nextLocal)),
      );
      return localPatch;
    };

    // Multi-selection: one world delta applied to every selected part, then
    // every selected source propagates its own bond exactly once.
    if (!partIdOverride && selectedPartIds.length > 1) {
      const primaryWorld = getComputedTransform(targetPartId, currentFrame);
      const deltaX = newTransform.x !== undefined ? newTransform.x - primaryWorld.x : 0;
      const deltaY = newTransform.y !== undefined ? newTransform.y - primaryWorld.y : 0;
      const deltaRot = newTransform.rotation !== undefined ? newTransform.rotation - primaryWorld.rotation : 0;
      const deltaScaleX = newTransform.scaleX !== undefined ? newTransform.scaleX - primaryWorld.scaleX : 0;
      const deltaScaleY = newTransform.scaleY !== undefined ? newTransform.scaleY - primaryWorld.scaleY : 0;
      const deltaOpacity = newTransform.opacity !== undefined ? newTransform.opacity - primaryWorld.opacity : 0;

      const worldPatches: Record<string, Partial<Transform>> = {};
      selectedPartIds.forEach((id) => {
        const t = getComputedTransform(id, currentFrame);
        const worldPatch: Partial<Transform> = {};
        if (newTransform.x !== undefined) worldPatch.x = t.x + deltaX;
        if (newTransform.y !== undefined) worldPatch.y = t.y + deltaY;
        if (newTransform.rotation !== undefined) worldPatch.rotation = t.rotation + deltaRot;
        if (newTransform.scaleX !== undefined) worldPatch.scaleX = t.scaleX + deltaScaleX;
        if (newTransform.scaleY !== undefined) worldPatch.scaleY = t.scaleY + deltaScaleY;
        if (newTransform.opacity !== undefined) worldPatch.opacity = t.opacity + deltaOpacity;
        worldPatches[id] = worldPatch;
        applyTransformToPart(id, toLocalPatch(id, worldPatch), activeTmpl);
        writtenIds.push(id);
      });
      selectedPartIds.forEach((id) => {
        applyBondedPositionDelta(id, worldPatches[id], writtenIds, activeTmpl, toLocalPatch);
      });
      return;
    }

    applyTransformToPart(targetPartId, toLocalPatch(targetPartId, newTransform), activeTmpl);
    writtenIds.push(targetPartId);
    applyBondedPositionDelta(targetPartId, newTransform, writtenIds, activeTmpl, toLocalPatch);
  };

  const updateCurrentPropertyChannel = (channel: TrackChannel, value: number, partIdOverride?: string) => {
    const targetPartId = partIdOverride || selectedPartId;
    if (!targetPartId) return;
    const track = tracks.find((candidate) => candidate.partId === targetPartId);
    if (!track) return;
    const activeTmpl = activeTemplateId || 'Sequence';
    const channelKeyframes = (track.channels?.[channel] || []).filter((kf) => (kf.templateId || 'Sequence') === activeTmpl);

    if (channelKeyframes.length > 0) {
      setTracks((prev) => prev.map((candidate) => {
        if (candidate.id !== track.id) return candidate;
        const channels = { ...candidate.channels };
        const list = [...(channels[channel] || [])];
        const atFrame = list.find((kf) => kf.frame === currentFrame && (kf.templateId || 'Sequence') === activeTmpl);
        if (atFrame) {
          channels[channel] = list.map((kf) => kf.id === atFrame.id ? { ...kf, value } : kf);
        } else {
          const templateEasing = channelKeyframes[0]?.easing || 'easeInOut';
          channels[channel] = [...list, {
            id: generateId(`pkf_${channel}`), frame: currentFrame, value,
            easing: templateEasing, templateId: activeTmpl,
          }].sort((a, b) => a.frame - b.frame);
        }
        return { ...candidate, channels };
      }));
      return;
    }

    const partField = channel === 'trimPathStart'
      ? 'trimPathStart'
      : channel === 'trimPathEnd'
        ? 'trimPathEnd'
        : channel === 'trimPathOffset'
          ? 'trimPathOffset'
          : null;
    if (partField) {
      setCharacterParts((prev) => prev.map((part) => part.id === targetPartId ? { ...part, [partField]: value } : part));
    }
  };

  const updatePartMedia = (partId: string, url: string, type: 'image' | 'video') => {
    setCharacterParts((prev) =>
      prev.map((p) => (p.id === partId ? { ...p, innerMediaUrl: url, innerMediaType: type } : p))
    );
  };

  return {
    updateCurrentTransform,
    updateCurrentPropertyChannel,
    updatePartMedia,
  };
};
