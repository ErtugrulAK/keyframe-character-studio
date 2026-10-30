import { createContext, useContext } from 'react';

/** Where the menu was requested: a client point plus the layer under it (null on empty stage). */
export interface ContextMenuRequest {
  point: { x: number; y: number };
  targetId: string | null;
}

interface EditorContextMenuApi {
  openContextMenu: (request: ContextMenuRequest) => void;
  closeContextMenu: () => void;
}

/**
 * The editor context-menu context object.
 *
 * It lives in this module, separate from `EditorContextMenuContext.tsx`, so that
 * the provider module exports components only — a module that exports both a
 * component and a hook breaks React Fast Refresh for that module.
 */
export const EditorContextMenuContext = createContext<EditorContextMenuApi | null>(null);

/**
 * Reads the editor context-menu API from context.
 *
 * @throws When called outside `EditorContextMenuProvider`, which is a programming error.
 */
export const useEditorContextMenu = (): EditorContextMenuApi => {
  const api = useContext(EditorContextMenuContext);
  if (!api) throw new Error('useEditorContextMenu must be used within an EditorContextMenuProvider');
  return api;
};
