import React, { useMemo, useState } from 'react';
import { useAnimator } from '../../context/AnimatorContext';
import {
  Eye,
  EyeOff,
  Box,
  Type as TypeIcon,
  Image as ImageIcon,
  Video as VideoIcon,
  Layers,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  GripVertical,
  RectangleHorizontal,
  Square,
  Triangle,
  Star,
  Diamond,
  PenTool,
  Pill,
  Flag,
  Scissors,
  AlertTriangle,
} from 'lucide-react';
import { ParallelogramIcon } from '../Toolbar/drawers/ElementsDrawer';

export const OutlinerPanel: React.FC = () => {
  const {
    tracks,
    characterParts,
    selectedPartId,
    selectedPartIds,
    handleSelectPart,
    toggleTrackEditVisibility,
    sceneTitle,
    reorderParts,
    activeTool,
    setActiveTool,
    focusModeNodeId,
    setFocusModeNodeId,
  } = useAnimator();

  const [isGroupExpanded, setIsGroupExpanded] = useState(true);
  const [collapsedPartIds, setCollapsedPartIds] = useState<Set<string>>(() => new Set());
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const partById = useMemo(
    () => new Map(characterParts.map((part) => [part.id, part])),
    [characterParts],
  );
  const childrenByParentId = useMemo(() => {
    const children = new Map<string, typeof characterParts>();
    characterParts.forEach((part) => {
      if (!part.parentId || !partById.has(part.parentId)) return;
      const siblings = children.get(part.parentId) ?? [];
      siblings.push(part);
      children.set(part.parentId, siblings);
    });
    return children;
  }, [characterParts, partById]);
  const rootParts = useMemo(
    () => characterParts.filter((part) => !part.parentId || !partById.has(part.parentId)),
    [characterParts, partById],
  );
  const togglePartExpanded = (partId: string) => {
    setCollapsedPartIds((previous) => {
      const next = new Set(previous);
      if (next.has(partId)) next.delete(partId);
      else next.add(partId);
      return next;
    });
  };

  const renderPartRows = (part: typeof characterParts[number], depth: number, ancestry: Set<string>): React.ReactNode[] => {
    const childParts = childrenByParentId.get(part.id) ?? [];
    const hasChildren = childParts.length > 0;
    const isExpanded = !collapsedPartIds.has(part.id);
    const index = characterParts.indexOf(part);
    const track = tracks.find((t) => t.partId === part.id);
    const isVisible = track?.editVisible !== false;
    const nextAncestry = new Set(ancestry);
    nextAncestry.add(part.id);

    const row = (
      <div
        key={part.id}
        role="treeitem"
        className={`tree-node actor-node ${selectedPartIds?.includes(part.id) ? 'selected' : ''} ${selectedPartId === part.id ? 'primary-selected' : ''} ${draggedIdx === index ? 'dragging' : ''} ${dragOverIdx === index ? 'drag-over' : ''}`}
        data-parent-id={part.parentId ?? ''}
        data-tree-depth={depth}
        aria-level={depth + 1}
        onClick={(e) => {
          // Selecting a part from the outliner exits the mask tool
          // + focus mode so the normal gizmo comes back.
          if ((activeTool === 'mask' || focusModeNodeId) && focusModeNodeId !== part.id) {
            setActiveTool('select');
            setFocusModeNodeId(null);
          }
          handleSelectPart(part.id, e.shiftKey);
        }}
        draggable={true}
        onDragStart={(e) => {
          setDraggedIdx(index);
          e.dataTransfer.effectAllowed = 'move';
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          if (dragOverIdx !== index) setDragOverIdx(index);
        }}
        onDragLeave={() => {
          if (dragOverIdx === index) setDragOverIdx(null);
        }}
        onDrop={(e) => {
          e.preventDefault();
          if (draggedIdx !== null && draggedIdx !== index) reorderParts(draggedIdx, index);
          setDraggedIdx(null);
          setDragOverIdx(null);
        }}
        onDragEnd={() => {
          setDraggedIdx(null);
          setDragOverIdx(null);
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: `4px 8px 4px ${8 + depth * 16}px`,
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        {hasChildren ? (
          <button
            type="button"
            className="tree-toggle-btn"
            aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${part.name}`}
            aria-expanded={isExpanded}
            onClick={(e) => {
              e.stopPropagation();
              togglePartExpanded(part.id);
            }}
          >
            {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>
        ) : (
          <span className="tree-toggle-btn" aria-hidden="true" />
        )}

        <span title="Drag up or down to reorder layer depth" style={{ display: 'flex', alignItems: 'center', cursor: 'grab', marginRight: 4 }}>
          <GripVertical size={12} className="track-drag-grip" style={{ color: '#64748b' }} />
        </span>

        {/* Eye Visibility Column */}
        <div
          className="col-eye"
          onClick={(e) => {
            e.stopPropagation();
            if (track) toggleTrackEditVisibility(track.id);
          }}
          title={isVisible ? 'Visible on stage' : 'Hidden from stage'}
          style={{ cursor: 'pointer', marginRight: 6, padding: '2px 6px', marginLeft: 2 }}
        >
          {isVisible ? <Eye size={12} className="text-teal" /> : <EyeOff size={12} className="text-muted-red" />}
        </div>

        {/* Item Label Column */}
        <div className="col-label" style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          {getActorIcon(part.type)}
          <span className="actor-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {part.name}
          </span>
          {part.matte?.sourcePartId && (
            <span
              title={matteSourcePart(part.matte.sourcePartId)
                ? `Matte source: ${matteSourcePart(part.matte.sourcePartId)!.name}`
                : `Missing matte source (${part.matte.sourcePartId})`}
              aria-label={matteSourcePart(part.matte.sourcePartId)
                ? `Matte source: ${matteSourcePart(part.matte.sourcePartId)!.name}`
                : 'Missing matte source'}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 3,
                flexShrink: 0,
                color: matteSourcePart(part.matte.sourcePartId) ? '#00d2ff' : '#f59e0b',
                fontSize: 10,
              }}
            >
              {matteSourcePart(part.matte.sourcePartId) ? <Scissors size={10} /> : <AlertTriangle size={10} />}
              <span style={{ maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {matteSourcePart(part.matte.sourcePartId) ? matteSourcePart(part.matte.sourcePartId)!.name : 'Missing'}
              </span>
            </span>
          )}
        </div>

        {/* Up / Down Move Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginLeft: 'auto' }} onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            disabled={index === 0}
            onClick={() => {
              if (index > 0) reorderParts(index, index - 1);
            }}
            title="Move Layer Up (Bring Forward)"
            style={{
              opacity: index === 0 ? 0.25 : 1,
              padding: '1px 3px',
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: index === 0 ? 'default' : 'pointer',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <ChevronUp size={12} />
          </button>
          <button
            type="button"
            disabled={index === characterParts.length - 1}
            onClick={() => {
              if (index < characterParts.length - 1) reorderParts(index, index + 1);
            }}
            title="Move Layer Down (Send Backward)"
            style={{
              opacity: index === characterParts.length - 1 ? 0.25 : 1,
              padding: '1px 3px',
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: index === characterParts.length - 1 ? 'default' : 'pointer',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <ChevronDown size={12} />
          </button>
        </div>
      </div>
    );

    if (!hasChildren || !isExpanded) return [row];
    const childRows = childParts.flatMap((child) => (
      nextAncestry.has(child.id)
        ? []
        : renderPartRows(child, depth + 1, nextAncestry)
    ));
    return [row, ...childRows];
  };

  // M22 8A — matte source lookup for the outliner indicator. Derived directly
  // from part.matte.sourcePartId + characterParts (single relationship
  // authority — no cached/duplicated source state).
  const matteSourcePart = (sourcePartId: string) => characterParts.find((part) => part.id === sourcePartId);

  const getActorIcon = (type: string) => {
    switch (type) {
      case 'custom_text':
        return <TypeIcon size={12} className="text-cyan" />;
      case 'custom_image':
        return <ImageIcon size={12} className="text-teal" />;
      case 'custom_video':
        return <VideoIcon size={12} className="text-purple" />;
      case 'custom_card':
        return <Layers size={12} className="text-gold" />;
      case 'custom_rect':
      case 'custom_box':
        return <RectangleHorizontal size={12} className="text-teal" />;
      case 'custom_square':
      case 'custom_circle':
        return <Square size={12} className="text-teal" />;
      case 'custom_triangle':
        return <Triangle size={12} className="text-teal" />;
      case 'custom_star':
        return <Star size={12} className="text-gold" />;
      case 'custom_diamond':
        return <Diamond size={12} className="text-gold" />;
      case 'custom_parallelogram':
        return <ParallelogramIcon size={12} className="text-gold" />;
      case 'custom_freeform':
        return <PenTool size={12} className="text-cyan" />;
      case 'custom_capsule':
        return <Pill size={12} className="text-blue" />;
      case 'custom_banner':
        return <Flag size={12} className="text-blue" />;
      default:
        return <Box size={12} className="text-blue" />;
    }
  };
  return (
    <div className="outliner-container">
      <div className="outliner-header">
        <div className="outliner-title-group">
          <Layers size={14} className="text-teal" />
          <span className="outliner-title">Template Elements</span>
        </div>
      </div>

      <div className="outliner-table-body">
        <div className="tree-node root-node" role="treeitem" aria-level={1}>
          <div className="node-content">
            <button
              type="button"
              className="tree-toggle-btn"
              aria-label={`${isGroupExpanded ? 'Collapse' : 'Expand'} ${sceneTitle} Elements`}
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
          <div className="tree-group-container" role="tree">
            {rootParts.length === 0 ? (
              <div style={{ padding: '12px 14px', fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                No elements in active template yet. Add shapes or text from left toolbar.
              </div>
            ) : (
              rootParts.flatMap((part) => renderPartRows(part, 0, new Set<string>()))
            )}
          </div>
        )}
      </div>

      <div className="outliner-footer">
        <span>
          {characterParts.length} elements ({selectedPartId ? '1 selected' : '0 selected'})
        </span>
      </div>
    </div>
  );
};
