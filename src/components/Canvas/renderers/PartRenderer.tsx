import React from 'react';
import type { CharacterPart } from '../../../types/animator';
import type { EvaluatedLayer } from '../../../types/composition';
import { renderShapePart } from './parts/ShapePartRenderers';
import { renderMediaPart } from './parts/MediaPartRenderer';
import { renderTextOrClonerPart } from './parts/TextAndClonerRenderers';
import { EDITOR_CAMERA_CENTER, type CoordinatePoint } from '../../../utils/geometry/projectCoordinates';
import { affineSvgTransform, worldAffineOf } from '../../../utils/geometry/containerMath';

/** How one layer's colour correction is drawn (defs built by StagePartLayers). */
export interface ColorCorrectionRender {
  filterId: string;
  /** Mask scope: coverage w and its inverse (1 - w), both world-space luminance masks. */
  coverageMaskId?: string;
  inverseMaskId?: string;
  /** Layer scope: the amount mixes the two copies directly. */
  amount: number;
}

interface PartRendererProps {
  part: CharacterPart;
  isGhost?: boolean;
  ghostColor?: string;
  isSelected?: boolean;
  currentFrame: number;
  onSelect: (partId: string, event: React.MouseEvent) => void;
  onStartTranslateDrag: (partId: string, e: React.MouseEvent) => void;
  /**
   * The explicit drill-in: a double-click selects THIS layer instead of
   * its group, which is how a grouped child is edited without ungrouping.
   */
  onDrillIn: (partId: string) => void;
  /** Pre-evaluated layer data from the composition engine */
  evaluatedLayer: EvaluatedLayer;
  /** Dynamic Boolean contours evaluated for the current frame. */
  booleanContours?: CharacterPart['booleanContours'];
  /** Track matte — id of the world-space clipPath clipping this part */
  matteClipPathId?: string;
  /** Track matte — id of the world-space <mask> masking this part
   *  (alpha/luminance/inverted). Never combined with matteClipPathId —
   *  a part's matte mode selects exactly one of clip / mask. */
  matteMaskId?: string;
  /** V6 same-layer mask definitions applied in authored compositor order. */
  layerMaskIds?: string[];
  /** Output origin: edit camera center or project-resolution center. */
  outputOrigin?: CoordinatePoint;
  /** A locked layer takes no canvas pointer: clicks reach the layer beneath. */
  isLocked?: boolean;
  /** The layer's colour correction, when it changes pixels. */
  colorCorrection?: ColorCorrectionRender;
}

interface PartContentProps {
  part: CharacterPart;
  content: EvaluatedLayer['content'];
  booleanContours?: CharacterPart['booleanContours'];
  isSelected: boolean;
  isGhost: boolean;
  ghostColor?: string;
  /** The playhead, for content drawn from it (a staggered text, a cloner); 0 otherwise. */
  frame: number;
}

/** Content drawn from the playhead itself, not only from the layer's evaluated values. */
const contentFollowsFrame = (part: CharacterPart): boolean => (
  part.type === 'mograph_cloner' || (part.type === 'custom_text' && Boolean(part.textAnimMode) && part.textAnimMode !== 'none')
);

/**
 * The layer's own drawing (path, text, media) in its local space. It depends
 * on the layer and its evaluated content, never on the transform, so a frame
 * that only moves, turns, scales or fades the layer re-renders the wrapper
 * around it and leaves this subtree alone: playback of a large scene updates
 * one transform per layer instead of rebuilding every shape.
 */
const PartContentView: React.FC<PartContentProps> = ({ part, content, booleanContours, isSelected, isGhost, ghostColor, frame }) => {
  const fill = (isGhost && ghostColor ? ghostColor : content.fillColor) || '#ffffff';
  const stroke = (isGhost && ghostColor ? ghostColor : isSelected ? '#4a8fe7' : content.strokeColor) || '#101218';

  // Build synthetic part for sub-renderers
  const rp: CharacterPart = {
    ...part,
    fillColor: fill,
    // Keep authored stroke color on the synthetic part. Modern eligible
    // shapes must not receive the legacy selection-color override.
    strokeColor: isGhost && ghostColor ? ghostColor : (content.strokeColor ?? part.strokeColor),
    fillEnabled: content.fillEnabled ?? part.fillEnabled,
    fillOpacity: content.fillOpacity ?? part.fillOpacity,
    strokeEnabled: content.strokeEnabled ?? part.strokeEnabled,
    strokeWidth: content.strokeWidth ?? part.strokeWidth,
    strokeOpacity: content.strokeOpacity ?? part.strokeOpacity,
    strokeAlignment: content.strokeAlignment ?? part.strokeAlignment,
    imageUrl: content.imageUrl ?? part.imageUrl,
    videoUrl: content.videoUrl ?? part.videoUrl,
    textValue: content.textValue ?? part.textValue,
    fontSize: content.fontSize ?? part.fontSize,
    points: content.points ?? part.points,
    path: content.path ?? part.path,
    width: content.width ?? part.width,
    height: content.height ?? part.height,
    shadowColor: content.shadowColor ?? part.shadowColor,
    shadowBlur: content.shadowBlur ?? part.shadowBlur,
    shadowOffsetX: content.shadowOffsetX ?? part.shadowOffsetX,
    shadowOffsetY: content.shadowOffsetY ?? part.shadowOffsetY,
    borderRadius: content.borderRadius ?? part.borderRadius,
    trimPathEnabled: content.trimPathEnabled ?? part.trimPathEnabled,
    trimPathStart: content.trimPathStart ?? part.trimPathStart,
    trimPathEnd: content.trimPathEnd ?? part.trimPathEnd,
    trimPathOffset: content.trimPathOffset ?? part.trimPathOffset,
    clonerConfig: content.clonerConfig ?? part.clonerConfig,
    particleConfig: content.particleConfig ?? part.particleConfig,
    booleanContours: booleanContours ?? part.booleanContours,
  };

  if (rp.type === 'custom_video' || rp.type === 'custom_image') return <>{renderMediaPart({ part: rp, fill, stroke, isSelected })}</>;
  if (rp.type === 'custom_text' || rp.type === 'mograph_cloner') return <>{renderTextOrClonerPart({ part: rp, fill, stroke, isSelected, currentFrame: frame })}</>;
  return <>{renderShapePart({ part: rp, fill, stroke, isSelected, isGhost })}</>;
};

