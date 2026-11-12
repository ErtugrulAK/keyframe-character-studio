import React, { lazy, Suspense, useState } from 'react';
import { ChunkLoadBoundary } from '../Shared/ChunkLoadBoundary';
import { Library } from 'lucide-react';
import { NumberField } from '../Inspector/inputs/NumberField';
import { useAnimatorSlice } from '../../context/useAnimator';
import { MAX_AUTOSAVE_SECONDS, MIN_AUTOSAVE_SECONDS } from '../../utils/persistence/autosaveInterval';
import { validateImportedDocument } from '../../utils/persistence/importValidation';
import { createIndexedDbBackend, createProjectLibrary, type ProjectLibrary } from '../../utils/persistence/projectLibrary';

// The library dialog opens on demand, so it loads then.
const GraphicLibraryDialog = lazy(() => import('../Header/GraphicLibraryDialog').then((module) => ({ default: module.GraphicLibraryDialog })));

export const ProjectSettingsFields: React.FC = () => {
  const { projectResolution, setProjectResolution, sceneTitle, exportProject, importProject, addProjectTemplate, showToast, autosaveIntervalSeconds, setAutosaveIntervalSeconds } = useAnimatorSlice('projectResolution', 'setProjectResolution', 'sceneTitle', 'exportProject', 'importProject', 'addProjectTemplate', 'showToast', 'autosaveIntervalSeconds', 'setAutosaveIntervalSeconds');
  /** The graphic library, created on first use (IndexedDB is opened only then). */
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

  return (
    <div className="drawer-content project-drawer-content">
      <div className="project-section">
        <label className="form-label project-field-label">Library</label>
        <button type="button" className="btn-secondary project-library-open" onClick={openLibrary} title="Graphics saved in this browser: save, open, duplicate, delete">
          <Library size={14} aria-hidden="true" />
          <span>Open Library…</span>
        </button>
        {library && isLibraryOpen && (
          <ChunkLoadBoundary
            onError={() => {
              setIsLibraryOpen(false);
              showToast('The library could not be opened. Reload the editor to try again; your project is unchanged.', 'error');
            }}
          >
          <Suspense fallback={null}>
            <GraphicLibraryDialog
              isOpen={isLibraryOpen}
              library={library}
              currentName={sceneTitle}
              exportCurrent={exportProject}
              openGraphic={openLibraryGraphic}
              onClose={() => setIsLibraryOpen(false)}
            />
          </Suspense>
          </ChunkLoadBoundary>
        )}
      </div>
      <div className="project-section">
        <label className="form-label project-field-label">
          Resolution Presets
        </label>
        <div className="project-preset-grid">
          <button
            className={`drawer-item-card project-preset-card ${projectResolution.width === 1920 && projectResolution.height === 1080 ? 'active' : ''}`}
            onClick={() => setProjectResolution({ width: 1920, height: 1080 })}
          >
            1080p (16:9)
          </button>
          <button
            className={`drawer-item-card project-preset-card ${projectResolution.width === 1080 && projectResolution.height === 1920 ? 'active' : ''}`}
            onClick={() => setProjectResolution({ width: 1080, height: 1920 })}
          >
            Vertical (9:16)
          </button>
          <button
            className={`drawer-item-card project-preset-card ${projectResolution.width === 1080 && projectResolution.height === 1080 ? 'active' : ''}`}
            onClick={() => setProjectResolution({ width: 1080, height: 1080 })}
          >
            Square (1:1)
          </button>
          <button
            className={`drawer-item-card project-preset-card ${projectResolution.width === 2560 && projectResolution.height === 1440 ? 'active' : ''}`}
            onClick={() => setProjectResolution({ width: 2560, height: 1440 })}
          >
            1440p (16:9)
          </button>
        </div>
      </div>

      <div className="project-field-row">
        <div className="project-field">
          <label className="form-label project-field-label">Width (px)</label>
          <NumberField className="input-control project-num-input"
            commit="blur"
            min={1}
            step={1}
            value={projectResolution.width}
            onValue={(width) => { if (width >= 1) setProjectResolution((p) => ({ ...p, width: Math.round(width) })); }}
          />
        </div>
        <div className="project-field">
          <label className="form-label project-field-label">Height (px)</label>
          <NumberField className="input-control project-num-input"
            commit="blur"
            min={1}
            step={1}
            value={projectResolution.height}
            onValue={(height) => { if (height >= 1) setProjectResolution((p) => ({ ...p, height: Math.round(height) })); }}
          />
        </div>
      </div>

      {/* The autosave delay: this browser's preference, written when the edit ends. */}
      <div className="project-section">
        <label className="form-label project-field-label" htmlFor="project-autosave-interval">Autosave</label>
        <div className="project-autosave-row" title={`Autosave writes changes within this many seconds of the first change (${MIN_AUTOSAVE_SECONDS}–${MAX_AUTOSAVE_SECONDS}).`}>
          <span className="project-autosave-text">Save changes within</span>
          <NumberField
            id="project-autosave-interval"
            className="input-control project-num-input project-autosave-input"
            aria-label="Autosave interval in seconds"
            commit="blur"
            min={MIN_AUTOSAVE_SECONDS}
            max={MAX_AUTOSAVE_SECONDS}
            step={1}
            value={autosaveIntervalSeconds}
            onValue={setAutosaveIntervalSeconds}
          />
          <span className="project-autosave-text">seconds</span>
        </div>
      </div>
    </div>
  );
};
