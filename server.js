/**
 * Custom local server for 4 Korners Design Studio Portfolio
 * Deployed on http://localhost:4444
 * Serves 4 Korners Design Studio content & imagery with WebGL portfolio aesthetics
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 4444;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const BASE_DIR = __dirname;
const SITE_DIR = path.join(BASE_DIR, 'www.mathildedechiara.com');
const ASSETS_4KORNERS_DIR = path.join(BASE_DIR, 'assets', '4korners');
const CDN_DIR = path.join(BASE_DIR, 'cdn.sanity.io');
const CACHE_DIR = path.join(BASE_DIR, '.cache');

if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

// Load 4 Korners Design Studio database
const data_4korners = require('./data_4korners.js');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif', 
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf'
};

function getMime(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

function resolveGroqQuery(queryStr, searchParams, host) {
  let query = queryStr || '';
  try {
    if (query.includes('%')) query = decodeURIComponent(query);
  } catch (e) {}

  // Formatter to prepend current base URL for assets
  function formatData(obj) {
    const jsonStr = JSON.stringify(obj);
    const baseUrl = process.env.BASE_URL || `http://${host}`;
    const replaced = jsonStr.replaceAll('"/assets/4korners/', `"${baseUrl}/assets/4korners/`);
    return JSON.parse(replaced);
  }

  // 1. Home and Site metadata query (Gh)
  if (query.includes('"site":') && query.includes('"homepage":')) {
    return {
      result: formatData({
        site: data_4korners.site,
        homepage: data_4korners.homepage,
        about: {
          role: data_4korners.aboutPage.role,
          portrait: data_4korners.aboutPage.portrait.asset.url
        }
      })
    };
  }

  // 2. About page query (hp)
  if (query.includes('"about":') && query.includes('"site":')) {
    return {
      result: formatData({
        about: data_4korners.aboutPage,
        site: data_4korners.site
      })
    };
  }

  // 3. Categories query (jh)
  if (query.includes('_type == "category"') || query.includes("_type == 'category'")) {
    return { result: formatData(data_4korners.categories) };
  }

  // 4. Single project query (Dh) - MUST have $slug
  const hasSlug = (searchParams && (searchParams.has('$slug') || searchParams.has('%24slug'))) || query.includes('$slug');
  if (hasSlug) {
    let slugParam = searchParams ? (searchParams.get('$slug') || searchParams.get('%24slug')) : null;
    if (slugParam) {
      try {
        slugParam = JSON.parse(slugParam);
      } catch (e) {
        slugParam = slugParam.replace(/^["']|["']$/g, '');
      }
    }
    const cleanSlug = (slugParam || '').trim().toLowerCase();
    const proj = data_4korners.projects.find(p => 
      p.slug.en === cleanSlug || 
      p.slug.fr === cleanSlug || 
      p.slug.current === cleanSlug || 
      p._id === `proj-${cleanSlug}`
    ) || data_4korners.projects[0];

    return { result: formatData(proj) };
  }

  // 5. Projects list query (Nh) - All projects array
  if (query.includes('_type == "project"') || query.includes("_type == 'project'")) {
    return { result: formatData(data_4korners.projects) };
  }

  // 6. Standalone site query
  if (query.includes('_type == "site"')) {
    return { result: formatData(data_4korners.site) };
  }

  // 7. Standalone about query
  if (query.includes('_type == "aboutPage"')) {
    return { result: formatData(data_4korners.aboutPage) };
  }

  return { result: null };
}

const server = http.createServer(async (req, res) => {
  // CORS & Security headers for WebGL textures & cross-origin asset loading
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Timing-Allow-Origin', '*');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const host = req.headers.host || `localhost:${PORT}`;
  let reqUrl;
  try {
    reqUrl = new URL(req.url, `http://${host}`);
  } catch (e) {
    res.writeHead(400);
    res.end('Bad Request');
    return;
  }

  const pathname = decodeURIComponent(reqUrl.pathname);

  // 1. Sanity API endpoint (/sanity-api/*) - Intercept & return 4 Korners data
  if (pathname.startsWith('/sanity-api/')) {
    const query = reqUrl.searchParams.get('query');
    const responseData = resolveGroqQuery(query, reqUrl.searchParams, host);

    if (responseData.result !== null) {
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate'
      });
      res.end(JSON.stringify(responseData));
      return;
    }

    // No external proxy - return empty result for unrecognized queries
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate'
    });
    res.end(JSON.stringify({ result: null }));
    return;
  }

  // 2. 4 Korners Local Assets (/assets/4korners/*)
  if (pathname.startsWith('/assets/4korners/')) {
    const subPath = pathname.replace(/^\/assets\/4korners\//, '');
    let localFile = path.join(ASSETS_4KORNERS_DIR, subPath);

    // Try decoded path, then alternative path
    if (!fs.existsSync(localFile)) {
      const alternatePath = path.join(ASSETS_4KORNERS_DIR, decodeURIComponent(subPath));
      if (fs.existsSync(alternatePath)) {
        localFile = alternatePath;
      }
    }

    if (fs.existsSync(localFile) && fs.statSync(localFile).isFile()) {
      res.writeHead(200, {
        'Content-Type': getMime(localFile),
        'Cache-Control': 'public, max-age=86400'
      });
      fs.createReadStream(localFile).pipe(res);
      return;
    }

    // Fallback proxy from 4 Korners site if not found locally
    const remoteUrl = `https://www.4kornersdesignstudio.com/${subPath}`;
    try {
      const upstreamRes = await fetch(remoteUrl, {
        headers: {
          'User-Agent': req.headers['user-agent'] || 'Mozilla/5.0'
        }
      });

      if (upstreamRes.ok) {
        const buffer = Buffer.from(await upstreamRes.arrayBuffer());
        try {
          fs.mkdirSync(path.dirname(localFile), { recursive: true });
          fs.writeFileSync(localFile, buffer);
        } catch (e) {}

        res.writeHead(200, {
          'Content-Type': upstreamRes.headers.get('content-type') || getMime(localFile),
          'Cache-Control': 'public, max-age=86400'
        });
        res.end(buffer);
        return;
      }
    } catch (e) {}

    res.writeHead(404);
    res.end('4 Korners asset not found');
    return;
  }

  // 3. Sanity CDN Image proxy (/cdn.sanity.io/*)
  if (pathname.startsWith('/cdn.sanity.io/')) {
    const relPath = pathname.replace(/^\/cdn\.sanity\.io\//, '');
    const localFile = path.join(CDN_DIR, relPath);

    if (fs.existsSync(localFile) && fs.statSync(localFile).isFile()) {
      res.writeHead(200, {
        'Content-Type': getMime(localFile),
        'Cache-Control': 'public, max-age=86400'
      });
      fs.createReadStream(localFile).pipe(res);
      return;
    }

    // Proxy upstream to real Sanity CDN (with query params)
    const upstreamUrl = 'https://cdn.sanity.io/' + relPath + (parsedUrl.search || '');
    try {
      const upstreamRes = await fetch(upstreamUrl);
      if (upstreamRes.ok) {
        const buffer = Buffer.from(await upstreamRes.arrayBuffer());
        res.writeHead(upstreamRes.status, {
          'Content-Type': upstreamRes.headers.get('content-type') || 'image/jpeg',
          'Cache-Control': 'public, max-age=86400'
        });
        res.end(buffer);
        return;
      }
    } catch (err) {}

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Image not found');
    return;
  }

  // 4. Static files in www.mathildedechiara.com or BASE_DIR
  let potentialFile = path.join(SITE_DIR, pathname);
  if (pathname === '/about' || pathname === '/about/' || pathname === '/about.html' || pathname === '/en/about' || pathname === '/fr/a-propos') {
    potentialFile = path.join(SITE_DIR, 'about.html');
  } else if (pathname === '/4-korners-logo.html') {
    potentialFile = path.join(BASE_DIR, '4 KORNERS DESIGN STUDIO WITHOUT BACKGROUND.html');
  } else if (!fs.existsSync(potentialFile) || !fs.statSync(potentialFile).isFile()) {
    const rootPotential = path.join(BASE_DIR, pathname);
    if (fs.existsSync(rootPotential) && fs.statSync(rootPotential).isFile()) {
      potentialFile = rootPotential;
    }
  }

  if (fs.existsSync(potentialFile) && fs.statSync(potentialFile).isFile()) {
    const isAsset = pathname.startsWith('/assets/') || pathname.startsWith('/fonts/') || /\.(avif|webp|png|jpe?g|woff2?|css|js)$/i.test(potentialFile);
    res.writeHead(200, {
      'Content-Type': getMime(potentialFile),
      'Cache-Control': isAsset ? 'public, max-age=86400' : 'no-cache'
    });
    fs.createReadStream(potentialFile).pipe(res);
    return;
  }

  // 5. SPA HTML fallback (for /, /en, /fr, /en/about, /en/project/..., etc.)
  const enHtmlFile = path.join(SITE_DIR, 'en.html');
  if (fs.existsSync(enHtmlFile)) {
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache'
    });
    fs.createReadStream(enHtmlFile).pipe(res);
    return;
  }

  res.writeHead(404);
  res.end('Not Found');
});

server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`4 Korners Design Studio Portfolio Server Running!`);
  console.log(`URL: http://localhost:${PORT}/en`);
  console.log(`Mirrored from: https://www.4kornersdesignstudio.com/`);
  console.log(`=======================================================`);
});
