import React, { useEffect, useRef, useState } from 'react';
import { useAnimatorSlice } from '../../context/useAnimator';
import { useEditorContextMenu } from '../../context/editorContextMenu';
import { useLayerGrouping } from '../../hooks/useLayerGrouping';
import { useVectorArrangeAuthoring } from '../../hooks/useVectorArrangeAuthoring';
import { detectShortcutPlatform, formatShortcutHint, type ShortcutCommandId } from '../../utils/editor/shortcuts';
import { dispatchHeaderCommand } from '../../utils/editor/headerCommands';
import { isConvertibleShapeType, shapeToPathBlockReason } from '../../utils/geometry/shapeToPath';
import { ProjectSettingsDialog } from './ProjectSettingsDialog';
import { useMediaImport } from '../../hooks/useMediaImport';
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

/** The same camera channel the toolbar's zoom buttons and +/- keys use. */
const viewportCommand = (type: 'zoom-in' | 'zoom-out' | 'reset-view') => {
  window.dispatchEvent(new CustomEvent('canvas-viewport-command', { detail: { type } }));
};

/**
 * The editor's menu bar (File, Edit, Object, View, Help), as in Photopea and
 * Boxy SVG. Every row runs a command that already exists (history, clipboard,
 * grouping, arrange, the header's import/export, the camera channel), so the
 * menus add no second implementation. Project settings, which lived in the
 * left panel, open from File.
 *
 * Mouse: click a title to open its menu; while one is open, hovering another
 * title switches to it. Keyboard: ArrowLeft/Right move between menus,
 * ArrowUp/Down between rows, Enter runs, Escape closes.
 */
