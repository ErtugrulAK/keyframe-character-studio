import { describe, expect, it } from 'vitest';
import {
  ariaKeyshortcuts,
  detectShortcutPlatform,
  findShortcutCommand,
  formatShortcutCommand,
  formatShortcutGesture,
  formatShortcutHint,
  matchesShortcutGesture,
  normalizeShortcutKey,
  resolveShortcutCommand,
  SHORTCUT_COMMANDS,
  type KeyboardLike,
  type ShortcutScope,
} from '../utils/shortcuts';

const press = (key: string, init: Partial<KeyboardLike> = {}): KeyboardLike => ({
  key,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  shiftKey: false,
  ...init,
});

describe('shortcut keymap', () => {
  it('gives no gesture to two commands in the same scope', () => {
    const scopes: ShortcutScope[] = ['global', 'canvas', 'timeline', 'layers', 'drawing', 'mask-edit'];
    const conflicts: string[] = [];
    for (const scope of scopes) {
      const owner = new Map<string, string>();
      for (const command of SHORTCUT_COMMANDS.filter((candidate) => candidate.scope === scope)) {
        for (const gesture of command.gestures) {
          const previous = owner.get(gesture);
          if (previous) conflicts.push(`${scope}: ${gesture} is claimed by ${previous} and ${command.id}`);
          else owner.set(gesture, command.id);
        }
      }
    }
    // The marquee cancel and the gesture-cancel chain both answer to Escape, but
    // in DIFFERENT scopes: the marquee owns it while a drag is in flight.
    expect(conflicts).toEqual([]);
    const escapeOwners = SHORTCUT_COMMANDS.filter((command) => command.gestures.includes('escape')).map((command) => command.id);
    expect([...escapeOwners].sort()).toEqual(['cancel-gesture', 'draw-discard', 'marquee-cancel']);
  });

  it('C2: a local scope overrides a global gesture only where that is the documented ownership', () => {
    // While a drawing draft is open it owns Escape and Undo/Redo (draft history);
    // the layer list and the mask editor own the arrows (below). Nothing else
    // shadows a global binding.
    const globals = new Map<string, string>();
    SHORTCUT_COMMANDS.filter((command) => command.scope === 'global' || command.scope === 'canvas')
      .forEach((command) => command.gestures.forEach((gesture) => globals.set(gesture, command.id)));
    const overrides = SHORTCUT_COMMANDS
      .filter((command) => !['global', 'canvas', 'timeline'].includes(command.scope))
      .flatMap((command) => command.gestures.filter((gesture) => globals.has(gesture)).map((gesture) => `${command.scope}: ${gesture} (${command.id} over ${globals.get(gesture)})`));
    // C8: the focused layer list walks its rows and the canvas mask editor
    // nudges its points with the arrows, instead of nudging the layer.
    expect(overrides.sort()).toEqual([
      'drawing: escape (draw-discard over cancel-gesture)',
      'drawing: mod+shift+z (draw-undo-point over redo)',
      'drawing: mod+z (draw-undo-point over undo)',
      'layers: arrowdown (layer-walk over nudge-selection)',
      'layers: arrowleft (layer-expand over nudge-selection)',
      'layers: arrowright (layer-expand over nudge-selection)',
      'layers: arrowup (layer-walk over nudge-selection)',
      'mask-edit: arrowdown (mask-point-nudge over nudge-selection)',
      'mask-edit: arrowleft (mask-point-nudge over nudge-selection)',
      'mask-edit: arrowright (mask-point-nudge over nudge-selection)',
      'mask-edit: arrowup (mask-point-nudge over nudge-selection)',
    ]);
  });

  it('keeps every gesture inside the declared grammar', () => {
    const modifiers = ['mod', 'shift', 'alt'];
    for (const command of SHORTCUT_COMMANDS) {
      expect(command.gestures.length, command.id).toBeGreaterThan(0);
      for (const gesture of command.gestures) {
        const parts = gesture.split('+');
        const key = parts[parts.length - 1];
        expect(key.length, `${command.id}:${gesture}`).toBeGreaterThan(0);
        expect(parts.slice(0, -1).every((part) => modifiers.includes(part)), `${command.id}:${gesture}`).toBe(true);
        // A key token must be the normalized form of itself, so a binding written
        // as `Escape` or `+` could never silently never match.
        expect(normalizeShortcutKey(key), `${command.id}:${gesture}`).toBe(key);
      }
    }
  });

  it('matches modifiers exactly and folds the shifted characters', () => {
    expect(matchesShortcutGesture(press('z', { ctrlKey: true }), 'mod+z', 'other')).toBe(true);
    expect(matchesShortcutGesture(press('z', { metaKey: true }), 'mod+z', 'mac')).toBe(true);
    expect(matchesShortcutGesture(press('z', { metaKey: true }), 'mod+z', 'other')).toBe(false);
    expect(matchesShortcutGesture(press('z', { ctrlKey: true, shiftKey: true }), 'mod+z', 'other')).toBe(false);
    expect(matchesShortcutGesture(press('Z', { ctrlKey: true, shiftKey: true }), 'mod+shift+z', 'other')).toBe(true);
    // A different key never fires, even with the right modifiers.
    expect(matchesShortcutGesture(press('g', {}), 'mod+g', 'other')).toBe(false);
    // `?` and `+` imply Shift on most layouts: their own character decides.
    expect(matchesShortcutGesture(press('?', { shiftKey: true }), '?', 'other')).toBe(true);
    expect(matchesShortcutGesture(press('?', {}), '?', 'other')).toBe(true);
    expect(matchesShortcutGesture(press('+', { shiftKey: true }), 'plus', 'other')).toBe(true);
    expect(matchesShortcutGesture(press('+', {}), 'plus', 'other')).toBe(true);
    // The space bar arrives as ' ' and the context-menu key as 'ContextMenu'.
    expect(matchesShortcutGesture(press(' '), 'space', 'other')).toBe(true);
    expect(matchesShortcutGesture(press('ContextMenu'), 'contextmenu', 'other')).toBe(true);
    expect(matchesShortcutGesture(press('Esc'), 'escape', 'other')).toBe(true);
  });

  it('resolves an event to the command the table declares', () => {
    expect(resolveShortcutCommand(press('a', { ctrlKey: true }), 'other')?.id).toBe('select-all');
    expect(resolveShortcutCommand(press('g', { ctrlKey: true }), 'other')?.id).toBe('group-layers');
    expect(resolveShortcutCommand(press('g', { ctrlKey: true, shiftKey: true }), 'other')?.id).toBe('ungroup-layers');
    expect(resolveShortcutCommand(press('r'), 'other')?.id).toBe('create-rectangle');
    expect(resolveShortcutCommand(press('?', { shiftKey: true }), 'other')?.id).toBe('shortcut-reference');
    expect(resolveShortcutCommand(press('y', { ctrlKey: true }), 'other')?.id).toBe('redo');
    expect(resolveShortcutCommand(press('Delete'), 'other')?.id).toBe('delete-selection');
    // An unbound key resolves to nothing rather than to the nearest command.
    expect(resolveShortcutCommand(press('q'), 'other')).toBeNull();
    expect(resolveShortcutCommand(press('g'), 'other')).toBeNull();
  });

  it('formats one gesture for each platform', () => {
    expect(formatShortcutGesture('mod+z', 'other')).toBe('Ctrl+Z');
    expect(formatShortcutGesture('mod+z', 'mac')).toBe('⌘Z');
    expect(formatShortcutGesture('mod+shift+g', 'other')).toBe('Ctrl+Shift+G');
    expect(formatShortcutGesture('mod+shift+g', 'mac')).toBe('⇧⌘G');
    expect(formatShortcutGesture('shift+f10', 'other')).toBe('Shift+F10');
    expect(formatShortcutGesture('delete', 'other')).toBe('Delete');
    expect(formatShortcutGesture('space', 'other')).toBe('Space');
    expect(formatShortcutGesture('escape', 'other')).toBe('Esc');
    expect(formatShortcutGesture('?', 'other')).toBe('?');
    expect(formatShortcutGesture('plus', 'other')).toBe('+');
    expect(formatShortcutGesture('arrowleft', 'other')).toBe('←');
  });

  it('lists every alias of a command, and the first one as the single hint', () => {
    expect(formatShortcutCommand('redo', 'other')).toBe('Ctrl+Shift+Z / Ctrl+Y');
    expect(formatShortcutHint('redo', 'other')).toBe('Ctrl+Shift+Z');
    expect(formatShortcutHint('delete-selection', 'other')).toBe('Delete');
    expect(formatShortcutHint('tool-pan', 'other')).toBe('H');
  });

  it('advertises the binding in the WAI-ARIA syntax a control can carry', () => {
    expect(ariaKeyshortcuts('group-layers', 'other')).toBe('Control+G');
    expect(ariaKeyshortcuts('group-layers', 'mac')).toBe('Meta+G');
    expect(ariaKeyshortcuts('ungroup-layers', 'other')).toBe('Control+Shift+G');
    expect(ariaKeyshortcuts('redo', 'other')).toBe('Control+Shift+Z Control+Y');
    // Arrow keys are spelled the way `KeyboardEvent.key` spells them.
    expect(ariaKeyshortcuts('rotate-cw', 'other')).toBe('Control+Shift+ArrowRight');
    expect(ariaKeyshortcuts('rotate-ccw', 'mac')).toBe('Meta+Shift+ArrowLeft');
    expect(ariaKeyshortcuts('flip-horizontal', 'other')).toBe('Shift+H');
    expect(ariaKeyshortcuts('tool-select', 'other')).toBe('V');
  });

  it('detects the platform from the navigator it is given', () => {
    expect(detectShortcutPlatform({ platform: 'MacIntel', userAgent: 'Mozilla/5.0 (Macintosh)' })).toBe('mac');
    expect(detectShortcutPlatform({ platform: 'Win32', userAgent: 'Mozilla/5.0 (Windows NT 10.0)' })).toBe('other');
    expect(detectShortcutPlatform({ platform: 'Linux x86_64', userAgent: 'Mozilla/5.0 (X11; Linux)' })).toBe('other');
    expect(detectShortcutPlatform(undefined)).toBe('other');
  });

  it('refuses a command id that is not in the table', () => {
    expect(() => findShortcutCommand('not-a-command' as never)).toThrow(/Unknown shortcut command/);
  });
});
