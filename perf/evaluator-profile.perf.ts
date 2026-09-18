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

const buildReport = (measurements: Measurement[], sceneParameters: Record<string, unknown>): string => {
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
const runProfile = (): { report: string; measurements: Measurement[] } => {
  const measurements: Measurement[] = [];
  for (const [name, parameters] of Object.entries(DEFAULT_PROFILE_SCENES)) {
    measurements.push(...profileScene(name, buildProfileScene(parameters), ITERATIONS));
  }
  return { report: buildReport(measurements, DEFAULT_PROFILE_SCENES), measurements };
};

test('evaluator profile harness produces a complete report on deterministic scenes', () => {
  const { report, measurements } = runProfile();
  const outIndex = process.argv.indexOf('--out');
  if (outIndex !== -1 && process.argv[outIndex + 1]) writeFileSync(process.argv[outIndex + 1], report, 'utf8');
  console.log(report);

  const sceneNames = Object.keys(DEFAULT_PROFILE_SCENES);
  for (const name of sceneNames) {
    expect(measurements.some((entry) => entry.scene === name && entry.target.startsWith('evaluateFrame')), name).toBe(true);
  }
  expect(measurements.every((entry) => entry.iterations === ITERATIONS && entry.p50Ms >= 0)).toBe(true);
  expect(report).toContain('These numbers are evidence, not a gate');
});
