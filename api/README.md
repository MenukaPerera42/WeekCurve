# WeekCurve API

The WeekCurve backend: tenant-scoped planning and staff operations on FastAPI.

## Requirements

- Python 3.12
- Postgres 16
- [uv](https://docs.astral.sh/uv/)

## Quick start

On macOS Apple Silicon, use Homebrew PostgreSQL 16 and a Python 3.12 environment managed by uv.

From the repo root:

```bash
cd api
uv sync                                  # create venv + install deps (incl. dev group)
cp .env.example .env                     # then edit values
createdb weekcurve                       # or use psql / pgAdmin
uv run alembic upgrade head              # apply migrations
uv run fastapi dev                       # http://localhost:8000
```

Git hooks are managed at the repo root — see the [root README](../README.md#git-hooks).
Code quality checks across the monorepo use Ruff and Pyright — see the [root README](../README.md) for quality checks.

App API docs: <http://localhost:8000/app/docs>

## Common workflows

### Run the dev server
```bash
uv run fastapi dev
```

### Run tests
```bash
uv run pytest
```
Tests spin up Postgres in a container via `testcontainers` — no manual DB setup needed.

### Create a migration
```bash
uv run alembic revision --autogenerate -m "describe change"
uv run alembic upgrade head
```

### Create a platform staff user
```bash
uv run manage.py create-user \
  --first-name Admin \
  --last-name User \
  --email admin@example.com \
  --admin
```
The login password is generated and printed unless you pass `--password`.

### Run a custom management command
```bash
uv run manage.py --help
```

### Seed local demo data
```bash
uv run manage.py seed-demo --password 'choose-a-long-local-password'
```
The command is idempotent and refuses to run in production. It creates two
organizations, teams, owner/admin/lead/member accounts, and several weeks of
plans. It never creates a platform staff account; use `create-user --admin`
for that. `GOOGLE_API_KEY` is optional for local planning and tests.

### Lint & type-check
From the repo root:
```bash
uv run ruff check app tests
uv run pyright
```

## Production Deployment

- **Hosted API**: [https://weekcurve-api.onrender.com](https://weekcurve-api.onrender.com)
- **Health Check**: [https://weekcurve-api.onrender.com/app/health](https://weekcurve-api.onrender.com/app/health)
- **Hosting Platform**: Render (Web Service running Python 3.12 / FastAPI)
- **Production Database**: Neon PostgreSQL 18.6 (`neondb`), with TLS certificate and hostname verification enabled.
- **Service Behavior**: The API runs on a Render Free Web Service and may sleep when idle; the initial request after inactivity will take a few moments to spin up.