/** Evaluated content is rebuilt every frame: equal when every field is the same value. */
const sameContentFields = (a: EvaluatedLayer['content'], b: EvaluatedLayer['content']): boolean => {
  if (a === b) return true;
  const keys = Object.keys(a) as (keyof EvaluatedLayer['content'])[];
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every((key) => Object.is(a[key], b[key]));
};

const PartContent = React.memo(PartContentView, (prev, next) => (
  prev.part === next.part
  && prev.isSelected === next.isSelected
  && prev.isGhost === next.isGhost
  && prev.ghostColor === next.ghostColor
  && prev.booleanContours === next.booleanContours
  && prev.frame === next.frame
  && sameContentFields(prev.content, next.content)
));

const PartRendererView: React.FC<PartRendererProps> = ({
  part,
  isGhost = false,
  ghostColor,
  isSelected = false,
  currentFrame,
  onSelect,
  onStartTranslateDrag,
  onDrillIn,
  evaluatedLayer,
  booleanContours,
  matteClipPathId,
  matteMaskId,
  layerMaskIds,
  outputOrigin = EDITOR_CAMERA_CENTER,
  isLocked = false,
  colorCorrection,
}) => {
  const el = evaluatedLayer;
  if (!el.visible) return null;

  const finalOpacity = isGhost ? 0.35 : el.opacity;
  const filterId = !isGhost && el.content.shadowColor ? `drop-shadow-${part.id}` : undefined;
  const pathContent = (
    <PartContent
      part={part}
      content={el.content}
      booleanContours={booleanContours}
      isSelected={isSelected}
      isGhost={isGhost}
      ghostColor={ghostColor}
      frame={contentFollowsFrame(part) ? currentFrame : 0}
    />
  );

  /**
   * The canvas pointer contract of one layer.
   *
   * A single click and the drag it may become are resolved by the canvas
   * (`StageCanvas`): they target the layer's GROUP, so clicking a child selects
   * the container. The double-click is the EXPLICIT drill-in of the vector
   * editor: the completed sequence selects this very layer, which is how a
   * grouped child is edited without ungrouping. `StageCanvas` still targets the
   * clicked layer while the selection already lives inside its group, so the
   * drilled-in layer stays draggable.
   */
  const layerPointerHandlers = {
    onClick: (e: React.MouseEvent) => { if (!isGhost && e.button === 0) { e.stopPropagation(); onSelect(part.id, e); } },
    onMouseDown: (e: React.MouseEvent) => { if (!isGhost && e.button === 0) { e.stopPropagation(); onStartTranslateDrag(part.id, e); } },
    onDoubleClick: (e: React.MouseEvent) => { if (!isGhost && e.button === 0) { e.stopPropagation(); onDrillIn(part.id); } },
  };

  const renderTransformed = (copy: boolean) => (
    <g
      // The world map through the DERIVED affine: an anisotropic container
      // nesting that is not a TRS (a rotated child of a stretched group) renders
      // exactly what the group frame shows. Every TRS layer keeps the historical
      // `translate(...) rotate(...) scale(...)` spelling, character for character.
      transform={affineSvgTransform(worldAffineOf(el.transform), el.transform, outputOrigin)}
      style={{ opacity: finalOpacity, cursor: isGhost ? 'default' : 'pointer', filter: filterId ? `url(#${filterId})` : undefined, pointerEvents: isLocked || copy ? 'none' : undefined }}
      {...(copy ? {} : layerPointerHandlers)}
    >
      <defs>
        {!copy && !isGhost && el.content.shadowColor && (
          <filter id={filterId} x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow
              dx={el.content.shadowOffsetX || 0}
              dy={el.content.shadowOffsetY || 4}
              stdDeviation={el.content.shadowBlur || 8}
              floodColor={el.content.shadowColor || 'rgba(0,0,0,0.5)'}
              floodOpacity="0.85"
            />
          </filter>
        )}
      </defs>
      {pathContent}
    </g>
  );
  /*
   * C_out = (1 - w)*C + w*F(C), A_out = A. Inside an isolated group
   * the layer is drawn once under (1 - w) and once, through the correction
   * filter, under w, added with plus-lighter (premultiplied add): the colour
   * is mixed and the alpha is exactly the layer's own. The mix sits BEFORE
   * the layer masks, the Track Matte and the layer opacity, which therefore
   * apply to the corrected layer as one. The second copy takes no pointer.
   */
  const transformedContent = colorCorrection ? (
    <g style={{ isolation: 'isolate' }} data-color-correction="applied">
      <g
        mask={colorCorrection.inverseMaskId ? `url(#${colorCorrection.inverseMaskId})` : undefined}
        opacity={colorCorrection.inverseMaskId ? undefined : 1 - colorCorrection.amount}
      >
        {renderTransformed(false)}
      </g>
      <g
        mask={colorCorrection.coverageMaskId ? `url(#${colorCorrection.coverageMaskId})` : undefined}
        opacity={colorCorrection.coverageMaskId ? undefined : colorCorrection.amount}
        filter={`url(#${colorCorrection.filterId})`}
        style={{ mixBlendMode: 'plus-lighter' }}
        pointerEvents="none"
        data-color-correction-copy="true"
      >
        {renderTransformed(true)}
      </g>
    </g>
  ) : renderTransformed(false);
  const maskedContent = (layerMaskIds ?? []).reduceRight<React.ReactNode>(
    (content, maskId) => <g key={`${part.id}-${maskId}`} mask={`url(#${maskId})`}>{content}</g>,
    transformedContent,
  );

  return (
    <g
      key={`${part.id}${isGhost ? '-ghost-' + ghostColor : ''}`}
      data-part-id={part.id}
      // clipPath/mask defs are world-space and therefore live on this
      // transform-less outer group. Interactive behavior remains on the
      // transformed content group.
      clipPath={matteClipPathId ? `url(#${matteClipPathId})` : undefined}
      mask={matteMaskId ? `url(#${matteMaskId})` : undefined}
    >
      {maskedContent}
    </g>
  );
};

