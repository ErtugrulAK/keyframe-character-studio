import React from 'react';
import {
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Box,
  Type as TypeIcon,
  Image as ImageIcon,
  Video as VideoIcon,
  Layers,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  GripVertical,
  Pill,
  Flag,
  Scissors,
  AlertTriangle,
  Blend,
  SquareDashed,
} from 'lucide-react';
import type { BodyPartType, CharacterPart } from '../../types/animator';
import { booleanOperationLabel } from '../../utils/booleanGeometry';
import { isMatteSourceSuppressed, resolveMatteSource } from '../../utils/matte';
import type { LayerDropPosition } from '../../utils/layerParenting';
import {
  SHAPE_ICON_MAP,
  SHAPE_ICON_SIZE,
  SHAPE_ICON_STROKE_WIDTH,
} from '../../utils/shapeIconMap';
import { InlineRename } from '../Shared/InlineRename';

/**
 * Stable action bag the panel hands every row. Its identity never changes, so a
 * row re-renders only when ITS OWN data changes — never because the playhead
 * moved (C2 perf: the layer tree used to rebuild every row on every frame).
 */
export interface OutlinerRowActions {
  click: (partId: string, event: React.MouseEvent) => void;
  contextMenu: (partId: string, event: React.MouseEvent) => void;
  toggleExpanded: (partId: string) => void;
  toggleVisibility: (partId: string) => void;
  /** The layer's lock switch. */
  toggleLock: (partId: string) => void;
  moveInStack: (partId: string, direction: -1 | 1) => void;
  startRename: (partId: string) => void;
  commitRename: (partId: string, name: string) => void;
  cancelRename: (partId: string) => void;
  dragStart: (partId: string, event: React.DragEvent) => void;
  dragOver: (partId: string, event: React.DragEvent<HTMLElement>) => void;
  drop: (partId: string, event: React.DragEvent) => void;
  dragEnd: () => void;
}

interface OutlinerRowProps {
  part: CharacterPart;
  depth: number;
  hasChildren: boolean;
  isExpanded: boolean;
  /** Position in the layer stack (array order), for the stack buttons. */
  stackIndex: number;
  stackSize: number;
  ordinal: number | undefined;
  isVisible: boolean;
  /** The layer's lock switch is on: content protected, still selectable here. */
  isLocked: boolean;
  hasTrack: boolean;
  selected: boolean;
  primary: boolean;
  focusable: boolean;
  renaming: boolean;
  dragging: boolean;
  dropPosition: LayerDropPosition | null;
  dropBlocked: boolean;
  /**
   * Shown INSIDE the target row while a drag is over its middle ("Parent
   * to …" / "Move into group …") or over a refused target (the reason).
   */
  dropLabel?: string;
  /** While the layer search is active: true on a match, false on an ancestor shown for context. */
  searchMatch?: boolean;
  /** The resolved matte source layer, when the row has a matte relationship. */
  matteSource: CharacterPart | undefined;
  /** Position among the visible rows, 1-based, for aria-posinset. */
  posInSet: number;
  setSize: number;
  actions: OutlinerRowActions;
}

const actorIcon = (type: string, isBooleanGroup: boolean) => {
  if (isBooleanGroup) return <Layers size={12} className="text-purple" />;
  const ShapeIcon = SHAPE_ICON_MAP[type as BodyPartType];
  if (ShapeIcon) {
    return <ShapeIcon size={SHAPE_ICON_SIZE - 6} strokeWidth={SHAPE_ICON_STROKE_WIDTH} style={{ color: 'var(--text-muted)' }} />;
  }
  switch (type) {
    case 'custom_text': return <TypeIcon size={12} className="text-cyan" />;
    case 'custom_image': return <ImageIcon size={12} className="text-teal" />;
    case 'custom_video': return <VideoIcon size={12} className="text-purple" />;
    case 'custom_card': return <Layers size={12} className="text-gold" />;
    case 'custom_capsule': return <Pill size={12} className="text-blue" />;
    case 'custom_banner': return <Flag size={12} className="text-blue" />;
    default: return <Box size={12} className="text-blue" />;
  }
};

const stackButtonStyle = (disabled: boolean): React.CSSProperties => ({
  opacity: disabled ? 0.25 : 1,
  padding: '1px 3px',
  background: 'transparent',
  border: 'none',
  color: '#a6a6a6',
  cursor: disabled ? 'default' : 'pointer',
  display: 'flex',
  alignItems: 'center',
});

