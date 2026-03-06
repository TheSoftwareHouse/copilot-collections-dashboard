# Containerize for ECS Express Mode - Implementation Plan

## Task Details

| Field | Value |
|---|---|
| Jira ID | N/A |
| Title | Containerize Next.js Application for AWS ECS Express Mode |
| Description | Create all necessary Docker artefacts so the Copilot Usage Dashboard can be deployed as a single container on AWS ECS Express Mode (Fargate). This includes a production-optimised multi-stage Dockerfile, health-check endpoint, automated database migration runner, and supporting configuration. |
| Priority | High |
| Related Research | N/A — scope derived from codebase analysis |

## Proposed Solution

Containerize the existing Next.js 16 application using **Next.js standalone output mode** with a **multi-stage Docker build** optimised for size and security. The solution adds:

1. **Standalone build** — `output: 'standalone'` in `next.config.ts` produces a self-contained `.next/standalone` folder (~50 MB vs full `node_modules`).
2. **Multi-stage Dockerfile** — three stages (deps → builder → runner) producing a minimal Alpine-based image with a non-root user.
3. **Health-check endpoint** — `GET /api/health` verifying database connectivity; used by both `HEALTHCHECK` instruction and the ECS task-definition health check.
4. **Automated migration runner** — a TypeScript script compiled during Docker build that runs TypeORM migrations before the application starts.
5. **Entrypoint script** — runs migrations then starts the Next.js standalone server.
6. **Docker Compose update** — adds an `app` service so the full stack (app + Postgres) can be spun up locally with `docker compose up`.

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    AWS ECS Express Mode                 │
│                                                         │
│  ┌───────────────────────────────────────────────────┐  │
│  │              ECS Task Definition                   │  │
│  │                                                    │  │
│  │  ┌──────────────────────────────────────────────┐  │  │
│  │  │          Fargate Container                    │  │  │
│  │  │                                               │  │  │
│  │  │  docker-entrypoint.sh                         │  │  │
│  │  │    1. node dist/scripts/run-migrations.js     │  │  │
│  │  │    2. node server.js (Next.js standalone)     │  │  │
│  │  │                                               │  │  │
│  │  │  PORT=3000 │ HOSTNAME=0.0.0.0                 │  │  │
│  │  │  HEALTHCHECK → GET /api/health                │  │  │
│  │  └──────────────┬───────────────────────────────┘  │  │
│  └─────────────────┼─────────────────────────────────┘  │
│                    │                                     │
└────────────────────┼─────────────────────────────────────┘
                     │
          ┌──────────▼──────────┐
          │   Amazon RDS        │
          │   PostgreSQL 16     │
          │   (via DATABASE_URL)│
          └─────────────────────┘
```

### Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | **Yes** | — | PostgreSQL connection string (`postgresql://user:pass@host:5432/db`) |
| `GITHUB_TOKEN` | **Yes** | — | GitHub PAT for Copilot API access |
| `NODE_ENV` | No | `production` | Set automatically in Dockerfile |
| `DEFAULT_ADMIN_USERNAME` | No | `admin` | Initial admin username seeded on first run |
| `DEFAULT_ADMIN_PASSWORD` | No | `admin` | Initial admin password seeded on first run |
| `SESSION_TIMEOUT_HOURS` | No | `24` | Session cookie lifetime in hours |
| `SYNC_CRON_SCHEDULE` | No | `0 0 * * *` | Cron expression for sync scheduler |
| `SEAT_SYNC_ENABLED` | No | `true` | Enable/disable seat sync |
| `USAGE_COLLECTION_ENABLED` | No | `true` | Enable/disable usage collection |
| `SEAT_SYNC_RUN_ON_STARTUP` | No | `false` | Trigger sync cycle on container start |
| `USAGE_COLLECTION_RUN_ON_STARTUP` | No | `false` | Trigger usage collection on container start |
| `HOSTNAME` | No | `0.0.0.0` | Set in Dockerfile for container networking |
| `PORT` | No | `3000` | Next.js server port |

## Current Implementation Analysis

