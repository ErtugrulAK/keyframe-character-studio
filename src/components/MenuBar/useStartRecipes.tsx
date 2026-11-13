import React, { useState } from 'react';
import { useAnimatorSlice } from '../../context/useAnimator';
import { buildStartRecipe, START_RECIPES, type StartRecipeId } from '../../utils/editor/startRecipes';
import { StartRecipeDialog } from './StartRecipeDialog';
import { WORKSPACE_LAYOUT_COMMAND_EVENT } from '../../utils/editor/workspaceLayout';

/**
 * File > New from Template…: `openStartRecipes` shows the window and `dialog`
 * is the element to render. A choice opens through the import boundary, like a
 * library graphic: in the open tab while it is still empty, otherwise in a new
 * template tab, so the work on screen is never replaced.
 */
export const useStartRecipes = (): { openStartRecipes: () => void; dialog: React.ReactNode } => {
  const { characterParts, projectResolution, fps, importProject, addProjectTemplate, renameProjectTemplate, activeProjectTemplateId, showToast } = useAnimatorSlice(
    'characterParts', 'projectResolution', 'fps', 'importProject', 'addProjectTemplate', 'renameProjectTemplate', 'activeProjectTemplateId', 'showToast',
  );
  const [isOpen, setIsOpen] = useState(false);

  const create = (recipe: StartRecipeId, options: { width: number; height: number; fps: number }) => {
    const name = START_RECIPES.find((candidate) => candidate.id === recipe)?.label ?? 'Untitled';
    const scene = JSON.stringify(buildStartRecipe(recipe, options));
    // An empty tab takes the graphic (and its name); otherwise it gets a tab of its own.
    if (characterParts.length > 0) addProjectTemplate(name);
    else if (recipe !== 'blank') renameProjectTemplate(activeProjectTemplateId, name);
    const result = importProject(scene, name);
    setIsOpen(false);
    if (!result.ok) {
      showToast(`${name} could not be created: ${result.diagnostics[0]?.message ?? 'the scene was refused'}`, 'error');
      return;
    }
    // Show the whole new artboard once the stage has drawn it at its new size.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      window.dispatchEvent(new CustomEvent(WORKSPACE_LAYOUT_COMMAND_EVENT, { detail: { type: 'fit-artboard' } }));
    }));
  };

  const dialog = isOpen ? (
    <StartRecipeDialog
      isOpen
      initialWidth={projectResolution.width}
      initialHeight={projectResolution.height}
      initialFps={fps}
      onCreate={create}
      onClose={() => setIsOpen(false)}
    />
  ) : null;

  return { openStartRecipes: () => setIsOpen(true), dialog };
};
