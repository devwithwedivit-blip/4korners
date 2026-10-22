# 4 Korners Design Studio Portfolio

Portfolio website for 4 Korners Design Studio, configured to run locally on **`localhost:4444`** and deploy statically to Vercel with zero external dependencies.

---

## 🚀 Quick Start

To run the local server:
```bash
npm start
# or
node server.js
```

Open your browser and navigate to:
👉 **[http://localhost:4444/en](http://localhost:4444/en)**

---

## 🛠️ Architecture

1. **Asset Structure & SPA Routing**:
   - `www.mathildedechiara.com/`: Static directory containing `index.html`, `en.html`, `assets/`, `fonts/`, `site.webmanifest`, and icons.
   - All client-side routes (`/en`, `/`, `/fr`, `/en/about`, `/en/project/:slug`) are handled via SPA rewrites.

2. **Self-Contained Content**:
   - All projects, images, and content are bundled locally in `data_4korners.js` and `assets/4korners/`.
   - Zero dependencies on external third-party domains.

3. **Zero Dependencies**:
   - Built purely with standard Node.js libraries (`http`, `fs`, `path`). No extra `npm install` needed.
