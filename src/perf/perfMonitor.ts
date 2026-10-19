/**
 * Opt-in diagnostics for local measurement (`?perf` in the page URL).
 *
 * Contract:
 *  - Disabled unless the query parameter is present. When disabled this module
 *    attaches no observers, mounts no DOM, ships no styles, and each
 *    `perfCount` call site costs one null check.
 *  - Never sends anything anywhere: metrics render into a DOM overlay only,
 *    and no scene content is read or displayed — counts and timings only.
 *  - Every collector is feature-detected; unsupported sources are listed as
 *    a visible caveat line, never an exception.
 *  - Labels state what is sampled. A single session cannot yield a
 *    statistically valid p75 INP, so interactions report the session maximum
 *    and say so; heap is reported as Chrome-only sampled usage, not
 *    allocation totals.
 */

interface PerfCounters {
  playbackTicks: number;
  stageRenders: number;
  partEvaluations: number;
}

export interface PerfSnapshot {
  enabled: boolean;
  counters: PerfCounters;
  frameDurations: number[];
  longTasks: number[];
  interactions: number[];
  domNodes: number;
  heapUsedBytes: number | null;
  unsupported: string[];
}

const enabled = new URLSearchParams(window.location.search).has('perf');

const counters: PerfCounters | null = enabled
  ? { playbackTicks: 0, stageRenders: 0, partEvaluations: 0 }
  : null;
const frameDurations: number[] = [];
const longTasks: number[] = [];
const interactions: number[] = [];
const unsupported: string[] = [];
let longAnimationFrameSupported = false;
let lastFrameTime = 0;
let domNodes = 0;
let heapUsedBytes: number | null = null;

function usedHeapBytes(): number | null {
  const memory = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
  return memory ? memory.usedJSHeapSize : null;
}

// Seam: jsdom exposes no performance.memory and cannot be made to fake it;
// tests inject a probe. Production calls installPerfMonitor() with no
// argument and keeps reading Chrome's object.
let readHeap: () => number | null = usedHeapBytes;

/** No-op (one null check) unless `?perf` is active. Safe at any call frequency. */
export function perfCount(kind: keyof PerfCounters, times = 1): void {
  if (!counters) return;
  counters[kind] += times;
}

function observe(type: string, options: PerformanceObserverInit, onEntry: (entry: PerformanceEntry) => void): boolean {
  if (typeof PerformanceObserver === 'undefined') {
    unsupported.push(type);
    return false;
  }
  try {
    const observer = new PerformanceObserver((list) => list.getEntries().forEach(onEntry));
    // The type is mandatory in the observe call — options without it arm
    // nothing and fail only later, which is how the first version died
    // silently in Chromium.
    observer.observe({ ...options, type });
    return true;
  } catch {
    unsupported.push(type);
    return false;
  }
}

function startCollectors(): void {
  observe('longtask', { buffered: true }, (entry) => {
    if (longTasks.length < 200) longTasks.push(entry.duration);
  });

  // LoAF subsumes long-task-style jank in supporting browsers; keep the
  // observer only when the type is accepted, and say which mode is active.
  if (observe('long-animation-frame', { buffered: true }, (entry) => {
    if (entry.duration > 50 && longTasks.length < 200) longTasks.push(entry.duration);
  })) {
    longAnimationFrameSupported = true;
  }

  observe('event', { durationThreshold: 40, buffered: true } as PerformanceObserverInit, (entry) => {
    if (interactions.length < 200) interactions.push(entry.duration);
  });

  if (readHeap() === null) unsupported.push('memory');
}

function sample(): void {
  domNodes = document.getElementsByTagName('*').length;
  heapUsedBytes = readHeap();
}

function frameLoop(now: number): void {
  if (lastFrameTime > 0) {
    const delta = now - lastFrameTime;
    // Ignore suspend/resume gaps; a hidden tab is not a frame-budget story.
    if (delta < 1000 && frameDurations.length < 600) frameDurations.push(delta);
  }
  lastFrameTime = now;
  window.requestAnimationFrame(frameLoop);
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] as number;
}

function formatSnapshot(): string {
  const parts: string[] = [];
  parts.push(`frame p50 ${percentile(frameDurations, 0.5).toFixed(1)}ms p95 ${percentile(frameDurations, 0.95).toFixed(1)}ms`);
  parts.push(`long tasks ${longTasks.length} (${longAnimationFrameSupported ? 'LoAF+longtask' : 'longtask only'})`);
  const worst = interactions.length ? Math.max(...interactions) : 0;
  parts.push(`worst interaction ${worst.toFixed(0)}ms (session max, not INP p75)`);
  parts.push(`DOM ${domNodes}`);
  parts.push(`heap ${heapUsedBytes === null ? 'n/a' : `${(heapUsedBytes / 1048576).toFixed(1)} MB in use (sampled, Chrome only; not allocation totals)`}`);
  parts.push(`ticks ${counters?.playbackTicks ?? 0} · renders ${counters?.stageRenders ?? 0} · evals ${counters?.partEvaluations ?? 0}`);
  if (unsupported.length) parts.push(`unavailable: ${unsupported.join(', ')}`);
  return parts.join('  |  ');
}

const OVERLAY_STYLE = 'position:fixed;left:8px;bottom:8px;z-index:2147483000;font:11px/1.5 monospace;'
  + 'background:rgba(16,18,24,.92);color:#e8ecf5;padding:6px 10px;border-radius:6px;'
  + 'pointer-events:none;max-width:min(90vw,900px);white-space:pre-wrap';

/** Installs collectors + overlay. Returns false (and touches nothing) when disabled. */
export function installPerfMonitor(heapProbe?: () => number | null): boolean {
  if (!enabled) return false;
  readHeap = heapProbe ?? usedHeapBytes;
  startCollectors();
  const style = document.createElement('style');
  style.textContent = `.kcs-perf-overlay{${OVERLAY_STYLE}}`;
  document.head.appendChild(style);
  const overlay = document.createElement('div');
  overlay.className = 'kcs-perf-overlay';
  overlay.setAttribute('role', 'status');
  overlay.setAttribute('aria-label', 'Performance diagnostics (?perf)');
  document.body.appendChild(overlay);
  window.requestAnimationFrame(frameLoop);
  sample();
  window.setInterval(sample, 1000);
  window.setInterval(() => {
    overlay.textContent = formatSnapshot();
  }, 1000);
  return true;
}

/** Read-only view of the live aggregate state (tests and console poking). */
export function perfSnapshot(): PerfSnapshot {
  return {
    enabled,
    counters: counters ? { ...counters } : { playbackTicks: 0, stageRenders: 0, partEvaluations: 0 },
    frameDurations: [...frameDurations],
    longTasks: [...longTasks],
    interactions: [...interactions],
    domNodes,
    heapUsedBytes,
    unsupported: [...unsupported],
  };
}
