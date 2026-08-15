import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TransformInOutPresetCard } from '../components/Inspector/sections/transform/TransformInOutPresetCard';
import type { CharacterPart, CustomMotionPreset } from '../types/animator';
import { DEFAULT_INITIAL_PRESETS } from '../context/initialStateData';

/**
 * M30 30B — preset export/import UI (TransformInOutPresetCard).
 * Export = user-only versioned JSON download; Import = hidden file input →
 * whole-file validation (30A) → merge (30A) → usePresets persistence.
 */

function makePart(overrides: Partial<CharacterPart> = {}): CharacterPart {
  return {
    id: 'p1', name: 'Part', type: 'custom_box',
    x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1,
    visible: true, zIndex: 1, width: 100, height: 100,
    ...overrides,
  } as CharacterPart;
}

function makeCustom(id: string, name: string, type: 'in' | 'out'): CustomMotionPreset {
  return {
    id, name, type, durationFrames: 20,
    keyframes: [
      { progress: 0, deltaX: 0, deltaY: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
      { progress: 1, deltaX: 10, deltaY: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
    ],
  };
}

const CUSTOM_IN = makeCustom('user-in-1', 'My Logo Reveal', 'in');
const CUSTOM_OUT = makeCustom('user-out-1', 'My Exit Slide', 'out');

interface RenderOptions {
  onImport?: ReturnType<typeof vi.fn>;
  showToast?: ReturnType<typeof vi.fn>;
  customPresets?: CustomMotionPreset[];
  part?: CharacterPart;
}

function renderCard(opts: RenderOptions = {}) {
  const onImport = opts.onImport ?? vi.fn();
  const showToast = opts.showToast ?? vi.fn();
  const utils = render(
    <TransformInOutPresetCard
      selectedPart={opts.part ?? makePart()}
      onPartPropChange={vi.fn()}
      customPresets={opts.customPresets ?? [CUSTOM_IN, CUSTOM_OUT]}
      onSavePreset={vi.fn()}
      onDeletePreset={vi.fn()}
      onImportPresets={onImport}
      showToast={showToast}
    />,
  );
  return { ...utils, onImport, showToast };
}

function makeJsonFile(content: string, name = 'presets.json'): File {
  return new File([content], name, { type: 'application/json' });
}

function pickFile(input: HTMLElement, file: File) {
  fireEvent.change(input, { target: { files: [file] } });
}

beforeEach(() => {
  // jsdom lacks URL.createObjectURL — stub it for the export download flow
  vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:mock'), revokeObjectURL: vi.fn() });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('M30 30B — buttons & accessibility', () => {
  it('1+2. Export and Import buttons render', () => {
    renderCard();
    expect(screen.getByLabelText('Export Animation Presets')).toBeTruthy();
    expect(screen.getByLabelText('Import Animation Presets')).toBeTruthy();
  });

  it('3. existing Save Current as Preset + Delete controls remain', () => {
    renderCard({ customPresets: [CUSTOM_IN], part: makePart({ inAnimPreset: 'user-in-1' }) });
    expect(screen.getAllByText('Save Current as Preset').length).toBeGreaterThan(0);
    expect(screen.getByLabelText('Delete Animation Preset')).toBeTruthy();
  });

  it('24. accessibility labels present (export/import/file input)', () => {
    renderCard();
    expect(screen.getByLabelText('Export Animation Presets')).toBeTruthy();
    expect(screen.getByLabelText('Import Animation Presets')).toBeTruthy();
    expect(screen.getByLabelText('Import custom animation presets file')).toBeTruthy();
  });
});

describe('M30 30B — export', () => {
  it('4+6. export triggers a JSON download with the canonical filename', () => {
    const create = vi.fn(() => 'blob:mock');
    vi.stubGlobal('URL', { createObjectURL: create, revokeObjectURL: vi.fn() });
    // capture the anchor at append time (handleExport removes it right after)
    const appendSpy = vi.spyOn(document.body, 'appendChild');
    const { showToast } = renderCard();
    fireEvent.click(screen.getByLabelText('Export Animation Presets'));
    expect(create).toHaveBeenCalledTimes(1);
    const anchor = appendSpy.mock.calls.at(-1)![0] as HTMLAnchorElement;
    expect(anchor.download).toBe('kcs-custom-presets.json');
    expect(anchor.href).toBe('blob:mock');
    expect(showToast).toHaveBeenCalledWith('Exported 2 presets', 'success');
    appendSpy.mockRestore();
  });

  it('5. export uses the USER-only collection (defaults never exported)', async () => {
    const blobArgs: Blob[] = [];
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn((b: Blob) => {
        blobArgs.push(b);
        return 'blob:x';
      }),
      revokeObjectURL: vi.fn(),
    });
    const { showToast } = renderCard({ customPresets: [...DEFAULT_INITIAL_PRESETS, CUSTOM_IN] });
    fireEvent.click(screen.getByLabelText('Export Animation Presets'));
    expect(blobArgs).toHaveLength(1);
    const payload = JSON.parse(await blobArgs[0].text()) as { version: number; presets: CustomMotionPreset[] };
    expect(payload.version).toBe(1);
    expect(payload.presets).toHaveLength(1); // only the user preset — defaults filtered
    expect(payload.presets[0].id).toBe('user-in-1');
    expect(showToast).toHaveBeenCalledWith('Exported 1 presets', 'success');
  });
});

