import React, { Suspense, useState } from 'react';
import { LazyGraphicLibraryDialog } from './LazyGraphicLibraryDialog';
import { ChunkLoadBoundary } from '../Shared/ChunkLoadBoundary';
import { useAnimatorSlice } from '../../context/useAnimator';
import { validateImportedDocument } from '../../utils/persistence/importValidation';
import { createIndexedDbBackend, createProjectLibrary, type ProjectLibrary } from '../../utils/persistence/projectLibrary';

/**
 * The graphic library (graphics saved in this browser), opened from File >
 * Library…: `openLibrary` shows it and `dialog` is the element to render. The library is created on first use, so IndexedDB is
 * opened only then.
 */
export const useGraphicLibrary = (): { openLibrary: () => void; dialog: React.ReactNode } => {
  const { sceneTitle, exportProject, importProject, addProjectTemplate, showToast } = useAnimatorSlice('sceneTitle', 'exportProject', 'importProject', 'addProjectTemplate', 'showToast');
  const [library, setLibrary] = useState<ProjectLibrary | null>(null);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const openLibrary = () => {
    setLibrary((current) => current ?? createProjectLibrary(createIndexedDbBackend()));
    setIsLibraryOpen(true);
  };
  /**
   * Opens a saved graphic in a NEW template tab: importing a scene replaces the
   * active template's content, so a fresh tab is made first, and only for a
   * document the import boundary accepts (no empty tab is left behind).
   */
  const openLibraryGraphic = (name: string, scene: string): boolean => {
    if (!validateImportedDocument(scene).ok) return false;
    addProjectTemplate(name);
    const result = importProject(scene, name);
    if (!result.ok) return false;
    const [notice] = result.diagnostics;
    if (notice) showToast(notice.message, 'info', { title: notice.code, action: notice.action });
    return true;
  };

  const dialog = library && isLibraryOpen ? (
    <ChunkLoadBoundary
      onError={() => {
        setIsLibraryOpen(false);
        showToast('The library could not be opened. Reload the editor to try again; your project is unchanged.', 'error');
      }}
    >
      <Suspense fallback={null}>
        <LazyGraphicLibraryDialog
          isOpen={isLibraryOpen}
          library={library}
          currentName={sceneTitle}
          exportCurrent={exportProject}
          openGraphic={openLibraryGraphic}
          onClose={() => setIsLibraryOpen(false)}
        />
      </Suspense>
    </ChunkLoadBoundary>
  ) : null;

  return { openLibrary, dialog };
};
