# Tick Implementation Plan

Tick is an offline-first personal productivity PWA for daily task tracking and goals management. It is not a SaaS product, not a collaboration tool, and not a dashboard. The core product should feel closer to a native Android productivity app than a traditional website: fast, minimal, fluid, and low friction.

This document is the implementation plan for the first full build. It intentionally stays at the architecture and execution level. No application code is included here.

## 1. Product Principles

The first version should be guided by a small set of hard rules:

1. The app must be usable as soon as it opens, including in guest mode.
2. User interactions must write locally first.
3. Network access must enhance the experience, not gate it.
4. Guest data must never be uploaded to Supabase.
5. Authenticated user data should sync with Supabase, but the UI should still run from local data.
6. The root route is an app home screen, not a landing page.
7. The interface should avoid dashboard clutter, marketing sections, excessive cards, excessive buttons, and unnecessary confirmations.
8. Editing should be inline, autosaved, keyboard-friendly, and touch-friendly.
9. The codebase should stay simple, explicit, and feature-oriented.
10. Avoid heavy abstractions until the product has a real need for them.

## 2. Recommended Folder Architecture

Use a feature-first structure with a small shared domain layer. The app should be easy to navigate without creating a large enterprise architecture.

```text
tick/
  docs/
    implementation-plan.md
  public/
    icons/
    screenshots/
  src/
    app/
      layout.tsx
      page.tsx
      manifest.ts
      calendar/
        page.tsx
      goals/
        page.tsx
      auth/
        page.tsx
    components/
      app/
      ui/
    features/
      auth/
      calendar/
      checklist/
      colors/
      day-editor/
      goals/
    hooks/
    lib/
      db/
      domain/
      pwa/
      supabase/
      sync/
    styles/
  supabase/
    migrations/
  tests/
    e2e/
    integration/
    unit/
```

### Route folders

`src/app` should contain only route-level composition, layouts, metadata, and app-shell integration.

- `src/app/page.tsx`: Home screen with navigation to Daily Calendar and Goals only.
- `src/app/calendar/page.tsx`: Monthly calendar route.
- `src/app/goals/page.tsx`: Goals route.
- `src/app/auth/page.tsx`: Optional thin auth route when authentication UI is introduced.
- `src/app/manifest.ts`: PWA manifest metadata if using the App Router manifest file.

### Feature folders

Each feature folder should own its UI, hooks, and small helpers that are not shared by other features.

- `features/calendar`: month navigation, calendar grid, day cells, day previews.
- `features/day-editor`: large editor modal/sheet for a selected day.
- `features/checklist`: recursive checklist rendering and commands.
- `features/colors`: global color tags, color legend, color manager.
- `features/goals`: goal lists, goal progress, category organization.
- `features/auth`: auth UI, session affordances, account switching surfaces.

### Shared folders

- `components/ui`: generic primitives such as buttons, inputs, dialogs, sheets, popovers, tooltips, tabs, progress, and color swatches.
- `components/app`: app shell pieces such as navigation, offline badge, sync indicator, install prompt, and update prompt.
- `lib/db`: Dexie schema, migrations, local repositories, local transactions.
- `lib/domain`: shared domain types, date utilities, id utilities, sort-rank utilities.
- `lib/supabase`: Supabase clients and generated database types.
- `lib/sync`: outbox, sync scheduler, push/pull engine, conflict helpers, mappers.
- `lib/pwa`: service worker registration, install prompt handling, network status helpers.
- `hooks`: cross-feature hooks only. Feature-specific hooks should stay inside feature folders.

## 3. Recommended Application Architecture

Tick should use IndexedDB as the operational source of truth for the runtime app. This applies to both guest and authenticated sessions.

The main architecture is:

1. UI reads local data from Dexie.
2. UI writes through local command functions.
3. Local command functions update IndexedDB transactionally.
4. Authenticated writes create sync outbox entries.
5. Guest writes do not create upload outbox entries.
6. Sync runs in the background when an authenticated session and network are available.
7. Supabase stores authenticated cloud data and enforces ownership through RLS.

### Source of truth

IndexedDB should be the source of truth for active UI state and persisted app data.

Supabase should be treated as:

- Cloud durability for authenticated users.
- Cross-device sync storage.
- Authentication provider.
- Ownership validation layer through Row Level Security.

Supabase should not be treated as the live dependency for normal editing.

### Client and server split

Next.js should be used for routing, build tooling, app shell delivery, metadata, PWA behavior, and optional auth pages. Core productivity interactions should be client components because they rely on local-first IndexedDB behavior.