/** Equal values, one level deep: an evaluated transform or content is rebuilt every frame. */
const sameShallow = (a: unknown, b: unknown): boolean => {
  if (Object.is(a, b)) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  const aKeys = Object.keys(a);
  if (aKeys.length !== Object.keys(b).length) return false;
  return aKeys.every((key) => {
    const left = (a as Record<string, unknown>)[key];
    const right = (b as Record<string, unknown>)[key];
    if (Object.is(left, right)) return true;
    // The world affine is a fresh object of numbers on every evaluation.
    if (!left || !right || typeof left !== 'object' || typeof right !== 'object' || Array.isArray(left) !== Array.isArray(right)) return false;
    const leftKeys = Object.keys(left);
    return leftKeys.length === Object.keys(right).length
      && leftKeys.every((inner) => Object.is((left as Record<string, unknown>)[inner], (right as Record<string, unknown>)[inner]));
  });
};

/**
 * A layer whose part, evaluated pose and content are the same values as on
 * the last frame is not rendered again: a frame of a large scene re-renders
 * only the layers that change in it.
 */
const samePartRendererProps = (prev: PartRendererProps, next: PartRendererProps): boolean => (
  prev.part === next.part
  && prev.isGhost === next.isGhost
  && prev.ghostColor === next.ghostColor
  && prev.isSelected === next.isSelected
  && prev.onSelect === next.onSelect
  && prev.onStartTranslateDrag === next.onStartTranslateDrag
  && prev.onDrillIn === next.onDrillIn
  && prev.booleanContours === next.booleanContours
  && prev.matteClipPathId === next.matteClipPathId
  && prev.matteMaskId === next.matteMaskId
  && prev.isLocked === next.isLocked
  && (!contentFollowsFrame(next.part) || prev.currentFrame === next.currentFrame)
  && sameShallow(prev.layerMaskIds, next.layerMaskIds)
  && sameShallow(prev.outputOrigin, next.outputOrigin)
  && sameShallow(prev.colorCorrection, next.colorCorrection)
  && prev.evaluatedLayer.visible === next.evaluatedLayer.visible
  && prev.evaluatedLayer.opacity === next.evaluatedLayer.opacity
  && sameShallow(prev.evaluatedLayer.transform, next.evaluatedLayer.transform)
  && sameContentFields(prev.evaluatedLayer.content, next.evaluatedLayer.content)
);

export const PartRenderer = React.memo(PartRendererView, samePartRendererProps);
