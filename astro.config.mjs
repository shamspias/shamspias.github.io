// @ts-check
import { defineConfig, fontProviders } from 'astro/config';
import { rehypeHeadingIds, unified } from '@astrojs/markdown-remark';
import sitemap from '@astrojs/sitemap';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

import {
  rehypeDemoteHeadings,
  rehypeHeadingAnchors,
  rehypeHeadingEmoji,
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
      filter: (page) => !page.includes('/404'),
    }),
  ],

  // Self-hosted, subset, with metric-matched fallbacks so there is no layout shift.
  fonts: [
    {
      provider: fontProviders.fontsource(),
      name: 'Newsreader',
      cssVariable: '--font-display',
      // Static instances, not a variable range. Newsreader's variable build
      // carries an optical-size axis that pushes the latin subset to 132 kB per
      // style; the three weights actually used come to a third of that.
      weights: [400, 500, 600],
      styles: ['normal', 'italic'],
      subsets: ['latin'],
      fallbacks: ['Iowan Old Style', 'Palatino', 'Georgia', 'serif'],
      display: 'swap',
    },
    {
      provider: fontProviders.fontsource(),
      name: 'Inter Tight',
      cssVariable: '--font-sans',
      weights: [400, 600],
      styles: ['normal'],
      subsets: ['latin'],
      fallbacks: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'system-ui', 'sans-serif'],
      display: 'swap',
    },
    {
      provider: fontProviders.fontsource(),
      // Commit Mono, not JetBrains Mono, and the reason is measured rather than
      // aesthetic. This corpus draws its diagrams with 1,657 box-drawing
      // characters, 155 block elements and 197 arrows. JetBrains Mono's latin
      // subset is 394 glyphs and contains none of them, so every one of those
      // characters silently fell back to a system font at a different advance
      // width and sheared the drawings. Commit Mono's latin subset is 1,932
      // glyphs and covers box drawing, blocks, geometric shapes, arrows, maths
      // operators, Greek and subscripts, all at the same 0.6em advance.
      // `node scripts/glyphs.mjs` asserts this; do not swap this face without
      // running it.
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
        rehypeHeadingEmoji,
        rehypeHeadingAnchors,
        rehypeScrollableTables,
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
