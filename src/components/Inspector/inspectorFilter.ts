import { createContext, useContext } from 'react';

/**
 * The Inspector's "Filter properties…" query. A card stays when its title or
 * the words of what it holds match every word typed; a matching card opens.
 * Empty = every card, as before.
 */
export const InspectorFilterContext = createContext<string>('');

export const useInspectorFilter = (): string => useContext(InspectorFilterContext);

/** What each card holds, in the words a user types (its title already counts). */
const CARD_KEYWORDS: Record<string, string> = {
  APPEARANCE: 'fill stroke colour color width align alignment corner radius opacity shadow glow blur blend',
  EFFECTS: 'shadow glow blur blend multiply screen overlay',
  'TEXT EFFECTS': 'animate typewriter count number stopwatch countdown clock timer shadow glow blur blend',
  TEXT: 'content font size colour color',
  TRANSFORM: 'position x y rotation rotate scale size opacity origin anchor reset',
  MODIFIERS: 'text box auto size follow hide when empty look at justify repeater layout',
  'TRACK MATTE': 'matte alpha luminance feather strength gradient invert source',
  'LAYER MASKS': 'mask hole cut feather expansion',
  'LEGACY CLIP MATTE': 'matte clip',
  CROP: 'crop trim cut',
  IMAGE: 'replace picture photo',
  'COLOR CORRECTION': 'brightness contrast saturation colour color',
  'TRIM PATH': 'trim start end offset stroke draw',
  HIERARCHY: 'parent child group',
  'ANIMATION DATA': 'animation clear copy paste keyframes',
  'CONTROL POINTS': 'points path vertex',
  CLONER: 'clone copies',
  PARTICLES: 'particle',
};

/** True when the card titled `title` matches the query (every typed word, case-insensitive). */
export const cardMatchesFilter = (title: string, query: string): boolean => {
  const words = query.toLocaleLowerCase('en').split(/\s+/u).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = `${title} ${CARD_KEYWORDS[title] ?? ''}`.toLocaleLowerCase('en');
  return words.every((word) => haystack.includes(word));
};
