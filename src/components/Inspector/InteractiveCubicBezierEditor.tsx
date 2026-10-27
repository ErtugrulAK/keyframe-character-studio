import React, { useState, useRef, useEffect } from 'react';
import { NumberField } from './inputs/NumberField';
import { parseCubicBezierText } from '../../utils/cubicBezierText';
import ReactDOM from 'react-dom';
import { Copy, Check, X, Play, Pause } from 'lucide-react';
import type { PropertyKeyframe, TemporalHandle } from '../../types/animator';
import { TemporalGraphPanel } from './TemporalGraphPanel';
import { solveCubicBezier } from '../../utils/defaults';
import { PRESET_BEZIERS } from './easingPresets';
interface InteractiveCubicBezierEditorProps {
  controlPoints?: [number, number, number, number]; // [x1, y1, x2, y2]
  onChange: (points: [number, number, number, number]) => void;
  initialModalOpen?: boolean;
  onCloseModal?: () => void;
  valueKeyframes?: PropertyKeyframe[];
  /** Frames and property of the segment being shaped, when there is one. */
  segmentFrames?: { from: number; to: number };
  /** Property label of the segment (e.g. "Opacity"), for the header. */
  segmentChannelLabel?: string;
  /**
   * Why this editor has nothing to shape. When set, the curve controls are
   * replaced by an explanation instead of silently editing another keyframe.
   */
  inactiveReason?: string | null;
  onChangeKeyframeValue?: (keyframeId: string, value: number) => void;
  onChangeKeyframeHandles?: (
    keyframeId: string,
    patch: { bezierIn?: TemporalHandle; bezierOut?: TemporalHandle },
  ) => void;
  /** #57 (V6): forwarded segment-scope preset application (host-provided). */
  onApplySegmentPreset?: (keyframeId: string, outgoing: TemporalHandle, incoming: TemporalHandle) => void;
  /** Opens/closes ONE undo entry around a continuous curve or graph drag. */
  onBatchStart?: () => void;
  onBatchEnd?: () => void;
}


const clampControlPoint = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

/** C12 — the curve graph's size and inner padding (drawing and dragging share them). */
const GRAPH = { width: 640, height: 300, padX: 44, padY: 30 } as const;
/** The graph's value range: the 0..1 unit box plus room to overshoot (-1..2). */
const Y_MIN = -1;
const Y_RANGE = 3;

/** A preset's curve as a small icon path (unit box inset in a 32 × 22 box). */
const presetIconPath = ([x1, y1, x2, y2]: [number, number, number, number]): string => {
  const sx = (x: number) => 3 + x * 26;
  const sy = (y: number) => 17 - y * 12;
  return `M ${sx(0)} ${sy(0)} C ${sx(x1)} ${sy(y1)} ${sx(x2)} ${sy(y2)} ${sx(1)} ${sy(1)}`;
};

