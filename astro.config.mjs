// @ts-check
import { defineConfig, fontProviders } from 'astro/config';
import { rehypeHeadingIds, unified } from '@astrojs/markdown-remark';
import sitemap from '@astrojs/sitemap';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import {
  rehypeDemoteHeadings,
  rehypeFigures,
  rehypeFocusableScrollers,
  rehypeHeadingAnchors,
  rehypeInlineFigures,
  rehypeScrollableTables,
} from './src/plugins/rehype-prose.mjs';

/** Reads a generated figure off disk so it can be inlined into the page. */
const readFigure = (src) => {
  try {
    return readFileSync(path.join(process.cwd(), 'public', src.replace(/^\//, '')), 'utf8');
  } catch {
    // A missing figure must fail the build loudly rather than ship a blank plate.
    throw new Error(`figure not found: ${src} (run \`npm run assets\`)`);
  }
};

/**
 * Post permalinks and dates, read from the frontmatter so the sitemap can carry
 * a real `lastmod` per post. Parsed here rather than through the content layer
 * because the sitemap integration is configured before that exists.
 */
const POST_DATES = (() => {
  const dir = 'src/content/blog';
  const map = new Map();
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.md')) continue;
    const raw = readFileSync(path.join(dir, file), 'utf8');
    const block = raw.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? '';
    const permalink = block.match(/^permalink: "(.+)"$/m)?.[1];
    const date = block.match(/^date: (.+)$/m)?.[1]?.trim().replace(/^"|"$/g, '');
    if (permalink && date) map.set(permalink, new Date(date).toISOString());
  }
  if (map.size === 0) throw new Error('sitemap: no post dates found');
  return map;
})();

const NEWEST = [...POST_DATES.values()].sort().pop();

/**
 * Tag pages holding a single post. They carry noindex, so listing them in the
 * sitemap would be asking a crawler to fetch a page and then telling it the
 * page does not belong in the index.
 */
const THIN_TAGS = (() => {
  const dir = 'src/content/blog';
  const counts = new Map();
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.md')) continue;
    const fm = readFileSync(path.join(dir, file), 'utf8').match(/^---\n([\s\S]*?)\n---/)?.[1] ?? '';
    const block = fm.match(/^tags:\n((?: {2}- .*\n?)+)/m)?.[1] ?? '';
    for (const line of block.trim().split('\n').filter(Boolean)) {
      const tag = line.replace(/^\s*-\s*/, '').replace(/^"|"$/g, '');
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  const slug = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  return new Set([...counts].filter(([, n]) => n < 2).map(([t]) => `/tags/${slug(t)}/`));
})();

export default defineConfig({
  site: 'https://shamspias.com',

  // No `i18n` block. The three languages are routed by a rest parameter that
  // this site generates itself, so English keeps the unprefixed addresses it
  // has always had and the integration's middleware is not in the way. The
  // locale list, the direction and the strings all live in src/i18n.

  // Jekyll served every page as a directory with a trailing slash. Keeping that
  // shape means every existing URL, and every link in every post, still resolves.
  trailingSlash: 'always',
  build: { format: 'directory' },

  integrations: [
    sitemap({
      // The CV is unlisted: reachable by anyone holding the link, absent from
      // the nav and absent from the sitemap.
      filter: (page) => {
        const route = new URL(page).pathname;
        return route !== '/cv/' && !route.startsWith('/404') && !THIN_TAGS.has(route);
      },

      // `lastmod` is the only field in a sitemap a crawler is documented to
      // act on, and it is the one @astrojs/sitemap cannot know: it has no view
      // of a post's own date. Read the dates off the frontmatter and hand each
      // post its own; everything else moves whenever a post does, so the index
      // pages carry the newest date on the site.
      serialize(item) {
        const route = new URL(item.url).pathname;
        const stamp = POST_DATES.get(route) ?? NEWEST;
        item.lastmod = stamp;
        // A hint, not an instruction. Posts are the destination, the indexes
        // exist to reach them, and the tag pages are the thinnest of the three.
        item.priority = route === '/' ? 1 : POST_DATES.has(route) ? 0.8 : route.startsWith('/tags/') ? 0.3 : 0.5;
        item.changefreq = POST_DATES.has(route) ? 'yearly' : 'weekly';
        return item;
      },
    }),
  ],

  // Self-hosted, subset, with metric-matched fallbacks so there is no layout shift.
  // Two families, no sans-serif. Literata carries every word on the site, with
  // display weight coming off its `wght` axis rather than a second serif; the
  // entire UI register (nav, metadata, table headers, labels, dates) is tracked
  // uppercase Commit Mono, which is the decision that stops this reading as
  // software. Self-hosted, subset to latin, metric-matched fallbacks.
  fonts: [
    {
      provider: fontProviders.fontsource(),
      // Fraunces sets the titles and headings. It is high-contrast and slightly
      // odd in a way a default face never is, which is the whole reason it is
      // here, and its latin subset costs 36 kB. It is not used for body text:
      // Literata was cut for reading on a screen and Fraunces was not.
      name: 'Fraunces',
      cssVariable: '--font-display',
      weights: ['400 700'],
      styles: ['normal'],
      subsets: ['latin'],
      fallbacks: ['Iowan Old Style', 'Palatino', 'Georgia', 'serif'],
      display: 'swap',
    },
    {
      provider: fontProviders.fontsource(),
      name: 'Literata',
      cssVariable: '--font-text',
      weights: ['400 700'],
      styles: ['normal', 'italic'],
      subsets: ['latin'],
      fallbacks: ['Iowan Old Style', 'Charter', 'Georgia', 'serif'],
      display: 'swap',
    },
    {
      provider: fontProviders.fontsource(),
      // Commit Mono, not JetBrains Mono, and the reason is measured rather than
      // aesthetic. This corpus draws its diagrams with box-drawing characters,
      // block elements and arrows. JetBrains Mono's latin subset is 394 glyphs
      // and contains none of them, so each one silently fell back to a system
      // font at a different advance width. Commit Mono's latin subset is 1,932
      // glyphs and covers all of it at a uniform 0.6em advance.
      // `npm run verify` asserts this; do not swap this face without running it.
      name: 'Commit Mono',
      cssVariable: '--font-mono',
      weights: [400, 500, 600],
      styles: ['normal'],
      subsets: ['latin'],
      fallbacks: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      display: 'swap',
    },
    {
      provider: fontProviders.fontsource(),
      // Bangla. Literata's latin subset cannot set a single Bengali glyph, so a
      // Bangla page without this face falls back to whatever the device has,
      // which on a desktop is often nothing. Noto Serif Bengali is a serif, so
      // it sits beside Literata rather than arguing with it. Loaded only on the
      // Bangla pages.
      name: 'Noto Serif Bengali',
      cssVariable: '--font-bengali',
      weights: ['400 700'],
      styles: ['normal'],
      subsets: ['bengali'],
      fallbacks: ['Kohinoor Bangla', 'Nirmala UI', 'Vrinda', 'serif'],
      display: 'swap',
    },
    {
      provider: fontProviders.fontsource(),
      // Arabic. Naskh rather than Kufi: it is the style Arabic prose is read
      // in, and its proportions are close enough to Literata's that a mixed
      // line does not look like two documents. Loaded only on the Arabic pages.
      name: 'Noto Naskh Arabic',
      cssVariable: '--font-arabic',
      weights: ['400 700'],
      styles: ['normal'],
      subsets: ['arabic'],
      fallbacks: ['Geeza Pro', 'Segoe UI', 'Tahoma', 'serif'],
      display: 'swap',
    },
  ],

  markdown: {
    // Astro 7 defaults to Sätteri. The remark pipeline is kept because KaTeX
    // rendering (rehype-katex) has no Sätteri equivalent, and every post's
    // maths was authored against remark-math's `$…$` / `$$…$$` semantics.
    processor: unified({
      remarkPlugins: [remarkMath],
      rehypePlugins: [
        // Order matters: demote first so ids and anchors land on final tags.
        rehypeDemoteHeadings,
        // Astro appends its own heading-id pass after user plugins, so the ids
        // have to be assigned here for the anchor plugin to have anything to
        // hang off. Running it twice is harmless; it skips headings with an id.
        rehypeHeadingIds,
        [
          rehypeKatex,
          {
            output: 'html',
            throwOnError: false,
            strict: false,
            trust: false,
            macros: { '\\R': '\\mathbb{R}' },
          },
        ],
        rehypeHeadingAnchors,
        rehypeScrollableTables,
        rehypeFigures,
        [rehypeInlineFigures, { read: readFigure }],
        rehypeFocusableScrollers,
      ],
    }),
    syntaxHighlight: { type: 'shiki' },
    shikiConfig: {
      themes: { light: 'github-light', dark: 'github-dark-dimmed' },
      wrap: false,
      // Two grammars the posts use that Shiki has no bundle for. PDDL is
      // s-expression based, so Lisp highlights it correctly; pseudocode is
      // deliberately left unhighlighted.
      langAlias: { pddl: 'lisp', pseudo: 'plaintext' },
    },
  },

  // Every URL the old Jekyll site published that is worth keeping alive.
  redirects: {
    '/about/': '/',
    '/about.html': '/',
    '/resume/': '/cv/',
    '/resume.html': '/cv/',
    '/cv-json/': '/cv/',
    '/resume-json.html': '/cv/',
    '/year-archive/': '/writing/',
    '/blog/': '/writing/',
    '/portfolio/': '/projects/',
    '/categories/': '/tags/',
    '/terms/': '/',
    '/markdown/': '/',
    '/collection-archive/': '/writing/',
    '/page-archive/': '/writing/',
    '/archive-layout-with-content/': '/writing/',
    '/non-menu-page/': '/',
    '/talkmap/': '/',
    '/talkmap.html': '/',
  },

  image: {
    // Only local images are ever used, so no remote patterns are permitted.
    domains: [],
    remotePatterns: [],
  },

  devToolbar: { enabled: false },
});
