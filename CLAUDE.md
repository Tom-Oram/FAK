# CLAUDE.md — First Aid Kit (FAK)

## Non-Negotiable Rules

- Never use TODO, FIXME, HACK, TEMP, WORKAROUND, or XXX comments. If something cannot be done correctly, stop and discuss.
- Never leave incomplete implementations. Every function, component, and endpoint must be fully working before moving on.
- Never add placeholder or stub code. If it exists, it works.
- Never introduce temporary workarounds. Solve the actual problem.
- Never skip or weaken type safety. No `any`, no `as unknown as`, no `@ts-ignore`, no `# type: ignore`.
- Never disable linting rules inline. Fix the code, not the linter.
- Every code change must include corresponding tests. No exceptions.
- Read existing code before modifying it. Understand the pattern, then follow it.

## Project Overview

FAK is a network diagnostics toolkit for incident response. Three services, one Docker Compose stack:

| Service | Stack | Location | Port |
|---------|-------|----------|------|
| Frontend | React 18 + TypeScript + Vite + Tailwind | `src/` | 5173 (dev) / 8081 (prod) |
| Pathtrace API | Python 3.11 + Flask | `services/pathtrace-api/` | 5000 |
| iPerf API | Go 1.22 + Chi | `services/iperf-api/` | 8082 |

Nginx proxies all services in production. SQLite for persistence. No external DB.

## Commands

### Frontend

- `npm run dev` — start Vite dev server
- `npm run build` — TypeScript check + production build
- `npm run lint` — ESLint (zero warnings tolerance)

### Pathtrace API (Python)

- `cd services/pathtrace-api && pytest` — run all tests
- `cd services/pathtrace-api && pytest pathtracer/tests/ -v` — verbose test output

### iPerf API (Go)

- `cd services/iperf-api && go test ./...` — run all tests
- `cd services/iperf-api && go vet ./...` — static analysis

### Docker

- `docker compose up -d` — production stack
- `docker compose -f docker-compose.yml -f docker-compose.dev.yml up` — dev with hot reload

## Code Conventions

### Frontend (TypeScript/React)

- Functional components only. No class components.
- Use path aliases: `@/components`, `@/features`, `@/hooks`.
- Tailwind utility classes for all styling. No inline styles. No CSS modules.
- Use the existing color tokens: `primary-*`, `surface-*`, `danger-*`, `warning-*`, `success-*`.
- Dark mode via Tailwind `dark:` prefix. Theme toggled by `class` on root.
- Icons from `lucide-react` only. Do not add other icon libraries.
- PascalCase for components, camelCase for functions/variables, kebab-case for routes.
- Barrel exports via `index.ts` in component directories.
- TypeScript strict mode is on. Keep it on. No escape hatches.

### Pathtrace API (Python)

- snake_case for functions, variables, modules. PascalCase for classes.
- Docstrings on all public functions (Google style).
- Type hints on all function signatures.
- Flask route handlers in `traceroute.py`. Business logic in `pathtracer/` package.
- Vendor-specific code goes in `pathtracer/drivers/` and `pathtracer/parsers/`.
- Tests in `pathtracer/tests/`. Mirror the source structure.

### iPerf API (Go)

- Standard Go project layout: `cmd/`, `internal/`.
- Chi router for HTTP. Middleware in `cmd/server/main.go`.
- Test files co-located with source (`*_test.go`).
- Use `log` package for logging. No third-party loggers.
- Environment variables for all configuration. Sensible defaults.

## Testing

Every code change must include tests. This is not optional.

### What to test

- **Frontend**: Component behavior, hooks, utilities. Set up Vitest if not present.
- **Python**: All business logic, parsers, drivers, API routes. Use pytest.
- **Go**: All exported functions, handlers, parsers. Use stdlib testing.

### Test quality

- Tests must assert behavior, not implementation details.
- No tests that just check "it doesn't crash."
- Test edge cases and error paths, not just the happy path.
- Mocks are acceptable for external dependencies (SSH, network, APIs). Not for internal logic.

## Git Workflow

- All work on feature branches. Never commit directly to main.
- Branch naming: `feat/description`, `fix/description`, `refactor/description`.
- Conventional commits required: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `style:`, `chore:`.
- One logical change per commit. Do not bundle unrelated changes.
- PRs required for merge to main. Describe what changed and why.
- Verify build passes (`npm run build`), lint passes (`npm run lint`), and all tests pass before creating a PR.

## Self-Correction Log

When you make a mistake and fix it, document it here so it never happens again.
Format: `- **[date]** [what went wrong] → [what to do instead]`

Update this section immediately when a mistake is identified and corrected.
Do not wait until the end of a session. Do not skip "small" mistakes.

<!-- entries go below this line -->
