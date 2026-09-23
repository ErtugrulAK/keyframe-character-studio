import { performance } from 'node:perf_hooks';
import { test, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import process from 'node:process';
import { evaluateFrame } from '../src/utils/evaluateFrame';
import { evaluateTransform } from '../src/utils/evaluateTransform';
import { applyEasing, interpolateChannel } from '../src/utils/defaults';
import { buildProfileScene, DEFAULT_PROFILE_SCENES, type ProfileScene } from './sceneBuilder';

/**
 * Evaluator profile harness (Milestone F, item 11).
 *
 * Run on demand — it is deliberately NOT part of the default suite (the root
 * config only includes  files), so CI stays fast:
 *
 *   npx vitest run --config perf/vitest.perf.config.ts
 *
 * Set `KCS_PROFILE_OUT` to also write the report to a file (Vitest rejects an
 * unknown `--out`, so the path travels in the environment):
 *
 *   KCS_PROFILE_OUT=perf/profile-baseline.md npx vitest run --config perf/vitest.perf.config.ts
 *
 * It measures the pure evaluation utilities and the full frame pipeline on
 * deterministic scenes and prints a report pinned to the revision, the Node
 * version and the scene parameters. The numbers are evidence for a later
 * caching decision, never a gate: no threshold is asserted here, and nothing
 * in `src/` is modified by running it.
 */

interface Measurement {
  scene: string;
  target: string;
  iterations: number;
  p50Ms: number;
  p95Ms: number;
  minMs: number;
  maxMs: number;
}

const percentile = (sorted: number[], fraction: number): number => {
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * fraction) - 1));
  return sorted[index];
};

const measure = (label: { scene: string; target: string }, iterations: number, operation: () => void): Measurement => {
  // Warm-up: let the JIT settle before anything is recorded.
  for (let index = 0; index < Math.min(20, iterations); index += 1) operation();
  const samples: number[] = [];
  for (let index = 0; index < iterations; index += 1) {
    const started = performance.now();
    operation();
    samples.push(performance.now() - started);
  }
  samples.sort((left, right) => left - right);
  return {
    ...label,
    iterations,
    p50Ms: Number(percentile(samples, 0.5).toFixed(4)),
    p95Ms: Number(percentile(samples, 0.95).toFixed(4)),
    minMs: Number(samples[0].toFixed(4)),
    maxMs: Number(samples[samples.length - 1].toFixed(4)),
  };
};

const revision = (): string => {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
};

const profileScene = (name: string, scene: ProfileScene, iterations: number): Measurement[] => {
  const firstLayerId = scene.layers[0]?.id;
  const firstChannel = scene.tracks[0]?.channels.x ?? [];
  const frames = [0, Math.floor(scene.totalFrames / 4), Math.floor(scene.totalFrames / 2), scene.totalFrames - 1];

  const measurements: Measurement[] = [];
  measurements.push(measure({ scene: name, target: 'evaluateFrame @ frame 60' }, iterations, () => {
    evaluateFrame(scene.layers, scene.tracks, scene.totalFrames, 60, scene.runtime, []);
  }));
  measurements.push(measure({ scene: name, target: 'evaluateFrame @ 4 frames' }, iterations, () => {
    for (const frame of frames) evaluateFrame(scene.layers, scene.tracks, scene.totalFrames, frame, scene.runtime, []);
  }));
  if (firstLayerId) {
    measurements.push(measure({ scene: name, target: 'evaluateTransform (first layer)' }, iterations, () => {
      evaluateTransform(scene.layers, scene.tracks, 'Sequence', firstLayerId, 60);
    }));
  }
  if (firstChannel.length > 1) {
    measurements.push(measure({ scene: name, target: 'interpolateChannel (first channel)' }, iterations, () => {
      interpolateChannel(firstChannel, 60);
    }));
  }
  measurements.push(measure({ scene: name, target: 'applyEasing (1k calls)' }, iterations, () => {
    for (let index = 0; index < 1000; index += 1) applyEasing(0.37, 'easeInOut');
  }));
  return measurements;
};

interface SceneVerification {
  layers: number;
  tracks: number;
  parentedLayers: number;
  maskedLayers: number;
  maskScalarKeyframes: number;
  maskPathKeyframes: number;
  animatedKeyframes: number;
  evaluatedLayers: number;
  visibleLayers: number;
}

