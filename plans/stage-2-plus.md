# Grindstone — Build Plan: Stage 2 through Stage 7

## Context

This plan picks up after Stage 0 + Stage 1 are complete (see `plans/stage-0-1.md`).

**What already exists when this plan starts:**
- Full Docker Compose stack running: `postgres`, `redis`, `backend` (FastAPI :8000), `celery_worker`, `celery_beat`, `frontend` (Next.js :3000)
- `users` table + Alembic migration applied
- Auth endpoints: `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`
- User settings endpoints: `PATCH /users/me`, `POST/DELETE /users/me/leetcode`, `POST/DELETE /users/me/github`
- Fernet encryption helper at `backend/app/core/encryption.py`
- JWT auth dependency at `backend/app/core/auth.py`
- Celery app scaffold at `backend/app/workers/celery_app.py` (beat schedule stubs only)
- Frontend: login/register, onboarding wizard, settings page, nav shell

**Key architectural decisions already locked in:**
- **Submission code**: lazy fetch — sync stores metadata only; code fetched on-demand at detail view or GitHub commit time
- **Company tags**: LeetCode Premium API if user has premium, else liquidslr community JSON (bundled in backend as a static asset)
- **Problem catalog**: seeded incrementally per-problem during sync, not all 3000 upfront

**Stack**: FastAPI + SQLAlchemy 2.0 async + Alembic + Celery + Redis + PostgreSQL + Next.js 14 App Router + TanStack Query + Recharts + shadcn/ui

---

## Stage 2 — Sync Engine

### Action 1 — problems + submissions table migrations
**Files**: `backend/app/models/problem.py`, `backend/app/models/submission.py`, `backend/alembic/versions/002_create_problems_submissions.py`

- `models/problem.py`: SQLAlchemy `Problem` model from ARCHITECTURE.md §5.2
  - `id TEXT PK` (titleSlug), `frontend_id INT UNIQUE`, `title`, `difficulty`, `topic_tags TEXT[]`, `company_tags TEXT[]`, `acceptance_rate FLOAT`, `is_premium BOOL`, `neetcode150 BOOL`, `blind75 BOOL`, `grind169 BOOL`, `last_fetched_at`
- `models/submission.py`: SQLAlchemy `Submission` model from ARCHITECTURE.md §5.3
  - `id BIGINT PK` (LeetCode submission ID), `user_id FK`, `problem_id FK`, `status`, `language`, `code TEXT` (nullable — lazy fetched), `runtime_ms`, `memory_mb`, `submitted_at`, `attempt_number`, `time_to_solve_s`, `struggle_label`, `committed_to_github BOOL`, `commit_sha TEXT`
  - Indexes: `(user_id, problem_id)`, `(user_id, submitted_at DESC)`
- Migration `002`: create both tables with all indexes

---

### Action 2 — LeetCode GraphQL client
**Files**: `backend/app/services/leetcode.py`

Single service class `LeetCodeClient(session_cookie: str)` wrapping `httpx.AsyncClient`. All calls hit `https://leetcode.com/graphql`.

Methods:
- `get_submission_list(offset, limit) -> list[SubmissionRaw]`: paginated submission list (no code, just metadata)
- `get_submission_detail(submission_id) -> str`: returns code for a single submission ID
- `get_problem_metadata(slug) -> ProblemRaw`: fetches tags, difficulty, company tags (premium), acceptance rate
- `get_contest_history() -> list[ContestRaw]`
- `check_premium() -> bool`: detect premium by fetching a premium-only field
- `detect_cookie_expiry(response) -> bool`: check for 401 / redirect to login

Rate limiting: 200ms delay between paginated requests (use `asyncio.sleep(0.2)`).
Error handling: raise `LeetCodeAuthError` on 401/redirect, `LeetCodeRateLimitError` on 429.

---

### Action 3 — Struggle label classifier
**Files**: `backend/app/services/struggle.py`

Pure function `classify_struggle(submissions_for_problem: list[Submission]) -> str` applied after grouping submissions by problem.

