# Copilot Instructions

Tick is an offline-first personal productivity PWA focused on daily task tracking and goals management.

The application must feel closer to a native mobile app than a traditional website.

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

### Guest users

Local-only persistence:

- IndexedDB via Dexie

Guest data must NEVER be sent to the backend.

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

Goals should support progress tracking and structured organization.

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

The project is NOT intended for Play Store publishing initially.

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

## Important UX Rules

- auto-save whenever possible
- avoid save buttons
- avoid confirmation dialogs
- interactions should feel immediate
- editing should be frictionless
- mobile UX is first-class
- desktop UX should still feel excellent

## Future mindset

Build for simplicity first.

Avoid:

- overengineering
- premature scaling
- unnecessary infrastructure
- unnecessary backend complexity

The project is primarily a personal productivity tool.
