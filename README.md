<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="branding/logos/weekcurve-logo-dark.svg">
    <img src="branding/logos/weekcurve-logo-light.svg" alt="WeekCurve" width="560">
  </picture>
</p>

**Plan the week. Ship the goal.** WeekCurve helps small software teams write
one shippable weekly goal per member, get a lead's approval, and track what
actually shipped. It is built on Launchbase's FastAPI and TanStack Start stack.

## Structure

| Folder      | What it is                                                                     | Setup                                     |
| ----------- | ------------------------------------------------------------------------------ | ----------------------------------------- |
| `api/`      | FastAPI backend: auth, tenants, plans, AI, migrations, tests | [api/README.md](api/README.md) |
| `app/`      | Customer planning app | [app/README.md](app/README.md) |
| `internal/` | Platform staff console | [internal/README.md](internal/README.md) |
| `site/`     | Marketing site | [site/README.md](site/README.md) |

Each folder's README has the setup and workflow details — start there.

## Requirements

- Python 3.12 and [uv](https://docs.astral.sh/uv/)
- Node.js 24+ (`nvm use` inside a frontend folder picks up `.nvmrc`)
- Postgres 16 and Docker for tests

## Dev session

Run the four services separately on ports 8000, 3001, 3002, and 3000. See
the folder READMEs and [SUBMISSION.md](SUBMISSION.md) for exact commands.

## Git hooks

Run `uv run ruff check app tests` and `uv run pyright` in `api/`, plus
`npm run validate` in each frontend. This checkout does not include a
pre-commit configuration.