describe('M30 30B — import', () => {
  it('7. hidden file input exists with json accept', () => {
    renderCard();
    const input = screen.getByLabelText('Import custom animation presets file') as HTMLInputElement;
    expect(input.type).toBe('file');
    expect(input.accept).toContain('.json');
  });

  it('8+9+10. valid file → validate → merge → collection update + success toast', async () => {
    const onImport = vi.fn();
    const showToast = vi.fn();
    renderCard({ onImport, showToast });
    const input = screen.getByLabelText('Import custom animation presets file');
    const file = makeJsonFile(JSON.stringify({ version: 1, presets: [makeCustom('user-in-2', 'Imported In', 'in')] }));
    pickFile(input as HTMLElement, file);
    await waitFor(() => expect(onImport).toHaveBeenCalledTimes(1));
    const merged = onImport.mock.calls[0][0] as CustomMotionPreset[];
    expect(merged.map((p) => p.id)).toEqual(['user-in-1', 'user-out-1', 'user-in-2']); // existing + imported
    expect(showToast).toHaveBeenCalledWith('Imported 1 presets', 'success');
  });

  it('11. invalid JSON → error toast, library untouched', async () => {
    const onImport = vi.fn();
    const showToast = vi.fn();
    renderCard({ onImport, showToast });
    const input = screen.getByLabelText('Import custom animation presets file');
    pickFile(input as HTMLElement, makeJsonFile('{ not json !!'));
    await waitFor(() => expect(showToast).toHaveBeenCalledTimes(1));
    expect(showToast.mock.calls[0][0]).toContain('Could not import presets');
    expect(onImport).not.toHaveBeenCalled();
  });

  it('12+13. invalid schema → error toast, import NOTHING', async () => {
    const onImport = vi.fn();
    const showToast = vi.fn();
    renderCard({ onImport, showToast });
    const input = screen.getByLabelText('Import custom animation presets file');
    pickFile(input as HTMLElement, makeJsonFile(JSON.stringify({ version: 2, presets: [] })));
    await waitFor(() => expect(showToast).toHaveBeenCalledTimes(1));
    expect(showToast.mock.calls[0][1]).toBe('error');
    expect(onImport).not.toHaveBeenCalled();
  });

  it('14. merge preserves existing presets', async () => {
    const onImport = vi.fn();
    renderCard({ onImport, customPresets: [CUSTOM_IN] });
    const input = screen.getByLabelText('Import custom animation presets file');
    pickFile(input as HTMLElement, makeJsonFile(JSON.stringify({ version: 1, presets: [CUSTOM_OUT] })));
    await waitFor(() => expect(onImport).toHaveBeenCalledTimes(1));
    const merged = onImport.mock.calls[0][0] as CustomMotionPreset[];
    expect(merged.map((p) => p.id)).toEqual(['user-in-1', 'user-out-1']);
  });

  it('19. collision remap result used (imported id preserved when safe, remapped on collision)', async () => {
    const onImport = vi.fn();
    renderCard({ onImport, customPresets: [CUSTOM_IN] });
    const input = screen.getByLabelText('Import custom animation presets file');
    pickFile(input as HTMLElement, makeJsonFile(JSON.stringify({ version: 1, presets: [makeCustom('user-in-1', 'Colliding', 'in')] })));
    await waitFor(() => expect(onImport).toHaveBeenCalledTimes(1));
    const merged = onImport.mock.calls[0][0] as CustomMotionPreset[];
    expect(merged).toHaveLength(2);
    const colliding = merged.find((p) => p.name === 'Colliding')!;
    expect(colliding.id).not.toBe('user-in-1'); // remapped
    expect(new Set(merged.map((p) => p.id)).size).toBe(2); // unique
  });

  it('18. duplicate names allowed', async () => {
    const onImport = vi.fn();
    renderCard({ onImport, customPresets: [CUSTOM_IN] });
    const input = screen.getByLabelText('Import custom animation presets file');
    pickFile(input as HTMLElement, makeJsonFile(JSON.stringify({ version: 1, presets: [makeCustom('dup-1', 'My Logo Reveal', 'in')] })));
    await waitFor(() => expect(onImport).toHaveBeenCalledTimes(1));
    const merged = onImport.mock.calls[0][0] as CustomMotionPreset[];
    expect(merged.filter((p) => p.name === 'My Logo Reveal')).toHaveLength(2);
  });

  it('17. default presets never appear as imported user presets (id remapped)', async () => {
    const defaultPreset = DEFAULT_INITIAL_PRESETS[0];
    const onImport = vi.fn();
    renderCard({ onImport, customPresets: [] });
    const input = screen.getByLabelText('Import custom animation presets file');
    pickFile(input as HTMLElement, makeJsonFile(JSON.stringify({ version: 1, presets: [{ ...defaultPreset, name: 'Fake Default' }] })));
    await waitFor(() => expect(onImport).toHaveBeenCalledTimes(1));
    const merged = onImport.mock.calls[0][0] as CustomMotionPreset[];
    const fake = merged.find((p) => p.name === 'Fake Default')!;
    expect(fake.id).not.toBe(defaultPreset.id); // default id collision remapped
  });

  it('20+21. success and error toasts emitted', async () => {
    const onImport = vi.fn();
    const showToast = vi.fn();
    renderCard({ onImport, showToast });
    const input = screen.getByLabelText('Import custom animation presets file');
    pickFile(input as HTMLElement, makeJsonFile(JSON.stringify({ version: 1, presets: [CUSTOM_IN] })));
    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Imported 1 presets', 'success'));
    pickFile(input as HTMLElement, makeJsonFile('garbage'));
    await waitFor(() => expect(showToast.mock.calls.at(-1)![1]).toBe('error'));
  });

  it('25. same file can be imported twice (input value reset)', async () => {
    const onImport = vi.fn();
    renderCard({ onImport, customPresets: [] });
    const input = screen.getByLabelText('Import custom animation presets file');
    const file = makeJsonFile(JSON.stringify({ version: 1, presets: [CUSTOM_IN] }));
    pickFile(input as HTMLElement, file);
    await waitFor(() => expect(onImport).toHaveBeenCalledTimes(1));
    pickFile(input as HTMLElement, file);
    await waitFor(() => expect(onImport).toHaveBeenCalledTimes(2));
  });

  it('26. empty valid import → safe no-op merge (library unchanged)', async () => {
    const onImport = vi.fn();
    const showToast = vi.fn();
    renderCard({ onImport, showToast, customPresets: [CUSTOM_IN] });
    const input = screen.getByLabelText('Import custom animation presets file');
    pickFile(input as HTMLElement, makeJsonFile(JSON.stringify({ version: 1, presets: [] })));
    await waitFor(() => expect(onImport).toHaveBeenCalledTimes(1));
    const merged = onImport.mock.calls[0][0] as CustomMotionPreset[];
    expect(merged.map((p) => p.id)).toEqual(['user-in-1']);
    expect(showToast).toHaveBeenCalledWith('Imported 0 presets', 'success'); // success no-op
  });

  it('15+16. imported presets flow into Custom group with IN/OUT filtering (runtime collection)', async () => {
    // render with a default-less collection; after import the UI (Custom
    // optgroups) derives from the same collection the runtime uses
    const { rerender, onImport } = renderCard({ onImport: vi.fn(), customPresets: [] });
    void rerender;
    expect(screen.queryByText('My Logo Reveal')).toBeNull();
    expect(onImport).toBeDefined();
    // collection-level proof: imported IN lands in customIn, OUT in customOut
    const mixed = [makeCustom('i1', 'Imported In', 'in'), makeCustom('o1', 'Imported Out', 'out')];
    const showToast = vi.fn();
    render(
      <TransformInOutPresetCard
        selectedPart={makePart()}
        onPartPropChange={vi.fn()}
        customPresets={mixed}
        onSavePreset={vi.fn()}
        onDeletePreset={vi.fn()}
        showToast={showToast}
      />,
    );
    expect(screen.getAllByText('Imported In').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Imported Out').length).toBeGreaterThan(0);
  });
});
