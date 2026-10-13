<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="branding/logos/weekcurve-logo-dark.svg">
    <img src="branding/logos/weekcurve-logo-light.svg" alt="WeekCurve" width="560">
  </picture>
</p>

**Plan the week. Ship the goal.** WeekCurve helps small software teams agree on
one shippable weekly goal per member, review it with a team lead, and track what
actually shipped. The application builds on the Launchbase monorepo.

## Live Deployment

| Service | URL |
| --- | --- |
| Marketing website | [weekcurve-site.vercel.app](https://weekcurve-site.vercel.app/) |
| Customer application | [week-curve.vercel.app](https://week-curve.vercel.app/) |
| Internal admin console | [weekcurve-internal.vercel.app](https://weekcurve-internal.vercel.app/) |
| FastAPI backend | [weekcurve-api.onrender.com](https://weekcurve-api.onrender.com) |
| API health check | [weekcurve-api.onrender.com/app/health](https://weekcurve-api.onrender.com/app/health) |

The backend's `/` path has no route and may return 404; use `/app/health` for
its health check. The internal console is for platform staff accounts.

## Demo Access

### Internal Admin Console (Staff)
- **Hosted Console**: [https://weekcurve-internal.vercel.app/](https://weekcurve-internal.vercel.app/)
- **Email**: `staff@example.com`
- **Password**: Provided securely to authorized reviewers upon request (never stored in public documentation or Git history).
- **Access Model**: The Staff Admin account is a platform-level administrative identity separate from customer organization memberships. It operates on an independent `/internal` API surface and dedicated staff JWT audience, giving staff cross-organization visibility into users, organizations, and AI usage metrics without mingling with customer tenant data.

### Customer Application
- **Hosted App**: [https://week-curve.vercel.app/](https://week-curve.vercel.app/)
- **Signup**: Reviewers can self-register a new organization and user account directly at [week-curve.vercel.app/signup](https://week-curve.vercel.app/signup).
- **Local Demo Data**: To evaluate pre-populated multi-organization demo data with existing plans and roles, see the [Demo data and logins](SUBMISSION.md#demo-data-and-logins) section in SUBMISSION.md.

## Features

- Email/password signup and login; organizations with owner, admin, and member
  roles; email-bound, expiring invitation links that can be copied and shared.
- Team management and team leads. A member may belong to multiple teams and
  select a primary team for plan approval. Invitation acceptance joins an
  organization; team membership is managed separately.
- Monday-keyed weekly plans with one main goal, sub-goals, and go-to-market
  goals. Members can save drafts, submit plans, revise plans sent back with
  feedback, complete individual tasks, and separately record whether the main
  goal shipped. Leads review and approve their team's plans and can view history.
- PydanticAI features: Brain Dump creates an editable draft; Plan Review returns
  task-specific findings and suggested rewrites; Look Back Before Planning uses
  a tool to retrieve the member's prior two plans; End-of-week Summary and Team
  Digest provide optional AI guidance. AI output does not automatically save
  or submit a plan.
- A platform staff console for user and organization operations and AI usage
  visibility; a marketing website; light and dark themes.

## Repository and technology

| Folder | Purpose | Setup |
| --- | --- | --- |
| `api/` | Python 3.12, FastAPI, async SQLAlchemy, Alembic, PydanticAI, Gemini, PostgreSQL; Pytest and Testcontainers | [API README](api/README.md) |
| `app/` | React 19, TypeScript, TanStack Start, TanStack Query, Tailwind CSS v4, shadcn/ui, Orval-generated customer API client | [Customer README](app/README.md) |
| `internal/` | React 19, TypeScript, TanStack Start, Tailwind CSS v4, shadcn/ui, Orval-generated staff API client | [Internal README](internal/README.md) |
| `site/` | React 19, TypeScript, TanStack Start static marketing site, Tailwind CSS v4, shadcn/ui | [Site README](site/README.md) |

The API exposes separate `/app` and `/internal` surfaces. Customer data is
scoped to current organization membership; staff authentication uses a
separate JWT audience. Backend services flush changes and routers commit.

## Local development

Prerequisites: Python 3.12, [uv](https://docs.astral.sh/uv/), Node.js 24+
with npm, PostgreSQL 16, and Docker for backend tests. Each frontend has an
`.nvmrc`. On macOS with Homebrew PostgreSQL 16, start its service with
`brew services start postgresql@16` and use its `bin` directory on `PATH` if
another PostgreSQL version supplies `createdb`.

From the repository root, create a **local** database, then configure the API:

```bash
createdb weekcurve
cd api
uv sync --python 3.12
cp .env.example .env
```

Edit the ignored `api/.env`: set `SQLALCHEMY_DATABASE_URI` to your local
`postgresql+asyncpg://.../weekcurve` connection, generate a unique
`SECRET_KEY` of at least 32 characters, and set `SECURE_COOKIE=false` for
plain HTTP on localhost. Keep the local frontend origins in `CORS_ORIGINS`.
`GOOGLE_API_KEY` is optional for manual planning; store it only on the backend
if testing live AI. Do not commit credentials or connection strings.

Apply the checked-in migrations and start the API from `api/`:

```bash
uv run alembic upgrade head
uv run fastapi dev
```

The API runs at <http://localhost:8000>; development customer API docs are at
<http://localhost:8000/app/docs>. Start the frontends in **separate terminals**
from the repository root:

```bash
cd app && npm ci && make run       # http://localhost:3001
cd internal && npm ci && make run  # http://localhost:3002
cd site && npm ci && make run      # http://localhost:3000
```

The checked-in frontend `.env.development` files provide local API and
customer-app URLs. See each frontend README for its route and API-client
generation workflow. To run backend tests with Docker available, use
`cd api && uv run pytest -q --tb=short`; Testcontainers starts an isolated
PostgreSQL 16 database. In each frontend, `npm run type-check` checks
TypeScript and `npm run build` verifies the production bundle.

## Production hosting and configuration

The marketing, customer, and staff frontends are hosted on Vercel. The
FastAPI service runs on a Render Free Web Service and connects to the existing
WeekCurve project on Neon PostgreSQL. The production database is `neondb` on
PostgreSQL 18.6; Alembic migrations were verified at revision
`62a68e37d75f`. The assessment's local database baseline remains
PostgreSQL 16.

| Component | Static output and routing |
| --- | --- |
| Customer app | `app/dist/client/`; `app/vercel.json` proxies `/app/*` to Render before falling back to `_shell.html` for SPA routes. |
| Internal console | `internal/dist/client/`; `internal/vercel.json` proxies `/internal/*` to Render before falling back to `_shell.html`. |
| Marketing site | `site/dist/client/`; statically prerendered pages, including `index.html`. |

The customer and staff clients use same-origin API requests on their respective
Vercel domains. Their Vercel rewrites forward the existing `/app` and
`/internal` prefixes to Render. Local development instead uses each client's
`VITE_API_URL`. The marketing build uses public `VITE_APP_URL` for customer
signup links.

Render configuration uses these backend variable names: `ENVIRONMENT`,
`PYTHON_VERSION`, `SQLALCHEMY_DATABASE_URI`, `DATABASE_TLS_VERIFY`,
`SECRET_KEY`, `SECURE_COOKIE`, `CORS_ORIGINS`, and optionally
`GOOGLE_API_KEY` for live Gemini features. Production database TLS requires
certificate and hostname verification. Set `CORS_ORIGINS` to the exact
customer and staff origins; never use a wildcard. Secret **values** belong
in the hosting provider's private configuration, not in this repository.

## Known limitations

- A Render Free service may sleep when idle, making the first request after
  inactivity slower.
- AI features depend on Gemini availability and quotas. Structured output can
  occasionally fail validation even with bounded retries; manual planning
  remains available.
- The frontend lockfiles still include `braces` through the shadcn build-tool
  dependency chain, for which an unpatched advisory was previously reported.
  Recheck `npm audit` before a release; do not disable security checks.
- Production uses Neon PostgreSQL 18.6 while local development and the
  assessment baseline use PostgreSQL 16. Migration rehearsal was performed
  before the production schema was created.

## Quality checks

Run `uv run ruff check app tests` and `uv run pyright` from `api/`, plus
`npm run validate` from each frontend. This checkout does not include a
pre-commit configuration. See [SUBMISSION.md](SUBMISSION.md) for demo-data
and assessment handoff instructions.
