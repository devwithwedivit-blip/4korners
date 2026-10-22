import { r as React, j as jsxRuntime, b as useParams } from "./vendor-react-BfwrijtY.js";
import { g as gsap } from "./vendor-gsap-B0CNlIB4.js";
import {
  h as hasPendingHeroMorph,
  H as heroMorphEvent,
  d as fetchProject,
  r as gsapTweenOut,
  u as useTranslation,
  j as DiamondShape,
  l as splitParagraphs,
  c as formatUrl,
  a as useNavigateHelper,
  B as useProjects,
  F as appStorage,
  G as buildUrl,
  S as SeoComponent,
  E as ErrorComponent
} from "./index-D88q76o1.js";
import { u as useEscape, a as useProjectTitle, b as useProjectScroll, c as getSeoDescription, d as sanitizeSeoText } from "./useEscape-CtRLL5_-.js";
import { u as useHomeRestart } from "./useHomeRestart-D0SWgb2r.js";

const { jsx: _jsx, jsxs: _jsxs, Fragment: _Fragment } = jsxRuntime;
const { useState, useEffect, useRef, useMemo, useCallback } = React;

/* ==========================================================================
   Project Carousel for "Other Images" (Auto-playing, Drag/Swipe, Infinitely Looping)
   ========================================================================== */
function ProjectCarousel({ images, projectTitle }) {
  const [current, setCurrent] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const trackRef = useRef(null);
  const dragStartX = useRef(0);
  const isDragging = useRef(false);
  const dragDelta = useRef(0);
  const total = images.length;

  // Respect prefers-reduced-motion
  const prefersReducedMotion = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const goTo = useCallback((idx) => {
    setCurrent((idx + total) % total);
  }, [total]);

  const prev = useCallback(() => {
    goTo(current - 1);
  }, [current, goTo]);

  const next = useCallback(() => {
    goTo(current + 1);
  }, [current, goTo]);

  // Autoplay every 3.5 seconds (paused on hover/touch or if prefers-reduced-motion)
  useEffect(() => {
    if (total <= 1 || isPaused || prefersReducedMotion) return;
    const interval = setInterval(() => {
      setCurrent((c) => (c + 1) % total);
    }, 3500);
    return () => clearInterval(interval);
  }, [total, isPaused, prefersReducedMotion]);

  // Drag and swipe handling
  const handlePointerDown = (e) => {
    if (total <= 1) return;
    isDragging.current = true;
    dragStartX.current = e.clientX || (e.touches && e.touches[0].clientX) || 0;
    dragDelta.current = 0;
    setIsPaused(true);
  };

  const handlePointerMove = (e) => {
    if (!isDragging.current) return;
    const clientX = e.clientX || (e.touches && e.touches[0].clientX) || 0;
    dragDelta.current = clientX - dragStartX.current;
  };

  const handlePointerUp = () => {
    if (!isDragging.current) return;
    isDragging.current = false;
    setIsPaused(false);
    if (dragDelta.current > 40) {
      prev();
    } else if (dragDelta.current < -40) {
      next();
    }
    dragDelta.current = 0;
  };

  if (!images || images.length === 0) return null;

  return _jsxs("section", {
    className: "project-carousel-section",
    style: { width: "100%", maxWidth: "1180px", margin: "clamp(32px, 5vh, 60px) auto 0", boxSizing: "border-box" },
    "aria-label": "Other project images",
    onMouseEnter: () => setIsPaused(true),
    onMouseLeave: () => setIsPaused(false),
    onTouchStart: handlePointerDown,
    onTouchMove: handlePointerMove,
    onTouchEnd: handlePointerUp,
    onMouseDown: handlePointerDown,
    onMouseMove: handlePointerMove,
    onMouseUp: handlePointerUp,
    children: [
      _jsx("div", {
        className: "project-carousel-viewport",
        style: { position: "relative", width: "100%", overflow: "hidden", borderRadius: "2px" },
        children: _jsx("div", {
          ref: trackRef,
          className: "project-carousel-track",
          style: {
            display: "flex",
            width: "100%",
            willChange: "transform",
            transform: `translateX(-${current * 100}%)`,
            transition: prefersReducedMotion ? "none" : "transform 0.7s cubic-bezier(0.65, 0, 0.35, 1)"
          },
          children: images.map((img, idx) => {
            const url = img.url || (img.asset && img.asset.url) || (img.image && img.image.asset && img.image.asset.url) || "";
            const alt = (img.alt && (img.alt.en || img.alt)) || `${projectTitle} - photo ${idx + 1}`;
            return _jsx("div", {
              className: "project-carousel-slide",
              style: { flex: "0 0 100%", width: "100%", display: "flex", justifyContent: "center", alignItems: "center", boxSizing: "border-box" },
              "aria-hidden": idx !== current,
              children: _jsx("div", {
                className: "project-carousel-slide__img-wrap",
                style: { width: "100%", display: "flex", justifyContent: "center", alignItems: "center" },
                children: _jsx("img", {
                  src: url,
                  alt: alt,
                  loading: "lazy",
                  draggable: false,
                  className: "project-carousel-slide__img",
                  style: { width: "100%", height: "auto", maxHeight: "75vh", objectFit: "contain", display: "block", borderRadius: "2px", pointerEvents: "none", cursor: "default" }
                })
              })
            }, url || idx);
          })
        })
      }),
      total > 1 && _jsxs("div", {
        className: "project-carousel-controls",
        children: [
          _jsx("button", {
            type: "button",
            className: "project-carousel-arrow project-carousel-arrow--prev",
            onClick: (e) => { e.stopPropagation(); prev(); },
            "aria-label": "Previous image",
            children: _jsx("span", { children: "←" })
          }),
          _jsx("div", {
            className: "project-carousel-dots",
            children: images.map((_, dotIdx) => _jsx("button", {
              type: "button",
              className: `project-carousel-dot${dotIdx === current ? " project-carousel-dot--active" : ""}`,
              onClick: (e) => { e.stopPropagation(); goTo(dotIdx); },
              "aria-label": `Go to slide ${dotIdx + 1}`
            }, dotIdx))
          }),
          _jsx("button", {
            type: "button",
            className: "project-carousel-arrow project-carousel-arrow--next",
            onClick: (e) => { e.stopPropagation(); next(); },
            "aria-label": "Next image",
            children: _jsx("span", { children: "→" })
          })
        ]
      })
    ]
  });
}

