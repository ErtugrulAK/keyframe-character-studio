import { describe, expect, it } from 'vitest';
import { CANVAS_PRESETS, FRAME_RATES, START_RECIPES, buildStartRecipe, type StartRecipeId } from '../utils/editor/startRecipes';
import { validateImportedDocument } from '../utils/persistence/importValidation';
import { safeAreaRect, TITLE_SAFE } from '../utils/geometry/safeAreas';

const ids: StartRecipeId[] = ['blank', ...START_RECIPES.map((recipe) => recipe.id)];

describe('start recipes', () => {
  it('every recipe passes the import boundary at every canvas size and frame rate', () => {
    for (const id of ids) {
      for (const canvas of CANVAS_PRESETS) {
        for (const fps of FRAME_RATES) {
          const doc = buildStartRecipe(id, { width: canvas.width, height: canvas.height, fps });
          const result = validateImportedDocument(JSON.stringify(doc));
          expect(result.ok, `${id} ${canvas.label} ${fps} fps: ${result.ok ? '' : JSON.stringify(result.diagnostics[0])}`).toBe(true);
        }
      }
    }
  });

  it('carries the chosen canvas, frame rate and a five-second timeline', () => {
    const doc = buildStartRecipe('lower-third', { width: 1280, height: 720, fps: 50 });
    expect([doc.width, doc.height, doc.fps, doc.totalFrames]).toEqual([1280, 720, 50, 250]);
    expect(doc.motionTemplates).toEqual([{ id: 'Sequence', name: 'Sequence', type: 'in', durationFrames: 250 }]);
    expect(doc.layers.length).toBe(4);
    expect(doc.tracks.map((track) => track.partId)).toEqual(doc.layers.map((layer) => layer.id));
  });

  it('places every layer origin inside the title-safe area', () => {
    for (const id of ids) {
      for (const canvas of CANVAS_PRESETS) {
        const doc = buildStartRecipe(id, { width: canvas.width, height: canvas.height, fps: 25 });
        const safe = safeAreaRect(-canvas.width / 2, -canvas.height / 2, canvas.width, canvas.height, TITLE_SAFE);
        for (const layer of doc.layers) {
          const x = Number(layer.x);
          const y = Number(layer.y);
          if (layer.follow) continue; // positioned by its target
          expect(x, `${id} ${layer.id} x`).toBeGreaterThanOrEqual(safe.x - 1);
          expect(x, `${id} ${layer.id} x`).toBeLessThanOrEqual(safe.x + safe.width + 1);
          expect(y, `${id} ${layer.id} y`).toBeGreaterThanOrEqual(safe.y - 1);
          expect(y, `${id} ${layer.id} y`).toBeLessThanOrEqual(safe.y + safe.height + 1);
        }
      }
    }
  });

  it('gives every layer an entrance that ends on its resting value', () => {
    const doc = buildStartRecipe('title-card', { width: 1920, height: 1080, fps: 30 });
    for (const track of doc.tracks) {
      const layer = doc.layers.find((candidate) => candidate.id === track.partId)!;
      const channels = Object.entries(track.channels);
      expect(channels.length, track.partId).toBeGreaterThan(0);
      for (const [channel, keys] of channels) {
        const last = keys[keys.length - 1].value;
        expect(last, `${track.partId}.${channel}`).toBeCloseTo(Number(layer[channel] ?? 1), 6);
      }
    }
  });
});
