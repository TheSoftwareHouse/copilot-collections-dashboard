# Copilot Collections Dashboard

**Take control of your GitHub Copilot spending.** Copilot Collections Dashboard gives engineering leaders full visibility into how their organization uses GitHub Copilot — across seats, teams, and departments — so they can optimize adoption and manage premium request costs before they spiral.

Built with [Copilot Collections](https://copilot-collections.tsh.io) by [The Software House](https://tsh.io).

---

## 🤔 The Problem

GitHub Copilot is a powerful tool, but organizations adopting it at scale face real challenges:

- 💸 **No spending visibility** — GitHub provides limited insight into per-user and per-team premium request costs. You see the bill, not the breakdown.
- 🪑 **Inactive seats burn money** — Seats assigned to users who rarely (or never) use Copilot keep costing the same as active ones. Identifying them manually is tedious.
- 👥 **No team-level accountability** — Engineering managers can't see how their team's usage compares to others, making it impossible to justify costs or encourage adoption.
- 🚨 **Premium request overruns** — Each seat includes an allowance of premium requests. When users exceed it, the organization pays extra — often without realizing it until the invoice arrives.
- 📉 **Historical tracking is missing** — Team compositions change month-over-month, but there's no built-in way to track usage trends over time as people move between teams.

## ✨ Key Features

### 📊 Dashboard & Analytics
- **Monthly usage overview** with total seats, active seats, spending, and premium request metrics at a glance
- **Per-user breakdown** — see exactly how many premium requests each person used and what it cost
- **Allowance tracking** — see included vs. used vs. paid premium requests with visual progress indicators
- **Model-level cost breakdown** — understand spending per AI model (Claude Sonnet, GPT-4o, etc.)
- **Most & least active users** — instantly spot top contributors and inactive seats
- **Spending breakdown** — separate seat license costs from paid premium request overage
- **Monthly snapshots** — team compositions are tracked per month so historical comparisons remain accurate even when people move between teams

### ⚙️ Automated Data Collection
- **Background jobs** run on a configurable schedule (default: daily at midnight UTC)
- **Seat sync** pulls the latest seat list from GitHub
- **Usage collection** fetches premium request data for each active seat

### 💺 Organisation Management
- **Teams** — group seats into teams, track usage per team, and compare across teams
- **Departments** — organize seats into departments for higher-level reporting
- **Editable metadata** — assign first name, last name, and department to each seat

### 🔐 Security & Authentication
- **Two authentication modes**: built-in credentials or Azure Entra ID (Azure AD) via OAuth 2.0 PKCE
- **GitHub App integration** — no long-lived tokens. Credentials are stored encrypted in the database using AES-256
- **Setup wizard** — guided first-run flow creates the GitHub App, installs it on your organization, and configures everything through the UI

---

## 🔧 Configuration

### Environment Variables

#### Required

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string (e.g. `postgres://user:pass@host:5432/dbname`) |
| `ENCRYPTION_KEY` | 64-char hex string for encrypting GitHub App credentials. Generate with `openssl rand -hex 32` |
| `APP_BASE_URL` | Public URL of the application (e.g. `https://copilot-dashboard.yourcompany.com`) |
| `DEFAULT_ADMIN_USERNAME` | Username for the initial admin account |
| `DEFAULT_ADMIN_PASSWORD` | Password for the initial admin account |

#### Authentication

| Variable | Description | Default |
|----------|-------------|---------|
| `AUTH_METHOD` | `credentials` (built-in login) or `azure` (Azure Entra ID SSO) | `credentials` |
| `SESSION_TIMEOUT_HOURS` | Session expiry in hours | `24` |

When using Azure Entra ID (`AUTH_METHOD=azure`):

| Variable | Description |
|----------|-------------|
| `AZURE_TENANT_ID` | Azure AD tenant ID |
| `AZURE_CLIENT_ID` | Azure AD application (client) ID |
| `AZURE_REDIRECT_URI` | OAuth callback URL (e.g. `https://copilot-dashboard.yourcompany.com/api/auth/azure/callback`) |

#### Data Sync

| Variable | Description | Default |
|----------|-------------|---------|
| `SYNC_CRON_SCHEDULE` | Cron expression for background sync jobs | `0 0 * * *` (daily at midnight) |
| `SEAT_SYNC_ENABLED` | Enable automatic seat synchronization | `true` |
| `USAGE_COLLECTION_ENABLED` | Enable automatic usage data collection | `true` |
| `SEAT_SYNC_RUN_ON_STARTUP` | Trigger seat sync immediately on app start | `false` |
| `USAGE_COLLECTION_RUN_ON_STARTUP` | Trigger usage collection immediately on app start | `false` |

> **Note:** No GitHub token environment variable is required — GitHub App credentials are stored encrypted in the database and configured through the setup wizard.

### 🐙 GitHub App Setup

The dashboard connects to GitHub through a GitHub App (not a personal access token). On first launch, the setup wizard walks you through:

1. **Create the GitHub App** — the app generates a manifest and redirects you to GitHub to create it
2. **Install on your organization** — select which organization (or enterprise) to monitor
3. **Automatic configuration** — the app detects your setup (org vs. enterprise) and starts syncing

No manual token management needed. The private key is encrypted at rest in the database.

---

## 🚀 Installation

### 🐳 Docker (Recommended)

The fastest way to get running. The Docker image includes automatic database migrations on startup.

**1. Create a `.env` file:**

```env
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/copilot_dashboard
ENCRYPTION_KEY=          # Generate with: openssl rand -hex 32
APP_BASE_URL=http://localhost:3000
DEFAULT_ADMIN_USERNAME=admin
DEFAULT_ADMIN_PASSWORD=changeme
```

**2. Start the application:**

```bash
docker compose up
```

This starts PostgreSQL, runs migrations automatically, and launches the dashboard on `http://localhost:3000`.

**3. Complete the setup wizard** — open the app in your browser, log in with your admin credentials, and follow the guided GitHub App setup.

### ☸️ Kubernetes (Helm)

A Helm chart is included for Kubernetes deployments:

```bash
helm install copilot-dashboard ./helm/copilot-dashboard \
  --set env.DATABASE_URL="postgresql://..." \
  --set env.ENCRYPTION_KEY="..." \
  --set env.APP_BASE_URL="https://copilot-dashboard.yourcompany.com" \
  --set env.DEFAULT_ADMIN_USERNAME="admin" \
  --set env.DEFAULT_ADMIN_PASSWORD="changeme"
```

### 🛠️ Development Setup

```bash
# Install dependencies
npm install

# Start PostgreSQL
docker compose up postgres -d

# Run database migrations
npx ts-node -P tsconfig.typeorm.json scripts/run-migrations.ts

# Start development server
npm run dev
```

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Next.js dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | Type checking |
| `npx vitest run` | Unit/integration tests |
| `npx playwright test` | E2E tests (credentials mode) |
| `npx playwright test --config playwright.azure.config.ts` | E2E tests (Azure mode) |

---

## 🧱 Tech Stack

- **Next.js 16** (App Router, React 19, standalone output)
- **PostgreSQL 16** with TypeORM
- **Tailwind CSS 4**
- **Recharts** for data visualization
- **Arctic** for Azure Entra ID OAuth
- **node-cron** for background job scheduling

---

## 📄 License

[MIT](LICENSE)