### Already Implemented
- `next.config.ts` — Next.js configuration with `serverExternalPackages` — needs standalone output added
- `docker-compose.yml` — PostgreSQL + Adminer for local dev — needs app service added
- `src/lib/data-source.ts` — TypeORM DataSource config parsing `DATABASE_URL`
- `src/lib/data-source.cli.ts` — CLI-oriented DataSource with migration glob path
- `migrations/*.ts` — 17 TypeORM migration files using raw SQL via `QueryRunner`
- `instrumentation.ts` — Cron-based sync scheduler (seat sync, usage collection, team carry-forward)
- `tsconfig.typeorm.json` — TypeScript config for TypeORM CLI compilation (`module: commonjs`, `outDir: ./dist`)
- All API routes with authentication via `requireAuth()`

### To Be Modified
- `next.config.ts` — Add `output: 'standalone'` to the configuration
- `docker-compose.yml` — Add `app` service for full-stack local development
- `tsconfig.typeorm.json` — Ensure `scripts/` directory is included in compilation scope

### To Be Created
- `Dockerfile` — Multi-stage production build
- `.dockerignore` — Exclude non-production files from Docker context
- `scripts/run-migrations.ts` — Programmatic TypeORM migration runner
- `scripts/docker-entrypoint.sh` — Entrypoint running migrations then starting the server
- `src/app/api/health/route.ts` — Health-check API endpoint
- `src/app/api/health/__tests__/route.test.ts` — Unit tests for health endpoint

## Open Questions

| # | Question | Answer | Status |
|---|----------|--------|--------|
| 1 | Should the migration runner retry on transient DB connection failures? | Yes — retry up to 5 times with 3-second backoff to handle RDS cold-start delays | ✅ Resolved |
| 2 | Should the health endpoint require authentication? | No — health checks from ECS/ALB must be unauthenticated | ✅ Resolved |
| 3 | Should we include a `.env.example` file? | Yes — document all environment variables for developer onboarding | ✅ Resolved |

## Implementation Plan

### Phase 1: Next.js Standalone Configuration & Health Check

#### Task 1.1 - [MODIFY] Enable standalone output in Next.js config
**Description**: Add `output: 'standalone'` to `next.config.ts`. This instructs Next.js to create a self-contained `.next/standalone` directory during build that includes only the necessary `node_modules` files, dramatically reducing Docker image size.

**Definition of Done**:
- [x] `next.config.ts` includes `output: 'standalone'` alongside the existing `serverExternalPackages`
- [x] `npm run build` completes successfully and produces `.next/standalone/server.js`
- [x] Existing unit tests pass without modification

#### Task 1.2 - [CREATE] Health-check API endpoint
**Description**: Create a `GET /api/health` endpoint that verifies database connectivity. Returns `200 { status: "ok" }` when healthy or `503 { status: "unhealthy", error: "..." }` when the database is unreachable. This endpoint is unauthenticated to allow ECS/ALB health probes.

**Definition of Done**:
- [x] `src/app/api/health/route.ts` exports a `GET` handler
- [x] Returns `200` with `{ status: "ok" }` when DB connection succeeds
- [x] Returns `503` with `{ status: "unhealthy", error: "<message>" }` when DB connection fails
- [x] Does not require authentication (no `requireAuth()` call)
- [x] Does not expose sensitive information (no connection strings, credentials, or stack traces)
- [x] Unit test file `src/app/api/health/__tests__/route.test.ts` covers healthy and unhealthy scenarios

### Phase 2: Migration Runner

#### Task 2.1 - [CREATE] Programmatic migration runner script
**Description**: Create `scripts/run-migrations.ts` that uses TypeORM's `DataSource.runMigrations()` API to apply pending database migrations. The script explicitly imports all migration classes (avoiding glob patterns that require ts-node). It retries the DB connection up to 5 times with 3-second backoff to handle cold-start delays in managed databases (e.g., RDS).

**Definition of Done**:
- [x] `scripts/run-migrations.ts` exists with explicit imports of all 17 migration classes
- [x] Uses the same `DATABASE_URL` parsing logic as `src/lib/data-source.ts`
- [x] Implements retry logic (5 attempts, 3s interval) for initial DB connection
- [x] Logs migration progress to stdout (applied count, skipped if up-to-date)
- [x] Exits with code 0 on success, code 1 on failure
- [x] Compiles successfully with `npx tsc --project tsconfig.typeorm.json`

#### Task 2.2 - [MODIFY] Update TypeORM tsconfig for scripts directory
**Description**: Update `tsconfig.typeorm.json` to include the `scripts/` directory in its compilation scope so that `run-migrations.ts` compiles alongside migration files.