Avoid building a large API layer in v1. Direct Supabase client calls protected by RLS are enough for authenticated sync. Next route handlers can be added later only for operations that genuinely need trusted server logic.

### Local commands

Every entity mutation should go through a command function, not directly through arbitrary UI code.

Command functions should:

1. Validate the current app scope.
2. Run a Dexie transaction.
3. Update the affected local entity or entities.
4. Update denormalized summaries when needed.
5. Add an outbox item only for authenticated scopes.
6. Return immediately enough for the UI to remain fluid.

Examples of commands:

- Create or open a daily entry.
- Create checklist item.
- Edit checklist item text.
- Toggle checklist item completion.
- Indent or outdent checklist item.
- Collapse or expand checklist item.
- Assign color tag to checklist item.
- Create or update color tag.
- Create goal.
- Update goal progress.
- Archive goal.

## 4. Application Flow

### First launch

1. App shell loads.
2. App creates or retrieves a local installation id.
3. App creates or opens a guest scope.
4. Default local color tags are seeded if needed.
5. Home appears immediately.
6. Auth session hydration may happen in the background.

### Home flow

The root route `/` is a minimal app launcher.

It should contain only:

- Navigation to Daily Calendar.
- Navigation to Goals.
- Optional subtle account/sync/install affordances.

It should not contain:

- Marketing copy.
- Hero sections.
- Analytics dashboard cards.
- Activity feeds.
- Collaboration prompts.

### Daily Calendar flow

1. Calendar route loads the current month.
2. Month summaries are read from IndexedDB.
3. Calendar renders a standard 7-column grid.
4. Each day cell shows lightweight content preview.
5. Desktop double click opens day editor.
6. Mobile tap opens day editor.
7. Month navigation updates local UI immediately.

### Day editor flow

1. Opening a day sets URL state, for example a query param.
2. The app creates the daily entry lazily if it does not exist.
3. The editor opens as a large desktop dialog or full-screen mobile sheet.
4. Checklist data for that day loads from IndexedDB.
5. Edits write locally and autosave.
6. The color legend stays visible.
7. Closing restores focus to the originating day cell.

### Goals flow

1. Goals route loads goal summaries from IndexedDB.
2. User can switch between short-term, medium-term, and long-term categories.
3. Goals support inline editing and progress tracking.
4. Goal changes write locally first.
5. Authenticated scopes sync in the background.

## 5. Data Modeling Strategy

Use local-first domain models with explicit sync metadata. Every persisted application entity should have a local `scopeId`.

### AppScope

`AppScope` is a local concept that identifies the current data boundary.

Recommended values:

- `guest:<installationId>`
- `user:<supabaseUserId>`

All local data queries should be scoped by `scopeId`. Guest and authenticated data must never mix accidentally.

### DailyEntry

Represents one calendar day.

Recommended fields:

- `id`
- `scopeId`
- `date`, stored as `YYYY-MM-DD`
- `timezone`
- `title`, optional
- `note`, optional
- `previewText`
- `itemCount`
- `completedCount`
- `colorTagIds`, derived summary for day cell accents
- `createdAt`
- `updatedAt`
- `deletedAt`
- `syncStatus`
- `remoteRevision`
- `clientUpdatedAt`

The date should be a local date string, not a UTC timestamp. This avoids shifting calendar days across timezones.

### ChecklistItem

Represents one row in a daily checklist tree.

Recommended fields:

- `id`
- `scopeId`
- `dailyEntryId`
- `parentId`, nullable
- `text`
- `checked`
- `collapsed`
- `colorTagId`, nullable
- `sortRank`
- `createdAt`
- `updatedAt`
- `deletedAt`
- `syncStatus`
- `remoteRevision`
- `clientUpdatedAt`

Checklist items should be stored as a flat adjacency list. Do not store a deeply nested JSON blob as the primary model.

### ColorTag

Represents a reusable global color label.

Recommended fields:

- `id`
- `scopeId`
- `name`
- `hex`
- `position`
- `createdAt`
- `updatedAt`
- `deletedAt`
- `syncStatus`
- `remoteRevision`
- `clientUpdatedAt`

Color tags are global within a scope and reusable across daily checklist items and, optionally, goals.

### Goal

Represents a separate personal goal.

Recommended fields:

- `id`
- `scopeId`
- `category`, one of `short`, `medium`, `long`
- `title`
- `description`, optional
- `status`, for example `active`, `paused`, `completed`, `archived`
- `progressMode`, for example `manual` or `steps`
- `progressValue`, 0 to 100 for manual progress
- `dueDate`, optional local date string
- `colorTagId`, optional
- `sortRank`
- `createdAt`
- `updatedAt`
- `archivedAt`
- `deletedAt`
- `syncStatus`
- `remoteRevision`
- `clientUpdatedAt`