/**
 * Proves the scene is the workload the parameters describe **before** anything is
 * timed. The previous builder wrote two fields the evaluator never reads
 * (`transform` instead of `baseTransform`, `layers` instead of `masks`), so the
 * harness measured default transforms, non-finite opacity and no masks at all —
 * and reported numbers as if it had measured the workload. A profile of a scene
 * that is not what it claims is worse than no profile, so the counts and the
 * finiteness of the evaluated output are asserted here, per scene.
 */
const verifyScene = (name: string, scene: ProfileScene): SceneVerification => {
  const { parameters } = scene;
  const finite = (value: number) => Number.isFinite(value);
  const maskedLayers = scene.layers.filter((layer) => (layer.masks?.length ?? 0) > 0).length;
  const parentedLayers = scene.layers.filter((layer) => layer.parentId !== undefined).length;

  const evaluated = evaluateFrame(scene.layers, scene.tracks, scene.totalFrames, 60, scene.runtime, []);
  const transformFinite = scene.layers.every((layer) => {
    const base = layer.baseTransform;
    return finite(base.x) && finite(base.y) && finite(base.rotation) && finite(base.scaleX) && finite(base.scaleY) && finite(base.opacity);
  });
  const outputFinite = evaluated.layers.every((layer) =>
    finite(layer.transform.x) && finite(layer.transform.y) && finite(layer.transform.rotation)
    && finite(layer.transform.scaleX) && finite(layer.transform.scaleY) && finite(layer.opacity));
  const masksEvaluated = evaluated.layers.every((layer) => (layer.content.masks ?? []).every((mask) =>
    finite(mask.opacity) && finite(mask.feather) && finite(mask.expansion) && mask.path.points.length >= 2));

  expect(scene.layers.length, `${name}: built layers`).toBe(parameters.layers);
  expect(scene.tracks.length, `${name}: built tracks`).toBe(parameters.layers);
  expect(maskedLayers, `${name}: layers carrying a mask`).toBe(parameters.maskedLayers);
  expect(parentedLayers, `${name}: layers with a parent`).toBe(parameters.parentedLayers);
  expect(transformFinite, `${name}: every layer has a finite base transform`).toBe(true);
  expect(evaluated.layers.length, `${name}: evaluated layers`).toBe(parameters.layers);
  expect(outputFinite, `${name}: every evaluated transform is finite`).toBe(true);
  expect(masksEvaluated, `${name}: every evaluated mask is finite and has a path`).toBe(true);
  expect(evaluated.layers.filter((layer) => layer.visible).length, `${name}: visible layers`).toBe(parameters.layers);

  return {
    layers: scene.layers.length,
    tracks: scene.tracks.length,
    parentedLayers,
    maskedLayers,
    maskScalarKeyframes: scene.tracks.reduce((total, track) => total + Object.values(track.maskChannels ?? {}).reduce((sum, keyframes) => sum + keyframes.length, 0), 0),
    maskPathKeyframes: scene.tracks.reduce((total, track) => total + Object.values(track.maskPathChannels ?? {}).reduce((sum, keyframes) => sum + keyframes.length, 0), 0),
    animatedKeyframes: scene.tracks.reduce((total, track) => total + Object.values(track.channels).reduce((sum, keyframes) => sum + keyframes.length, 0), 0),
    evaluatedLayers: evaluated.layers.length,
    visibleLayers: evaluated.layers.filter((layer) => layer.visible).length,
  };
};

