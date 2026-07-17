# QX Nexus

**Enterprise QA Operations Intelligence Platform** — Centralised workspace for story execution tracking, defect management, release cycles, timesheets, attendance, and team operations.

---

## Overview

QX Nexus is a React-based single-page application designed for QA organisations to track operational metrics against external work items (Jira stories/defects). It does **not** replace Jira — instead, it captures QA-specific data (test case counts, execution results, defect priorities, SIT misses, sprint/release metadata) to power reporting, analytics, and operational visibility.

**Current Architecture**: Client-side Vite + React 19 + TypeScript + Tailwind CSS v4. **localStorage-only build** — no backend dependencies. All application state and user data persisted in browser localStorage. This is a checkpoint before a separate backend is re-added later via bolt.new.

---

## Backend Status

**This app currently runs on localStorage only.** A real backend (Supabase/PostgreSQL or otherwise) needs to be implemented against the following repository interfaces in `src/repositories/` and types in `src/types/`:

### Repository Interfaces to Implement

| Interface | File | Purpose |
|-----------|------|---------|
| `IAppStateRepository` | `src/repositories/IAppStateRepository.ts` | App state (projects, squads, releases, data entries, defects, timesheets, holidays, audit log, etc.) |
| `IUserRepository` | `src/repositories/user/IUserRepository.ts` | User CRUD, auth, permissions, reporting manager, promote/demote |
| `IProjectRepository` | `src/repositories/IProjectRepository.ts` | Project CRUD, code/name uniqueness |
| `ISquadRepository` | `src/repositories/ISquadRepository.ts` | Squad CRUD, code/name uniqueness per project |
| `IDataEntryRepository` | `src/repositories/dataEntry/IDataEntryRepository.ts` | Data entry CRUD, filtering by project/squad/sprint |
| `IDefectRepository` | `src/repositories/defect/IDefectRepository.ts` | Defect CRUD with status history |
| `IReleaseRepository` | `src/repositories/release/IReleaseRepository.ts` | Release CRUD |
| `IReleaseEntryRepository` | `src/repositories/releaseEntry/IReleaseEntryRepository.ts` | Release calendar entries |
| `ITimesheetRepository` | `src/repositories/timesheet/ITimesheetRepository.ts` | Timesheet CRUD with working days |
| `IHolidayRepository` | `src/repositories/holiday/IHolidayRepository.ts` | Holiday CRUD |
| `ILeaveRepository` | `src/repositories/leave/ILeaveRepository.ts` | Leave request workflow |
| `IAnnouncementRepository` | `src/repositories/announcement/IAnnouncementRepository.ts` | Announcement CRUD |
| `INotificationRepository` | `src/repositories/notification/INotificationRepository.ts` | In-app notifications |
| `IRecognitionRepository` | `src/repositories/recognition/IRecognitionRepository.ts` | Peer recognitions |
| `IAuditRepository` | `src/repositories/audit/IAuditRepository.ts` | Audit log |
| `IBackupRepository` | `src/repositories/backup/IBackupRepository.ts` | Backup/restore metadata |
| `ISprintRepository` | `src/repositories/sprint/ISprintRepository.ts` | Sprint CRUD |

### Types to Match

Core domain types in `src/types/index.ts`:
- `User` (with `UserPermissions`, roles: superadmin/admin/lead/member/guest)
- `Project`, `Squad`, `Release`, `Sprint`
- `DataEntry`, `Defect`, `ReleaseEntry`
- `TimesheetEntry` + `WorkingDay`
- `Holiday`, `LeaveRequest`, `Announcement`
- `NotificationEntry`, `UserNotification`
- `Recognition`, `AuditLogEntry`, `BackupMetadata`
- `AppState` (the complete persisted state shape)

### Authentication

Current local auth in `src/services/auth.service.ts` uses localStorage with simple password hashing. A backend should replace this with proper password hashing (bcrypt/argon2), JWT/session tokens, and secure password reset flows.

---

## Features

