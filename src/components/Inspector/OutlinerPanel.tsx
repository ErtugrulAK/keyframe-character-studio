import React, { useState } from 'react';
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
} from 'lucide-react';

export const OutlinerPanel: React.FC = () => {
  const {
    tracks,
    characterParts,
    selectedPartId,
    setSelectedPartId,
    toggleTrackEditVisibility,
    sceneTitle,
    reorderParts,
  } = useAnimator();

  const [isGroupExpanded, setIsGroupExpanded] = useState(true);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

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
      default:
        return <Box size={12} className="text-blue" />;
    }
  };

  return (
    <div className="outliner-container">
      {/* 1. Header Toolbar */}
      <div className="outliner-header">
        <div className="outliner-title-group">
          <Layers size={14} className="text-teal" />
          <span className="outliner-title">Template Elements</span>
        </div>
      </div>

      {/* 2. Template Elements List */}
      <div className="outliner-table-body">
        {/* Template Elements Root Group Node */}
        <div className="tree-node root-node">
          <div className="node-content">
            <button
              className="tree-toggle-btn"
              onClick={() => setIsGroupExpanded(!isGroupExpanded)}
            >
              {isGroupExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </button>
            <Layers size={13} className="text-teal" />
            <span className="node-title">{sceneTitle} Elements</span>
          </div>
        </div>

        {/* Template Element Rows */}
        {isGroupExpanded && (
          <div className="tree-group-container">
            {characterParts.length === 0 ? (
              <div style={{ padding: '12px 14px', fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                No elements in active template yet. Add shapes or text from left toolbar.
              </div>
            ) : (
              characterParts.map((part, index) => {
                const track = tracks.find((t) => t.partId === part.id);
                const isSelected = part.id === selectedPartId;
                const isVisible = track?.editVisible !== false;

                return (
                  <div
                    key={part.id}
                    className={`tree-node actor-node ${isSelected ? 'selected' : ''} ${draggedIdx === index ? 'dragging' : ''} ${dragOverIdx === index ? 'drag-over' : ''}`}
                    onClick={() => setSelectedPartId(part.id)}
                    draggable={true}
                    onDragStart={(e) => {
                      setDraggedIdx(index);
                      e.dataTransfer.effectAllowed = 'move';
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                      if (dragOverIdx !== index) {
                        setDragOverIdx(index);
                      }
                    }}
                    onDragLeave={() => {
                      if (dragOverIdx === index) {
                        setDragOverIdx(null);
                      }
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (draggedIdx !== null && draggedIdx !== index) {
                        reorderParts(draggedIdx, index);
                      }
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
                      padding: '4px 8px',
                      cursor: 'pointer',
                      userSelect: 'none',
                    }}
                  >
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
                      style={{ cursor: 'pointer', marginRight: 6 }}
                    >
                      {isVisible ? (
                        <Eye size={12} className="text-teal" />
                      ) : (
                        <EyeOff size={12} className="text-muted-red" />
                      )}
                    </div>

                    {/* Item Label Column */}
                    <div className="col-label" style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                      {getActorIcon(part.type)}
                      <span className="actor-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {part.name
                          ? part.name
                              .split(' ')
                              .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
                              .join(' ')
                          : part.name}
                      </span>
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
              })
            )}
          </div>
        )}
      </div>

      {/* 4. Footer Status Bar */}
      <div className="outliner-footer">
        <span>
          {characterParts.length} elements ({selectedPartId ? '1 selected' : '0 selected'})
        </span>
      </div>
    </div>
  );
};