const buildReport = (measurements: Measurement[], sceneParameters: Record<string, unknown>, verifications: Record<string, SceneVerification>): string => {
  const lines: string[] = [];
  lines.push('# Evaluator profile');
  lines.push('');
  lines.push(`- Revision: \`${revision()}\``);
  lines.push(`- Node: \`${process.version}\` on \`${process.platform}/${process.arch}\``);
  lines.push(`- Generated: ${new Date().toISOString()}`);
  lines.push(`- Harness: \`perf/evaluator-profile.perf.ts\` (run on demand; not part of the default suite)`);
  lines.push('');
  lines.push('## Scene parameters');
  lines.push('');
  for (const [name, parameters] of Object.entries(sceneParameters)) {
    lines.push(`- \`${name}\`: ${JSON.stringify(parameters)}`);
  }
  lines.push('');
  lines.push('## Scene verification (asserted before anything is timed)');
  lines.push('');
  lines.push('| Scene | Layers | Tracks | Parented | Masked | Mask scalar keyframes | Mask path keyframes | Animated keyframes | Evaluated | Visible |');
  lines.push('|---|---|---|---|---|---|---|---|---|---|');
  for (const [name, verification] of Object.entries(verifications)) {
    lines.push(
      `| ${name} | ${verification.layers} | ${verification.tracks} | ${verification.parentedLayers} | ${verification.maskedLayers} | ${verification.maskScalarKeyframes} | ${verification.maskPathKeyframes} | ${verification.animatedKeyframes} | ${verification.evaluatedLayers} | ${verification.visibleLayers} |`,
    );
  }
  lines.push('');
  lines.push('## Measurements (milliseconds per operation)');
  lines.push('');
  lines.push('| Scene | Target | Iterations | p50 | p95 | min | max |');
  lines.push('|---|---|---|---|---|---|---|');
  for (const measurement of measurements) {
    lines.push(
      `| ${measurement.scene} | ${measurement.target} | ${measurement.iterations} | ${measurement.p50Ms} | ${measurement.p95Ms} | ${measurement.minMs} | ${measurement.maxMs} |`,
    );
  }
  lines.push('');
  lines.push('## How to read this');
  lines.push('');
  lines.push('- These numbers are evidence, not a gate: they exist so a later caching or optimisation proposal can cite a before/after on the same scenes and revision.');
  lines.push('- Wall-clock includes the JavaScript engine and this machine; compare runs on the same machine, and prefer the p50 to the min.');
  lines.push('- Nothing in `src/` changes when this harness runs, and no threshold is asserted before a first baseline exists.');
  lines.push('');
  return `${lines.join('\n')}\n`;
};

const ITERATIONS = 60;

/**
 * Runs every default scene and returns the report plus its measurements.
 * The harness asserts the report's shape (one row per scene and target), never
 * a timing: a performance number is evidence, not a pass/fail contract.
 */
const runProfile = (): { report: string; measurements: Measurement[]; verifications: Record<string, SceneVerification> } => {
  const measurements: Measurement[] = [];
  const verifications: Record<string, SceneVerification> = {};
  for (const [name, parameters] of Object.entries(DEFAULT_PROFILE_SCENES)) {
    const scene = buildProfileScene(parameters);
    // Verified first, so a scene that is not the workload it claims cannot be
    // timed and reported as one.
    verifications[name] = verifyScene(name, scene);
    measurements.push(...profileScene(name, scene, ITERATIONS));
  }
  return { report: buildReport(measurements, DEFAULT_PROFILE_SCENES, verifications), measurements, verifications };
};

test('evaluator profile harness produces a complete report on deterministic scenes', () => {
  const { report, measurements, verifications } = runProfile();
  // Vitest rejects an unknown `--out`, so the report path travels in the
  // environment: `KCS_PROFILE_OUT=perf/profile-baseline.md npx vitest run --config perf/vitest.perf.config.ts`.
  const outPath = process.env.KCS_PROFILE_OUT;
  if (outPath) writeFileSync(outPath, report, 'utf8');
  console.log(report);

  const sceneNames = Object.keys(DEFAULT_PROFILE_SCENES);
  for (const name of sceneNames) {
    expect(measurements.some((entry) => entry.scene === name && entry.target.startsWith('evaluateFrame')), name).toBe(true);
  }
  expect(measurements.every((entry) => entry.iterations === ITERATIONS && entry.p50Ms >= 0)).toBe(true);
  expect(report).toContain('These numbers are evidence, not a gate');

  // The report must carry the verification of what was measured, not only the
  // numbers: a reader has to be able to see that the workload was real.
  for (const [name, verification] of Object.entries(verifications)) {
    expect(report, `${name}: the report carries its scene verification`).toContain(`| ${name} | ${verification.layers} |`);
    expect(verification.maskedLayers, `${name}: masks are part of the measured scene`).toBe(DEFAULT_PROFILE_SCENES[name].maskedLayers);
  }
});
