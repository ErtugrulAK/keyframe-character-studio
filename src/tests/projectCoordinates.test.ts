import { describe, expect, it } from 'vitest';
import {
  EDITOR_CAMERA_CENTER,
  EDITOR_CAMERA_VIEWBOX,
  editorCameraToRelative,
  getProjectCenter,
  projectOutputToRelative,
  relativeToEditorCamera,
  relativeToProjectOutput,
} from '../utils/projectCoordinates';

describe('project coordinate authority', () => {
  it.each([
    [{ width: 1920, height: 1080 }, { x: 960, y: 540 }],
    [{ width: 1280, height: 720 }, { x: 640, y: 360 }],
    [{ width: 3840, height: 2160 }, { x: 1920, y: 1080 }],
    [{ width: 1080, height: 1920 }, { x: 540, y: 960 }],
    [{ width: 1000, height: 1000 }, { x: 500, y: 500 }],
  ] as const)('derives the project center for %j', (resolution, center) => {
    expect(getProjectCenter(resolution)).toEqual(center);
  });

  it('maps canonical relative values into project output coordinates', () => {
    expect(relativeToProjectOutput({ x: 300, y: -100 }, { width: 1920, height: 1080 }))
      .toEqual({ x: 1260, y: 440 });
  });

  it('round-trips project output and canonical relative coordinates', () => {
    const resolution = { width: 1080, height: 1920 };
    const relative = { x: 300, y: -100 };
    expect(projectOutputToRelative(relativeToProjectOutput(relative, resolution), resolution)).toEqual(relative);
  });

  it('keeps the edit SVG as an explicit 600×480 camera', () => {
    expect(EDITOR_CAMERA_VIEWBOX).toEqual({ width: 600, height: 480 });
    expect(EDITOR_CAMERA_CENTER).toEqual({ x: 300, y: 240 });
    const relative = { x: 300, y: -100 };
    expect(editorCameraToRelative(relativeToEditorCamera(relative))).toEqual(relative);
  });
});
