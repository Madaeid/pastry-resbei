# Quickstart: Homepage Header Redesign

**Feature**: Homepage Header Redesign  
**Date**: 2026-05-02

## Prerequisites

- Node.js 18+
- PostgreSQL 14+ (running and accessible)
- Project dependencies installed (`npm install` at project root)

## Development Setup

1. **Switch to feature branch**:
   ```bash
   git checkout 001-homepage-header-redesign
   ```

2. **Start the development server**:
   ```bash
   npm run dev
   ```
   This starts:
   - Vite dev server on port **5173**
   - Express API on port **3001**

3. **Open the app**:
   Navigate to `http://localhost:5173` in your browser. You must be logged in (the homepage redirects to `auth.html` if no session exists).

## Files to Modify

| File | Purpose |
|------|---------|
| `hero.css` | Primary file — all visual changes to the hero/header section |
| `index.html` (lines 201–238) | Hero section HTML — minimal structural adjustments |
| `main.js` | Only if HTML element IDs or class names change (zoom/refresh handlers) |

## Testing the Changes

1. **Visual verification**: Load the homepage and confirm the new header layout
2. **Image rotation**: Click the refresh button (🔄) — should cycle through hero images
3. **Image zoom**: Click the hero image — should expand to fullscreen overlay
4. **Mobile responsive**: Resize browser to ≤ 992px — layout should adapt
5. **RTL check**: Add `class="rtl"` to `<body>` — elements should mirror

## Key Design Decisions

- Full-width cinematic banner (21:9 desktop, 16:9 mobile)
- Glassmorphism aesthetic preserved (dark backgrounds, blur, golden accents)
- Existing CSS custom properties reused (no new tokens)
- No new JavaScript dependencies
