import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';

/**
 * Milestone F item 10 — the Lottie import entry point.
 *
 * Selecting a file must only ever produce a report: the project is replaced when
 * the user accepts that report, and never before. These tests pin exactly that
 * contract at the header level, together with the routing of the pre-existing
 * `.kcs` / OGraf import control.
 */

const { context } = vi.hoisted(() => ({
  context: {
    importProject: vi.fn(() => ({ ok: true, diagnostics: [] })),
    exportProject: vi.fn(),
    resetProject: vi.fn(),
    lastSavedAt: null,
    triggerManualSave: vi.fn(),
    showToast: vi.fn(),
    appMode: 'edit',
    setAppMode: vi.fn(),
    sceneTitle: 'My Project',
    projectTemplates: [],
    activeProjectTemplateId: 'default',
    setActiveProjectTemplateId: vi.fn(),
    addProjectTemplate: vi.fn(),
    renameProjectTemplate: vi.fn(),
    deleteProjectTemplate: vi.fn(),
    fps: 60,
    setFps: vi.fn(),
  },
}));

vi.mock('../context/useAnimator', () => ({ useAnimator: () => context }));
vi.mock('../components/Modal/NewItemModal', () => ({ NewItemModal: () => null }));

import { HeaderBar } from '../components/Header/HeaderBar';

const lottieDocument = (overrides: Record<string, unknown> = {}) => JSON.stringify({
  v: '5.7.4',
  fr: 24,
  ip: 0,
  op: 24,
  w: 320,
  h: 180,
  nm: 'Fixture',
  layers: [
    { ty: 1, nm: 'Block', sc: '#336699', sw: 100, sh: 100, ks: { o: { k: 100 }, r: { k: 0 }, s: { k: 100 }, p: { k: 0 } } },
  ],
  ...overrides,
});

const chooseFile = (label: string, name: string, content: string) => {
  const input = screen.getByLabelText(label) as HTMLInputElement;
  const file = new File([content], name, { type: 'application/json' });
  fireEvent.change(input, { target: { files: [file] } });
};

const LOTTIE_FILE_INPUT = 'Choose a Lottie file to import';
const EXISTING_IMPORT_INPUT = 'Choose a KCS project or OGraf manifest';
const reportDialog = () => screen.queryByRole('dialog', { name: 'Lottie import report' });