Rules (applied in order):
- `gave_up` — self-reported (flagged separately via UI, not auto-classified)
- `forgotten` — previously solved, then failed an SRS review (set by SRS service)
- `wrong_approach` — 2+ Wrong Answer submissions before Accepted
- `almost` — TLE or MLE or off-by-one before Accepted (detect via status strings)
- `slow_correct` — accepted but `time_to_solve_s` > 2× the median for that problem's difficulty
- `None` — solved cleanly on first attempt within normal time

---

### Action 4 — sync_user_submissions Celery task
**Files**: `backend/app/workers/sync.py`

`@celery_app.task(bind=True, max_retries=3)` task `sync_user_submissions(self, user_id: str)`:

1. Load user from DB, decrypt `lc_session_encrypted` via Fernet
2. Determine `since` timestamp: `user.last_synced_at` or epoch for first sync
3. Paginate `LeetCodeClient.get_submission_list()` in chunks of 100 until `submitted_at < since`
4. For each submission:
   - Upsert into `submissions` (no code yet)
   - Fetch `problem_metadata` if problem not already in DB (with 200ms delay)
   - Seed problem into `problems` table
   - If problem is new: check if it appears in neetcode150/blind75/grind169 lists (bundled JSON)
5. Post-upsert: compute `attempt_number` (rank by `submitted_at` per `(user_id, problem_id)`)
6. Compute `time_to_solve_s` (delta between first attempt and first Accepted per problem)
7. Classify `struggle_label` for each problem using `struggle.classify_struggle()`
8. Detect cookie expiry: if `LeetCodeAuthError` raised, set `user.lc_session_expires_at = now()`, save, raise without retry
9. Update `user.last_synced_at = now()`
10. Return `{"synced": N, "new_problems": M}`

Retry: exponential backoff (60s, 120s, 240s) on transient errors.

---

### Action 5 — Sync API endpoints + company tags seeding
**Files**: `backend/app/api/v1/sync.py`, `backend/app/services/company_tags.py`, `backend/data/company_tags.json`

- `POST /sync/trigger`: enqueue `sync_user_submissions.delay(user_id)`, return `{"task_id": "..."}`
- `GET /sync/status/{task_id}`: poll Celery result — return `{state, result, error}`
- `GET /sync/history`: last 10 sync results from Celery result backend (or a `sync_log` table if needed)

`services/company_tags.py`: on first sync, if user is not premium, load `data/company_tags.json` (liquidslr dataset bundled as static asset) and bulk-upsert `problem.company_tags` for matching problems. If user is premium, pull from LeetCode API during `get_problem_metadata`.

