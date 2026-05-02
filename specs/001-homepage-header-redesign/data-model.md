# Data Model: Homepage Header Redesign

**Feature**: Homepage Header Redesign  
**Date**: 2026-05-02

## Overview

This feature is a **frontend-only visual redesign**. No database schema changes are required. No new data entities are introduced. The existing data flow remains unchanged.

## Existing Entities (Unchanged)

### Hero Image Pool

- **Type**: Static file collection
- **Location**: `/public/` directory
- **Count**: 14 PNG images
- **Selection**: Random client-side selection on page load (inline `<script>` in `index.html`)
- **No database storage**: Image pool is hardcoded in the HTML

### Hero Section State

- **Zoom State**: Managed via CSS class toggle (`.zoomed`) on `.hero-image-wrapper`
- **Current Image**: Stored as `src` attribute on `#heroChefImg`
- **No persistent state**: Hero state is ephemeral per page load

## CSS Custom Properties (Design Tokens)

The following existing CSS custom properties are used by the hero section and remain unchanged:

| Property | Purpose |
|----------|---------|
| `--border-glow` | Border accent color |
| `--primary-gradient` | Gold-brown gradient |
| `--shadow-color` | Ambient shadow tint |
| `--text-secondary` | Secondary text color |
| `--accent-orange` | Accent highlight color |

No new CSS custom properties are required for this redesign.
