# shamspias.com

Personal site of Shamsuddin Ahmed. Static, built with [Astro](https://astro.build), no
client-side framework, deployed to GitHub Pages.

```bash
npm install
npm run dev        # http://localhost:4321
npm run build      # -> dist/
npm run preview
```

## What is where

```
astro.config.mjs        site config: markdown pipeline, fonts, redirects
src/
  consts.ts             name, nav, social links, series display order
  content.config.ts     the blog collection schema
  content/blog/*.md     31 posts. `permalink` in the frontmatter is the URL.
  lib/posts.ts          querying, sorting, grouping, dates, reading time
  layouts/Base.astro    <html> shell: head, header, main, footer
  components/           header, footer, theme toggle, post entry, head
  pages/                one file per route (see below)
  plugins/              four small hast transforms for the long-form posts
  styles/global.css     the whole design system, as custom properties
scripts/
  build-assets.mjs      favicon, icons, social card, KaTeX subset  (npm run assets)
  audit.mjs             responsive + a11y sweep, 14 pages x 10 viewports
  contrast.mjs          WCAG check on every token pair
  shots.mjs             screenshot sheet for design review
public/                 CNAME, robots.txt, and everything build-assets generates
```

## Routes

| Route | Source |
|---|---|
| `/` | `pages/index.astro` |
| `/writing/` | `pages/writing/index.astro` |
| `/posts/YYYY/MM/slug/` | `pages/posts/[...path].astro` |
| `/series/`, `/series/<slug>/` | `pages/series/` |
| `/tags/`, `/tags/<slug>/` | `pages/tags/` |
| `/cv/` | `pages/cv.astro` |
| `/projects/` | `pages/projects.astro` |
| `/rss.xml` | `pages/rss.xml.ts` |
| `/404.html` | `pages/404.astro` |

**Post URLs come from frontmatter, not from the filename.** Every post carries a
`permalink` that was inherited from the previous Jekyll site, and the route reads it
directly. Nothing that was ever published has moved. The schema in
`src/content.config.ts` enforces the shape, so a typo fails the build rather than
silently orphaning a page. Old Jekyll addresses that are worth keeping alive
(`/about/`, `/resume`, `/year-archive/`, `/cv-json/`, …) are listed under `redirects`
in `astro.config.mjs`.

## Adding a post

Drop a markdown file in `src/content/blog/`:

```markdown
---
title: "The title, emoji and all 🌿"
description: "One or two sentences. Used for the card, the meta tag and the feed."
date: 2026-08-08
permalink: "/posts/2026/08/the-slug/"
tags:
  - "topic"
series: "Agent Harness"   # optional
seriesOrder: 4            # required if series is set
math: true                # loads the KaTeX stylesheet on this page only
---
```

Series membership is what draws the numbered eyebrow, the series strip at the foot of
the post, and the entry on `/series/`.

## The markdown pipeline

Astro 7 ships Sätteri as its default markdown processor. This site keeps the
remark/rehype pipeline instead, because KaTeX rendering has no Sätteri equivalent and
every post's maths was authored against `remark-math` semantics. On top of that, four
small local plugins in `src/plugins/rehype-prose.mjs` handle things these particular
posts need:

- **`rehypeDemoteHeadings`** — two posts use `#` for their in-body sections, which
  would put nineteen `h1`s under the page title. Every heading shifts down one level
  when a document contains an `h1`, so the outline is correct without editing prose.
- **`rehypeHeadingEmoji`** — nearly every heading ends in an emoji. CSS cannot select
  one, so they are wrapped in a span and held back to read as ornament.
- **`rehypeHeadingAnchors`** — a `#` deep link on every `h2`/`h3`/`h4`.
- **`rehypeScrollableTables`** — wraps each table so a wide comparison table scrolls
  inside its own box instead of giving the page a horizontal scrollbar.

## Checks

```bash
node scripts/contrast.mjs   # every token pair against WCAG AA
node scripts/audit.mjs      # needs a server on :4321
node scripts/shots.mjs ./shots
```

`audit.mjs` drives the locally installed Chrome across ten viewports from 320px to
3840px and fails on horizontal overflow, missing alt text, a heading outline with more
or fewer than one `h1`, and any scrollable region that a keyboard cannot reach. Run it
against a built site:

```bash
npm run build && (cd dist && python3 -m http.server 4321) &
node scripts/audit.mjs
```

## Deployment

`.github/workflows/deploy.yml` builds on every push to `main` and publishes `dist/` to
GitHub Pages. The custom domain lives in `public/CNAME`.

## Licence

Code is MIT (see `LICENSE`). The writing is not: posts in `src/content/blog/` are
© Shamsuddin Ahmed.
