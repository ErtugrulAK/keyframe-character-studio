/**
 * The ONE shortcut authority of the editor.
 *
 * Every keyboard command the editor claims is declared here once, with its
 * gesture, its category and the scope it is live in. The global handler
 * (`hooks/useKeyboardShortcuts`), the shortcut reference UI
 * (`components/Shortcuts/ShortcutReferenceDialog`) and the command strip's
 * hints all read this table, so a binding cannot exist in one place and be
 * documented in another.
 *
 * ── Gesture grammar ────────────────────────────────────────────────────────
 * A gesture is `modifier+…+key`:
 *   - `mod`   — Ctrl on Windows/Linux, Cmd on macOS (one token, both platforms)
 *   - `shift` — Shift
 *   - `alt`   — Alt/Option
 *   - the key is `KeyboardEvent.key` case-folded, with the names `space`,
 *     `escape`, `delete`, `backspace`, `enter` and `plus` for the keys whose
 *     own character is a separator or invisible.
 *
 * ── Normalization and the collision audit (round four, part four) ──────────
 * What the editor claimed BEFORE this round (audited from the live handlers:
 * `App.tsx`, `useKeyboardShortcuts`, `useFreeformDraw`, the timeline marquee and
 * lane, the context menu, the dialogs and every focused control):
 *
 * | Gesture        | Owner before                        | Verdict                                    |
 * |----------------|-------------------------------------|--------------------------------------------|
 * | `space`        | `App.tsx` play/pause                | kept (see the non-adoption note below)      |
 * | `v` / `h`      | global: select / pan tool           | kept                                       |
 * | `plus` `=` `-` | global: camera zoom step            | kept                                       |
 * | `mod+z`        | global: undo                        | kept                                       |
 * | `mod+shift+z`  | global: redo                        | kept                                       |
 * | `mod+y`        | global: redo                        | kept (Windows habit, no conflict)          |
 * | `mod+c/v/d`    | global: copy / paste / duplicate     | kept                                       |
 * | `delete`/`backspace` | global: keyframes, else layer | kept, and now scoped (see below)           |
 * | `escape`       | global: cancel armed gesture        | kept, extended into one priority chain      |
 * | `enter`        | freeform draw: commit a path        | kept (owned by the drawing tool)           |
 * | `escape`       | timeline marquee: cancel the drag   | kept (the gesture owns Escape while active) |
 * | `arrowleft/right` | timeline lane: walk keyframe focus | kept (focused element, timeline scope) |
 * | `enter`/`space` | timeline diamond: select keyframe  | kept (focused element, timeline scope)     |
 * | `shift+f10` / context-menu key | layer context menu   | kept                                       |
 * | `tab`/`shift+tab`, `escape` | dialogs: trap / dismiss | kept (dialogs own their keys)          |
 *
 * NO DESTRUCTIVE COLLISION existed in that set: no two live bindings produced
 * the same command for the same gesture, and no plain letter was claimed by two
 * owners. The one genuine collision was a SCOPE collision rather than a gesture
 * one — `delete` reached the layer-delete path while the pointer was on the
 * timeline — and it is resolved below.
 *
 * Added by this round (all free, all non-destructive):
 * `mod+a` select all, `mod+g` group, `mod+shift+g` ungroup, `?` shortcut
 * reference, `r` rectangle, `o` circle, `t` text, `p` pen.
 *
 * ── Round five: the vector transform quartet ───────────────────────────────
 * The toolbar's new authoring commands (align, distribute, rotate, flip) all end
 * up in `utils/vectorArrange`; four of them also get a key, because they are
 * atomic one-shot commands a user repeats:
 *
 * | Gesture                 | Command              | Why this gesture                |
 * |-------------------------|----------------------|---------------------------------|
 * | `mod+shift+arrowleft`   | Rotate 90° CCW       | an arrow points the way it turns |
 * | `mod+shift+arrowright`  | Rotate 90° CW        | the mirrored arrow               |
 * | `shift+h`               | Flip horizontal      | H is the axis, and Shift is the "transform" layer over the plain tool letters |
 * | `shift+v`               | Flip vertical        | V is the axis                    |
 *
 * The two flip bindings are deliberately the SHIFTED TOOL LETTERS: plain
 * `v`/`h` still pick the Select/Pan tool, and modifiers are matched exactly, so
 * `Ctrl+Shift+V` (paste as plain text elsewhere) is never this editor's flip.
 * The rotate pair carries `mod` so it can never be confused with the timeline's
 * plain arrow walking, and no binding in this table is a prefix of another.
 *
 * ── C8: arrow-key nudge ─────────────────────────────────────────────────────
 * Plain arrows move the selected layers 1 project unit, Shift+arrows 10, through
 * the arrange authority (`beginNudge`: world offset in, the one keyframe-aware
 * transform write out). A held key is one undo step. The arrows nudge only while
 * the canvas owns the keyboard: the layer list, the timeline, the mask editor
 * and arrow-driven widgets (toolbars, tabs, menus) keep their own arrows.
 *
 * Deliberately NOT adopted:
 *   - A temporary "suspend snapping" modifier for the translate drag. The snap
 *     radius and the toggle are enough, and every candidate modifier is already
 *     spoken for or dangerous: `mod` (Ctrl/Cmd) is the editor's "do not start a
 *     drag" gesture (the stage's pointer-down bails on it), `shift` is the
 *     scale-lock modifier the corner/edge resize reads, `alt` is claimed by the
 *     OS and the browser (Alt-drag starts a window move on Windows and a link
 *     download on the web), and a bare letter is not readable while a pointer
 *     gesture owns the keyboard. Snapping is therefore a toggle, not a hold:
 *     the View band's magnet control (`Toggle snapping`) is the one switch, and
 *     it is a UI control rather than a keymap entry, so this table keeps its
 *     "one gesture, one command" invariant.
 *   - A key for Align (six edges) and Distribute (two axes). Both are
 *     multi-item commands whose target depends on the measurable selection — an
 *     align of two layers and a distribute of three are different commands with
 *     the same intent — so a single letter would have to guess. They live in the
 *     authoring toolbar, where the choices are named, and are deliberately
 *     absent from this reference rather than documented with a fake key.
 *   - `space` hold = temporary pan. Space is this editor's play/pause toggle
 *     (and the browser's own activation key for a focused button), so a
 *     hold-to-pan would either fire playback on every pan or need a delay
 *     heuristic that makes playback feel broken. Pan keeps its own `h` tool.
 *  *   - `shift+1` fit stage and `shift+2` zoom to selection. The camera authority
 *     exposes a zoom STEP and a re-centre that keeps the zoom; it has no fit
 *     math, and inventing one would change the camera-invariance contract the
 *     stage's fit is built on.
 *   - `escape` clearing the LAYER selection. Non-modal surfaces (the colour
 *     picker, the in/out preset popovers, the tangent overlay, the drawing tool)
 *     own Escape while they are open, so a global deselect would also fire
 *     behind them. Clicking empty stage space is the editor's deselect gesture,
 *     and the reference UI says so.
 *   - `mod+x` cut. The editor's Cut is the context menu's copy + a delete that
 *     DISSOLVES a selected Boolean group; the global Delete path does not know
 *     that authority, so a global `mod+x` would either duplicate it or behave
 *     differently from the menu's own Cut.
 */

