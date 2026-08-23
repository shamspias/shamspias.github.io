/**
 * Checks what the built pages actually tell a search engine.
 *
 *   npm run build && node scripts/seo.mjs
 *
 * Every rule here is something a crawler reads and a person never sees, which
 * is exactly the class of thing that rots silently. The checks run against
 * `dist`, not against the source, because the only version that matters is the
 * one that ships.
 */
import { readFileSync, readdirSync } from 'node:fs';

const DIST = 'dist';
const ORIGIN = 'https://shamspias.com';

// These two must carry noindex. Everything else is free to, and a page that
// does is then held to the other half of the bargain: it must not be in the
// sitemap. The thin tag pages use that route.
const MUST_NOINDEX = new Set(['/cv/', '/404.html']);

const walk = (d) =>
  readdirSync(d, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(`${d}/${e.name}`) : [`${d}/${e.name}`],
  );

const routeOf = (file) => file.replace(/^dist/, '').replace(/index\.html$/, '');

const one = (html, re) => {
  const m = html.match(re);
  return m ? m[1] : null;
};
const all = (html, re) => [...html.matchAll(re)].map((m) => m[1]);

const meta = (html, name) =>
  one(html, new RegExp(`<meta\\s+name="${name}"\\s+content="([^"]*)"`, 'i')) ??
  one(html, new RegExp(`<meta\\s+content="([^"]*)"\\s+name="${name}"`, 'i'));

const prop = (html, p) =>
  one(html, new RegExp(`<meta\\s+property="${p}"\\s+content="([^"]*)"`, 'i')) ??
  one(html, new RegExp(`<meta\\s+content="([^"]*)"\\s+property="${p}"`, 'i'));