export const OutlinerRow: React.FC<OutlinerRowProps> = React.memo(({
  part, depth, hasChildren, isExpanded, stackIndex, stackSize, ordinal, isVisible, isLocked, hasTrack, selected, primary,
  focusable, renaming, dragging, dropPosition, dropBlocked, dropLabel, searchMatch, matteSource, posInSet, setSize, actions,
}) => {
  const matteRelationship = resolveMatteSource(part);
  const isTrackMatte = matteRelationship?.kind === 'track';
  const suppressed = matteRelationship ? isMatteSourceSuppressed(part) : false;
  const dropClass = dropPosition ? ` drop-${dropPosition}${dropBlocked ? ' drop-blocked' : ''}` : '';
  return (
    <div
      role="treeitem"
      // The row is announced by its name and states only (its buttons have
      // their own names), so it reads "Photo, hidden, locked, 1 mask".
      aria-label={[
        part.name,
        part.isGroup ? 'group' : null,
        isVisible ? null : 'hidden',
        isLocked ? 'locked' : null,
        matteRelationship ? `${isTrackMatte ? 'track matte' : 'clip matte'} ${matteSource ? matteSource.name || matteSource.id : 'missing'}` : null,
        (part.masks?.length ?? 0) > 0 ? `${part.masks!.length} mask${part.masks!.length === 1 ? '' : 's'}` : null,
      ].filter(Boolean).join(', ')}
      aria-level={depth + 2}
      aria-selected={selected}
      aria-expanded={hasChildren ? isExpanded : undefined}
      aria-posinset={posInSet}
      aria-setsize={setSize}
      tabIndex={focusable ? 0 : -1}
      data-locked={isLocked ? 'true' : undefined}
      className={`tree-node actor-node ${isLocked ? 'is-locked ' : ''}${selected ? 'selected' : ''} ${primary ? 'primary-selected' : ''} ${hasChildren ? 'has-children' : ''} ${depth > 0 ? 'nested-node' : ''} ${dragging ? 'dragging' : ''}${dropClass}`}
      data-layer-id={part.id}
      data-parent-id={(part.parentId ?? part.booleanGroupId) ?? ''}
      data-tree-depth={depth}
      data-group-container={part.isGroup ? 'true' : undefined}
      data-layer-ordinal={ordinal}
      data-drop-position={dropPosition ?? undefined}
      data-search-match={searchMatch === undefined ? undefined : String(searchMatch)}
      onClick={(event) => actions.click(part.id, event)}
      onContextMenu={(event) => actions.contextMenu(part.id, event)}
      draggable={!renaming}
      onDragStart={(event) => actions.dragStart(part.id, event)}
      onDragOver={(event) => actions.dragOver(part.id, event)}
      onDrop={(event) => actions.drop(part.id, event)}
      onDragEnd={actions.dragEnd}
      style={{ display: 'flex', alignItems: 'center', padding: `4px 8px 4px ${8 + depth * 22}px`, cursor: 'pointer', userSelect: 'none' }}
    >
      {hasChildren ? (
        <button
          type="button"
          tabIndex={-1}
          className="tree-toggle-btn"
          aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${part.name}`}
          title={`${isExpanded ? 'Collapse' : 'Expand'} (← / →)`}
          aria-expanded={isExpanded}
          onClick={(event) => {
            event.stopPropagation();
            actions.toggleExpanded(part.id);
          }}
        >
          {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </button>
      ) : (
        <span className="tree-toggle-btn" aria-hidden="true" />
      )}

      <span title="Drag to reorder; drop on the middle of a layer to nest it" style={{ display: 'flex', alignItems: 'center', cursor: 'grab', marginRight: 4 }}>
        <GripVertical size={12} className="track-drag-grip" style={{ color: '#787878' }} />
      </span>

      {/* C5 — a real switch (named, pressed state, disabled with a reason);
          the row keeps one Tab stop, the context menu offers it by keyboard. */}
      <button
        type="button"
        tabIndex={-1}
        className={`col-eye outliner-eye-btn${isVisible ? '' : ' is-hidden'}`}
        aria-label={`Show ${part.name} on stage`}
        aria-pressed={isVisible}
        // A layer without a track (legacy import) has nothing to hide: the press
        // stays the no-op it always was, and the tooltip says why.
        onClick={(event) => {
          event.stopPropagation();
          if (hasTrack) actions.toggleVisibility(part.id);
        }}
        title={!hasTrack ? 'This layer has no track to hide' : isVisible ? 'Visible on stage' : 'Hidden from stage'}
      >
        {isVisible ? <Eye size={12} aria-hidden="true" /> : <EyeOff size={12} aria-hidden="true" />}
      </button>


      <div className="col-label" style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
        {/* Visual only: the row's name stays the layer name, and its position is
            announced through aria-posinset/aria-setsize. */}
        <span className="layer-ordinal" aria-hidden="true" title={`Position ${ordinal} of ${stackSize} in the layer list — a display number, not an ID`}>
          {ordinal}
        </span>
        {actorIcon(part.type, Boolean(part.booleanOperandIds?.length) || Boolean(part.isGroup))}
        {renaming ? (
          <InlineRename
            value={part.name}
            ariaLabel={`Rename ${part.isGroup ? 'group' : 'layer'} ${part.name}`}
            className="outliner-rename-input"
            onCommit={(next) => actions.commitRename(part.id, next)}
            onCancel={() => actions.cancelRename(part.id)}
          />
        ) : (
          <span
            className="actor-name"
            title={`${part.name} — double-click or F2 to rename`}
            onDoubleClick={(event) => {
              event.stopPropagation();
              actions.startRename(part.id);
            }}
            style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
            {part.name}
          </span>
        )}
        {part.booleanOperandIds?.length && part.booleanOperation && (
          <span className="boolean-operation-badge" title={`Boolean operation: ${booleanOperationLabel(part.booleanOperation)}`}>
            {booleanOperationLabel(part.booleanOperation)}
          </span>
        )}
        {matteRelationship && (
          <span
            title={matteSource
              ? `${isTrackMatte ? 'Track matte' : 'Matte'} source: ${matteSource.name || matteSource.id}${suppressed ? ' (source hidden — still clipping)' : ''}`
              : `${isTrackMatte ? 'Missing track matte' : 'Missing matte'} source${matteRelationship.sourceId ? ` (${matteRelationship.sourceId})` : ''}`}
            aria-label={matteSource
              ? `${isTrackMatte ? 'Track matte' : 'Matte'} source: ${matteSource.name || matteSource.id}${suppressed ? ' (source hidden)' : ''}`
              : isTrackMatte ? 'Missing track matte source' : 'Missing matte source'}
            className={`outliner-relation-badge ${matteSource ? 'is-matte' : 'is-missing'}`}
          >
            {/* C3 — a Track Matte reads "Matte", the legacy clip matte "Clip":
                neither is a layer MASK, which has its own badge below. */}
            {!matteSource ? <AlertTriangle size={10} /> : isTrackMatte ? <Blend size={10} /> : <Scissors size={10} />}
            <span className="outliner-relation-text">
              {`${isTrackMatte ? 'Matte' : 'Clip'} · ${matteSource ? (matteSource.name || matteSource.id) : 'missing'}`}
            </span>
          </span>
        )}
        {(part.masks?.length ?? 0) > 0 && (
          <span
            className="outliner-relation-badge is-mask"
            title={`${part.masks!.length} layer mask${part.masks!.length === 1 ? '' : 's'} on this layer`}
            aria-label={`${part.masks!.length} layer mask${part.masks!.length === 1 ? '' : 's'}`}
          >
            <SquareDashed size={10} />
            <span className="outliner-relation-text">{part.masks!.length}</span>
          </span>
        )}
        {part.booleanGroupId && <span className="boolean-operand-label" title="Boolean operand">Operand</span>}
        {dropLabel && (
          <span className={`outliner-drop-label${dropBlocked ? ' is-blocked' : ''}`} data-testid="outliner-drop-label" aria-hidden="true" title={dropLabel}>
            {dropLabel}
          </span>
        )}
      </div>

      {/* C4 — the lock switch (after the name, so the row is announced by its
          name first): always reachable (by mouse here, by Ctrl+L on the
          selection, or the context menu), and always showing its state. */}
      <button
        type="button"
        tabIndex={-1}
        className={`outliner-lock-btn${isLocked ? ' is-locked' : ''}`}
        aria-label={`${isLocked ? 'Unlock' : 'Lock'} ${part.name}`}
        aria-pressed={isLocked}
        title={isLocked ? 'Locked — click to unlock (Ctrl+L)' : 'Lock layer (Ctrl+L)'}
        disabled={!hasTrack}
        onClick={(event) => {
          event.stopPropagation();
          actions.toggleLock(part.id);
        }}
      >
        {isLocked ? <Lock size={11} /> : <Unlock size={11} />}
      </button>
      <div className="outliner-stack-buttons" style={{ display: 'flex', alignItems: 'center', gap: 2, marginLeft: 'auto' }} onClick={(event) => event.stopPropagation()}>
        <button
          type="button"
          tabIndex={-1}
          disabled={stackIndex === 0}
          onClick={() => actions.moveInStack(part.id, -1)}
          title="Move Layer Up (Bring Forward)"
          style={stackButtonStyle(stackIndex === 0)}
        >
          <ChevronUp size={12} />
        </button>
        <button
          type="button"
          tabIndex={-1}
          disabled={stackIndex === stackSize - 1}
          onClick={() => actions.moveInStack(part.id, 1)}
          title="Move Layer Down (Send Backward)"
          style={stackButtonStyle(stackIndex === stackSize - 1)}
        >
          <ChevronDown size={12} />
        </button>
      </div>
    </div>
  );
});
OutlinerRow.displayName = 'OutlinerRow';
