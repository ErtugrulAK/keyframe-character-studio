# REST API Reference Specification

This document details the REST API endpoints implemented in the Express backend (`server/index.js`).

Default API Server URL: `http://localhost:5000`

---

## Binding and exposure

- **Default bind**: `127.0.0.1` (this machine only). The API is a local backend for the editor, and
  the editor itself persists through browser local storage — it does not call this API.
- **Opt-in**: set `KCS_API_HOST` to bind a wider interface (for example `0.0.0.0`, or a specific
  address). The server prints a warning naming what it published and how to undo it.
- **Authentication**: none. There is no authentication or authorization anywhere in `server/`, so
  any client that can reach the port can read, overwrite and delete the stored projects. Do not put
  this API on a network without adding authentication first.
- **CORS is not authorization**: cross-origin requests are enabled (`cors()` with no allowlist), and
  CORS is enforced by browsers, not by the server. It does not stop a non-browser client, and it does
  not stop a page on this machine from reaching a local API. Treat it as a convenience for browser
  clients, never as access control.

---

## Headers & Content Types

- **Content-Type**: `application/json`
- **CORS**: Enabled for cross-origin requests (see "Binding and exposure" — this is not access control).
- **Payload Limit**: `50mb`

---

## 1. System Health

### `GET /api/health`

Returns the operational status of the REST API backend and active database connection type (PostgreSQL vs embedded SQLite).

#### Response (`200 OK`)
```json
{
  "status": "online",
  "service": "Keyframe Studio API",
  "database": "SQLite (Embedded Local DB)",
  "pgDetails": {
    "connected": false,
    "error": "PostgreSQL connection refused"
  }
}
```

---

## 2. Projects Endpoint

### `GET /api/projects`

Fetches a list of all saved animation projects ordered by `updated_at` descending.

#### Response (`200 OK`)
```json
{
  "success": true,
  "source": "sqlite",
  "projects": [
    {
      "id": "proj_1700000000000",
      "name": "Unreal 2D Character Sequence",
      "fps": 60,
      "total_frames": 150,
      "resolution_w": 1920,
      "resolution_h": 1080,
      "created_at": "2026-08-02 14:00:00",
      "updated_at": "2026-08-02 15:30:00"
    }
  ]
}
```

---

### `GET /api/projects/:id`

Fetches the complete animation project payload by its unique project ID.

#### Parameters
- `id` (path parameter, string): The project ID.

#### Response (`200 OK`)
```json
{
  "success": true,
  "source": "postgresql",
  "project": {
    "id": "proj_1700000000000",
    "name": "Unreal 2D Character Sequence",
    "fps": 60,
    "totalFrames": 150,
    "projectResolution": {
      "width": 1920,
      "height": 1080
    },
    "characterParts": [],
    "tracks": [],
    "motionTemplates": []
  }
}
```

#### Error Response (`404 Not Found`)
```json
{
  "success": false,
  "error": "Project not found"
}
```

---

### `POST /api/projects`

Saves or updates an animation project. Upserts data based on `id`.

#### Request Body
```json
{
  "id": "proj_1700000000000",
  "name": "Unreal 2D Character Sequence",
  "fps": 60,
  "totalFrames": 150,
  "projectResolution": {
    "width": 1920,
    "height": 1080
  },
  "characterParts": [],
  "tracks": [],
  "motionTemplates": []
}
```

#### Response (`200 OK`)
```json
{
  "success": true,
  "source": "sqlite",
  "id": "proj_1700000000000"
}
```

---

### `DELETE /api/projects/:id`

Deletes a project by its unique ID.

#### Parameters
- `id` (path parameter, string): The project ID to delete.

#### Response (`200 OK`)
```json
{
  "success": true,
  "source": "postgresql"
}
```

---

## 3. Motion Presets Endpoint

### `GET /api/presets`

Fetches custom motion presets ordered by `created_at` descending.

#### Response (`200 OK`)
```json
{
  "success": true,
  "source": "sqlite",
  "presets": [
    {
      "id": "preset_custom_1700000000000",
      "name": "Custom Bounce Stunt",
      "type": "stunt",
      "duration_frames": 50,
      "keyframes": []
    }
  ]
}
```

---

### `POST /api/presets`

Creates or updates a custom motion preset.

#### Request Body
```json
{
  "id": "preset_custom_1700000000000",
  "name": "Custom Bounce Stunt",
  "type": "stunt",
  "durationFrames": 50,
  "keyframes": []
}
```

#### Response (`200 OK`)
```json
{
  "success": true,
  "source": "sqlite",
  "preset": {
    "id": "preset_custom_1700000000000",
    "name": "Custom Bounce Stunt",
    "type": "stunt",
    "durationFrames": 50,
    "keyframes": []
  }
}
```
