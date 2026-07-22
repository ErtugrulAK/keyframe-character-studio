import React, { useState, useRef } from 'react';
import { useAnimator } from '../../context/AnimatorContext';
import type { BodyPartType } from '../../types/animator';
import {
  PlusCircle,
  Type,
  Tag,
  Pill,
  Gem,
  Sword,
  Shield,
  Crown,
  Star,
  Circle,
  Square,
  Triangle,
  Layout,
  Sparkles,
  Upload,
} from 'lucide-react';
import './LeftToolbar.css';

const QUICK_SHAPES: { type: BodyPartType; label: string; icon: React.ReactNode }[] = [
  { type: 'custom_card', label: 'UI Card', icon: <Layout size={14} className="text-cyan" /> },
  { type: 'custom_text', label: 'Text Label', icon: <Type size={14} className="text-cyan" /> },
  { type: 'custom_banner', label: 'Banner Card', icon: <Tag size={14} className="text-gold" /> },
  { type: 'custom_capsule', label: 'Capsule', icon: <Pill size={14} className="text-purple" /> },
  { type: 'custom_diamond', label: 'Diamond', icon: <Gem size={14} className="text-green" /> },
  { type: 'custom_sword', label: 'Sword', icon: <Sword size={14} className="text-cyan" /> },
  { type: 'custom_shield', label: 'Shield', icon: <Shield size={14} className="text-gold" /> },
  { type: 'custom_crown', label: 'Crown', icon: <Crown size={14} className="text-gold" /> },
  { type: 'custom_star', label: 'Star', icon: <Star size={14} className="text-purple" /> },
  { type: 'custom_circle', label: 'Circle', icon: <Circle size={14} className="text-green" /> },
  { type: 'custom_box', label: 'Box', icon: <Square size={14} className="text-cyan" /> },
  { type: 'custom_triangle', label: 'Triangle', icon: <Triangle size={14} className="text-red" /> },
];

type ActiveNavCategory = 'media' | 'keyframes' | 'texts' | 'shapes' | 'presets';

export const LeftToolbar: React.FC = () => {
  const {
    addKeyframeForSelected,
    selectedPartId,
    addCustomPart,
  } = useAnimator();

  const [activeCategory, setActiveCategory] = useState<ActiveNavCategory>('media');
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFiles = (files: FileList | File[]) => {
    Array.from(files).forEach((file) => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const dataUrl = e.target?.result as string;
          const cleanName = file.name.replace(/\.[^/.]+$/, '');
          addCustomPart('custom_image', cleanName, { imageUrl: dataUrl });
        };
        reader.readAsDataURL(file);
      }
    });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  return (
    <aside className="left-toolbar-container">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        accept="image/*"
        multiple
        style={{ display: 'none' }}
      />

      {/* Keyframes Studio 86px Vertical Icon Sidebar */}
      <div className="left-sidebar-nav">
        <button
          className={`sidebar-nav-item ${activeCategory === 'media' ? 'active' : ''}`}
          onClick={() => setActiveCategory('media')}
          title="Media Library"
        >
          <Layout size={20} className="nav-icon" />
          <span className="nav-label">Media</span>
        </button>

        <button
          className={`sidebar-nav-item ${activeCategory === 'keyframes' ? 'active' : ''}`}
          onClick={() => setActiveCategory('keyframes')}
          title="Keyframe Tools"
        >
          <Gem size={20} className="nav-icon text-gold" />
          <span className="nav-label">Keyframes</span>
        </button>

        <button
          className={`sidebar-nav-item ${activeCategory === 'texts' ? 'active' : ''}`}
          onClick={() => setActiveCategory('texts')}
          title="Text Labels"
        >
          <Type size={20} className="nav-icon text-cyan" />
          <span className="nav-label">Texts</span>
        </button>

        <button
          className={`sidebar-nav-item ${activeCategory === 'shapes' ? 'active' : ''}`}
          onClick={() => setActiveCategory('shapes')}
          title="Shapes & Elements"
        >
          <Square size={20} className="nav-icon text-purple" />
          <span className="nav-label">Elements</span>
        </button>

        <button
          className={`sidebar-nav-item ${activeCategory === 'presets' ? 'active' : ''}`}
          onClick={() => setActiveCategory('presets')}
          title="Presets & Styles"
        >
          <Sparkles size={20} className="nav-icon text-green" />
          <span className="nav-label">Presets</span>
        </button>
      </div>

      {/* Expanding Panel Drawer (280px) */}
      <div className="left-drawer-panel">
        {activeCategory === 'media' && (
          <div className="drawer-content">
            <div className="drawer-header">
              <span className="drawer-title">Media Library</span>
            </div>

            {/* Dropzone Container */}
            <div
              className={`dropzone-box ${isDragOver ? 'drag-over' : ''}`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
            >
              <Upload size={28} className="text-teal mb-2" />
              <span className="dropzone-title">Select media or images</span>
              <span className="dropzone-sub">Click to browse or drag image files here</span>
            </div>

            <div className="drawer-subtitle">QUICK ADD OBJECTS</div>
            <div className="drawer-grid">
              {QUICK_SHAPES.map((item) => (
                <button
                  key={item.type}
                  className="drawer-item-card"
                  onClick={() => addCustomPart(item.type, item.label)}
                >
                  <div className="item-icon-box">{item.icon}</div>
                  <span className="item-label">{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {activeCategory === 'keyframes' && (
          <div className="drawer-content">
            <div className="drawer-header">
              <span className="drawer-title">Keyframe Controls</span>
            </div>
            <p className="drawer-desc">Click below to record a keyframe at the current frame for the selected object.</p>
            
            <button
              className="btn-primary w-full add-kf-drawer-btn"
              onClick={addKeyframeForSelected}
              disabled={!selectedPartId}
            >
              <PlusCircle size={16} />
              <span>Add Keyframe</span>
            </button>
          </div>
        )}

        {activeCategory === 'texts' && (
          <div className="drawer-content">
            <div className="drawer-header">
              <span className="drawer-title">Text Elements</span>
            </div>
            <button
              className="btn-primary w-full text-add-btn"
              onClick={() => addCustomPart('custom_text', 'HEADING TEXT')}
            >
              <Type size={16} />
              <span>Add Heading Text</span>
            </button>
          </div>
        )}

        {activeCategory === 'shapes' && (
          <div className="drawer-content">
            <div className="drawer-header">
              <span className="drawer-title">Vector Elements</span>
            </div>
            <div className="drawer-grid">
              {QUICK_SHAPES.map((item) => (
                <button
                  key={item.type}
                  className="drawer-item-card"
                  onClick={() => addCustomPart(item.type, item.label)}
                >
                  <div className="item-icon-box">{item.icon}</div>
                  <span className="item-label">{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {activeCategory === 'presets' && (
          <div className="drawer-content">
            <div className="drawer-header">
              <span className="drawer-title">Preset Styles</span>
            </div>
            <p className="drawer-desc">Select an object to edit color swatches and shadow styling in the Inspector.</p>
          </div>
        )}
      </div>
    </aside>
  );
};