const decode = (s) =>
  String(s ?? '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'");

let problems = 0;
let warnings = 0;
const fail = (route, rule, detail) => {
  problems++;
  console.log(`  ${route}\n    ${rule}: ${detail}`);
};
const warn = (route, rule, detail) => {
  warnings++;
  console.log(`  ${route}\n    warn ${rule}: ${detail}`);
};

const pages = walk(DIST).filter((f) => f.endsWith('.html')).sort();
const titles = new Map();
const descriptions = new Map();
let indexable = 0;
let stubs = 0;
const stubRoutes = new Set();
const noindexedRoutes = new Set();

for (const file of pages) {
  const route = routeOf(file);
  const html = readFileSync(file, 'utf8');

  // A redirect stub is not a page. GitHub Pages cannot serve a 301, so every
  // old Jekyll URL ships as a meta-refresh; the signals that matter there are
  // the refresh, a canonical pointing at the destination, and noindex so the
  // stub itself never competes with the page it points to.
  if (/http-equiv="refresh"/i.test(html)) {
    stubs++;
    const canonical = one(html, /<link\s+rel="canonical"\s+href="([^"]*)"/i);
    if (!canonical) fail(route, 'redirect', 'stub without a canonical');
    else if (!canonical.startsWith(ORIGIN)) fail(route, 'redirect', `canonical is off-site: ${canonical}`);
    if (!/noindex/.test(meta(html, 'robots') ?? '')) fail(route, 'redirect', 'stub is indexable');
    stubRoutes.add(route);
    continue;
  }
  const robots = meta(html, 'robots') ?? '';
  const noindexed = /noindex/.test(robots);
  if (noindexed) noindexedRoutes.add(route);

  // 1. The pages that must stay out of search, and a directive on every page:
  //    left off, a crawler falls back to a truncated snippet and a thumbnail.
  if (MUST_NOINDEX.has(route) && !noindexed) fail(route, 'robots', 'must carry noindex');
  if (!robots) fail(route, 'robots', 'no robots directive');
  if (!noindexed && !/max-image-preview:large/.test(robots)) {
    fail(route, 'robots', `indexable page does not allow a large preview: "${robots}"`);
  }
  if (noindexed && !/follow/.test(robots)) {
    fail(route, 'robots', `noindex without follow, so its links are dead ends: "${robots}"`);
  }
  if (!noindexed) indexable++;

  // 2. Title. Google truncates around 60 characters of rendered width; the
  //    lower bound catches a page that never got a real title at all.
  const titleTags = all(html, /<title>([\s\S]*?)<\/title>/g);
  if (titleTags.length !== 1) fail(route, 'title', `${titleTags.length} <title> tags`);
  const title = decode(titleTags[0] ?? '');
  if (!title) fail(route, 'title', 'empty');
  else if (title.length < 15) fail(route, 'title', `too short (${title.length}): ${title}`);
  else if (title.length > 65) warn(route, 'title', `${title.length} chars, will be cut: ${title}`);

  // 3. Description. Too short wastes the snippet; too long is truncated.
  const desc = decode(meta(html, 'description'));
  if (!desc) fail(route, 'description', 'missing');
  else if (desc.length < 70) fail(route, 'description', `too short (${desc.length}): ${desc}`);
  else if (desc.length > 165) warn(route, 'description', `${desc.length} chars, will be cut`);

  // 4. Duplicates. Two pages competing on the same title is a self-inflicted
  //    ranking problem, and it is invisible without looking across the set.
  if (!noindexed && title) {
    (titles.get(title) ?? titles.set(title, []).get(title)).push(route);
    if (desc) (descriptions.get(desc) ?? descriptions.set(desc, []).get(desc)).push(route);
  }

  // 5. Canonical, absolute, and pointing at this page. The 404 is the one page
  //    that must not have one: it has no preferred URL, because it is whatever
  //    address the visitor got wrong.
  const canonical = one(html, /<link\s+rel="canonical"\s+href="([^"]*)"/i);
  if (route === '/404.html') {
    if (canonical) fail(route, 'canonical', `the 404 declares a canonical: ${canonical}`);
  } else if (!canonical) {
    fail(route, 'canonical', 'missing');
  } else if (canonical !== ORIGIN + route) {
    fail(route, 'canonical', `${canonical} should be ${ORIGIN + route}`);
  }

  // 6. Open Graph and Twitter, the tags that decide what a shared link looks
  //    like. An absolute image URL is not optional: relative ones are dropped.
  for (const p of ['og:type', 'og:title', 'og:description', 'og:url', 'og:image', 'og:site_name']) {
    if (!prop(html, p)) fail(route, 'open graph', `missing ${p}`);
  }
  const ogImage = prop(html, 'og:image');
  if (ogImage && !ogImage.startsWith('http')) fail(route, 'open graph', `og:image is relative: ${ogImage}`);
  if (ogImage && !prop(html, 'og:image:width')) fail(route, 'open graph', 'missing og:image:width');
  if (ogImage && !prop(html, 'og:image:alt')) fail(route, 'open graph', 'missing og:image:alt');
  if (!meta(html, 'twitter:card')) fail(route, 'twitter', 'missing twitter:card');

  // 7. Structured data on every indexable page, and it has to parse.
  const blocks = all(html, /<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g);
  if (!noindexed && blocks.length === 0) fail(route, 'json-ld', 'no structured data');
  for (const b of blocks) {
    try {
      const data = JSON.parse(b);
      // In a @graph the context is stated once on the wrapper and the nodes
      // inside carry only their own @type and @id.
      const wrappers = Array.isArray(data) ? data : [data];
      for (const w of wrappers) {
        if (!w['@context']) fail(route, 'json-ld', 'block without @context');
        const nodes = w['@graph'] ?? [w];
        if (!Array.isArray(nodes)) fail(route, 'json-ld', '@graph is not an array');
        const defined = new Set(nodes.map((n) => n['@id']).filter(Boolean));
        for (const n of nodes) {
          if (!n['@type']) fail(route, 'json-ld', 'node without @type');
        }
        // A reference to an @id that the graph never defines is the quiet way
        // structured data breaks: it validates as JSON and resolves to nothing.
        const refs = [];
        const collect = (v) => {
          if (Array.isArray(v)) return v.forEach(collect);
          if (v && typeof v === 'object') {
            const keys = Object.keys(v);
            if (keys.length === 1 && keys[0] === '@id') refs.push(v['@id']);
            else Object.values(v).forEach(collect);
          }
        };
        collect(nodes);
        for (const ref of new Set(refs)) {
          if (!defined.has(ref)) fail(route, 'json-ld', `@id reference goes nowhere: ${ref}`);
        }
        if (JSON.stringify(w).includes('"undefined"')) {
          fail(route, 'json-ld', 'a literal "undefined" reached the output');
        }
      }
    } catch (e) {
      fail(route, 'json-ld', `does not parse: ${e.message}`);
    }
  }

  // 8. One h1, and a language on <html>.
  const h1s = all(html, /<h1[^>]*>([\s\S]*?)<\/h1>/g);
  if (h1s.length !== 1) fail(route, 'headings', `${h1s.length} h1 elements`);
  if (!/<html[^>]+lang="[a-z]{2}(-[A-Z]{2})?"/.test(html)) fail(route, 'lang', 'no lang on <html>');

  // 9. Every image needs alt text; a missing attribute is different from an
  //    empty one, which is a legitimate "this is decorative".
  for (const tag of all(html, /(<img\b[^>]*>)/g)) {
    if (!/\salt="/.test(tag)) fail(route, 'images', `img without alt: ${tag.slice(0, 90)}`);
  }
}

