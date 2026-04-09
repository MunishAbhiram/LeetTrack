# Docker Quick Start

This project runs with Docker Compose.

## Prerequisites

- Docker Desktop installed and running
- Ports `3000`, `5432`, `6379`, and `8000` available

## 1. Create the local env file

From the project root:

```bash
cp .env.example .env
```

Generate a Fernet key:

```bash
python3 -c "import os, base64; print(base64.urlsafe_b64encode(os.urandom(32)).decode())"
```

Open `.env` and set:

- `JWT_SECRET` to a long random value
- `FERNET_KEY` to the generated value above

## 2. Start the stack

For local development with reload:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build -d
```

This starts:

- `postgres`
- `redis`
- `backend`
- `celery_worker`
- `celery_beat`
- `frontend`

## 3. Run database migrations

Run this after the containers are up:

```bash
docker compose exec -T backend alembic upgrade head
```

## 4. Open the app

- Frontend: [http://localhost:3000](http://localhost:3000)
- Backend health: [http://localhost:8000/api/v1/health](http://localhost:8000/api/v1/health)

## Useful commands

Check container status:

```bash
docker compose ps
```

Follow logs:

```bash
docker compose logs -f
```

Stop everything:

```bash
docker compose down
```

Stop and remove volumes too:

```bash
docker compose down -v
```

## Notes

- The frontend redirects `/` to `/login` when it is running correctly.
- If Docker is not running, start Docker Desktop first.
- If you change the database schema or start with a fresh database, rerun the Alembic migration command.
