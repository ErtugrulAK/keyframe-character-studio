import { afterEach, describe, expect, it, vi } from 'vitest';
import { unzipSync } from 'fflate';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { compileOGrafPackage } from '../ograf/packageCompiler';
import { sanitizeOGrafDownloadName } from '../ograf/browserZip';
import type { SceneData, SceneLayer } from '../types/composition';

const { context, createZipMock } = vi.hoisted(() => ({
  context: {
    exportProject: vi.fn(),
    importProject: vi.fn(),
    resetProject: vi.fn(),
    lastSavedAt: null,
    triggerManualSave: vi.fn(),
    showToast: vi.fn(),
    appMode: 'edit',
    setAppMode: vi.fn(),
    sceneTitle: 'My Project / Demo',
    projectTemplates: [],
    activeProjectTemplateId: 'default',
    setActiveProjectTemplateId: vi.fn(),
    addProjectTemplate: vi.fn(),
    renameProjectTemplate: vi.fn(),
    deleteProjectTemplate: vi.fn(),
    fps: 60,
    setFps: vi.fn(),
  },
  createZipMock: vi.fn(),
}));

vi.mock('../context/AnimatorContext', () => ({ useAnimator: () => context }));
vi.mock('../components/Modal/NewItemModal', () => ({ NewItemModal: () => null }));
vi.mock('../ograf/browserZip', async () => {
  const actual = await vi.importActual<typeof import('../ograf/browserZip')>('../ograf/browserZip');
  return { ...actual, createOGrafBrowserZip: createZipMock };
});

import { HeaderBar } from '../components/Header/HeaderBar';

function makeLayer(overrides: Partial<SceneLayer> = {}): SceneLayer {
  return {
    id: 'shape', name: 'Shape', type: 'custom_box', x: 0, y: 0, rotation: 0,
    scaleX: 1, scaleY: 1, opacity: 1, visible: true, zIndex: 0,
    fillColor: '#fff', strokeColor: '#000', ...overrides,
  };
}

function makeScene(layerValue: SceneLayer = makeLayer()): SceneData {
  return { version: 1, coordinateSystem: 'project-unit-center-v1', name: 'My Project / Demo', width: 320, height: 180, fps: 60, totalFrames: 60, layers: [layerValue], tracks: [] };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  context.showToast.mockClear();
  context.exportProject.mockReset();
  createZipMock.mockReset();
});

describe('browser OGraf ZIP writer', () => {
  it('creates a deterministic ZIP with the validated OGraf package files', async () => {
    const plan = compileOGrafPackage(makeScene());
    const actualWriter = await vi.importActual<typeof import('../ograf/browserZip')>('../ograf/browserZip');
    const first = await actualWriter.createOGrafBrowserZip(plan);
    const second = await actualWriter.createOGrafBrowserZip(plan);
    const firstFiles = Object.keys(unzipSync(first.bytes)).sort();
    expect(first.fileName).toBe('my-project-demo-ograf.zip');
    expect(first.bytes).toEqual(second.bytes);
    expect(firstFiles).toEqual(['graphic.mjs', 'my-project-demo.ograf.json', 'scene.kcs']);
    expect(new TextDecoder().decode(unzipSync(first.bytes)['scene.kcs'])).toContain('project-unit-center-v1');
  });

  it('sanitizes deterministic download names', () => {
    expect(sanitizeOGrafDownloadName(' Ä Project / Demo ')).toBe('a-project-demo');
    expect(sanitizeOGrafDownloadName('')).toBe('graphic');
  });
});

describe('HeaderBar OGraf export integration', () => {
  it('exposes one Export menu with JSON and OGraf choices; Video is absent', async () => {
    context.exportProject.mockReturnValue(JSON.stringify(makeScene()));
    createZipMock.mockResolvedValue({ fileName: 'my-project-demo-ograf.zip', bytes: new Uint8Array([80, 75, 3, 4]) });
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:ograf'), revokeObjectURL: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    render(<HeaderBar />);
    expect(screen.getByRole('button', { name: 'Export', exact: true })).toBeTruthy();
    expect(screen.queryByText('Export Video')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Export', exact: true }));
    expect(screen.getByRole('menuitem', { name: 'JSON', exact: true })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: 'OGraf', exact: true })).toBeTruthy();
    fireEvent.click(screen.getByRole('menuitem', { name: 'OGraf', exact: true }));
    await waitFor(() => expect(click).toHaveBeenCalledTimes(1));
    expect(context.showToast).toHaveBeenCalledWith('Exported "my-project-demo-ograf.zip"', 'success');

    fireEvent.click(screen.getByRole('button', { name: 'Export', exact: true }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'JSON', exact: true }));
    expect(context.exportProject).toHaveBeenCalledTimes(2);
  });

  it('blocks unsupported and missing-asset scenes with actionable diagnostics', async () => {
    context.exportProject.mockReturnValue(JSON.stringify(makeScene(makeLayer({ type: 'custom_video', videoUrl: 'video.mp4' }))));
    const createObjectURL = vi.fn(() => 'blob:should-not-download');
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL: vi.fn() });
    render(<HeaderBar />);

    fireEvent.click(screen.getByRole('button', { name: 'Export', exact: true }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'OGraf', exact: true }));
    await waitFor(() => expect(context.showToast).toHaveBeenCalled());
    expect(context.showToast.mock.calls[0][0]).toContain('custom_video');
    expect(createObjectURL).not.toHaveBeenCalled();

    cleanup();
    context.showToast.mockClear();
    context.exportProject.mockReturnValue(JSON.stringify(makeScene(makeLayer({ type: 'custom_image', imageUrl: 'assets/missing.png' }))));
    render(<HeaderBar />);
    fireEvent.click(screen.getByRole('button', { name: 'Export', exact: true }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'OGraf', exact: true }));
    await waitFor(() => expect(context.showToast).toHaveBeenCalled());
    expect(context.showToast.mock.calls[0][0]).toContain('asset');
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it('prevents duplicate concurrent exports while preparation is active', async () => {
    context.exportProject.mockReturnValue(JSON.stringify(makeScene()));
    const { promise: zipPromise, resolve: resolveZip } = Promise.withResolvers<{ fileName: string; bytes: Uint8Array }>();
    createZipMock.mockReturnValue(zipPromise);
    render(<HeaderBar />);

    fireEvent.click(screen.getByRole('button', { name: 'Export', exact: true }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'OGraf', exact: true }));
    expect(createZipMock).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Export', exact: true }));
    const menuItem = screen.getByRole('menuitem', { name: /OGraf/u }) as HTMLButtonElement;
    expect(menuItem.disabled).toBe(true);
    fireEvent.click(menuItem);
    expect(createZipMock).toHaveBeenCalledTimes(1);

    resolveZip?.({ fileName: 'project-ograf.zip', bytes: new Uint8Array([1]) });
    await waitFor(() => expect(menuItem.disabled).toBe(false));
  });
});
