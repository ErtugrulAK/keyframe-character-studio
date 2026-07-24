import type { CustomMotionPreset } from '../types/animator';

export const SAMPLE_SEQUENCER_PROJECT = {
  name: "Unreal 2D Character Sequence",
  fps: 60,
  totalFrames: 150,
  projectResolution: { width: 1920, height: 1080 },
  tracks: [
    {
      id: "track_1",
      partId: "part_1",
      name: "Pink Entrance Shape (Proxy)",
      color: "#ec4899",
      visible: true,
      locked: false,
      expanded: false,
      keyframes: [
        { id: "kf_1", frame: 0, transform: { x: 0, y: -700, rotation: 0, scaleX: 6.42, scaleY: 6.42, opacity: 1 }, easing: "easeInOut" },
        { id: "kf_2", frame: 50, transform: { x: 0, y: 0, rotation: 0, scaleX: 6.42, scaleY: 6.42, opacity: 1 }, easing: "easeInOut" }
      ],
      channels: { x: [], y: [], rotation: [], scaleX: [], scaleY: [], opacity: [] }
    },
    {
      id: "track_2",
      partId: "part_2",
      name: "Green Live Hold Shape (Proxy)",
      color: "#b7ec46",
      visible: true,
      locked: false,
      expanded: false,
      keyframes: [],
      channels: { x: [], y: [], rotation: [], scaleX: [], scaleY: [], opacity: [] }
    },
    {
      id: "track_3",
      partId: "part_3",
      name: "Blue Exit Shape (Proxy)",
      color: "#1d4ad3",
      visible: true,
      locked: false,
      expanded: false,
      keyframes: [
        { id: "kf_3", frame: 100, transform: { x: 0, y: 0, rotation: 0, scaleX: 6.42, scaleY: 6.42, opacity: 1 }, easing: "easeInOut" },
        { id: "kf_4", frame: 150, transform: { x: 1400, y: 0, rotation: 0, scaleX: 6.42, scaleY: 6.42, opacity: 1 }, easing: "easeInOut" }
      ],
      channels: { x: [], y: [], rotation: [], scaleX: [], scaleY: [], opacity: [] }
    }
  ],
  characterParts: [
    {
      id: "part_1",
      name: "Pink Entrance Shape (Proxy)",
      type: "custom_rect",
      zIndex: 2,
      fillColor: "#ec4899",
      strokeColor: "#101218",
      pivot: { x: 0.5, y: 0.5 },
      parentId: undefined,
      baseTransform: { x: 0, y: -700, rotation: 0, scaleX: 6.42, scaleY: 6.42, opacity: 1 },
      visibleEndFrame: 50
    },
    {
      id: "part_2",
      name: "Green Live Hold Shape (Proxy)",
      type: "custom_rect",
      zIndex: 2,
      fillColor: "#b7ec46",
      strokeColor: "#101218",
      pivot: { x: 0.5, y: 0.5 },
      parentId: undefined,
      baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 6.42, scaleY: 6.42, opacity: 1 },
      visibleStartFrame: 50,
      visibleEndFrame: 100
    },
    {
      id: "part_3",
      name: "Blue Exit Shape (Proxy)",
      type: "custom_rect",
      zIndex: 2,
      fillColor: "#1d4ad3",
      strokeColor: "#101218",
      pivot: { x: 0.5, y: 0.5 },
      parentId: undefined,
      baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 6.42, scaleY: 6.42, opacity: 1 },
      visibleStartFrame: 100
    }
  ]
};

export const DEFAULT_INITIAL_PRESETS: CustomMotionPreset[] = [
  {
    id: 'preset_1',
    name: 'Pink Slide Down (Top -> Center)',
    type: 'in',
    durationFrames: 50,
    keyframes: [
      { progress: 0, deltaX: 0, deltaY: -700, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, easing: 'easeInOut' },
      { progress: 1, deltaX: 0, deltaY: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, easing: 'easeInOut' },
    ]
  },
  {
    id: 'preset_2',
    name: 'Blue Slide Right (Center -> Right)',
    type: 'out',
    durationFrames: 50,
    keyframes: [
      { progress: 0, deltaX: 0, deltaY: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, easing: 'easeInOut' },
      { progress: 1, deltaX: 1400, deltaY: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, easing: 'easeInOut' },
    ]
  }
];