`data/company_tags.json`: download from [liquidslr/leetcode-company-wise-problems](https://github.com/liquidslr/leetcode-company-wise-problems) and commit as a static asset. Format: `{"two-sum": ["google", "amazon"], ...}`

---

### Action 6 — Sync UI components
**Files**: `frontend/app/(app)/dashboard/page.tsx` (partial), `frontend/components/sync-button.tsx`

- `sync-button.tsx`: calls `POST /api/v1/sync/trigger`, gets back `task_id`, then polls `GET /api/v1/sync/status/{task_id}` every 2s via TanStack Query. Shows: idle / syncing (spinner + "Syncing...") / done (✓ with count) / error (red). On success, invalidates all dashboard queries.
- Shows "Last synced: X minutes ago" timestamp from `user.last_synced_at`
- Cookie expiry banner: if `user.lc_session_expires_at` is set and in the past, show a yellow banner with instructions to reconnect

---

## Stage 3 — Analytics Engine

### Action 7 — mastery_scores table migration
**Files**: `backend/app/models/mastery.py`, `backend/alembic/versions/003_create_mastery_scores.py`

`mastery_scores` table from ARCHITECTURE.md §5.4:
- `id UUID PK`, `user_id FK`, `pattern TEXT`, `score FLOAT`, `first_attempt_rate FLOAT`, `avg_attempts FLOAT`, `avg_time_to_solve_s INT`, `srs_retention_rate FLOAT`, `problems_attempted INT`, `last_practiced_at`, `score_history JSONB`, `updated_at`
- `UNIQUE(user_id, pattern)`

---

### Action 8 — Mastery score computation service
**Files**: `backend/app/services/mastery.py`

`compute_mastery_score(pattern: str, submissions: list[Submission]) -> float` (0–100):

Formula from ARCHITECTURE.md §2.2:
```
score = (first_attempt_rate  × 0.30)
      + (attempts_factor     × 0.25)   # inverse of avg_attempts, normalized
      + (time_factor         × 0.20)   # relative to LeetCode global average
      + (srs_retention_rate  × 0.15)   # % of SRS reviews answered clean
      + (recency_factor      × 0.10)   # decays if not practiced in 14+ days
```

`recompute_mastery_for_user(user_id)`: called at end of sync task. Groups submissions by pattern tag, computes score per pattern, upserts into `mastery_scores`, appends `{date, score}` to `score_history` JSONB array.

`apply_recency_decay(mastery: MasteryScore) -> float`: if `last_practiced_at < now() - 14 days`, decay score by 5% per additional week. Called by Celery Beat daily job.

---

### Action 9 — Analytics API endpoints
**Files**: `backend/app/api/v1/analytics.py`

- `GET /analytics/overview`: streak, total solved (easy/medium/hard), bottom 3 patterns by mastery score, today's SRS due count
- `GET /analytics/mastery`: all `mastery_scores` for user, sorted by score asc
- `GET /analytics/heatmap`: submissions grouped by date, with dominant struggle_label per day, last 365 days
- `GET /analytics/velocity`: `score_history` JSONB from `mastery_scores` for selected patterns, for trend lines (query param: `patterns`, `window=8w`)
- `GET /analytics/contest`: contest history from LeetCode (cached in a `contest_history` JSONB column on `users` table, refreshed on sync)
- `GET /analytics/readiness`: contest readiness % computed from weighted mastery scores across all patterns, gap analysis (bottom 5 patterns with deltas needed)
- `GET /analytics/plateaus`: patterns where `score_history` shows < 2 point change over last 3 weekly snapshots

---

### Action 10 — Celery Beat scheduled jobs
**Files**: `backend/app/workers/scheduled.py`, `backend/app/workers/celery_app.py` (update beat schedule)

- `decay_mastery_scores`: daily 00:00 — load all mastery scores, apply recency decay for patterns not practiced in 14+ days, save
- `compute_srs_due`: daily 06:00 — pre-compute today's SRS queue for all users (writes due items to a fast-access structure or just ensures `due_at` index is fresh)
- `weekly_summary`: Sunday 08:00 — aggregate weekly stats per user (problems solved, mastery deltas, streak), store as JSONB on `users.weekly_summary`
- `detect_plateaus`: weekly — flag `mastery_scores` where score variance over 3 weeks < 2 points

Update `celery_app.py` beat schedule to wire these up.

---

### Action 11 — Analytics dashboard UI
**Files**: `frontend/app/(app)/dashboard/page.tsx`, `frontend/app/(app)/analytics/mastery/page.tsx`, `frontend/app/(app)/analytics/heatmap/page.tsx`, `frontend/app/(app)/analytics/velocity/page.tsx`, `frontend/components/charts/`, `frontend/components/mastery-radar.tsx`, `frontend/components/activity-heatmap.tsx`

- Dashboard: streak counter, solve counts by difficulty (3 stat cards), bottom 3 patterns callout cards, SRS due badge, sync button
- Mastery page: `RadarChart` (Recharts) with all patterns, colour-coded by score range (red < 40, yellow 40–70, green > 70)
- Heatmap page: GitHub-style calendar grid, cells coloured by struggle type (grey = none, green = clean, yellow = slow/almost, red = wrong/forgotten)
- Velocity page: `LineChart` per pattern with 2/4/8-week window selector
- Pattern detail: drill-down from radar — score breakdown table, submission history for that pattern, trend line
- Contest page: `LineChart` for rating over time, per-contest breakdown table
- Readiness page: overall % gauge, gap analysis table (pattern → current score → needed score → delta)

---

## Stage 4 — SRS & Recommendations

### Action 12 — srs_queue table migration
**Files**: `backend/app/models/srs.py`, `backend/alembic/versions/004_create_srs_queue.py`

`srs_queue` from ARCHITECTURE.md §5.5:
- `id UUID PK`, `user_id FK`, `problem_id FK`, `due_at`, `interval_days INT DEFAULT 1`, `ease_factor FLOAT DEFAULT 2.5`, `repetitions INT DEFAULT 0`, `last_reviewed_at`, `last_result TEXT`
- `UNIQUE(user_id, problem_id)`, `INDEX(user_id, due_at)`

---

### Action 13 — SM-2 SRS service
**Files**: `backend/app/services/srs.py`

`update_srs(entry: SRSQueue, result: str) -> SRSQueue`:
SM-2 algorithm:
- `result` is one of: `clean` (q=5), `struggled` (q=3), `peeked` (q=1)
- If q < 3: reset repetitions to 0, interval = 1
- Else: `interval = interval * ease_factor` (rounded), increment repetitions
- `ease_factor = ease_factor + (0.1 - (5-q) * (0.08 + (5-q) * 0.02))`, clamped to [1.3, 2.5]
- Set `due_at = now() + interval_days`

`auto_enqueue(user_id, problem_id, reason)`: adds to `srs_queue` if not already present. Called by sync task when:
- First attempt on a problem fails
- Problem required 3+ attempts to solve
- `mastery_score.srs_retention_rate` drops below 0.6

SRS API endpoints in `backend/app/api/v1/srs.py`:
- `GET /srs/queue`: today's due items with problem metadata joined
- `POST /srs/review`: `{problem_id, result}` → calls `update_srs`, returns updated entry
- `GET /srs/stats`: queue size, due today count, 30-day retention rate

---

### Action 14 — Recommendation engine
**Files**: `backend/app/services/recommendations.py`, `backend/app/api/v1/recommendations.py`

Scoring formula per unsolved problem:
```python
score = (pattern_weakness  * 0.40)   # 1 - mastery_score/100 for weakest pattern tag
      + (difficulty_fit    * 0.25)   # how well difficulty matches current mastery
      + (recency_penalty   * 0.15)   # penalty if recently attempted this problem
      + (community_quality * 0.10)   # acceptance rate as proxy
      + (company_boost     * 0.10)   # boost if in user's target companies
```

Modes (from ARCHITECTURE.md §2.4):
- `daily3`: one easy, one medium, one hard from weakest patterns
- `focus`: all 3 from single weakest pattern, difficulty adapts to mastery
- `contest`: skewed to medium/hard in weakest patterns
- `retention`: problems solved 30+ days ago at risk of forgetting
- `company`: filtered to user's `target_companies`, sorted by frequency × weakness
- `random`: weighted random, still respects weakness scores

Each recommendation response includes `why: str` — human-readable reason ("Your DP score is 34/100. This medium graph problem targets that gap.")

`POST /recommendations/feedback`: `{problem_id, action}` where action is `skip` or `dismiss` (prevents re-recommendation for 7 days / permanently)

---

### Action 15 — SRS + Recommendations UI
**Files**: `frontend/app/(app)/srs/page.tsx`, `frontend/app/(app)/recommendations/page.tsx`, `frontend/app/(app)/focus/page.tsx`, `frontend/components/srs-review-card.tsx`, `frontend/components/problem-card.tsx`

- `problem-card.tsx`: reusable card — title, difficulty badge, tags, why-recommended section, link to LeetCode (opens leetcode.com/{slug}), skip/dismiss buttons
- `srs-review-card.tsx`: problem card + 3 self-report buttons (Solved Clean / Struggled / Peeked at Solution). On submit: `POST /srs/review`, updates local state optimistically
- SRS page: today's queue as a stack of review cards, progress indicator (3/7 reviewed)
- Recommendations page: mode selector tabs, list of `problem-card` components
- Focus mode page: today's 3 recommendations + 1 SRS item, estimated time, "Let's go" CTA

---

## Stage 5 — GitHub Auto-Commit

### Action 16 — GitHub service + commit trigger in sync
**Files**: `backend/app/services/github.py`, `backend/app/services/readme_gen.py`

`GitHubService(token: str, repo: str)`:
- `commit_solution(submission: Submission, problem: Problem, notes: str | None)`:
  - If `submission.code` is None: call `LeetCodeClient.get_submission_detail(submission.id)` to fetch it first
  - File path: `solutions/{primary_pattern}/{problem.id}/solution.{ext}` where ext maps language to file extension
  - Commit message: `[{difficulty}] {title} — {runtime_ms}ms ({tags joined})`
  - If `notes` not None: also commit `solutions/{pattern}/{problem.id}/notes.md`
  - Update `submission.committed_to_github = True`, `submission.commit_sha = sha`
- `update_readme(user: User)`: regenerate `README.md` at repo root with progress table (problems solved, by difficulty, by pattern) + last-updated timestamp

`readme_gen.py`: pure function `generate_readme(stats: dict) -> str` — markdown template with progress table.

In `workers/sync.py`: after upsert of each accepted submission, call `GitHubService.commit_solution()` if user has `github_token_encrypted` set.

API: `GET /commits` — paginated list of submissions where `committed_to_github = True`, with `commit_sha` and problem metadata.

---

### Action 17 — Commit log page + notes
**Files**: `frontend/app/(app)/commits/page.tsx`, `backend/app/models/notes.py`, `backend/alembic/versions/005_create_notes.py`, `backend/app/api/v1/problems.py`

- `models/notes.py`: `problem_notes` table from ARCHITECTURE.md §5.6
- `POST /problems/{id}/notes`, `GET /problems/{id}/notes`
- Commits page: table of recent commits — problem title, difficulty, commit SHA (linked to GitHub), committed_at timestamp

---

## Stage 6 — Roadmaps & Polish

### Action 18 — Roadmap API + pages
**Files**: `backend/app/api/v1/roadmap.py`, `frontend/app/(app)/roadmap/[name]/page.tsx`, `backend/data/neetcode150.json`, `backend/data/blind75.json`, `backend/data/grind169.json`

- Bundle roadmap problem lists as static JSON (problem slugs in order)
- `GET /roadmap/{name}`: join against user's submissions to compute solved/unsolved per roadmap item, return with `solved BOOL` per problem
- Frontend: progress bar at top, filterable problem list (all / solved / unsolved), each row shows solve status, difficulty, mastery score for the problem's primary pattern

---

### Action 19 — Polish pass
**Files**: various frontend components

- Loading skeletons on all data-heavy pages (use shadcn `Skeleton`)
- Error boundaries with friendly messages
- Toast notifications for sync complete, sync error, cookie expired (use shadcn `Sonner`)
- Mobile-responsive layout pass (test nav sheet, chart responsiveness)
- Rate limiting on sync: check `last_synced_at`, reject if < 1 hour ago with `429` + message
- Weekly summary panel: shown on Sunday in a dismissable `Sheet`, uses `GET /analytics/overview` with weekly delta fields

---

## Stage 7 — Hardening & Docs

### Action 20 — Tests + docs
**Files**: `backend/tests/`, `README.md`

- `tests/test_mastery.py`: unit tests for mastery score formula edge cases
- `tests/test_srs.py`: unit tests for SM-2 algorithm (all three result types, ease factor clamp)
- `tests/test_struggle.py`: unit tests for struggle classifier (each label)
- `tests/test_sync.py`: integration test for sync task with mocked `LeetCodeClient` responses
- `README.md`: install guide, first-time setup with cookie screenshots, update instructions, FAQ
- `docker-compose.yml`: add `restart: unless-stopped` to all services for production

---

## End-to-End Verification (Full Stack)

```bash
# Start everything
docker compose up --build
docker compose exec backend alembic upgrade head

# Verify health
curl http://localhost:8000/health
# → {"status":"ok","db":true,"redis":true}

# Register + login
curl -X POST http://localhost:8000/api/v1/auth/register \
  -d '{"email":"test@test.com","password":"pass123"}'

# Connect LeetCode (use a real LEETCODE_SESSION cookie for smoke test)
curl -X POST http://localhost:8000/api/v1/users/me/leetcode \
  -H "Authorization: Bearer {jwt}" \
  -d '{"session_cookie":"your_cookie_here"}'

# Trigger sync
curl -X POST http://localhost:8000/api/v1/sync/trigger \
  -H "Authorization: Bearer {jwt}"
# → {"task_id":"..."}

# Poll until done
curl http://localhost:8000/api/v1/sync/status/{task_id}
# → {"state":"SUCCESS","result":{"synced":42,"new_problems":38}}

# Check mastery
curl http://localhost:8000/api/v1/analytics/mastery \
  -H "Authorization: Bearer {jwt}"

# Frontend: open http://localhost:3000
# Verify: radar chart populated, heatmap shows submissions, SRS queue has items
```
