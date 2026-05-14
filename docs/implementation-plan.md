# Tick Remaining Implementation Plan

Tick is an offline-first personal productivity PWA for daily task tracking and goals management. This document is now a living plan for what still needs to be implemented after the first foundation and calendar/editor slices.

## Current Status

Implemented and no longer part of the future backlog:

- Next.js App Router scaffold with TypeScript, Tailwind CSS, ESLint, Prettier, Serwist PWA base, manifest, offline route, and Makefile npm wrappers.
- Runtime/test dependencies for Dexie, Supabase client, Lucide icons, Vitest, Testing Library, Playwright, jsdom, and fake IndexedDB.
- Domain contracts for app scope, daily entries, checklist items, color tags, goals, goal steps, sync outbox items, sync cursors, locale preferences, and sync metadata.
- App scope helpers for `guest:<installationId>` and `user:<supabaseUserId>`.
- Local ID generation, sort-rank helpers, and timezone-aware local date helpers.
- Lightweight i18n for `en` and `pt-BR`, browser locale detection, language switcher, and Brazil timezone policy for `pt-BR`.
- Dexie database schema for `dailyEntries`, `checklistItems`, `colorTags`, `goals`, `goalSteps`, `syncOutbox`, `syncCursors`, and `localPreferences`.
- Guest scope initialization, local installation id, locale/timezone preferences, and default color tag seed.
- Home route as an app launcher, not a marketing page.
- Monthly calendar with seven-column grid, month navigation, today/selected states, daily summary previews, and URL-backed day selection.
- Day editor modal/sheet surface opened through `/calendar?day=YYYY-MM-DD`.
- Local-first daily entry and checklist commands for lazy day creation, item creation, child creation, inline text edit, checked state, collapse/expand, indent, outdent, soft delete, and daily summary recalculation.
- Visible checklist tree derivation from the flat IndexedDB model.
- Basic checklist inline UI with debounce autosave, keyboard handling, touch-friendly row actions, and no save button.
- Basic color legend and color tag assignment/management for checklist rows.
- Initial unit/integration tests for dates, sort ranks, database bootstrap, checklist tree derivation, checklist commands, and color cleanup.
- Initial Supabase schema migration for Google-authenticated usage, including `account_access` allowlist, RLS policies, profiles, daily entries, checklist items, category tags, goals, and goal steps.
- Auth-aware app entry flow with Google login, explicit local demo mode, unauthorized-account state, account status controls, and route gating.

## Decisions To Preserve

- IndexedDB via Dexie remains the runtime source of truth for guest and authenticated local cache.
- Supabase is only for authenticated persistence, auth, RLS, and sync.
- Guest data must never be uploaded automatically.
- All entity mutations should go through local command functions, not direct UI table writes.
- `localStorage` is allowed only for tiny UI preferences such as language/theme flags; entities stay in IndexedDB.
- Daily identity must use app timezone helpers, never UTC string slicing.
- The app remains personal, offline-first, mobile-first, and app-like. Avoid dashboard, SaaS, collaboration, billing, and marketing patterns.

## Remaining Work

### 1. Finish Color System

Status: partially implemented.

Remaining tasks:

- Polish the color assignment interaction so it behaves well on mobile and closes predictably when focus leaves the menu.
- Improve color legend layout as a sticky side panel on desktop and compact bottom/drawer surface on mobile.
- Add component or integration tests for assigning, renaming, recoloring, deleting, and reordering color tags.

### 2. Refine Day Editor And Checklist UX

Status: usable MVP implemented.

Remaining tasks:

- Improve focus management: restore focus to the originating day cell, focus the newly created row, and support Escape behavior inside row inputs without fighting the dialog close behavior.
- Add ArrowUp/ArrowDown keyboard navigation between checklist rows.
- Improve Backspace-on-empty behavior to move focus to a nearby row after delete.
- Add move up/down or drag/reorder controls using sort ranks.
- Add a compact contextual row menu so less common row actions do not overcrowd the row on desktop.
- Add better mobile-safe indentation and spacing for deep nesting.
- Add Playwright coverage for open/close editor, create/edit/check/delete row, and nested checklist behavior.

