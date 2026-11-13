/**
 * Ready-made starting graphics for the "New from Template" window.
 *
 * Each recipe is a plain scene document (the format the import boundary
 * validates and `importProject` opens), built for the chosen canvas size and
 * frame rate: positions sit inside the title-safe area and scale with the
 * canvas, and every layer has a short entrance on the timeline. Nothing here
 * touches editor state; the window imports the document like a library item.
 */
import { TITLE_SAFE } from '../geometry/safeAreas';

export type StartRecipeId = 'blank' | 'lower-third' | 'corner-bug' | 'scoreboard' | 'title-card';

export interface StartRecipeInfo {
  id: StartRecipeId;
  label: string;
  description: string;
}

export const START_RECIPES: readonly StartRecipeInfo[] = [
  { id: 'lower-third', label: 'Lower Third', description: 'A name and a title on a bar that sizes itself to the text.' },
  { id: 'corner-bug', label: 'Corner Bug', description: 'A small LIVE badge in the top-right corner.' },
  { id: 'scoreboard', label: 'Scoreboard', description: 'Two teams and their scores, top left.' },
  { id: 'title-card', label: 'Title Card', description: 'A centred title and subtitle with an accent line.' },
];

export interface CanvasPreset {
  label: string;
  width: number;
  height: number;
}

export const CANVAS_PRESETS: readonly CanvasPreset[] = [
  { label: '1920 × 1080 (Full HD)', width: 1920, height: 1080 },
  { label: '1280 × 720 (HD)', width: 1280, height: 720 },
  { label: '3840 × 2160 (4K)', width: 3840, height: 2160 },
  { label: '1080 × 1920 (Vertical)', width: 1080, height: 1920 },
  { label: '1080 × 1080 (Square)', width: 1080, height: 1080 },
];

export const FRAME_RATES: readonly number[] = [25, 30, 50, 60];

export interface StartRecipeOptions {
  width: number;
  height: number;
  fps: number;
}

interface Keyframe {
  id: string;
  frame: number;
  value: number;
  easing: string;
  templateId: string;
}

type Layer = Record<string, unknown> & { id: string; name: string };

const RECT_WIDTH = 120;
const RECT_HEIGHT = 60;
const CIRCLE_DIAMETER = 60;

const COLORS = {
  panel: '#14213d',
  panelDark: '#0b1220',
  accent: '#e63946',
  text: '#ffffff',
  subtext: '#cbd5e1',
  score: '#fca311',
};

/** One layer with the defaults every scene layer carries. */
const layer = (id: string, name: string, zIndex: number, fields: Record<string, unknown>): Layer => ({
  id, name, x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, visible: true, zIndex, ...fields,
});

/** A rectangle `width` × `height` scene pixels, centred on (x, y). */
const rect = (id: string, name: string, zIndex: number, x: number, y: number, width: number, height: number, fillColor: string, extra: Record<string, unknown> = {}): Layer =>
  layer(id, name, zIndex, { type: 'custom_rect', x, y, scaleX: width / RECT_WIDTH, scaleY: height / RECT_HEIGHT, fillColor, strokeColor: fillColor, strokeEnabled: false, ...extra });

const text = (id: string, name: string, zIndex: number, x: number, y: number, value: string, fontSize: number, fontFamily: string, fillColor: string, extra: Record<string, unknown> = {}): Layer =>
  layer(id, name, zIndex, { type: 'custom_text', x, y, textValue: value, fontSize: Math.round(fontSize), fontFamily, fillColor, strokeColor: '#000000', textOrigin: 'center', ...extra });

/**
 * Builds the timeline: per layer, keyframes of a channel at given frames. A
 * layer without animation still gets its track (every scene layer has one).
 */
