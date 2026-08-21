/** Pure project/output coordinate authority. */
export interface ProjectResolution {
  width: number;
  height: number;
}

export interface CoordinatePoint {
  x: number;
  y: number;
}

/** The edit SVG remains a camera, not the project-space origin. */
export const EDITOR_CAMERA_VIEWBOX = { width: 600, height: 480 } as const;
export const EDITOR_CAMERA_CENTER: CoordinatePoint = {
  x: EDITOR_CAMERA_VIEWBOX.width / 2,
  y: EDITOR_CAMERA_VIEWBOX.height / 2,
};

export const getProjectCenter = ({ width, height }: ProjectResolution): CoordinatePoint => ({
  x: width / 2,
  y: height / 2,
});

export const relativeToProjectOutput = (
  relative: CoordinatePoint,
  resolution: ProjectResolution,
): CoordinatePoint => {
  const center = getProjectCenter(resolution);
  return { x: center.x + relative.x, y: center.y + relative.y };
};

export const projectOutputToRelative = (
  output: CoordinatePoint,
  resolution: ProjectResolution,
): CoordinatePoint => {
  const center = getProjectCenter(resolution);
  return { x: output.x - center.x, y: output.y - center.y };
};

export const relativeToEditorCamera = (relative: CoordinatePoint): CoordinatePoint => ({
  x: EDITOR_CAMERA_CENTER.x + relative.x,
  y: EDITOR_CAMERA_CENTER.y + relative.y,
});

export const editorCameraToRelative = (cameraPoint: CoordinatePoint): CoordinatePoint => ({
  x: cameraPoint.x - EDITOR_CAMERA_CENTER.x,
  y: cameraPoint.y - EDITOR_CAMERA_CENTER.y,
});
