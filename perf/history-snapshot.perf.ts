/**
 * On-demand cost of recording one undo step: copying the scene and comparing
 * it with the last snapshot as JSON, against sharing references and comparing
 * structurally. Run with:
 *
 *   npx vitest run --config perf/vitest.perf.config.ts perf/history-snapshot.perf.ts
 *
 * The scene is the `large` profile scene, optionally with one embedded image
 * the size of a typical photo, because media sits in the scene as a data URL.
 */
import { buildProfileScene, DEFAULT_PROFILE_SCENES } from './sceneBuilder';
import { structurallyEqual } from '../src/utils/persistence/historySnapshot';
import type { CharacterPart } from '../src/types/animator';

const median = (samples: number[]) => [...samples].sort((a, b) => a - b)[Math.floor(samples.length / 2)];

const time = (run: () => void, rounds = 15) => {
  run();
  const samples: number[] = [];
  for (let round = 0; round < rounds; round += 1) {
    const start = performance.now();
    run();
    samples.push(performance.now() - start);
  }
  return median(samples);
};

describe('undo snapshot cost', () => {
  for (const imageBytes of [0, 2_000_000]) {
    it(`large scene${imageBytes ? ' with a 2 MB image' : ''}`, () => {
      const scene = buildProfileScene(DEFAULT_PROFILE_SCENES.large);
      const parts: CharacterPart[] = imageBytes
        ? [{ ...scene.layers[0], imageSrc: `data:image/png;base64,${'A'.repeat(imageBytes)}` } as CharacterPart, ...scene.layers.slice(1)]
        : scene.layers;
      // One edit: the second layer moved; every other layer is the same object.
      const edited = parts.map((part, index) => (index === 1 ? { ...part, x: part.x + 1 } : part));
      const before = { tracks: scene.tracks, characterParts: parts };
      const after = { tracks: scene.tracks, characterParts: edited };

      const copied = time(() => {
        // What one recorded edit did: copy the new state, then compare it
        // with the previous snapshot (already a copy) as JSON.
        const next = structuredClone(after);
        if (JSON.stringify(before) === JSON.stringify(next)) throw new Error('expected a change');
      });
      const shared = time(() => {
        if (structurallyEqual(before, after)) throw new Error('expected a change');
      });
      console.log(`${imageBytes ? '2 MB image' : 'no media'}: copy+JSON ${copied.toFixed(2)} ms, shared ${shared.toFixed(3)} ms`);
      expect(shared).toBeLessThan(copied);
    });
  }
});
