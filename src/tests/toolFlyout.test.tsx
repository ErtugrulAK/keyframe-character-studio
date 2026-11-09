import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToolFlyout, type ToolFlyoutItem } from '../components/Toolbar/ToolFlyout';

/**
 * The hold-to-open tool button (shape and ellipse groups): a tap runs the tool
 * it shows, a hold / drag down / right-click / ArrowDown opens its list, and a
 * picked tool becomes the button's tool.
 */
const ITEMS: ToolFlyoutItem[] = [
  { id: 'rect', label: 'Rectangle', icon: <svg />, shortcut: 'R' },
  { id: 'square', label: 'Square', icon: <svg /> },
  { id: 'star', label: 'Star', icon: <svg /> },
];

const renderFlyout = (currentId = 'rect') => {
  const onRun = vi.fn();
  const onPick = vi.fn();
  const view = render(
    <ToolFlyout
      label="Add shape"
      title="Shape"
      current={ITEMS.find((item) => item.id === currentId)!}
      items={ITEMS}
      active={false}
      onRun={onRun}
      onPick={onPick}
    />,
  );
  return { onRun, onPick, view, button: screen.getByRole('button', { name: 'Add shape' }) };
};
const menu = () => screen.queryByRole('menu', { name: 'Add shape tools' });

// jsdom has no layout: the row under the pointer is whatever the test says.
let pointed: Element | null = null;
beforeEach(() => {
  pointed = null;
  document.elementFromPoint = vi.fn(() => pointed);
});
afterEach(() => {
  vi.useRealTimers();
});

describe('ToolFlyout', () => {
  it('a tap runs the current tool and opens nothing', () => {
    const { onRun, button } = renderFlyout();
    fireEvent.pointerDown(button, { button: 0, pointerId: 1, clientY: 10 });
    fireEvent.pointerUp(button, { button: 0, pointerId: 1, clientY: 10 });
    expect(onRun).toHaveBeenCalledOnce();
    expect(menu()).toBeNull();
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  it('a hold opens the list with the current tool checked, and runs nothing', () => {
    vi.useFakeTimers();
    const { onRun, button } = renderFlyout('square');
    fireEvent.pointerDown(button, { button: 0, pointerId: 1, clientY: 10 });
    act(() => { vi.advanceTimersByTime(349); });
    expect(menu()).toBeNull();
    act(() => { vi.advanceTimersByTime(1); });
    const list = menu()!;
    expect(within(list).getByRole('menuitemradio', { name: /Square/ })).toHaveAttribute('aria-checked', 'true');
    expect(within(list).getByRole('menuitemradio', { name: /Rectangle/ })).toHaveAttribute('aria-checked', 'false');
    expect(button).toHaveAttribute('aria-expanded', 'true');
    // Released off any row: the list stays open to click.
    fireEvent.pointerUp(button, { button: 0, pointerId: 1, clientY: 10 });
    expect(menu()).not.toBeNull();
    expect(onRun).not.toHaveBeenCalled();
  });

  it('releasing a held press over a row picks that tool', () => {
    vi.useFakeTimers();
    const { onPick, onRun, button } = renderFlyout();
    fireEvent.pointerDown(button, { button: 0, pointerId: 1, clientY: 10 });
    act(() => { vi.advanceTimersByTime(400); });
    pointed = within(menu()!).getByRole('menuitemradio', { name: /Star/ });
    fireEvent.pointerUp(button, { button: 0, pointerId: 1, clientX: 5, clientY: 80 });
    expect(onPick).toHaveBeenCalledWith('star');
    expect(onRun).not.toHaveBeenCalled();
    expect(menu()).toBeNull();
  });

  it('dragging down from the button opens the list at once', () => {
    const { button } = renderFlyout();
    fireEvent.pointerDown(button, { button: 0, pointerId: 1, clientY: 10 });
    fireEvent.pointerMove(button, { pointerId: 1, clientY: 17 });
    expect(menu()).toBeNull();
    fireEvent.pointerMove(button, { pointerId: 1, clientY: 19 });
    expect(menu()).not.toBeNull();
  });

  it('a right-click opens the list', () => {
    const { button } = renderFlyout();
    fireEvent.contextMenu(button);
    expect(menu()).not.toBeNull();
  });

  it('a non-primary press neither runs nor arms the hold', () => {
    vi.useFakeTimers();
    const { onRun, button } = renderFlyout();
    fireEvent.pointerDown(button, { button: 1, pointerId: 1, clientY: 10 });
    act(() => { vi.advanceTimersByTime(1000); });
    fireEvent.pointerUp(button, { button: 1, pointerId: 1, clientY: 10 });
    expect(menu()).toBeNull();
    expect(onRun).not.toHaveBeenCalled();
  });

  it('pressing the button of an open list closes it', () => {
    const { onRun, button } = renderFlyout();
    fireEvent.contextMenu(button);
    fireEvent.pointerDown(button, { button: 0, pointerId: 1, clientY: 10 });
    fireEvent.pointerUp(button, { button: 0, pointerId: 1, clientY: 10 });
    expect(menu()).toBeNull();
    expect(onRun).not.toHaveBeenCalled();
  });

  it('a click on a row picks it; Escape and a press outside close the list', () => {
    const { onPick, button } = renderFlyout();
    fireEvent.contextMenu(button);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(menu()).toBeNull();

    fireEvent.contextMenu(button);
    fireEvent.pointerDown(document.body);
    expect(menu()).toBeNull();

    fireEvent.contextMenu(button);
    fireEvent.click(within(menu()!).getByRole('menuitemradio', { name: /Square/ }));
    expect(onPick).toHaveBeenCalledWith('square');
    expect(menu()).toBeNull();
  });

  it('works from the keyboard: ArrowDown opens, arrows move (wrapping), Enter picks', () => {
    const { onPick, onRun, button } = renderFlyout('star');
    fireEvent.keyDown(button, { key: 'Enter' });
    expect(onRun).toHaveBeenCalledOnce();

    fireEvent.keyDown(button, { key: 'ArrowDown' });
    expect(menu()).not.toBeNull();
    const highlighted = () => menu()!.querySelector('.highlighted')?.textContent;
    expect(highlighted()).toContain('Star');
    fireEvent.keyDown(button, { key: 'ArrowDown' });
    expect(highlighted()).toContain('Rectangle');
    fireEvent.keyDown(button, { key: 'ArrowUp' });
    expect(highlighted()).toContain('Star');
    fireEvent.keyDown(button, { key: 'ArrowUp' });
    expect(highlighted()).toContain('Square');
    fireEvent.keyDown(button, { key: 'Enter' });
    expect(onPick).toHaveBeenCalledWith('square');
    expect(onRun).toHaveBeenCalledOnce();
  });

  it('shows a row\'s shortcut', () => {
    const { button } = renderFlyout();
    fireEvent.contextMenu(button);
    expect(within(menu()!).getByRole('menuitemradio', { name: /Rectangle/ })).toHaveTextContent('R');
  });
});