const buildTracks = (layers: Layer[], animate: Record<string, Partial<Record<string, Array<[number, number]>>>>) =>
  layers.map((item) => {
    const channels: Record<string, Keyframe[]> = {};
    for (const [channel, keys] of Object.entries(animate[item.id] ?? {})) {
      channels[channel] = (keys ?? []).map(([frame, value], index) => ({
        id: `${item.id}-${channel}-${index}`,
        frame,
        value,
        easing: 'easeOut',
        templateId: 'Sequence',
      }));
    }
    return { id: `track-${item.id}`, partId: item.id, name: item.name, color: '#22d3ee', visible: true, locked: false, expanded: false, channels };
  });

const sceneDocument = (name: string, { width, height, fps }: StartRecipeOptions, layers: Layer[], tracks: ReturnType<typeof buildTracks>) => ({
  version: 1,
  coordinateSystem: 'project-unit-center-v1',
  name,
  width,
  height,
  fps,
  totalFrames: Math.round(fps * 5),
  // The one sequence, as long as the timeline: without it a new tab would keep
  // the default one-second sequence.
  motionTemplates: [{ id: 'Sequence', name: 'Sequence', type: 'in' as const, durationFrames: Math.round(fps * 5) }],
  activeTemplateId: 'Sequence',
  layers,
  tracks,
});

