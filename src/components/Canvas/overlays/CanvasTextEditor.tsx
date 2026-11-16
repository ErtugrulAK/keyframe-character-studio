import React, { useLayoutEffect, useRef, useState } from 'react';
import { useAnimatorSlice } from '../../../context/useAnimator';

interface CanvasTextEditorProps {
  /** The text layer being typed into. */
  partId: string;
  onClose: () => void;
}

interface EditorBox {
  centerX: number;
  centerY: number;
  width: number;
  fontPx: number;
  fontFamily?: string;
  fontWeight?: string;
}

const MIN_FONT_PX = 12;
const MAX_FONT_PX = 160;

/** Where the layer's text is drawn in the stage container, and how large its letters are on screen. */
const measure = (container: HTMLElement | null, partId: string): EditorBox | null => {
  if (!container) return null;
  const group = [...container.querySelectorAll<SVGGElement>('[data-part-id]')].find((node) => node.getAttribute('data-part-id') === partId);
  const text = group?.querySelector('text');
  if (!group || !text) return null;
  const rect = (text as SVGGraphicsElement).getBoundingClientRect();
  const frame = container.getBoundingClientRect();
  const authored = Number.parseFloat(text.getAttribute('font-size') ?? '') || 32;
  // The letters' size on screen: the authored size through every scale above
  // it (the layer, its parents and the camera), whatever the rotation.
  const matrix = typeof text.getScreenCTM === 'function' ? text.getScreenCTM() : null;
  const scale = matrix ? Math.hypot(matrix.c, matrix.d) : 1;
  return {
    centerX: rect.left + rect.width / 2 - frame.left,
    centerY: rect.top + rect.height / 2 - frame.top,
    width: rect.width,
    fontPx: Math.min(MAX_FONT_PX, Math.max(MIN_FONT_PX, authored * scale)),
    fontFamily: text.getAttribute('font-family') ?? undefined,
    fontWeight: text.getAttribute('font-weight') ?? undefined,
  };
};

const sameBox = (a: EditorBox | null, b: EditorBox | null): boolean =>
  a === b || (a !== null && b !== null && Math.abs(a.centerX - b.centerX) < 0.5 && Math.abs(a.centerY - b.centerY) < 0.5 && Math.abs(a.width - b.width) < 0.5 && Math.abs(a.fontPx - b.fontPx) < 0.05 && a.fontFamily === b.fontFamily && a.fontWeight === b.fontWeight);

/**
 * Typing into a text layer on the canvas (double-click a text).
 *
 * A one-line field over the text, in the text's own font and on-screen size.
 * Every keystroke writes the layer's `textValue` (the same field the options
 * bar edits), so the drawing, the Inspector and the export follow as you type.
 * The whole edit is one undo step. Enter or a click elsewhere keeps it; Escape
 * puts the text back as it was (the value it had when the field opened).
 */
export const CanvasTextEditor: React.FC<CanvasTextEditorProps> = ({ partId, onClose }) => {
  const { characterParts, setCharacterParts, startBatchInteraction, endBatchInteraction } = useAnimatorSlice('characterParts', 'setCharacterParts', 'startBatchInteraction', 'endBatchInteraction');
  const part = characterParts.find((candidate) => candidate.id === partId);
  const inputRef = useRef<HTMLInputElement>(null);
  const originalRef = useRef<string | null>(null);
  const doneRef = useRef(false);
  const [box, setBox] = useState<EditorBox | null>(null);

  const write = (value: string) => {
    // One undo step for the whole edit. The history closes an open step on any
    // mouse release (its steps are gestures), so the step is opened by the
    // typing itself; opening it again while it is open does nothing.
    startBatchInteraction();
    setCharacterParts((previous) => previous.map((candidate) => (candidate.id === partId ? { ...candidate, textValue: value } : candidate)));
  };

  // The step closes with the field.
  useLayoutEffect(() => () => endBatchInteraction(), [endBatchInteraction]);

  // Follow the drawn text: it moves as it grows, with the camera, and when the
  // stage is resized (a bar or a dock opening). The camera settles after the
  // render that asked for it, so the place is read again on the next frame.
  useLayoutEffect(() => {
    const container = inputRef.current?.closest<HTMLElement>('.stage-canvas-container') ?? null;
    const follow = () => {
      const next = measure(container, partId);
      setBox((current) => (sameBox(current, next) ? current : next));
    };
    follow();
    const frame = requestAnimationFrame(follow);
    return () => cancelAnimationFrame(frame);
  });
  useLayoutEffect(() => {
    const container = inputRef.current?.closest<HTMLElement>('.stage-canvas-container') ?? null;
    if (!container || typeof ResizeObserver === 'undefined') return undefined;
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const next = measure(container, partId);
        setBox((current) => (sameBox(current, next) ? current : next));
      });
    });
    observer.observe(container);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [partId]);

  useLayoutEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    input.select();
  }, []);

  if (!part) return null;
  if (originalRef.current === null) originalRef.current = part.textValue ?? '';

  const finish = (keep: boolean) => {
    if (doneRef.current) return;
    doneRef.current = true;
    if (!keep) write(originalRef.current ?? '');
    onClose();
  };

  const value = part.textValue ?? '';
  const fontPx = box?.fontPx ?? 24;
  return (
    <input
      ref={inputRef}
      className="canvas-text-editor"
      data-testid="canvas-text-editor"
      data-stage-chrome=""
      type="text"
      aria-label={`Text of ${part.name || 'layer'}`}
      value={value}
      maxLength={part.textFit?.maxLength}
      spellCheck={false}
      style={{
        left: box?.centerX ?? '50%',
        top: box?.centerY ?? '50%',
        width: `calc(${Math.max(box?.width ?? 0, fontPx * 2)}px + 1.2em)`,
        fontSize: fontPx,
        fontFamily: box?.fontFamily,
        fontWeight: box?.fontWeight,
      }}
      onChange={(event) => write(event.target.value)}
      onBlur={() => finish(true)}
      onKeyDown={(event) => {
        // The keys belong to the field while it is open (no tool or timeline shortcut).
        event.stopPropagation();
        if (event.key === 'Enter') {
          event.preventDefault();
          finish(true);
        } else if (event.key === 'Escape') {
          event.preventDefault();
          finish(false);
        }
      }}
      // The stage must not read a press in the field as a click on the canvas,
      // nor the history its release as the end of the edit.
      onMouseDown={(event) => event.stopPropagation()}
      onMouseUp={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.stopPropagation()}
    />
  );
};
