# 🎬 Keyframe Character Studio & Live Broadcast Sequencer Pro

[![React 19](https://img.shields.io/badge/React-19.2-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript 6](https://img.shields.io/badge/TypeScript-6.0-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite 8](https://img.shields.io/badge/Vite-8.1-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Express.js](https://img.shields.io/badge/Express-5.2-000000?logo=express&logoColor=white)](https://expressjs.com/)

An advanced **2D Vector Animation Studio, Timeline Sequencer, & Real-Time Broadcast Motion Graphics Director** built with **React 19**, **TypeScript**, **Vite**, **Express**, and **PostgreSQL**.

---

## ✨ Highlights & Key Features

### 1. 🎭 Dynamic Geometric Video & Image Shape Masking
Clip any `.mp4` video or `.png/.jpg` image cleanly into 6 custom geometric vector frames with independent animation toggles:
- 🟡 **Circle (Daire)** - Seamless circular video frame
- 💊 **Pill / Capsule** - Rounded capsule geometry
- ⭐ **Star (Yıldız)** - 5-pointed star frame
- 🔷 **Hexagon (Altıgen)** - 6-sided polygon frame
- 💖 **Heart (Kalp)** - Heart-shaped video mask
- 🟩 **Default Rect/Box** - Clean rectangular frame

### 2. 📡 Real-Time Live Director Panel (Reji Mode)
Control live stream graphics in real-time with zero latency for broadcast platforms (OBS Studio, vMix, etc.):
- **PLAY IN / PLAY OUT**: Trigger entrance & exit motion transitions live on air per graphic layer or globally.
- **Eye Mute Sync**: Layers muted on timeline are automatically hidden from broadcast.

### 3. ⚡ Realtime Live Stunts & Custom Keyframe Loops
Trigger instant mid-broadcast motion stunts without interrupting live streams:
- 🏀 **BOUNCE**: Parabolic ball bounce with squash & stretch
- 💥 **PULSE**: Heartbeat scale pulse
- 👋 **WOBBLE**: Jiggle/shake rotation wobble
- 🌀 **SPIN 360**: 360-degree rotation spin
- 🔥 **SHAKE**: High-frequency earthquake sarsıntı efekti
- 🎈 **FLOAT**: Floating wave displacement
- 🔁 **`[✓] LOOP` Custom Keyframe Trajectories**: Save any timeline keyframe sequence (e.g. 5s loop) and trigger it live as an infinite looping stunt!

### 4. 🗄️ Dual PostgreSQL & Embedded Local SQL Database
- **PostgreSQL Database (`schema.sql` & `seed.sql`)**: Production-ready relational schema for projects, custom presets, and media assets.
- **Zero-Config Local Embedded SQL (`keyframe_studio.sqlite`)**: Automatic zero-setup fallback database so the app runs instantly out of the box without external software installation.
- **Express REST API Server**: Uç noktalar (`GET/POST /api/projects`, `GET/POST /api/presets`, `GET /api/health`).

### 5. 📦 Modularized High-Performance Architecture
- **SVG Vector Rendering Engine**: Crisp vector rendering with matrix math (`translate`, `rotate`, `scale`).
- **Modular Renderers**:
  - `MediaPartRenderer.tsx`: Video/Image cropping, overlay captions, and geometric clipPaths.
  - `ShapePartRenderers.tsx`: 2D graphic shapes with inner media support.
  - `TextAndClonerRenderers.tsx`: Staggered text animations and MoGraph cloner grids.
  - `BodyPartRenderers.tsx`: Stickman character body parts.

---

## 🛠️ Technology Stack

| Layer | Technologies Used |
| :--- | :--- |
| **Frontend UI** | React 19, TypeScript, Vite 8, Lucide React, Vanilla CSS3 (Glassmorphism) |
| **Animation Engine**| SVG Vector Engine, Trigonometric Matrix Transforms, Bezier Interpolation |
| **Backend REST API**| Node.js, Express 5, CORS, Dotenv |
| **Database Layer** | PostgreSQL (Production) + Embedded SQLite (Zero-Config Local Fallback) |
| **Build & Tooling** | Vite, TypeScript Compiler (`tsc -b`), Oxlint |

---

## 🚀 Quick Start & Installation

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

### 3. Start Express Backend API Server
```bash
npm run server
```
Backend REST API will run live at [http://localhost:5000](http://localhost:5000).

### 4. Setup PostgreSQL Database (Optional)
If using PostgreSQL on `localhost:5432`:
```bash
npm run db:setup
```
*(For detailed PostgreSQL installation, Docker, or Supabase setup, see [docs/postgres-setup-guide.md](docs/postgres-setup-guide.md))*

---

## 📜 NPM Scripts Reference

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts Vite frontend dev server on port `5173` |
| `npm run server` | Starts Express REST API backend on port `5000` |
| `npm run db:setup` | Runs PostgreSQL database setup and seeds initial data |
| `npm run build` | Builds production bundle with `tsc` and `vite build` |
| `npm run lint` | Runs `oxlint` code health check |

---

## 📄 License
Licensed under the [MIT License](LICENSE).
