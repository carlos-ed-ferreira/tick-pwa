# Copilot Instructions

Tick is an offline-first personal productivity PWA focused on daily task tracking and goals management.

The application is running in production on Vercel and must feel closer to a native mobile app than a traditional website.

## Core Stack

- Next.js
- TypeScript
- Tailwind CSS
- Supabase
- IndexedDB
- Dexie
- PWA
- Vercel

## Architecture

The project follows a hybrid persistence architecture.

### Authenticated users

Persistent cloud storage:

- Supabase PostgreSQL

Authenticated users use `user:<supabaseUserId>` scope. Writes are local-first in IndexedDB, queued through the sync outbox, and synchronized with Supabase when the authenticated app is online.

### Guest users

Local-only persistence:

- IndexedDB via Dexie

Guest data must NEVER be sent to the backend.

Guest writes must remain `syncStatus: local` and must not create `syncOutbox` rows. Authenticated writes should use `syncStatus: pending` and queue outbox items for synchronization.

Guest/local demo users use `guest:<installationId>` scope.

App auth modes are `entry`, `guest`, `authenticated`, and `unauthorized`. `AppProvider` owns auth/session startup, scope selection, locale/timezone preferences, and authenticated sync scheduling. Startup must never leave the user stuck on loading indefinitely; network/auth initialization should fall back to the entry experience when it cannot complete promptly.

Do not add automatic guest-to-auth migration unless explicitly requested as a product decision. Current guest data remains local in IndexedDB until browser/site data is cleared or a future explicit migration/cleanup flow is implemented.

## Offline-first principles

Offline support is a core architectural requirement.

The application must remain usable without internet connectivity.

Rules:

- local-first writes
- optimistic UI
- minimal loading states
- resilient persistence
- network treated as enhancement
- avoid blocking interactions waiting for API responses

## Data persistence rules

### IndexedDB

Use IndexedDB for:

- tasks
- nested checklist structures
- goals
- daily entries
- offline queues
- cached entities

### localStorage

Use localStorage ONLY for:

- theme
- UI preferences
- tiny flags
- non-structured preferences

Never use localStorage for application entities.

Application entity writes from UI must go through local command functions in `src/lib/db`; components should not write directly to Dexie tables. This preserves summaries, sync metadata, scope checks, and outbox behavior.

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
- double click interactions
- keyboard-friendly UX
- gesture-friendly mobile UX

## Main Application Areas

## Home

The initial route `/`.

Allows navigation to:

- Daily Calendar
- Goals

This is NOT a landing page.

Avoid hero sections or marketing structures.

## Daily Calendar

Calendar visualization is one of the core experiences.

Requirements:

- large monthly calendar
- standard 7-column grid
- content preview inside day cells
- modern visual hierarchy
- responsive layout
- smooth transitions

### Day interaction

Double click on a day opens a large editing modal.

The modal must support:

- nested checklists
- infinite hierarchy
- inline editing
- auto-save
- collapsible structures
- color tagging
- contextual legends

## Checklist system

Checklist items support unlimited nesting.

Examples:

- 1
- 1.1
- 1.1.1
- 1.1.1.1

No artificial nesting limits.

## Color system

Checklist rows may receive color tags.

Colors are:

- global
- reusable
- user-defined

Inside the day modal:

- users can manage colors
- legend must always be visible
- changes should update instantly

## Goals

Separate module from daily tasks.

Categories:

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

Keep domain-specific commands, labels, persistence calls, and business rules inside feature modules. Shared components under `src/components/app` and shared hooks under `src/hooks` should not know whether they are editing daily checklist items, goal steps, categories, or another entity type.

When checklist and goals share tree behavior, prefer adapter-based hooks/components over copy-paste:

- shared row layout, action groups, selection controls, collapse controls, and category chips
- shared keyboard behavior for Enter, Tab, Backspace, and toggle shortcuts
- shared bulk selection, delete, and category assignment behavior
- feature-specific callbacks for create, update, delete, reorder, toggle, and persistence actions

