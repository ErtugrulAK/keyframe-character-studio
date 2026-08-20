-- Keyframe Character Studio - Initial Seed Data for PostgreSQL

INSERT INTO motion_presets (id, name, type, duration_frames, keyframes)
VALUES
(
  'preset_pink_slide_down',
  'Pink Slide Down (Top -> Center)',
  'in',
  50,
  '[{"progress": 0, "deltaX": 0, "deltaY": -700, "rotation": 0, "scaleX": 6.42, "scaleY": 6.42, "opacity": 1, "easing": "easeInOut"}, {"progress": 1, "deltaX": 0, "deltaY": 0, "rotation": 0, "scaleX": 6.42, "scaleY": 6.42, "opacity": 1, "easing": "easeInOut"}]'::jsonb
),
(
  'preset_blue_slide_right',
  'Blue Slide Right (Center -> Right)',
  'out',
  50,
  '[{"progress": 0, "deltaX": 0, "deltaY": 0, "rotation": 0, "scaleX": 6.42, "scaleY": 6.42, "opacity": 1, "easing": "easeInOut"}, {"progress": 1, "deltaX": 1400, "deltaY": 0, "rotation": 0, "scaleX": 6.42, "scaleY": 6.42, "opacity": 1, "easing": "easeInOut"}]'::jsonb
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO projects (id, name, fps, total_frames, resolution_w, resolution_h, data)
VALUES (
  'sample_sequencer_project',
  'Unreal 2D Character Sequence',
  60,
  150,
  1920,
  1080,
  '{
    "name": "Unreal 2D Character Sequence",
    "fps": 60,
    "totalFrames": 150,
    "projectResolution": { "width": 1920, "height": 1080 },
    "tracks": [
      {
        "id": "track_part_custom_rect_1784804656612",
        "partId": "part_custom_rect_1784804656612",
        "name": "Pink Entrance Shape (Proxy)",
        "color": "#ec4899",
        "visible": true,
        "locked": false,
        "expanded": false,
        "keyframes": [
          { "id": "kf_1", "frame": 0, "transform": { "x": 0, "y": -700, "rotation": 0, "scaleX": 6.42, "scaleY": 6.42, "opacity": 1 }, "easing": "easeInOut" },
          { "id": "kf_2", "frame": 50, "transform": { "x": 0, "y": 0, "rotation": 0, "scaleX": 6.42, "scaleY": 6.42, "opacity": 1 }, "easing": "easeInOut" }
        ],
        "channels": { "x": [], "y": [], "rotation": [], "scaleX": [], "scaleY": [], "opacity": [] }
      }
    ],
    "characterParts": [
      {
        "id": "part_custom_rect_1784804656612",
        "name": "Pink Entrance Shape (Proxy)",
        "type": "custom_rect",
        "zIndex": 2,
        "fillColor": "#ec4899",
        "strokeColor": "#101218",
        "pivot": { "x": 0.5, "y": 0.5 },
        "parentId": "torso",
        "baseTransform": { "x": 0, "y": -700, "rotation": 0, "scaleX": 6.42, "scaleY": 6.42, "opacity": 1 },
        "visibleEndFrame": 50
      }
    ]
  }'::jsonb
)
ON CONFLICT (id) DO NOTHING;
