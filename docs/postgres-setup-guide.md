# PostgreSQL Database Installation & Setup Guide 🐘

This guide explains how to set up PostgreSQL database for **Keyframe Character Studio**.

---

## 🚀 Option 1: Docker (Fastest - 1 Command)

If you have Docker Desktop installed, run:
```bash
docker run --name postgres-keyframe -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=keyframe_studio_db -p 5432:5432 -d postgres:latest
```
Then run database migrations & seeding:
```bash
npm run db:setup
```

---

## 💻 Option 2: Windows Installer

1. Download PostgreSQL installer for Windows from: [https://www.postgresql.org/download/windows/](https://www.postgresql.org/download/windows/)
2. Run installer, set password to `postgres` (or your preferred password).
3. Open `cmd` or PowerShell in project folder and run:
   ```bash
   npm run db:setup
   ```

---

## ⚡ Option 3: Free Cloud Database (Supabase / ElephantSQL)

1. Create a free account at [Supabase.com](https://supabase.com).
2. Copy your Connection String (`postgres://postgres:password@...:5432/postgres`).
3. Create a `.env` file in project root:
   ```env
   DATABASE_URL=postgres://your_user:your_password@your_host:5432/postgres
   ```
4. Run `npm run db:setup`.

---

## 🏃 Running Backend API Server

Start the REST API server:
```bash
npm run server
```

The Express REST API server will run on `http://localhost:5000` with endpoints:
- `GET http://localhost:5000/api/health`
- `GET http://localhost:5000/api/projects`
- `POST http://localhost:5000/api/projects`
- `GET http://localhost:5000/api/presets`
- `POST http://localhost:5000/api/presets`
