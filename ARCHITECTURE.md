# Grindstone — Full Architecture & Project Plan

> Deep analytics and GitHub automation for serious LeetCode grinders.  
> Fully local. No cloud. No subscriptions. One command to run.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Full Feature Set](#2-full-feature-set)
3. [Technology Stack](#3-technology-stack)
4. [System Architecture](#4-system-architecture)
5. [Data Model](#5-data-model)
6. [API Design](#6-api-design)
7. [Project Stages](#7-project-stages--build-plan)
8. [Folder Structure](#8-folder-structure)
9. [Environment Variables](#9-environment-variables)
10. [Docker Setup](#10-docker-setup)
11. [Risks & Mitigations](#11-risks--mitigations)
12. [Future Roadmap](#12-future-roadmap)

---

## 1. Project Overview

Grindstone is a fully local web application that sits as an intelligence layer on top of LeetCode. Users continue solving problems on leetcode.com — Grindstone syncs their submission history via the LeetCode GraphQL API, computes deep analytics, surfaces a personalised spaced repetition review queue, drives a weakness-aware recommendation engine, and auto-commits accepted solutions to a connected GitHub repository.

Everything runs on the user's machine via Docker Compose. No cloud backend. No subscriptions. No data leaves the machine except outbound calls to the LeetCode API and GitHub API.

### 1.1 Core Value Props

- LeetCode tells you what you solved. Grindstone tells you **why you are stuck and what to do next.**
- Every accepted solution is automatically committed to your GitHub repo with a structured folder layout — your grind becomes a visible portfolio artifact.
- Spaced repetition (SM-2) surfaces problems you struggled with before you forget them.
- The recommendation engine adapts to your weakest patterns and gets sharper the more you use it.
- Pattern mastery scores give you a single number per topic that reflects real retention, not just solve count.

### 1.2 What Grindstone Is Not

- Not a coding platform — all solving happens on leetcode.com
- Not a problem viewer — every problem card links directly to LeetCode
- Not a SaaS — there is no server, no account beyond your local machine, no billing

---

## 2. Full Feature Set

### 2.1 Sync Engine

- LeetCode GraphQL submission import via session cookie
- Incremental sync — only fetches submissions since last sync timestamp
- Full historical import on first connect (chunked to handle 1000+ submissions)
- Multi-language support (Python, C++, Java, JavaScript, etc.)
- Sync status indicator with last-synced timestamp in the UI
- Cookie expiry detection with in-app banner alert

### 2.2 Analytics

- **Pattern mastery score (0–100)** per topic tag, computed from:
  - First-attempt acceptance rate
  - Average attempts before solving
  - Time-to-solve relative to LeetCode global average
  - SRS retention rate
  - Recency decay (score degrades if pattern untouched for 2+ weeks)
- **Struggle fingerprinting** — classifies each solve:
  - `slow_correct` — solved but took significantly longer than average
  - `wrong_approach` — multiple wrong answers before acceptance
  - `almost` — TLE or off-by-one errors before acceptance
  - `gave_up` — solution viewed (self-reported)
  - `forgotten` — failed SRS review on a previously solved problem
- Radar chart — mastery score per pattern, updates after every sync
- Time-to-solve trend lines per pattern over 2 / 4 / 8 week windows
- GitHub-style activity heatmap, colour-coded by struggle type (not just activity)
- Progress velocity — mastery score delta per pattern over time ("your DP went from 42 → 67 this month")
- Plateau detection — flags patterns stuck at the same score for 3+ weeks with diagnosis
- Contest readiness score — estimates interview readiness % with gap analysis
- Bottom 3 patterns always surfaced on the dashboard

### 2.3 Spaced Repetition (SRS)

- SM-2 algorithm for scheduling reviews
- Daily review queue surfaced on the dashboard
- Self-report flow after each review: `solved clean` / `struggled` / `peeked at solution`
- Problems auto-enter the queue when:
  - First attempt fails
  - Problem required 3+ attempts
  - SRS retention rate drops below threshold
- Streak freeze tokens — one missed day does not break a streak

### 2.4 Recommendation Engine

Weighted scoring formula per unsolved problem:

```
score = (pattern_weakness  × 0.40)
      + (difficulty_fit    × 0.25)
      + (recency_penalty   × 0.15)
      + (community_quality × 0.10)
      + (company_boost     × 0.10)
```

**Recommendation modes:**

| Mode | Behaviour |
|---|---|
| Daily 3 | One easy, one medium, one hard across weakest patterns |
| Focus Mode | All 3 from single weakest pattern, difficulty adapts |
| Contest Prep | Skewed to mediums/hards in weakest patterns |
| Retention Review | Problems solved 30+ days ago at risk of forgetting |
| Company Prep | Filtered to target company tags, sorted by frequency + weakness |
| Random | Weighted random — still respects weakness scores |

Each recommendation card shows **why it was recommended** — transparent reasoning, not a black box.

Feedback loop — engine re-scores after every solve. Smart sequences — curated 5–10 problem progressions per pattern that skip problems already mastered.

### 2.5 GitHub Auto-Commit

- Connect any GitHub repo via OAuth token (stored encrypted locally)
- On every accepted submission: auto-commits solution file
- Commit message format: `[Medium] Two Sum — 2ms runtime (Array, Hash Map)`
- File path: `solutions/{pattern}/{problem_slug}/solution.py`
- Optional `notes.md` stub committed alongside solution
- Auto-generated `README.md` with progress table and stats badge
- Commit control: accepted only vs all attempts (user preference)
- Commit log page — recent commits with direct GitHub links

### 2.6 Roadmap Overlays

- NeetCode 150 progress tracker
- Blind 75 progress tracker
- Grind 169 overlay
- Company-specific lists (Google, Meta, Amazon, Shopify, etc.)
- Per-roadmap progress bar and filtered problem list

### 2.7 Contest Tracking

- LeetCode contest history and rating graph
- Per-contest breakdown: problems solved, time per problem, rank
- Contest readiness estimate with specific pattern gaps called out

### 2.8 Notifications

- In-app notification centre (no email dependency)
- SRS review reminder badge on dashboard
- Sync status toasts
- Cookie expiry banner with re-auth instructions
- Weekly summary panel (in-app, shown on Sunday login)

---

## 3. Technology Stack

| Layer | Technology | Reason |
|---|---|---|
| Frontend framework | Next.js 14 (App Router) | SSR, RSC, API routes, file-based routing |
| Language (frontend) | TypeScript | Type safety, better DX |
| Styling | Tailwind CSS + shadcn/ui | Fast, consistent, accessible components |
| State management | TanStack Query | Server state, caching, background refetch |
| Charts | Recharts | Lightweight, composable, React-native |
| Backend framework | FastAPI | Async Python, fast to build, OpenAPI auto-docs |
| Background jobs | Celery + Celery Beat | Async task queue + cron scheduling |
| Message broker | Redis | Celery broker and result backend |
| Database | PostgreSQL | Relational, robust, runs great in Docker |
| ORM | SQLAlchemy 2.0 + Alembic | Async ORM + migrations |
| Auth | JWT (PyJWT) + bcrypt | Local auth, no external dependency |
| Secret encryption | Python `cryptography` (Fernet) | Encrypt LeetCode cookie + GitHub token at rest |
| GitHub integration | PyGithub | Auto-commit solutions |
| Containerisation | Docker + Docker Compose | Single command setup |
| CI (dev only) | Pre-commit hooks | ruff, black, eslint, prettier |

### 3.1 Why Fully Local PostgreSQL Instead of Supabase

- No 500MB free tier limit — your submissions can grow indefinitely
- No network latency — every query hits localhost
- No external dependency — works offline, works without an account
- Alembic handles schema migrations cleanly
- Data is yours — stored in a Docker volume on your machine

---

## 4. System Architecture

### 4.1 Container Layout

```
┌─────────────────────────────────────────────────────┐
│                  docker compose up                   │
│                                                      │
│  ┌──────────────┐        ┌──────────────────────┐   │
│  │  frontend    │        │      backend         │   │
│  │  Next.js     │◄──────►│      FastAPI         │   │
│  │  :3000       │        │      :8000           │   │
│  └──────────────┘        └──────────┬───────────┘   │
│                                     │               │
│                          ┌──────────▼───────────┐   │
│                          │  celery worker       │   │
│                          │  celery beat         │   │
│                          └──────────┬───────────┘   │
│                                     │               │
│                     ┌───────────────┼────────────┐  │
│                     │               │            │  │
│              ┌──────▼─────┐  ┌──────▼─────┐     │  │
│              │  postgres  │  │   redis    │     │  │
│              │  :5432     │  │   :6379    │     │  │
│              └────────────┘  └────────────┘     │  │
└─────────────────────────────────────────────────────┘

External calls (outbound only):
  backend ──► LeetCode GraphQL API (leetcode.com/graphql)
  backend ──► GitHub REST API (api.github.com)
```

### 4.2 Request Flow — Page Load

1. User visits `localhost:3000`
2. Next.js RSC fetches data server-side from FastAPI at `localhost:8000`
3. FastAPI validates JWT from httpOnly cookie, queries Postgres, returns JSON
4. Page renders with data — no client-side loading spinner on initial load
5. TanStack Query handles subsequent interactions and background refetches

### 4.3 Request Flow — Sync Trigger

1. User clicks **Sync** in the dashboard
2. Next.js API route calls `POST /api/v1/sync/trigger`
3. FastAPI enqueues a Celery task: `sync_user_submissions(user_id)`
4. Returns immediately with `task_id` — UI shows syncing indicator
5. Celery worker picks up the task:
   - Decrypts LeetCode session cookie from Postgres (Fernet-encrypted column)
   - Hits LeetCode GraphQL API for new submissions since `last_synced_at`
   - Upserts submissions into Postgres
   - Computes attempt numbers and struggle labels
   - Recomputes mastery scores for affected patterns
   - For each accepted submission: triggers GitHub commit via PyGithub
   - Updates `last_synced_at` on the user record
6. Frontend polls `GET /api/v1/sync/status/{task_id}` until complete
7. TanStack Query invalidates dashboard data on completion

### 4.4 Auth Flow

```
POST /api/v1/auth/register  →  hash password (bcrypt), store user, return JWT
POST /api/v1/auth/login     →  verify password, return JWT in httpOnly cookie
All other endpoints         →  FastAPI dependency verifies JWT on every request
```

No OAuth for Grindstone login itself — simple email/password stored locally. GitHub OAuth is only used for the auto-commit integration (user pastes a GitHub personal access token or goes through OAuth — token stored encrypted in Postgres).

### 4.5 LeetCode Session Cookie Security

The LeetCode session cookie is the only sensitive credential in the system.

- Stored encrypted in Postgres using **Fernet symmetric encryption** (`cryptography` library)
- Encryption key stored in `.env` — never in the database
- Decrypted only inside the Celery worker at sync time, held in memory only for the duration of the task
- Never logged, never returned via API
- On 401 response from LeetCode: cookie flagged as expired, in-app banner shown

### 4.6 Celery Beat — Scheduled Jobs

| Job | Schedule | What it does |
|---|---|---|
| `decay_mastery_scores` | Daily 00:00 | Apply recency decay to patterns not practiced in 14+ days |
| `compute_srs_due` | Daily 06:00 | Pre-compute today's SRS queue for fast dashboard load |
| `weekly_summary` | Sunday 08:00 | Generate weekly summary data for in-app panel |
| `detect_plateaus` | Weekly | Flag patterns with no mastery score change in 3 weeks |

---

## 5. Data Model

All tables in local PostgreSQL. Alembic manages migrations.

### 5.1 users

```sql
id                    UUID PRIMARY KEY DEFAULT gen_random_uuid()
email                 TEXT UNIQUE NOT NULL
password_hash         TEXT NOT NULL
leetcode_username     TEXT
lc_session_encrypted  TEXT          -- Fernet encrypted cookie
lc_session_expires_at TIMESTAMPTZ   -- Detected expiry
github_token_encrypted TEXT         -- Fernet encrypted PAT
github_repo           TEXT          -- "owner/repo"
target_companies      TEXT[]        -- ['google', 'shopify']
active_roadmap        TEXT          -- neetcode150 | blind75 | grind169 | none
interview_date        DATE
streak_current        INT DEFAULT 0
streak_longest        INT DEFAULT 0
last_synced_at        TIMESTAMPTZ
created_at            TIMESTAMPTZ DEFAULT NOW()
```

### 5.2 problems

```sql
id                TEXT PRIMARY KEY   -- titleSlug e.g. "two-sum"
frontend_id       INT UNIQUE         -- display number e.g. 1
title             TEXT NOT NULL
difficulty        TEXT               -- easy | medium | hard
topic_tags        TEXT[]             -- ['array', 'hash-table']
company_tags      TEXT[]             -- ['google', 'amazon']
acceptance_rate   FLOAT
is_premium        BOOLEAN DEFAULT FALSE
neetcode150       BOOLEAN DEFAULT FALSE
blind75           BOOLEAN DEFAULT FALSE
grind169          BOOLEAN DEFAULT FALSE
last_fetched_at   TIMESTAMPTZ
```

### 5.3 submissions

```sql
id                BIGINT PRIMARY KEY  -- LeetCode submission ID
user_id           UUID REFERENCES users(id) ON DELETE CASCADE
problem_id        TEXT REFERENCES problems(id)
status            TEXT                -- Accepted | Wrong Answer | TLE | MLE | etc.
language          TEXT                -- python3 | cpp | java | etc.
code              TEXT
runtime_ms        INT
memory_mb         FLOAT
submitted_at      TIMESTAMPTZ
attempt_number    INT                 -- nth attempt on this problem for this user
time_to_solve_s   INT                 -- seconds between attempt 1 and acceptance (nullable)
struggle_label    TEXT                -- slow_correct | wrong_approach | almost | gave_up | forgotten
committed_to_github BOOLEAN DEFAULT FALSE
commit_sha        TEXT                -- GitHub commit SHA if committed

INDEX (user_id, problem_id)
INDEX (user_id, submitted_at DESC)
```

### 5.4 mastery_scores

```sql
id                    UUID PRIMARY KEY DEFAULT gen_random_uuid()
user_id               UUID REFERENCES users(id) ON DELETE CASCADE
pattern               TEXT              -- e.g. "sliding-window"
score                 FLOAT             -- 0–100
first_attempt_rate    FLOAT             -- % solved on first attempt
avg_attempts          FLOAT
avg_time_to_solve_s   INT
srs_retention_rate    FLOAT
problems_attempted    INT
last_practiced_at     TIMESTAMPTZ
score_history         JSONB             -- [{date, score}, ...] for trend lines
updated_at            TIMESTAMPTZ DEFAULT NOW()

UNIQUE (user_id, pattern)
```

### 5.5 srs_queue

```sql
id                UUID PRIMARY KEY DEFAULT gen_random_uuid()
user_id           UUID REFERENCES users(id) ON DELETE CASCADE
problem_id        TEXT REFERENCES problems(id)
due_at            TIMESTAMPTZ
interval_days     INT DEFAULT 1
ease_factor       FLOAT DEFAULT 2.5
repetitions       INT DEFAULT 0
last_reviewed_at  TIMESTAMPTZ
last_result       TEXT              -- clean | struggled | peeked

UNIQUE (user_id, problem_id)
INDEX (user_id, due_at)
```

### 5.6 problem_notes

```sql
id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
user_id     UUID REFERENCES users(id) ON DELETE CASCADE
problem_id  TEXT REFERENCES problems(id)
content     TEXT
updated_at  TIMESTAMPTZ DEFAULT NOW()

UNIQUE (user_id, problem_id)
```

---

## 6. API Design

Base URL: `http://localhost:8000/api/v1`  
All endpoints except `/auth/*` and `/health` require `Authorization: Bearer {jwt}`.

### Auth

| Method | Endpoint | Description |
|---|---|---|
| POST | `/auth/register` | Create account (email + password) |
| POST | `/auth/login` | Login, returns JWT in httpOnly cookie |
| POST | `/auth/logout` | Clear session |
| GET | `/auth/me` | Get current user profile |

### User Settings

| Method | Endpoint | Description |
|---|---|---|
| PATCH | `/users/me` | Update profile (companies, roadmap, interview date) |
| POST | `/users/me/leetcode` | Save encrypted LeetCode session cookie |
| DELETE | `/users/me/leetcode` | Disconnect LeetCode |
| POST | `/users/me/github` | Save encrypted GitHub token + repo |
| DELETE | `/users/me/github` | Disconnect GitHub |

### Sync

| Method | Endpoint | Description |
|---|---|---|
| POST | `/sync/trigger` | Enqueue sync job, returns task_id |
| GET | `/sync/status/{task_id}` | Poll sync job status |
| GET | `/sync/history` | Last 10 sync results |

### Analytics

| Method | Endpoint | Description |
|---|---|---|
| GET | `/analytics/overview` | Dashboard summary (streak, counts, bottom 3 patterns) |
| GET | `/analytics/mastery` | All pattern mastery scores |
| GET | `/analytics/heatmap` | Activity heatmap data |
| GET | `/analytics/velocity` | Mastery score change over time |
| GET | `/analytics/contest` | Contest history and rating graph |
| GET | `/analytics/readiness` | Contest readiness score with gap analysis |
| GET | `/analytics/plateaus` | Patterns flagged as plateaued |

### Submissions

| Method | Endpoint | Description |
|---|---|---|
| GET | `/submissions` | Paginated submission history |
| GET | `/submissions/{id}` | Single submission detail + code |

### SRS

| Method | Endpoint | Description |
|---|---|---|
| GET | `/srs/queue` | Today's due review queue |
| POST | `/srs/review` | Submit review result (clean/struggled/peeked) |
| GET | `/srs/stats` | SRS queue size, retention rate, due count |

### Recommendations

| Method | Endpoint | Description |
|---|---|---|
| GET | `/recommendations` | Get recommended problems (mode param) |
| GET | `/recommendations/sequence/{pattern}` | Get a learning sequence for a pattern |
| POST | `/recommendations/feedback` | Skip or dismiss a recommendation |

### Roadmaps

| Method | Endpoint | Description |
|---|---|---|
| GET | `/roadmap/{name}` | Progress for neetcode150 / blind75 / grind169 |

### Problems

| Method | Endpoint | Description |
|---|---|---|
| GET | `/problems/{id}` | Problem metadata |
| POST | `/problems/{id}/notes` | Save notes |
| GET | `/problems/{id}/notes` | Get notes |

### System

| Method | Endpoint | Description |
|---|---|---|
| GET | `/health` | Health check |

---

## 7. Project Stages & Build Plan

### Stage 0 — Local Dev Environment (Days 1–2)

Get the full stack running before writing any product code.

- [ ] Docker Compose: postgres, redis, backend, frontend containers
- [ ] FastAPI project scaffold: poetry, folder structure, `.env`
- [ ] Next.js 14 project: TypeScript, Tailwind, shadcn/ui init
- [ ] Alembic migration setup with initial empty migration
- [ ] SQLAlchemy async session factory
- [ ] Pre-commit hooks: ruff, black, eslint, prettier
- [ ] Health check endpoint returning stack status

**Deliverable:** `docker compose up` starts all 4 containers with no errors.

---

### Stage 1 — Auth & Onboarding (Days 3–7)

Get a user registered, logged in, and their LeetCode account connected.

- [ ] `users` table migration
- [ ] `POST /auth/register` and `POST /auth/login` with bcrypt + JWT
- [ ] FastAPI JWT dependency — verifies token on every protected route
- [ ] Next.js middleware — redirect unauthenticated users to `/login`
- [ ] Login and register pages
- [ ] Onboarding flow:
  - [ ] Step 1: Connect LeetCode — paste session cookie UI with step-by-step guide
  - [ ] Step 2: Connect GitHub — paste personal access token + repo name
  - [ ] Step 3: Pick roadmap and target companies
- [ ] Fernet encryption helper — encrypt/decrypt cookie and token
- [ ] Settings page — view and update all connections

**Deliverable:** User can register, log in, and connect LeetCode + GitHub.

---

### Stage 2 — Sync Engine (Days 8–16)

The core data pipeline — pull from LeetCode, store locally, keep fresh.

- [ ] `problems` and `submissions` table migrations
- [ ] LeetCode GraphQL client (`services/leetcode.py`):
  - [ ] Fetch submission list (paginated, incremental)
  - [ ] Fetch problem metadata (tags, difficulty, company tags)
  - [ ] Fetch contest history
  - [ ] Full problem catalog seeder (runs once on first connect)
- [ ] Celery setup: worker, beat scheduler, Redis broker
- [ ] `sync_user_submissions` Celery task:
  - [ ] Decrypt cookie, hit LeetCode API
  - [ ] Upsert submissions
  - [ ] Compute `attempt_number` per problem per user
  - [ ] Compute `time_to_solve_s` from timestamp deltas
  - [ ] Classify `struggle_label` (rule-based)
  - [ ] Update `last_synced_at`
- [ ] Sync trigger endpoint + polling endpoint
- [ ] Cookie expiry detection — flag user record, show in-app banner
- [ ] Sync UI: trigger button, progress indicator, last synced timestamp
- [ ] Chunked initial import for users with 1000+ submissions

**Deliverable:** User can sync and see their raw submissions in the database.

---

### Stage 3 — Analytics Engine (Days 17–27)

Compute and serve the analytics that make Grindstone valuable.

- [ ] `mastery_scores` table migration
- [ ] Mastery score computation service (`services/mastery.py`):
  - [ ] Formula implementation
  - [ ] Bulk recompute after sync
  - [ ] Score history appended to JSONB column on each update
- [ ] Celery Beat jobs: `decay_mastery_scores`, `detect_plateaus`
- [ ] Analytics API endpoints: overview, mastery, heatmap, velocity, contest, readiness, plateaus
- [ ] Dashboard page:
  - [ ] Streak counter
  - [ ] Solve counts by difficulty
  - [ ] Bottom 3 patterns callout
  - [ ] Today's SRS count badge
- [ ] Mastery radar chart (Recharts `RadarChart`)
- [ ] Activity heatmap (colour by struggle type)
- [ ] Pattern detail page: score breakdown, submission history per pattern, trend line
- [ ] Velocity page: mastery score over time per pattern
- [ ] Contest history page: rating graph, per-contest breakdown
- [ ] Readiness page: score with gap analysis table

**Deliverable:** Full analytics dashboard populated from real LeetCode data.

---

### Stage 4 — SRS & Recommendations (Days 28–37)

The daily workflow layer.

- [ ] `srs_queue` table migration
- [ ] SM-2 implementation (`services/srs.py`):
  - [ ] `update_srs(problem_id, user_id, result)` — updates interval, ease factor, due date
  - [ ] Auto-enqueue on: first failed attempt, 3+ attempt solve, retention drop
- [ ] Celery Beat job: `compute_srs_due`
- [ ] SRS API: fetch queue, submit review result
- [ ] SRS review UI: problem card, link to LeetCode, self-report buttons (clean / struggled / peeked)
- [ ] Recommendation scoring engine (`services/recommendations.py`):
  - [ ] Weighted formula
  - [ ] Per-mode logic (Daily 3, Focus, Contest Prep, etc.)
  - [ ] Feedback loop — re-score after solve
- [ ] Recommendation API with mode and filter params
- [ ] Problem card component: title, tags, difficulty, why-recommended section
- [ ] Smart sequences: store curated sequences in DB, skip mastered problems
- [ ] Focus Mode page: today's 3 problems + 1 SRS review + estimated time

**Deliverable:** User opens the app each morning and knows exactly what to work on.

---

### Stage 5 — GitHub Auto-Commit (Days 38–43)

Turn the sync pipeline into a portfolio artifact.

- [ ] PyGithub integration (`services/github.py`):
  - [ ] `commit_solution(user, submission)` — create or update file
  - [ ] Structured path: `solutions/{pattern}/{problem_slug}/solution.py`
  - [ ] Commit message formatter
  - [ ] `notes.md` stub alongside solution if notes exist
- [ ] Trigger commit inside sync task on accepted submission
- [ ] README auto-generator — progress table, total count, last updated
- [ ] `committed_to_github` and `commit_sha` updated on submission row
- [ ] Commit log page — recent commits with GitHub links
- [ ] Re-commit failed submissions (retry mechanism)

**Deliverable:** Every accepted submission automatically appears in the user's GitHub repo.

---

### Stage 6 — Roadmaps & Polish (Days 44–51)

Complete the feature set and tighten the UX.

- [ ] Roadmap progress API and pages (NeetCode 150, Blind 75, Grind 169)
- [ ] Company prep mode: company selection, boosted recommendations
- [ ] Problem notes: save and view per-problem notes, commit to GitHub as `notes.md`
- [ ] Settings page: all connections, roadmap, target companies, interview date
- [ ] Weekly summary in-app panel (shown on Sunday)
- [ ] Mobile-responsive layout pass
- [ ] Loading skeletons on all data-heavy pages
- [ ] Error boundaries + toast notifications
- [ ] Rate limiting on sync (max 1 sync per hour)
- [ ] Shareable stats card — export dashboard summary as PNG

**Deliverable:** Feature-complete application with polished UX.

---

### Stage 7 — Hardening & Docs (Days 52–58)

Make it solid and easy to install.

- [ ] `docker-compose.yml` production-ready config
- [ ] `docker-compose.dev.yml` override for hot reload
- [ ] Alembic migration docs and upgrade script
- [ ] Comprehensive `README.md`:
  - [ ] Install instructions (Docker required)
  - [ ] First-time setup (cookie guide with screenshots)
  - [ ] Updating to new versions
  - [ ] FAQ
- [ ] Pytest suite: unit tests for mastery formula, SRS algorithm, struggle classifier
- [ ] Integration tests for sync pipeline (mocked LeetCode responses)
- [ ] Sentry integration (optional, local error tracking)
- [ ] Data backup script: `docker exec postgres pg_dump > backup.sql`

**Deliverable:** Project is installable by anyone with Docker in under 5 minutes.

---

## 8. Folder Structure

```
grindstone/
├── docker-compose.yml
├── docker-compose.dev.yml
├── .env.example
├── README.md
│
├── frontend/
│   ├── Dockerfile
│   ├── package.json
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                  # redirect to /dashboard
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   └── register/page.tsx
│   │   ├── (app)/
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── analytics/
│   │   │   │   ├── mastery/page.tsx
│   │   │   │   ├── heatmap/page.tsx
│   │   │   │   ├── velocity/page.tsx
│   │   │   │   ├── contest/page.tsx
│   │   │   │   └── readiness/page.tsx
│   │   │   ├── srs/page.tsx
│   │   │   ├── recommendations/page.tsx
│   │   │   ├── focus/page.tsx
│   │   │   ├── roadmap/[name]/page.tsx
│   │   │   ├── submissions/page.tsx
│   │   │   ├── commits/page.tsx
│   │   │   └── settings/page.tsx
│   │   └── api/                      # Next.js API routes (thin proxy to FastAPI)
│   ├── components/
│   │   ├── ui/                       # shadcn/ui components
│   │   ├── charts/                   # Recharts wrappers
│   │   ├── problem-card.tsx
│   │   ├── sync-button.tsx
│   │   ├── mastery-radar.tsx
│   │   ├── activity-heatmap.tsx
│   │   └── srs-review-card.tsx
│   └── lib/
│       ├── api.ts                    # Typed API client
│       ├── auth.ts
│       └── types.ts
│
├── backend/
│   ├── Dockerfile
│   ├── pyproject.toml
│   ├── alembic.ini
│   ├── alembic/
│   │   └── versions/
│   └── app/
│       ├── main.py                   # FastAPI app init
│       ├── core/
│       │   ├── config.py             # Settings from .env
│       │   ├── auth.py               # JWT helpers
│       │   ├── encryption.py         # Fernet encrypt/decrypt
│       │   └── database.py           # Async SQLAlchemy session
│       ├── models/                   # SQLAlchemy ORM models
│       │   ├── user.py
│       │   ├── problem.py
│       │   ├── submission.py
│       │   ├── mastery.py
│       │   ├── srs.py
│       │   └── notes.py
│       ├── schemas/                  # Pydantic request/response schemas
│       ├── api/
│       │   └── v1/
│       │       ├── auth.py
│       │       ├── users.py
│       │       ├── sync.py
│       │       ├── analytics.py
│       │       ├── submissions.py
│       │       ├── srs.py
│       │       ├── recommendations.py
│       │       ├── roadmap.py
│       │       └── problems.py
│       ├── services/
│       │   ├── leetcode.py           # LeetCode GraphQL client
│       │   ├── github.py             # PyGithub integration
│       │   ├── mastery.py            # Mastery score computation
│       │   ├── srs.py                # SM-2 algorithm
│       │   ├── recommendations.py    # Scoring engine
│       │   ├── struggle.py           # Struggle label classifier
│       │   └── readme_gen.py         # GitHub README generator
│       └── workers/
│           ├── celery_app.py         # Celery init + beat schedule
│           ├── sync.py               # sync_user_submissions task
│           └── scheduled.py          # decay, srs_due, weekly_summary
│
└── supabase/                         # REMOVED — not needed, all local
    (replaced by alembic/versions/)
```

---

## 9. Environment Variables

Single `.env` file at project root, shared across containers via Docker Compose.

```env
# Database
POSTGRES_USER=grindstone
POSTGRES_PASSWORD=grindstone
POSTGRES_DB=grindstone
DATABASE_URL=postgresql+asyncpg://grindstone:grindstone@postgres:5432/grindstone

# Redis
REDIS_URL=redis://redis:6379/0

# Auth
JWT_SECRET=change_this_to_a_long_random_string
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=10080   # 7 days

# Encryption (generate with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())")
FERNET_KEY=your_generated_fernet_key_here

# App
ENVIRONMENT=development
BACKEND_URL=http://backend:8000
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
```

Copy `.env.example` to `.env` and fill in `JWT_SECRET` and `FERNET_KEY` before first run.

---

## 10. Docker Setup

### docker-compose.yml

```yaml
version: "3.9"

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER}"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5

  backend:
    build: ./backend
    command: uvicorn app.main:app --host 0.0.0.0 --port 8000
    env_file: .env
    ports:
      - "8000:8000"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - ./backend:/app

  celery_worker:
    build: ./backend
    command: celery -A app.workers.celery_app worker --loglevel=info
    env_file: .env
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

  celery_beat:
    build: ./backend
    command: celery -A app.workers.celery_app beat --loglevel=info
    env_file: .env
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

  frontend:
    build: ./frontend
    command: npm run dev
    env_file: .env
    ports:
      - "3000:3000"
    depends_on:
      - backend
    volumes:
      - ./frontend:/app
      - /app/node_modules

volumes:
  postgres_data:
  redis_data:
```

### Getting Started

```bash
# 1. Clone the repo
git clone https://github.com/youruser/grindstone
cd grindstone

# 2. Set up environment
cp .env.example .env
# Edit .env: set JWT_SECRET and FERNET_KEY

# 3. Start everything
docker compose up --build

# 4. Run migrations (first time only)
docker compose exec backend alembic upgrade head

# 5. Open the app
open http://localhost:3000
```

---

## 11. Risks & Mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| LeetCode changes GraphQL schema | Medium | All LC calls isolated in `services/leetcode.py` — one file to patch |
| LeetCode rate limits or blocks | Low | Cap sync at 1/hour, add 200ms delay between paginated requests |
| Session cookie expires | Medium | Detect 401s during sync, flag in DB, show in-app re-auth banner |
| First-time import times out | Low | Chunked import (100 submissions per task), progress shown in UI |
| GitHub token revoked | Low | Detect 401 on commit, flag in DB, show re-connect prompt |
| Docker volume corruption | Very Low | Document `pg_dump` backup script, warn users not to delete volumes |
| Celery worker crashes mid-sync | Low | Celery task retry (max 3, exponential backoff), idempotent upserts |
| Postgres fills disk | Very Low | Submissions are text — 10,000 submissions ≈ ~50MB. Not a real concern |

---

## 12. Future Roadmap (Post-MVP)

- **Browser extension** — auto-sync on LeetCode submit, no manual trigger needed
- **Codeforces integration** — pull CF contest history and problem solves
- **VS Code extension** — timer that auto-starts when you open a LeetCode tab
- **AI hint system** — paste stuck code, get a Socratic nudge via local LLM (Ollama)
- **Offline mode** — full functionality with no internet (cache problem metadata locally)
- **Data export** — export all submissions and notes as JSON or CSV
- **Multi-user mode** — study group support, shared leaderboard
- **Interview countdown** — set a date, watch the readiness score race toward 100%
- **Vim/Neovim plugin** — sync trigger and SRS review queue from inside the editor

---

*Grindstone — Built for the grind, not the stats.*