/* ==========================================================================
   Main Project Page Component
   ========================================================================== */
function Project() {
  const { slug } = useParams();
  const { t: translate } = useTranslation(["project", "common"]);
  const { navigateTo, currentLang } = useNavigateHelper();
  const { projects, loading } = useProjects(currentLang);
  const { restart, homeHref } = useHomeRestart();

  // Find project in cached list or fetch dynamically
  const [projectData, setProjectData] = useState(null);
  const projectFromList = useMemo(() => {
    return projects.find((p) => p.slug === slug || p.slug?.en === slug || p.slug?.current === slug) || null;
  }, [projects, slug]);

  useEffect(() => {
    if (slug) {
      fetchProject(slug, currentLang)
        .then((data) => {
          if (data) setProjectData(data);
        })
        .catch(() => {});
    }
  }, [slug, currentLang]);

  const project = projectData || projectFromList;

  // Keep right-side menu hidden while project is open, set introSeen
  useEffect(() => {
    try { sessionStorage.setItem("introSeen", "1"); } catch (e) {}
    const hideRightMenu = () => {
      const f = document.querySelector(".home-page__filters");
      if (f) {
        f.style.setProperty("visibility", "hidden", "important");
        f.style.setProperty("opacity", "0", "important");
        f.style.setProperty("pointer-events", "none", "important");
      }
      const b = document.querySelector(".home-page__about");
      if (b) {
        b.style.setProperty("visibility", "hidden", "important");
        b.style.setProperty("opacity", "0", "important");
        b.style.setProperty("pointer-events", "none", "important");
      }
    };
    hideRightMenu();
    window.addEventListener("scroll", hideRightMenu, { passive: true });
    const interval = setInterval(hideRightMenu, 200);
    return () => {
      window.removeEventListener("scroll", hideRightMenu);
      clearInterval(interval);
      const f = document.querySelector(".home-page__filters");
      if (f) {
        f.style.removeProperty("visibility");
        f.style.removeProperty("opacity");
        f.style.removeProperty("pointer-events");
      }
      const b = document.querySelector(".home-page__about");
      if (b) {
        b.style.removeProperty("visibility");
        b.style.removeProperty("opacity");
        b.style.removeProperty("pointer-events");
      }
    };
  }, []);

  // Scoped scroll release strictly on project route
  useEffect(() => {
    try {
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
    } catch (e) {}
    window.scrollTo(0, 0);

    const cleanupTransitionElements = () => {
      try {
        document.querySelectorAll(".hero-transition-overlay, .hero-transition-backdrop, .hero-transition-neighbor").forEach((el) => {
          gsap.killTweensOf(el);
          if (el && el.parentNode) el.parentNode.removeChild(el);
        });
      } catch (e) {}
    };
    cleanupTransitionElements();

    const timer = setTimeout(cleanupTransitionElements, 100);
    const timer2 = setTimeout(cleanupTransitionElements, 300);
    return () => {
      clearTimeout(timer);
      clearTimeout(timer2);
    };
  }, [slug]);

  // Back button handler: full page load to slider with introTextSeen preserved
  const handleBack = useCallback(() => {
    if (slug) {
      appStorage.set("sliderSlug", slug);
    }
    navigateTo("home");
  }, [navigateTo, slug]);

  // Back button state
  const [navHover, setNavHover] = useState(false);
  const diamondRef = useRef(null);

  // Keyboard Escape back handler
  useEscape(handleBack);

  // SEO details
  const title = (project?.title && (project.title[currentLang] || project.title.en || project.title)) || "";
  const subtitle = (project?.subtitle && (project.subtitle[currentLang] || project.subtitle.en || project.subtitle)) || "";
  const categoryTitle = (project?.category?.title && (project.category.title[currentLang] || project.category.title.en || project.category.title)) || (typeof project?.category === "string" ? project.category : "");
  const location = project?.location || (subtitle.includes("•") ? subtitle.split("•")[1].trim() : "Bareilly");
  const sublineText = subtitle || (categoryTitle ? `${categoryTitle} • ${location}` : location);

  // Extract hero image URL
  const heroUrl = useMemo(() => {
    if (!project) return "";
    if (typeof project.heroImage === "string") return project.heroImage;
    if (project.heroImage?.asset?.url) return project.heroImage.asset.url;
    if (project.heroImage?.url) return project.heroImage.url;
    return "";
  }, [project]);

  // Extract up to 4 additional images for the carousel
  const carouselImages = useMemo(() => {
    if (!project?.additionalImages || !Array.isArray(project.additionalImages)) return [];
    const imgs = [];
    for (const item of project.additionalImages) {
      const url = item.url || item.asset?.url || item.image?.asset?.url || "";
      if (url && url !== heroUrl) {
        imgs.push({
          url,
          alt: item.alt || item.image?.alt || title,
          naturalW: item.naturalW || item.asset?.metadata?.dimensions?.width,
          naturalH: item.naturalH || item.asset?.metadata?.dimensions?.height
        });
      }
      if (imgs.length >= 4) break;
    }
    return imgs;
  }, [project, heroUrl, title]);

  // Staggered scroll fade-up for details
  const detailsRef = useRef(null);
  useEffect(() => {
    const el = detailsRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        el.classList.add("project-details--visible");
        obs.disconnect();
      }
    }, { threshold: 0.1 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [project]);

  // Description clean text
  const descriptionText = useMemo(() => {
    if (!project?.description) return "";
    const desc = project.description[currentLang] || project.description.en || project.description;
    if (typeof desc === "string") {
      return desc.split("\n\n")[0] || desc;
    }
    return "";
  }, [project, currentLang]);

  // Role and Year
  const roleText = (project?.role && (project.role[currentLang] || project.role.en || project.role)) || "";
  const yearText = project?.year ? String(project.year) : "";
  const clientText = project?.client || "";
  const stackList = useMemo(() => {
    if (!project?.stack) return [];
    const s = project.stack[currentLang] || project.stack.en || project.stack;
    return Array.isArray(s) ? s : [];
  }, [project, currentLang]);

  if (loading && !project) {
    return _jsx("main", { className: "project-page--redesigned", "aria-busy": "true" });
  }

  if (!project) {
    return _jsxs(_Fragment, {
      children: [
        _jsx(SeoComponent, {
          title: translate("common:errors.projectNotFound"),
          description: translate("common:errors.projectNotFoundMessage"),
          path: buildUrl(currentLang, "project", { slug: slug || "" }),
          noindex: true
        }),
        _jsx(ErrorComponent, {
          title: translate("common:errors.projectNotFound"),
          message: translate("common:errors.projectNotFoundMessage"),
          linkLabel: translate("common:nav.backToHome"),
          href: homeHref,
          onDone: restart
        })
      ]
    });
  }

  return _jsxs("main", {
    className: "project-page--redesigned",
    children: [
      _jsx(SeoComponent, {
        title: project.seoTitle || title,
        description: project.seoDescription || descriptionText,
        path: buildUrl(currentLang, "project", { slug: project.slug || slug }),
        image: heroUrl,
        type: "article"
      }),

      /* 1. Header with Back Button and Project Title */
      _jsxs("header", {
        className: "project-header--redesigned",
        children: [
          _jsxs("a", {
            href: "/en",
            className: "nav-link",
            onClick: (e) => {
              e.preventDefault();
              handleBack();
            },
            children: [
              _jsx("span", {
                className: "back-arrow",
                "aria-hidden": "true",
                children: "←"
              }),
              " Projects"
            ]
          }),
          _jsx("h1", {
            className: "project-title--redesigned",
            children: title
          })
        ]
      }),

      /* 2. Full-Size Hero Image directly below title (Entire image visible at natural aspect ratio, no click action) */
      _jsx("div", {
        className: "project-hero-container--redesigned",
        children: heroUrl && _jsx("img", {
          src: heroUrl,
          alt: title,
          className: "project-hero-img--redesigned",
          draggable: false,
          style: { cursor: "default", pointerEvents: "none" }
        })
      }),

      /* 3. Category • Location subline directly below image */
      sublineText && _jsx("div", {
        className: "project-subline--redesigned",
        children: sublineText
      }),

      /* 4. Minimal Project Details with scroll fade-up */
      _jsxs("section", {
        ref: detailsRef,
        className: "project-details--redesigned",
        children: [
          descriptionText && _jsx("div", {
            className: "project-details__desc",
            children: _jsx("p", { children: descriptionText })
          }),
          (clientText || yearText || roleText || stackList.length > 0) && _jsxs("div", {
            className: "project-details__meta-grid",
            children: [
              clientText && _jsxs("div", {
                className: "project-meta-item",
                children: [
                  _jsx("span", { className: "project-meta-item__label", children: "CLIENT" }),
                  _jsx("span", { className: "project-meta-item__val", children: clientText })
                ]
              }),
              yearText && _jsxs("div", {
                className: "project-meta-item",
                children: [
                  _jsx("span", { className: "project-meta-item__label", children: "YEAR" }),
                  _jsx("span", { className: "project-meta-item__val", children: yearText })
                ]
              }),
              roleText && _jsxs("div", {
                className: "project-meta-item",
                children: [
                  _jsx("span", { className: "project-meta-item__label", children: "ROLE" }),
                  _jsx("span", { className: "project-meta-item__val", children: roleText })
                ]
              }),
              stackList.length > 0 && _jsxs("div", {
                className: "project-meta-item project-meta-item--full",
                children: [
                  _jsx("span", { className: "project-meta-item__label", children: "EXPERTISE" }),
                  _jsx("div", {
                    className: "project-meta-tags",
                    children: stackList.map((tag) => _jsx("span", {
                      className: "project-meta-tag",
                      children: tag
                    }, tag))
                  })
                ]
              })
            ]
          })
        ]
      }),

      /* 5. Auto-playing Carousel of Photos (Unconditional at all widths) */
      _jsx(ProjectCarousel, {
        images: carouselImages.length > 0 ? carouselImages : (heroUrl ? [{ url: heroUrl, alt: title }] : []),
        projectTitle: title
      })
    ]
  });
}

export { Project as default };
