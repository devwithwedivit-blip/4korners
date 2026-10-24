/**
 * 4 Korners Performance & Lifecycle Fixes
 * - Eliminates intro logo flicker via deterministic postMessage handshake
 * - Automatically pauses 320,000-particle logo Three.js rAF loop during scroll, when off-screen, or inside projects
 * - Enforces manual scroll restoration and instant route change scrolling
 * - Optimizes all images with async decoding and fetchpriority
 */
(function() {
  // 1. Manual scroll restoration to prevent native scroll collision with GSAP
  if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
  }

  const docEl = document.documentElement;

  function getLogoIframe() {
    return document.querySelector('iframe.site-intro-3d-iframe') ||
           document.querySelector('iframe[src*="WITHOUT"]');
  }

  // 2. Deterministic Intro Logo Handshake
  function markLogoReady() {
    docEl.classList.add('logo-ready');
    const ifr = getLogoIframe();
    if (ifr) ifr.classList.add('logo-ready');
  }

  window.addEventListener('message', function(e) {
    if (e.data && e.data.type === '4KORNERS_LOGO_READY') {
      markLogoReady();
    }
  });

  // Safety fallback in case iframe fails to load or postMessage is blocked
  setTimeout(markLogoReady, 2500);

  // 3. Iframe Pause / Resume Controller
  function sendToIframe(type) {
    const ifr = getLogoIframe();
    if (ifr && ifr.contentWindow) {
      try {
        ifr.contentWindow.postMessage({ type: type }, '*');
      } catch (err) {}
    }
  }

  let introIntersecting = true;
  let isScrolling = false;
  let scrollTimer = null;

  function updateLogoActivity() {
    const isProject = !!document.querySelector('.project-page');
    const isHidden = document.visibilityState === 'hidden';

    if (isProject || isHidden || !introIntersecting || isScrolling) {
      sendToIframe('PAUSE_LOGO');
    } else {
      sendToIframe('RESUME_LOGO');
    }
  }

  // Pause heavy particle simulation during active scrolling to free CPU & GPU
  window.addEventListener('scroll', function() {
    if (!isScrolling) {
      isScrolling = true;
      updateLogoActivity();
    }
    if (scrollTimer) clearTimeout(scrollTimer);
    scrollTimer = setTimeout(function() {
      isScrolling = false;
      updateLogoActivity();
    }, 150);
  }, { passive: true });

  // Observe intro section visibility
  let introObserver = null;
  let currentObservedSection = null;

  function setupIntroObserver() {
    const introSection = document.querySelector('.site-intro-section');
    if (!introSection) return;
    if (introSection === currentObservedSection) return;

    if (introObserver) {
      try { introObserver.disconnect(); } catch (e) {}
    }
    currentObservedSection = introSection;

    introObserver = new IntersectionObserver(function(entries) {
      for (let i = 0; i < entries.length; i++) {
        introIntersecting = entries[i].isIntersecting;
      }
      updateLogoActivity();
    }, { threshold: 0.05 });

    introObserver.observe(introSection);
  }

  document.addEventListener('visibilitychange', updateLogoActivity);

  // 4. Project Page Lifecycle & Image Optimization
  function optimizeImages() {
    const imgs = document.querySelectorAll('img');
    for (let i = 0; i < imgs.length; i++) {
      const img = imgs[i];
      if (!img.decoding) img.decoding = 'async';
      if (img.closest && img.closest('.project-page')) {
        if (i === 0) {
          img.fetchPriority = 'high';
        } else {
          img.loading = 'lazy';
        }
        if (!img.style.aspectRatio && img.naturalWidth && img.naturalHeight) {
          img.style.aspectRatio = `${img.naturalWidth} / ${img.naturalHeight}`;
        }
      }
    }
  }

  // 5. Route Change Observer
  let lastPath = location.pathname;
  function onRouteChange() {
    const currentPath = location.pathname;
    if (currentPath !== lastPath) {
      lastPath = currentPath;
      window.scrollTo(0, 0);
    }
    updateLogoActivity();
    setupIntroObserver();
    optimizeImages();
  }

  // Intercept pushState & replaceState for immediate reaction
  const origPushState = history.pushState;
  if (typeof origPushState === 'function') {
    history.pushState = function() {
      const res = origPushState.apply(this, arguments);
      onRouteChange();
      return res;
    };
  }

  const origReplaceState = history.replaceState;
  if (typeof origReplaceState === 'function') {
    history.replaceState = function() {
      const res = origReplaceState.apply(this, arguments);
      onRouteChange();
      return res;
    };
  }

  // Observe DOM modifications to detect route transitions in SPA
  let mutationScheduled = false;
  const routeObserver = new MutationObserver(function() {
    if (mutationScheduled) return;
    mutationScheduled = true;
    requestAnimationFrame(function() {
      mutationScheduled = false;
      onRouteChange();
    });
  });

  function initObserver() {
    if (document.body) {
      routeObserver.observe(document.body, { childList: true, subtree: true });
      setupIntroObserver();
      optimizeImages();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initObserver);
  } else {
    initObserver();
  }

  window.addEventListener('popstate', onRouteChange);
})();