### GoalStep

Represents a goal subtask or milestone.

Recommended fields:

- `id`
- `scopeId`
- `goalId`
- `text`
- `completed`
- `sortRank`
- `createdAt`
- `updatedAt`
- `deletedAt`
- `syncStatus`
- `remoteRevision`
- `clientUpdatedAt`

Goal steps can be flat in v1. They do not need the same infinite nesting model as daily checklists unless the product later demands it.

### SyncOutboxItem

Represents a pending authenticated sync operation.

Recommended fields:

- `id`
- `scopeId`
- `entityType`
- `entityId`
- `operation`, for example `upsert` or `delete`
- `payload`
- `changedFields`
- `baseRevision`
- `createdAt`
- `attempts`
- `lastAttemptAt`
- `lastError`
- `status`, for example `pending`, `syncing`, `failed`, `synced`

Guest mode should not create upload outbox items.

### SyncCursor

Represents the latest successful pull state per table.

Recommended fields:

- `id`
- `scopeId`
- `entityType`
- `lastPulledAt`
- `lastRemoteRevision`
- `updatedAt`

## 6. IndexedDB Structure

Use Dexie for the local database. Create migrations from the start, even in the first version.

Recommended tables:

| Table              | Purpose                                     | Important indexes                                                                |
| ------------------ | ------------------------------------------- | -------------------------------------------------------------------------------- |
| `dailyEntries`     | Calendar day summaries and metadata         | `scopeId`, `[scopeId+date]`, `[scopeId+updatedAt]`                               |
| `checklistItems`   | Flat recursive checklist rows               | `scopeId`, `[scopeId+dailyEntryId]`, `[scopeId+parentId]`, `[scopeId+updatedAt]` |
| `colorTags`        | Reusable global colors                      | `scopeId`, `[scopeId+position]`, `[scopeId+updatedAt]`                           |
| `goals`            | Goal entities                               | `scopeId`, `[scopeId+category]`, `[scopeId+status]`, `[scopeId+updatedAt]`       |
| `goalSteps`        | Goal steps                                  | `scopeId`, `[scopeId+goalId]`, `[scopeId+updatedAt]`                             |
| `syncOutbox`       | Pending authenticated sync operations       | `scopeId`, `[scopeId+status]`, `[scopeId+createdAt]`                             |
| `syncCursors`      | Pull cursors                                | `scopeId`, `[scopeId+entityType]`                                                |
| `localPreferences` | Tiny structured local preferences if needed | `key`                                                                            |

### IndexedDB rules

1. Every app entity table must include `scopeId`.
2. Structured application data must not be stored in localStorage.
3. Guest data and authenticated cache can live in the same Dexie database only if repository guards enforce scope isolation.
4. Use transactions for operations that affect multiple records.
5. Checklist updates should update daily entry summaries in the same transaction.
6. Soft deletes should be used for syncable entities.
7. Physical cleanup can be added later after sync safety is proven.

### Denormalized daily summaries

The monthly calendar should not load every checklist item for every visible day. Store lightweight summary fields on `DailyEntry`:

- `previewText`
- `itemCount`
- `completedCount`
- `colorTagIds`

These fields should be recalculated or incrementally updated when checklist items change.

## 7. Supabase Schema Strategy

Supabase should mirror authenticated entities and enforce ownership. It should not store guest data.

Recommended tables:

- `profiles`
- `daily_entries`
- `checklist_items`
- `color_tags`
- `goals`
- `goal_steps`

### Shared columns

Every syncable Supabase table should include:

- `id uuid primary key`
- `user_id uuid not null references auth.users(id)`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`
- `deleted_at timestamptz null`
- `client_updated_at timestamptz not null`
- `revision bigint not null`

### Table strategy

`daily_entries`:

- Unique constraint on `(user_id, date)`.
- Store local date string and timezone.
- Store summary fields used by the calendar.

`checklist_items`:

- Reference `daily_entries(id)`.
- Include `parent_id` for recursive structure.
- Include `sort_rank` for ordering.
- Include `color_tag_id` as nullable reference.

`color_tags`:

- Store user-defined reusable colors.
- Include `position` for legend order.

`goals`:

- Store category, status, progress mode, progress value, and optional due date.
- Include `sort_rank` for ordering.

`goal_steps`:

- Reference `goals(id)`.
- Include `sort_rank` for ordering.

### RLS rules

Enable Row Level Security on every authenticated data table.

Policies should allow users to select, insert, update, and soft-delete only rows where:

```text
user_id = auth.uid()
```

Anonymous users should not be able to access application data tables.

### Supabase triggers

Use triggers only for simple mechanical fields:

- Set `updated_at`.
- Increment `revision`.

Avoid business logic triggers in v1. Business behavior should stay mostly frontend-driven and local-first.

## 8. Synchronization Architecture

Synchronization should be simple, idempotent, and non-blocking.

### Core sync rules

1. Authenticated writes always happen locally first.
2. Authenticated writes create outbox entries.
3. Guest writes never create upload outbox entries.
4. Sync should never block normal editing.
5. Sync failures should be visible but not disruptive.
6. Supabase data should be pulled into IndexedDB, then rendered from IndexedDB.

### Sync triggers

Run sync on:

- App startup.
- Supabase session availability.
- Browser online event.
- Tab visibility or focus.
- Foreground interval while the app is open.
- Optional Background Sync when supported.

`navigator.onLine` should be treated only as a hint. Failed requests are the real signal.

### Push flow

1. Read pending outbox items for the authenticated scope.
2. Order by entity dependency and creation time.
3. Batch compatible operations when possible.
4. Upsert changed rows to Supabase.
5. Set `deleted_at` for deletes.
6. Mark successful outbox items as synced.
7. Retain failed items with retry metadata.

Dependency order should generally be:

1. `color_tags`
2. `daily_entries`
3. `checklist_items`
4. `goals`
5. `goal_steps`

### Pull flow

1. Read the current sync cursor for each entity type.
2. Fetch rows changed since the cursor.
3. Include rows with `deleted_at` so tombstones are applied locally.
4. Merge remote rows into IndexedDB in a transaction.
5. Update cursor after successful local application.

### Conflict strategy

Because Tick is personal and not collaborative, keep conflict behavior pragmatic.

Use:

- Local UUIDs for all entities.
- `remoteRevision` to detect stale local updates.
- `clientUpdatedAt` to compare edits.
- Field-level merge for non-overlapping changes when practical.
- Last client update wins for overlapping simple fields.

Avoid building a complicated conflict UI in v1. Persistent sync failures can be shown through a small "needs attention" sync state.

### Service worker and sync

The service worker should not be the primary data sync engine. Browser background APIs vary too much. The foreground app sync engine should be reliable on its own.

The service worker can support:

- Offline app shell.
- Static asset caching.
- Optional Background Sync hints.
- Update availability prompt.

## 9. Guest vs Authenticated Flows

### Guest mode

Guest mode should be immediate and complete enough to use the core product.

Guest data rules:

1. Store guest data only in IndexedDB.
2. Never send guest data to Supabase.
3. Never automatically migrate guest data on sign-in.
4. Keep guest data available after logout.
5. Seed default local color tags for a new guest scope.

### Authenticated mode

Authenticated mode should use the same local-first UI model.

Authenticated data rules:

1. Store a local IndexedDB cache under `user:<supabaseUserId>`.
2. Write to local cache first.
3. Queue outbox items for Supabase sync.
4. Pull remote changes into local cache.
5. Keep working offline when an existing session is present.

### Sign-in behavior

On sign-in:

1. Establish the Supabase session.
2. Switch app scope from guest to authenticated user scope.
3. Open or initialize the authenticated local cache.
4. Start pull sync in the background.
5. Do not upload guest data.

### Logout behavior

On logout:

1. Stop authenticated sync.
2. Check for unsynced authenticated outbox items.
3. If unsynced data exists, require a clear user choice before discarding local authenticated cache.
4. Return to guest scope.
5. Preserve guest data.

## 10. State Management Approach

Use the lightest state model that supports the app well.

### Persistent state

Persistent app data should live in IndexedDB and be accessed through Dexie-backed hooks.

### Ephemeral UI state

Use React local state for:

- Active edit text.
- Focused checklist row.
- Open menus and popovers.
- Selected day.
- Drag or reorder state.
- Temporary validation state.
- Modal or sheet UI state.

### Contexts

Use small React contexts only where they reduce real friction:

- `AppScopeProvider`
- `SessionProvider`
- `ThemeProvider`
- `NetworkStatusProvider`
- `SyncStatusProvider`

Avoid a heavy global state manager in v1.

### Local subscriptions

Use Dexie live queries, or a thin wrapper around them, for reactive local data.

Suggested pattern:

- Read hooks return local data and loading/error state.
- Command hooks return mutation functions.
- UI components consume both but do not know about Supabase.

## 11. Recursive Checklist Architecture

The checklist system is one of the core experiences. It must support unlimited nesting.

### Persistence model

Persist checklist items flat:

```text
ChecklistItem
  id
  dailyEntryId
  parentId
  sortRank
