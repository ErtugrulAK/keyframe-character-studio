import React from 'react';
import type { CharacterPart } from '../../../../types/animator';

interface MediaPartProps {
  part: CharacterPart;
  fill: string;
  stroke: string;
  isSelected: boolean;
  overrideMaskShape?: 'none' | 'circle' | 'pill' | 'star' | 'hexagon' | 'heart';
}

export const renderMediaPart = ({ part, fill, stroke, isSelected, overrideMaskShape }: MediaPartProps): React.ReactNode => {
  const isVideo = part.type === 'custom_video';
  const fullW = isVideo ? 200 : 180;
  const fullH = isVideo ? 120 : 120;
  const startX = -fullW / 2;
  const startY = -fullH / 2;

  const isCrop = part.cropEnabled ?? false;
  const cropX = part.cropX ?? 25;
  const cropY = part.cropY ?? 10;
  const cropW = part.cropWidth ?? 50;
  const cropH = part.cropHeight ?? 80;

  const cX = startX + (fullW * cropX) / 100;
  const cY = startY + (fullH * cropY) / 100;
  const realCW = (fullW * cropW) / 100;
  const realCH = (fullH * cropH) / 100;
  const clipId = `media-crop-${part.id}`;
  const mShape = overrideMaskShape || (part.enableMaskShape !== false ? (part.maskShape || 'none') : 'none');
  const isGeometricMask = mShape !== 'none';
  const isClipActive = isCrop || isGeometricMask;

  let captionY = startY + fullH - 20;
  if (part.overlayTextPosition === 'top') captionY = startY + 20;
  if (part.overlayTextPosition === 'center') captionY = 0;

  return (
    <g>
      <defs>
        {isClipActive && (
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
            ) : isCrop ? (
              <rect x={cX} y={cY} width={realCW} height={realCH} rx={4} />
            ) : (
              <rect x={startX} y={startY} width={fullW} height={fullH} rx={8} />
            )}
          </clipPath>
        )}
      </defs>

      <g clipPath={isClipActive ? `url(#${clipId})` : undefined}>
        {isVideo ? (
          part.videoUrl ? (
            <foreignObject x={startX} y={startY} width={fullW} height={fullH}>
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
            </foreignObject>
          ) : (
            <rect x={startX} y={startY} width={fullW} height={fullH} rx={8} fill={fill} />
          )
        ) : part.imageUrl ? (
          <image
            href={part.imageUrl}
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

      {isCrop && (
        <g style={{ pointerEvents: 'none' }}>
          <rect x={startX} y={startY} width={fullW} height={fullH} fill="rgba(0,0,0,0.55)" rx={8} />
          <g clipPath={`url(#${clipId})`}>
            {isVideo ? (
              part.videoUrl ? (
                <foreignObject x={startX} y={startY} width={fullW} height={fullH}>
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
                </foreignObject>
              ) : (
                <rect x={startX} y={startY} width={fullW} height={fullH} rx={8} fill={fill} />
              )
            ) : part.imageUrl ? (
              <image
                href={part.imageUrl}
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

          <path
            d={`
              M ${cX},${cY + 16} L ${cX},${cY} L ${cX + 16},${cY}
              M ${cX + realCW - 16},${cY} L ${cX + realCW},${cY} L ${cX + realCW},${cY + 16}
              M ${cX},${cY + realCH - 16} L ${cX},${cY + realCH} L ${cX + 16},${cY + realCH}
              M ${cX + realCW - 16},${cY + realCH} L ${cX + realCW},${cY + realCH} L ${cX + realCW},${cY + realCH - 16}
            `}
            fill="none"
            stroke="#ffffff"
            strokeWidth={3.5}
            strokeLinecap="square"
            vectorEffect="non-scaling-stroke"
          />
        </g>
      )}

      <rect
        x={startX}
        y={startY}
        width={fullW}
        height={fullH}
        rx={8}
        fill="none"
        stroke={stroke}
        strokeWidth={isSelected ? 2 : 1.5}
        vectorEffect="non-scaling-stroke"
      />

      {part.overlayText && (
        <g style={{ pointerEvents: 'none' }}>
          <rect
            x={startX + 10}
            y={captionY - 14}
            width={fullW - 20}
            height={28}
            rx={6}
            fill={part.overlayTextBg || 'rgba(15, 23, 42, 0.85)'}
            stroke="rgba(255, 255, 255, 0.25)"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
          <text
            x={0}
            y={captionY}
            textAnchor="middle"
            dominantBaseline="middle"
            fill={part.overlayTextColor || '#ffffff'}
            fontSize={12}
            fontWeight="800"
            fontFamily="Inter, system-ui, sans-serif"
          >
            {part.overlayText}
          </text>
        </g>
      )}
    </g>
  );
};
