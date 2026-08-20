# REST API Reference Specification

This document details the REST API endpoints implemented in the Express backend (`server/index.js`).

Default API Server URL: `http://localhost:5000`

---

## Headers & Content Types

- **Content-Type**: `application/json`
- **CORS**: Enabled for cross-origin requests.
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
