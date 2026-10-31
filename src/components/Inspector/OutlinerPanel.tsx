import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, Layers, Search, X } from 'lucide-react';
import { useAnimatorSlice, useAnimatorReader } from '../../context/useAnimator';
import { useEditorContextMenu } from '../../context/editorContextMenu';
import type { CharacterPart } from '../../types/animator';
import { resolveMatteSource } from '../../utils/matte';
import { projectLayerOrdinals } from '../../utils/layerOrdinal';
import { reparentBlockReason, type LayerDropPosition } from '../../utils/layerParenting';
import { relationshipParentId } from '../../utils/partBinding';
import { createLayerParentingActions } from '../../hooks/useLayerParenting';
import { OUTLINER_COMMAND_EVENT, type OutlinerCommand } from '../../utils/outlinerCommands';
import { OutlinerRow, type OutlinerRowActions } from './OutlinerRow';
import { useRetainedScrollTop, useRetainedUiState } from '../../hooks/useRetainedUiState';
import { useRowWindow, type RowViewport } from '../../hooks/useRowWindow';
import { searchLayers } from '../../utils/layerSearch';

/** The row pitch assumed until a mounted row has been measured. */
const OUTLINER_ROW_PITCH_ESTIMATE = 28;

interface VisibleRow {
  part: CharacterPart;
  depth: number;
  hasChildren: boolean;
  isExpanded: boolean;
  parentRowId: string | null;
}

interface DropTarget {
  id: string;
  position: LayerDropPosition;
  /** Why the drop would be refused, or null when it is allowed. */
  blockedReason: string | null;
}

/** Outer quarter of a row = before/after, the middle half = nest. */
const dropPositionAt = (event: React.DragEvent<HTMLElement>): LayerDropPosition => {
  const rect = event.currentTarget.getBoundingClientRect();
  const ratio = rect.height > 0 ? (event.clientY - rect.top) / rect.height : 0.5;
  if (ratio < 0.25) return 'before';
  if (ratio > 0.75) return 'after';
  return 'nest';
};