### 3. Build Goals Local-First

Status: route stub only.

Tasks:

- Replace the current goals route stub with a client feature module in `src/features/goals`.
- Add category tabs or segmented control for `short`, `medium`, and `long` goals.
- Add local-first commands for create, update, archive, soft delete, manual progress, goal steps, and step toggling.
- Add goal list rows with inline editing and autosave.
- Support manual progress and step-derived progress.
- Format due dates with the active locale/timezone helpers.
- Keep goals visually separate from daily checklist data and avoid analytics/dashboard styling.
- Add unit tests for goal progress and integration tests for goal commands.

### 4. PWA And App Shell Polish

Status: Serwist base exists; app shell affordances still missing.

Tasks:

- Add `useNetworkStatus` and an `OfflineBadge`.
- Add `useInstallPrompt` and a subtle install prompt.
- Add update-available prompt for a new service worker version.
- Validate reload behavior for `/`, `/calendar`, `/goals`, and `/~offline`.
- Check Android standalone layout, safe areas, viewport behavior, and virtual keyboard behavior in the day editor.

### 5. Supabase Schema And Authentication

Status: partially implemented.

Implemented:

- Supabase browser client and Google login helper.
- Login-only app access model through `account_access` allowlist.
- RLS policies that block application tables for non-allowed users.
- App provider scope switching for authenticated, local demo, and unauthorized states.
- Entry UI copy that explains the private prototype, allowlist-only login, and local demo behavior.

Tasks:

- Configure Supabase Google OAuth in the hosted project.
- Apply the migrations to Supabase production.
- Generate database types from the live Supabase schema.
- Add integration tests for allowlist access, user-scope writes, and local demo isolation.
- Tighten logout/cache behavior after the first production auth pass.

### 6. Sync Engine

Status: initial push/pull implementation added; production hardening still needed.

Implemented:

- User-scope writes queue outbox items; guest/local demo writes remain local-only.
- Basic push/pull sync mappers for category tags, daily entries, checklist items, goals, and goal steps.
- App provider sync scheduling on startup, online, focus, and foreground interval.

Tasks:

- Validate sync against the real Supabase project.
- Replace full-table pull with incremental pull using `SyncCursor` when data volume justifies it.
- Harden conflict handling using `remoteRevision` and `clientUpdatedAt`.
- Add `SyncStatusIndicator` states: `offline`, `synced`, `syncing`, `pending`, and `needs attention`.
- Add integration tests confirming guest writes never create upload outbox and authenticated writes do.

### 7. Accessibility, Performance, And E2E Coverage

Status: basic keyboard/focus behavior exists; deeper coverage still missing.

Tasks:

- Add component tests for day editor, checklist row behavior, color legend, and goals.
- Add Playwright tests for home navigation, calendar navigation, day editor open/close, checklist editing, nested checklist, color assignment, goals flow, locale switch, and offline reload.
- Validate focus trap, focus restoration, Escape, browser back, and screen-reader labels.
- Respect `prefers-reduced-motion` for future transitions.
- Watch render hotspots in large checklists and introduce virtualization only when needed.

## Recommended Next Order

1. Finish color system polish and tests.
2. Refine checklist focus/keyboard/reorder behavior.
3. Implement local-first Goals.
4. Add PWA app shell polish.
5. Add Supabase schema/auth.
6. Add sync engine.
7. Expand E2E and mobile/offline verification.

## Verification Commands

Run after every slice:

```bash
npm run format
npm run typecheck
npm run lint
npm run test
npm run build
```

Before considering the local guest MVP complete, run `npm run check` and a browser pass through:

- Home navigation.
- Calendar month navigation.
- Day editor open/close via URL state.
- Checklist create/edit/toggle/nest/delete.
- Color tag assign/edit/delete.
- Goals create/progress/archive.
- Locale switch between `en` and `pt-BR`.
- Offline reload after the app shell has been cached.
