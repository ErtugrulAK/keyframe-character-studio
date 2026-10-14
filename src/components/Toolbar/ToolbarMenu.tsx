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
export const ToolbarMenu: React.FC<ToolbarMenuProps> = ({ label, icon: Icon, disabled, title, items }) => {
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

  // Focus lands on the first item once the menu is placed, so the whole set is
  // reachable from the keyboard without a second tab stop.
  useEffect(() => {
    if (!isOpen || !placement) return;
    itemRefs.current[0]?.focus();
  }, [isOpen, placement]);

  const moveFocus = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const count = items.length;
    const currentIndex = itemRefs.current.findIndex((item) => item === document.activeElement);
    const nextIndex = event.key === 'ArrowDown'
      ? (currentIndex + 1) % count
      : event.key === 'ArrowUp'
        ? (currentIndex - 1 + count) % count
        : event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? count - 1
            : -1;
    if (nextIndex < 0) return;
    event.preventDefault();
    itemRefs.current[nextIndex]?.focus();
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`authoring-toolbar-button${isOpen ? ' is-open' : ''}`}
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
              role="menuitem"
              className="authoring-toolbar-menu-item"
              aria-label={item.label}
              onClick={() => {
                item.run();
                close(true);
              }}
            >
              <item.icon aria-hidden="true" />
              <span>{item.label}</span>
            </button>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
};
