# 🎬 Keyframe Character Studio & Live Broadcast Motion Graphics Sequencer Pro

[![React 19](https://img.shields.io/badge/React-19.2-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript 6](https://img.shields.io/badge/TypeScript-6.0-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite 8](https://img.shields.io/badge/Vite-8.1-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Express.js](https://img.shields.io/badge/Express-5.2-000000?logo=express&logoColor=white)](https://expressjs.com/)

An advanced **2D Vector Animation Studio, Motion Graphics Sequencer, & Real-Time Broadcast Motion Graphics Director** built with **React 19**, **TypeScript**, **Vite**, **Express**, and **PostgreSQL**.

---

## ✨ Key Features & Capabilities

### 1. 🎬 Unreal Engine Style Motion Design Sequencer
- **Multi-Track Hierarchy**: Layer ordering, track lock, eye visibility, and z-index grouping.
- **Precision Keyframing**: Interpolate position (X, Y), scale (ScaleX, ScaleY), rotation, and opacity at 60 FPS.
- **Interactive Cubic Bezier Easing**: Fine-tune animation curves with velocity control, preset curves, and real-time preview canvas.
- **Unified Timeline & Sequence Management**: Seamless sequence creation with double-click inline renaming and deletion protection.

### 2. 📐 Single-Edge Directional Vector Transform Gizmo
- **8-Handle Transform Controls**: Corner square handles for uniform proportional scaling + 4 midpoint circle handles for directional edge stretching.
- **Directional Single-Edge Resizing**: Dragging top, bottom, left, or right handles expands the element strictly along that direction while keeping the opposite edge stationary in world coordinates (evaluated via 2D trigonometric matrix math).
- **Interactive Rotation**: Top bar knob for intuitive 360° rotation.

### 3. 🖼️ Dynamic Geometric Media Masking & Vector Shapes
- Clip `.mp4` video or `.png/.jpg` image layers into 6 geometric vector frames:
  - 🟡 **Circle** - Clean circular frame
  - 💊 **Pill / Capsule** - Rounded capsule geometry
  - ⭐ **Star** - 5-pointed star frame
  - 🔷 **Hexagon** - 6-sided polygon frame
  - 💖 **Heart** - Heart-shaped clip mask
  - 🟩 **Rectangle / Box** - Standard rect frame with adjustable corner radius
- **Media Crop & Overlay Captions**: Interactive crop positioning and custom text caption overlays.

### 4. 🎨 Unified Graphic Template & Sequence Management
- **Dual Tab Architecture**: Unified top Header bar (Graphic Templates) and bottom Timeline (Sequence Tabs) sharing identical styling, heights, hover states, and close icons.
- **Inline Tab Renaming**: Double-click any template or sequence tab to edit its title directly in-place.
- **Clean Defaults**: Clean modal workflow defaulting to `New Template` and `New Sequence`.

### 5. 📡 Real-Time Live Director Panel (Reji Mode)
- **Live Broadcast Controls**: Zero-latency triggers for broadcast streaming platforms (OBS Studio, vMix, NDI, etc.).
- **PLAY IN / PLAY OUT**: Trigger entrance & exit motion transitions live on air per graphic layer or globally.
- **Eye Mute Sync**: Layers hidden or muted on timeline automatically sync state with broadcast output.
- **Live Motion Stunts & Custom Loops**: Trigger mid-broadcast stunts (Bounce, Pulse, Wobble, Spin 360, High-frequency Shake, Float, and custom infinite keyframe loops).

### 6. 🗄️ Dual Database Architecture & REST API Server
- **PostgreSQL Database (`schema.sql` & `seed.sql`)**: Production-ready relational schema for project templates, presets, and asset management.
- **Zero-Config Local Embedded SQL (`keyframe_studio.sqlite`)**: Automatic zero-setup fallback database enabling instant local app execution without external software requirements.
- **Express REST API Backend**: Endpoints (`GET/POST /api/projects`, `GET/POST /api/presets`, `GET /api/health`).

---

## 🛠️ Technology Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend UI** | React 19, TypeScript 6, Vite 8, Lucide React, CSS3 Glassmorphism |
| **Animation Engine**| SVG Vector Engine, Trigonometric Matrix Transforms, Cubic Bezier Velocity Interpolation |
| **Backend REST API**| Node.js, Express 5, CORS, Dotenv |
| **Database Layer** | PostgreSQL (Production) + Embedded SQLite (Local Fallback) |
| **Build & Quality** | Vite Compiler, TypeScript (`tsc -b`), Oxlint |

---

## 🚀 Quick Start

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/ErtugrulAK/keyframe-character-studio.git
cd keyframe-character-studio
npm install
```

### 2. Start Frontend Dev Server
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### 3. Start Backend REST API
```bash
npm run server
```
Backend API will listen at [http://localhost:5000](http://localhost:5000).

### 4. Setup PostgreSQL (Optional)
```bash
npm run db:setup
```
*(For detailed PostgreSQL installation or Docker setup, see [docs/postgres-setup-guide.md](docs/postgres-setup-guide.md))*

---

## 📜 NPM Scripts Reference

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts Vite frontend dev server on port `5173` |
| `npm run server` | Starts Express REST API backend on port `5000` |
| `npm run db:setup` | Runs PostgreSQL database setup and seeds initial data |
| `npm run build` | Compiles production bundle with `tsc` and `vite build` |
| `npm run lint` | Runs `oxlint` code quality check |

---

## 📄 License
Licensed under the [MIT License](LICENSE).
