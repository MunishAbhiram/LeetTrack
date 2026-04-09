# Grindstone — Build Plan: Stage 0 + Stage 1

## Context

Starting from a blank repo (only ARCHITECTURE.md and README.md exist). The goal is to get the full Docker stack running with auth and onboarding complete so a user can register, connect their LeetCode session cookie, connect GitHub, and be ready for the sync engine in Stage 2.

Key decisions made before this plan:
- **Company tags**: Show LeetCode Premium tags if user has premium, else fall back to liquidslr community dataset
- **Submission code**: Lazy fetch — sync stores metadata only; code is fetched on-demand at submission detail view or at GitHub commit time (avoids 1000+ API calls on initial sync)
- **Problem catalog**: Chunked seeder, not all-at-once; seed incrementally as user syncs

---

## Critical Files to Create

```
grindstone/
├── docker-compose.yml
├── docker-compose.dev.yml
├── .env.example
├── backend/
│   ├── Dockerfile
│   ├── pyproject.toml
│   ├── alembic.ini
│   ├── alembic/versions/
│   └── app/
│       ├── main.py
│       ├── core/config.py
│       ├── core/auth.py
│       ├── core/encryption.py
│       ├── core/database.py
│       ├── models/user.py
│       ├── schemas/auth.py
│       ├── schemas/user.py
│       └── api/v1/auth.py
│       └── api/v1/users.py
│       └── workers/celery_app.py
└── frontend/
    ├── Dockerfile
    ├── package.json
    ├── tailwind.config.ts
    ├── tsconfig.json
    ├── middleware.ts
    └── app/
        ├── layout.tsx
        ├── page.tsx
        ├── (auth)/login/page.tsx
        ├── (auth)/register/page.tsx
        └── (app)/
            ├── onboarding/page.tsx
            └── settings/page.tsx
    └── lib/
        ├── api.ts
        ├── auth.ts
        └── types.ts
```

---

## Action Plan

### Action 1 — Docker Compose scaffold
**Files**: `docker-compose.yml`, `docker-compose.dev.yml`, `.env.example`

Create the full Docker Compose config from ARCHITECTURE.md §10 verbatim. Services: `postgres` (16-alpine), `redis` (7-alpine), `backend` (FastAPI on :8000), `celery_worker`, `celery_beat`, `frontend` (Next.js on :3000). Health checks on postgres and redis. `docker-compose.dev.yml` overrides `command` for hot-reload (`uvicorn --reload` for backend, `npm run dev` already covered). `.env.example` with all keys from §9 but values blanked out.

---

### Action 2 — Backend scaffold (FastAPI + Poetry)
**Files**: `backend/Dockerfile`, `backend/pyproject.toml`, `backend/app/main.py`

- Dockerfile: python:3.12-slim, install poetry, copy pyproject, `poetry install --no-root`, copy app, expose 8000
- pyproject.toml dependencies: `fastapi`, `uvicorn[standard]`, `sqlalchemy[asyncio]`, `asyncpg`, `alembic`, `pyjwt`, `bcrypt`, `cryptography`, `celery[redis]`, `redis`, `PyGithub`, `httpx`, `pydantic-settings`
- `main.py`: FastAPI app init, include routers, CORS middleware (allow localhost:3000), lifespan for DB startup

---

### Action 3 — Backend core: config, database, auth helpers, encryption
**Files**: `backend/app/core/config.py`, `backend/app/core/database.py`, `backend/app/core/auth.py`, `backend/app/core/encryption.py`

- `config.py`: `pydantic-settings` BaseSettings reading all vars from .env (DATABASE_URL, REDIS_URL, JWT_SECRET, JWT_ALGORITHM, JWT_EXPIRE_MINUTES, FERNET_KEY, ENVIRONMENT)
- `database.py`: `create_async_engine`, `async_sessionmaker`, `get_db` dependency yielding AsyncSession, `Base` declarative base
- `auth.py`: `create_access_token(user_id)`, `verify_token(token) -> UUID`, FastAPI `Depends` `get_current_user` that reads JWT from `Authorization: Bearer` header
- `encryption.py`: `encrypt(plaintext: str) -> str` and `decrypt(ciphertext: str) -> str` using `cryptography.fernet.Fernet` keyed from `settings.FERNET_KEY`

---

### Action 4 — Alembic setup + users table migration
**Files**: `backend/alembic.ini`, `backend/alembic/env.py`, `backend/alembic/versions/001_create_users.py`, `backend/app/models/user.py`

- `models/user.py`: SQLAlchemy ORM `User` model matching the schema in ARCHITECTURE.md §5.1 exactly (all columns, types, defaults)
- `alembic/env.py`: async-compatible setup using `run_async_migrations`, target_metadata = Base.metadata
- Migration `001_create_users.py`: create `users` table, all columns, no indexes needed yet

---

### Action 5 — Auth API endpoints
**Files**: `backend/app/schemas/auth.py`, `backend/app/api/v1/auth.py`

- `schemas/auth.py`: Pydantic models — `RegisterRequest(email, password)`, `LoginRequest(email, password)`, `TokenResponse(access_token, token_type)`, `UserOut(id, email, leetcode_username, github_repo, active_roadmap, last_synced_at)`
- `api/v1/auth.py`: 
  - `POST /register`: hash password with `bcrypt`, insert user, return JWT
  - `POST /login`: verify bcrypt, return JWT in httpOnly cookie + JSON body
  - `POST /logout`: clear httpOnly cookie
  - `GET /me`: protected, return `UserOut` for current user

