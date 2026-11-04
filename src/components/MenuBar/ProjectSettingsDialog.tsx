import React, { useRef } from 'react';
import ReactDOM from 'react-dom';
import { X } from 'lucide-react';
import { useDialogFocusRestoration, useDialogFocusTrap } from '../../hooks/useDialogFocusRestoration';
import { ProjectDrawer } from '../Toolbar/drawers/ProjectDrawer';
import '../Toolbar/LeftToolbar.css';
import '../Modal/ConfirmationDialog.css';

interface ProjectSettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * The project's settings (Library, canvas size, autosave delay), opened from
 * File > Project Settings. They lived in the left panel, which the menu bar
 * replaced; the controls are the same ones.
 */
export const ProjectSettingsDialog: React.FC<ProjectSettingsDialogProps> = ({ isOpen, onClose }) => {
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocusRestoration(isOpen, closeRef);
  useDialogFocusTrap(isOpen, dialogRef, onClose);
  if (!isOpen) return null;
  return ReactDOM.createPortal(
    <div className="confirmation-dialog-backdrop" onMouseDown={onClose}>
      <div
        className="project-settings-dialog"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-settings-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="project-settings-header">
          <h2 id="project-settings-title">Project Settings</h2>
          <button type="button" className="btn-icon" ref={closeRef} aria-label="Close project settings" onClick={onClose}>
            <X size={15} />
          </button>
        </div>
        <ProjectDrawer />
      </div>
    </div>,
    document.body,
  );
};
