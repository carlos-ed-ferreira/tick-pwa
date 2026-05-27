# AGENTS.md

## Scope and Purpose

These instructions apply to the entire repository unless a more specific `AGENTS.md` exists in a subdirectory.

Tick is an offline-first personal productivity PWA focused on daily task tracking and goals management. It runs in production on Vercel and must feel closer to a native mobile app than a traditional website.

Use this file as the canonical agent guide for architecture, persistence boundaries, UX principles, development commands, validation, and documentation updates.

## Agent Operating Rules

Before changing code:

- Understand whether the change affects persistence, sync, auth, localization, timezone behavior, PWA behavior, or user-visible UX.
- Prefer the smallest implementation that satisfies the task.
- Preserve the offline-first model.
- Preserve scope isolation between guest and authenticated users.
- Do not introduce new infrastructure, backend complexity, or heavy state-management libraries unless explicitly justified by the task.
- Do not add automatic guest-to-auth migration unless explicitly requested as a product decision.

When changing code:

- Keep components small and composable.
- Keep business rules inside the relevant feature or persistence layer.
- Use local command functions in `src/lib/db` for application entity writes.
- Add or update relevant automated tests in the same work slice.
- Update documentation when behavior, setup, deployment, authentication, persistence, commands, architecture, or project rules change.

Before completing a task:

- Run the applicable checks.
- Prefer `make check` or `npm run check` for complete verification when the change is not documentation-only.
- Report which verification commands were run.
- If checks were not run, explain why.

## Core Stack

- Next.js
- TypeScript
- Tailwind CSS
- Supabase
- IndexedDB
- Dexie
- PWA
- Vercel

Do not add Laravel, PHP, Laradock, Docker, Vite, MySQL, or unrelated backend tooling.

## Architecture

The project follows a hybrid persistence architecture.

### Authenticated Users

Authenticated users have persistent cloud storage in Supabase PostgreSQL.

Authenticated user scope format:

```text
user:<supabaseUserId>
```

Authenticated writes are local-first in IndexedDB, use `syncStatus: pending`, create sync outbox items, and synchronize with Supabase when the authenticated app is online.

### Guest Users

Guest users are local-only.

Guest persistence uses IndexedDB through Dexie. Guest data must never be sent to the backend.

Guest/local demo user scope format:

```text
guest:<installationId>
```

Guest writes must remain `syncStatus: local` and must not create `syncOutbox` rows.

Do not add automatic guest-to-auth migration unless explicitly requested. Current guest data remains local in IndexedDB until browser/site data is cleared or a future explicit migration or cleanup flow is implemented.

### Auth Modes and Startup

App auth modes are:

- `entry`
- `guest`
- `authenticated`
- `unauthorized`

`AppProvider` owns:

- auth/session startup
- scope selection
- locale/timezone preferences
- authenticated sync scheduling

Startup must never leave the user stuck on loading indefinitely. If network or auth initialization cannot complete promptly, fall back to the entry experience.

## Offline-First Requirements

Offline support is a core architectural requirement. The application must remain usable without internet connectivity.

Required behavior:

- local-first writes
- optimistic UI
- minimal loading states
- resilient persistence
- network treated as enhancement
- no blocking interactions while waiting for API responses

Avoid unnecessary API calls.

## Data Persistence Rules

### IndexedDB

Use IndexedDB for application entities and offline data, including:

- tasks
- nested checklist structures
- goals
- daily entries
- offline queues
- cached entities

Application entity writes from UI must go through local command functions in `src/lib/db`.

Components must not write directly to Dexie tables. This preserves:

- summaries
- sync metadata
- scope checks
- outbox behavior

### localStorage

Use `localStorage` only for:

- theme
- UI preferences
- tiny flags
- non-structured preferences
- guest-mode language/timezone preferences when appropriate

Never use `localStorage` for application entities.

## UI Philosophy

The product must feel:

- modern
- premium
- minimal
- fluid
- fast
- highly interactive

Avoid:

- excessive buttons
- enterprise dashboards
- marketing layouts
- decorative UI
- unnecessary confirmations
- excessive cards
- cluttered interfaces

Prefer:

- inline editing
- auto-save
- contextual actions
- double-click interactions
- keyboard-friendly UX
- gesture-friendly mobile UX

## Main Application Areas

### Home

The initial route is `/`.

It allows navigation to:

- Daily Calendar
- Goals

This is not a landing page. Do not add hero sections or marketing structures.

### Daily Calendar

Calendar visualization is one of the core experiences.

Requirements:

- large monthly calendar
- standard 7-column grid
- content preview inside day cells
- modern visual hierarchy
- responsive layout
- smooth transitions

### Day Interaction

Double-clicking a day opens a large editing modal.

The modal must support:

- nested checklists
- infinite hierarchy
- inline editing
- auto-save
- collapsible structures
- color tagging
- contextual legends

### Checklist System

Checklist items support unlimited nesting.

Examples:

- `1`
- `1.1`
- `1.1.1`
- `1.1.1.1`

Do not add artificial nesting limits.

### Color System

Checklist rows may receive color tags.

Colors are:

- global
- reusable
- user-defined

Inside the day modal:

- users can manage colors
- the legend must always be visible
- changes should update instantly

### Goals

Goals are separate from daily tasks.

Goal categories:

- short term
- medium term
- long term

Goal entities exist in the local database and sync schema. Keep goals visually and behaviorally separate from daily checklist data.

## Component Guidelines

Prefer:

- small components
- isolated state
- composition
- predictable props
- reusable primitives

Avoid:

