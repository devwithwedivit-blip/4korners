/**
 * 4 Korners Performance & Lifecycle Fixes
 * - Eliminates intro logo flicker via deterministic postMessage handshake
 * - Automatically pauses 320,000-particle logo Three.js rAF loop during scroll, when off-screen, or inside projects
 * - Enforces manual scroll restoration and instant route change scrolling
 * - Optimizes all images with async decoding and fetchpriority
 */
(function() {
  // 0. Guard React DOM unmounting against third-party DOM mutation (SplitType / GSAP / ScrollTrigger pin-spacers)
  if (typeof Node !== 'undefined' && Node.prototype) {
    const origRemoveChild = Node.prototype.removeChild;
    Node.prototype.removeChild = function(child) {
      if (child && child.parentNode !== this) {
        if (child.parentNode) {
          return child.parentNode.removeChild(child);
        }
        return child;
      }
      return origRemoveChild.apply(this, arguments);
    };

    const origInsertBefore = Node.prototype.insertBefore;
    Node.prototype.insertBefore = function(newNode, referenceNode) {
      if (referenceNode && referenceNode.parentNode !== this) {
        if (this && typeof this.appendChild === 'function') {
          return this.appendChild(newNode);
        }
        return newNode;
      }
      return origInsertBefore.apply(this, arguments);
    };
  }

  // 1. Manual scroll restoration to prevent native scroll collision with GSAP
  if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
  }

  const docEl = document.documentElement;

  function syncIntroSeenState() {
    try {
      if (sessionStorage.getItem('introSeen') === '1') {
        docEl.classList.add('intro-seen');
      }
    } catch (e) {}
  }
  syncIntroSeenState();

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
    const isAbout = !!document.querySelector('iframe[src*="about.html"]') || location.pathname.includes('/about');
    const isHidden = document.visibilityState === 'hidden';
    const isIntroSeen = docEl.classList.contains('intro-seen') || (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('introSeen') === '1');

    if (isProject || isAbout || isHidden || isIntroSeen || !introIntersecting || isScrolling) {
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
    const vh = window.innerHeight || 800;
    for (let i = 0; i < imgs.length; i++) {
      const img = imgs[i];
      if (!img.decoding) img.decoding = 'async';
      
      const rect = img.getBoundingClientRect();
      const isAboveFold = rect.top < vh && rect.bottom > 0;
      
      if (i === 0 || isAboveFold) {
        if (!img.loading) img.loading = 'eager';
      } else {
        if (!img.loading) img.loading = 'lazy';
      }
      
      if (!img.style.aspectRatio && img.naturalWidth && img.naturalHeight) {
        img.style.aspectRatio = `${img.naturalWidth} / ${img.naturalHeight}`;
      }
    }
  }

  // 5. Clean up animations & listeners on route change (GSAP, ScrollTrigger, Lenis)
  function cleanupRouteAnimations() {
    try {
      if (window.gsap) {
        window.gsap.killTweensOf('.project-page, .project-carousel-track, .page-content, .home-page__crosshair');
      }
      if (window.ScrollTrigger) {
        const triggers = window.ScrollTrigger.getAll();
        for (let i = 0; i < triggers.length; i++) {
          const st = triggers[i];
          if (!st.trigger || !document.contains(st.trigger)) {
            st.kill();
          }
        }
        window.ScrollTrigger.refresh();
      }
      if (window.lenis && typeof window.lenis.scrollTo === 'function') {
        window.lenis.scrollTo(0, { immediate: true });
      }
    } catch (err) {}
  }

  // 6. Graceful Error Boundary with Retry
  function setupErrorBoundary() {
    function showErrorNotice(err) {
      if (document.querySelector('.site-error-boundary-banner')) return;
      const banner = document.createElement('div');
      banner.className = 'site-error-boundary-banner';
      banner.setAttribute('role', 'alert');
      banner.innerHTML = '<div class="site-error-boundary-content"><p>Unable to load content. Please retry.</p><button type="button" class="site-error-boundary-retry-btn">Retry</button></div>';
      banner.querySelector('button').addEventListener('click', function() {
        banner.remove();
        location.reload();
      });
      document.body.appendChild(banner);
    }

    window.addEventListener('unhandledrejection', function(e) {
      if (e && e.reason) {
        const msg = String(e.reason.message || e.reason);
        if (msg.includes('Sanity query failed') || msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
          e.preventDefault();
          showErrorNotice(e.reason);
        }
      }
    });
  }

  // 7. Route Change Observer
  let lastPath = location.pathname;
  function onRouteChange() {
    const currentPath = location.pathname;
    syncIntroSeenState();
    if (currentPath !== lastPath) {
      lastPath = currentPath;
      window.scrollTo(0, 0);
      cleanupRouteAnimations();
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
      setupErrorBoundary();
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