export type ShortcutPlatform = 'mac' | 'other';

/**
 * The reference UI's bands, in the order a reader walks the editor: what the
 * pointer does, what it creates, how it arranges what is selected, the timeline,
 * grouping, the view, and the general commands.
 */
export type ShortcutCategory = 'selection' | 'create' | 'transform' | 'layers' | 'timeline' | 'grouping' | 'view' | 'general';

/**
 * Where a binding is live. `global` commands run anywhere the editor owns the
 * keyboard; `canvas` commands belong to the stage; `timeline` commands are owned
 * by the timeline's own focused controls.
 */
export type ShortcutScope = 'global' | 'canvas' | 'timeline' | 'layers' | 'drawing' | 'mask-edit';

export type ShortcutCommandId =
  | 'tool-select' | 'tool-pan'
  | 'create-rectangle' | 'create-circle' | 'create-text' | 'tool-pen'
  | 'select-all' | 'group-layers' | 'ungroup-layers'
  | 'rotate-ccw' | 'rotate-cw' | 'flip-horizontal' | 'flip-vertical' | 'nudge-selection'
  | 'undo' | 'redo' | 'copy' | 'paste' | 'duplicate' | 'delete-selection' | 'cancel-gesture' | 'context-menu'
  | 'keyframe-select' | 'keyframe-walk' | 'marquee-cancel'
  | 'play-pause' | 'zoom-in' | 'zoom-out'
  | 'mask-point-next' | 'mask-point-previous' | 'mask-point-nudge' | 'mask-point-ends' | 'mask-point-type' | 'mask-point-focus'
  | 'draw-finish' | 'draw-undo-point' | 'draw-discard'
  | 'layer-walk' | 'layer-expand' | 'layer-select' | 'layer-rename' | 'layer-move-up' | 'layer-move-down' | 'layer-nest' | 'layer-unparent'
  | 'lock-layers' | 'unlock-all-layers'
  | 'shortcut-reference';

