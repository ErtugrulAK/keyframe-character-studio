import React from 'react';
import { ACTION_SAFE, TITLE_SAFE, safeAreaRect } from '../../../utils/geometry/safeAreas';

interface SafeAreaOverlayProps {
  artX: number;
  artY: number;
  width: number;
  height: number;
}

/**
 * The action-safe and title-safe frames over the artboard (editor only). The
 * lines stay one screen pixel thin at any zoom and never take a pointer.
 */
export const SafeAreaOverlay: React.FC<SafeAreaOverlayProps> = ({ artX, artY, width, height }) => {
  const action = safeAreaRect(artX, artY, width, height, ACTION_SAFE);
  const title = safeAreaRect(artX, artY, width, height, TITLE_SAFE);
  return (
    <g data-testid="stage-safe-areas" pointerEvents="none" shapeRendering="crispEdges">
      <rect data-testid="safe-area-action" {...action} fill="none" stroke="rgba(255, 196, 64, 0.55)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
      <rect data-testid="safe-area-title" {...title} fill="none" stroke="rgba(255, 196, 64, 0.55)" strokeWidth={1} strokeDasharray="6 4" vectorEffect="non-scaling-stroke" />
    </g>
  );
};