| Area | Capabilities |
|------|--------------|
| **Authentication** | Local email/password auth, role-based sessions, password rotation, forced change on first login, session locking after 10 min inactivity, auto-logout after 30 min |
| **Home Dashboard** | Personal weekly metrics (stories, TC created/executed/passed/failed, pass rate, defects), trend vs. prior week, upcoming birthdays, holidays, team recognitions, quick actions |
| **Data Entry** | Log story execution per day: release, sprint, Jira link/summary, TC created/executed/passed/failed, story points, status, custom fields; inline edit, duplicate, delete |
| **Defects** | Log defects with priority (P1/P2/P3), status workflow (Open → In Progress → Re-Opened → Resolved → Closed), SIT miss flag, status history audit trail, story linking |
| **Releases (Cycles)** | Release calendar with regression/beta/prod dates, story point totals, UAT points, per-squad filtering for Leads, export to Excel |
| **Timesheets** | Monthly calendar grid with day statuses (Working/Leave/Holiday/WFH/Training), night deployment & weekend support flags, work location tracking with audit trail, office attendance policy (Bengaluru 8 days, Mumbai 4 days) |
| **Leave Requests** | Submit Annual/Sick/Personal/Other leave; approver workflow (pending/approved/rejected); admin/lead review queue |
| **Announcements** | Role/project-targeted announcements with expiry, type (info/warning/success/alert), author attribution |
| **Team Structure** | Project/squad/user roster with role badges, reporting lines, direct reports, inline user management |
| **Settings** | User management (CRUD, promote/demote, reset password, permissions), projects/squads/releases/sprints/holidays/custom fields, backup/restore, audit log viewer |
| **Export** | Multi-sheet Excel (XLSX) export for data entries, defects, releases, timesheets, leave, recognitions |
| **Recognitions** | Peer-to-peer recognition with emoji reactions, notifications, home feed |
| **Notifications** | Real-time bell icon with unread count, categories (defect, password, timesheet, system), mark read/delete, deep links |
| **Role-Based Access** | 5 roles (Super Admin, Admin, Lead, Member, Guest) with granular page-level permissions (edit/view/none) and row-level scoping by project/squad |
| **Theming** | Dark/light mode persisted in localStorage, CSS-variable based design system |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (SPA)                            │
├─────────────────────────────────────────────────────────────────┤
│  React 19 + TypeScript + Vite + Tailwind CSS v4                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │   Pages      │  │  Components  │  │   Hooks / Context    │  │
│  │  (route-level)│  │  (shared UI) │  │  (auth, ref data)    │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘  │
│         │                 │                      │              │
│         ▼                 ▼                      ▼              │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    Services Layer                         │  │
│  │  UserService · AppStateService · NotificationService ··· │  │
│  └────────────────────────────┬──────────────────────────────┘  │
│                               │                                 │
│                               ▼                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                   Repository Abstraction                  │  │
│  │  IAppStateRepository • IUserRepository • IProjectRepository···│
│  └────────────────────────────┬──────────────────────────────┘  │
│                               │                                 │
│                               ▼                                 │
│   ┌─────────────────────────────────────────────────────┐     │
│   │           LocalStorageRepository (only impl)        │     │
│   └─────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────┘
```

### Key Architectural Decisions

| Layer | Responsibility |
|-------|----------------|
| **Pages** | Route-level views composed from feature components |
| **Components** | Reusable UI primitives (`common`, `layout`, `forms`, feature-specific) |
| **Services** | Business logic, orchestration, cross-cutting concerns (notifications, app-state persistence) |
| **Repositories** | Typed data access interfaces; localStorage implementation only |
| **Auth** | Local email/password auth; application profile in localStorage |
| **State** | Single `AppState` object persisted atomically; scoped per-user via `scopeAppStateForUser` |
| **Permissions** | Pure functions in `utils/authorization.ts` — used by both UI (hide/show) and services (enforce) |

---

## Folder Structure

```
qx-nexus/
├── public/                     # Static assets
├── src/
│   ├── App.tsx                 # Root: auth guard, routing, layout, global state
│   ├── main.tsx                # Entry point
│   ├── types/                  # TypeScript domain models (User, DataEntry, Defect, etc.)
│   ├── utils/                  # Pure helpers (authz, dates, export, formatting, id gen)
│   ├── styles/theme.ts         # Design tokens (colors, spacing, radii, component styles)
│   ├── services/               # Business logic layer
│   │   ├── auth.service.ts     # Local auth wrapper
│   │   ├── user.service.ts     # User CRUD + authorization
│   │   ├── appState.service.ts # AppState load/save/migrate (RepositoryFactory)
│   │   ├── NotificationService # In-app notification engine
│   │   └── project/squad/...   # Domain services
│   ├── repositories/           # Data access interfaces + implementations
│   │   ├── *.ts                # localStorage repositories
│   │   └── RepositoryFactory.ts# Returns localStorage implementations
│   ├── hooks/                  # Custom React hooks (useAuth, useUsers, useProjects, etc.)
│   ├── context/                # React Context providers (Auth, ReferenceData)
│   ├── components/
│   │   ├── common/             # Button, Input, Select, Table, Modal, Card, Badge, Toast
│   │   ├── layout/             # Sidebar, Header, Layout wrappers
│   │   ├── dashboard/          # Dashboard widgets
│   │   ├── home/               # Home page sections
│   │   ├── dataEntry/          # DataEntryForm, DataEntryTable, filters
│   │   ├── defects/            # DefectForm, DefectTable, status badge
│   │   ├── releases/           # ReleaseForm, ReleaseTable
│   │   ├── timesheets/         # TimesheetGrid, DayCell, LocationPicker
│   │   ├── users/              # UserTable, UserForm, PermissionMatrix
│   │   ├── projects/           # Project CRUD
│   │   ├── squads/             # Squad CRUD
│   │   ├── sprints/            # Sprint CRUD
│   │   ├── stories/            # Story reference data
│   │   ├── notifications/      # NotificationCenter, NotificationItem
│   │   ├── activity/           # Activity feed
│   │   ├── audit/              # AuditLogTable
│   │   └── forms/              # Reusable form field components
│   └── pages/                  # Route-level page components
│       ├── Home.tsx
│       ├── Dashboard.tsx
│       ├── DataEntry.tsx
│       ├── Defects.tsx
│       ├── Releases.tsx
│       ├── Timesheet.tsx
│       ├── LeaveRequests.tsx
│       ├── Announcements.tsx
│       ├── TeamStructure.tsx
│       ├── Export.tsx
│       └── Settings.tsx
├── docs/architecture.md        # High-level vision
├── package.json
├── tsconfig.json
├── vite.config.ts
├── .env.example
└── README.md
```

---

## Tech Stack

| Category | Technology |
|----------|------------|
| **Language** | TypeScript 5.8 |
| **Framework** | React 19 (hooks, concurrent features) |
| **Build Tool** | Vite 6 |
| **Styling** | Tailwind CSS v4 (CSS-first, `@import "tailwindcss"`) |
| **Icons** | Lucide React |
| **Spreadsheet Export** | SheetJS (`xlsx`) |
| **Persistence** | localStorage (only) |
| **Repository Pattern** | Custom abstraction (`IAppStateRepository`, `IUserRepository`, …) |
| **Testing** | Playwright (E2E), Vitest (unit — configured, tests TBD) |
| **Linting / Typecheck** | `tsc --noEmit` (`npm run lint`) |

---

## Installation

### Prerequisites

- Node.js ≥ 20
- npm ≥ 10

### Clone & Install

```bash
git clone https://github.com/<your-org>/qx-nexus.git
cd qx-nexus
npm install
```

### Environment Variables

The app runs entirely in localStorage mode — no backend variables required.

```bash
cp .env.example .env.local
```

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_APP_NAME` | No | Application title (default: "QX Nexus") |
| `VITE_APP_BASE_URL` | No | Base URL for HMR in tunnels (e.g., ngrok) |

