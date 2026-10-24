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

---

## 3. Edit in `assets/index-D88q76o1.js` (and `www.mathildedechiara.com/assets/index-D88q76o1.js`): Portfolio Gallery Filter Spacing Fix

### Summary
Fixed the post-filter gallery spacing bug where clicking any category filter caused the gap between project images to jump from 48px to ~136px–143px due to shrunken handoff slides (`0.35 * viewport.height`) being rendered against slider center-to-center spacing (`0.507 * viewport.height`).

### Changes:
#### A. Category Filter Transition Component `sh` (Line 287)
- **Before:** `Ni=.35,eh=.04,`
- **After:** `Ni=.35*1.3,eh=.04*1.3,`
- **Rationale:** Scales filter transition slide dimensions (`Z`, `fe`) and spacing (`de`) by 1.3 to match slider scaling (`Xt = .35 * 1.3`, `kr = .04 * 1.3`).

#### B. Slider Component `rd` Handoff Adoption (Line 165)
- **Before:**
  ```javascript
  if(le&&le.length>0)for(let b=0;b<Math.min(le.length,Q);b++){const $=le[b];$.mesh.setParent(Nt),L.push({...$,projectIndex:-1})}
  ```
- **After:**
  ```javascript
  if(le&&le.length>0)for(let b=0;b<Math.min(le.length,Q);b++){const $=le[b];$.mesh.scale.set(Ne,rt,1),$.program.uniforms.uMeshSize.value=[Ne,rt],$.width=Ne,$.height=rt,$.mesh.setParent(Nt),L.push({...$,width:Ne,height:rt,projectIndex:-1})}
  ```
- **Rationale:** Guarantees that regardless of transition handoff state, the slider meshes are reset to `[Ne, rt]` (`Xt * me.height`) and spaced at `De = (Xt + kr) * me.height`, ensuring the gap remains exactly ~48px without changing image dimensions.

#### C. Grid-to-Slider Transition `pd` & Intro `Qd` (Lines 228 & 287)
- **Before:**
  - Line 228: `dd=.04,hd=.03;...const s=.35*e.height,o=.35*e.height,i=dd*e.height`
  - Line 287: `ki=.35,Jd=.04,Zd=.04`
- **After:**
  - Line 228: `dd=.04*1.3,hd=.03;...const s=.35*1.3*e.height,o=.35*1.3*e.height,i=dd*e.height`
  - Line 287: `ki=.35*1.3,Jd=.04*1.3,Zd=.04*1.3`
- **Rationale:** Harmonizes intro and grid-to-slider transition dimensions with slider mesh scale.

