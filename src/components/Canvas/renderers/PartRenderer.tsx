import React from 'react';
import type { CharacterPart, Transform } from '../../../types/animator';
import { useAnimator } from '../../../context/AnimatorContext';
import { sampleCustomPreset } from './utils/presetSampler';
import { renderBodyPart } from './parts/BodyPartRenderers';
import { renderShapePart } from './parts/ShapePartRenderers';
import { renderMediaPart } from './parts/MediaPartRenderer';
import { renderTextOrClonerPart } from './parts/TextAndClonerRenderers';

interface PartRendererProps {
  part: CharacterPart;
  transform: Transform;
  isGhost?: boolean;
  ghostColor?: string;
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

  const { appMode, broadcastState, customPresets, tracks, liveStuntsState } = useAnimator();
  const targetTrack = tracks.find(t => t.partId === part.id);

  if (!isGhost) {
    const inDur = part.inAnimDuration || 30;
    const outDur = part.outAnimDuration || 30;
    const inPreset = part.inAnimPreset || 'none';
    const outPreset = part.outAnimPreset || 'none';
    const allowMotion = part.enableMotionAnim !== false;

    if (appMode === 'broadcast') {
      const bState = broadcastState[part.id] || { state: 'hidden', progress: 0 };
      
      if (bState.state === 'hidden' || (targetTrack && targetTrack.visible === false)) {
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
            animScaleX = sample.scaleX;
            animScaleY = sample.scaleY;
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
            animScaleX = sample.scaleX;
            animScaleY = sample.scaleY;
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
        }
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
            if (sScaleX > 2.5 && transform.scaleX > 2) {
              sScaleX = sScaleX / transform.scaleX;
            }
            if (sScaleY > 2.5 && transform.scaleY > 2) {
              sScaleY = sScaleY / transform.scaleY;
            }

            animScaleX *= sScaleX;
            animScaleY *= sScaleY;
          }

          animOpacity *= sample.opacity;
        }
      } else if (sType === 'bounce') {
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

  // Inner Media Helper
  const renderInnerMedia = (shapeWidth: number, shapeHeight: number, xOff: number = 0, yOff: number = 0) => {
    if (!part.innerMediaUrl || isGhost) return null;
    return part.innerMediaType === 'video' ? (
      <foreignObject x={xOff} y={yOff} width={shapeWidth} height={shapeHeight} style={{ pointerEvents: 'none' }}>
        <video
          src={part.innerMediaUrl}
          autoPlay
          muted
          loop
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </foreignObject>
    ) : (
      <image
        href={part.innerMediaUrl}
        x={xOff}
        y={yOff}
        width={shapeWidth}
        height={shapeHeight}
        preserveAspectRatio="xMidYMid slice"
        style={{ pointerEvents: 'none' }}
      />
    );
  };

  // Delegate Rendering to Sub-Renderers based on part type
  let pathContent: React.ReactNode = null;

  if (part.type === 'custom_video' || part.type === 'custom_image') {
    pathContent = renderMediaPart({ part, fill, stroke, isSelected });
  } else if (part.type === 'custom_text' || part.type === 'mograph_cloner') {
    pathContent = renderTextOrClonerPart({ part, fill, stroke, isSelected, currentFrame });
  } else if (part.type.startsWith('custom_')) {
    pathContent = renderShapePart({ part, fill, stroke, isSelected, isGhost, renderInnerMedia });
  } else {
    pathContent = renderBodyPart({ part, fill, stroke, isSelected, isGhost });
  }

  const filterId = !isGhost && part.shadowColor ? `drop-shadow-${part.id}` : undefined;

  const isHardHidden = appMode !== 'broadcast' && targetTrack?.editVisible === false;

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
          onStartTranslateDrag(part.id, e);
        }
      }}
    >
      {!isGhost && part.shadowColor && (
        <defs>
          <filter id={filterId} x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow
              dx={part.shadowOffsetX || 0}
              dy={part.shadowOffsetY || 4}
              stdDeviation={part.shadowBlur || 8}
              floodColor={part.shadowColor || 'rgba(0,0,0,0.5)'}
              floodOpacity="0.85"
            />
          </filter>
        </defs>
      )}
      {pathContent}
    </g>
  );
};