export const MenuBar: React.FC = () => {
  const {
    undo, redo, canUndo, canRedo, copySelectedPart, pasteCopiedPart, duplicateSelectedPart, clipboardData,
    selectedPartId, selectedPartIds, characterParts, tracks, convertToEditablePath, resetSelectedTransforms,
    showGrid, setShowGrid, snapEnabled, setSnapEnabled, showCoordinateOverlay, setShowCoordinateOverlay,
    openShortcutReference, reorderParts,
  } = useAnimatorSlice(
    'undo', 'redo', 'canUndo', 'canRedo', 'copySelectedPart', 'pasteCopiedPart', 'duplicateSelectedPart', 'clipboardData',
    'selectedPartId', 'selectedPartIds', 'characterParts', 'tracks', 'convertToEditablePath', 'resetSelectedTransforms',
    'showGrid', 'setShowGrid', 'snapEnabled', 'setSnapEnabled', 'showCoordinateOverlay', 'setShowCoordinateOverlay',
    'openShortcutReference', 'reorderParts',
  );
  const { selectAll, deleteSelection } = useEditorContextMenu();
  const { selectedGroup, canGroup, groupSelection, ungroupSelection } = useLayerGrouping();
  const arrange = useVectorArrangeAuthoring();
  const [openId, setOpenId] = useState<string | null>(null);
  const [activeRow, setActiveRow] = useState(0);
  const [projectSettingsOpen, setProjectSettingsOpen] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);
  // The hidden file input, held in state (a callback ref) so the menu row can open it.
  const [mediaInput, setMediaInput] = useState<HTMLInputElement | null>(null);
  const importMedia = useMediaImport();

  const platform = detectShortcutPlatform();
  const hint = (id: ShortcutCommandId) => formatShortcutHint(id, platform);
  const primary = characterParts.find((part) => part.id === selectedPartId);
  const index = primary ? characterParts.indexOf(primary) : -1;
  const single = Boolean(primary) && selectedPartIds.length <= 1;
  const shapeToPathBlocked = primary && isConvertibleShapeType(primary.type) ? shapeToPathBlockReason(primary, tracks) : 'Select a basic shape';

  const menus: Menu[] = [
    {
      id: 'file',
      label: 'File',
      groups: [
        [
          { id: 'import', label: 'Import…', run: () => dispatchHeaderCommand('import') },
          { id: 'add-media', label: 'Add Image or Video…', run: () => mediaInput?.click() },
          { id: 'project-settings', label: 'Project Settings…', run: () => setProjectSettingsOpen(true) },
        ],
        [
          { id: 'export-json', label: 'Export Project (JSON)', run: () => dispatchHeaderCommand('export-json') },
          { id: 'export-ograf', label: 'Export OGraf Package', run: () => dispatchHeaderCommand('export-ograf') },
          { id: 'export-gif', label: 'Export Animated GIF…', run: () => dispatchHeaderCommand('export-gif') },
          { id: 'check-ograf', label: 'Check OGraf Export…', run: () => dispatchHeaderCommand('check-ograf') },
        ],
        [{ id: 'reset-project', label: 'Reset Project…', run: () => dispatchHeaderCommand('reset-project') }],
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
          { id: 'paste', label: 'Paste', shortcut: hint('paste'), disabled: !clipboardData, run: pasteCopiedPart },
          { id: 'duplicate', label: 'Duplicate', shortcut: hint('duplicate'), disabled: !primary, run: duplicateSelectedPart },
          { id: 'delete', label: 'Delete', shortcut: hint('delete-selection'), disabled: !primary, run: deleteSelection },
        ],
        [{ id: 'select-all', label: 'Select All', shortcut: hint('select-all'), disabled: characterParts.length === 0, run: selectAll }],
      ],
    },
    {
      id: 'object',
      label: 'Object',
      groups: [
        [
          { id: 'group', label: 'Group', shortcut: hint('group-layers'), disabled: !canGroup, run: groupSelection },
          { id: 'ungroup', label: 'Ungroup', shortcut: hint('ungroup-layers'), disabled: !selectedGroup, run: ungroupSelection },
        ],
        [
          { id: 'shape-to-path', label: 'Shape to Path', disabled: Boolean(shapeToPathBlocked) || !single, run: () => { if (primary) convertToEditablePath(primary.id); } },
          { id: 'reset-transform', label: 'Reset Transform', disabled: !primary, run: resetSelectedTransforms },
        ],
        [
          { id: 'rotate-cw', label: 'Rotate 90° Clockwise', shortcut: hint('rotate-cw'), disabled: !arrange.canTransform, run: () => arrange.rotate('cw') },
          { id: 'rotate-ccw', label: 'Rotate 90° Counter-clockwise', shortcut: hint('rotate-ccw'), disabled: !arrange.canTransform, run: () => arrange.rotate('ccw') },
          { id: 'flip-h', label: 'Flip Horizontal', shortcut: hint('flip-horizontal'), disabled: !arrange.canTransform, run: () => arrange.flip('horizontal') },
          { id: 'flip-v', label: 'Flip Vertical', shortcut: hint('flip-vertical'), disabled: !arrange.canTransform, run: () => arrange.flip('vertical') },
        ],
        [
          { id: 'bring-to-front', label: 'Bring to Front', disabled: !single || index <= 0, run: () => reorderParts(index, 0) },
          { id: 'bring-forward', label: 'Bring Forward', disabled: !single || index <= 0, run: () => reorderParts(index, index - 1) },
          { id: 'send-backward', label: 'Send Backward', disabled: !single || index < 0 || index >= characterParts.length - 1, run: () => reorderParts(index, index + 1) },
          { id: 'send-to-back', label: 'Send to Back', disabled: !single || index < 0 || index >= characterParts.length - 1, run: () => reorderParts(index, characterParts.length - 1) },
        ],
      ],
    },
    {
      id: 'view',
      label: 'View',
      groups: [
        [
          { id: 'zoom-in', label: 'Zoom In', shortcut: hint('zoom-in'), run: () => viewportCommand('zoom-in') },
          { id: 'zoom-out', label: 'Zoom Out', shortcut: hint('zoom-out'), run: () => viewportCommand('zoom-out') },
          { id: 'reset-view', label: 'Fit to Screen', run: () => viewportCommand('reset-view') },
        ],
        [
          { id: 'grid', label: 'Grid', checked: showGrid, run: () => setShowGrid(!showGrid) },
          { id: 'snap', label: 'Snapping', checked: snapEnabled, run: () => setSnapEnabled(!snapEnabled) },
          { id: 'axes', label: 'Coordinate Axes', checked: showCoordinateOverlay, run: () => setShowCoordinateOverlay(!showCoordinateOverlay) },
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
      <input
        ref={setMediaInput}
        type="file"
        accept="image/*,video/*,.mp4,.webm,.mov"
        multiple
        aria-label="Choose images or videos to add from the File menu"
        style={{ display: 'none' }}
        onChange={(event) => {
          if (event.target.files?.length) importMedia(event.target.files);
          event.target.value = '';
        }}
      />
      <ProjectSettingsDialog isOpen={projectSettingsOpen} onClose={() => setProjectSettingsOpen(false)} />
    </div>
  );
};
