// @ts-check
import { defineConfig, fontProviders } from 'astro/config';
import { rehypeHeadingIds, unified } from '@astrojs/markdown-remark';
import sitemap from '@astrojs/sitemap';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

import {
  rehypeDemoteHeadings,
  rehypeFigures,
  rehypeFocusableScrollers,
  rehypeHeadingAnchors,
  rehypeScrollableTables,
} from './src/plugins/rehype-prose.mjs';

export default defineConfig({
  site: 'https://shamspias.com',

  // Jekyll served every page as a directory with a trailing slash. Keeping that
  // shape means every existing URL, and every link in every post, still resolves.
  trailingSlash: 'always',
  build: { format: 'directory' },

  integrations: [
    sitemap({
      // The CV is unlisted: reachable by anyone holding the link, absent from
      // the nav and absent from the sitemap.
      filter: (page) => !page.includes('/404') && !page.includes('/cv'),
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