/** The scene document a recipe opens as, for this canvas size and frame rate. */
export const buildStartRecipe = (id: StartRecipeId, options: StartRecipeOptions) => {
  const { width: W, height: H, fps } = options;
  // Designed at 1920 × 1080; everything scales with the tighter side.
  const s = Math.min(W / 1920, H / 1080);
  const safeLeft = (-W * TITLE_SAFE) / 2;
  const safeRight = (W * TITLE_SAFE) / 2;
  const safeTop = (-H * TITLE_SAFE) / 2;
  const safeBottom = (H * TITLE_SAFE) / 2;
  const inFrames = Math.max(1, Math.round(fps * 0.5));
  const late = Math.round(fps * 0.2);

  switch (id) {
    case 'blank':
      return sceneDocument('Untitled', options, [], []);

    case 'lower-third': {
      const left = safeLeft + 40 * s;
      const titleY = safeBottom - 150 * s;
      const subtitleY = titleY + 58 * s;
      const barWidth = 820 * s;
      const barLeft = left - 32 * s;
      const layers = [
        rect('bar', 'Bar', 1, barLeft + barWidth / 2, (titleY + subtitleY) / 2, barWidth, 150 * s, COLORS.panel, {
          fitToText: { textLayerId: 'title', extraTextLayerIds: ['subtitle'], padding: Math.round(32 * s), anchor: 'left', vertical: true, paddingY: Math.round(18 * s) },
        }),
        rect('accent', 'Accent', 2, 0, 0, 10 * s, 150 * s, COLORS.accent, { follow: { targetLayerId: 'bar', side: 'left', vertical: true } }),
        text('title', 'Name', 3, left, titleY, 'Firstname Lastname', 56 * s, 'Montserrat', COLORS.text, { textFit: { align: 'left', maxWidth: Math.round(1100 * s) } }),
        text('subtitle', 'Title', 4, left, subtitleY, 'Role or location', 32 * s, 'Inter', COLORS.subtext, { textFit: { align: 'left', maxWidth: Math.round(1100 * s), hideWhenEmpty: true } }),
      ];
      return sceneDocument('Lower Third', options, layers, buildTracks(layers, {
        bar: { opacity: [[0, 0], [inFrames, 1]] },
        accent: { opacity: [[0, 0], [inFrames, 1]] },
        title: { opacity: [[0, 0], [inFrames, 1]], x: [[0, left - 60 * s], [inFrames, left]] },
        subtitle: { opacity: [[late, 0], [late + inFrames, 1]], x: [[late, left - 60 * s], [late + inFrames, left]] },
      }));
    }

    case 'corner-bug': {
      const boxWidth = 170 * s;
      const boxHeight = 64 * s;
      const boxX = safeRight - boxWidth / 2;
      const boxY = safeTop + boxHeight / 2;
      const dotSize = 18 * s;
      const layers = [
        rect('badge', 'Badge', 1, boxX, boxY, boxWidth, boxHeight, COLORS.panelDark, { opacity: 0.85 }),
        layer('dot', 'Dot', 2, { type: 'custom_circle', x: boxX - boxWidth / 2 + 32 * s, y: boxY, scaleX: dotSize / CIRCLE_DIAMETER, scaleY: dotSize / CIRCLE_DIAMETER, fillColor: COLORS.accent, strokeColor: COLORS.accent, strokeEnabled: false }),
        text('live', 'Label', 3, boxX + 16 * s, boxY, 'LIVE', 40 * s, "'Bebas Neue'", COLORS.text),
      ];
      return sceneDocument('Corner Bug', options, layers, buildTracks(layers, {
        badge: { opacity: [[0, 0], [inFrames, 0.85]] },
        dot: { opacity: [[0, 0], [inFrames, 1], [inFrames + fps, 0.25], [inFrames + 2 * fps, 1]] },
        live: { opacity: [[0, 0], [inFrames, 1]] },
      }));
    }

    case 'scoreboard': {
      const rowHeight = 64 * s;
      const nameWidth = 200 * s;
      const scoreWidth = 72 * s;
      const top = safeTop + rowHeight / 2;
      const x0 = safeLeft;
      const homeX = x0 + nameWidth / 2;
      const homeScoreX = x0 + nameWidth + scoreWidth / 2;
      const awayScoreX = homeScoreX + scoreWidth;
      const awayX = awayScoreX + scoreWidth / 2 + nameWidth / 2;
      const layers = [
        rect('home-panel', 'Home Panel', 1, homeX, top, nameWidth, rowHeight, COLORS.panel),
        rect('scores-panel', 'Score Panel', 1, (homeScoreX + awayScoreX) / 2, top, scoreWidth * 2, rowHeight, COLORS.score),
        rect('away-panel', 'Away Panel', 1, awayX, top, nameWidth, rowHeight, COLORS.panel),
        text('home', 'Home', 2, homeX, top, 'HOME', 36 * s, "'Bebas Neue'", COLORS.text),
        text('home-score', 'Home Score', 2, homeScoreX, top, '2', 44 * s, "'Bebas Neue'", COLORS.panelDark),
        text('away-score', 'Away Score', 2, awayScoreX, top, '1', 44 * s, "'Bebas Neue'", COLORS.panelDark),
        text('away', 'Away', 2, awayX, top, 'AWAY', 36 * s, "'Bebas Neue'", COLORS.text),
      ];
      const drop = (y: number) => ({ opacity: [[0, 0], [inFrames, 1]] as Array<[number, number]>, y: [[0, y - 40 * s], [inFrames, y]] as Array<[number, number]> });
      return sceneDocument('Scoreboard', options, layers, buildTracks(layers, Object.fromEntries(layers.map((item) => [item.id, drop(top)]))));
    }

    case 'title-card': {
      const titleY = -40 * s;
      const lineY = 30 * s;
      const subtitleY = 80 * s;
      const lineWidth = 240 * s;
      const layers = [
        text('title', 'Title', 2, 0, titleY, 'Your Title Here', 96 * s, 'Montserrat', COLORS.text),
        rect('line', 'Accent Line', 1, 0, lineY, lineWidth, 6 * s, COLORS.accent),
        text('subtitle', 'Subtitle', 2, 0, subtitleY, 'A short line to go with it', 40 * s, 'Inter', COLORS.subtext),
      ];
      const lineScale = lineWidth / RECT_WIDTH;
      return sceneDocument('Title Card', options, layers, buildTracks(layers, {
        title: { opacity: [[0, 0], [inFrames, 1]], scaleX: [[0, 0.9], [inFrames, 1]], scaleY: [[0, 0.9], [inFrames, 1]] },
        line: { scaleX: [[late, 0], [late + inFrames, lineScale]] },
        subtitle: { opacity: [[2 * late, 0], [2 * late + inFrames, 1]] },
      }));
    }
  }
};
