import { describe, expect, it } from 'vitest';
import { buildProfileScene, DEFAULT_PROFILE_SCENES, type ProfileSceneParameters } from '../../perf/sceneBuilder';

/**
 * The evaluator profile is only comparable across runs if a parameter set always
 * produces the same scene, so the builder's determinism and its parameter-to-shape
 * contract are pinned here. Timings are deliberately not asserted: the harness
 * treats performance numbers as evidence, not as a pass/fail contract.
 */
const parameters: ProfileSceneParameters = { layers: 6, channelsPerLayer: 3, keyframesPerChannel: 5, maskedLayers: 2, parentedLayers: 2 };

describe('evaluator profile scene builder', () => {
  it('produces the requested number of layers and tracks', () => {
    const scene = buildProfileScene(parameters);

    expect(scene.layers).toHaveLength(parameters.layers);
    expect(scene.tracks).toHaveLength(parameters.layers);
    expect(scene.layers.map((layer) => layer.id)).toEqual(scene.tracks.map((track) => track.partId));
  });

  it('fills exactly the requested channels with the requested keyframe count', () => {
    const scene = buildProfileScene(parameters);

    for (const track of scene.tracks) {
      const populated = Object.entries(track.channels).filter(([, keyframes]) => keyframes.length > 0);

      expect(populated).toHaveLength(parameters.channelsPerLayer);
      for (const [, keyframes] of populated) expect(keyframes).toHaveLength(parameters.keyframesPerChannel);
    }
  });

  it('is deterministic across builds', () => {
    const first = buildProfileScene(parameters);
    const second = buildProfileScene(parameters);

    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });

  it('gives masked layers mask channels and parented layers a parent', () => {
    const scene = buildProfileScene(parameters);
    const masked = scene.tracks.filter((track) => track.maskChannels !== undefined);
    const parented = scene.layers.filter((layer) => layer.parentId !== undefined);

    expect(masked).toHaveLength(parameters.maskedLayers);
    expect(parented).toHaveLength(parameters.parentedLayers);
    expect(scene.layers[0].parentId).toBeUndefined();
  });

  it('keeps every default scene within its own declared shape', () => {
    for (const [name, defaults] of Object.entries(DEFAULT_PROFILE_SCENES)) {
      const scene = buildProfileScene(defaults);

      expect(scene.layers, name).toHaveLength(defaults.layers);
      expect(scene.totalFrames, name).toBeGreaterThan(1);
    }
  });
});
