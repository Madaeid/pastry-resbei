# Research: Homepage Header Redesign

**Feature**: Homepage Header Redesign  
**Date**: 2026-05-02

## Research Questions

### RQ-1: Modern Hero/Header Design Patterns for Food & Chef Platforms

**Decision**: Adopt a **full-width cinematic banner** layout with a large background image, gradient overlay, and floating content elements (title + badge).

**Rationale**: Modern food and hospitality platforms (e.g., Bon Appétit, ChefSteps, MasterClass cooking sections) overwhelmingly use full-width hero imagery that creates visual immersion. This contrasts with Chef Book's current 300×300 constrained square, which underutilizes the viewport and feels dated.

**Alternatives considered**:
- **Split-screen (image | text)**: Considered but rejected — the current layout already lacks text content (no subtitle paragraph, no CTA buttons being actively used), making a 50/50 split feel empty.
- **Carousel/Slider**: Considered but rejected — auto-playing carousels are proven to have low engagement and add UX complexity. The existing refresh button already provides image rotation.
- **Video background**: Rejected — too heavy for a PWA targeting mobile, conflicts with performance goals.

### RQ-2: CSS-Only Implementation Approach (Vanilla-First Principle)

**Decision**: Implement using pure CSS3 with existing CSS custom properties. No new libraries required.

**Rationale**: Constitution Principle I (Vanilla-First Frontend) mandates no frameworks. The redesign involves only CSS layout and styling changes — well within vanilla CSS capabilities. Modern CSS features like `clamp()`, `object-fit`, `aspect-ratio`, and `backdrop-filter` are already used in the project.

**Alternatives considered**:
- **GSAP for animations**: Rejected — CSS animations and transitions are sufficient for entrance effects and hover states. Adding GSAP would require justification per Principle I.
- **CSS container queries**: Considered but unnecessary — standard media queries are already the pattern used throughout the project.

### RQ-3: HTML Structure Changes and JavaScript Impact

**Decision**: Minimal HTML restructuring. The `hero-image-wrapper` becomes the dominant container (full-width banner) rather than a child element inside `hero-content`. The badge and title overlay remain as positioned children.

**Rationale**: Keeping the HTML changes minimal reduces the risk of breaking the existing `main.js` zoom and refresh functionality. The image element ID (`heroChefImg`), badge, and refresh button stay in place — only their CSS styling and parent container dimensions change.

**Alternatives considered**:
- **Complete HTML rewrite of the hero section**: Rejected — too much risk of breaking JS event listeners and would require extensive testing for a purely visual change.
- **Using `<picture>` element with art direction**: Considered for responsive images but unnecessary since all hero images are large PNGs already; CSS `object-fit: cover` handles viewport adaptation.

### RQ-4: Responsive Breakpoint Strategy

**Decision**: Continue using the existing 992px breakpoint for mobile adaptation, matching the project's current responsive pattern.

**Rationale**: The project already uses `@media (max-width: 992px)` extensively in `hero.css`, `style.css`, and `sidebar.css`. Introducing a new breakpoint would create inconsistency.

**Alternatives considered**:
- **Adding a tablet breakpoint (768px)**: Considered but not needed for the first iteration. The full-width banner scales naturally between mobile and desktop.

### RQ-5: Image Aspect Ratio and Cropping Concerns

**Decision**: Use `aspect-ratio: 21/9` (ultrawide cinematic) for desktop and `aspect-ratio: 16/9` for mobile. This ensures consistent, predictable cropping regardless of viewport width.

**Rationale**: The existing hero images are portrait-oriented chef photos. A cinematic aspect ratio will crop to the top-center of each image, which typically shows the chef's face and key visual elements. Using `object-position: center top` ensures faces aren't cut off.

**Alternatives considered**:
- **Free-height (vh-based)**: Considered (`height: 40vh`) but viewport height units cause inconsistent results across devices, especially with mobile browser chrome.
- **Fixed pixel height**: Rejected — doesn't scale with viewport width, breaks responsiveness.
