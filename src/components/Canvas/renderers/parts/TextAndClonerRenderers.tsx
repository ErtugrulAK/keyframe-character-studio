import React from 'react';
import type { CharacterPart } from '../../../../types/animator';

interface TextAndClonerProps {
  part: CharacterPart;
  fill: string;
  stroke: string;
  isSelected: boolean;
  currentFrame: number;
}

export const renderTextOrClonerPart = ({ part, fill, stroke, isSelected, currentFrame }: TextAndClonerProps): React.ReactNode => {
  if (part.type === 'custom_text') {
    const textStr = part.textValue || 'TEXT';
    const isStaggered = part.textAnimMode && part.textAnimMode !== 'none';

    if (isStaggered) {
      const items = part.textAnimMode === 'words' ? textStr.split(' ') : textStr.split('');
      const staggerDelayFrames = Math.max(1, Math.round((part.textStaggerDelay || 60) / 33));
      const startFrame = part.textAnimStartFrame || 0;

      return (
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
      return (
        <g>
          <text
            x={0}
            y={0}
            textAnchor="middle"
            dominantBaseline="middle"
            fill={fill}
            stroke={stroke}
            strokeWidth={isSelected ? 1.5 : 0.5}
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
  }

  if (part.type === 'mograph_cloner') {
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

    return (
      <g>
        {clonerItems.map((item) => {
          let dispX = 0;
          let dispY = 0;
          let itemScale = item.scale;
          let itemRot = item.rot;

          if (cfg.effector === 'wave') {
            const waveVal = Math.sin(currentFrame * 0.1 * (cfg.waveSpeed || 1) + item.id * 0.5) * (cfg.waveAmplitude || 10);
            if (cfg.waveAxis === 'x') dispX = waveVal;
            else if (cfg.waveAxis === 'y') dispY = waveVal;
            else if (cfg.waveAxis === 'scale') itemScale = 1 + waveVal * 0.05;
            else if (cfg.waveAxis === 'rotation') itemRot += waveVal * 2;
          } else if (cfg.effector === 'random') {
            const pseudoRand = Math.sin(item.id * 9999 + (cfg.randomSeed || 42)) * 10000;
            const randVal = (pseudoRand - Math.floor(pseudoRand) - 0.5) * (cfg.randomAmplitude || 10);
            dispY = randVal;
          } else if (cfg.effector === 'step') {
            itemScale = 1 + item.id * (cfg.stepPhase || 0.1);
          }

          return (
            <g key={item.id} transform={`translate(${item.x + dispX}, ${item.y + dispY}) rotate(${itemRot}) scale(${itemScale})`}>
              {cfg.childShape === 'rect' ? (
                <rect x={-cfg.childSize / 2} y={-cfg.childSize / 2} width={cfg.childSize} height={cfg.childSize} fill={cfg.childColor || fill} stroke={cfg.childStroke || stroke} strokeWidth={cfg.childStrokeWidth || 1.5} />
              ) : cfg.childShape === 'triangle' ? (
                <polygon points={`0,${-cfg.childSize} ${cfg.childSize},${cfg.childSize} ${-cfg.childSize},${cfg.childSize}`} fill={cfg.childColor || fill} stroke={cfg.childStroke || stroke} strokeWidth={cfg.childStrokeWidth || 1.5} />
              ) : (cfg.childShape as string) === 'circle_outline' ? (
                <circle cx={0} cy={0} r={cfg.childSize} fill="none" stroke={cfg.childStroke || stroke} strokeWidth={cfg.childStrokeWidth || 1.5} />
              ) : (
                <circle cx={0} cy={0} r={cfg.childSize / 2} fill={cfg.childColor || fill} stroke={cfg.childStroke || stroke} strokeWidth={cfg.childStrokeWidth || 1.5} />
              )}
            </g>
          );
        })}
      </g>
    );
  }

  return null;
};