for (const [title, routes] of titles) {
  if (routes.length > 1) fail(routes[0], 'duplicate title', `${routes.length} pages share "${title}": ${routes.join(', ')}`);
}
for (const [, routes] of descriptions) {
  if (routes.length > 1) fail(routes[0], 'duplicate description', `shared by ${routes.join(', ')}`);
}

// 10. Sitemap and robots have to exist, agree with each other, and list the
//     indexable pages rather than a subset someone forgot to regenerate.
const sitemaps = walk(DIST).filter((f) => /sitemap.*\.xml$/.test(f));
if (!sitemaps.length) fail('/', 'sitemap', 'no sitemap in the build');
const listed = new Set();
for (const f of sitemaps) {
  for (const loc of all(readFileSync(f, 'utf8'), /<loc>([^<]+)<\/loc>/g)) {
    if (!/sitemap.*\.xml$/.test(loc)) listed.add(loc.replace(ORIGIN, ''));
  }
}
const robotsTxt = readFileSync(`${DIST}/robots.txt`, 'utf8');
if (!/Sitemap:\s*https:\/\//.test(robotsTxt)) fail('/robots.txt', 'robots', 'no Sitemap line');

for (const file of pages) {
  const route = routeOf(file);
  if (noindexedRoutes.has(route) || stubRoutes.has(route)) {
    if (listed.has(route)) {
      fail(route, 'sitemap', 'a noindex page is listed in the sitemap');
    }
    continue;
  }
  if (!listed.has(route)) fail(route, 'sitemap', 'indexable page missing from the sitemap');
}
if (![...listed].every((l) => l.endsWith('/') || l.endsWith('.xml'))) {
  warn('/', 'sitemap', 'a sitemap entry does not end in a slash');
}
if (!/<lastmod>/.test(sitemaps.map((f) => readFileSync(f, 'utf8')).join(''))) {
  fail('/', 'sitemap', 'no <lastmod> on any entry');
}

console.log(
  problems === 0
    ? `\n${pages.length} pages: ${indexable} indexable, ${noindexedRoutes.size} noindex, ${stubs} redirect stubs, ${listed.size} in the sitemap. No problems${warnings ? `, ${warnings} warning(s)` : ''}.`
    : `\n${pages.length} pages, ${problems} problem(s), ${warnings} warning(s).`,
);
process.exit(problems > 0 ? 1 : 0);