**Definition of Done**:
- [x] `tsconfig.typeorm.json` includes `scripts/**/*.ts` in its `include` array (or covers it via existing patterns)
- [x] Running `npx tsc --project tsconfig.typeorm.json` produces `dist/scripts/run-migrations.js`

### Phase 3: Docker Configuration

#### Task 3.1 - [CREATE] .dockerignore file
**Description**: Create a `.dockerignore` file to exclude unnecessary files from the Docker build context, improving build speed and reducing image size.

**Definition of Done**:
- [x] `.dockerignore` excludes: `node_modules`, `.next`, `.git`, `*.md` (except README), `e2e/`, `test-results/`, `playwright-report/`, `specifications/`, `.env*`, `vitest.config.ts`, `playwright.config.ts`
- [x] Docker build context does not include test or specification files

#### Task 3.2 - [CREATE] Multi-stage Dockerfile
**Description**: Create a production-optimised multi-stage Dockerfile with three stages:
1. **deps** — installs all dependencies (including devDependencies for build + migration compilation)
2. **builder** — builds Next.js standalone output and compiles TypeORM migration runner
3. **runner** — minimal Alpine image with only production artefacts, non-root user, and health check

**Definition of Done**:
- [x] `Dockerfile` exists at project root
- [x] Stage `deps`: uses `node:24-alpine`, copies `package.json` + `package-lock.json`, runs `npm ci`
- [x] Stage `builder`: copies source, runs `next build`, compiles migration runner with `tsc --project tsconfig.typeorm.json`
- [x] Stage `runner`: uses `node:24-alpine`, runs as non-root user (`nextjs:nodejs`), copies only `.next/standalone`, `.next/static`, `public/`, and compiled `dist/` (migrations)
- [x] Sets `NODE_ENV=production`, `HOSTNAME=0.0.0.0`, `PORT=3000`
- [x] `EXPOSE 3000` is declared
- [x] `HEALTHCHECK` instruction pings `/api/health` every 30s with 5s timeout, 3 retries, 40s start period
- [x] Image builds successfully with `docker build -t copilot-dashboard .`
- [x] Final image size is under 300 MB

#### Task 3.3 - [CREATE] Docker entrypoint script
**Description**: Create `scripts/docker-entrypoint.sh` that runs database migrations before starting the Next.js server. This ensures the database schema is always up-to-date before the application accepts traffic.

**Definition of Done**:
- [x] `scripts/docker-entrypoint.sh` exists and is executable
- [x] Runs `node dist/scripts/run-migrations.js` first
- [x] If migration fails, exits with non-zero code (container restart)
- [x] On migration success, starts `node server.js`
- [x] Uses `exec` for the final `node server.js` so signals propagate correctly for graceful shutdown

### Phase 4: Docker Compose & Documentation

#### Task 4.1 - [MODIFY] Update docker-compose.yml with app service
**Description**: Add an `app` service to `docker-compose.yml` so developers can run the full stack locally with `docker compose up`. The app service builds from the Dockerfile, depends on Postgres, and injects required environment variables.

**Definition of Done**:
- [x] `docker-compose.yml` includes an `app` service
- [x] `app` service builds from the local `Dockerfile`
- [x] `app` depends on `postgres` with `condition: service_healthy`
- [x] `postgres` service includes a `healthcheck` (pg_isready)
- [x] `app` maps port 3000:3000
- [x] `app` injects `DATABASE_URL` pointing to the compose Postgres instance
- [ ] `docker compose up` starts all services and the app is accessible at `http://localhost:3000`

#### Task 4.2 - [CREATE] Environment variable documentation
**Description**: Create `.env.example` file documenting all environment variables with their defaults and descriptions for developer onboarding and ECS task definition configuration.

**Definition of Done**:
- [x] `.env.example` exists at project root
- [x] Lists all environment variables from the Environment Variables table above
- [x] Contains descriptive comments for each variable
- [x] Does not contain real secrets

### Phase 5: Code Review

#### Task 5.1 - [REUSE] Automated code review
**Description**: Run the `tsh-code-reviewer` agent on all created and modified files to validate code quality, security posture, and adherence to project patterns.

