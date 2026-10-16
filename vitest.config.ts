import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/tests/setup.ts'],
    // The workspace-local standards folders (.worktrees/ for temporary worktrees,
    // .research/ for external reference clones) live inside the repository and are
    // git-ignored; reference-repo test files are not KCS tests and must never be
    // collected here.
    exclude: ['node_modules', 'dist', 'e2e/**', '.worktrees/**', '.research/**'],
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'src/tests/setup.ts'],
    },
  },
});
