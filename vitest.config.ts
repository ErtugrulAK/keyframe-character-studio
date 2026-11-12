import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

/**
 * Unit tests run in two environments. Component tests (`*.test.tsx`) and the
 * `*.test.ts` files listed in DOM_TESTS need a browser-like DOM (jsdom); every
 * other `*.test.ts` is pure logic and runs in plain Node, which starts several
 * times faster. A new `.ts` test that touches `document`, `window`,
 * `localStorage` or React hooks belongs in DOM_TESTS.
 */
const DOM_TESTS = [
  'src/tests/autosaveFailureHonesty.test.ts',
  'src/tests/autosaveInterval.test.ts',
  'src/tests/inputModality.test.ts',
  'src/tests/keyboardFocus.test.ts',
  'src/tests/editorHandOffs.test.ts',
  'src/tests/bondedMovement.test.ts',
  'src/tests/c3FreeformDrawInput.test.ts',
  'src/tests/c6PenDraw.test.ts',
  'src/tests/groupResize.test.ts',
  'src/tests/layoutModifiersOGraf.test.ts',
  'src/tests/n2aNamedSequenceParity.test.ts',
  'src/tests/ografGeneratedParity.test.ts',
  'src/tests/ografLayerStacking.test.ts',
  'src/tests/ografMaskRegion.test.ts',
  'src/tests/ografPackage.test.ts',
  'src/tests/ografRendererContract.test.ts',
  'src/tests/ografRuntimeAffine.test.ts',
  'src/tests/ografRuntimeParity.test.ts',
  'src/tests/ografV6Parity.test.ts',
  'src/tests/pasteAtPointer.test.ts',
  'src/tests/undoKeepsSelection.test.ts',
  'src/tests/perfMonitor.test.ts',
  'src/tests/presetExportImport.test.ts',
  'src/tests/projectTimebase.test.ts',
  'src/tests/setupStubs.test.ts',
  'src/tests/stepMarkers.test.ts',
  'src/tests/textFitOGraf.test.ts',
  'src/tests/transitionLegacyTrack.test.ts',
  'src/tests/useBroadcast.test.ts',
  'src/tests/useClipboard.test.ts',
  'src/tests/useHistory.test.ts',
  'src/tests/useInspector.test.ts',
  'src/tests/useKeyboardShortcuts.test.ts',
  'src/tests/useMath.test.ts',
  'src/tests/usePlayback.test.ts',
  'src/tests/usePresets.test.ts',
  'src/tests/usePresetsBootWrite.test.ts',
  'src/tests/usePresetsPersistenceFailure.test.ts',
  'src/tests/useProjectState.test.ts',
  'src/tests/useSelection.test.ts',
  'src/tests/useSerialization.test.ts',
  'src/tests/useTemplates.test.ts',
  'src/tests/useTemplatesProjectTemplates.test.ts',
  'src/tests/useTimeline.test.ts',
  'src/tests/useToast.test.ts',
  'src/tests/useToolbar.test.ts',
];

// The workspace-local standards folders (.worktrees/ for temporary worktrees,
// .research/ for external reference clones) live inside the repository and are
// git-ignored; reference-repo test files are not KCS tests and must never be
// collected here.
const EXCLUDE = ['node_modules', 'dist', 'e2e/**', '.worktrees/**', '.research/**'];

export default defineConfig({
  plugins: [react()],
  test: {
    setupFiles: ['./src/tests/setup.ts'],
    exclude: EXCLUDE,
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'src/tests/setup.ts'],
    },
    projects: [
      {
        extends: true,
        test: { name: 'dom', environment: 'jsdom', include: ['src/**/*.test.tsx', ...DOM_TESTS] },
      },
      {
        extends: true,
        test: { name: 'node', environment: 'node', include: ['src/**/*.test.ts'], exclude: [...EXCLUDE, ...DOM_TESTS] },
      },
    ],
  },
});