---

## Running Locally

```bash
# Development server (port 3000, host 0.0.0.0)
npm run dev

# Type-check only
npm run lint

# Production build → dist/
npm run build

# Preview production build
npm run preview
```

Open `http://localhost:3000`. Default credentials (localStorage seed):

| Role | Email | Password |
|------|-------|----------|
| Super Admin | `admin@qxnexus.local` | `Admin@123` |
| Admin | `admin2@qxnexus.local` | `Admin@123` |
| Lead | `lead@qxnexus.local` | `Lead@123` |
| Member | `member@qxnexus.local` | `Member@123` |

> **Note**: On first login, you'll be forced to change your password (min 8 chars, 1 uppercase, 1 number).

---

## Environment Variables (from code)

| Variable | Source | Default | Notes |
|----------|--------|---------|-------|
| `VITE_APP_NAME` | `App.tsx`, `index.html` | "QX Nexus" | UI branding |
| `VITE_APP_BASE_URL` | `vite.config.ts` | — | HMR origin for tunnels |

---

## Usage Walkthrough

### 1. Sign In
Email + password via local auth. Session persists across reloads.

### 2. Home (Personal Dashboard)
- **Weekly Metrics**: Stories tested, TC created/executed/passed/failed, pass rate, defects logged — with **trend vs. last week** (green/red arrows).
- **Callout Banner**: Auto-detects empty week, metric drops >20%, or "all green" success.
- **Birthdays**: Next 14 days, project-scoped.
- **Holidays**: Today + upcoming.
- **Recognitions**: Received/given feed with emoji reactions.
- **Quick Actions**: One-click navigate to Data Entry, Defects, Timesheet, Leave.

