# QX Nexus

QX Nexus is an enterprise QA operations workspace for managing story execution, defects, release cycles, timesheets, attendance, announcements, leave requests, backups, and role-based reporting.

## Features

- Role-based Home and Dashboard experiences
- Story execution tracking with sprint, release, and story-point metadata
- Defect logging with priority, status, SIT miss, and status history
- Release cycle tracking and exportable reporting
- Timesheet calendar with office attendance policy support
- Base Office and Work Location attendance rules
- Leave request workflow
- Announcements and recognition feed
- User, project, squad, permission, and reporting manager administration
- Backup, restore, and bulk import utilities
- CSV and Excel export support

## Technology Stack

- Vite
- React 19
- TypeScript
- Tailwind CSS
- Lucide React icons
- SheetJS `xlsx` for spreadsheet export
- Browser localStorage for the current client-side data store

## Architecture

The application uses a feature-based React architecture. Shared UI primitives live under `src/components`, product capabilities live under `src/features`, and route-level views live under `src/pages`.

Current persistence is client-side localStorage. Repository and service folders are reserved for future backend integration so data access can be moved behind typed boundaries without rewriting feature screens.

## Folder Structure

```text
src/
  assets/
  components/
    common/
    dashboard/
    forms/
    layout/
  features/
    announcements/
    dashboard/
    defects/
    releases/
    reports/
    settings/
    snapshots/
    stories/
    timesheets/
  hooks/
  layouts/
  pages/
  repositories/
  services/
  store/
  styles/
  types.ts
  utils.ts
  App.tsx
  main.tsx
public/
docs/
```

## Installation

```bash
npm install
```

## Environment Variables

Copy `.env.example` to `.env.local` when deployment-specific variables are introduced.

```text
VITE_APP_NAME="QX Nexus"
```

The current application does not require secrets to run locally.

## Running Locally

```bash
npm run dev
```

The default development server runs on port `3000`.

## Building

```bash
npm run build
```

## Deployment

QX Nexus is a static Vite React application and can be deployed to any static hosting platform that supports SPA fallback routing.

## Supabase Setup

Supabase is not required for the current client-side build. When enabled, add a repository layer under `src/repositories` and expose typed application services under `src/services`.

Recommended future tables:

- users
- projects
- squads
- data_entries
- defects
- release_entries
- timesheet_entries
- leave_requests
- audit_log
- announcements

## Cloudflare D1 Setup

Cloudflare D1 is not required for the current build. For a D1-backed deployment, introduce a server/API boundary and keep feature screens dependent on repository interfaces rather than direct storage calls.

Recommended future steps:

- Define schema migrations
- Add typed repositories
- Add authentication/session handling
- Move audit logging server-side

## Vercel Deployment

1. Import the repository in Vercel.
2. Use `npm install` as the install command.
3. Use `npm run build` as the build command.
4. Use `dist` as the output directory.
5. Add environment variables when backend integrations are enabled.

## Role Matrix

| Area | Super Admin | Admin | Lead | Member | Guest |
| --- | --- | --- | --- | --- | --- |
| Home | Own workspace | Own workspace | Own workspace | Own workspace | Own workspace |
| Dashboard | Organization | Project | Own squad | Own squad | View scoped |
| Data Entry | Edit | Edit | Edit | Edit own scope | None |
| Defects | Edit | Edit | Edit | Edit own scope | None |
| Releases | Edit | Edit | Edit/View | View/Edit by permission | None |
| Timesheet | Edit | Edit | Edit | Edit own entries | None |
| Settings | Full | Scoped admin | None | None | None |
| Reports | Organization | Project | Squad | None | Scoped view |

## Future Roadmap

- Backend persistence through Supabase or Cloudflare D1
- Server-side authentication and audit trails
- Approval workflows for attendance and release governance
- Dedicated repository interfaces and service adapters
- Automated test suite for critical workflows
- CI build, lint, and security audit gates

## License

Proprietary. All rights reserved unless a separate license file is provided.
