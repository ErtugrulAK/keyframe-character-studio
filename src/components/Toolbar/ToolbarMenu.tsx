import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import type { LucideIcon } from 'lucide-react';
import { useFloatingPanel } from '../../hooks/useFloatingPanel';

export interface ToolbarMenuItem {
  id: string;
  /** The item's visible text AND its accessible name. */
  label: string;
  icon: LucideIcon;
  run: () => void;
  /** An item the current selection cannot use stays listed, disabled, with its reason. */
  disabled?: boolean;
  title?: string;
  /** The item's `aria-keyshortcuts`, when the command has a key. */
  keyshortcuts?: string;
  /** An on/off command (grid, snapping, crop mode…): a menuitemcheckbox showing its state. */
  checked?: boolean;
}

interface ToolbarMenuProps {
  /** The trigger's accessible name; also labels the menu it opens. */
  label: string;
  icon: LucideIcon;
  /** True when the commands behind the trigger cannot be used right now. */
  disabled: boolean;
  /** What the trigger says when it is unavailable (and why). */
  title: string;
  items: ToolbarMenuItem[];
  /** Something behind the trigger is on (e.g. crop mode): the trigger shows it like a pressed button. */
  active?: boolean;
}

/**
 * One command-set band of the authoring toolbar: a single trigger that opens the
 * variants it owns.
 *
 * The strip carries one hitbox per band instead of one per variant, so a band
 * that is a set of near-identical glyphs (six align edges, two distribute axes)
 * costs a single control of width. The menu is a real menu: it moves focus onto
 * its first item when it opens, Arrow/Home/End walk it, Escape and an outside
 * press close it and give focus back to the trigger. It writes nothing on open —
 * a menu is chrome, and only an item runs a command.
 */
export const ToolbarMenu: React.FC<ToolbarMenuProps> = ({ label, icon: Icon, disabled, title, items, active = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const close = (restoreFocus: boolean) => {
    setIsOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  };

  const { panelRef, placement } = useFloatingPanel({
    isOpen,
    onClose: () => close(false),
    anchorRef: triggerRef,
    side: 'below',
  });

  // The trigger can become unavailable while its menu is up (the selection
  // changed behind it): the menu closes with it, so no stale command is left
  // floating over a selection it cannot act on.
  useEffect(() => {
    if (disabled && isOpen) {
      // oxlint-disable-next-line react/set-state-in-effect
      setIsOpen(false);
    }
  }, [disabled, isOpen]);

  // Focus lands on the first usable item once the menu is placed, so the whole
  // set is reachable from the keyboard without a second tab stop.
  const enabledIndexes = items.flatMap((item, index) => (item.disabled ? [] : [index]));
  useEffect(() => {
    if (!isOpen || !placement) return;
    itemRefs.current[items.findIndex((item) => !item.disabled)]?.focus();
  }, [isOpen, placement, items]);

  // Arrow/Home/End walk the usable items only (a disabled button cannot hold focus).
  const moveFocus = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const count = enabledIndexes.length;
    if (count === 0) return;
    const position = enabledIndexes.findIndex((index) => itemRefs.current[index] === document.activeElement);
    const nextPosition = event.key === 'ArrowDown'
      ? (position + 1) % count
      : event.key === 'ArrowUp'
        ? (position - 1 + count) % count
        : event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? count - 1
            : -1;
    if (nextPosition < 0) return;
    event.preventDefault();
    itemRefs.current[enabledIndexes[nextPosition]]?.focus();
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`authoring-toolbar-button${isOpen ? ' is-open' : ''}${active ? ' active' : ''}`}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        disabled={disabled}
        title={title}
        onClick={() => (isOpen ? close(true) : setIsOpen(true))}
      >
        <Icon />
      </button>
      {isOpen && ReactDOM.createPortal(
        <div
          ref={panelRef}
          className="authoring-toolbar-menu"
          role="menu"
          aria-label={label}
          style={{
            position: 'fixed',
            left: placement?.left ?? 0,
            top: placement?.top ?? 0,
            visibility: placement ? 'visible' : 'hidden',
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              event.stopPropagation();
              close(true);
              return;
            }
            if (event.key === 'Tab') {
              // Tabbing out of the menu dismisses it without stealing the tab
              // stop the user asked for.
              close(false);
              return;
            }
            moveFocus(event);
          }}
        >
          {items.map((item, index) => (
            <button
              key={item.id}
              ref={(element) => { itemRefs.current[index] = element; }}
              type="button"
              role={item.checked === undefined ? 'menuitem' : 'menuitemcheckbox'}
              aria-checked={item.checked}
              className={`authoring-toolbar-menu-item${item.checked ? ' is-checked' : ''}`}
              aria-label={item.label}
              aria-keyshortcuts={item.keyshortcuts}
              disabled={item.disabled}
              title={item.title}
              onClick={() => {
                item.run();
                close(true);
              }}
            >
              <item.icon aria-hidden="true" />
              <span>{item.label}</span>
              {item.checked !== undefined && <span className="authoring-toolbar-menu-check" aria-hidden="true">{item.checked ? 'On' : 'Off'}</span>}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
};