### 3. Data Entry
- **Add**: Date, release (free text), project/squad, sprint, Jira story link + summary, TC created/executed/passed/failed, story points, status, notes, custom fields.
- **Table**: Inline edit, duplicate, delete, filter by date range/release/sprint/project/squad.
- **Permissions**: `edit` → full CRUD; `view` → read-only.

### 4. Defects
- **Fields**: Date, release, project/squad/sprint, Jira defect link/summary, Jira created date, priority (P1/P2/P3), status workflow, resolved date, SIT miss, story link, notes, custom fields.
- **Status History**: Immutable audit trail (status, changed by, timestamp).
- **Filters**: Status, priority, date range, project, squad, sprint.

### 5. Releases (Cycles)
- **Calendar View**: Release name, regression start/end, beta, prod date, total/UAT story points.
- **Lead Scoping**: Leads see only their project's squads/releases.
- **Export**: Excel with all fields.

### 6. Timesheet
- **Monthly Grid**: Each day → click-to-toggle: Working / Leave / Holiday / WFH / Training / Weekend.
- **Night Deployment / Weekend Support**: Checkboxes per day.
- **Work Location**: Dropdown (office locations); changes create `location_audit` trail (who, when, from → to).
- **Attendance Policy**: Bengaluru = 8 qualifying office days/month; Mumbai = 4. Auto-calculated on Home.
- **Admin Adjustment**: Admins can override any user's day with audit flag.

### 7. Leave Requests
- Submit: type, date range, reason.
- Approvers (Admin/Lead) see pending queue → Approve/Reject with reason.
- Status: `pending` → `approved` | `rejected`.

### 8. Announcements
- Admin-only create. Target roles + optional project. Expiry date. Type badge (info/warning/success/alert).

### 9. Team Structure
- Hierarchical view: Projects → Squads → Members.
- Inline user create/edit (role, project, squad, reporting manager, base office, permissions matrix).
- Authorization enforced via `authorize()` — UI hides disallowed actions; service layer re-validates.

### 10. Settings (Admin / Super Admin)
| Tab | Capability |
|-----|------------|
| **Users** | CRUD, promote/demote, reset password, permissions matrix, base office, reporting manager |
| **Projects** | CRUD, code, description, active flag |
| **Squads** | CRUD, assign to project |
| **Releases** | Master release name list |
| **Sprints** | Name + date range |
| **Holidays** | Date, name, type (Holiday/Optional), year |
| **Custom Fields** | Dynamic fields for Data Entry / Defects (text/number/select/url/date) |
| **Backup / Restore** | Export full AppState JSON; import with validation & migration |
| **Audit Log** | Paginated, filterable (action, user, date range) |

### 11. Export
Multi-sheet `.xlsx` download: Data Entries, Defects, Release Entries, Timesheets, Leave Requests, Recognitions.

---

## Role & Permission Matrix

| Page / Action | Super Admin | Admin | Lead | Member | Guest |
|---------------|-------------|-------|------|--------|-------|
| **Home** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Dashboard** | edit | edit | view | none | view |
| **Data Entry** | edit | edit | edit | edit | none |
| **Defects** | edit | edit | edit | edit | none |
| **Releases** | edit | edit | edit* | view* | none |
| **Timesheet** | edit | edit | edit | edit (own) | none |
| **Leave Requests** | edit | edit | edit | edit (own) | none |
| **Announcements** | edit | edit | none | none | none |
| **Team Structure** | edit | edit | view | none | view |
| **Export** | edit | edit | view | none | view |
| **Settings** | edit | edit* | none | none | none |

\* Lead scope limited to own project/squads. Admin cannot delete users or promote/demote (Super Admin only).

### Row-Level Scoping
- **Super Admin**: All projects, all data.
- **Admin**: Assigned project only.
- **Lead / Member**: Assigned squad(s) only (`accessibleSquads` + `squadId`).
- **Guest**: Read-only dashboards/exports for assigned project.