Do not extract an abstraction only because code looks similar. Extract when:

- the behavior is truly the same across at least two surfaces
- a change would otherwise need to be made in multiple files
- the abstraction can stay smaller and clearer than the duplicated code
- tests can cover the shared behavior

## State Management

Prefer:

- React state
- Context only when truly needed
- local component state
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

The UI should feel like:

- Linear
- Notion
- modern productivity apps

But still maintain its own identity.

## PWA Requirements

The app must support:

- installability
- offline mode
- caching
- mobile responsiveness
- app-like experience
- Android usability

Important:

The project is deployed as a web PWA and is not managed as a Play Store application.

## Localization and Timezone

The app supports two languages:

- Brazilian Portuguese (`pt-BR`)
- English (`en`)

The default language should be inferred from the user's current browser/region when possible.

Users must be able to switch language manually.

The selected language/region also affects the timezone used to identify the current day:

- `pt-BR` uses the Brazil profile with `UTC-03:00` / `America/Sao_Paulo`
- `en` uses the browser-detected timezone when available

Never calculate daily calendar dates from raw UTC date slicing. Use app timezone-aware helpers for today, daily entries, calendar boundaries, and goal due-date display.

Language and timezone preferences are small UI preferences. They may use localStorage for guest mode, but application entities must remain in IndexedDB.

## Performance

Prioritize:

- instant interactions
- low re-rendering
- virtualization when necessary
- smooth animations
- responsive mobile experience

Avoid unnecessary API calls.

## Backend Philosophy

Backend should remain extremely thin.

Responsibilities:

- authentication
- synchronization
- persistent storage
- ownership validation

Most interaction logic should remain frontend-driven.

Allowlist access is enforced both in frontend auth checks and Supabase RLS. Changes to allowlist, RLS policies, or auth activation must include automated coverage for allowed users, inactive/missing allowlist rows, query errors, and local fallback for unauthorized users.

## Code Style

Prefer:

- explicit naming
- strong typing
- direct implementations
- readable structures

Avoid:

- comments
- unnecessary abstractions
- complex patterns
- enterprise architecture patterns

Code should be self-explanatory through structure and naming.

## Development Commands

The project includes a Makefile as a thin wrapper around npm scripts.

Useful commands:

- `make install`
- `make dev`
- `make build`
- `make lint`
- `make typecheck`
- `make format`
- `make format-check`
- `make test`
- `make test-e2e`
- `make check`
- `make clean`

Do not add Laravel, PHP, Laradock, Docker, Vite, MySQL, or unrelated backend commands to the Makefile. Keep it aligned with the Next.js PWA workflow.

## Development Workflow Requirements

When changing code, always add or update relevant automated tests in the same work slice.

Use the smallest test level that covers the risk:

- unit tests for pure logic, time helpers, tree derivation, sorting, and mappers
- integration tests for Dexie commands, persistence behavior, scope isolation, sync queues, mocked sync engine behavior, allowlist checks, auth isolation, and local-first flows
- Playwright tests for critical user flows and regressions that require real browser behavior

Playwright is configured for desktop Chromium and mobile Chrome local-mode smoke coverage. It starts Next.js on `127.0.0.1:3100`, uses `NEXT_PUBLIC_TICK_DISABLE_SUPABASE=1` for local-only flows, and writes artifacts under `.next/playwright-*` so `next dev` does not watch generated traces/videos/screenshots and enter Fast Refresh loops. Keep new Playwright artifacts out of watched project folders such as `test-results/`.

Before finishing code changes, run the applicable checks. Prefer `make check` or `npm run check` for complete verification when the change is not purely documentation-only.

For every completed change:

- report which verification commands were run
- update `README.md` when user-visible behavior, setup, deployment, authentication, persistence, commands, or architecture changes
- update `.github/copilot-instructions.md` when project rules, architectural decisions, persistence boundaries, workflow requirements, or UX principles change
- keep documentation focused on current behavior and verified project rules

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
