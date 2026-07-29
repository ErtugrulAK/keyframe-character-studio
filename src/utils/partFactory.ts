import type { BodyPartType, CharacterPart, Track } from '../types/animator';
import type { generateId } from './idGenerator';
import type { makeEmptyChannels } from './defaults';
import type { TOOLBAR_COLORS, DEFAULT_CLONER_CONFIG, DEFAULT_PARTICLE_CONFIG } from './constants';

export const createCustomPart = (
  type: BodyPartType,
  name: string,
  zIndex: number,
  extraProps?: Partial<CharacterPart>
): { newPart: CharacterPart; newTrack: Track } => {
  const partId = generateId('part');
  const colors = TOOLBAR_COLORS;
  const randomColor = colors[Math.floor(Math.random() * colors.length)];

  const newPart: CharacterPart = {
    id: partId,
    name,
    type,
    zIndex,
    fillColor: randomColor,
    strokeColor: '#101218',
    pivot: { x: 0.5, y: 0.5 },
    parentId: extraProps?.parentId !== undefined ? extraProps.parentId : undefined,
    baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
    textValue: type === 'custom_text' ? 'NEW TEXT' : type === 'custom_banner' ? 'CARD LABEL' : undefined,
    fontSize: 20,
    cardCategory: type === 'custom_card' ? 'STUDIO CARD' : undefined,
    cardTitle: type === 'custom_card' ? 'MOTION GRAPHIC' : undefined,
    cardButtonText: type === 'custom_card' ? 'ACTIVE' : undefined,
    strokeProgress: 1,
    anchor: 'none',
    anchorOffsetX: 0,
    anchorOffsetY: 0,
    clonerConfig: type === 'mograph_cloner'
      ? { ...DEFAULT_CLONER_CONFIG, childColor: randomColor }
      : undefined,
    particleConfig: type === 'particle_system'
      ? { ...DEFAULT_PARTICLE_CONFIG, color: randomColor }
      : undefined,
    ...extraProps,
  };

  const newTrack: Track = {
    id: generateId('track'),
    partId,
    name: name,
    color: randomColor,
    visible: true,
    locked: false,
    expanded: false,
    keyframes: [],
    channels: makeEmptyChannels(),
  };

  return { newPart, newTrack };
};
