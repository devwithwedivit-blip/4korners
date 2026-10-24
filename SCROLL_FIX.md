# SCROLL_FIX: Option A Transition Lock Cleanup

## Summary
Fixed portfolio slider hang when returning from any project page via "← Projects" or browser Back by clearing stale hero transition lock variables (`nn`, `Lt`, `rs`, `Cn`) on Project unmount.

---

## 1. Edit in `assets/index-D88q76o1.js` (and `www.mathildedechiara.com/assets/index-D88q76o1.js`)

### Function: `Yp` (exported as `k`)
#### Before
```javascript
function Yp(){if(nn=null,Cn=null,!Lt){Vs();return}const t=Lt,e=or;Lt=null,or=null,y.delayedCall(.15,()=>{t&&t.parentNode&&t.parentNode.removeChild(t),e&&e.parentNode&&e.parentNode.removeChild(e),Vs()}),$n.forEach(n=>{n&&n.parentNode&&n.parentNode.removeChild(n)}),$n=[]}
```

#### After
```javascript
function Yp(){const t=Lt||document.querySelector(".hero-transition-overlay");if(t&&y.isTweening(t)){y.getTweensOf(t).forEach(e=>{const n=e.vars.onComplete;e.vars.onComplete=()=>{n&&n(),vo()}});return}vo()}
```

### Rationale
- `Yp` was already exported as `k` from `index-D88q76o1.js`, but was never invoked.
- Safely checks if a transition tween is currently active on `.hero-transition-overlay`. If active, queues `vo()` on tween completion so the lock is not cleared while a transition animation is actually running; otherwise executes `vo()` immediately.
- `vo()` resets all hero transition state flags (`nn = null`, `Lt = null`, `rs = !1`, `un = null`, `Cn = null`), ensuring `hasPendingHeroMorph` (`mn()`) returns `false` and unlocks the slider canvas event listeners.

---

## 2. Edit in `assets/Project-DkLyUwCA.js` (and `www.mathildedechiara.com/assets/Project-DkLyUwCA.js`)

### A. Import Helper (Line 4)
#### Before
```javascript
import {
  h as hasPendingHeroMorph,
  H as heroMorphEvent,
```
#### After
```javascript
import {
  h as hasPendingHeroMorph,
  k as cleanupHeroMorph,
  H as heroMorphEvent,
```

### B. Component Unmount Cleanup Hook (Lines 260–265)
#### Before
```javascript
    return () => {
      clearTimeout(timer);
      clearTimeout(timer2);
    };
  }, [slug]);
```
#### After
```javascript
    return () => {
      clearTimeout(timer);
      clearTimeout(timer2);
      cleanupHeroMorph();
    };
  }, [slug]);
```

### Rationale
- Invoking `cleanupHeroMorph()` strictly inside the `Project` component unmount cleanup callback ensures the interaction lock is reliably cleared when navigating back to home via either "← Projects" or browser Back.
- Keeping `cleanupHeroMorph()` on unmount (rather than inside `handleBack` prior to `navigateTo`) preserves the transition route branching in `Th()`, avoiding premature state resets.
