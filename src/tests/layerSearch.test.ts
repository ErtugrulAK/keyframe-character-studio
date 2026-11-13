import { describe, expect, it } from 'vitest';
import type { CharacterPart } from '../types/animator';
import { searchLayers } from '../utils/layers/layerSearch';

const part = (id: string, name: string) => ({ id, name }) as unknown as CharacterPart;

describe('searchLayers', () => {
  const parts = [part('p1', 'Başlık Çubuğu'), part('p2', 'Logo'), part('p3', 'LOGO shadow'), part('p4', '')];

  it('returns null for an empty or blank query', () => {
    expect(searchLayers(parts, '')).toBeNull();
    expect(searchLayers(parts, '   ')).toBeNull();
  });

  it('matches case-insensitively, in layer order', () => {
    expect(searchLayers(parts, 'logo')?.matchIds).toEqual(['p2', 'p3']);
  });

  it('ignores accents in both the name and the query', () => {
    expect(searchLayers(parts, 'baslik')?.matchIds).toEqual(['p1']);
    expect(searchLayers(parts, 'ÇUBUĞU')?.matchIds).toEqual(['p1']);
  });

  it('falls back to the id for a layer without a name', () => {
    expect(searchLayers(parts, 'p4')?.matchIds).toEqual(['p4']);
  });

  it('shows the matches themselves when they have no ancestors', () => {
    expect([...(searchLayers(parts, 'logo')?.shownIds ?? [])]).toEqual(['p2', 'p3']);
  });
});
