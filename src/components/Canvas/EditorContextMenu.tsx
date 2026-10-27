import React, { useCallback, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useFloatingPanel } from '../../hooks/useFloatingPanel';
import './EditorContextMenu.css';

export interface ContextMenuItem {
  id: string;
  label: string;
  /** Only set when the shortcut already exists in the editor's key map. */
  shortcut?: string;
  disabled?: boolean;
  /** Why the item does what it does, or why it is disabled (tooltip). */
  title?: string;
  run: () => void;
}

/** Items are rendered in groups separated by a divider. */
export type ContextMenuGroup = ContextMenuItem[];

interface EditorContextMenuProps {
  isOpen: boolean;
  /** Pointer position the menu hangs off (client coordinates). */
  point: { x: number; y: number } | null;
  groups: ContextMenuGroup[];
  onClose: () => void;
}

const NAVIGATION_KEYS = ['ArrowDown', 'ArrowUp', 'Home', 'End'];

/**
 * The editor's right-click menu.
 *
 * It is presentation only: the caller supplies the already-filtered item groups
 * (each item runs an existing editor authority), and placement/dismissal come
 * from the shared floating-panel engine the colour popover uses. It owns no
 * document state and never opens the browser's native menu.
 */
export const EditorContextMenu: React.FC<EditorContextMenuProps> = ({ isOpen, point, groups, onClose }) => {
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  /** Set when the menu opens, so focus lands in it exactly once. */
  const focusPendingRef = useRef(false);
  const { panelRef, placement } = useFloatingPanel({
    isOpen,
    onClose: () => onClose(),
    point,
    side: 'below',
    align: 'start',
  });

  const items = groups.flat();

  const focusFirstItem = useCallback(() => {
    const firstEnabled = items.findIndex((item) => !item.disabled);
    if (firstEnabled < 0) return;
    itemRefs.current[firstEnabled]?.focus();
  }, [items]);

  // Opening remembers where focus came from; the first actionable item takes it
  // once the panel has been measured (it is not focusable before that). The
  // pending flag keeps later re-renders from stealing focus back.
  useLayoutEffect(() => {
    if (!isOpen) {
      focusPendingRef.current = false;
      return;
    }
    const active = document.activeElement;
    restoreFocusRef.current = active instanceof HTMLElement ? active : null;
    focusPendingRef.current = true;
  }, [isOpen]);

  useLayoutEffect(() => {
    if (!isOpen || !placement || !focusPendingRef.current) return;
    focusPendingRef.current = false;
    focusFirstItem();
  }, [isOpen, placement, focusFirstItem]);

  const closeWithFocusRestore = useCallback(() => {
    const target = restoreFocusRef.current;
    onClose();
    if (target && target.isConnected) target.focus();
  }, [onClose]);

  const moveFocus = useCallback((direction: 1 | -1 | 'first' | 'last') => {
    const enabledIndexes = items.reduce<number[]>((indexes, item, index) => {
      if (!item.disabled) indexes.push(index);
      return indexes;
    }, []);
    if (enabledIndexes.length === 0) return;
    const current = itemRefs.current.findIndex((element) => element === document.activeElement);
    let next: number;
    if (direction === 'first') next = enabledIndexes[0];
    else if (direction === 'last') next = enabledIndexes[enabledIndexes.length - 1];
    else {
      const position = enabledIndexes.indexOf(current);
      const step = position < 0 ? 0 : position + direction;
      next = enabledIndexes[(step + enabledIndexes.length) % enabledIndexes.length];
    }
    itemRefs.current[next]?.focus();
  }, [items]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    // The menu owns Escape while it is open: it must not also reach the global
    // authoring shortcuts.
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      closeWithFocusRestore();
      return;
    }
    if (event.key === 'Tab') {
      // Tabbing leaves the menu rather than trapping focus inside it.
      onClose();
      return;
    }
    if (!NAVIGATION_KEYS.includes(event.key)) return;
    event.preventDefault();
    moveFocus(event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : event.key === 'Home' ? 'first' : 'last');
  };

  if (!isOpen || groups.length === 0) return null;

  return createPortal(
    <div
      ref={panelRef}
      className="editor-context-menu"
      role="menu"
      aria-label="Editor actions"
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      onContextMenu={(event) => event.preventDefault()}
      style={{
        position: 'fixed',
        left: placement?.left ?? 0,
        top: placement?.top ?? 0,
        visibility: placement ? 'visible' : 'hidden',
      }}
    >
      {groups.map((group, groupIndex) => (
        <React.Fragment key={group[0]?.id ?? groupIndex}>
          {groupIndex > 0 && <div className="editor-context-menu-separator" role="separator" />}
          {group.map((item) => (
            <button
              key={item.id}
              ref={(element) => {
                const index = items.indexOf(item);
                if (index >= 0) itemRefs.current[index] = element;
              }}
              type="button"
              role="menuitem"
              className="editor-context-menu-item"
              disabled={item.disabled}
              title={item.title}
              onClick={() => {
                if (item.disabled) return;
                item.run();
                onClose();
              }}
            >
              <span className="editor-context-menu-label">{item.label}</span>
              {item.shortcut && <span className="editor-context-menu-shortcut">{item.shortcut}</span>}
            </button>
          ))}
        </React.Fragment>
      ))}
    </div>,
    document.body,
  );
};
