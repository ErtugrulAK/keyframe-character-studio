import React, { useEffect, useRef, useState } from 'react';
import { useAnimatorSlice } from '../../context/useAnimator';
import { useEditorContextMenu } from '../../context/editorContextMenu';
import { detectShortcutPlatform, formatShortcutHint, type ShortcutCommandId } from '../../utils/editor/shortcuts';
import { isConvertibleShapeType, shapeToPathBlockReason } from '../../utils/geometry/shapeToPath';
import { ProjectSettingsDialog } from './ProjectSettingsDialog';
import { useGraphicLibrary } from './useGraphicLibrary';
import './MenuBar.css';

interface MenuItem {
  id: string;
  label: string;
  shortcut?: string;
  disabled?: boolean;
  checked?: boolean;
  run: () => void;
}

/** A menu is item groups; a line separates the groups. */
interface Menu {
  id: string;
  label: string;
  groups: MenuItem[][];
}

/**
 * The editor's menu bar (File, Edit, Object, View, Help), as in Photopea and
 * Boxy SVG. It holds what the toolbar and the header do not: the graphic
 * library and project settings, the clipboard (Paste in Place, Paste
 * Animation), selection, layer state (lock, hide, front/back, mirrored
 * copies) and the panels. Every row runs a command that already exists, so
 * the menus add no second implementation.
 *
 * Mouse: click a title to open its menu; while one is open, hovering another
 * title switches to it. Keyboard: ArrowLeft/Right move between menus,
 * ArrowUp/Down between rows, Enter runs, Escape closes.
 */
