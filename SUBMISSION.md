# WeekCurve — Xaventra SE-INT-04 submission

**Plan the week. Ship the goal.** WeekCurve helps startups and small software teams agree on one shippable weekly outcome per member, get a team lead's approval, and see what actually shipped. The name connects the weekly planning cadence with progress from intention to delivery.

## Live Deployment and Hosted Demo Access

The complete WeekCurve application suite is deployed and publicly accessible:

| Service | Live URL | Deployment Architecture |
| --- | --- | --- |
| Marketing website | [https://weekcurve-site.vercel.app/](https://weekcurve-site.vercel.app/) | Static Jamstack on Vercel |
| Customer application | [https://week-curve.vercel.app/](https://week-curve.vercel.app/) | TanStack Start SPA on Vercel with `/app/*` rewrites to Render |
| Internal admin console | [https://weekcurve-internal.vercel.app/](https://weekcurve-internal.vercel.app/) | TanStack Start SPA on Vercel with `/internal/*` rewrites to Render |
| FastAPI backend | [https://weekcurve-api.onrender.com](https://weekcurve-api.onrender.com) | Python 3.12 / FastAPI on Render Free Web Service |
| API health check | [https://weekcurve-api.onrender.com/app/health](https://weekcurve-api.onrender.com/app/health) | Backend health probe (`/` returns 404 by design) |
| Production database | Neon PostgreSQL 18.6 (`neondb`) | Managed serverless PostgreSQL with TLS verification |

### Hosted Staff Console Access
- **URL**: [https://weekcurve-internal.vercel.app/](https://weekcurve-internal.vercel.app/)
- **Staff Email**: `staff@example.com`
- **Password**: Provided securely to authorized reviewers upon request (never committed or exposed in public documentation).
- **Staff Access Model**: The Staff Admin account is a platform-level role on an independent `/internal` API surface with a dedicated JWT audience. It is completely decoupled from customer tenant organization memberships and provides cross-organization user, organization, and AI telemetry oversight.

### Hosted Customer Access
- **URL**: [https://week-curve.vercel.app/](https://week-curve.vercel.app/)
- **Access**: Reviewers can self-register a new organization and user account directly at [week-curve.vercel.app/signup](https://week-curve.vercel.app/signup).

## Stack and prerequisites

- API: Python 3.12, uv, FastAPI, Pydantic AI, async SQLAlchemy, Alembic, PostgreSQL 16 (local development baseline) and PostgreSQL 18.6 (Neon production).
- Customer app and staff console: React, TypeScript, TanStack Start, TanStack Query, and Orval-generated API clients.
- Marketing site: statically generated TanStack Start.
- Local tools: Node.js 24+, npm, PostgreSQL 16, and Docker for Testcontainers-based backend tests.

Use macOS or Linux. On macOS with Homebrew PostgreSQL 16, start the service with `brew services start postgresql@16` and put its `bin` directory on your `PATH` if another PostgreSQL version supplies `createdb` or `psql`. The four applications can run in separate terminals; a tmux setup is not required.

## Local setup and migration

From the repository root, create a local PostgreSQL database and configure the API:

```bash
createdb weekcurve
cd api
uv sync --python 3.12
cp .env.example .env
```

Edit the ignored `api/.env` locally. Set `SQLALCHEMY_DATABASE_URI` to a working `postgresql+asyncpg://.../weekcurve` URL and `SECRET_KEY` to a fresh random value of at least 32 characters (for example, generate one locally with `openssl rand -hex 32`). For plain HTTP on localhost, set `SECURE_COOKIE=false`; keep secure cookies enabled under HTTPS. The development `CORS_ORIGINS` setting should include the customer and staff frontend origins. Never commit `.env` or a real key.

Apply the checked-in migrations, then start the API from `api/`:

```bash
uv run alembic upgrade head
uv run fastapi dev
```

The API is at <http://localhost:8000>; customer API documentation is at <http://localhost:8000/app/docs> in development.

In three other terminals, from the repository root:

```bash
cd app && npm ci && make run       # http://localhost:3001
cd internal && npm ci && make run  # http://localhost:3002
cd site && npm ci && make run      # http://localhost:3000
```

The committed development frontend environment files point to the local API or customer app. In production, the frontends are hosted on Vercel: `app/vercel.json` and `internal/vercel.json` rewrite `/app/*` and `/internal/*` to the FastAPI backend on Render (https://weekcurve-api.onrender.com), preserving same-origin cookie handling, while `site/` links to the live customer app.

## Demo data and logins

After migrating a disposable local database, run from `api/`:

```bash
uv run manage.py seed-demo --password '<CHOOSE_LOCAL_DEMO_PASSWORD_12_PLUS_CHARS>'
```

The command refuses production, skips an organization already seeded, and creates Northstar Labs and Harbor Works. Each has Engineering and Growth teams and three weeks of sample plans, including draft, submitted, shipped, and unshipped outcomes. The supplied password is shared by the seeded accounts; no password is stored in this document.

| Demo role | Northstar Labs login | Harbor Works login |
| --- | --- | --- |
| Organization owner | `owner@northstar.demo` | `owner@harbor.demo` |
| Organization admin | `admin@northstar.demo` | `admin@harbor.demo` |
| Team lead | `lead@northstar.demo` | `lead@harbor.demo` |
| Member | `member@northstar.demo` | `member@harbor.demo` |

The seed does **not** create platform staff. Create a separate local staff account from `api/`:

```bash
uv run manage.py create-user \
  --first-name Demo --last-name Staff \
  --email '<CHOOSE_LOCAL_STAFF_EMAIL>' --admin
```

The CLI prints a generated password if `--password` is omitted. Keep that credential private. **TODO (submitter):** confirm the intended demo password and staff login setup privately before handing the archive to a reviewer; do not publish a real user's credential.

## Gemini configuration and AI features

AI features use Pydantic AI structured outputs with `google:gemini-3.5-flash-lite`. AI is optional for manual planning; to enable it locally, place a Google AI Studio key in the ignored `api/.env` as `GOOGLE_API_KEY` (leave `api/.env.example` blank). The key is never sent to a frontend. AI drafts fill an editable form and are not saved until the member chooses Save Draft.

### Implemented AI Capabilities
- **Brain Dump**: Converts unstructured thoughts or rough notes into a structured, editable Monday-keyed plan draft (main goal, sub-goals, and GTM tasks).
- **Plan Review**: Returns task-linked findings, actionable suggestions, and suggested rewrites with bounded retries.
- **Look Back Before Planning**: Uses a model tool call to inspect the member's prior two weekly plans to provide retrospective context.
- **End-of-Week Summary**: Summarizes completed tasks, shipped goals, and open work at the close of the week.
- **Team Digest**: Synthesizes weekly progress across all team members for team leads.

> **Scope Deviation Disclosure**: The assignment guidelines specify implementing *at most one* optional AI feature. WeekCurve implements all three optional AI capabilities (Look Back Before Planning, End-of-Week Summary, and Team Digest) in addition to core Brain Dump and Plan Review. This deviation was chosen to provide a cohesive weekly planning and review cycle across all team roles, and is transparently disclosed here for grading evaluation.

## Implementation and security decisions

- Customers can create or join organizations, invite members with email-bound, expiring, single-use links, manage teams, assign leads, and write Monday-keyed plans with main, sub-goal, and go-to-market tasks.
- A member saves a draft, submits it for the primary team's lead, can revise a sent-back plan, tracks completed tasks, and records whether the main goal shipped. Team leads can inspect current and historical weeks.
- The API checks current organization membership and suspension for tenant routes. Organization IDs scope resource queries; composite foreign keys and uniqueness constraints protect tenant relationships and one member-week plan.
- Platform staff use a separate `/internal` API surface and JWT audience. Staff grants come from the CLI, not customer signup. The staff console shows organization metadata, user memberships, account status, and AI usage; it does not expose customer plan text.
- Authentication uses Argon2 passwords and HttpOnly cookies. State-changing cookie requests have an Origin check, and CORS uses configured origins. Services flush database changes; routers commit transactions. Models use constrained strings rather than database enums.
- AI review returns task-linked findings and suggested rewrites; applying a suggestion edits the local form. AI attempts record organization-scoped outcomes, including unavailable, timeout, invalid output, provider failure, and rate limits.

## Verification

With Docker running, execute backend tests from `api/` (Testcontainers starts an isolated PostgreSQL 16 database):

```bash
uv run pytest -q --tb=short
uv run ruff check app tests
uv run pyright
```

For each of `app/`, `internal/`, and `site/`, run `npm run validate` and `npm run build`. Backend AI tests use offline Pydantic AI test models, not live Google requests. **TODO (submitter):** record the final full-suite and frontend check results after the last code changes; earlier reported results do not verify this final archive.

## Limits, tradeoffs, and time

- Invitations are copied as links rather than sent by email, as permitted by the assessment. Email verification, password reset, billing, and SSO are outside its requested scope. Live deployment has been fully provisioned across Vercel, Render, and Neon.
- Gemini review quality can vary, and provider quotas or outages may prevent a review. Manual plan editing and submission remain available.
- As a Render Free service, the backend may sleep when idle; the initial request after dormancy will take a few moments to spin up.
- All three optional AI capabilities (Look Back Before Planning, End-of-Week Summary, and Team Digest) are implemented, exceeding the assessment's suggested limit of at most one optional feature (as disclosed above).

**Actual development time:** TODO (submitter): enter the honest total hours spent. This cannot be determined from repository history.

## Final archive

After completing the TODOs and final verification, review the staged file list and ensure no secrets or local environment files are included. Then commit the final work and create the assessment archive from `HEAD`:

```bash
git status --short
git add -A
git diff --cached --name-only
git commit -m "Final submission"
git archive --format=zip -o assessment.zip HEAD
unzip -l assessment.zip
```

Unzip the archive into a fresh directory and follow the setup, migration, seed, and test instructions there. `git archive` includes only committed tracked files; uncommitted changes and ignored local secrets are excluded.
