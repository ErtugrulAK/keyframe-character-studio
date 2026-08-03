import { useState, useCallback } from 'react';
import type { CharacterPart, Track, TrackChannel } from '../types/animator';
import { generateId } from '../utils/idGenerator';
import { makeEmptyChannels } from '../utils/defaults';

interface UseClipboardOptions {
  characterParts: CharacterPart[];
  tracks: Track[];
  selectedPartId: string | null;
  showToast: (message: string, type?: 'info' | 'success' | 'error') => void;
  setTracks: React.Dispatch<React.SetStateAction<Track[]>>;
  setCharacterParts: React.Dispatch<React.SetStateAction<CharacterPart[]>>;
  setSelectedPartId: (id: string | null) => void;
}

export const useClipboard = ({
  characterParts,
  tracks,
  selectedPartId,
  showToast,
  setTracks,
  setCharacterParts,
  setSelectedPartId,
}: UseClipboardOptions) => {
  const [clipboardData, setClipboardData] = useState<{ part: CharacterPart; track?: Track } | null>(null);

  const copySelectedPart = useCallback(() => {
    if (!selectedPartId) return;
    const part = characterParts.find((p) => p.id === selectedPartId);
    if (!part) return;
    const track = tracks.find((t) => t.partId === selectedPartId);
    setClipboardData({
      part: structuredClone(part),
      track: track ? structuredClone(track) : undefined,
    });
    showToast(`Copied "${part.name}" to clipboard`, 'info');
  }, [selectedPartId, characterParts, tracks, showToast]);

  const pasteCopiedPart = useCallback(() => {
    if (!clipboardData) {
      showToast('Clipboard is empty', 'error');
      return;
    }
    const newPartId = generateId('part');
    const newPart: CharacterPart = {
      ...structuredClone(clipboardData.part),
      id: newPartId,
      name: `${clipboardData.part.name} Copy`,
      zIndex: characterParts.length + 1,
      baseTransform: {
        ...clipboardData.part.baseTransform,
        x: clipboardData.part.baseTransform.x + 20,
        y: clipboardData.part.baseTransform.y + 20,
      },
    };

    let newTrack: Track = {
      id: generateId('track'),
      partId: newPartId,
      name: newPart.name,
      color: '#3b82f6',
      keyframes: [],
      channels: makeEmptyChannels(),
      visible: true,
      locked: false,
      expanded: false,
    };

    if (clipboardData.track) {
      const clonedTrack: Track = structuredClone(clipboardData.track);
      const newChannels = makeEmptyChannels();
      if (clonedTrack.channels) {
        (Object.keys(clonedTrack.channels) as TrackChannel[]).forEach((ch) => {
          if (clonedTrack.channels[ch]) {
            newChannels[ch] = clonedTrack.channels[ch].map((pk) => ({ ...pk, id: generateId(`pkf_${ch}`) }));
          }
        });
      }
      newTrack = {
        ...clonedTrack,
        id: generateId('track'),
        partId: newPartId,
        keyframes: (clonedTrack.keyframes || []).map((k) => ({
          ...k,
          id: generateId('kf'),
        })),
        channels: newChannels,
      };
    }

    setTracks((prevTracks) => [newTrack, ...prevTracks]);
    setCharacterParts((prevParts) => [newPart, ...prevParts]);
    setSelectedPartId(newPartId);
    showToast(`Pasted "${newPart.name}"`, 'success');
  }, [clipboardData, characterParts, setTracks, setCharacterParts, setSelectedPartId, showToast]);

  const duplicateSelectedPart = useCallback(() => {
    if (!selectedPartId) return;
    const part = characterParts.find((p) => p.id === selectedPartId);
    if (!part) return;
    const track = tracks.find((t) => t.partId === selectedPartId);

    const newPartId = generateId('part');
    const newPart: CharacterPart = {
      ...structuredClone(part),
      id: newPartId,
      name: `${part.name} Copy`,
      zIndex: characterParts.length + 1,
      baseTransform: {
        ...part.baseTransform,
        x: part.baseTransform.x + 20,
        y: part.baseTransform.y + 20,
      },
    };

    let newTrack: Track = {
      id: generateId('track'),
      partId: newPartId,
      name: newPart.name,
      color: track?.color || '#3b82f6',
      keyframes: [],
      channels: makeEmptyChannels(),
      visible: true,
      locked: false,
      expanded: false,
    };

    if (track) {
      const clonedTrack: Track = structuredClone(track);
      const newChannels = makeEmptyChannels();
      if (clonedTrack.channels) {
        (Object.keys(clonedTrack.channels) as TrackChannel[]).forEach((ch) => {
          if (clonedTrack.channels[ch]) {
            newChannels[ch] = clonedTrack.channels[ch].map((pk) => ({ ...pk, id: generateId(`pkf_${ch}`) }));
          }
        });
      }
      newTrack = {
        ...clonedTrack,
        id: generateId('track'),
        partId: newPartId,
        keyframes: (clonedTrack.keyframes || []).map((k) => ({
          ...k,
          id: generateId('kf'),
        })),
        channels: newChannels,
      };
    }

    setTracks((prevTracks) => [newTrack, ...prevTracks]);
    setCharacterParts((prevParts) => [newPart, ...prevParts]);
    setSelectedPartId(newPartId);
    showToast(`Duplicated "${newPart.name}"`, 'success');
  }, [selectedPartId, characterParts, tracks, setTracks, setCharacterParts, setSelectedPartId, showToast]);

  return { clipboardData, copySelectedPart, pasteCopiedPart, duplicateSelectedPart };
};
