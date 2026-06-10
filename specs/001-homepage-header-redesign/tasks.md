---
description: "Task list for Homepage Header Redesign"
---

# Tasks: Homepage Header Redesign

**Input**: Design documents from `/specs/001-homepage-header-redesign/`
**Prerequisites**: plan.md (required), spec.md (required)

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)

---

## Phase 1: Setup

**Purpose**: Project initialization and basic structure (None required for this frontend-only change).

- [x] T001 Verify existing `hero.css` and `index.html` structure

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure changes.

- [x] T002 Modify HTML structure in `index.html` to support full-width banner (remove old square container wrappers if any)

---

## Phase 3: User Story 1 - Visual Header Refresh (Priority: P1) 🎯 MVP

**Goal**: Redesign hero/header section to a full-width cinematic banner (21:9 aspect ratio) with glassmorphism overlays.

### Implementation for User Story 1

- [x] T003 [US1] Update `hero.css` to remove 300x300 fixed width/height constraints
- [x] T004 [US1] Update `hero.css` to apply 21:9 aspect ratio and full-width styling
- [x] T005 [US1] Restyle "Chef Book" H1 title and gradient overlay in `hero.css`
- [x] T006 [US1] Reposition "Featured Chef" badge to top-left inside the image in `hero.css`

---

## Phase 4: User Story 2 - Responsive Header Behavior (Priority: P1)

**Goal**: Header adapts gracefully on mobile (≤992px) to 16:9 aspect ratio.

### Implementation for User Story 2

- [x] T007 [US2] Add media queries (max-width: 992px) in `hero.css` to switch aspect ratio to 16:9
- [x] T008 [US2] Adjust title, badge, and padding for mobile viewports in `hero.css`

---

## Phase 5: User Story 3 - Image Zoom & Refresh Retained (Priority: P2)

**Goal**: Retain click-to-zoom and hover-to-refresh interactions.

### Implementation for User Story 3

- [x] T009 [US3] Verify or adjust `index.html` classes to ensure existing zoom/refresh JS hooks in `main.js` still function correctly with the new layout
- [x] T010 [US3] Update hover styles for the refresh button in `hero.css` to align with the new cinematic layout

---

## Phase 6: User Story 4 - RTL Language Support (Priority: P2)

**Goal**: Ensure right-to-left layout mirroring for Arabic/RTL users.

### Implementation for User Story 4

- [x] T011 [US4] Add `.rtl` overrides in `hero.css` to mirror badge position, title alignment, and background gradients

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [x] T012 Verify smooth entrance animations (60fps) in `hero.css`
- [x] T013 Cross-browser testing (Chrome, Safari, Firefox) for flex/aspect-ratio support
- [x] T014 [P] Implement image `onerror` fallback or default placeholder in `index.html` (Edge Case)
- [x] T015 [P] Add `max-width` limit for ultrawide monitors (>2400px) in `hero.css` (Edge Case)

---

## Dependencies & Execution Order

- **Setup & Foundational**: Run T001 and T002 first.
- **US1 & US2**: Run sequentially (T003-T008) as they both modify `hero.css`.
- **US3 & US4**: Can run after US1/US2.
