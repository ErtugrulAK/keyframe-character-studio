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
} from 'lucide-react';

export const OutlinerPanel: React.FC = () => {
  const {
    tracks,
    characterParts,
    selectedPartId,
    setSelectedPartId,
    toggleTrackEditVisibility,
    sceneTitle,
  } = useAnimator();

  const [isGroupExpanded, setIsGroupExpanded] = useState(true);

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
              characterParts.map((part) => {
                const track = tracks.find((t) => t.partId === part.id);
                const isSelected = part.id === selectedPartId;
                const isVisible = track?.editVisible !== false;

                return (
                  <div
                    key={part.id}
                    className={`tree-node actor-node ${isSelected ? 'selected' : ''}`}
                    onClick={() => setSelectedPartId(part.id)}
                  >
                    {/* Eye Visibility Column */}
                    <div
                      className="col-eye"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (track) toggleTrackEditVisibility(track.id);
                      }}
                      title={isVisible ? 'Visible on stage' : 'Hidden from stage'}
                    >
                      {isVisible ? (
                        <Eye size={12} className="text-teal" />
                      ) : (
                        <EyeOff size={12} className="text-muted-red" />
                      )}
                    </div>

                    {/* Item Label Column */}
                    <div className="col-label" style={{ paddingLeft: 18 }}>
                      {getActorIcon(part.type)}
                      <span className="actor-name">
                        {part.name
                          ? part.name
                              .split(' ')
                              .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
                              .join(' ')
                          : part.name}
                      </span>
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