---

## Configuration

### Design System (`src/styles/theme.ts`)

Centralised tokens:

```ts
export const lightTheme: ThemeTokens = {
  bg: '#f8fafc',
  surface: '#ffffff',
  text: '#0f172a',
  muted: '#64748b',
  border: '#e2e8f0',
  blue: '#2563eb',
  indigo: '#4f46e5',
  green: '#16a34a',
  red: '#dc2626',
  amber: '#f59e0b',
  orange: '#f97316',
  // ... component-level styles (card, input, button, badge, table, select)
};
```

Dark theme mirrors with inverted surfaces. Toggle persists to `localStorage`.

### Repository Factory (`src/repositories/RepositoryFactory.ts`)

```ts
export const RepositoryFactory = {
  getRepository(): IAppStateRepository {
    return LocalStorageRepository;
  },

  getUserRepository(): IUserRepository {
    return LocalStorageUserRepository;
  },
};
```

---

## Testing

```bash
# Type-check (CI gate)
npm run lint

# Unit tests (Vitest — configure in vitest.config.ts)
npm run test

# E2E tests (Playwright)
npx playwright test
```

> Current repo includes Playwright config and `test-results/` but no authored tests yet.

---

## Build & Deployment

### Production Build

```bash
npm run build   # → dist/
```

### Static Hosting (Vercel, Netlify, Cloudflare Pages, S3+CloudFront)

| Setting | Value |
|---------|-------|
| Build Command | `npm run build` |
| Output Directory | `dist` |
| SPA Fallback | `index.html` |

---

## Roadmap (from code TODOs & comments)

- [ ] **Separate backend integration** — Re-add a backend (Supabase/PostgreSQL/Node) via bolt.new or similar for multi-user persistence and realtime sync.
- [ ] **Realtime sync** — Subscribe to `data_entries`, `defects`, `timesheets` changes for multi-user live updates.
- [ ] **Server-side audit logging** — Move `audit_logs` inserts to DB triggers / edge functions.
- [ ] **Approval workflows** — Timesheet sign-off, release governance gates.
- [ ] **Automated test suite** — Vitest unit tests for `authorization.ts`, `utils/*`; Playwright E2E for critical paths (login, data entry CRUD, timesheet grid).
- [ ] **CI/CD pipeline** — GitHub Actions: lint → typecheck → test → build → deploy preview.
- [ ] **Custom field UI** — Full builder in Settings for `dataEntry` / `defect` custom fields.
- [ ] **Reporting dashboard** — Aggregated org/project/squad metrics (velocity, defect leakage, pass rate trends).
- [ ] **Mobile-responsive polish** — Timesheet grid horizontal scroll, sidebar drawer on <768px.

---

## Known Limitations

| Area | Limitation |
|------|------------|
| **Offline** | No Service Worker / IndexedDB — requires network only for initial load. |
| **Concurrency** | `localStorage` repo uses single-key overwrite — last write wins. |
| **File Uploads** | No attachment support (defect screenshots, story docs). |
| **Jira Integration** | Links are free-text; no OAuth / API sync. |
| **Email Notifications** | In-app only; no SMTP / SendGrid integration. |
| **i18n** | English only (hardcoded strings). |
| **Accessibility** | Basic semantic HTML; no formal a11y audit. |

---

## Contributing

1. Fork the repository.
2. Create a feature branch: `git checkout -b feat/your-feature`.
3. Run `npm run lint` before committing.
4. Write tests for new logic (authorization, utils, services).
5. Open a Pull Request with:
   - Clear description of the change
   - Linked issue (if any)
   - Screenshots for UI changes

### Code Style

- **TypeScript**: Strict mode, no `any` without justification.
- **Components**: Functional + hooks; colocated styles via `theme.ts` tokens.
- **Services**: Pure functions where possible; side effects at edges (repositories).
- **Commits**: Conventional Commits (`feat:`, `fix:`, `chore:`, `refactor:`).

---

## License

**Proprietary** — All rights reserved. Internal use only unless a separate license file is provided.

---

## Acknowledgements

- **React** / **Vite** / **Tailwind CSS** teams for excellent tooling.
- **Lucide** for the icon set.
- **SheetJS** for client-side Excel export.
- Internal QA teams for domain feedback and workflow validation.

---

> **QX Nexus** — *QA Operations Intelligence Platform*  
> Built for visibility, accountability, and continuous improvement.