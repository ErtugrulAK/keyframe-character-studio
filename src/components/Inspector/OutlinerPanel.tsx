import React, { useState } from 'react';
import { useAnimator } from '../../context/AnimatorContext';
import {
  Eye,
  EyeOff,
  Search,
  Zap,
  Box,
  Type as TypeIcon,
  Image as ImageIcon,
  Video as VideoIcon,
  Globe,
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
    motionTemplates,
    assignTemplateToLayer,
  } = useAnimator();

  const [searchQuery, setSearchQuery] = useState('');
  const [isSceneExpanded, setIsSceneExpanded] = useState(true);

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

  const filteredParts = characterParts.filter((part) =>
    part.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="outliner-container">
      {/* 1. Header Toolbar */}
      <div className="outliner-header">
        <div className="outliner-title-group">
          <Layers size={14} className="text-teal" />
          <span className="outliner-title">Outliner</span>
        </div>
      </div>

      {/* 2. Search & Filter Bar */}
      <div className="outliner-search-box">
        <div className="search-input-wrapper">
          <Search size={12} className="search-glass-icon" />
          <input
            type="text"
            placeholder="Search actors..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* 3. Outliner Table Header */}
      <div className="outliner-table-header">
        <div className="col-eye" title="Visibility">
          <Eye size={12} />
        </div>
        <div className="col-label">Item Label</div>
        <div className="col-sequencer">
          <Zap size={11} className="text-cyan" />
          <span>Sequencer</span>
        </div>
      </div>

      {/* 4. Hierarchical Outliner Tree */}
      <div className="outliner-table-body">
        {/* World / Editor Root Node */}
        <div className="tree-node root-node">
          <div className="node-content">
            <button
              className="tree-toggle-btn"
              onClick={() => setIsSceneExpanded(!isSceneExpanded)}
            >
              {isSceneExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </button>
            <Globe size={13} className="text-muted" />
            <span className="node-title">MotionDesign_Main (Editor)</span>
          </div>
        </div>

        {/* Scene Root Folder Node */}
        {isSceneExpanded && (
          <div className="tree-group-container">
            <div className="tree-node sub-root-node">
              <div className="node-content" style={{ paddingLeft: 18 }}>
                <ChevronDown size={12} className="text-muted" />
                <Layers size={13} className="text-purple" />
                <span className="node-title">Default Scene</span>
              </div>
            </div>

            {/* Actor Rows */}
            {filteredParts.map((part) => {
              const track = tracks.find((t) => t.partId === part.id);
              const isSelected = part.id === selectedPartId;
              const isVisible = track?.editVisible !== false;
              const templateId = track?.sequencerTemplateId || 'Sequence';

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
                  <div className="col-label" style={{ paddingLeft: 32 }}>
                    {getActorIcon(part.type)}
                    <span className="actor-name">{part.name}</span>
                  </div>

                  {/* Sequencer Template Column */}
                  <div
                    className="col-sequencer"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <select
                      className="template-select-pill"
                      value={templateId}
                      onChange={(e) => assignTemplateToLayer(part.id, e.target.value)}
                    >
                      {motionTemplates.map((tmpl) => (
                        <option key={tmpl.id} value={tmpl.id}>
                          {tmpl.id}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 5. Footer Status Bar */}
      <div className="outliner-footer">
        <span>
          {characterParts.length} actors ({selectedPartId ? '1 selected' : '0 selected'})
        </span>
      </div>
    </div>
  );
};
