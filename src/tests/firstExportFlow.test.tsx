import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import type { SceneData, SceneLayer } from '../types/composition';

/**
 * Milestone C — HeaderBar first-export flow: the guidance panel compiles the
 * scene through the same OGraf pipeline the export uses, so the readiness answer
 * matches the diagnostics of that compile, a scene with a blocking finding is
 * never summarised as ready, and the check never writes a package.
 */

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

function makeScene(layers: SceneLayer[] = [makeLayer()]): SceneData {
  return {
    version: 1, coordinateSystem: 'project-unit-center-v1', name: 'My Project / Demo',
    width: 320, height: 180, fps: 60, totalFrames: 60, layers, tracks: [],
  };
}

const openGuideAndCheck = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'First export help' }));
  fireEvent.click(screen.getByRole('button', { name: 'Check export readiness' }));
  await waitFor(() => expect(context.showToast).toHaveBeenCalledTimes(1));
};

afterEach(() => {
  cleanup();
  context.showToast.mockClear();
  context.exportProject.mockReset();
  createZipMock.mockReset();
});

describe('HeaderBar first-export guidance', () => {
  it('keeps the guide hidden until it is asked for and never writes a package', async () => {
    context.exportProject.mockReturnValue(JSON.stringify(makeScene()));
    render(<HeaderBar />);

    expect(screen.queryByRole('group', { name: 'First export help' })).toBeNull();

    await openGuideAndCheck();

    expect(createZipMock).not.toHaveBeenCalled();
  });

  it('reports ready for an exportable scene and does not claim an export happened', async () => {
    context.exportProject.mockReturnValue(JSON.stringify(makeScene()));
    render(<HeaderBar />);

    await openGuideAndCheck();

    const [message, type, options] = context.showToast.mock.calls[0];
    expect(type).toBe('success');
    expect(options.title).toBe('Ready to export');
    expect(message).toContain('-ograf.zip');
    expect(message).not.toContain('Exported');
    expect(createZipMock).not.toHaveBeenCalled();
  });

  it('reports the blocking diagnostic instead of readiness for an unsupported layer', async () => {
    context.exportProject.mockReturnValue(JSON.stringify(makeScene([makeLayer({ type: 'custom_particle', name: 'Sparks' })])));
    render(<HeaderBar />);

    await openGuideAndCheck();

    const [message, type, options] = context.showToast.mock.calls[0];
    expect(type).toBe('error');
    expect(options.title).toContain('Export blocked');
    expect(String(options.action)).toContain('Remove the layer');
    expect(message).not.toContain('Ready to export');
    expect(createZipMock).not.toHaveBeenCalled();
  });

  it('reuses the exact export diagnostics wording for warnings', async () => {
    const scene = makeScene([
      makeLayer({ id: 'mask' }),
      makeLayer({ id: 'target', name: 'Target', matte: { sourcePartId: 'mask', mode: 'clip' } }),
    ]);
    context.exportProject.mockReturnValue(JSON.stringify(scene));
    render(<HeaderBar />);

    await openGuideAndCheck();

    const [message, type, options] = context.showToast.mock.calls[0];
    expect(type).toBe('info');
    expect(options.title).toBe('Ready to export with 1 warning');
    expect(message).toContain('No blocking problem was found');
    // The warning itself is reported by the export path with its own remediation.
    expect(String(options.action)).toContain('OGraf Package');
    expect(createZipMock).not.toHaveBeenCalled();
  });

  it('still exports through the existing menu path after a readiness check', async () => {
    context.exportProject.mockReturnValue(JSON.stringify(makeScene()));
    createZipMock.mockResolvedValue({ fileName: 'my-project.ograf.zip', bytes: new Uint8Array([1, 2, 3]) });
    render(<HeaderBar />);

    await openGuideAndCheck();
    context.showToast.mockClear();

    fireEvent.click(screen.getByRole('button', { name: 'Export', exact: true }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'OGraf Package', exact: true }));

    await waitFor(() => expect(createZipMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(context.showToast).toHaveBeenCalledWith(expect.stringContaining('Exported'), 'success'));
  });
});
