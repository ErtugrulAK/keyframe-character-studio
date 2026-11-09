import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';

export interface ToolFlyoutItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  /** The tool's shortcut, shown at the right of the row. */
  shortcut?: string;
}

interface ToolFlyoutProps {
  /** Accessible name of the button: the tool it runs now. */
  label: string;
  title: string;
  /** The item the button shows and runs on a click (the last one picked). */
  current: ToolFlyoutItem;
  items: ToolFlyoutItem[];
  active: boolean;
  /** A plain click: run the current item. */
  onRun: () => void;
  /** An item picked from the flyout: it becomes current and runs. */
  onPick: (id: string) => void;
  keyshortcuts?: string;
}

/** How long a press is held before the flyout opens (as in Photoshop/Illustrator). */
const HOLD_MS = 350;
/** Dragging this far down from the button opens the flyout at once. */
const DRAG_OPEN_PX = 8;

/**
 * A tool button with a flyout of related tools, like the shape group of a
 * vector editor: a click runs the tool it shows; holding the press (or
 * dragging down, or a right-click, or ArrowDown) opens the list under it. With
 * the button still held, releasing over a row picks that tool; a picked tool
 * becomes the button's tool. A small corner mark says the button has a list.
 */
export const ToolFlyout: React.FC<ToolFlyoutProps> = ({ label, title, current, items, active, onRun, onPick, keyshortcuts }) => {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  /** Where the list opens: under the button, in the viewport (the strip scrolls and clips). */
  const [anchor, setAnchor] = useState<{ left: number; top: number } | null>(null);
  const holdTimer = useRef<number | null>(null);
  const press = useRef<{ y: number; opened: boolean; wasOpen: boolean } | null>(null);

  const clearHold = () => {
    if (holdTimer.current !== null) window.clearTimeout(holdTimer.current);
    holdTimer.current = null;
  };
  const placeMenu = () => {
    const box = rootRef.current?.getBoundingClientRect();
    if (box) setAnchor({ left: box.left, top: box.bottom + 4 });
  };
  const openFlyout = () => {
    clearHold();
    placeMenu();
    if (press.current) press.current.opened = true;
    setHighlight(current.id);
    setOpen(true);
  };
  const close = () => {
    clearHold();
    setOpen(false);
    setHighlight(null);
  };
  const pick = (id: string) => {
    close();
    onPick(id);
  };

  useEffect(() => clearHold, []);
  useEffect(() => {
    if (!open) return undefined;
    const onOutside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !menuRef.current?.contains(target)) close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('pointerdown', onOutside, true);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onOutside, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  /** The flyout row under a screen point, if any. */
  const rowAt = (x: number, y: number): string | null => {
    const element = document.elementFromPoint(x, y);
    const row = element?.closest<HTMLElement>('[data-flyout-item]');
    return row && menuRef.current?.contains(row) ? row.dataset.flyoutItem ?? null : null;
  };

  const onPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    press.current = { y: event.clientY, opened: open, wasOpen: open };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    clearHold();
    holdTimer.current = window.setTimeout(openFlyout, HOLD_MS);
  };
  const onPointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!press.current) return;
    if (!open && event.clientY - press.current.y > DRAG_OPEN_PX) openFlyout();
    if (open || press.current.opened) setHighlight(rowAt(event.clientX, event.clientY) ?? highlight);
  };
  const onPointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    const started = press.current;
    press.current = null;
    clearHold();
    if (!started) return;
    if (started.opened || open) {
      // Released over a row: that tool. Elsewhere the list stays open to click,
      // unless this press was on the button of an already open list (it closes).
      const row = rowAt(event.clientX, event.clientY);
      if (row) pick(row);
      else if (started.wasOpen) close();
      return;
    }
    onRun();
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (!open && event.key === 'ArrowDown') {
      event.preventDefault();
      placeMenu();
      setHighlight(current.id);
      setOpen(true);
      return;
    }
    if (!open) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onRun();
      }
      return;
    }
    const index = Math.max(0, items.findIndex((item) => item.id === highlight));
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const next = (index + (event.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length;
      setHighlight(items[next].id);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (highlight) pick(highlight);
    }
  };

  return (
    <div className="tool-flyout" ref={rootRef}>
      <button
        type="button"
        className={`authoring-toolbar-button tool-flyout-button${active ? ' active' : ''}`}
        aria-label={label}
        aria-pressed={active}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-keyshortcuts={keyshortcuts}
        title={title}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => { press.current = null; clearHold(); }}
        onContextMenu={(event) => { event.preventDefault(); openFlyout(); }}
        onClick={(event) => {
          // A click with no press behind it (detail 0: a screen reader, a
          // switch device or element.click()) runs the tool. A pointer tap
          // already ran it on release, and Enter/Space are handled on keydown.
          if (event.detail === 0 && !open) onRun();
        }}
        onKeyDown={onKeyDown}
      >
        {current.icon}
        <span className="tool-flyout-mark" aria-hidden="true" />
      </button>
      {open && anchor && ReactDOM.createPortal(
        <div ref={menuRef} className="tool-flyout-menu" role="menu" aria-label={`${label} tools`} style={{ position: 'fixed', left: anchor.left, top: anchor.top }}>
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitemradio"
              aria-checked={item.id === current.id}
              data-flyout-item={item.id}
              className={`tool-flyout-item${item.id === highlight ? ' highlighted' : ''}${item.id === current.id ? ' current' : ''}`}
              onPointerEnter={() => setHighlight(item.id)}
              onClick={() => pick(item.id)}
            >
              <span className="tool-flyout-item-icon" aria-hidden="true">{item.icon}</span>
              <span className="tool-flyout-item-label">{item.label}</span>
              {item.shortcut && <span className="tool-flyout-item-shortcut">{item.shortcut}</span>}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
};