---

### Action 6 — User settings API endpoints
**Files**: `backend/app/api/v1/users.py`, `backend/app/schemas/user.py`

- `schemas/user.py`: `UpdateProfileRequest` (target_companies, active_roadmap, interview_date), `ConnectLeetCodeRequest(session_cookie)`, `ConnectGitHubRequest(token, repo)`
- `api/v1/users.py`:
  - `PATCH /users/me`: update profile fields
  - `POST /users/me/leetcode`: encrypt session cookie with Fernet, store in `lc_session_encrypted`
  - `DELETE /users/me/leetcode`: null out `lc_session_encrypted`
  - `POST /users/me/github`: encrypt PAT, store in `github_token_encrypted` + `github_repo`
  - `DELETE /users/me/github`: null out both fields

---

### Action 7 — Health check endpoint + Celery scaffold
**Files**: `backend/app/api/v1/health.py`, `backend/app/workers/celery_app.py`

- `health.py`: `GET /health` — queries DB (SELECT 1), pings Redis, returns `{status, db, redis, timestamp}`
- `celery_app.py`: Celery init with Redis broker + result backend from settings. Beat schedule defined here (stubs for now — `decay_mastery_scores`, `compute_srs_due`, `weekly_summary`, `detect_plateaus` pointing to placeholder tasks). Workers will be populated in Stage 2+.

---

### Action 8 — Frontend scaffold (Next.js 14 + Tailwind + shadcn)
**Files**: `frontend/Dockerfile`, `frontend/package.json`, `frontend/tailwind.config.ts`, `frontend/tsconfig.json`, `frontend/next.config.ts`

- Dockerfile: node:20-alpine, `npm ci`, expose 3000
- `package.json`: deps — `next@14`, `react`, `react-dom`, `typescript`, `tailwindcss`, `@tanstack/react-query`, `recharts`, `axios`, `js-cookie`; devDeps — `@types/react`, `@types/node`, `eslint`, `prettier`
- shadcn/ui: configured via `components.json` (style: default, baseColor: slate, cssVariables: true)
- `next.config.ts`: rewrites `/api/v1/*` → `http://backend:8000/api/v1/*` (server-side) and `http://localhost:8000/api/v1/*` (client-side)

---

### Action 9 — Frontend auth: middleware, API client, login/register pages
**Files**: `frontend/middleware.ts`, `frontend/lib/api.ts`, `frontend/lib/auth.ts`, `frontend/lib/types.ts`, `frontend/app/(auth)/login/page.tsx`, `frontend/app/(auth)/register/page.tsx`

- `middleware.ts`: if no JWT cookie and path not in `[/login, /register]`, redirect to `/login`
- `lib/api.ts`: typed axios instance, attaches JWT from cookie, 401 interceptor redirects to `/login`
- `lib/types.ts`: TypeScript interfaces mirroring backend schemas (`User`, `Submission`, `MasteryScore`, `SRSItem`, `Recommendation`, etc.)
- Login page: email + password form, calls `POST /auth/login`, stores JWT cookie, redirects to `/dashboard`
- Register page: same but calls `POST /auth/register`
- Both use shadcn `Card`, `Input`, `Button` components

---

### Action 10 — Frontend onboarding flow (3-step wizard)
**Files**: `frontend/app/(app)/onboarding/page.tsx`, `frontend/components/onboarding/`

**Step 1 — Connect LeetCode**: Input for session cookie + step-by-step guide ("Open leetcode.com → DevTools → Application → Cookies → copy `LEETCODE_SESSION`"). On submit: `POST /users/me/leetcode`

**Step 2 — Connect GitHub**: Input for Personal Access Token + `owner/repo`. On submit: `POST /users/me/github`

**Step 3 — Preferences**: Multi-select target companies, radio for roadmap, optional interview date picker. On submit: `PATCH /users/me`

Each step has a Skip button. On completion → redirect to `/dashboard`.

---

### Action 11 — Settings page
**Files**: `frontend/app/(app)/settings/page.tsx`

Shows connection status for LeetCode (connected/expired/disconnected) and GitHub (connected/disconnected + repo name). Buttons to reconnect or disconnect. Form to update roadmap, companies, interview date.

---

### Action 12 — Layout, root page, nav shell
**Files**: `frontend/app/layout.tsx`, `frontend/app/page.tsx`, `frontend/app/(app)/layout.tsx`, `frontend/components/nav.tsx`

- Root layout: TanStack Query provider, font setup
- `page.tsx`: redirects to `/dashboard` (or `/login` if unauthenticated)
- App layout: sidebar nav (Dashboard, SRS, Recommendations, Analytics, Roadmap, Submissions, Commits, Settings), Sync button in header, user avatar top-right
- Nav collapses to shadcn `Sheet` on mobile

---

## Verification

```bash
docker compose up --build
docker compose exec backend alembic upgrade head
curl http://localhost:8000/health
# → {"status":"ok","db":true,"redis":true}

curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"password123"}'
# → {"access_token":"...","token_type":"bearer"}

# Frontend
open http://localhost:3000
# → redirects to /login → register → onboarding → /dashboard shell
```

---

## What Comes Next

See `plans/stage-2-plus.md` for Stage 2 (Sync Engine) through Stage 7 (Hardening).
