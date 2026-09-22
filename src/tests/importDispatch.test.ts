import { describe, expect, it } from 'vitest';
import { classifyImport } from '../utils/importDispatch';

/**
 * Milestone F item 12 — the unified import entry's dispatcher.
 *
 * The file name is a hint, never the decision: the content says what the file is,
 * so a document renamed `.kcs` still imports as what it holds. The KCS scene and
 * legacy shapes are recognised by the existing import boundary, not by a second
 * set of rules here.
 */

const kcsScene = JSON.stringify({ version: 1, width: 320, height: 180, fps: 24, totalFrames: 24, layers: [], tracks: [] });
const legacyProject = JSON.stringify({ tracks: [], characterParts: [], sceneTitle: 'Legacy' });
const lottie = JSON.stringify({ v: '5.7.4', fr: 24, ip: 0, op: 24, w: 320, h: 180, layers: [] });
const ografManifest = JSON.stringify({ $schema: 'https://keyframe.studio/schema/ograf/v1.json', layers: [] });

describe('import dispatch', () => {
  it('classifies each supported document by its content', () => {
    expect(classifyImport('project.kcs', kcsScene)).toBe('kcs-scene');
    expect(classifyImport('old-project.json', legacyProject)).toBe('legacy-project');
    expect(classifyImport('scene.lottie.json', lottie)).toBe('lottie');
    expect(classifyImport('graphic.ograf.json', ografManifest)).toBe('ograf-manifest');
    expect(classifyImport('package.zip', 'PK')).toBe('ograf-package');
    expect(classifyImport('package.ograf', 'PK')).toBe('ograf-package');
  });

  it('trusts the content over the extension', () => {
    expect(classifyImport('renamed.kcs', lottie)).toBe('lottie');
    expect(classifyImport('renamed.lottie.json', kcsScene)).toBe('kcs-scene');
    expect(classifyImport('scene.json', ografManifest)).toBe('ograf-manifest');
  });

  it('reports an unclassifiable document instead of guessing', () => {
    expect(classifyImport('broken.json', '{ not json')).toBe('unknown');
    expect(classifyImport('empty.json', '')).toBe('unknown');
    expect(classifyImport('other.json', JSON.stringify({ hello: 'world' }))).toBe('unknown');
    // A Lottie-shaped object without the timing fields the importer requires is not a Lottie document.
    expect(classifyImport('half.json', JSON.stringify({ v: '5.7.4', layers: [] }))).toBe('unknown');
    // A prototype-sensitive key is left to the boundary, which refuses it.
    expect(classifyImport('unsafe.json', '{"version":1,"layers":[],"tracks":[],"__proto__":{"x":1}}')).toBe('unknown');
  });
});
