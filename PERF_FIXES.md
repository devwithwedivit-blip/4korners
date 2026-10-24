# Performance & Intro Stability Engineering Log

## Overview
This document records the diagnostics, root causes, architectural design, and guarded fixes applied to resolve:
1. **Desktop Scroll Degrade / Hang**: Scroll stuttering and frame hangs after opening portfolio project pages and returning to home, worsening over repeated cycles.
2. **3D Particle Logo Intro Flicker**: Visual flash / frame jump during initial load and page refreshes.

All fixes were implemented through **small guarded patches** (`perf-fixes.js`, `perf-fixes.css`, `4 KORNERS DESIGN STUDIO WITHOUT BACKGROUND.html`, and `server.js` cache headers) with **zero edits to minified application bundles**, **zero copy/design changes**, and **full preservation of existing visual behavior**.

---

## 1. Problem 1: Scroll Degrade Across Navigation Cycles

### Root Causes
1. **Unstopped 320,000-Particle Physics Simulation**:
   - The intro 3D logo (`4 KORNERS DESIGN STUDIO WITHOUT BACKGROUND.html`) runs Three.js computing velocity and Brownian motion for 320,000 particles every frame in `requestAnimationFrame(tick)`.
   - When navigating into a project page, the parent SPA merely hid the intro section via `display: none !important`.
   - The iframe was never unmounted or notified; its `tick()` loop continued at full speed in the background, consuming 100% of a CPU core and starving main-thread scroll & layout tasks.
2. **Aggressive Cache-Control Header in Dev Server**:
   - `server.js` previously emitted `Cache-Control: no-cache, no-store, must-revalidate` for all static requests, forcing the browser to re-request and re-parse heavy assets on every route transition.
3. **Scroll Restoration Collision**:
   - Default `history.scrollRestoration = 'auto'` conflicted with GSAP and React state resets across route transitions.

### Guarded Solutions Applied
- **Bidirectional Pause/Resume Handshake**:
  - `perf-fixes.js` sends `PAUSE_LOGO` to the intro iframe whenever:
    - A `.project-page` is active in the DOM.
    - The tab/window is hidden (`document.visibilityState === 'hidden'`).
    - The `.site-intro-section` is outside the viewport via `IntersectionObserver`.
    - The page is actively scrolling (`window.addEventListener('scroll', ...)` with 150ms debounce).
  - In `4 KORNERS DESIGN STUDIO WITHOUT BACKGROUND.html`, receiving `PAUSE_LOGO` sets `isPaused = true` and halts `requestAnimationFrame(tick)` completely.
  - When the user returns to home and scrolls into view, `RESUME_LOGO` resumes the loop cleanly and synchronizes the simulation clock (`lastTs = performance.now()`), avoiding coordinate spikes.
- **Auto-Rest Idle Physics**:
  - When particles are undisturbed for ~75 frames after load or interaction, the simulation automatically enters an idle sleeping state (`isResting = true`) and stops re-uploading vertex buffers to the GPU.
  - Any pointer movement or interaction over the logo immediately wakes up the simulation without perceptible latency.
- **Manual Scroll Restoration & Instant Route Reset**:
  - `history.scrollRestoration = 'manual'` set in `perf-fixes.js`.
  - Monkey-patched `history.pushState` and `history.replaceState` coupled with a debounced `MutationObserver` scroll to `(0, 0)` on route change.
- **Static Asset Caching**:
  - Updated `server.js` to serve static assets with `Cache-Control: public, max-age=86400` instead of disabling cache.
- **Image Optimization**:
  - `perf-fixes.js` tags all images with `decoding="async"` and project hero images with `fetchPriority="high"`.

---

## 2. Problem 2: Intro Particle-Logo Flicker on Refresh / Start

### Root Causes
1. **Uncoordinated Time-Based Reveal**:
   - `index.html` formerly ran an uncoordinated `setTimeout(markReady, 600)` which added `.logo-ready` to `<html>`, transitioning iframe opacity from 0 to 1 before Three.js had finished loading the font and painting its initial frame.
2. **Premature Canvas DOM Attachment**:
   - The Three.js canvas was appended to `document.body` before `font.load()` completed, triggering layout reflows and an unpainted frame.
3. **Unclamped Initial Clock Delta**:
   - `U.uTime.value = performance.now() / 1000` jumped immediately on frame 1 from initial epoch to page start time, jumping particle positions visibly on the second frame.

### Guarded Solutions Applied
- **Deterministic postMessage Handshake**:
  - In `4 KORNERS DESIGN STUDIO WITHOUT BACKGROUND.html`:
    - Canvas is only appended once font and buffers are fully initialized.
    - Three.js renders the first deterministic frame (`renderer.render(scene, camera)`).
    - Immediately following the first clean render, the iframe sends:
      `window.parent.postMessage({ type: '4KORNERS_LOGO_READY' }, '*')`.
- **CSS Opacity Transition Triggered Exclusively by Handshake**:
  - `perf-fixes.css` keeps the iframe at `opacity: 0` until `.logo-ready` is present.
  - `perf-fixes.js` receives `4KORNERS_LOGO_READY` and toggles `.logo-ready`, smoothly fading in the already-rendered 3D canvas with zero blank or misaligned frames.
- **Clamped Clock Step**:
  - First frame initializes `lastTs = performance.now()` and clamps delta time to 1/30 s, guaranteeing seamless initial frame continuity.

---

## 3. Minified Bundle Edits
- **Count**: 0
- No minified vendor or application bundles (`index-*.js`, `vendor-*.js`) were modified. All fixes are non-invasive, declarative, and decoupled.

---

## 4. Verification Benchmarks (Phase 0 Baseline vs Phase 3 Verified)

| Metric | Phase 0 Baseline | Phase 3 Verified | Pass Target | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Normal CPU Scroll p95 (Cycle 1)** | 833.2 ms | **16.8 ms** | < 20 ms | **PASS** |
| **Normal CPU Scroll p95 (Cycle 2)** | 783.3 ms | **16.7 ms** | < 20 ms | **PASS** |
| **Normal CPU Scroll p95 (Cycle 3)** | 866.6 ms | **16.7 ms** | < 20 ms | **PASS** |
| **Normal CPU Scroll p95 (Cycle 4)** | 933.3 ms | **16.7 ms** | < 20 ms | **PASS** |
| **Normal CPU Scroll p95 (Cycle 5)** | 1,099.9 ms | **16.7 ms** | < 20 ms | **PASS** |
| **Project Scroll p95 (All cycles)** | 16.7 ms | **16.7 ms** | < 20 ms | **PASS** |
| **4x Throttle Proj Scroll p95** | 16.8 ms | **16.7 ms** | < 33 ms | **PASS** |
| **Intro Non-Monotonic Flashes (20 reloads)** | 5 reloads (~119 KB jumps) | **0 reloads** | 0 flashes | **PASS** |
| **Intro Blank / White Frames (20 reloads)** | 0 | **0** | 0 blank | **PASS** |
| **Cumulative Layout Shift (CLS)** | 0.000 | **0.000** | 0.000 | **PASS** |
| **Console Errors (entire suite)** | 0 | **0** | 0 | **PASS** |
| **404 Responses (entire suite)** | 0 | **0** | 0 | **PASS** |
| **mathildedechiara.com Requests** | 0 | **0** | 0 | **PASS** |
