/**
 * Generates the static assets that are not worth checking in as binaries, and
 * copies the KaTeX stylesheet plus only the woff2 faces it actually needs.
 *
 * Runs from `npm run prebuild`, so `npm run build` in CI picks it up with no
 * extra step in the workflow.
 */
import { mkdir, readFile, writeFile, copyFile, readdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '..');
const PUBLIC = path.join(ROOT, 'public');

const INK = '#1c1815';
const PAPER = '#faf7f0';
const ACCENT = '#a8290f';

/* --- the mark -------------------------------------------------------------
   A serif S held inside a hairline square, with one corner left open. The open
   corner is the whole idea: a closed frame reads as a logo, an open one reads
   as a bookplate. Drawn as paths so there is no font dependency. */

const markSvg = ({ size = 64, ink = INK, paper = PAPER, accent = ACCENT } = {}) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${size}" height="${size}" role="img" aria-label="Shamsuddin Ahmed">
  <rect width="64" height="64" fill="${paper}"/>
  <path d="M8 8 H56 V44" fill="none" stroke="${accent}" stroke-width="2" stroke-linecap="square"/>
  <path d="M8 8 V56 H44" fill="none" stroke="${ink}" stroke-width="2" stroke-linecap="square"/>
  <path d="M40.2 21.8c0-3.7-3.4-6.3-8.4-6.3-5.4 0-9.1 2.9-9.1 7 0 3.6 2.3 5.7 7.8 7.4l3.2 1c4.2 1.3 5.7 2.6 5.7 5 0 2.9-2.6 4.8-6.6 4.8-4.4 0-7.3-2.2-7.7-5.9h-3.3c.3 5.5 4.4 8.9 11 8.9 6.2 0 10.2-3.2 10.2-8.1 0-3.9-2.2-6.1-7.9-7.9l-3.4-1.1c-3.9-1.2-5.4-2.5-5.4-4.6 0-2.5 2.3-4.1 5.7-4.1 3.4 0 5.4 1.5 5.6 4h3.6z" fill="${ink}"/>
</svg>`;

/* --- the social card ------------------------------------------------------
   Composed to the same rules as the site: a hairline, a mono eyebrow, a serif
   name, and nothing else. Text is drawn with generic families because the card
   is rasterised by resvg inside sharp, which has no access to our webfonts. */

const ogSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="${PAPER}"/>
  <rect x="0" y="0" width="1200" height="6" fill="${ACCENT}"/>
  <g transform="translate(96 150)">
    <text x="0" y="0" font-family="ui-monospace, 'DejaVu Sans Mono', monospace" font-size="20"
          letter-spacing="6" fill="#6a635b">SENIOR SOFTWARE ENGINEER</text>
    <text x="0" y="112" font-family="Georgia, 'DejaVu Serif', serif" font-size="96"
          font-weight="500" fill="${INK}">Shamsuddin Ahmed</text>
    <line x1="0" y1="176" x2="1008" y2="176" stroke="#c9bfa8" stroke-width="2"/>
    <text x="0" y="236" font-family="Georgia, 'DejaVu Serif', serif" font-size="38"
          font-style="italic" fill="#56504a">Agent harnesses, LLM infrastructure,</text>
    <text x="0" y="290" font-family="Georgia, 'DejaVu Serif', serif" font-size="38"
          font-style="italic" fill="#56504a">and machine learning for biology.</text>
    <text x="0" y="384" font-family="ui-monospace, 'DejaVu Sans Mono', monospace" font-size="20"
          letter-spacing="4" fill="#6a635b">SHAMSPIAS.COM</text>
  </g>
</svg>`;

async function generated() {
  await mkdir(PUBLIC, { recursive: true });

  await writeFile(path.join(PUBLIC, 'favicon.svg'), markSvg({ size: 64 }).trim() + '\n', 'utf8');

  await sharp(Buffer.from(markSvg({ size: 512 })))
    .resize(180, 180)
    .png({ compressionLevel: 9 })
    .toFile(path.join(PUBLIC, 'apple-touch-icon.png'));

  for (const size of [192, 512]) {
    await sharp(Buffer.from(markSvg({ size: 512 })))
      .resize(size, size)
      .png({ compressionLevel: 9 })
      .toFile(path.join(PUBLIC, `icon-${size}.png`));
  }

  await sharp(Buffer.from(ogSvg)).png({ compressionLevel: 9 }).toFile(path.join(PUBLIC, 'og.png'));

  await writeFile(
    path.join(PUBLIC, 'manifest.webmanifest'),
    JSON.stringify(
      {
        name: 'Shamsuddin Ahmed',
        short_name: 'Shamsuddin',
        start_url: '/',
        display: 'browser',
        background_color: PAPER,
        theme_color: PAPER,
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      null,
      2,
    ) + '\n',
    'utf8',
  );

  console.log('assets: favicon.svg, apple-touch-icon.png, icon-192/512.png, og.png, manifest');
}

/* --- KaTeX ---------------------------------------------------------------- */

async function katex() {
  const from = path.join(ROOT, 'node_modules', 'katex', 'dist');
  if (!existsSync(from)) throw new Error('katex not installed');

  const to = path.join(PUBLIC, 'katex');
  await rm(to, { recursive: true, force: true });
  await mkdir(path.join(to, 'fonts'), { recursive: true });

  // Rewrite the url() references to the folder we are copying into, and drop
  // the woff and ttf fallbacks: every browser that can run this site has woff2.
  let css = await readFile(path.join(from, 'katex.min.css'), 'utf8');
  css = css.replace(/url\(fonts\//g, 'url(/katex/fonts/');
  css = css.replace(/,url\([^)]*\.(?:woff|ttf)\)\s*format\("(?:woff|truetype)"\)/g, '');
  await writeFile(path.join(to, 'katex.min.css'), css, 'utf8');

  const wanted = new Set([...css.matchAll(/\/katex\/fonts\/([^)]+)/g)].map((m) => m[1]));
  const available = await readdir(path.join(from, 'fonts'));
  let n = 0;
  for (const file of available) {
    if (!wanted.has(file)) continue;
    await copyFile(path.join(from, 'fonts', file), path.join(to, 'fonts', file));
    n++;
  }
  console.log(`katex: stylesheet + ${n} woff2 faces`);
}

await generated();
await katex();
