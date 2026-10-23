/**
 * Vercel Serverless Function: /sanity-api/[...path]
 * Replicates the Sanity API mock from server.js for the Vercel deployment.
 */
const data_4korners = require('../../data_4korners.js');

function resolveGroqQuery(queryStr, searchParams, baseUrl) {
  let query = queryStr || '';
  try {
    if (query.includes('%')) query = decodeURIComponent(query);
  } catch (e) {}

  function formatData(obj) {
    const jsonStr = JSON.stringify(obj);
    const replaced = jsonStr.replaceAll('"/assets/4korners/', `"${baseUrl}/assets/4korners/`);
    return JSON.parse(replaced);
  }

  // 1. Home and Site metadata query
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

  // 2. About page query
  if (query.includes('"about":') && query.includes('"site":')) {
    return {
      result: formatData({
        about: data_4korners.aboutPage,
        site: data_4korners.site
      })
    };
  }

  // 3. Categories query
  if (query.includes('_type == "category"') || query.includes("_type == 'category'")) {
    return { result: formatData(data_4korners.categories) };
  }

  // 4. Single project query - MUST have $slug
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

  // 5. Projects list query
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

module.exports = (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Timing-Allow-Origin', '*');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  const host = req.headers.host || 'localhost';
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  const baseUrl = `${protocol}://${host}`;

  let reqUrl;
  try {
    reqUrl = new URL(req.url, baseUrl);
  } catch (e) {
    res.status(400).end('Bad Request');
    return;
  }

  const query = reqUrl.searchParams.get('query');
  const responseData = resolveGroqQuery(query, reqUrl.searchParams, baseUrl);

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.status(200).json(responseData);
};