describe('Lottie import entry point', () => {
  beforeEach(() => {
    context.importProject.mockClear();
    context.showToast.mockClear();
    context.importProject.mockReturnValue({ ok: true, diagnostics: [] });
  });

  afterEach(() => cleanup());

  it('shows the report without touching the project', async () => {
    render(<HeaderBar />);
    chooseFile(LOTTIE_FILE_INPUT, 'scene.lottie.json', lottieDocument());

    const dialog = await screen.findByRole('dialog', { name: 'Lottie import report' });
    expect(dialog).toBeTruthy();
    expect(dialog.textContent).toContain('1 layer(s)');
    expect(context.importProject).not.toHaveBeenCalled();
    expect(context.showToast).not.toHaveBeenCalled();
  });

  it('leaves the project untouched when the report is cancelled', async () => {
    render(<HeaderBar />);
    chooseFile(LOTTIE_FILE_INPUT, 'scene.lottie.json', lottieDocument());
    const dialog = await screen.findByRole('dialog', { name: 'Lottie import report' });

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(reportDialog()).toBeNull();
    expect(context.importProject).not.toHaveBeenCalled();
    expect(context.showToast).not.toHaveBeenCalled();
    expect(dialog).toBeTruthy();
  });

  it('applies the imported scene through the project authority on confirm', async () => {
    render(<HeaderBar />);
    chooseFile(LOTTIE_FILE_INPUT, 'scene.lottie.json', lottieDocument());
    await screen.findByRole('dialog', { name: 'Lottie import report' });

    fireEvent.click(screen.getByRole('button', { name: 'Import and replace project' }));

    expect(context.importProject).toHaveBeenCalledTimes(1);
    const [payload, name] = context.importProject.mock.calls[0] as [string, string];
    const scene = JSON.parse(payload) as { layers: { type: string }[] };
    expect(scene.layers[0]?.type).toBe('custom_rect');
    expect(name).toBe('scene');

    await screen.findByRole('dialog', { name: 'Lottie import report' }).catch(() => null);
    expect(reportDialog()).toBeNull();
    expect(context.showToast).toHaveBeenCalledWith('Imported "scene" from Lottie.', 'success');
  });

  it('never applies a refused document and never reports success', async () => {
    render(<HeaderBar />);
    chooseFile(LOTTIE_FILE_INPUT, 'broken.json', '{ not json');

    const dialog = await screen.findByRole('dialog', { name: 'Lottie import report' });
    const confirm = screen.getByRole('button', { name: 'Import and replace project' }) as HTMLButtonElement;

    expect(dialog.textContent).toContain('Nothing was imported');
    expect(confirm.disabled).toBe(true);
    expect(context.importProject).not.toHaveBeenCalled();
    expect(context.showToast).not.toHaveBeenCalled();
  });

  it('lists warnings with their code and action before the project changes', async () => {
    render(<HeaderBar />);
    chooseFile(LOTTIE_FILE_INPUT, 'scene.lottie.json', lottieDocument({
      layers: [
        { ty: 0, nm: 'Nested', refId: 'comp_0', ks: {} },
        { ty: 1, nm: 'Block', sc: '#336699', sw: 10, sh: 10, ks: { o: { k: 100 }, r: { k: 0 }, s: { k: 100 }, p: { k: 0 } } },
      ],
      assets: [{ id: 'comp_0', layers: [] }],
    }));

    const dialog = await screen.findByRole('dialog', { name: 'Lottie import report' });

    expect(dialog.textContent).toContain('LOTTIE_PRECOMP_UNMAPPED');
    expect(dialog.textContent).toContain('Render the precomposition in the source document and re-create it after import.');
    expect(context.importProject).not.toHaveBeenCalled();
  });

  it('starts focus on Cancel, wraps with Tab and cancels on Escape', async () => {
    render(<HeaderBar />);
    chooseFile(LOTTIE_FILE_INPUT, 'scene.lottie.json', lottieDocument());
    await screen.findByRole('dialog', { name: 'Lottie import report' });
    const cancel = screen.getByRole('button', { name: 'Cancel' });
    const confirm = screen.getByRole('button', { name: 'Import and replace project' });

    expect(document.activeElement).toBe(cancel);
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(cancel);
    confirm.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(cancel);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(reportDialog()).toBeNull();
    expect(context.importProject).not.toHaveBeenCalled();
  });

  it('keeps the existing project import control working', async () => {
    render(<HeaderBar />);
    chooseFile(EXISTING_IMPORT_INPUT, 'project.kcs', JSON.stringify({ version: 1, width: 320, height: 180, fps: 24, totalFrames: 24, layers: [], tracks: [] }));

    await waitFor(() => expect(context.importProject).toHaveBeenCalledTimes(1));
    expect(context.showToast).toHaveBeenCalledWith('Imported "project" as a new Template tab!', 'success');
    expect(reportDialog()).toBeNull();
  });

  it('keeps the OGraf manifest rejection on the existing control', async () => {
    render(<HeaderBar />);
    chooseFile(EXISTING_IMPORT_INPUT, 'graphic.ograf.json', JSON.stringify({ $schema: 'https://keyframe.studio/ograf/v1' }));

    await waitFor(() => expect(context.showToast).toHaveBeenCalled());
    expect(context.importProject).not.toHaveBeenCalled();
    expect(context.showToast).toHaveBeenCalledWith(expect.stringContaining('OGraf graphic manifest'), 'error');
    expect(reportDialog()).toBeNull();
  });
});
