import { useState, useRef } from 'react';
import type { Track, CharacterPart } from '../types/animator';
import { DEFAULT_TRACKS, DEFAULT_CHARACTER_PARTS } from '../utils/defaults';

export const useProjectState = () => {
  const [tracks, setTracks] = useState<Track[]>(DEFAULT_TRACKS);
  const [characterParts, setCharacterParts] = useState<CharacterPart[]>(DEFAULT_CHARACTER_PARTS);

  const tracksRef = useRef(tracks);
  // Intentional latest-value mirrors are consumed by stable domain callbacks.
  // oxlint-disable-next-line react/refs
  tracksRef.current = tracks;

  const characterPartsRef = useRef(characterParts);
  // oxlint-disable-next-line react/refs
  characterPartsRef.current = characterParts;

  return {
    tracks,
    setTracks,
    tracksRef,
    characterParts,
    setCharacterParts,
    characterPartsRef,
  };
};
