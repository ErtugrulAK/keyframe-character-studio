import React from 'react';
import type { CharacterPart, Transform } from '../../../types/animator';

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

  if (!isGhost) {
    const inDur = part.inAnimDuration || 30;
    const outDur = part.outAnimDuration || 30;
    const inPreset = part.inAnimPreset || 'none';
    const outPreset = part.outAnimPreset || 'none';

    if (inPreset !== 'none' && currentFrame < inDur) {
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

    if (outPreset !== 'none' && totalFrames - currentFrame <= outDur) {
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

  const finalOpacity = (isGhost ? 0.35 : transform.opacity) * animOpacity;
  const finalX = transform.x + animX;
  const finalY = transform.y + animY;
  const finalScaleX = transform.scaleX * animScaleX;
  const finalScaleY = transform.scaleY * animScaleY;
  const finalRot = transform.rotation + animRot;

  const fill = isGhost && ghostColor ? ghostColor : part.fillColor;
  const stroke = isGhost ? ghostColor : isSelected ? '#00d2ff' : part.strokeColor;

  // Render Inner Media for shapes
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

  let pathContent: React.ReactNode = null;

  switch (part.type) {
    case 'hair':
      pathContent = (
        <path
          d="M -35 -20 Q -45 -60 0 -65 Q 45 -60 35 -20 Q 40 10 25 25 Q 0 35 -25 25 Q -40 10 -35 -20 Z"
          fill={fill}
          stroke={stroke}
          strokeWidth={isSelected ? 3 : 2}
        />
      );
      break;
    case 'head':
      pathContent = (
        <g>
          <ellipse
            cx={0}
            cy={0}
            rx={30}
            ry={35}
            fill={fill}
            stroke={stroke}
            strokeWidth={isSelected ? 3 : 2}
          />
          {!isGhost && (
            <>
              <circle cx={-10} cy={-5} r={4} fill="#222" />
              <circle cx={10} cy={-5} r={4} fill="#222" />
              <circle cx={-8} cy={-7} r={1.5} fill="#fff" />
              <circle cx={12} cy={-7} r={1.5} fill="#fff" />
              <path d="M -8 12 Q 0 20 8 12" fill="none" stroke="#aa5533" strokeWidth={2.5} strokeLinecap="round" />
            </>
          )}
        </g>
      );
      break;
    case 'torso':
      pathContent = (
        <path
          d="M -30 -45 L 30 -45 L 22 45 L -22 45 Z"
          fill={fill}
          stroke={stroke}
          strokeWidth={isSelected ? 3 : 2}
        />
      );
      break;
    case 'upper_arm_l':
    case 'upper_arm_r':
      pathContent = (
        <rect
          x={-12}
          y={0}
          width={24}
          height={55}
          rx={10}
          fill={fill}
          stroke={stroke}
          strokeWidth={isSelected ? 3 : 2}
        />
      );
      break;
    case 'lower_arm_l':
    case 'lower_arm_r':
      pathContent = (
        <rect
          x={-10}
          y={0}
          width={20}
          height={50}
          rx={8}
          fill={fill}
          stroke={stroke}
          strokeWidth={isSelected ? 3 : 2}
        />
      );
      break;
    case 'hand_l':
    case 'hand_r':
      pathContent = (
        <circle
          cx={0}
          cy={10}
          r={12}
          fill={fill}
          stroke={stroke}
          strokeWidth={isSelected ? 3 : 2}
        />
      );
      break;
    case 'upper_leg_l':
    case 'upper_leg_r':
      pathContent = (
        <rect
          x={-14}
          y={0}
          width={28}
          height={65}
          rx={12}
          fill={fill}
          stroke={stroke}
          strokeWidth={isSelected ? 3 : 2}
        />
      );
      break;
    case 'lower_leg_l':
    case 'lower_leg_r':
      pathContent = (
        <rect
          x={-12}
          y={0}
          width={24}
          height={60}
          rx={10}
          fill={fill}
          stroke={stroke}
          strokeWidth={isSelected ? 3 : 2}
        />
      );
      break;
    case 'foot_l':
    case 'foot_r':
      pathContent = (
        <path
          d="M -10 0 L 25 0 L 25 15 L -10 15 Z"
          fill={fill}
          stroke={stroke}
          strokeWidth={isSelected ? 3 : 2}
        />
      );
      break;
    case 'accessory':
      pathContent = (
        <path
          d="M -15 -15 L 15 -15 L 0 20 Z"
          fill={fill}
          stroke={stroke}
          strokeWidth={isSelected ? 3 : 2}
        />
      );
      break;
    case 'custom_star':
      pathContent = (
        <polygon
          points="0,-35 10,-10 35,-10 15,5 23,30 0,15 -23,30 -15,5 -35,-10 -10,-10"
          fill={fill}
          stroke={stroke}
          strokeWidth={isSelected ? 2 : 1.5}
          vectorEffect="non-scaling-stroke"
        />
      );
      break;
    case 'custom_circle': {
      const clipId = `clip-circle-${part.id}`;
      pathContent = (
        <g>
          {part.innerMediaUrl && (
            <defs>
              <clipPath id={clipId}>
                <circle cx={0} cy={0} r={30} />
              </clipPath>
            </defs>
          )}
          {part.innerMediaUrl ? (
            <g clipPath={`url(#${clipId})`}>
              <circle cx={0} cy={0} r={30} fill={fill} />
              {renderInnerMedia(60, 60, -30, -30)}
            </g>
          ) : (
            <circle cx={0} cy={0} r={30} fill={fill} />
          )}
          <circle cx={0} cy={0} r={30} fill="none" stroke={stroke} strokeWidth={isSelected ? 2 : 1.5} vectorEffect="non-scaling-stroke" />
        </g>
      );
      break;
    }
    case 'custom_box': {
      const clipId = `clip-box-${part.id}`;
      pathContent = (
        <g>
          {part.innerMediaUrl && (
            <defs>
              <clipPath id={clipId}>
                <rect x={-30} y={-30} width={60} height={60} rx={part.borderRadius ?? 0} />
              </clipPath>
            </defs>
          )}
          {part.innerMediaUrl ? (
            <g clipPath={`url(#${clipId})`}>
              <rect x={-30} y={-30} width={60} height={60} rx={part.borderRadius ?? 0} fill={fill} />
              {renderInnerMedia(60, 60, -30, -30)}
            </g>
          ) : (
            <rect x={-30} y={-30} width={60} height={60} rx={part.borderRadius ?? 0} fill={fill} />
          )}
          <rect x={-30} y={-30} width={60} height={60} rx={part.borderRadius ?? 0} fill="none" stroke={stroke} strokeWidth={isSelected ? 2 : 1.5} vectorEffect="non-scaling-stroke" />
        </g>
      );
      break;
    }
    case 'custom_rect': {
      const clipId = `clip-rect-${part.id}`;
      pathContent = (
        <g>
          {part.innerMediaUrl && (
            <defs>
              <clipPath id={clipId}>
                <rect x={-60} y={-30} width={120} height={60} rx={part.borderRadius ?? 0} />
              </clipPath>
            </defs>
          )}
          {part.innerMediaUrl ? (
            <g clipPath={`url(#${clipId})`}>
              <rect x={-60} y={-30} width={120} height={60} rx={part.borderRadius ?? 0} fill={fill} />
              {renderInnerMedia(120, 60, -60, -30)}
            </g>
          ) : (
            <rect x={-60} y={-30} width={120} height={60} rx={part.borderRadius ?? 0} fill={fill} />
          )}
          <rect x={-60} y={-30} width={120} height={60} rx={part.borderRadius ?? 0} fill="none" stroke={stroke} strokeWidth={isSelected ? 2 : 1.5} vectorEffect="non-scaling-stroke" />
        </g>
      );
      break;
    }
    case 'custom_triangle': {
      const clipId = `clip-tri-${part.id}`;
      pathContent = (
        <g>
          {part.innerMediaUrl && (
            <defs>
              <clipPath id={clipId}>
                <polygon points="0,-35 35,25 -35,25" />
              </clipPath>
            </defs>
          )}
          {part.innerMediaUrl ? (
            <g clipPath={`url(#${clipId})`}>
              <polygon points="0,-35 35,25 -35,25" fill={fill} />
              {renderInnerMedia(70, 60, -35, -35)}
            </g>
          ) : (
            <polygon points="0,-35 35,25 -35,25" fill={fill} />
          )}
          <polygon points="0,-35 35,25 -35,25" fill="none" stroke={stroke} strokeWidth={isSelected ? 2 : 1.5} vectorEffect="non-scaling-stroke" />
        </g>
      );
      break;
    }
    case 'custom_text': {
      const textStr = part.textValue || 'TEXT';
      const isStaggered = part.textAnimMode && part.textAnimMode !== 'none';

      if (isStaggered) {
        const items = part.textAnimMode === 'words' ? textStr.split(' ') : textStr.split('');
        const staggerDelayFrames = Math.max(1, Math.round((part.textStaggerDelay || 60) / 33));
        const startFrame = part.textAnimStartFrame || 0;

        pathContent = (
          <g>
            <text
              x={0}
              y={0}
              textAnchor="middle"
              dominantBaseline="middle"
              fill={fill}
              stroke={stroke}
              strokeWidth={0.5}
              fontSize={part.fontSize || 24}
              fontWeight="bold"
              fontFamily={part.fontFamily || 'Outfit'}
              vectorEffect="non-scaling-stroke"
            >
              {items.map((item, idx) => {
                const itemStartFrame = startFrame + idx * staggerDelayFrames;
                const progress = Math.max(0, Math.min(1, (currentFrame - itemStartFrame) / 5));
                const dy = (1 - progress) * -15;
                const itemOpacity = progress;

                return (
                  <tspan
                    key={idx}
                    dy={idx === 0 ? dy : 0}
                    dx={part.textAnimMode === 'words' ? (idx > 0 ? 8 : 0) : 0}
                    opacity={itemOpacity}
                    style={{ transition: 'all 0.15s ease' }}
                  >
                    {item}
                  </tspan>
                );
              })}
            </text>
          </g>
        );
      } else {
        pathContent = (
          <g>
            <text
              x={0}
              y={0}
              textAnchor="middle"
              dominantBaseline="middle"
              fill={fill}
              stroke={stroke}
              strokeWidth={0.5}
              fontSize={part.fontSize || 24}
              fontWeight="bold"
              fontFamily={part.fontFamily || 'Outfit'}
              vectorEffect="non-scaling-stroke"
            >
              {textStr}
            </text>
          </g>
        );
      }
      break;
    }
    case 'mograph_cloner': {
      const cfg = part.clonerConfig || {
        mode: 'grid',
        countX: 4,
        countY: 3,
        spacingX: 40,
        spacingY: 40,
        countCircle: 8,
        radius: 60,
        countLinear: 5,
        spacingLinear: 35,
        childShape: 'circle',
        childSize: 10,
        childColor: fill,
        childStroke: stroke,
        childStrokeWidth: 1.5,
        effector: 'wave',
        waveSpeed: 1.5,
        waveAmplitude: 12,
        waveAxis: 'y',
        randomSeed: 42,
        randomAmplitude: 10,
        stepPhase: 0,
      };

      const clonerItems: { x: number; y: number; scale: number; rot: number; id: number }[] = [];

      if (cfg.mode === 'grid') {
        const startX = -((cfg.countX - 1) * cfg.spacingX) / 2;
        const startY = -((cfg.countY - 1) * cfg.spacingY) / 2;
        let idx = 0;
        for (let r = 0; r < cfg.countY; r++) {
          for (let c = 0; c < cfg.countX; c++) {
            clonerItems.push({
              x: startX + c * cfg.spacingX,
              y: startY + r * cfg.spacingY,
              scale: 1,
              rot: 0,
              id: idx++,
            });
          }
        }
      } else if (cfg.mode === 'circle') {
        const total = cfg.countCircle || 8;
        for (let i = 0; i < total; i++) {
          const angle = (i / total) * Math.PI * 2;
          clonerItems.push({
            x: Math.cos(angle) * cfg.radius,
            y: Math.sin(angle) * cfg.radius,
            scale: 1,
            rot: (angle * 180) / Math.PI,
            id: i,
          });
        }
      } else {
        const total = cfg.countLinear || 5;
        const startX = -((total - 1) * cfg.spacingLinear) / 2;
        for (let i = 0; i < total; i++) {
          clonerItems.push({
            x: startX + i * cfg.spacingLinear,
            y: 0,
            scale: 1,
            rot: 0,
            id: i,
          });
        }
      }

      pathContent = (
        <g>
          {clonerItems.map((item) => {
            let dispX = 0;
            let dispY = 0;
            let itemScale = item.scale;
            let itemRot = item.rot;

            if (cfg.effector === 'wave') {
              const waveVal = Math.sin(currentFrame * 0.1 * (cfg.waveSpeed || 1) + item.id * 0.5) * (cfg.waveAmplitude || 10);
              if (cfg.waveAxis === 'y') dispY += waveVal;
              else if (cfg.waveAxis === 'x') dispX += waveVal;
              else if (cfg.waveAxis === 'scale') itemScale *= 1 + waveVal * 0.03;
              else if (cfg.waveAxis === 'rotation') itemRot += waveVal * 2;
            } else if (cfg.effector === 'random') {
              const pseudoRand = Math.sin(item.id * 99 + (cfg.randomSeed || 1)) * (cfg.randomAmplitude || 10);
              dispY += pseudoRand;
            }

            const size = cfg.childSize || 10;
            const cFill = cfg.childColor || fill;
            const cStroke = cfg.childStroke || stroke;
            const cSw = cfg.childStrokeWidth || 1.5;

            return (
              <g
                key={item.id}
                transform={`translate(${item.x + dispX}, ${item.y + dispY}) rotate(${itemRot}) scale(${itemScale})`}
              >
                {cfg.childShape === 'rect' ? (
                  <rect x={-size / 2} y={-size / 2} width={size} height={size} rx={2} fill={cFill} stroke={cStroke} strokeWidth={cSw} />
                ) : cfg.childShape === 'triangle' ? (
                  <polygon points={`0,${-size / 2} ${size / 2},${size / 2} ${-size / 2},${size / 2}`} fill={cFill} stroke={cStroke} strokeWidth={cSw} />
                ) : cfg.childShape === 'line' ? (
                  <line x1={-size / 2} y1={0} x2={size / 2} y2={0} stroke={cFill} strokeWidth={cSw} strokeLinecap="round" />
                ) : (
                  <circle cx={0} cy={0} r={size / 2} fill={cFill} stroke={cStroke} strokeWidth={cSw} />
                )}
              </g>
            );
          })}
        </g>
      );
      break;
    }
    case 'particle_system': {
      const cfg = part.particleConfig || {
        count: 35,
        shape: 'dot',
        minSize: 3,
        maxSize: 8,
        color: fill,
        minOpacity: 0.2,
        maxOpacity: 0.85,
        speed: 30,
        direction: 'up',
        spread: 250,
        loop: true,
        fadeIn: true,
        fadeOut: true,
        randomSeed: 42,
      };

      const particles: { id: number; x: number; y: number; size: number; opacity: number }[] = [];
      const count = Math.max(5, Math.min(200, cfg.count || 35));
      const spread = cfg.spread || 200;

      for (let i = 0; i < count; i++) {
        const randX = Math.sin(i * 17.3 + (cfg.randomSeed || 1)) * spread;
        const initialY = Math.cos(i * 31.7 + (cfg.randomSeed || 1)) * (spread * 0.6);
        const pSpeed = (cfg.speed || 30) * (0.6 + Math.sin(i * 5) * 0.4);

        let offsetY = (currentFrame * (pSpeed / 30)) % spread;
        if (cfg.direction === 'up') offsetY = -offsetY;

        const pY = initialY + offsetY;
        const size = (cfg.minSize || 3) + Math.abs(Math.sin(i * 12.1)) * ((cfg.maxSize || 8) - (cfg.minSize || 3));
        const pOpacity = (cfg.minOpacity || 0.2) + Math.abs(Math.cos(i * 7.9)) * ((cfg.maxOpacity || 0.85) - (cfg.minOpacity || 0.2));

        particles.push({ id: i, x: randX, y: pY, size, opacity: pOpacity });
      }

      pathContent = (
        <g>
          {particles.map((p) => (
            <g key={p.id} transform={`translate(${p.x}, ${p.y})`} opacity={p.opacity}>
              {cfg.shape === 'cross' ? (
                <path d={`M ${-p.size},0 L ${p.size},0 M 0,${-p.size} L 0,${p.size}`} stroke={cfg.color || fill} strokeWidth={1.5} />
              ) : cfg.shape === 'triangle' ? (
                <polygon points={`0,${-p.size} ${p.size},${p.size} ${-p.size},${p.size}`} fill={cfg.color || fill} />
              ) : cfg.shape === 'circle_outline' ? (
                <circle cx={0} cy={0} r={p.size} fill="none" stroke={cfg.color || fill} strokeWidth={1.5} />
              ) : (
                <circle cx={0} cy={0} r={p.size / 2} fill={cfg.color || fill} />
              )}
            </g>
          ))}
        </g>
      );
      break;
    }
    case 'custom_banner':
      pathContent = (
        <g>
          <rect
            x={-80}
            y={-25}
            width={160}
            height={50}
            rx={part.borderRadius ?? 10}
            fill={fill}
            stroke={stroke}
            strokeWidth={isSelected ? 2 : 1.5}
            vectorEffect="non-scaling-stroke"
          />
          <text
            x={0}
            y={0}
            textAnchor="middle"
            dominantBaseline="middle"
            fill={part.strokeColor || '#ffffff'}
            fontSize={part.fontSize || 16}
            fontWeight="700"
            fontFamily={part.fontFamily || 'Outfit'}
          >
            {part.textValue || 'BANNER LABEL'}
          </text>
        </g>
      );
      break;
    case 'custom_capsule':
      pathContent = (
        <rect
          x={-50}
          y={-20}
          width={100}
          height={40}
          rx={20}
          fill={fill}
          stroke={stroke}
          strokeWidth={isSelected ? 2 : 1.5}
          vectorEffect="non-scaling-stroke"
        />
      );
      break;
    case 'custom_diamond':
      pathContent = (
        <polygon
          points="0,-35 35,0 0,35 -35,0"
          fill={fill}
          stroke={stroke}
          strokeWidth={isSelected ? 2 : 1.5}
          vectorEffect="non-scaling-stroke"
        />
      );
      break;
    case 'custom_card':
      pathContent = (
        <g>
          <rect
            x={-90}
            y={-50}
            width={180}
            height={100}
            rx={part.borderRadius ?? 12}
            fill={fill}
            stroke={stroke}
            strokeWidth={isSelected ? 2 : 1.5}
            vectorEffect="non-scaling-stroke"
          />
          <rect x={-80} y={-40} width={160} height={22} rx={6} fill="#0d0f14" opacity={0.7} />
          <circle cx={-68} cy={-29} r={4} fill="#00d2ff" />
          <text x={-58} y={-29} dominantBaseline="middle" fill="#00d2ff" fontSize={11} fontWeight="800" fontFamily="Outfit, sans-serif">
            {part.cardCategory || part.textValue || 'STUDIO CARD'}
          </text>
          <text x={-80} y={0} dominantBaseline="middle" fill="#f8fafc" fontSize={13} fontWeight="700" fontFamily="Outfit, sans-serif">
            {part.cardTitle || 'MOTION GRAPHIC'}
          </text>
          <rect x={-80} y={16} width={64} height={22} rx={11} fill="#00d2ff" />
          <text x={-48} y={27} textAnchor="middle" dominantBaseline="middle" fill="#0f172a" fontSize={10} fontWeight="800" fontFamily="Outfit, sans-serif">
            {part.cardButtonText || 'ACTIVE'}
          </text>
        </g>
      );
      break;
    case 'custom_image':
    case 'custom_video': {
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

      let captionY = startY + fullH - 20;
      if (part.overlayTextPosition === 'top') captionY = startY + 20;
      if (part.overlayTextPosition === 'center') captionY = 0;

      pathContent = (
        <g>
          <defs>
            {isCrop && (
              <clipPath id={clipId}>
                <rect x={cX} y={cY} width={realCW} height={realCH} rx={4} />
              </clipPath>
            )}
          </defs>

          <g clipPath={isCrop ? `url(#${clipId})` : undefined}>
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
      break;
    }
    default:
      pathContent = (
        <rect
          x={-20}
          y={-20}
          width={40}
          height={40}
          fill={fill}
          stroke={stroke}
          strokeWidth={isSelected ? 2 : 1.5}
          vectorEffect="non-scaling-stroke"
        />
      );
  }

  const filterId = !isGhost && part.shadowColor ? `drop-shadow-${part.id}` : undefined;

  return (
    <g
      key={`${part.id}${isGhost ? '-ghost-' + ghostColor : ''}`}
      transform={`translate(${finalX}, ${finalY}) rotate(${finalRot}) scale(${finalScaleX}, ${finalScaleY})`}
      style={{
        opacity: finalOpacity,
        cursor: isGhost ? 'default' : 'pointer',
        filter: filterId ? `url(#${filterId})` : undefined,
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