**Definition of Done**:
- [x] All new files reviewed: `Dockerfile`, `.dockerignore`, `scripts/run-migrations.ts`, `scripts/docker-entrypoint.sh`, `src/app/api/health/route.ts`, `src/app/api/health/__tests__/route.test.ts`, `.env.example`
- [x] All modified files reviewed: `next.config.ts`, `docker-compose.yml`, `tsconfig.typeorm.json`
- [x] No critical or high-severity issues remain unresolved

## Security Considerations

- **Non-root user**: The Docker image runs as `nextjs:nodejs` (UID 1001), never as root, limiting blast radius of container escapes.
- **No baked-in secrets**: `DATABASE_URL`, `GITHUB_TOKEN`, and `DEFAULT_ADMIN_PASSWORD` are injected at runtime via ECS task definition environment variables or AWS Secrets Manager references — never hardcoded in the image.
- **Health endpoint information disclosure**: The `/api/health` endpoint returns only a generic `{ status: "unhealthy" }` message on failure — no connection strings, credentials, or full stack traces are exposed.
- **Minimal image surface**: The multi-stage build produces a runner image with only the standalone output and compiled migrations — no dev tools, test files, source code, or build artefacts.
- **Signal propagation**: The entrypoint uses `exec` for the final `node server.js` command, ensuring `SIGTERM` from ECS is delivered to the Node.js process for graceful shutdown (draining connections, completing in-flight requests).
- **Database migration safety**: Migrations run before the server starts accepting traffic, preventing requests against an outdated schema. Retry logic handles transient connection issues without exposing error details externally.

## Quality Assurance

Acceptance criteria checklist to verify the implementation meets the defined requirements:

- [ ] `npm run build` produces `.next/standalone/server.js` (standalone output enabled)
- [ ] `GET /api/health` returns `200 { status: "ok" }` when DB is reachable
- [ ] `GET /api/health` returns `503 { status: "unhealthy" }` when DB is unreachable
- [ ] Health endpoint unit tests pass (`vitest run src/app/api/health/__tests__/route.test.ts`)
- [ ] `docker build -t copilot-dashboard .` completes successfully
- [ ] Final Docker image is under 300 MB
- [ ] Container starts and health check passes within 40 seconds: `docker run -e DATABASE_URL=... copilot-dashboard`
- [ ] Migrations are applied automatically on container startup (check logs)
- [ ] Container runs as non-root user (verify with `docker exec <id> whoami` → `nextjs`)
- [ ] `docker compose up` starts Postgres + app, app is accessible at `http://localhost:3000`
- [ ] Existing unit tests pass: `npm test`
- [ ] No secrets are baked into the Docker image (inspect with `docker history`)
- [ ] Container shuts down gracefully on `docker stop` (no SIGKILL timeout)

## Improvements (Out of Scope)

Potential improvements identified during planning that are not part of the current task:

- **CI/CD pipeline**: Automate Docker build, push to ECR, and ECS deployment via GitHub Actions or similar.
- **ECS task definition IaC**: Define the ECS task definition, service, and ALB target group using Terraform or AWS CDK.
- **AWS Secrets Manager integration**: Reference secrets directly from Secrets Manager in the ECS task definition rather than plain-text environment variables.
- **Multi-architecture builds**: Build `linux/amd64` and `linux/arm64` images for Graviton-based Fargate tasks (cost savings).
- **Custom cache handler**: Implement a Redis-based cache handler for Next.js ISR/SSG when scaling to multiple container instances.
- **Log aggregation**: Configure structured JSON logging and ship to CloudWatch Logs or a third-party observability platform.
- **Prometheus metrics endpoint**: Expose `/api/metrics` with request latency, job execution counts, and DB pool stats.
- **Graceful shutdown handler**: Add explicit `SIGTERM` handler in `instrumentation.ts` to flush cron jobs and close DB connections cleanly.

## Changelog

| Date | Change Description |
|------|-------------------|
| 2026-03-02 | Initial plan created |
| 2026-03-02 | Changed base image from node:20-alpine to node:24-alpine |
| 2026-03-02 | Implementation complete. Code review approved with minor suggestions: (1) pin node:24-alpine to digest for CVE mitigation, (2) add DATABASE_SSL support before production RDS deployment, (3) consider extracting shared parseConnectionString utility. Fixed protocol inconsistency in .env.example (postgres:// → postgresql://) |
