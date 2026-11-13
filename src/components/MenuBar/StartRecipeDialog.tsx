import React, { useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { X } from 'lucide-react';
import { useDialogFocusRestoration, useDialogFocusTrap } from '../../hooks/useDialogFocusRestoration';
import { CANVAS_PRESETS, FRAME_RATES, START_RECIPES, type StartRecipeId } from '../../utils/editor/startRecipes';
import '../Modal/ConfirmationDialog.css';

interface StartRecipeDialogProps {
  isOpen: boolean;
  /** The canvas and frame rate of the open project, the window's starting choice. */
  initialWidth: number;
  initialHeight: number;
  initialFps: number;
  onCreate: (recipe: StartRecipeId, options: { width: number; height: number; fps: number }) => void;
  onClose: () => void;
}

/**
 * File > New from Template…: pick a canvas size and frame rate, then start
 * blank or from a ready-made graphic. The choice opens in a new tab unless
 * the open one is still empty.
 */
export const StartRecipeDialog: React.FC<StartRecipeDialogProps> = ({ isOpen, initialWidth, initialHeight, initialFps, onCreate, onClose }) => {
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocusRestoration(isOpen, closeRef);
  useDialogFocusTrap(isOpen, dialogRef, onClose);
  const initialCanvas = Math.max(0, CANVAS_PRESETS.findIndex((preset) => preset.width === initialWidth && preset.height === initialHeight));
  const [canvasIndex, setCanvasIndex] = useState(initialCanvas);
  const [fps, setFps] = useState(FRAME_RATES.includes(initialFps) ? initialFps : 30);
  if (!isOpen) return null;
  const canvas = CANVAS_PRESETS[canvasIndex];
  const create = (recipe: StartRecipeId) => onCreate(recipe, { width: canvas.width, height: canvas.height, fps });

  return ReactDOM.createPortal(
    <div className="confirmation-dialog-backdrop" onMouseDown={onClose}>
      <div
        className="project-settings-dialog start-recipe-dialog"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="start-recipe-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="project-settings-header">
          <h2 id="start-recipe-title">New from Template</h2>
          <button type="button" className="btn-icon" ref={closeRef} aria-label="Close new from template" onClick={onClose}>
            <X size={15} />
          </button>
        </div>
        <div className="start-recipe-settings">
          <label>
            <span>Canvas size</span>
            <select value={canvasIndex} onChange={(event) => setCanvasIndex(Number(event.target.value))}>
              {CANVAS_PRESETS.map((preset, index) => <option key={preset.label} value={index}>{preset.label}</option>)}
            </select>
          </label>
          <label>
            <span>Frame rate</span>
            <select value={fps} onChange={(event) => setFps(Number(event.target.value))}>
              {FRAME_RATES.map((rate) => <option key={rate} value={rate}>{rate} fps</option>)}
            </select>
          </label>
          <button type="button" className="btn-secondary" onClick={() => create('blank')}>Blank</button>
        </div>
        <h3 className="start-recipe-heading">Start from a graphic</h3>
        <div className="start-recipe-grid">
          {START_RECIPES.map((recipe) => (
            <button key={recipe.id} type="button" className="start-recipe-card" onClick={() => create(recipe.id)}>
              <span className="start-recipe-card-title">{recipe.label}</span>
              <span className="start-recipe-card-description">{recipe.description}</span>
            </button>
          ))}
        </div>
        <p className="start-recipe-note">Opens in a new tab, or in this one while it is still empty. Every part stays editable.</p>
      </div>
    </div>,
    document.body,
  );
};