```

This allows efficient updates, simple sync, and no artificial depth limit.

### Rendering model

For the selected day:

1. Load all non-deleted checklist items for the day.
2. Group items by `parentId`.
3. Sort siblings by `sortRank`.
4. Build a visible tree or flattened visible row list.
5. Render rows with depth metadata.

A flattened visible row list is usually easier for keyboard navigation and future virtualization.

### Supported commands

Core checklist commands:

- Create sibling.
- Create child.
- Edit text inline.
- Toggle checked state.
- Collapse or expand item.
- Assign color tag.
- Remove item through soft delete.
- Indent item.
- Outdent item.
- Move item up or down.
- Reorder within a parent.

### Keyboard behavior

Recommended baseline:

- `Enter`: create sibling below.
- `Tab`: indent item.
- `Shift+Tab`: outdent item.
- `Ctrl+Enter` or `Cmd+Enter`: toggle checked state.
- `Backspace` on empty row: remove row or merge with previous row.
- Arrow keys: move row focus.
- `Escape`: leave edit mode or close active menu.

### Touch behavior

Recommended baseline:

- Large checkbox touch target.
- Easy row focus without precision taps.
- Contextual row menu for less common actions.
- Color picker optimized for touch.
- Mobile-safe indentation and row spacing.

### Visual hierarchy

Use indentation based on depth, but avoid letting deep nesting destroy mobile layout.

Recommended approach:

- Use a CSS variable for depth.
- Clamp visual indentation on small screens.
- Preserve logical depth even when visual indentation is capped.
- Show hierarchy subtly through spacing, connector hints, or compact numbering only if useful.

### Performance

1. Keep all updates id-based.
2. Avoid deep cloning entire recursive structures.
3. Memoize visible row derivation.
4. Use stable callbacks for rows.
5. Add virtualization later only if large expanded checklists require it.

## 12. Color Tagging System

Color tags are global, reusable, user-defined labels within a scope.

### Requirements

1. Users can create, rename, recolor, reorder, and delete color tags.
2. Checklist rows can reference a color tag.
3. The day editor always shows a color legend.
4. Color changes update instantly across visible checklist rows.
5. Color should never be the only meaning. Names must be shown in legends and menus.

### Persistence

Store color tags in IndexedDB for all scopes and Supabase for authenticated scopes.

Checklist items should reference `colorTagId` rather than storing copied color values.

### Deletion behavior

When a color tag is deleted:

1. Soft-delete the color tag.
2. Either clear references from checklist items or keep the tag as a tombstoned reference until sync settles.
3. Prefer clearing references locally for a simpler v1 user experience.

### UI behavior

Inside the day editor:

- Desktop: sticky side legend.
- Mobile: sticky bottom strip or compact drawer.
- Color management should happen inline through popovers or expandable legend controls.
- Avoid a separate full-screen color settings page in v1.

## 13. Modal Architecture

The day editor should be a primary work surface, not a small secondary dialog.

### Desktop

- Double click on a day cell opens the editor.
- Use a large centered dialog or near full-height panel.
- Keep the checklist area spacious.
- Keep the legend visible.

### Mobile

- Tap on a day cell opens the editor.
- Use a full-screen sheet.
- Respect safe-area insets.
- Keep important actions near thumb-friendly zones.
- Keep the color legend reachable while editing.

### URL state

Represent the open editor in URL state, for example:

```text
/calendar?day=2026-05-13
```

This allows:

- Browser back to close the editor.
- Refresh to restore the editor.
- Better mobile navigation behavior.

### Accessibility behavior

The editor should:

- Trap focus while open.
- Restore focus to the originating day cell on close.
- Support Escape to close on desktop.
- Use a clear accessible label.
- Avoid nested modals.
- Use popovers or menus for smaller contextual actions.

## 14. PWA Strategy

The PWA is the mobile application. The initial product is not targeting Google Play distribution.

### Manifest

Include:

- App name and short name.
- Standalone display mode.
- Theme color and background color.
- Portrait-friendly orientation behavior.
- Maskable icons.
- Screenshots for install surfaces.
- Start URL.

### Service worker

Use a maintained service worker strategy compatible with Next.js App Router, such as Serwist or Workbox-based integration.

The service worker should support:

- Offline app shell.
- Static asset precaching.
- Runtime asset caching.
- Offline fallback.
- Update prompt.

### Cache strategy

Recommended caching:

- App shell: precache.
- Static assets: stale-while-revalidate.
- Fonts and icons: cache-first with versioning.
- Supabase API responses: do not use as app data cache.
- Application entities: IndexedDB only.

### Install UX

The install prompt should be subtle and dismissible. It should not interrupt task entry.

Recommended surfaces:

- Small app-shell prompt.
- Settings/account area prompt.
- Optional home screen hint after repeated use.

## 15. Offline-First Strategy

Offline behavior is not an enhancement. It is a core requirement.

### Offline rules

1. Every normal user action must work offline.
2. Loading app data should read IndexedDB first.
3. Network failures should not erase or block local changes.
4. Sync errors should be retried automatically.
5. Users should see compact sync status, not blocking error modals.
6. Offline reload should still open the app shell and local data.

### Loading states

Use minimal loading states.

Good loading behavior:

- Initial skeleton only when IndexedDB is still opening.
- Empty states for days/goals with no local data.
- Small sync indicator for background network work.

Avoid:

- Full-page spinners for normal local data.
- Blocking loaders while syncing.
- Disabling editing because the network is unavailable.

### Sync status UI

Use a compact status model:

- `offline`
- `synced`
- `syncing`
- `pending`
- `needs attention`

The status should be visible but quiet.

## 16. Suggested Component Structure

### App components

- `AppShell`
- `MobileNav`
- `SyncStatusIndicator`
- `OfflineBadge`
- `InstallPrompt`
- `UpdateAvailablePrompt`

### Home components

- `HomeLauncher`
- `HomeNavItem`

The home screen should feel like an app launcher, not a web landing page.

### Calendar components

- `CalendarPage`
- `MonthHeader`
- `MonthGrid`
- `WeekdayHeader`
- `DayCell`
- `DayPreview`
- `MonthSwipeContainer`, optional after core behavior is stable

### Day editor components

- `DayEditorModal`
- `DayEditorSheet`
- `DayEditorHeader`
- `ChecklistSurface`
- `ChecklistTree`
- `ChecklistRow`
- `ChecklistInlineInput`
- `ChecklistRowMenu`

### Color components

- `ColorLegend`
- `ColorSwatch`
- `ColorTagEditor`
- `ColorTagPopover`
- `ColorAssignmentMenu`

### Goals components

- `GoalsPage`
- `GoalCategoryTabs`
- `GoalList`
- `GoalRow`
- `GoalProgressControl`
- `GoalStepList`
- `GoalFilters`

### UI primitives

- `IconButton`
- `TextButton`
- `InlineEditable`
- `Checkbox`
- `Dialog`
- `Sheet`
- `Popover`
- `DropdownMenu`
- `Tooltip`
- `Progress`
- `SegmentedControl`
- `Tabs`
- `ColorSwatch`

## 17. Suggested Hooks Structure

### App hooks

- `useAppScope`: current guest/auth scope and scope switching.
- `useSession`: Supabase session state.
- `useNetworkStatus`: online/offline hint and request health.
- `useSyncStatus`: pending count, syncing state, failed count.
- `useInstallPrompt`: PWA install prompt state.

### Calendar hooks

- `useMonthEntries(month)`: daily summaries for visible month.
- `useDayEntry(date)`: selected day entry, with lazy creation support.
- `useCalendarNavigation`: current month, next/previous/today behavior.

### Checklist hooks

- `useChecklistTree(dayEntryId)`: visible checklist tree rows.
- `useChecklistCommands(dayEntryId)`: local-first checklist mutations.
- `useChecklistKeyboardNavigation`: row focus and keyboard commands.
- `useAutoSaveText`: debounced text persistence with flush behavior.

### Color hooks

- `useColorTags`: read global color tags for current scope.
- `useColorCommands`: create, update, reorder, delete color tags.

### Goals hooks

- `useGoals(category, filter)`: read goals for current scope.
- `useGoalCommands`: local-first goal mutations.
- `useGoalProgress`: derived progress for manual and step-based goals.

## 18. UI and Interaction Guidelines

### General UI direction

- Modern, premium, minimal.
- Native-app feeling over webpage feeling.
- Dense enough to be productive, but not dashboard-heavy.
- Calm visual hierarchy.
- Subtle shadows and transitions.
- No excessive decorative elements.

### Controls

Prefer:

- Icon buttons for common actions.
- Tooltips for unfamiliar icons.
- Inline editable text.
- Popovers for contextual controls.
- Segmented controls or tabs for goal categories.
- Color swatches with labels.
- Sliders, steppers, or direct inputs for numeric progress.

Avoid:

- Permanent buttons for every row action.
- Save buttons for normal edits.
- Confirmation dialogs for ordinary changes.
- Nested cards.
- Marketing-style sections.

### Calendar UX

- The monthly grid should be large and central.
- Day cells should preview real content.
- Current day should be visually clear.
- Selected or open day should be visually clear.
- Empty days should not feel broken or noisy.
- Mobile layout should remain usable on narrow screens.

### Checklist UX

- Rows should feel editable in place.
- Checkbox, text, collapse affordance, and color tag should be easy to scan.
- Less common actions should live in contextual menus.
- Creating the next item should be frictionless.
- Deep nesting should remain readable.

### Goals UX

- Goals should be separate from daily tasks.
- Categories should be easy to switch.
- Progress should be visible but not overdesigned.
- The page should not become an analytics dashboard.

## 19. Performance Considerations

### Calendar performance

The calendar should use daily summaries only. It should not load full checklist trees for all visible days.

Use:

- Month-range IndexedDB query.
- Denormalized previews.
- Memoized day cells.
- Stable month grid layout.

### Checklist performance

Use:

- Flat persistence.
- Visible row derivation.
- Stable row ids.
- Memoized rows.
- Id-based updates.

Avoid:

- Rebuilding unrelated days.
- Deep cloning full recursive structures.
- Syncing every keystroke directly to the network.

### Sync performance

- Batch writes when possible.
- Pull by cursor.
- Back off failed retries.
- Keep foreground sync lightweight.
- Avoid blocking route transitions on sync.

### Bundle performance

- Keep feature components colocated.
- Lazy-load heavy editor pieces if the calendar bundle grows too large.
- Avoid adding large state or UI libraries without a clear reason.

## 20. Mobile-First Considerations

The Android PWA experience is first-class.

### Layout

- Use responsive app surfaces, not desktop-first pages squeezed down.
- Use full-screen day editor on mobile.
- Respect safe-area insets.
- Avoid tiny controls.
- Keep common controls near thumb-friendly zones.

### Interaction

- Tap opens day editor on mobile.
- Do not rely on hover.
- Use touch-friendly row menus.
- Keep checkbox targets large.
- Handle virtual keyboard resizing.
- Preserve focused checklist row while typing.

### PWA shell

- Use standalone display mode.
- Ensure status bar color feels integrated.
- Test home-screen launch.
- Test offline launch.
- Test app update behavior.

## 21. Accessibility Considerations

Accessibility should be included from the beginning because the app relies heavily on custom interactions.

### Calendar

- Use semantic structure where practical.
- Provide clear labels for days.
- Support keyboard focus across days.
- Indicate today and selected day without relying on color only.

### Day editor

- Dialog or sheet must have a label.
- Focus must be trapped while open.
- Focus must be restored on close.
- Escape should close on desktop.
- Browser back should close when URL state is used.

### Checklist

- Checkboxes need accessible names.
- Nested rows should expose enough context.
- Keyboard creation, editing, toggling, indenting, and navigation should work.
- Color tags need text labels.

### Motion and contrast

- Respect `prefers-reduced-motion`.
- Ensure contrast for text, subtle controls, selected day states, tag labels, and progress indicators.
- Do not use color as the only meaning.

## 22. Future Scalability Considerations

Build for simplicity first, but leave clean paths for later growth.

Potential future features:

- Recurring daily items.
- Templates.
- Search.
- Local export and import.
- Optional encrypted backup.
- Richer goal metrics.
- Attachments.
- Calendar history insights.

Keep out of scope:

- Collaboration.
- Team workspaces.
- Billing.
- Admin dashboards.
- SaaS analytics.
- Play Store packaging for the initial release.

### Schema evolution

- Version Dexie migrations from day one.
- Version Supabase migrations from day one.
- Keep domain mappers explicit.
- Avoid leaking database column names throughout UI components.

### Sync evolution

The sync engine can be generic enough to support multiple entity types, but avoid building a complex framework. A small typed registry for entity mappers and table names is enough for v1.

## 23. Recommended Development Order

### Phase 1: Project scaffold

1. Create Next.js App Router project with TypeScript.
2. Add Tailwind CSS.
3. Add ESLint and formatting conventions.
4. Use `src/` directory and import alias.
5. Add base route skeletons.
6. Add initial app shell and global styles.

### Phase 2: Domain and local persistence

1. Define domain types.
2. Define app scope model.
3. Add id utilities.
4. Add local date utilities.
5. Add sort-rank utilities.
6. Add Dexie schema and migrations.
7. Add local repositories.
8. Add local command functions.

### Phase 3: Local tests

1. Test date utilities.
2. Test sort-rank utilities.
3. Test checklist tree derivation.
4. Test repository transactions.
5. Test daily summary updates.
6. Test guest scope isolation.

### Phase 4: Home

1. Build minimal Home route.
2. Add navigation to Calendar and Goals.
3. Add subtle app shell affordances.
4. Avoid marketing layout.

### Phase 5: Calendar

1. Build month navigation.
2. Build standard 7-column grid.
3. Render day cells.
4. Render daily previews from local summaries.
5. Add responsive layout.
6. Add desktop double-click and mobile tap behavior.

### Phase 6: Day editor and checklist

1. Add URL-backed open day state.
2. Build desktop dialog and mobile sheet.
3. Lazy-create daily entries.
4. Render checklist tree.
5. Add inline editing.
6. Add checklist commands.
7. Add keyboard behavior.
8. Add touch-friendly row actions.
9. Add collapse and expand.

### Phase 7: Color system

1. Seed default color tags per scope.
2. Add color legend.
3. Add color assignment to checklist rows.
4. Add inline color management.
5. Ensure instant local updates.

### Phase 8: Goals

1. Build Goals route.
2. Add category tabs or segmented control.
3. Add goal list and inline editing.
4. Add manual progress tracking.
5. Add step-based progress tracking.
6. Add filters for active, completed, archived if needed.

### Phase 9: PWA

1. Add manifest.
2. Add app icons and maskable icons.
3. Add service worker integration.
4. Add app shell precaching.
5. Add offline fallback.
6. Add install prompt handling.
7. Add update prompt handling.

### Phase 10: Supabase

1. Add Supabase project configuration.
2. Add SQL migrations.
3. Add RLS policies.
4. Add generated TypeScript database types.
5. Add Supabase clients.
6. Add auth session handling.

### Phase 11: Sync

1. Add outbox creation for authenticated local writes.
2. Add sync scheduler.
3. Add push flow.
4. Add pull flow.
5. Add cursors.
6. Add tombstone handling.
7. Add basic conflict handling.
8. Add sync status UI.
9. Verify guest data never uploads.

### Phase 12: Polish and verification

1. Polish mobile layout.
2. Polish keyboard interactions.
3. Polish accessibility.
4. Optimize render hotspots.
5. Run Lighthouse PWA checks.
6. Run offline reload tests.
7. Run Android standalone tests.

## 24. Verification Plan

### Static checks

- TypeScript typecheck.
- ESLint.
- Production build.

### Unit tests

- Date handling.
- Sort-rank generation.
- Checklist tree building.
- Checklist command behavior.
- Daily summary updates.
- Goal progress calculations.
- Sync conflict helpers.

### Integration tests

- Dexie repositories with fake IndexedDB.
- Guest scope isolation.
- Authenticated scope isolation.
- Outbox creation for authenticated writes.
- No outbox creation for guest writes.

### Supabase tests

- RLS blocks anonymous access.
- RLS blocks access to other users' rows.
- Authenticated user can access only owned rows.
- Soft deletes sync correctly.

### Playwright tests

- Home navigation.
- Calendar month navigation.
- Day editor open and close.
- Checklist item creation and editing.
- Nested checklist behavior.
- Color tag assignment.
- Color legend editing.
- Goal creation and progress update.
- Mobile day editor behavior.
- Offline guest editing and reload.
- Authenticated offline edit and later sync.

### PWA tests

- Lighthouse installability.
- Offline app shell load.
- Offline data persistence.
- Update prompt behavior.
- Android standalone launch.
- Virtual keyboard behavior inside day editor.

## 25. Acceptance Criteria

The first full implementation is acceptable when:

1. Guest users can use Home, Calendar, Day Editor, Checklist, Colors, and Goals entirely offline.
2. Guest data is stored only in IndexedDB.
3. No guest data is sent to Supabase.
4. Authenticated users can write locally while offline.
5. Authenticated changes sync to Supabase when online.
6. Calendar month view remains fast and uses daily summaries.
7. Checklist nesting has no artificial limit.
8. Day editor works well as a desktop modal and mobile full-screen sheet.
9. Color legend remains visible in the day editor.
10. Goals are separate from daily checklist data.
11. The PWA can be installed and launched on Android.
12. The app shell loads offline after installation or initial cache.
13. The UI avoids marketing, dashboard, and enterprise patterns.
14. Core editing uses autosave and local-first persistence.
15. Typecheck, lint, build, and core tests pass.

## 26. Key Decisions to Preserve

- IndexedDB is the runtime source of truth for all modes.
- Supabase is only for authenticated persistence, auth, RLS, and sync.
- Guest data is local-only and must never be uploaded automatically.
- No heavy client state manager in v1.
- No collaboration features.
- No SaaS/admin dashboard concepts.
- No save buttons for normal editing.
- No marketing landing page at `/`.
- Mobile Android PWA behavior is first-class.
- Simplicity is preferred over premature scalability.
