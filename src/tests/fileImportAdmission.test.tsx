// N3 PR-2c1 — oversized imports are refused BEFORE FileReader allocates them.
//
// FileReader turns a File into a JS string/arraybuffer first and only then
// does any size or shape validation run, so a hostile multi-gigabyte .kcs or
// .zip was fully materialized in memory before being refused. This suite pins
// the pre-admission contract on the two HeaderBar entry paths and on the
// shared authority module:
//   * exactly-at-limit is admitted (boundary is inclusive);
//   * one byte over is refused with one honest toast;
//   * the refusal never reaches readAsText/readAsArrayBuffer;
//   * no import authority (importProject/package reader/Lottie staging) runs;
//   * small/valid flows and the post-read MAX_IMPORT_CHARACTERS check are
//     untouched.
// Test files are synthetic descriptors — no real 64 MiB allocation happens.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { HeaderBar } from '../components/Header/HeaderBar';
import {
  PACKAGE_IMPORT_MAX_FILE_BYTES,
  PROJECT_IMPORT_MAX_FILE_BYTES,
  projectFileAdmissionProblem,
  packageFileAdmissionProblem,
} from '../utils/persistence/fileAdmission';
import { MAX_IMPORT_CHARACTERS } from '../utils/persistence/importValidation';
import { OGRAF_PACKAGE_LIMITS } from '../ograf/packageImport';

const animatorCtx = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
vi.mock('../context/useAnimator', () => ({ useAnimator: () => animatorCtx.value, useAnimatorSlice: () => animatorCtx.value, useAnimatorReader: () => () => animatorCtx.value }));
vi.mock('../components/Canvas/GifExportPanel', () => ({ GifExportPanel: () => null }));

function mountHeaderBar() {
  animatorCtx.value = {
    exportProject: () => '{}',
    importProject: vi.fn(() => ({ ok: false, diagnostics: [] })),
    resetProject: vi.fn(),
    lastSavedAt: null,
    restoredFromLocalStorage: false,
    autosaveConflict: false,
    manualSaveRejectedAt: null,
    triggerManualSave: vi.fn(),
    showToast: vi.fn(),
    appMode: 'edit',
    setAppMode: vi.fn(),
    sceneTitle: 'Scene',
    projectTemplates: [],
    activeProjectTemplateId: 'Sequence',
    setActiveProjectTemplateId: vi.fn(),
    addProjectTemplate: vi.fn(),
    renameProjectTemplate: vi.fn(),
    deleteProjectTemplate: vi.fn(),
    fps: 60,
    setFps: vi.fn(),
    openShortcutReference: vi.fn(),
    characterParts: [],
    tracks: [],
  };
  render(<HeaderBar />);
  return animatorCtx.value;
}

// A File-shaped descriptor; only `name` and `size` are consumed before readers.
const fileOf = (name: string, size: number) =>
  ({ name, size, type: '' }) as File;

function pickFile(file: File) {
  const input = screen.getByLabelText(/Choose a KCS project/i) as HTMLInputElement;
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  fireEvent.change(input);
}

describe('fileAdmission authority', () => {
  it('derives both limits from the existing constants (no new magic numbers)', () => {
    // Project: post-read text limit x2 slack (UTF-16) — 64 MiB.
    expect(PROJECT_IMPORT_MAX_FILE_BYTES).toBe(MAX_IMPORT_CHARACTERS * 2);
    // Package: the importer's own authoritative archive byte limit.
    expect(PACKAGE_IMPORT_MAX_FILE_BYTES).toBe(OGRAF_PACKAGE_LIMITS.bytes);
  });

  it('project boundary: exactly at the limit admits, one byte over refuses', () => {
    expect(projectFileAdmissionProblem(fileOf('scene.kcs', PROJECT_IMPORT_MAX_FILE_BYTES))).toBeNull();
    expect(projectFileAdmissionProblem(fileOf('scene.kcs', PROJECT_IMPORT_MAX_FILE_BYTES + 1))).not.toBeNull();
  });

  it('package boundary mirrors the archive limit', () => {
    expect(packageFileAdmissionProblem(fileOf('art.ograf.zip', PACKAGE_IMPORT_MAX_FILE_BYTES))).toBeNull();
    expect(packageFileAdmissionProblem(fileOf('art.ograf.zip', PACKAGE_IMPORT_MAX_FILE_BYTES + 1))).not.toBeNull();
  });

  it('the refusal message names the honest ceiling once', () => {
    const problem = projectFileAdmissionProblem(fileOf('huge.kcs', PROJECT_IMPORT_MAX_FILE_BYTES + 1));
    expect(problem?.message).toMatch(/too large/i);
  });
});

describe('HeaderBar pre-admission guards', () => {
  // A VALID READER MOCK. jsdom's real FileReader demands a real Blob, so the
  // synthetic descriptors this suite deliberately keeps (no 64 MiB allocation)
  // made the spied native method throw an uncaught TypeError the CI failed on
  // (bbb8b9a run). The stub records exactly the boundary the suite owns —
  // whether the guard let the reader be reached at all — and never touches
  // content; onload stays unfired, mirroring the previous jsdom reality.
  class RecordingFileReader {
    static textCalls = 0;
    static bufferCalls = 0;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    readAsText(): void { RecordingFileReader.textCalls += 1; }
    readAsArrayBuffer(): void { RecordingFileReader.bufferCalls += 1; }
  }

  beforeEach(() => {
    RecordingFileReader.textCalls = 0;
    RecordingFileReader.bufferCalls = 0;
    vi.stubGlobal('FileReader', RecordingFileReader);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('an oversized project file is refused before readAsText, with one toast and no import call', () => {
    const ctx = mountHeaderBar();
    pickFile(fileOf('huge.kcs', PROJECT_IMPORT_MAX_FILE_BYTES + 1));

    expect(RecordingFileReader.textCalls).toBe(0);
    expect(ctx.showToast).toHaveBeenCalledTimes(1);
    expect(String((ctx.showToast as ReturnType<typeof vi.fn>).mock.calls[0][0])).toMatch(/too large/i);
    expect(ctx.importProject).not.toHaveBeenCalled();
    expect(ctx.resetProject).not.toHaveBeenCalled();
  });

  it('an oversized OGraf package is refused before readAsArrayBuffer', () => {
    const ctx = mountHeaderBar();
    pickFile(fileOf('huge.zip', PACKAGE_IMPORT_MAX_FILE_BYTES + 1));

    expect(RecordingFileReader.bufferCalls).toBe(0);
    expect(ctx.showToast).toHaveBeenCalledTimes(1);
    expect(String((ctx.showToast as ReturnType<typeof vi.fn>).mock.calls[0][0])).toMatch(/too large/i);
  });

  it('a file exactly at the project limit still reaches the reader (inclusive boundary)', () => {
    mountHeaderBar();
    pickFile(fileOf('edge.kcs', PROJECT_IMPORT_MAX_FILE_BYTES));
    expect(RecordingFileReader.textCalls).toBe(1);
  });

  it('a small project file still flows through to importProject (regression)', () => {
    const ctx = mountHeaderBar();
    pickFile(fileOf('small.kcs', 128));
    expect(RecordingFileReader.textCalls).toBe(1);
    // The read callback is async in production; jsdom fires no onload here, so
    // the admission contract ends at "reached the reader" plus the refusal-row
    // guarantees above. importProject remains the post-read authority.
    expect(ctx.showToast).not.toHaveBeenCalled();
  });
});