export const OutlinerPanel: React.FC = () => {
  // The rows read these; actions read the whole store at call time.
  const {
    tracks,
    characterParts,
    selectedPartId,
    selectedPartIds,
    sceneTitle,
  } = useAnimatorSlice('tracks', 'characterParts', 'selectedPartId', 'selectedPartIds', 'sceneTitle');
  const readAnimator = useAnimatorReader();
  const { openContextMenu } = useEditorContextMenu();

  // Kept across an Edit ⇄ Broadcast round trip (the panel unmounts in Broadcast).
  const [isGroupExpanded, setIsGroupExpanded] = useRetainedUiState('outliner.rootExpanded', true);
  const [collapsedPartIds, setCollapsedPartIds] = useRetainedUiState<Set<string>>('outliner.collapsed', () => new Set());
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const [status, setStatus] = useState('');
  const treeRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pendingFocusRef = useRef<string | null>(null);

  const partById = useMemo(() => new Map(characterParts.map((part) => [part.id, part])), [characterParts]);
  // Layer search on the scene data (the windowed list cannot be searched
  // by the browser's find): matches and their ancestors, expanded.
  const [layerQuery, setLayerQuery] = useRetainedUiState('outliner.query', '');
  const search = useMemo(() => searchLayers(characterParts, layerQuery), [characterParts, layerQuery]);
  const searchMatchIds = useMemo(() => new Set(search?.matchIds ?? []), [search]);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const visibleRows = useMemo(() => {
    const childrenOf = new Map<string, CharacterPart[]>();
    const roots: CharacterPart[] = [];
    characterParts.forEach((part) => {
      const parentId = relationshipParentId(part);
      if (parentId && partById.has(parentId)) {
        const siblings = childrenOf.get(parentId) ?? [];
        siblings.push(part);
        childrenOf.set(parentId, siblings);
      } else roots.push(part);
    });
    const rows: VisibleRow[] = [];
    const visit = (part: CharacterPart, depth: number, parentRowId: string | null, ancestry: Set<string>) => {
      if (search && !search.shownIds.has(part.id)) return;
      const children = (childrenOf.get(part.id) ?? []).filter((child) => !ancestry.has(child.id) && (!search || search.shownIds.has(child.id)));
      const isExpanded = search ? true : !collapsedPartIds.has(part.id);
      rows.push({ part, depth, hasChildren: children.length > 0, isExpanded, parentRowId });
      if (!isExpanded) return;
      const nextAncestry = new Set(ancestry).add(part.id);
      children.forEach((child) => visit(child, depth + 1, part.id, nextAncestry));
    };
    roots.forEach((part) => visit(part, 0, null, new Set()));
    return rows;
  }, [characterParts, collapsedPartIds, partById, search]);
  const stackIndexById = useMemo(() => new Map(characterParts.map((part, index) => [part.id, index])), [characterParts]);
  const visibilityById = useMemo(() => new Map(tracks.map((track) => [track.partId, track.editVisible !== false])), [tracks]);
  const lockedById = useMemo(() => new Set(tracks.filter((track) => track.locked).map((track) => track.partId)), [tracks]);
  // One derived display ordinal per layer (never an identity).
  const layerOrdinals = useMemo(() => projectLayerOrdinals(characterParts), [characterParts]);
  const selectedSet = useMemo(() => new Set(selectedPartIds ?? []), [selectedPartIds]);
  const rovingId = focusedId && visibleRows.some((row) => row.part.id === focusedId)
    ? focusedId
    : (selectedPartId && visibleRows.some((row) => row.part.id === selectedPartId) ? selectedPartId : visibleRows[0]?.part.id ?? null);

  // A long list mounts only the rows near its viewport. The roving row
  // (Tab's way into the tree), the renamed, dragged and drop-target rows and
  // the primary selection stay mounted wherever they are.
  const pinnedRows = useMemo(() => {
    const indexById = new Map(visibleRows.map((row, index) => [row.part.id, index]));
    return [rovingId, renamingId, draggingId, dropTarget?.id ?? null, selectedPartId ?? null]
      .map((id) => (id ? indexById.get(id) : undefined))
      .filter((index): index is number => index !== undefined);
  }, [visibleRows, rovingId, renamingId, draggingId, dropTarget, selectedPartId]);
  const treeViewport = useCallback((scrollElement: HTMLElement): RowViewport => {
    const tree = treeRef.current;
    const top = tree ? scrollElement.getBoundingClientRect().top - tree.getBoundingClientRect().top : scrollElement.scrollTop;
    return { top, height: scrollElement.clientHeight };
  }, []);
  // The row pitch comes from the stylesheet: measured from a mounted row.
  const [rowPitch, setRowPitch] = useState(OUTLINER_ROW_PITCH_ESTIMATE);
  const outlinerRowHeight = useCallback(() => rowPitch, [rowPitch]);
  const hasRows = visibleRows.length > 0;
  useEffect(() => {
    const row = treeRef.current?.querySelector<HTMLElement>('[data-layer-id]');
    if (!row || typeof ResizeObserver !== 'function') return undefined;
    const observer = new ResizeObserver(() => {
      if (row.offsetHeight > 0) setRowPitch(row.offsetHeight);
    });
    observer.observe(row);
    return () => observer.disconnect();
  }, [hasRows, isGroupExpanded]);
  // Restored before the row window reads the offset (declaration order).
  useRetainedScrollTop('outliner.scrollTop', scrollRef);
  const rowWindow = useRowWindow({
    count: isGroupExpanded ? visibleRows.length : 0,
    heightAt: outlinerRowHeight,
    pinned: pinnedRows,
    scrollRef,
    viewportOf: treeViewport,
  });

  // Everything a row action needs, read at call time — never a render dependency.
  const latest = useRef({ visibleRows, draggingId, dropTarget, openContextMenu });
  useLayoutEffect(() => {
    latest.current = { visibleRows, draggingId, dropTarget, openContextMenu };
  });

  const focusRow = useCallback((id: string) => {
    setFocusedId(id);
    pendingFocusRef.current = id;
  }, []);
  useEffect(() => {
    const id = pendingFocusRef.current;
    if (!id) return;
    const element = treeRef.current?.querySelector<HTMLElement>(`[data-layer-id="${CSS.escape(id)}"]`);
    if (!element) return;
    pendingFocusRef.current = null;
    element.focus();
  });

  const selectRow = useCallback((partId: string, additive: boolean) => {
    const {
      handleSelectPart, activeTool, focusModeNodeId, setActiveTool, setFocusModeNodeId,
      booleanOperandEditingGroupId, setBooleanOperandEditingGroupId,
    } = readAnimator();
    const part = readAnimator().characterParts.find((candidate) => candidate.id === partId);
    // Selecting a part outside the active Boolean structure exits the
    // transient operand editing mode.
    if (booleanOperandEditingGroupId && partId !== booleanOperandEditingGroupId && part?.booleanGroupId !== booleanOperandEditingGroupId) {
      setBooleanOperandEditingGroupId(null);
    }
    if ((activeTool === 'mask' || focusModeNodeId) && focusModeNodeId !== partId) {
      setActiveTool('select');
      setFocusModeNodeId(null);
    }
    handleSelectPart(partId, additive);
  }, [readAnimator]);

  const startRename = useCallback((partId: string) => {
    setRenamingId(partId);
    setFocusedId(partId);
  }, []);

  const rowActions = useMemo<OutlinerRowActions>(() => ({
    click: (partId, event) => {
      setFocusedId(partId);
      selectRow(partId, event.shiftKey || event.ctrlKey || event.metaKey);
    },
    contextMenu: (partId, event) => {
      // The shared authoring menu; the provider selects this layer first.
      event.preventDefault();
      latest.current.openContextMenu({ point: { x: event.clientX, y: event.clientY }, targetId: partId });
    },
    toggleExpanded: (partId) => setCollapsedPartIds((previous) => {
      const next = new Set(previous);
      if (next.has(partId)) next.delete(partId);
      else next.add(partId);
      return next;
    }),
    toggleVisibility: (partId) => {
      const track = readAnimator().tracks.find((candidate) => candidate.partId === partId);
      if (track) readAnimator().toggleTrackEditVisibility(track.id);
    },
    toggleLock: (partId) => {
      const track = readAnimator().tracks.find((candidate) => candidate.partId === partId);
      if (track) readAnimator().setLayersLocked([partId], !track.locked);
    },
    moveInStack: (partId, direction) => {
      const parts = readAnimator().characterParts;
      const index = parts.findIndex((part) => part.id === partId);
      const next = index + direction;
      if (index < 0 || next < 0 || next >= parts.length) return;
      readAnimator().reorderParts(index, next);
    },
    startRename,
    commitRename: (partId, name) => {
      const part = readAnimator().characterParts.find((candidate) => candidate.id === partId);
      setRenamingId(null);
      focusRow(partId);
      if (part && name.trim() && name.trim() !== part.name) readAnimator().renamePartAndTrack(partId, name);
    },
    cancelRename: (partId) => {
      setRenamingId(null);
      focusRow(partId);
    },
    dragStart: (partId, event) => {
      setDraggingId(partId);
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', partId);
    },
    dragOver: (partId, event) => {
      const dragged = latest.current.draggingId;
      if (!dragged) return;
      event.preventDefault();
      const position = dropPositionAt(event);
      const { characterParts: parts, tracks: currentTracks } = readAnimator();
      const target = parts.find((part) => part.id === partId);
      const nextParent = position === 'nest' ? partId : (relationshipParentId(target) ?? null);
      const blockedReason = dragged === partId
        ? 'A layer cannot be dropped onto itself.'
        : reparentBlockReason(parts, currentTracks, dragged, nextParent);
      const currentParent = relationshipParentId(parts.find((part) => part.id === dragged)) ?? null;
      // Staying under the same parent is a plain reorder: never blocked by animation.
      const reason = !blockedReason || (nextParent === currentParent && dragged !== partId) ? null : blockedReason;
      event.dataTransfer.dropEffect = reason ? 'none' : 'move';
      const previous = latest.current.dropTarget;
      if (previous?.id === partId && previous.position === position && previous.blockedReason === reason) return;
      setDropTarget({ id: partId, position, blockedReason: reason });
    },
    drop: (partId, event) => {
      event.preventDefault();
      const dragged = latest.current.draggingId;
      const position = dropPositionAt(event as React.DragEvent<HTMLElement>);
      setDraggingId(null);
      setDropTarget(null);
      if (!dragged || dragged === partId) return;
      if (createLayerParentingActions(readAnimator()).dropLayer(dragged, partId, position)) focusRow(dragged);
    },
    dragEnd: () => {
      // A refused drop never fires `drop` (the browser honours dropEffect
      // "none"), so the reason the hint showed is repeated once on release.
      const refused = latest.current.dropTarget?.blockedReason;
      if (refused) readAnimator().showToast(refused, 'error');
      setDraggingId(null);
      setDropTarget(null);
    },
  }), [focusRow, readAnimator, selectRow, setCollapsedPartIds, startRename]);

  // The context menu's "Rename" (and any other surface) asks through one event.
  useEffect(() => {
    const handleCommand = (event: Event) => {
      const command = (event as CustomEvent<OutlinerCommand>).detail;
      if (command?.type !== 'rename') return;
      // Reveal the row first: expand every collapsed ancestor.
      const parts = readAnimator().characterParts;
      const ancestors: string[] = [];
      let cursor = relationshipParentId(parts.find((part) => part.id === command.partId));
      while (cursor && !ancestors.includes(cursor)) {
        ancestors.push(cursor);
        cursor = relationshipParentId(parts.find((part) => part.id === cursor));
      }
      setIsGroupExpanded(true);
      setCollapsedPartIds((previous) => (ancestors.some((id) => previous.has(id)) ? new Set([...previous].filter((id) => !ancestors.includes(id))) : previous));
      startRename(command.partId);
    };
    window.addEventListener(OUTLINER_COMMAND_EVENT, handleCommand);
    return () => window.removeEventListener(OUTLINER_COMMAND_EVENT, handleCommand);
  }, [readAnimator, setCollapsedPartIds, setIsGroupExpanded, startRename]);

  const announce = (message: string) => setStatus(message);

  /** The layer tree's own keys (scope "layers"); everything else falls through to the editor. */
  const handleTreeKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (renamingId) return;
    const row = (event.target as HTMLElement).closest<HTMLElement>('[data-layer-id]');
    const id = row?.dataset.layerId;
    if (!id) return;
    const rows = visibleRows;
    const index = rows.findIndex((candidate) => candidate.part.id === id);
    if (index < 0) return;
    const current = rows[index];
    const plain = !event.altKey && !event.ctrlKey && !event.metaKey;
    const handled = () => {
      event.preventDefault();
      event.stopPropagation();
    };
    if (event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
      const actions = createLayerParentingActions(readAnimator());
      let done = false;
      if (event.key === 'ArrowUp') done = actions.moveLayerAmongSiblings(id, -1);
      else if (event.key === 'ArrowDown') done = actions.moveLayerAmongSiblings(id, 1);
      else if (event.key === 'ArrowRight') done = actions.nestIntoLayerAbove(id);
      else if (event.key === 'ArrowLeft') done = actions.unparentLayer(id);
      else return;
      handled();
      if (done) {
        focusRow(id);
        announce(`${current.part.name} ${event.key === 'ArrowUp' ? 'moved up' : event.key === 'ArrowDown' ? 'moved down' : event.key === 'ArrowRight' ? 'nested' : 'unparented'}`);
      }
      return;
    }
    if (!plain || event.shiftKey) {
      if (event.key === 'Enter' && (event.shiftKey || event.ctrlKey || event.metaKey)) {
        handled();
        selectRow(id, true);
      }
      return;
    }
    switch (event.key) {
      case 'ArrowDown':
        handled();
        if (rows[index + 1]) focusRow(rows[index + 1].part.id);
        return;
      case 'ArrowUp':
        handled();
        if (rows[index - 1]) focusRow(rows[index - 1].part.id);
        return;
      case 'Home':
        handled();
        if (rows[0]) focusRow(rows[0].part.id);
        return;
      case 'End':
        handled();
        if (rows.length) focusRow(rows[rows.length - 1].part.id);
        return;
      case 'ArrowRight':
        handled();
        if (current.hasChildren && !current.isExpanded) rowActions.toggleExpanded(id);
        else if (current.hasChildren && rows[index + 1]) focusRow(rows[index + 1].part.id);
        return;
      case 'ArrowLeft':
        handled();
        if (current.hasChildren && current.isExpanded) rowActions.toggleExpanded(id);
        else if (current.parentRowId) focusRow(current.parentRowId);
        return;
      case 'Enter':
        handled();
        selectRow(id, false);
        return;
      case 'F2':
        handled();
        startRename(id);
        return;
      default:
    }
  };

  /*
   * What the drop will do, BEFORE the release. Nesting onto a group puts
   * the layer IN the container ("Move into group"); nesting onto any other layer
   * is a transform relationship ("Parent to"); a line between rows is a reorder,
   * and the hint also says when that reorder changes the parent.
   */
  const dropHint = (() => {
    if (!draggingId || !dropTarget) return '';
    if (dropTarget.blockedReason) return `Cannot drop here: ${dropTarget.blockedReason}`;
    const target = partById.get(dropTarget.id);
    const targetName = target?.name ?? dropTarget.id;
    if (dropTarget.position === 'nest') return target?.isGroup ? `Move into group “${targetName}”` : `Parent to “${targetName}”`;
    const place = `Place ${dropTarget.position === 'before' ? 'above' : 'below'} “${targetName}”`;
    const dragged = partById.get(draggingId);
    const currentParent = relationshipParentId(dragged) ?? null;
    const nextParent = relationshipParentId(target) ?? null;
    if (currentParent === nextParent) return place;
    const nextParentPart = nextParent ? partById.get(nextParent) : undefined;
    if (!nextParentPart) return `${place} · moves to the top level`;
    return `${place} · ${nextParentPart.isGroup ? `into group “${nextParentPart.name}”` : `parent becomes “${nextParentPart.name}”`}`;
  })();

  return (
    <div className="outliner-container">
      <div className="outliner-header">
        <div className="outliner-title-group">
          <Layers size={14} className="text-teal" />
          {/* C3: the panel is the layer list; the root row below names the template. */}
          <span className="outliner-title">Layers</span>
        </div>
        {/* C5 — find a layer anywhere in the scene (searches the data, not the
            rows on screen). ↓ / Enter moves to the first match; Esc clears. */}
        <div className="outliner-search" role="search">
          <Search size={12} aria-hidden="true" className="outliner-search-icon" />
          <input
            ref={searchInputRef}
            type="text"
            className="outliner-search-input"
            aria-label="Find layer"
            placeholder="Find layer"
            value={layerQuery}
            spellCheck={false}
            onChange={(event) => {
              setLayerQuery(event.target.value);
              // A new result list starts at its first match.
              if (scrollRef.current) scrollRef.current.scrollTop = 0;
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape' && layerQuery) {
                event.preventDefault();
                event.stopPropagation();
                setLayerQuery('');
                return;
              }
              if ((event.key === 'ArrowDown' || event.key === 'Enter') && search?.matchIds.length) {
                event.preventDefault();
                event.stopPropagation();
                setIsGroupExpanded(true);
                const first = search.matchIds[0];
                if (event.key === 'Enter') selectRow(first, false);
                focusRow(first);
              }
            }}
          />
          {layerQuery && (
            <>
              <span className="outliner-search-count" data-testid="outliner-search-count" role="status" aria-live="polite">
                {search?.matchIds.length ? `${search.matchIds.length} of ${characterParts.length}` : 'No match'}
              </span>
              <button
                type="button"
                className="outliner-search-clear"
                aria-label="Clear layer search"
                title="Clear search (Esc)"
                onClick={() => {
                  setLayerQuery('');
                  searchInputRef.current?.focus();
                }}
              >
                <X size={12} aria-hidden="true" />
              </button>
            </>
          )}
        </div>
        {/* C3: the count lives in the header (C5: compact, the full text in its
            name), so the list keeps its height for rows. */}
        <span
          className="outliner-count"
          title={`${characterParts.length} layers, ${selectedPartIds?.length ?? 0} selected`}
        >
          {characterParts.length}
          {(selectedPartIds?.length ?? 0) > 0 ? ` · ${selectedPartIds?.length} sel` : ''}
        </span>
      </div>

      <div className="outliner-table-body" ref={scrollRef}>
        <div className="tree-node root-node" role="treeitem" aria-level={1}>
          <div className="node-content">
            <button
              type="button"
              className="tree-toggle-btn"
              aria-label={`${isGroupExpanded ? 'Collapse' : 'Expand'} ${sceneTitle} Elements`}
              title={isGroupExpanded ? 'Collapse the layer list' : 'Expand the layer list'}
              aria-expanded={isGroupExpanded}
              onClick={() => setIsGroupExpanded(!isGroupExpanded)}
            >
              {isGroupExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </button>
            <Layers size={13} className="text-teal" />
            <span className="node-title">{sceneTitle} Elements</span>
          </div>
        </div>

        {isGroupExpanded && (
          <div
            className="tree-group-container"
            role="tree"
            aria-label="Layers"
            aria-multiselectable="true"
            data-shortcut-scope="layers"
            ref={treeRef}
            onKeyDown={handleTreeKeyDown}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropTarget(null);
            }}
          >
            {visibleRows.length === 0 ? (
              <div style={{ padding: '12px 14px', fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                No elements in active template yet. Add shapes or text from left toolbar.
              </div>
            ) : (
              rowWindow.segments.flatMap((segment) => (segment.kind === 'gap' ? [
                <div key={`gap-${segment.start}`} className="row-window-spacer" role="none" aria-hidden="true" style={{ height: segment.height, flex: 'none' }} />,
              ] : visibleRows.slice(segment.start, segment.end).map((row, offset) => {
                const position = segment.start + offset;
                const matteReference = resolveMatteSource(row.part);
                return (
                  <OutlinerRow
                    key={row.part.id}
                    part={row.part}
                    depth={row.depth}
                    hasChildren={row.hasChildren}
                    isExpanded={row.isExpanded}
                    stackIndex={stackIndexById.get(row.part.id) ?? 0}
                    stackSize={characterParts.length}
                    ordinal={layerOrdinals.get(row.part.id)}
                    isVisible={visibilityById.get(row.part.id) ?? true}
                    isLocked={lockedById.has(row.part.id)}
                    hasTrack={visibilityById.has(row.part.id)}
                    selected={selectedSet.has(row.part.id)}
                    primary={selectedPartId === row.part.id}
                    focusable={rovingId === row.part.id}
                    renaming={renamingId === row.part.id}
                    dragging={draggingId === row.part.id}
                    dropPosition={dropTarget?.id === row.part.id ? dropTarget.position : null}
                    dropBlocked={dropTarget?.id === row.part.id && dropTarget.blockedReason !== null}
                    // The dragged row itself carries no label ("cannot be dropped onto
                    // itself" is noise under the pointer); the footer still says it.
                    dropLabel={dropTarget?.id === row.part.id && row.part.id !== draggingId && (dropTarget.position === 'nest' || dropTarget.blockedReason) ? dropHint : undefined}
                    matteSource={matteReference ? partById.get(matteReference.sourceId) : undefined}
                    searchMatch={search ? searchMatchIds.has(row.part.id) : undefined}
                    posInSet={position + 1}
                    setSize={visibleRows.length}
                    actions={rowActions}
                  />
                );
              })))
            )}
          </div>
        )}
      </div>

      <div className={`outliner-footer${dropHint || status ? '' : ' is-empty'}`}>
        <span className={`outliner-drop-hint${dropTarget?.blockedReason ? ' is-blocked' : ''}`} data-testid="outliner-drop-hint" role="status" aria-live="polite">
          {dropHint || status}
        </span>
      </div>
    </div>
  );
};