export const InteractiveCubicBezierEditor: React.FC<InteractiveCubicBezierEditorProps> = ({
  controlPoints = [0.42, 0.0, 0.58, 1.0],
  onChange,
  initialModalOpen = true,
  onCloseModal,
  valueKeyframes = [],
  segmentFrames,
  segmentChannelLabel,
  inactiveReason = null,
  onChangeKeyframeValue,
  onChangeKeyframeHandles,
  onApplySegmentPreset,
  onBatchStart,
  onBatchEnd,
}) => {
  const [copied, setCopied] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(initialModalOpen);
  const [draggingPoint, setDraggingPoint] = useState<1 | 2 | null>(null);
  const [graphMode, setGraphMode] = useState<'value' | 'speed'>('value');

  // Pro Studio Modal State
  const [previewDuration, setPreviewDuration] = useState<number>(1.2);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState<boolean>(false);

  const modalSvgRef = useRef<SVGSVGElement>(null);
  const previewBallRef = useRef<HTMLDivElement>(null);
  const modalCardRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const onCloseModalRef = useRef(onCloseModal);
  const draggingPointerIdRef = useRef<number | null>(null);
  const draggingPointRef = useRef<1 | 2 | null>(null);
  const suppressBackdropClickRef = useRef(false);

  const [p1, setP1] = useState<{ x: number; y: number }>({ x: controlPoints[0], y: controlPoints[1] });
  const [p2, setP2] = useState<{ x: number; y: number }>({ x: controlPoints[2], y: controlPoints[3] });

  useEffect(() => {
    // The editor draft follows externally selected control points.
    // oxlint-disable-next-line react/set-state-in-effect
    setP1({ x: controlPoints[0], y: controlPoints[1] });
    setP2({ x: controlPoints[2], y: controlPoints[3] });
  }, [controlPoints]);
  useEffect(() => {
    onCloseModalRef.current = onCloseModal;
  }, [onCloseModal]);
  useEffect(() => {
    if (!isModalOpen) return;
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const getFocusableElements = () => Array.from(
      modalCardRef.current?.querySelectorAll<HTMLElement>('button, input, select, textarea, [tabindex]:not([tabindex="-1"])') ?? [],
    );
    const focusInitial = () => getFocusableElements()[0]?.focus();
    const handleModalKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsModalOpen(false);
        onCloseModalRef.current?.();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusableElements = getFocusableElements();
      if (focusableElements.length === 0) return;
      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    const frame = window.requestAnimationFrame(focusInitial);
    window.addEventListener('keydown', handleModalKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('keydown', handleModalKeyDown);
      previousFocusRef.current?.focus();
      previousFocusRef.current = null;
    };
  }, [isModalOpen]);

  useEffect(() => {
    const ball = previewBallRef.current;
    if (!ball || typeof ball.animate !== 'function') return;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const cancelAnimations = () => ball.getAnimations().forEach((animation) => animation.cancel());
    const handleMotionPreferenceChange = () => {
      if (mediaQuery.matches) cancelAnimations();
    };
    mediaQuery.addEventListener?.('change', handleMotionPreferenceChange);
    cancelAnimations();
    if (mediaQuery.matches || !isPreviewPlaying) {
      return () => mediaQuery.removeEventListener?.('change', handleMotionPreferenceChange);
    }
    const keyframes = Array.from({ length: 25 }, (_, index) => {
      const progress = index / 24;
      const eased = solveCubicBezier(p1.x, p1.y, p2.x, p2.y, progress);
      const bounded = Math.max(0, Math.min(1, eased));
      return {
        left: `clamp(2px, ${bounded * 100}%, calc(100% - 16px))`,
      };
    });
    const animation = ball.animate(keyframes, {
      duration: previewDuration * 1000,
      easing: 'linear',
      iterations: Infinity,
      direction: 'alternate',
    });
    return () => {
      animation.cancel();
      mediaQuery.removeEventListener?.('change', handleMotionPreferenceChange);
    };
  }, [isPreviewPlaying, p1, p2, previewDuration]);

  const cssString = `cubic-bezier(${p1.x}, ${p1.y}, ${p2.x}, ${p2.y})`;

  const updatePoints = React.useCallback((newP1: { x: number; y: number }, newP2: { x: number; y: number }) => {
    setP1(newP1);
    setP2(newP2);
    onChange([newP1.x, newP1.y, newP2.x, newP2.y]);
  }, [onChange]);

  // C10 — paste easing code from elsewhere (CSS cubic-bezier, an array, four
  // numbers or a CSS keyword); a value the curve cannot take says why.
  const [pasteText, setPasteText] = useState('');
  const [pasteError, setPasteError] = useState<string | null>(null);
  const applyPastedEasing = () => {
    const points = parseCubicBezierText(pasteText);
    if (!points) {
      setPasteError('Not a curve: use cubic-bezier(x1, y1, x2, y2) with x1 and x2 between 0 and 1.');
      return;
    }
    setPasteError(null);
    setPasteText('');
    updatePoints({ x: points[0], y: points[1] }, { x: points[2], y: points[3] });
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(cssString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getMotionAnalysis = () => {
    const tags: string[] = [];
    if (p1.y < 0 || p2.y < 0) tags.push('Anticipation pullback');
    if (p1.y > 1 || p2.y > 1) tags.push('Elastic overshoot');
    if (p1.x < 0.2 && p2.x < 0.2) tags.push('Instant velocity burst');
    if (p1.x > 0.8 && p2.x > 0.8) tags.push('Delayed impulse');
    if (tags.length === 0) tags.push('Smooth easing flow');
    return tags.join(' · ');
  };

  // Pointer capture keeps curve-handle drags alive when the pointer leaves the graph or modal.
  const updateDraggedPoint = (clientX: number, clientY: number) => {
    const point = draggingPointRef.current;
    const svg = modalSvgRef.current;
    if (!point || !svg) return;
    // The graph scales with the window (width and height), so the pointer is
    // mapped through the SVG's own screen matrix into graph units.
    // Without a screen matrix (no layout engine), the graph's box stands in.
    const matrix = typeof svg.getScreenCTM === 'function' ? svg.getScreenCTM() : null;
    const rect = svg.getBoundingClientRect();
    const local = matrix
      ? new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse())
      : {
        x: ((clientX - rect.left) / Math.max(rect.width, 1)) * GRAPH.width,
        y: ((clientY - rect.top) / Math.max(rect.height, 1)) * GRAPH.height,
      };
    const innerWidth = GRAPH.width - GRAPH.padX * 2;
    const innerHeight = GRAPH.height - GRAPH.padY * 2;
    const mouseX = local.x - GRAPH.padX;
    const mouseY = local.y - GRAPH.padY;
    const xClamped = Math.max(0, Math.min(1, parseFloat((mouseX / innerWidth).toFixed(2))));
    const yNormalized = Math.max(0, Math.min(1, 1 - mouseY / innerHeight));
    const yMath = parseFloat((Y_MIN + yNormalized * Y_RANGE).toFixed(2));
    if (point === 1) {
      updatePoints({ x: xClamped, y: yMath }, p2);
    } else {
      updatePoints(p1, { x: xClamped, y: yMath });
    }
  };

  const finishPointerDrag = () => {
    if (!draggingPointRef.current) return;
    draggingPointRef.current = null;
    draggingPointerIdRef.current = null;
    setDraggingPoint(null);
    onBatchEnd?.();
    suppressBackdropClickRef.current = true;
    window.setTimeout(() => {
      suppressBackdropClickRef.current = false;
    }, 0);
  };

  /**
   * C12 — the curve graph: the 0..1 unit box with a quiet grid and the linear
   * diagonal, the overshoot room above and below it (-1..2) shaded instead of
   * labelled, and two handles without captions (their values are the fields
   * under the graph).
   */
  const renderSvgGraph = (ref: React.RefObject<SVGSVGElement | null>) => {
    const { width: svgWidth, height: svgHeight, padX, padY } = GRAPH;
    const innerWidth = svgWidth - padX * 2;
    const innerHeight = svgHeight - padY * 2;
    const mathToSvg = (mx: number, my: number) => ({
      sx: padX + mx * innerWidth,
      sy: padY + innerHeight - ((my - Y_MIN) / Y_RANGE) * innerHeight,
    });

    const startP = mathToSvg(0, 0);
    const endP = mathToSvg(1, 1);
    const handle1P = mathToSvg(p1.x, p1.y);
    const handle2P = mathToSvg(p2.x, p2.y);
    const top = mathToSvg(0, 2);
    const bottom = mathToSvg(0, -1);
    const unitHeight = startP.sy - endP.sy;
    const bezierPathD = `M ${startP.sx},${startP.sy} C ${handle1P.sx},${handle1P.sy} ${handle2P.sx},${handle2P.sy} ${endP.sx},${endP.sy}`;

    const handlePointerDown = (pointNum: 1 | 2, event: React.PointerEvent<SVGGElement>) => {
      event.stopPropagation();
      event.preventDefault();
      draggingPointRef.current = pointNum;
      draggingPointerIdRef.current = event.pointerId;
      setDraggingPoint(pointNum);
      event.currentTarget.setPointerCapture?.(event.pointerId);
      // The whole sweep is one undo entry; the release (or the capture being
      // taken back) closes it.
      onBatchStart?.();
    };

    const handlePointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
      if (draggingPointerIdRef.current !== event.pointerId) return;
      updateDraggedPoint(event.clientX, event.clientY);
    };

    const handlePointerUp = (event: React.PointerEvent<SVGSVGElement>) => {
      if (draggingPointerIdRef.current === event.pointerId) finishPointerDrag();
    };

    const handleLostPointerCapture = (event: React.PointerEvent<SVGSVGElement>) => {
      if (draggingPointerIdRef.current === event.pointerId) finishPointerDrag();
    };

    const handles = [
      { id: 1 as const, at: handle1P, from: startP, className: 'is-out' },
      { id: 2 as const, at: handle2P, from: endP, className: 'is-in' },
    ];

    return (
      <svg
        ref={ref}
        className="ce-curve-svg"
        width={svgWidth}
        height={svgHeight}
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onLostPointerCapture={handleLostPointerCapture}
        style={{ overflow: 'visible', cursor: draggingPoint ? 'grabbing' : 'default', touchAction: 'none' }}
      >
        {/* Overshoot room: above 1 and below 0, up to the editable limits. */}
        <rect className="ce-curve-overshoot" x={padX} y={top.sy} width={innerWidth} height={endP.sy - top.sy} />
        <rect className="ce-curve-overshoot" x={padX} y={startP.sy} width={innerWidth} height={bottom.sy - startP.sy} />
        <line className="ce-curve-limit" x1={padX} y1={top.sy} x2={padX + innerWidth} y2={top.sy} />
        <line className="ce-curve-limit" x1={padX} y1={bottom.sy} x2={padX + innerWidth} y2={bottom.sy} />

        {/* The unit box with a quarter grid and the linear reference. */}
        <rect className="ce-curve-unit" x={startP.sx} y={endP.sy} width={innerWidth} height={unitHeight} />
        {[0.25, 0.5, 0.75].map((step) => (
          <React.Fragment key={step}>
            <line className="ce-curve-grid" x1={startP.sx + step * innerWidth} y1={endP.sy} x2={startP.sx + step * innerWidth} y2={startP.sy} />
            <line className="ce-curve-grid" x1={startP.sx} y1={startP.sy - step * unitHeight} x2={endP.sx} y2={startP.sy - step * unitHeight} />
          </React.Fragment>
        ))}
        <line className="ce-curve-linear" x1={startP.sx} y1={startP.sy} x2={endP.sx} y2={endP.sy} />
        <text className="ce-curve-tick" x={padX - 8} y={endP.sy + 3} textAnchor="end">1</text>
        <text className="ce-curve-tick" x={padX - 8} y={startP.sy + 3} textAnchor="end">0</text>

        {handles.map((handle) => (
          <line key={`arm-${handle.id}`} className={`ce-curve-arm ${handle.className}`} x1={handle.from.sx} y1={handle.from.sy} x2={handle.at.sx} y2={handle.at.sy} />
        ))}
        <path className="ce-curve-path" d={bezierPathD} />
        <circle className="ce-curve-anchor" cx={startP.sx} cy={startP.sy} r={4} />
        <circle className="ce-curve-anchor" cx={endP.sx} cy={endP.sy} r={4} />

        {handles.map((handle) => (
          <g
            key={`handle-${handle.id}`}
            className={`ce-curve-handle ${handle.className}${draggingPoint === handle.id ? ' is-dragging' : ''}`}
            transform={`translate(${handle.at.sx}, ${handle.at.sy})`}
            style={{ cursor: 'grab' }}
            onPointerDown={(event) => handlePointerDown(handle.id, event)}
          >
            <circle className="ce-curve-handle-hit" r={12} />
            <circle className="ce-curve-handle-dot" r={6} />
          </g>
        ))}
      </svg>
    );
  };
  if (!isModalOpen) return null;


  const handleFields = [
    {
      id: 1 as const, point: p1, className: 'is-out', name: 'Out',
      note: segmentFrames ? `leaves F${segmentFrames.from}` : 'leaves the first key',
      set: (next: { x: number; y: number }) => updatePoints(next, p2),
    },
    {
      id: 2 as const, point: p2, className: 'is-in', name: 'In',
      note: segmentFrames ? `arrives at F${segmentFrames.to}` : 'arrives at the next key',
      set: (next: { x: number; y: number }) => updatePoints(p1, next),
    },
  ];

  const close = () => {
    setIsModalOpen(false);
    onCloseModal?.();
  };

  return ReactDOM.createPortal(
    <div
      className="modal-backdrop ce-backdrop"
      onClick={(event) => {
        if (event.target !== event.currentTarget || suppressBackdropClickRef.current || draggingPointRef.current) return;
        close();
      }}
    >
      {/* C12 — one quiet surface: the curve and its numbers on the left; the
          presets, preview and code on the right; no captions on the graph. */}
      <div
        ref={modalCardRef}
        className="bezier-modal-card ce-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bezier-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="ce-header">
          <h2 id="bezier-modal-title" className="ce-title">Motion Curve Editor</h2>
          {segmentFrames ? (
            <span className="ce-segment">
              {segmentChannelLabel ? <strong>{segmentChannelLabel}</strong> : null}
              <span>Segment F{segmentFrames.from} → F{segmentFrames.to}</span>
            </span>
          ) : (
            <span className="ce-segment is-empty">No segment selected</span>
          )}
          <button type="button" className="ce-close" onClick={close} title="Close" aria-label="Close">
            <X size={15} />
          </button>
        </header>

        {/* No segment: explain instead of editing an unrelated keyframe. */}
        {inactiveReason && (
          <div className="ce-empty" role="status">
            <p className="ce-empty-title">No curve to shape here</p>
            <p className="ce-empty-body">{inactiveReason}</p>
          </div>
        )}

        {!inactiveReason && (
        <div className="ce-body">
          <div className="ce-main">
            <div className="bezier-graph-surface ce-graph">
              {renderSvgGraph(modalSvgRef)}
            </div>

            <div className="ce-handle-row">
              {handleFields.map((handle) => (
                <div key={handle.id} className={`ce-handle-field ${handle.className}`}>
                  <span className="ce-handle-name">
                    <span className="ce-handle-swatch" aria-hidden="true" />
                    {handle.name}
                    <span className="ce-handle-note">{handle.note}</span>
                  </span>
                  <label className="ce-number" htmlFor={`bezier-p${handle.id}-x`}>
                    <span>X{handle.id}</span>
                    <NumberField id={`bezier-p${handle.id}-x`} className="input-control"
                      min={0}
                      max={1}
                      step={0.05}
                      value={handle.point.x}
                      onValue={(next) => handle.set({ x: clampControlPoint(next, 0, 1), y: handle.point.y })}
                    />
                  </label>
                  <label className="ce-number" htmlFor={`bezier-p${handle.id}-y`}>
                    <span>Y{handle.id}</span>
                    <NumberField id={`bezier-p${handle.id}-y`} className="input-control"
                      min={-1}
                      max={2}
                      step={0.05}
                      value={handle.point.y}
                      onValue={(next) => handle.set({ x: handle.point.x, y: clampControlPoint(next, -1, 2) })}
                    />
                  </label>
                </div>
              ))}
            </div>

            {onChangeKeyframeValue && (
              <section className="ce-card ce-value-graph">
                <div className="ce-segmented" role="group" aria-label="Graph">
                  {(['value', 'speed'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      aria-pressed={graphMode === mode}
                      onClick={() => setGraphMode(mode)}
                    >
                      {mode === 'value' ? 'Value Graph' : 'Speed Graph'}
                    </button>
                  ))}
                </div>
                <TemporalGraphPanel
                  keyframes={valueKeyframes}
                  mode={graphMode}
                  onChangeKeyframeValue={onChangeKeyframeValue}
                  onChangeKeyframeHandles={onChangeKeyframeHandles}
                  onApplySegmentPreset={onApplySegmentPreset}
                  onInteractionStart={onBatchStart}
                  onInteractionEnd={onBatchEnd}
                />
              </section>
            )}
          </div>

          <aside className="ce-side">
            <section className="ce-section">
              <h3 className="ce-section-title">Presets</h3>
              <div className="ce-presets">
                {PRESET_BEZIERS.map((preset) => {
                  const active = preset.points[0] === p1.x && preset.points[1] === p1.y && preset.points[2] === p2.x && preset.points[3] === p2.y;
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      className={`ce-preset${active ? ' is-active' : ''}`}
                      onClick={() => updatePoints({ x: preset.points[0], y: preset.points[1] }, { x: preset.points[2], y: preset.points[3] })}
                    >
                      <svg className="ce-preset-icon" width={32} height={22} viewBox="0 0 32 22" aria-hidden="true">
                        <path d={presetIconPath(preset.points)} />
                      </svg>
                      <span>{preset.label}</span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="ce-section">
              <h3 className="ce-section-title">Preview</h3>
              <div className="ce-preview">
                <button
                  type="button"
                  className="ce-play"
                  onClick={() => {
                    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
                    setIsPreviewPlaying((playing) => !playing);
                  }}
                  title={isPreviewPlaying ? 'Pause Preview' : 'Play Preview'}
                  aria-label={isPreviewPlaying ? 'Pause Preview' : 'Play Preview'}
                >
                  {isPreviewPlaying ? <Pause size={13} /> : <Play size={13} />}
                </button>
                <div className="ce-preview-stage" data-testid="bezier-mini-stage">
                  <div className="ce-preview-track" />
                  <div ref={previewBallRef} className={`ce-preview-ball${isPreviewPlaying ? ' is-playing' : ''}`} />
                </div>
              </div>
              <div className="ce-segmented ce-speed" role="group" aria-label="Preview duration">
                {[0.6, 1.2, 1.8, 3.0].map((dur) => (
                  <button
                    key={dur}
                    type="button"
                    aria-pressed={previewDuration === dur}
                    onClick={() => setPreviewDuration(dur)}
                  >
                    {dur}s
                  </button>
                ))}
              </div>
              <span className="ce-visually-hidden" aria-live="polite">
                {isPreviewPlaying ? 'Playing preview' : 'Preview paused'} · {getMotionAnalysis()}
              </span>
            </section>

            <section className="ce-section">
              <h3 className="ce-section-title">CSS easing</h3>
              <div className="ce-code">
                <code title={cssString}>{cssString}</code>
                <button type="button" className="ce-icon-button" onClick={copyToClipboard} title="Copy CSS code" aria-label="Copy CSS code">
                  {copied ? <Check size={13} /> : <Copy size={13} />}
                </button>
              </div>
              <div className="ce-paste">
                <input
                  className="input-control"
                  aria-label="Paste easing code"
                  placeholder="Paste cubic-bezier(…)"
                  value={pasteText}
                  onChange={(event) => { setPasteText(event.target.value); setPasteError(null); }}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter') return;
                    event.preventDefault();
                    applyPastedEasing();
                  }}
                />
                <button type="button" className="btn-secondary" disabled={pasteText.trim() === ''} onClick={applyPastedEasing}>Use</button>
              </div>
              {pasteError && <p role="alert" className="ce-error">{pasteError}</p>}
            </section>

            <button type="button" className="ce-apply" onClick={close}>
              <Check size={15} />
              <span>Apply</span>
            </button>
          </aside>
        </div>
        )}
      </div>
    </div>,
    document.body
  );
};
