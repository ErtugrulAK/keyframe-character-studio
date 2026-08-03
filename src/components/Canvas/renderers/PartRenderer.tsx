import React from 'react';
import type { CharacterPart, Transform, MaskPoint } from '../../../types/animator';
import { useAnimator } from '../../../context/AnimatorContext';
import { sampleCustomPreset } from './utils/presetSampler';
import { renderShapePart } from './parts/ShapePartRenderers';
import { renderMediaPart } from './parts/MediaPartRenderer';
import { renderTextOrClonerPart } from './parts/TextAndClonerRenderers';
import { getYouTubeEmbedInfo } from './utils/youtubeHelper';

interface PartRendererProps {
  part: CharacterPart;
  transform: Transform;
  isGhost?: boolean;
  ghostColor?: string;
  isFocusGhost?: boolean;
  isSelected?: boolean;
  currentFrame: number;
  totalFrames: number;
  onSelect: (partId: string) => void;
  onStartTranslateDrag: (partId: string, e: React.MouseEvent) => void;
}

export const PartRenderer: React.FC<PartRendererProps> = ({
  part,
  transform,
  isGhost = false,
  ghostColor,
  isFocusGhost = false,
  isSelected = false,
  currentFrame,
  totalFrames,
  onSelect,
  onStartTranslateDrag,
}) => {
  let animScaleX = 1;
  let animScaleY = 1;
  let animOpacity = 1;
  let animRot = 0;
  let animX = 0;
  let animY = 0;

  let overrideMaskShape: 'none' | 'circle' | 'pill' | 'star' | 'hexagon' | 'heart' | undefined = undefined;

  const { appMode, broadcastState, customPresets, tracks, liveStuntsState, setFocusModeNodeId } = useAnimator();
  const targetTrack = tracks.find(t => t.partId === part.id);

  if (!isGhost) {
    const inDur = part.inAnimDuration || 30;
    const outDur = part.outAnimDuration || 30;
    const inPreset = part.inAnimPreset || 'none';
    const outPreset = part.outAnimPreset || 'none';
    const allowMotion = part.enableMotionAnim !== false;

    if (appMode === 'broadcast') {
      const bState = broadcastState[part.id] || { state: 'hidden', progress: 0 };
      
      if (targetTrack && targetTrack.visible === false) {
        animOpacity = 0;
      } else if (bState.state === 'hidden') {
        animOpacity = 0;
      } else if (allowMotion && bState.state === 'animating_in') {
        const cp = customPresets.find(p => p.id === inPreset);
        if (cp) {
          const sample = sampleCustomPreset(cp.keyframes, bState.progress);
          const scope = cp.scope || 'both';

          if (scope === 'both' || scope === 'motion_only') {
            animX = sample.deltaX;
            animY = sample.deltaY;
            animRot = sample.rotation;
          }
          if (scope === 'both' || scope === 'shape_only') {
            let sScaleX = sample.scaleX;
            let sScaleY = sample.scaleY;
            if (sScaleX > 2.5) {
              sScaleX = sScaleX / 6.42;
            }
            if (sScaleY > 2.5) {
              sScaleY = sScaleY / 6.42;
            }
            animScaleX = sScaleX;
            animScaleY = sScaleY;

            if (cp.maskShape) {
              overrideMaskShape = cp.maskShape;
            } else if (cp.name.toLowerCase().includes('ball') || cp.name.toLowerCase().includes('circle')) {
              overrideMaskShape = 'circle';
            }
          }
          animOpacity = sample.opacity;
        } else if (inPreset !== 'none' && inPreset !== 'custom_timeline') {
          const easeProgress = 1 - Math.pow(1 - bState.progress, 3);
          if (inPreset === 'fade') animOpacity = easeProgress;
          else if (inPreset === 'pop') { animScaleX = easeProgress; animScaleY = easeProgress; animOpacity = easeProgress; }
          else if (inPreset === 'spin') { animRot = (1 - easeProgress) * -360; animScaleX = easeProgress; animScaleY = easeProgress; animOpacity = easeProgress; }
          else if (inPreset.startsWith('slide-')) {
            animOpacity = easeProgress;
            const dist = 300 * (1 - easeProgress);
            if (inPreset === 'slide-left') animX = dist;
            if (inPreset === 'slide-right') animX = -dist;
            if (inPreset === 'slide-up') animY = dist;
            if (inPreset === 'slide-down') animY = -dist;
          }
        } else {
          animOpacity = 1;
        }
      } else if (allowMotion && bState.state === 'animating_out') {
        const cp = customPresets.find(p => p.id === outPreset);
        if (cp) {
          const sample = sampleCustomPreset(cp.keyframes, bState.progress);
          const scope = cp.scope || 'both';

          if (scope === 'both' || scope === 'motion_only') {
            animX = sample.deltaX;
            animY = sample.deltaY;
            animRot = sample.rotation;
          }
          if (scope === 'both' || scope === 'shape_only') {
            let sScaleX = sample.scaleX;
            let sScaleY = sample.scaleY;
            if (sScaleX > 2.5) {
              sScaleX = sScaleX / 6.42;
            }
            if (sScaleY > 2.5) {
              sScaleY = sScaleY / 6.42;
            }
            animScaleX = sScaleX;
            animScaleY = sScaleY;

            if (cp.maskShape) {
              overrideMaskShape = cp.maskShape;
            } else if (cp.name.toLowerCase().includes('ball') || cp.name.toLowerCase().includes('circle')) {
              overrideMaskShape = 'circle';
            }
          }
          animOpacity = sample.opacity;
        } else if (outPreset !== 'none' && outPreset !== 'custom_timeline') {
          const easeProgress = Math.pow(bState.progress, 3);
          if (outPreset === 'fade') animOpacity = easeProgress;
          else if (outPreset === 'pop') { animScaleX = easeProgress; animScaleY = easeProgress; animOpacity = easeProgress; }
          else if (outPreset === 'spin') { animRot = (1 - easeProgress) * 360; animScaleX = easeProgress; animScaleY = easeProgress; animOpacity = easeProgress; }
          else if (outPreset.startsWith('slide-')) {
            animOpacity = easeProgress;
            const dist = 300 * (1 - easeProgress);
            if (outPreset === 'slide-left') animX = -dist;
            if (outPreset === 'slide-right') animX = dist;
            if (outPreset === 'slide-up') animY = -dist;
            if (outPreset === 'slide-down') animY = dist;
          }
        } else {
          animOpacity = 0;
        }
      } else if (bState.state === 'visible') {
        animOpacity = 1;
      }
    } else {
      // Linear Edit Mode timeline logic
      if (targetTrack && targetTrack.editVisible === false) {
        animOpacity = 0; // Hard hidden from Edit Canvas
      } else if (allowMotion && inPreset !== 'none' && currentFrame < inDur) {
        const progress = currentFrame / inDur; 
        const easeProgress = 1 - Math.pow(1 - progress, 3); // easeOutCubic

        if (inPreset === 'fade') animOpacity = easeProgress;
        else if (inPreset === 'pop') { animScaleX = easeProgress; animScaleY = easeProgress; animOpacity = easeProgress; }
        else if (inPreset === 'spin') { animRot = (1 - easeProgress) * -360; animScaleX = easeProgress; animScaleY = easeProgress; animOpacity = easeProgress; }
        else if (inPreset.startsWith('slide-')) {
          animOpacity = easeProgress;
          const dist = 300 * (1 - easeProgress);
          if (inPreset === 'slide-left') animX = dist;
          if (inPreset === 'slide-right') animX = -dist;
          if (inPreset === 'slide-up') animY = dist;
          if (inPreset === 'slide-down') animY = -dist;
        }
      }

      if (allowMotion && outPreset !== 'none' && totalFrames - currentFrame <= outDur) {
        const progress = Math.max(0, (totalFrames - currentFrame) / outDur); 
        const easeProgress = Math.pow(progress, 3); // easeInCubic

        if (outPreset === 'fade') animOpacity = easeProgress;
        else if (outPreset === 'pop') { animScaleX = easeProgress; animScaleY = easeProgress; animOpacity = easeProgress; }
        else if (outPreset === 'spin') { animRot = (1 - easeProgress) * 360; animScaleX = easeProgress; animScaleY = easeProgress; animOpacity = easeProgress; }
        else if (outPreset.startsWith('slide-')) {
          animOpacity = easeProgress;
          const dist = 300 * (1 - easeProgress);
          if (outPreset === 'slide-left') animX = -dist;
          if (outPreset === 'slide-right') animX = dist;
          if (outPreset === 'slide-up') animY = -dist;
          if (outPreset === 'slide-down') animY = dist;
        }
      }
    }

    // Apply Live Stunts Deltas if active
    const activeStunt = liveStuntsState[part.id];
    if (activeStunt) {
      const p = activeStunt.progress;
      const sType = activeStunt.stunt;

      if (activeStunt.customPresetId) {
        const cp = customPresets.find(pr => pr.id === activeStunt.customPresetId);
        if (cp) {
          const sample = sampleCustomPreset(cp.keyframes, p);
          const scope = cp.scope || 'both';

          if (scope === 'both' || scope === 'motion_only') {
            animX += sample.deltaX;
            animY += sample.deltaY;
            animRot += sample.rotation;
          }

          if (scope === 'both' || scope === 'shape_only') {
            // Safe scale multiplier normalization (prevents 40x mega zoom)
            let sScaleX = sample.scaleX;
            let sScaleY = sample.scaleY;
            if (sScaleX > 2.5) {
              sScaleX = sScaleX / 6.42;
            }
            if (sScaleY > 2.5) {
              sScaleY = sScaleY / 6.42;
            }

            animScaleX *= sScaleX;
            animScaleY *= sScaleY;

            if (cp.maskShape) {
              overrideMaskShape = cp.maskShape;
            } else if (cp.name.toLowerCase().includes('ball') || cp.name.toLowerCase().includes('circle') || cp.name.toLowerCase().includes('top') || cp.name.toLowerCase().includes('yuvarla')) {
              overrideMaskShape = 'circle';
            }
          }

          animOpacity *= sample.opacity;
        }
      } else if (sType === 'bounce' || sType.toLowerCase().includes('ball')) {
        overrideMaskShape = 'circle';
        const bounceY = Math.sin(p * Math.PI) * -80;
        animY += bounceY;
      } else if (sType === 'pulse') {
        const factor = 1 + Math.sin(p * Math.PI) * 0.35;
        animScaleX *= factor;
        animScaleY *= factor;
      } else if (sType === 'wobble') {
        animRot += Math.sin(p * Math.PI * 4) * 18 * (1 - p);
      } else if (sType === 'spin') {
        animRot += p * 360;
      } else if (sType === 'shake') {
        const vib = (1 - p) * 15;
        animX += (Math.random() - 0.5) * vib;
        animY += (Math.random() - 0.5) * vib;
      } else if (sType === 'float') {
        animY += Math.sin(p * Math.PI * 2) * -30;
      }
    }
  }

  const finalOpacity = (isGhost ? 0.35 : transform.opacity) * animOpacity;
  const finalX = 300 + transform.x + animX;
  const finalY = 240 + transform.y + animY;
  const finalScaleX = transform.scaleX * animScaleX;
  const finalScaleY = transform.scaleY * animScaleY;
  const finalRot = transform.rotation + animRot;

  const fill = (isGhost && ghostColor ? ghostColor : part.fillColor) || '#ffffff';
  const stroke = (isGhost && ghostColor ? ghostColor : isSelected ? '#00d2ff' : part.strokeColor) || '#101218';

  // Inner Media Helper (Supports Direct MP4/WebM & YouTube Embed URLs)
  const renderInnerMedia = (shapeWidth: number, shapeHeight: number, xOff: number = 0, yOff: number = 0, overrideOpacity?: number) => {
    if (!part.innerMediaUrl || (isGhost && !isFocusGhost)) return null;
    
    // Apply Mask Transforms from computed transform (or fallback to part)
    const mX = transform.maskOffsetX ?? part.maskOffsetX ?? 0;
    const mY = transform.maskOffsetY ?? part.maskOffsetY ?? 0;
    const mScale = transform.maskScale ?? part.maskScale ?? 1;
    const mRot = transform.maskRotation ?? part.maskRotation ?? 0;
    const maskTransform = `translate(${mX}, ${mY}) scale(${mScale}) rotate(${mRot})`;
    if (part.innerMediaType === 'video') {
      const { isYouTube, embedUrl } = getYouTubeEmbedInfo(part.innerMediaUrl);
      return (
        <g transform={maskTransform} opacity={overrideOpacity ?? 1}>
          <foreignObject x={xOff} y={yOff} width={shapeWidth} height={shapeHeight} style={{ pointerEvents: 'none' }}>
            {isYouTube ? (
            <div style={{ width: '100%', height: '100%', overflow: 'hidden', pointerEvents: 'none', position: 'relative' }}>
              <iframe
                src={embedUrl}
                title="YouTube Masked Video"
                allow="autoplay; encrypted-media"
                style={{
                  position: 'absolute',
                  top: '-15%',
                  left: '-15%',
                  width: '130%',
                  height: '130%',
                  border: 'none',
                  pointerEvents: 'none',
                }}
              />
            </div>
          ) : (
            <video
              src={part.innerMediaUrl}
              autoPlay
              muted
              loop
              playsInline
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          )}
        </foreignObject>
      </g>
      );
    }
    return (
      <g transform={maskTransform} opacity={overrideOpacity ?? 1}>
        <image
          href={part.innerMediaUrl}
          x={xOff}
          y={yOff}
          width={shapeWidth}
          height={shapeHeight}
          preserveAspectRatio="xMidYMid slice"
          style={{ pointerEvents: 'none' }}
        />
      </g>
    );
  };

  // Delegate Rendering to Sub-Renderers based on part type
  let pathContent: React.ReactNode = null;

  if (isFocusGhost) {
    // Only render unclipped media for focus ghost
    pathContent = renderInnerMedia(
      part.type === 'custom_box' ? 80 : 120,
      part.type === 'custom_box' ? 80 : 60,
      part.type === 'custom_box' ? -40 : -60,
      part.type === 'custom_box' ? -40 : -30,
      0.4
    );
  } else if (part.type === 'custom_video' || part.type === 'custom_image') {
    pathContent = renderMediaPart({ part, fill, stroke, isSelected, overrideMaskShape });
  } else if (part.type === 'custom_text' || part.type === 'mograph_cloner') {
    pathContent = renderTextOrClonerPart({ part, fill, stroke, isSelected, currentFrame });
  } else {
    pathContent = renderShapePart({ part, fill, stroke, isSelected, isGhost, renderInnerMedia });
  }

  const filterId = !isGhost && part.shadowColor ? `drop-shadow-${part.id}` : undefined;

  const isHardHidden = appMode !== 'broadcast' && targetTrack?.editVisible === false;

  const activeMask = transform.mask || part.mask;
  const hasMask = activeMask && activeMask.enabled;
  const maskId = `mask-${part.id}`;
  const featherId = `feather-${part.id}`;

  const generateMaskPath = (points: MaskPoint[], closed: boolean) => {
    if (!points || points.length === 0) return '';
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      if (prev.handleOut || curr.handleIn) {
        const cp1x = prev.x + (prev.handleOut?.x || 0);
        const cp1y = prev.y + (prev.handleOut?.y || 0);
        const cp2x = curr.x + (curr.handleIn?.x || 0);
        const cp2y = curr.y + (curr.handleIn?.y || 0);
        d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${curr.x} ${curr.y}`;
      } else {
        d += ` L ${curr.x} ${curr.y}`;
      }
    }
    if (closed && points.length > 2) {
      const prev = points[points.length - 1];
      const curr = points[0];
      if (prev.handleOut || curr.handleIn) {
        const cp1x = prev.x + (prev.handleOut?.x || 0);
        const cp1y = prev.y + (prev.handleOut?.y || 0);
        const cp2x = curr.x + (curr.handleIn?.x || 0);
        const cp2y = curr.y + (curr.handleIn?.y || 0);
        d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${curr.x} ${curr.y}`;
      }
      d += ' Z';
    }
    return d;
  };

  return (
    <g
      key={`${part.id}${isGhost ? '-ghost-' + ghostColor : ''}`}
      transform={`translate(${finalX}, ${finalY}) rotate(${finalRot}) scale(${finalScaleX}, ${finalScaleY})`}
      style={{
        opacity: finalOpacity,
        cursor: isGhost ? 'default' : 'pointer',
        filter: filterId ? `url(#${filterId})` : undefined,
        pointerEvents: isHardHidden ? 'none' : 'auto',
      }}
      onClick={(e) => {
        if (!isGhost && e.button === 0) {
          e.stopPropagation();
          onSelect(part.id);
        }
      }}
      onMouseDown={(e) => {
        if (!isGhost && e.button === 0) {
          e.stopPropagation();
          onStartTranslateDrag(part.id, e);
        }
      }}
      onDoubleClick={(e) => {
        if (!isGhost && part.innerMediaUrl && e.button === 0) {
          e.stopPropagation();
          setFocusModeNodeId(part.id);
        }
      }}
    >
      <defs>
        {!isGhost && part.shadowColor && (
          <filter id={filterId} x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow
              dx={part.shadowOffsetX || 0}
              dy={part.shadowOffsetY || 4}
              stdDeviation={part.shadowBlur || 8}
              floodColor={part.shadowColor || 'rgba(0,0,0,0.5)'}
              floodOpacity="0.85"
            />
          </filter>
        )}
        {hasMask && activeMask && (
          <>
            {activeMask.feather > 0 && (
              <filter id={featherId} x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation={activeMask.feather} />
              </filter>
            )}
            <mask id={maskId}>
              {activeMask.inverted && (
                <rect x="-10000" y="-10000" width="20000" height="20000" fill="white" />
              )}
              <path 
                 d={generateMaskPath(activeMask.points, activeMask.closed)} 
                 fill={activeMask.inverted ? "black" : "white"} 
                 filter={activeMask.feather > 0 ? `url(#${featherId})` : undefined}
                 opacity={activeMask.opacity}
              />
            </mask>
          </>
        )}
      </defs>

      {hasMask ? (
        <g mask={`url(#${maskId})`}>
          {pathContent}
        </g>
      ) : (
        pathContent
      )}
    </g>
  );
};
