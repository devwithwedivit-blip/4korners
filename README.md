# Mathilde De Chiara — Cloned Portfolio

This is a local clone of the [Mathilde De Chiara portfolio](https://www.mathildedechiara.com/en), configured and deployed to run locally on **`localhost:4444`**.

---

## 🚀 Quick Start

The local server is already running in the background.

Open your browser and navigate to:
👉 **[http://localhost:4444/en](http://localhost:4444/en)**

To restart or run the server anytime:
```bash
npm start
# or
node server.js
```

---

## 🛠️ Architecture & What Was Done

1. **Asset Structure & SPA Routing**:
   - `www.mathildedechiara.com/`: Contains `en.html`, `index.html`, `assets/`, `fonts/`, `site.webmanifest`, and icons.
   - All client-side routes (`/en`, `/`, `/fr`, `/en/about`, `/en/project/:slug`) are seamlessly handled via SPA fallback.

2. **Full Font & Icon Suite**:
   - All weights of `PP Editorial New` (`Regular`, `Ultralight`, `Italic`, `UltralightItalic`, `Ultrabold`, `UltraboldItalic`) are downloaded into `fonts/`.
   - SVG and PNG favicons, touch icons, and webmanifest are properly linked.

3. **Sanity API & CDN Proxy (`/sanity-api/` and `/cdn.sanity.io/`)**:
   - The production site queries Sanity CMS (`b2mcdo5v.apicdn.sanity.io`) and image CDN (`cdn.sanity.io`), which restrict cross-origin requests to `https://www.mathildedechiara.com`.
   - `server.js` provides an integrated proxy with proper origin attribution and local caching (`.cache/`).
   - Project hero images and assets in `cdn.sanity.io/images/b2mcdo5v/production/` are pre-cached locally for offline resilience and instant load times.
   - WebGL textures (OGL canvas) sample without any CORS errors.

4. **Zero Dependencies**:
   - Built purely with standard Node.js libraries (`http`, `fs`, `path`). No extra `npm install` needed.
