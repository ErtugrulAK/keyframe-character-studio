import React from 'react';
import type { CharacterPart } from '../../../../types/animator';
import { getYouTubeEmbedInfo } from '../utils/youtubeHelper';

interface MediaPartProps {
  part: CharacterPart;
  fill: string;
  stroke: string;
  isSelected: boolean;
  overrideMaskShape?: 'none' | 'circle' | 'pill' | 'star' | 'hexagon' | 'heart';
}

export const renderMediaPart = ({ part, fill, isSelected, overrideMaskShape }: MediaPartProps): React.ReactNode => {
  const isVideo = part.type === 'custom_video';
  const fullW = isVideo ? 200 : 180;
  const fullH = isVideo ? 120 : 120;
  const startX = -fullW / 2;
  const startY = -fullH / 2;

  const clipId = `media-shape-${part.id}`;
  const mShape = overrideMaskShape || (part.enableMaskShape !== false ? (part.maskShape || 'none') : 'none');
  const isGeometricMask = mShape !== 'none';

  const { isYouTube, embedUrl } = getYouTubeEmbedInfo(part.videoUrl);

  return (
    <g>
      {/* Invisible hit-test base element to ensure 100% of media area receives mouse click and drag events */}
      <rect x={startX} y={startY} width={fullW} height={fullH} rx={8} fill="rgba(0,0,0,0.001)" />
      <defs>
        {isGeometricMask && (
          <clipPath id={clipId}>
            {mShape === 'circle' ? (
              <circle cx={0} cy={0} r={Math.min(fullW, fullH) / 2} />
            ) : mShape === 'pill' ? (
              <rect x={startX} y={startY} width={fullW} height={fullH} rx={fullH / 2} />
            ) : mShape === 'star' ? (
              <polygon points="0,-55 16,-16 55,-16 24,9 36,45 0,22 -36,45 -24,9 -55,-16 -16,-16" />
            ) : mShape === 'hexagon' ? (
              <polygon points="0,-55 46,-27 46,27 0,55 -46,27 -46,-27" />
            ) : mShape === 'heart' ? (
              <path d="M 0 -22 C -40 -60 -80 0 0 48 C 80 0 40 -60 0 -22 Z" />
            ) : (
              <rect x={startX} y={startY} width={fullW} height={fullH} rx={8} />
            )}
          </clipPath>
        )}
      </defs>

      <g clipPath={isGeometricMask ? `url(#${clipId})` : undefined}>
        {isVideo ? (
          part.videoUrl ? (
            <foreignObject x={startX} y={startY} width={fullW} height={fullH}>
              {isYouTube ? (
                <div style={{ width: '100%', height: '100%', overflow: 'hidden', pointerEvents: 'none', position: 'relative', borderRadius: 8 }}>
                  <iframe
                    src={embedUrl}
                    title="YouTube Standalone Video"
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
                  src={part.videoUrl}
                  autoPlay
                  loop
                  muted
                  playsInline
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    borderRadius: 8,
                    pointerEvents: 'none',
                  }}
                />
              )}
            </foreignObject>
          ) : (
            <rect x={startX} y={startY} width={fullW} height={fullH} rx={8} fill={fill} />
          )
        ) : (part.imageUrl || part.innerMediaUrl) ? (
          <image
            href={part.imageUrl || part.innerMediaUrl}
            x={startX}
            y={startY}
            width={fullW}
            height={fullH}
            preserveAspectRatio="xMidYMid meet"
          />
        ) : (
          <rect x={startX} y={startY} width={fullW} height={fullH} rx={8} fill={fill} />
        )}
      </g>

      {isSelected && (
        <rect
          x={startX}
          y={startY}
          width={fullW}
          height={fullH}
          rx={8}
          fill="none"
          stroke="#38bdf8"
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
        />
      )}
    </g>
  );
};