export const MenuBar: React.FC = () => {
  const {
    undo, redo, canUndo, canRedo, copySelectedPart, pasteCopiedPart, duplicateSelectedPart, duplicateMirrored, clipboardData,
    pasteAnimationOntoSelected, selectedPartId, selectedPartIds, setSelectedPartId, setSelectedPartIds, characterParts, tracks,
    convertToEditablePath, resetSelectedTransforms, setLayersLocked, toggleTrackEditVisibility, openShortcutReference,
    reorderParts,
  } = useAnimatorSlice(
    'undo', 'redo', 'canUndo', 'canRedo', 'copySelectedPart', 'pasteCopiedPart', 'duplicateSelectedPart', 'duplicateMirrored', 'clipboardData',
    'pasteAnimationOntoSelected', 'selectedPartId', 'selectedPartIds', 'setSelectedPartId', 'setSelectedPartIds', 'characterParts', 'tracks',
    'convertToEditablePath', 'resetSelectedTransforms', 'setLayersLocked', 'toggleTrackEditVisibility', 'openShortcutReference',
    'reorderParts',
  );
  const { selectAll, deleteSelection } = useEditorContextMenu();
  const [openId, setOpenId] = useState<string | null>(null);
  const [activeRow, setActiveRow] = useState(0);
  const [projectSettingsOpen, setProjectSettingsOpen] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);
  const { openLibrary, dialog: libraryDialog } = useGraphicLibrary();

  const platform = detectShortcutPlatform();
  const hint = (id: ShortcutCommandId) => formatShortcutHint(id, platform);
  const primary = characterParts.find((part) => part.id === selectedPartId);
  const index = primary ? characterParts.indexOf(primary) : -1;
  const single = Boolean(primary) && selectedPartIds.length <= 1;
  const selection = selectedPartIds.length > 0 ? selectedPartIds : primary ? [primary.id] : [];
  const trackOf = (id: string) => tracks.find((track) => track.partId === id);
  const allLocked = selection.length > 0 && selection.every((id) => trackOf(id)?.locked);
  const primaryTrack = primary ? trackOf(primary.id) : undefined;
  // A basic shape, or a Boolean result (flattened into its own shape).
  const shapeToPathBlocked = primary?.booleanOperandIds?.length ? null : primary && isConvertibleShapeType(primary.type) ? shapeToPathBlockReason(primary, tracks) : 'Select a basic shape or a Boolean result';
  /** The docked panels keep their own toggles; the menu presses them. */
  const pressChrome = (selector: string) => document.querySelector<HTMLButtonElement>(selector)?.click();

  // One home per command: the menus hold only what no toolbar or header
  // control already offers. The toolbar keeps the tools, media, grouping,
  // Boolean, align, rotate/flip, crop and view controls; the header keeps new
  // template (+), Import, Export (JSON, OGraf, GIF, check), reset and the
  // Edit/Broadcast switch (QA 2026-11-13: the File menu repeated them all).
  const menus: Menu[] = [
    {
      id: 'file',
      label: 'File',
      groups: [
        [{ id: 'library', label: 'Library…', run: () => openLibrary() }],
        [{ id: 'project-settings', label: 'Project Settings…', run: () => setProjectSettingsOpen(true) }],
      ],
    },
    {
      id: 'edit',
      label: 'Edit',
      groups: [
        [
          { id: 'undo', label: 'Undo', shortcut: hint('undo'), disabled: !canUndo, run: undo },
          { id: 'redo', label: 'Redo', shortcut: hint('redo'), disabled: !canRedo, run: redo },
        ],
        [
          { id: 'cut', label: 'Cut', disabled: !single, run: () => { copySelectedPart(); deleteSelection(); } },
          { id: 'copy', label: 'Copy', shortcut: hint('copy'), disabled: !primary, run: copySelectedPart },
          { id: 'paste', label: 'Paste', shortcut: hint('paste'), disabled: !clipboardData, run: () => pasteCopiedPart() },
          { id: 'paste-in-place', label: 'Paste in Place', disabled: !clipboardData, run: () => pasteCopiedPart({ inPlace: true }) },
          { id: 'duplicate', label: 'Duplicate', shortcut: hint('duplicate'), disabled: !primary, run: duplicateSelectedPart },
          { id: 'delete', label: 'Delete', shortcut: hint('delete-selection'), disabled: !primary, run: deleteSelection },
        ],
        [
          { id: 'paste-animation', label: 'Paste Animation', disabled: !clipboardData || !primary || clipboardData.part.id === primary.id, run: () => { if (primary) pasteAnimationOntoSelected(primary.id); } },
        ],
        [
          { id: 'select-all', label: 'Select All', shortcut: hint('select-all'), disabled: characterParts.length === 0, run: selectAll },
          { id: 'deselect', label: 'Deselect', disabled: selection.length === 0, run: () => { setSelectedPartIds([]); setSelectedPartId(null); } },
        ],
      ],
    },
    {
      id: 'object',
      label: 'Object',
      groups: [
        [
          { id: 'shape-to-path', label: 'Shape to Path', disabled: Boolean(shapeToPathBlocked) || !single, run: () => { if (primary) convertToEditablePath(primary.id); } },
          { id: 'reset-transform', label: 'Reset Transform', disabled: !primary, run: resetSelectedTransforms },
        ],
        [
          { id: 'mirror-x', label: 'Duplicate Mirrored (Left / Right)', disabled: !single, run: () => duplicateMirrored('y') },
          { id: 'mirror-y', label: 'Duplicate Mirrored (Up / Down)', disabled: !single, run: () => duplicateMirrored('x') },
        ],
        [
          { id: 'bring-to-front', label: 'Bring to Front', disabled: !single || index <= 0, run: () => reorderParts(index, 0) },
          { id: 'send-to-back', label: 'Send to Back', disabled: !single || index < 0 || index >= characterParts.length - 1, run: () => reorderParts(index, characterParts.length - 1) },
        ],
        [
          { id: 'lock', label: allLocked ? 'Unlock' : 'Lock', shortcut: hint('lock-layers'), disabled: selection.length === 0, run: () => setLayersLocked(selection, !allLocked) },
          { id: 'unlock-all', label: 'Unlock All', shortcut: hint('unlock-all-layers'), disabled: !tracks.some((track) => track.locked), run: () => setLayersLocked(characterParts.map((part) => part.id), false) },
          { id: 'hide', label: primaryTrack?.editVisible === false ? 'Show on Stage' : 'Hide on Stage', disabled: !single || !primaryTrack, run: () => { if (primaryTrack) toggleTrackEditVisibility(primaryTrack.id); } },
        ],
      ],
    },
    {
      id: 'view',
      label: 'View',
      groups: [
        [
          { id: 'inspector', label: 'Show / Hide Inspector', run: () => pressChrome('.inspector-dock-toggle') },
          { id: 'timeline', label: 'Show / Hide Timeline', run: () => pressChrome('[data-testid="timeline-collapse-toggle"]') },
        ],
      ],
    },
    {
      id: 'help',
      label: 'Help',
      groups: [[{ id: 'shortcuts', label: 'Keyboard Shortcuts', shortcut: hint('shortcut-reference'), run: openShortcutReference }]],
    },
  ];

  const openMenu = menus.find((menu) => menu.id === openId);
  const rows = openMenu ? openMenu.groups.flat() : [];

  useEffect(() => {
    if (!openId) return undefined;
    const onOutside = (event: PointerEvent) => {
      if (!barRef.current?.contains(event.target as Node)) setOpenId(null);
    };
    window.addEventListener('pointerdown', onOutside, true);
    return () => window.removeEventListener('pointerdown', onOutside, true);
  }, [openId]);

  const open = (id: string) => {
    setOpenId(id);
    setActiveRow(0);
  };
  const runRow = (item: MenuItem) => {
    if (item.disabled) return;
    setOpenId(null);
    item.run();
  };
  const onKeyDown = (event: React.KeyboardEvent) => {
    const at = menus.findIndex((menu) => menu.id === openId);
    if (event.key === 'Escape' && openId) {
      event.preventDefault();
      setOpenId(null);
    } else if ((event.key === 'ArrowRight' || event.key === 'ArrowLeft') && openId) {
      event.preventDefault();
      const next = (at + (event.key === 'ArrowRight' ? 1 : menus.length - 1)) % menus.length;
      open(menus[next].id);
    } else if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && openId && rows.length > 0) {
      event.preventDefault();
      setActiveRow((row) => (row + (event.key === 'ArrowDown' ? 1 : rows.length - 1)) % rows.length);
    } else if (event.key === 'Enter' && openId && rows[activeRow]) {
      event.preventDefault();
      runRow(rows[activeRow]);
    }
  };

  return (
    <div className="menu-bar" role="menubar" aria-label="Editor menu" ref={barRef} onKeyDown={onKeyDown}>
      {menus.map((menu) => (
        <div key={menu.id} className="menu-bar-entry">
          <button
            type="button"
            role="menuitem"
            aria-haspopup="menu"
            aria-expanded={openId === menu.id}
            className={`menu-bar-title${openId === menu.id ? ' open' : ''}`}
            onClick={() => (openId === menu.id ? setOpenId(null) : open(menu.id))}
            onPointerEnter={() => { if (openId && openId !== menu.id) open(menu.id); }}
          >
            {menu.label}
          </button>
          {openId === menu.id && (
            <div className="menu-bar-menu" role="menu" aria-label={menu.label}>
              {menu.groups.map((group, groupIndex) => (
                <React.Fragment key={groupIndex}>
                  {groupIndex > 0 && <div className="menu-bar-separator" role="separator" />}
                  {group.map((item) => {
                    const rowIndex = rows.indexOf(item);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        role={item.checked === undefined ? 'menuitem' : 'menuitemcheckbox'}
                        aria-checked={item.checked}
                        aria-disabled={item.disabled || undefined}
                        data-menu-item={item.id}
                        className={`menu-bar-item${rowIndex === activeRow ? ' active' : ''}${item.disabled ? ' disabled' : ''}`}
                        onPointerEnter={() => setActiveRow(rowIndex)}
                        onClick={() => runRow(item)}
                      >
                        <span className="menu-bar-check" aria-hidden="true">{item.checked ? '✓' : ''}</span>
                        <span className="menu-bar-label">{item.label}</span>
                        {item.shortcut && <span className="menu-bar-shortcut">{item.shortcut}</span>}
                      </button>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          )}
        </div>
      ))}
      {libraryDialog}
      <ProjectSettingsDialog isOpen={projectSettingsOpen} onClose={() => setProjectSettingsOpen(false)} />
    </div>
  );
};
