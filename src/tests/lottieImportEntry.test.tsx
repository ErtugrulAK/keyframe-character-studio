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

import { zipSync } from 'fflate';
import { HeaderBar } from '../components/Header/HeaderBar';
import { ImportReportDialog } from '../components/Modal/ImportReportDialog';

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

const IMPORT_INPUT = 'Choose a KCS project, legacy project, Lottie file, or OGraf manifest/package to import';

const chooseBytes = (ariaLabel: string, name: string, bytes: Uint8Array) => {
  const input = screen.getByLabelText(ariaLabel) as HTMLInputElement;
  const file = new File([bytes as unknown as BlobPart], name, { type: 'application/zip' });
  fireEvent.change(input, { target: { files: [file] } });
};
const reportDialog = () => screen.queryByRole('dialog', { name: 'Lottie import report' });
const packageDialog = () => screen.queryByRole('dialog', { name: 'OGraf package import report' });

describe('Lottie import entry point', () => {
  beforeEach(() => {
    context.importProject.mockClear();
    context.showToast.mockClear();
    context.importProject.mockReturnValue({ ok: true, diagnostics: [] });
  });

  afterEach(() => cleanup());

  it('shows the report without touching the project', async () => {
    render(<HeaderBar />);
    chooseFile(IMPORT_INPUT, 'scene.lottie.json', lottieDocument());

    const dialog = await screen.findByRole('dialog', { name: 'Lottie import report' });
    expect(dialog).toBeTruthy();
    expect(dialog.textContent).toContain('1 layer(s)');
    expect(context.importProject).not.toHaveBeenCalled();
    expect(context.showToast).not.toHaveBeenCalled();
  });

  it('leaves the project untouched when the report is cancelled', async () => {
    render(<HeaderBar />);
    chooseFile(IMPORT_INPUT, 'scene.lottie.json', lottieDocument());
    await screen.findByRole('dialog', { name: 'Lottie import report' });

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(reportDialog()).toBeNull();
    expect(context.importProject).not.toHaveBeenCalled();
    expect(context.showToast).not.toHaveBeenCalled();
    // A cancel must not save either: nothing about the project changed.
    expect(context.triggerManualSave).not.toHaveBeenCalled();
  });

  it('applies the imported scene through the project authority on confirm', async () => {
    render(<HeaderBar />);
    chooseFile(IMPORT_INPUT, 'scene.lottie.json', lottieDocument());
    await screen.findByRole('dialog', { name: 'Lottie import report' });

    fireEvent.click(screen.getByRole('button', { name: 'Import and replace project' }));

    expect(context.importProject).toHaveBeenCalledTimes(1);
    const [payload, name] = context.importProject.mock.calls[0] as [string, string];
    const scene = JSON.parse(payload) as { layers: { type: string }[] };
    // The imported solid is a freeform path: the supported type whose renderer
    // draws the geometry the importer produced.
    expect(scene.layers[0]?.type).toBe('custom_freeform');
    expect(scene.layers[0]?.path?.points).toHaveLength(4);
    expect(name).toBe('scene');

    await screen.findByRole('dialog', { name: 'Lottie import report' }).catch(() => null);
    expect(reportDialog()).toBeNull();
    expect(context.showToast).toHaveBeenCalledWith('Imported "scene" from Lottie.', 'success');
  });

  it('refuses a file it cannot classify without applying anything', async () => {
    context.importProject.mockReturnValueOnce({ ok: false, diagnostics: [{ code: 'KCS_IMPORT_MALFORMED_JSON', message: 'The selected file is not valid JSON.', action: 'Export the project again.' }] });
    render(<HeaderBar />);
    chooseFile(IMPORT_INPUT, 'broken.json', '{ not json');

    await waitFor(() => expect(context.importProject).toHaveBeenCalledTimes(1));
    expect(reportDialog()).toBeNull();
    expect(context.showToast).toHaveBeenCalledWith(expect.stringContaining('not valid JSON'), 'error');
    expect(context.showToast).not.toHaveBeenCalledWith(expect.stringContaining('Imported'), 'success');
  });

  it('shows a refusal dialog for a Lottie document the importer rejects', async () => {
    render(<HeaderBar />);
    chooseFile(IMPORT_INPUT, 'empty.lottie.json', JSON.stringify({ v: '5.7.4', fr: 24, ip: 0, op: 0, w: 10, h: 10, layers: [] }));

    const dialog = await screen.findByRole('dialog', { name: 'Lottie import report' });
    const confirm = screen.getByRole('button', { name: 'Import and replace project' }) as HTMLButtonElement;

    expect(dialog.textContent).toContain('Nothing was imported');
    expect(confirm.disabled).toBe(true);
    expect(context.importProject).not.toHaveBeenCalled();
    expect(context.showToast).not.toHaveBeenCalled();
  });

  it('lists warnings with their code and action before the project changes', async () => {
    render(<HeaderBar />);
    chooseFile(IMPORT_INPUT, 'scene.lottie.json', lottieDocument({
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
    chooseFile(IMPORT_INPUT, 'scene.lottie.json', lottieDocument());
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

  it('reports a refusal from the project authority instead of a success', async () => {
    context.importProject.mockReturnValueOnce({ ok: false, diagnostics: [{ code: 'IMPORT_REFUSED', message: 'The scene is not valid.', action: 'Export again.' }] });
    render(<HeaderBar />);
    chooseFile(IMPORT_INPUT, 'scene.lottie.json', lottieDocument());
    await screen.findByRole('dialog', { name: 'Lottie import report' });

    fireEvent.click(screen.getByRole('button', { name: 'Import and replace project' }));

    expect(context.importProject).toHaveBeenCalledTimes(1);
    expect(context.showToast).toHaveBeenCalledWith('The scene is not valid.', 'error', expect.objectContaining({ title: 'IMPORT_REFUSED' }));
    expect(context.showToast).not.toHaveBeenCalledWith(expect.stringContaining('Imported'), 'success');
  });

  it('bounds a long report and counts what it holds', async () => {
    const noisy = lottieDocument({
      layers: Array.from({ length: 45 }, (_, index) => ({ ty: 4, nm: 'L' + index, ks: {}, shapes: [{ ty: 'rp', c: { k: index } }] })),
    });
    render(<HeaderBar />);
    chooseFile(IMPORT_INPUT, 'many.json', noisy);

    const dialog = await screen.findByRole('dialog', { name: 'Lottie import report' });
    const entries = dialog.querySelectorAll('.lottie-report-entry');

    expect(entries.length).toBe(40);
    expect(dialog.textContent).toContain('And 5 more diagnostic(s).');
    expect(dialog.textContent).toContain('45 warning(s)');
    expect(dialog.textContent).toContain('0 blocker(s)');
  });

  it('renders blockers before warnings and sanitises every rendered value', () => {
    const diagnostics = [
      { code: 'LOTTIE_PRECOMP_UNMAPPED', severity: 'warning' as const, feature: 'lottie-import', path: 'layers[0]', message: 'A warning.', action: 'Fix it later.' },
      { code: 'LOTTIE_MALFORMED_JSON', severity: 'error' as const, feature: 'lottie-import', path: 'C:\\Users\\someone\\secret\\file.json', message: 'Refused from data:image/png;base64,AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA.', action: 'Export again.' },
    ];

    render(
      <ImportReportDialog
        isOpen
        fileName={'C:\\Users\\someone\\secret\\scene.lottie.json'}
        diagnostics={diagnostics}
        refused
        onCancel={() => undefined}
        onConfirm={() => undefined}
      />,
    );

    const entries = Array.from(document.querySelectorAll('.lottie-report-entry'));
    expect(entries[0]?.className).toContain('blocking');
    expect(entries[1]?.className).toContain('warning');
    // No machine path and no payload travels to the UI; the redacted forms keep the
    // file name and the media type only.
    const rendered = document.body.textContent ?? '';
    expect(rendered).not.toContain('base64,');
    expect(rendered).not.toContain('C:\\Users\\someone');
    expect(rendered).toContain('payload omitted');
    expect(rendered).toContain('scene.lottie.json');
  });

  it('keeps focus on Cancel while confirming is impossible', async () => {
    render(<HeaderBar />);
    chooseFile(IMPORT_INPUT, 'empty.lottie.json', JSON.stringify({ v: '5.7.4', fr: 24, ip: 0, op: 0, w: 10, h: 10, layers: [] }));
    await screen.findByRole('dialog', { name: 'Lottie import report' });
    const cancel = screen.getByRole('button', { name: 'Cancel' });
    const confirm = screen.getByRole('button', { name: 'Import and replace project' }) as HTMLButtonElement;

    expect(confirm.disabled).toBe(true);
    // The dialog focuses Cancel on open; await it so a slow render cannot flake the test.
    await waitFor(() => expect(document.activeElement).toBe(cancel));
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(cancel);
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(cancel);
  });

  it('imports an OGraf package through the shared report, and cancels without changing anything', async () => {
    const scene = JSON.stringify({ version: 1, width: 320, height: 180, fps: 24, totalFrames: 24, layers: [], tracks: [] });
    const bytes = zipSync({ 'demo.ograf.json': new TextEncoder().encode(JSON.stringify({ name: 'Demo' })), 'scene.kcs': new TextEncoder().encode(scene) });

    render(<HeaderBar />);
    chooseBytes(IMPORT_INPUT, 'demo.zip', bytes);
    const dialog = await screen.findByRole('dialog', { name: 'OGraf package import report' });

    expect(dialog.textContent).toContain('0 layer(s) and 24 frame(s)');
    expect(context.importProject).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(packageDialog()).toBeNull();
    expect(context.importProject).not.toHaveBeenCalled();
    expect(context.showToast).not.toHaveBeenCalled();
    expect(dialog).toBeTruthy();
  });

  it('applies the package scene through the project authority on confirm', async () => {
    const scene = JSON.stringify({ version: 1, width: 640, height: 360, fps: 30, totalFrames: 30, layers: [], tracks: [] });
    const bytes = zipSync({ 'demo.ograf.json': new TextEncoder().encode(JSON.stringify({ name: 'Demo Graphic' })), 'scene.kcs': new TextEncoder().encode(scene) });

    render(<HeaderBar />);
    chooseBytes(IMPORT_INPUT, 'demo.zip', bytes);
    await screen.findByRole('dialog', { name: 'OGraf package import report' });

    fireEvent.click(screen.getByRole('button', { name: 'Import and replace project' }));

    expect(context.importProject).toHaveBeenCalledTimes(1);
    expect(context.importProject).toHaveBeenCalledWith(scene, 'Demo Graphic');
    expect(context.showToast).toHaveBeenCalledWith('Imported "Demo Graphic" from an OGraf package.', 'success');
  });

  it('reports a package refusal from the project authority instead of a success', async () => {
    context.importProject.mockReturnValueOnce({ ok: false, diagnostics: [{ code: 'KCS_IMPORT_UNKNOWN_SHAPE', message: 'The scene is not valid.', action: 'Export again.' }] });
    const scene = JSON.stringify({ version: 1, width: 320, height: 180, fps: 24, totalFrames: 24, layers: [], tracks: [] });
    const bytes = zipSync({ 'scene.kcs': new TextEncoder().encode(scene) });

    render(<HeaderBar />);
    chooseBytes(IMPORT_INPUT, 'demo.zip', bytes);
    await screen.findByRole('dialog', { name: 'OGraf package import report' });
    fireEvent.click(screen.getByRole('button', { name: 'Import and replace project' }));

    expect(context.showToast).toHaveBeenCalledWith('The scene is not valid.', 'error', expect.objectContaining({ title: 'KCS_IMPORT_UNKNOWN_SHAPE' }));
    expect(context.showToast).not.toHaveBeenCalledWith(expect.stringContaining('Imported'), 'success');
  });

  it('keeps the existing project import control working', async () => {
    render(<HeaderBar />);
    chooseFile(IMPORT_INPUT, 'project.kcs', JSON.stringify({ version: 1, width: 320, height: 180, fps: 24, totalFrames: 24, layers: [], tracks: [] }));

    await waitFor(() => expect(context.importProject).toHaveBeenCalledTimes(1));
    expect(context.showToast).toHaveBeenCalledWith('Imported "project" as a new Template tab!', 'success');
    expect(reportDialog()).toBeNull();
  });

  it('keeps the OGraf manifest rejection on the existing control', async () => {
    render(<HeaderBar />);
    chooseFile(IMPORT_INPUT, 'graphic.ograf.json', JSON.stringify({ $schema: 'https://keyframe.studio/ograf/v1' }));

    await waitFor(() => expect(context.showToast).toHaveBeenCalled());
    expect(context.importProject).not.toHaveBeenCalled();
    expect(context.showToast).toHaveBeenCalledWith(expect.stringContaining('OGraf graphic manifest'), 'error');
    expect(reportDialog()).toBeNull();
  });
});
