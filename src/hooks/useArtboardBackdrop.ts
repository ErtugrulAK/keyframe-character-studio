import { useEffect, useState } from 'react';

export type ArtboardBackdropKind = 'dark' | 'light' | 'checker' | 'image';

export const ARTBOARD_BACKDROPS: ReadonlyArray<{ kind: ArtboardBackdropKind; label: string }> = [
  { kind: 'dark', label: 'Dark' },
  { kind: 'light', label: 'Light' },
  { kind: 'checker', label: 'Checker' },
  { kind: 'image', label: 'Image…' },
];

const STORAGE_KEY = 'kcs-artboard-backdrop';

const readStoredKind = (): ArtboardBackdropKind => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'light' || stored === 'checker' ? stored : 'dark';
  } catch {
    return 'dark';
  }
};

/**
 * What the empty artboard shows behind the layers while editing: dark (the
 * default), light, a checkerboard, or a picture (to judge a graphic over real
 * footage). An editor preference only: never part of the scene or an export.
 * The choice is remembered in this browser; a picture lasts for the session.
 */
export const useArtboardBackdrop = () => {
  const [kind, setKind] = useState<ArtboardBackdropKind>(readStoredKind);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (kind === 'image') return;
    try {
      localStorage.setItem(STORAGE_KEY, kind);
    } catch {
      // Storage may be blocked (a private window): the choice lasts for the session.
    }
  }, [kind]);

  // A picked picture is an object URL: released when it is replaced or the stage unmounts.
  useEffect(() => () => {
    if (imageUrl) URL.revokeObjectURL(imageUrl);
  }, [imageUrl]);

  const choose = (next: ArtboardBackdropKind) => {
    if (next !== 'image') setKind(next);
  };
  const chooseImage = (file: File) => {
    setImageUrl(URL.createObjectURL(file));
    setKind('image');
  };

  const shown: ArtboardBackdropKind = kind === 'image' && !imageUrl ? 'dark' : kind;
  return { kind: shown, imageUrl, choose, chooseImage };
};
