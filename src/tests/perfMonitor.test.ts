// C2 — ?perf instrumentation: disabled-by-default, graceful feature
// detection, counters behind one null check, overlay only when installed.
import { afterEach, describe, expect, it, vi } from 'vitest';

type MonitorModule = typeof import('../perf/perfMonitor');

async function loadMonitor(search: string): Promise<MonitorModule> {
  window.history.pushState({}, '', `${search ? `/x${search}` : '/x'}`);
  vi.resetModules();
  return import('../perf/perfMonitor');
}

afterEach(() => {
  delete (performance as unknown as { memory?: unknown }).memory;
  window.history.pushState({}, '', '/x');
  document.querySelector('.kcs-perf-overlay')?.remove();
});

describe('C2 — perfMonitor', () => {
  it('without ?perf: install touches nothing and counters stay zero', async () => {
    const { installPerfMonitor, perfCount, perfSnapshot } = await loadMonitor('');
    expect(installPerfMonitor()).toBe(false);
    perfCount('playbackTicks');
    perfCount('stageRenders');
    perfCount('partEvaluations', 40);
    const snapshot = perfSnapshot();
    expect(snapshot.enabled).toBe(false);
    expect(snapshot.counters).toEqual({ playbackTicks: 0, stageRenders: 0, partEvaluations: 0 });
    expect(document.querySelector('.kcs-perf-overlay')).toBeNull();
  });

  it('with ?perf: install mounts the overlay and counters aggregate', async () => {
    const { installPerfMonitor, perfCount, perfSnapshot } = await loadMonitor('?perf');
    expect(installPerfMonitor()).toBe(true);
    const overlay = document.querySelector('.kcs-perf-overlay');
    expect(overlay).not.toBeNull();
    expect(overlay?.getAttribute('role')).toBe('status');
    perfCount('playbackTicks');
    perfCount('partEvaluations', 3);
    const snapshot = perfSnapshot();
    expect(snapshot.enabled).toBe(true);
    expect(snapshot.counters.playbackTicks).toBe(1);
    expect(snapshot.counters.partEvaluations).toBe(3);
  });

  it('with ?perf: unsupported collectors degrade to a caveat list, never a throw', async () => {
    const Original = window.PerformanceObserver;
    // @ts-expect-error deliberately remove the API to prove the guard
    delete window.PerformanceObserver;
    try {
      const { installPerfMonitor, perfSnapshot } = await loadMonitor('?perf');
      expect(() => installPerfMonitor()).not.toThrow();
      const snapshot = perfSnapshot();
      expect(snapshot.unsupported).toEqual(expect.arrayContaining(['longtask', 'long-animation-frame', 'event']));
    } finally {
      window.PerformanceObserver = Original;
    }
  });

  it('with ?perf: every observer is armed with its entry type', async () => {
    // C1 usage caught the original bug: observe(options) without `type` arms
    // nothing and the overlay silently reports every collector unavailable.
    const observed: PerformanceObserverInit[] = [];
    class SpyPO {
      constructor(_cb: PerformanceObserverCallback) { /* capture only */ }
      observe(options?: PerformanceObserverInit) { observed.push(options ?? {}); }
      disconnect() { /* noop */ }
      takeRecords(): PerformanceEntry[] { return []; }
    }
    const Original = window.PerformanceObserver;
    // @ts-expect-error structural spy
    window.PerformanceObserver = SpyPO;
    try {
      const { installPerfMonitor, perfSnapshot } = await loadMonitor('?perf');
      expect(installPerfMonitor()).toBe(true);
      const types = observed.map((options) => options.type);
      expect(types).toContain('longtask');
      expect(types).toContain('long-animation-frame');
      expect(types).toContain('event');
      expect(perfSnapshot().unsupported).not.toContain('longtask');
    } finally {
      window.PerformanceObserver = Original;
    }
  });

  it('with ?perf: labels carry the sampling caveats', async () => {
    // The heap caveat string only renders on the value branch; jsdom has no
    // performance.memory, so the probe arrives via the install seam.
    vi.useFakeTimers();
    try {
      const { installPerfMonitor } = await loadMonitor('?perf');
      expect(installPerfMonitor(() => 12_345_678)).toBe(true);
      vi.advanceTimersByTime(1100);
    } finally {
      vi.useRealTimers();
    }
    const text = document.querySelector('.kcs-perf-overlay')?.textContent ?? '';
    expect(text).toContain('session max, not INP p75');
    expect(text).toContain('not allocation totals');
  });
});
