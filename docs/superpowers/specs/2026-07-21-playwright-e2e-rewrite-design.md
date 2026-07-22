# Playwright E2E Test Suite Rewrite — Design Spec

**Date:** 2026-07-21
**Status:** Approved
**File:** `e2e/app.spec.ts`

## Goal

Rewrite the Playwright E2E test suite from scratch to cover the full Supabase-backed app end-to-end. The existing file (`e2e/app.spec.ts`, 741 lines) will be replaced with a more robust version targeting Supabase mode (`USE_BACKEND_AUTH = true`).

## Prerequisites

- `USE_BACKEND_AUTH` must be set to `true` in `src/config/features.ts`
- Supabase project fully set up: Edge Function `create-user` deployed, seed data loaded, RLS policies active
- Dev server on port 3000 (`npm run dev`)
- `@playwright/test` installed (already in devDependencies)

## Architecture

**Single-file approach** at `e2e/app.spec.ts`, matching existing Playwright config convention (`testDir: './e2e'`). 8 test suites executed serially (`workers: 1`).

### Shared Constants

```ts
const ADMIN_EMAIL = 'admin@qxnexus.local';
const ADMIN_PASSWORD = 'Admin@123';
const MEMBER_EMAIL = 'member@qxnexus.local';
const MEMBER_PASSWORD = 'Member@123';
const TS = Date.now();
const MARKER = `PLAYWRIGHT-TEST-${TS}`;
const PROJECT_NAME = `PLAYWRIGHT-PROJECT-${TS}`;
const SQUAD_NAME = `PLAYWRIGHT-SQUAD-${TS}`;
const USERNAME = `pwuser_${TS}`;
const USER_EMAIL = `pwuser_${TS}@test.example.com`;
const NEW_PASSWORD = `NewPass@${TS}`;
```

### Helper Functions

| Function | Purpose |
|----------|---------|
| `dismissBirthdayPrompt(page)` | Dismiss birthday modal if visible (checks after every login) |
| `handleForcedPasswordChange(page, pw)` | Handle forced password-change modal (heading + 2 password inputs) |
| `loginAs(page, email, pw, opts?)` | Full login flow: fill form, submit, wait for login screen to disappear, handle forced password change, dismiss birthday prompt, verify main content visible |
| `navigateTo(page, label)` | Click sidebar button by label text |
| `collectConsoleErrors(page, fn)` | Capture console errors during callback, filter CSP/favicon/403 |

### Test Flow (Serial)

#### TEST 1 — Auth + forced password change
- Login as admin via `loginAs()`
- If forced password-change modal appears, complete it
- Assert: main content visible, body text > 50 chars (no blank screen)

#### TEST 2 — Core page smoke check (Super Admin)
- Login as admin
- For each of 11 sidebar pages (Home, Dashboard, Data Entry, Defects, Cycles, Timesheet, Announcements, Leave Requests, Settings, Team Structure, Export):
  - Navigate to page
  - Collect console errors (filter CSP/favicon/403)
  - Assert: no critical console errors
  - Assert: `main` element visible with content > 10 chars

#### TEST 3 — Data Entry CRUD against live Supabase
- Login as admin, navigate to Data Entry
- If "Setup Required" shown, create project + squad via Settings first
- Fill form: project (select index 1), squad (select index 1), release (select index 1), Jira link, summary = `MARKER`, numeric fields, notes
- Submit, verify `MARKER` appears in list
- Click edit on row, update summary to `MARKER-EDITED`, save, verify
- Click delete on row, confirm, verify `MARKER` removed
- **Logs**: data entry marker for manual Supabase cross-check

#### TEST 4 — Timesheet day-edit (upsert fix regression)
- Login as admin, navigate to Timesheet
- Monitor network for 409 responses
- Click first editable day cell, change status, save
- Click same day again, change status differently, save
- Assert: no 409 conflict errors in network responses

#### TEST 5 — Project/Squad creation (Settings) + visibility
- Login as admin, navigate to Settings
- Projects tab: fill name = `PROJECT_NAME`, create, verify visible in list
- Squads tab: fill name = `SQUAD_NAME`, select project, create, verify visible in list
- **Logs**: project and squad names for manual cleanup

#### TEST 6 — User creation via Edge Function
- Login as admin, navigate to Settings > Users
- Fill Register Team Member form: employee ID, username, email, role=member, project, squad checkbox, reports-to manager
- Submit, wait for "User Created Successfully" modal
- Capture generated password from modal (try monospace element, fallback to span)
- **Logs**: username, email, captured password
- Close modal, logout
- Login as new user with captured password
- Handle forced password change (set `NEW_PASSWORD`)
- Assert: landed on Home successfully

#### TEST 7 — Duplicate username rejection
- Login as admin, navigate to Settings > Users
- Fill form with SAME username from Test 6, different email
- Submit, assert: error visible OR success modal NOT visible
- Assert: success modal does NOT appear

#### TEST 8 — Role-scoped visibility (RLS check)
- Login as admin, navigate to Data Entry, count entries
- Logout, login as member
- Navigate to Data Entry, count entries
- Assert: member entries <= admin entries
- Assert: main content not blank

### Cleanup Summary

`test.afterAll()` prints all unique test data markers for manual Supabase cleanup:
- Data Entry marker
- Project name
- Squad name
- Test user (username, email)
- Test user password

## Key Design Decisions

1. **Single file** — 8 tests is manageable; matches existing convention
2. **Serial execution** — Tests depend on prior test data (Test 6 creates user used by Test 7)
3. **Feature flag toggle** — `USE_BACKEND_AUTH` must be `true`; this is a prerequisite, not handled by the test file
4. **Birthday prompt handling** — Checked after every login (not just first), as it can appear multiple times
5. **Error filtering** — CSP, favicon, and 403 errors filtered as non-critical
6. **No Page Object Model** — Overkill for 8 tests; helpers are sufficient
7. **Graceful degradation** — If Edge Function not deployed (Test 6), test logs skip reason and returns cleanly

## Out of Scope

- Visual regression testing
- Performance/benchmark testing
- Mobile viewport testing (Chrome desktop only)
- API-level testing (tests go through UI)
- Automatic test data cleanup (manual cleanup via Supabase Table Editor)