- giant components
- deep prop drilling
- over-abstraction
- premature optimization

## Componentization and Reuse

Prefer shared presentational primitives and headless hooks when the same UI behavior appears in two or more features.

Keep domain-specific commands, labels, persistence calls, and business rules inside feature modules.

Shared components under `src/components/app` and shared hooks under `src/hooks` should not know whether they are editing:

- daily checklist items
- goal steps
- categories
- another entity type

When checklist and goals share tree behavior, prefer adapter-based hooks/components over copy-paste.

Shared behavior may include:

- row layout
- action groups
- selection controls
- collapse controls
- category chips
- keyboard behavior for Enter, Tab, Backspace, and toggle shortcuts
- bulk selection
- delete behavior
- category assignment behavior

Feature-specific callbacks should handle:

- create
- update
- delete
- reorder
- toggle
- persistence actions

Do not extract an abstraction only because code looks similar. Extract only when:

- the behavior is truly the same across at least two surfaces
- a change would otherwise need to be made in multiple files
- the abstraction can stay smaller and clearer than the duplicated code
- tests can cover the shared behavior

## State Management

Prefer:

- React state
- local component state
- Context only when truly needed
- lightweight architecture

Do not introduce heavy state managers unless clearly necessary.

## Styling

Use:

- Tailwind utilities
- consistent spacing
- restrained color palette
- subtle shadows
- smooth animations
- high readability

The UI should feel similar in quality to Linear, Notion, and modern productivity apps, while maintaining its own identity.

## PWA Requirements

The app must support:

- installability
- offline mode
- caching
- mobile responsiveness
- app-like experience
- Android usability

The project is deployed as a web PWA and is not managed as a Play Store application.

## Localization and Timezone

The app supports two languages:

- Brazilian Portuguese (`pt-BR`)
- English (`en`)

The default language should be inferred from the user's current browser/region when possible.

Users must be able to switch language manually.

The selected language/region affects the timezone used to identify the current day:

- `pt-BR` uses the Brazil profile with `UTC-03:00` / `America/Sao_Paulo`
- `en` uses the browser-detected timezone when available

Never calculate daily calendar dates from raw UTC date slicing.

Use app timezone-aware helpers for:

- today
- daily entries
- calendar boundaries
- goal due-date display

Language and timezone preferences are small UI preferences. They may use `localStorage` for guest mode, but application entities must remain in IndexedDB.

## Performance

Prioritize:

- instant interactions
- low re-rendering
- virtualization when necessary
- smooth animations
- responsive mobile experience

Avoid unnecessary API calls and avoid introducing render-heavy patterns.

## Backend Philosophy

The backend should remain extremely thin.

Backend responsibilities:

- authentication
- synchronization
- persistent storage
- ownership validation

Most interaction logic should remain frontend-driven.

Allowlist access is enforced in:

- frontend auth checks
- Supabase RLS

Changes to allowlist, RLS policies, or auth activation must include automated coverage for:

- allowed users
- inactive or missing allowlist rows
- query errors
- local fallback for unauthorized users

## Code Style

Prefer:

- explicit naming
- strong typing
- direct implementations
- readable structures
- self-explanatory code through structure and naming

Avoid:

- comments
- unnecessary abstractions
- complex patterns
- enterprise architecture patterns

## Development Commands

The project includes a Makefile as a thin wrapper around npm scripts.

Useful commands:

```bash
make install
make dev
make build
make lint
make typecheck
make format
make format-check
make test
make test-e2e
make check
make clean
```

Keep the Makefile aligned with the Next.js PWA workflow.

## Testing Requirements

When changing code, always add or update relevant automated tests in the same work slice.

Use the smallest test level that covers the risk:

- unit tests for pure logic, time helpers, tree derivation, sorting, and mappers
- integration tests for Dexie commands, persistence behavior, scope isolation, sync queues, mocked sync engine behavior, allowlist checks, auth isolation, and local-first flows
- Playwright tests for critical user flows and regressions that require real browser behavior

Playwright is configured for:

- desktop Chromium
- mobile Chrome local-mode smoke coverage

Playwright starts Next.js on:

```text
127.0.0.1:3100
```

For local-only flows, Playwright uses:

```text
NEXT_PUBLIC_TICK_DISABLE_SUPABASE=1
```

Playwright artifacts are written under:

```text
.next/playwright-*
```

Keep new Playwright artifacts out of watched project folders such as `test-results/`, so `next dev` does not watch generated traces, videos, or screenshots and enter Fast Refresh loops.

## Documentation Requirements

For every completed change:

- report which verification commands were run
- update `README.md` when user-visible behavior, setup, deployment, authentication, persistence, commands, or architecture changes
- update `.github/copilot-instructions.md` when project rules, architectural decisions, persistence boundaries, workflow requirements, or UX principles change
- update `AGENTS.md` when project rules, architectural decisions, persistence boundaries, workflow requirements, or UX principles change
- keep documentation focused on current behavior and verified project rules

## Supabase Schema Changes

For Supabase schema changes:

- create a timestamped SQL migration in `supabase/migrations/`
- run `make supabase-types` after applying or updating the schema
- keep generated database types in sync with the remote schema

## Important UX Rules

- auto-save whenever possible
- avoid save buttons
- avoid confirmation dialogs
- interactions should feel immediate
- editing should be frictionless
- mobile UX is first-class
- desktop UX should still feel excellent

## Simplicity Guardrails

Build for simplicity first.

Avoid:

- overengineering
- unnecessary infrastructure
- unnecessary backend complexity

The project is primarily a personal productivity tool.