interface ShortcutCommand {
  id: ShortcutCommandId;
  /** Human label used by the reference UI (and only there). */
  label: string;
  category: ShortcutCategory;
  /** The gestures that trigger it, in display order. Never shared within a scope. */
  gestures: string[];
  scope: ShortcutScope;
  /** One line about what the command does where it is not self-evident. */
  detail?: string;
}

export const SHORTCUT_CATEGORY_LABELS: Record<ShortcutCategory, string> = {
  selection: 'Selection and navigation',
  create: 'Creation',
  transform: 'Transform and arrange',
  layers: 'Layer list',
  timeline: 'Timeline',
  grouping: 'Grouping and Boolean',
  view: 'View',
  general: 'General',
};

/** The reference UI's band order. */
export const SHORTCUT_CATEGORY_ORDER: ShortcutCategory[] = ['selection', 'create', 'transform', 'layers', 'grouping', 'timeline', 'view', 'general'];

export const SHORTCUT_COMMANDS: ShortcutCommand[] = [
  { id: 'tool-select', label: 'Select tool', category: 'selection', gestures: ['v'], scope: 'global' },
  { id: 'tool-pan', label: 'Pan tool', category: 'selection', gestures: ['h'], scope: 'global' },
  { id: 'select-all', label: 'Select all layers', category: 'selection', gestures: ['mod+a'], scope: 'global' },

  { id: 'create-rectangle', label: 'Rectangle', category: 'create', gestures: ['r'], scope: 'global', detail: 'Then drag on the stage to place it.' },
  { id: 'create-circle', label: 'Circle', category: 'create', gestures: ['o'], scope: 'global', detail: 'Then drag on the stage to place it.' },
  { id: 'create-text', label: 'Text layer', category: 'create', gestures: ['t'], scope: 'global' },
  { id: 'tool-pen', label: 'Pen / freeform draw', category: 'create', gestures: ['p'], scope: 'global', detail: 'Enter commits the path, Esc cancels it.' },

  {
    id: 'rotate-ccw',
    label: 'Rotate 90° counter-clockwise',
    category: 'transform',
    gestures: ['mod+shift+arrowleft'],
    scope: 'global',
    detail: 'Pivots on the selection centre, so the whole selection turns as one body.',
  },
  {
    id: 'rotate-cw',
    label: 'Rotate 90° clockwise',
    category: 'transform',
    gestures: ['mod+shift+arrowright'],
    scope: 'global',
    detail: 'Pivots on the selection centre, so the whole selection turns as one body.',
  },
  {
    id: 'flip-horizontal',
    label: 'Flip horizontal',
    category: 'transform',
    gestures: ['shift+h'],
    scope: 'global',
    detail: 'Mirrors about the selection centre; a layer stays exactly where it was on screen.',
  },
  {
    id: 'flip-vertical',
    label: 'Flip vertical',
    category: 'transform',
    gestures: ['shift+v'],
    scope: 'global',
    detail: 'Mirrors about the selection centre; a layer stays exactly where it was on screen.',
  },

  {
    id: 'nudge-selection',
    label: 'Nudge the selected layers',
    category: 'transform',
    gestures: ['arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'shift+arrowleft', 'shift+arrowright', 'shift+arrowup', 'shift+arrowdown'],
    scope: 'canvas',
    detail: '1 unit, Shift 10. A held key is one undo step. An already animated position is keyed at the current frame.',
  },

  // C2 — owned by the drawing tools while a Pen / Mask Pen draft is open, and
  // by the canvas mask editor; listed here so the reference shows them. They
  // are dispatched by their owners, never by the global handler.
  { id: 'draw-finish', label: 'Finish the drawing', category: 'create', gestures: ['enter'], scope: 'drawing', detail: 'Also: click the first point, double-click, or the banner Finish button.' },
  { id: 'draw-undo-point', label: 'Undo / redo the last point', category: 'create', gestures: ['mod+z', 'mod+shift+z'], scope: 'drawing', detail: 'While drawing, Undo steps through the drawing only — never a finished shape. Backspace also removes the last Mask Pen point.' },
  { id: 'draw-discard', label: 'Discard the drawing', category: 'create', gestures: ['escape'], scope: 'drawing', detail: 'A second Escape leaves the tool.' },
  { id: 'mask-point-next', label: 'Select the next mask point', category: 'transform', gestures: [']'], scope: 'mask-edit', detail: 'While a mask is edited on the canvas.' },
  { id: 'mask-point-previous', label: 'Select the previous mask point', category: 'transform', gestures: ['['], scope: 'mask-edit', detail: 'While a mask is edited on the canvas.' },
  // C4 — the canvas point list is one Tab stop; these keys act on the FOCUSED point.
  { id: 'mask-point-focus', label: 'Move keyboard focus into / out of the mask points', category: 'transform', gestures: ['tab', 'shift+tab'], scope: 'mask-edit', detail: 'The points are one Tab stop; focus follows the selected point. Tab again leaves them.' },
  { id: 'mask-point-ends', label: 'Go to the first / last mask point', category: 'transform', gestures: ['home', 'end'], scope: 'mask-edit', detail: 'With a mask point focused.' },
  { id: 'mask-point-type', label: 'Switch the selected point between Corner and Smooth', category: 'transform', gestures: ['c'], scope: 'mask-edit', detail: 'Mask and path points. A double-click on the point does the same (again: the handles retract); Alt-drag a handle to break the two handles apart or link them again, Alt-drag a point to pull out new handles. One undo step.' },
  { id: 'mask-point-nudge', label: 'Nudge the selected mask point', category: 'transform', gestures: ['arrowleft', 'arrowright', 'arrowup', 'arrowdown'], scope: 'mask-edit', detail: 'Shift moves 10 units. With no point selected the whole path moves. A held key is one undo step.' },

  // C2-E — owned by the focused layer tree (its rows are focusable treeitems).
  { id: 'layer-walk', label: 'Move focus through the layer list', category: 'layers', gestures: ['arrowup', 'arrowdown'], scope: 'layers', detail: 'Home and End jump to the first and last row.' },
  { id: 'layer-expand', label: 'Expand / collapse a parent row', category: 'layers', gestures: ['arrowright', 'arrowleft'], scope: 'layers', detail: 'On a collapsed row → expands; on a child → moves focus to its parent.' },
  { id: 'layer-select', label: 'Select the focused layer', category: 'layers', gestures: ['enter'], scope: 'layers', detail: 'Ctrl/⌘ or Shift+Enter adds it to the selection.' },
  { id: 'layer-rename', label: 'Rename the focused layer or group', category: 'layers', gestures: ['f2'], scope: 'layers', detail: 'Also double-click the name. Enter saves, Esc cancels.' },
  { id: 'layer-move-up', label: 'Move the layer up among its siblings', category: 'layers', gestures: ['alt+arrowup'], scope: 'layers' },
  { id: 'layer-move-down', label: 'Move the layer down among its siblings', category: 'layers', gestures: ['alt+arrowdown'], scope: 'layers' },
  { id: 'layer-nest', label: 'Nest into the layer above (set parent)', category: 'layers', gestures: ['alt+arrowright'], scope: 'layers', detail: 'Keeps the layer where it is on screen. Refused, with the reason, when an animated layer is involved.' },
  { id: 'layer-unparent', label: 'Unparent (move out one level)', category: 'layers', gestures: ['alt+arrowleft'], scope: 'layers', detail: 'Keeps the layer where it is on screen.' },

  // C4 — the After Effects pair (Layer > Switches > Lock / Unlock All Layers).
  { id: 'lock-layers', label: 'Lock / unlock the selected layers', category: 'layers', gestures: ['mod+l'], scope: 'global', detail: 'Locks every selected layer; when all of them are locked already, unlocks them. A locked layer stays visible and animated but cannot be changed.' },
  { id: 'unlock-all-layers', label: 'Unlock all layers', category: 'layers', gestures: ['mod+shift+l'], scope: 'global' },

  { id: 'group-layers', label: 'Group selected layers', category: 'grouping', gestures: ['mod+g'], scope: 'global' },
  { id: 'ungroup-layers', label: 'Ungroup selected layer', category: 'grouping', gestures: ['mod+shift+g'], scope: 'global' },

  { id: 'keyframe-select', label: 'Select the focused keyframe', category: 'timeline', gestures: ['enter', 'space'], scope: 'timeline', detail: 'With a keyframe diamond focused: selects it and moves the playhead to it.' },
  { id: 'keyframe-walk', label: 'Walk focus along the lane', category: 'timeline', gestures: ['arrowleft', 'arrowright'], scope: 'timeline', detail: 'With a keyframe diamond focused.' },
  { id: 'marquee-cancel', label: 'Cancel a timeline marquee', category: 'timeline', gestures: ['escape'], scope: 'timeline', detail: 'While a marquee drag is in flight it restores the selection it started from.' },

  { id: 'play-pause', label: 'Play / pause', category: 'view', gestures: ['space'], scope: 'global' },
  { id: 'zoom-in', label: 'Zoom in', category: 'view', gestures: ['plus', '='], scope: 'canvas' },
  { id: 'zoom-out', label: 'Zoom out', category: 'view', gestures: ['-'], scope: 'canvas' },

  { id: 'undo', label: 'Undo', category: 'general', gestures: ['mod+z'], scope: 'global' },
  { id: 'redo', label: 'Redo', category: 'general', gestures: ['mod+shift+z', 'mod+y'], scope: 'global' },
  { id: 'copy', label: 'Copy selected layer', category: 'general', gestures: ['mod+c'], scope: 'global' },
  { id: 'paste', label: 'Paste layer', category: 'general', gestures: ['mod+v'], scope: 'global' },
  { id: 'duplicate', label: 'Duplicate selected layer', category: 'general', gestures: ['mod+d'], scope: 'global' },
  {
    id: 'delete-selection',
    label: 'Delete keyframes, else the layer',
    category: 'general',
    gestures: ['delete', 'backspace'],
    scope: 'global',
    detail: 'While the timeline owns focus only keyframes are deleted, so a layer cannot be removed from there by accident. While a mask is edited on the canvas the layer is never deleted.',
  },
  {
    id: 'cancel-gesture',
    label: 'Cancel, step out, deselect keyframes',
    category: 'general',
    gestures: ['escape'],
    scope: 'global',
    detail: 'In priority order: cancel the armed gesture, cancel a canvas mask drag or leave mask editing, leave the Boolean operand edit, leave a grouped child for its container, then clear the timeline keyframe selection. Clicking empty stage space clears the layer selection.',
  },
  { id: 'context-menu', label: 'Layer context menu', category: 'general', gestures: ['shift+f10', 'contextmenu'], scope: 'global' },
  { id: 'shortcut-reference', label: 'Keyboard shortcut reference', category: 'general', gestures: ['?'], scope: 'global' },
];

/** The DOM attribute a surface carries to declare that it owns a shortcut scope. */
export const SHORTCUT_SCOPE_ATTRIBUTE = 'data-shortcut-scope';

export interface KeyboardLike {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}

const MODIFIER_LABELS: Record<ShortcutPlatform, { mod: string; shift: string; alt: string; join: string }> = {
  mac: { mod: '⌘', shift: '⇧', alt: '⌥', join: '' },
  other: { mod: 'Ctrl', shift: 'Shift', alt: 'Alt', join: '+' },
};

const KEY_LABELS: Record<string, string> = {
  space: 'Space',
  escape: 'Esc',
  delete: 'Delete',
  backspace: 'Backspace',
  enter: 'Enter',
  arrowleft: '←',
  arrowright: '→',
  arrowup: '↑',
  arrowdown: '↓',
  plus: '+',
  contextmenu: 'Menu key',
  f10: 'F10',
  f2: 'F2',
  home: 'Home',
  end: 'End',
};

const SHIFT_IMPLICIT_KEYS = ['?', 'plus'];

/** `KeyboardEvent.key` folded onto the grammar's key names. */
export const normalizeShortcutKey = (key: string): string => {
  if (key === ' ') return 'space';
  if (key === '+') return 'plus';
  const lower = key.toLowerCase();
  if (lower === 'esc') return 'escape';
  if (lower === 'del') return 'delete';
  return lower;
};

/** macOS is the only platform whose primary modifier is Cmd rather than Ctrl. */
export const detectShortcutPlatform = (
  nav: { platform?: string; userAgent?: string } | undefined = typeof navigator === 'undefined' ? undefined : navigator,
): ShortcutPlatform => {
  const source = `${nav?.platform ?? ''} ${nav?.userAgent ?? ''}`.toLowerCase();
  return source.includes('mac') ? 'mac' : 'other';
};

/**
 * True when one gesture fired. Modifiers are matched EXACTLY, so `g` never
 * fires for `mod+g` and `mod+g` never fires for `mod+shift+g`. A key whose own
 * character implies Shift (`?`, `+`) ignores the shift state instead of
 * demanding it, which is what keeps the same binding working on layouts where
 * that character sits somewhere else.
 */
export const matchesShortcutGesture = (
  event: KeyboardLike,
  gesture: string,
  platform: ShortcutPlatform,
): boolean => {
  const parts = gesture.split('+');
  const key = parts[parts.length - 1];
  const modifiers = parts.slice(0, -1);
  const wantsMod = modifiers.includes('mod');
  const wantsShift = modifiers.includes('shift');
  const wantsAlt = modifiers.includes('alt');
  const primaryModifier = platform === 'mac' ? event.metaKey : event.ctrlKey;
  const otherModifier = platform === 'mac' ? event.ctrlKey : event.metaKey;
  if (wantsMod ? !primaryModifier : (primaryModifier || otherModifier)) return false;
  if (wantsAlt !== event.altKey) return false;
  if (!SHIFT_IMPLICIT_KEYS.includes(key) && wantsShift !== event.shiftKey) return false;
  return normalizeShortcutKey(event.key) === key;
};

/**
 * The command a keyboard event fires, or `null`.
 *
 * `scopes` decides which surfaces are being resolved. The default is the two
 * that are dispatched from the editor's global handler; `timeline` is excluded
 * on purpose, because those bindings belong to the timeline's own focused
 * controls (they are declared here so the reference UI can list them, not so a
 * global listener can duplicate them).
 *
 * Commands are resolved in table order, and the table never gives one gesture to
 * two commands in the same scope (a unit test pins that), so the order only
 * decides which of two DIFFERENT gestures wins when an event matches both.
 */
const GLOBALLY_DISPATCHED_SCOPES: ShortcutScope[] = ['global', 'canvas'];

export const resolveShortcutCommand = (
  event: KeyboardLike,
  platform: ShortcutPlatform,
  scopes: ShortcutScope[] = GLOBALLY_DISPATCHED_SCOPES,
): ShortcutCommand | null => {
  for (const command of SHORTCUT_COMMANDS) {
    if (!scopes.includes(command.scope)) continue;
    if (command.gestures.some((gesture) => matchesShortcutGesture(event, gesture, platform))) return command;
  }
  return null;
};

export const findShortcutCommand = (id: ShortcutCommandId): ShortcutCommand => {
  const command = SHORTCUT_COMMANDS.find((candidate) => candidate.id === id);
  if (!command) throw new Error(`Unknown shortcut command "${id}".`);
  return command;
};

const keyLabel = (key: string): string => KEY_LABELS[key] ?? key.toUpperCase();

/** `mod+shift+g` → `Ctrl+Shift+G` on Windows/Linux and `⇧⌘G` on macOS. */
export const formatShortcutGesture = (gesture: string, platform: ShortcutPlatform): string => {
  const labels = MODIFIER_LABELS[platform];
  const parts = gesture.split('+');
  const key = parts[parts.length - 1];
  const modifiers = parts.slice(0, -1);
  const modifierLabels = modifiers.map((modifier) => (
    modifier === 'mod' ? labels.mod : modifier === 'shift' ? labels.shift : labels.alt
  ));
  // macOS writes the modifiers in the order ⇧⌥⌘, unseparated, before the key.
  const ordered = platform === 'mac' ? modifierLabels.slice().reverse() : modifierLabels;
  return [...ordered, keyLabel(key)].join(labels.join);
};

/** Every gesture of a command, platform-formatted and `/`-joined. */
export const formatShortcutCommand = (id: ShortcutCommandId, platform: ShortcutPlatform): string =>
  findShortcutCommand(id).gestures.map((gesture) => formatShortcutGesture(gesture, platform)).join(' / ');

/**
 * The FIRST gesture of a command, for the places that show one hint beside an
 * action (a menu row, a tooltip): those read badly with every alias.
 */
export const formatShortcutHint = (id: ShortcutCommandId, platform: ShortcutPlatform): string =>
  formatShortcutGesture(findShortcutCommand(id).gestures[0], platform);

/**
 * The `KeyboardEvent.key` spelling of a grammar key. `aria-keyshortcuts` is
 * expressed in that vocabulary, so an arrow is `ArrowLeft`, never `Arrowleft`,
 * and a modifier name is spelled out (`Control`, `Meta`).
 */
const ARIA_KEY_NAMES: Record<string, string> = {
  arrowleft: 'ArrowLeft',
  arrowright: 'ArrowRight',
  arrowup: 'ArrowUp',
  arrowdown: 'ArrowDown',
  escape: 'Escape',
  delete: 'Delete',
  backspace: 'Backspace',
  enter: 'Enter',
  space: 'Space',
  contextmenu: 'ContextMenu',
  plus: '+',
};

/**
 * The same binding in the WAI-ARIA `aria-keyshortcuts` syntax (`Control+G`,
 * `Meta+G`, `Control+Shift+ArrowRight`), for controls that advertise the key
 * they run.
 */
export const ariaKeyshortcuts = (id: ShortcutCommandId, platform: ShortcutPlatform): string =>
  findShortcutCommand(id).gestures.map((gesture) => {
    const parts = gesture.split('+');
    const key = parts[parts.length - 1];
    const modifiers = parts.slice(0, -1).map((modifier) => (
      modifier === 'mod' ? (platform === 'mac' ? 'Meta' : 'Control') : modifier === 'shift' ? 'Shift' : 'Alt'
    ));
    const ariaKey = ARIA_KEY_NAMES[key] ?? (key.length === 1 ? key.toUpperCase() : `${key[0].toUpperCase()}${key.slice(1)}`);
    return [...modifiers, ariaKey].join('+');
  }).join(' ');
