/**
 * Renders one Open Graph card per page.
 *
 *   npm run og
 *
 * A single site-wide card makes every shared link look like every other shared
 * link. These carry the page's own title, its series, and its date, so a link
 * dropped into Slack or LinkedIn says what it is before anyone clicks it.
 *
 * The output is committed rather than generated during the build, on purpose.
 * librsvg resolves fonts through fontconfig and ignores `@font-face`, so the
 * same SVG rasterises differently on this machine and on a CI runner. Rendering
 * here and committing the PNGs means what I looked at is what ships.
 */
import { mkdir, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const OUT = 'public/og';
const BLOG = 'src/content/blog';

const W = 1200;
const H = 630;

// System faces, because the webfonts cannot be embedded. Georgia stands in for
// Literata and Menlo for Commit Mono; both are metrically close enough that the
// card reads as the same design at thumbnail size.
const SERIF = 'Georgia, Times New Roman, serif';
const MONO = 'Menlo, monospace';

const INK = '#1a1a1c';
const MUTED = '#52525b';
const FAINT = '#7a7a83';
const PAPER = '#fafafa';
const ACCENT = '#a8290f';

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Greedy wrap against an average advance. Georgia is proportional, so this is
 * an estimate; the budget is deliberately conservative and the longest title on
 * the site is checked by eye.
 */
function wrap(s, { size, width, maxLines }) {
  const perLine = Math.floor(width / (size * 0.53));
  const words = String(s).split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > perLine && line) {
      lines.push(line);
      line = word;
      if (lines.length === maxLines) break;
    } else {
      line = next;
    }
  }
  if (lines.length < maxLines && line) lines.push(line);
  if (lines.length === maxLines) {
    const rest = words.slice(lines.join(' ').split(/\s+/).length);
    if (rest.length) lines[maxLines - 1] = lines[maxLines - 1].replace(/[.,;:]?$/, '') + '...';
  }
  return lines;
}

const text = (x, y, s, { size, fill = INK, family = SERIF, weight = 400, track = 0, anchor = 'start' }) =>
  `<text x="${x}" y="${y}" font-family="${family}" font-size="${size}" font-weight="${weight}" ` +
  `letter-spacing="${track}" fill="${fill}" text-anchor="${anchor}">${esc(s)}</text>`;

/**
 * One card. `eyebrow` is the series or section, `title` the page's own heading,
 * `foot` the metadata line. The layout is the site's: accent rule at the top
 * edge, wordmark, then the title set large with the footer on the baseline.
 */
function card({ eyebrow, title, foot }) {
  const size = title.length > 78 ? 56 : title.length > 46 ? 66 : 76;
  const lines = wrap(title, { size, width: W - 160, maxLines: 4 });
  const lineH = size * 1.22;
  // The title is centred in the band between the two rules, so a one-line
  // title and a four-line title both sit in the middle of the card instead of
  // leaving a hole at one end.
  const bandTop = eyebrow ? 214 : 160;
  const bandBottom = H - 92;
  const block = lines.length * lineH;
  const firstBaseline = bandTop + (bandBottom - bandTop - block) / 2 + size * 0.8;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${PAPER}"/>
  <rect width="${W}" height="10" fill="${ACCENT}"/>
  ${text(80, 100, 'SHAMSUDDIN AHMED', { size: 23, family: MONO, track: 4.4, fill: INK })}
  ${text(W - 80, 100, 'shamspias.com', { size: 22, family: MONO, fill: FAINT, anchor: 'end' })}
  <line x1="80" y1="128" x2="${W - 80}" y2="128" stroke="#dcdce0" stroke-width="1"/>
  ${eyebrow ? text(80, 186, eyebrow.toUpperCase(), { size: 22, family: MONO, track: 3.4, fill: ACCENT }) : ''}
  ${lines.map((l, i) => text(80, firstBaseline + i * lineH, l, { size, fill: INK })).join('\n  ')}
  <line x1="80" y1="${H - 92}" x2="${W - 80}" y2="${H - 92}" stroke="#dcdce0" stroke-width="1"/>
  ${text(80, H - 54, foot, { size: 23, family: MONO, fill: MUTED })}
</svg>`;
}

/** Frontmatter fields this script needs, read without pulling in Astro. */
function frontmatter(raw) {
  const block = raw.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? '';
  const get = (k) => block.match(new RegExp(`^${k}: (.*)$`, 'm'))?.[1]?.trim() ?? '';
  const unquote = (v) => v.replace(/^"(.*)"$/, '$1');
  return {
    title: unquote(get('title')),
    permalink: unquote(get('permalink')),
    date: unquote(get('date')),
    series: unquote(get('series')),
    seriesOrder: get('seriesOrder'),
    tags: (block.match(/^tags: \[(.*)\]$/m)?.[1] ?? '')
      .split(',')
      .map((t) => t.trim().replace(/^"(.*)"$/, '$1'))
      .filter(Boolean),
  };
}

const readingMinutes = (body) => {
  const fences = body.match(/^```[\s\S]*?^```/gm) ?? [];
  const words = (body.replace(/^```[\s\S]*?^```/gm, ' ').match(/\S+/g) ?? []).length;
  const codeLines = fences.reduce((n, f) => n + f.split('\n').length, 0);
  return Math.max(1, Math.round(words / 220 + codeLines / 90));
};

const longDate = (iso) =>
  new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

/** `/posts/2026/01/joint-angle-accuracy/` -> `posts-2026-01-joint-angle-accuracy` */
export const slugOf = (route) =>
  route.replace(/^\/|\/$/g, '').replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'home';

async function main() {
  await mkdir(OUT, { recursive: true });

  const cards = new Map();

  // Posts.
  const files = (await readdir(BLOG)).filter((f) => f.endsWith('.md')).sort();
  for (const f of files) {
    const raw = await readFile(path.join(BLOG, f), 'utf8');
    const fm = frontmatter(raw);
    if (!fm.permalink) throw new Error(`${f}: no permalink`);
    const body = raw.slice(raw.indexOf('\n---', 4) + 4);
    const eyebrow = fm.series
      ? `${fm.series} · part ${fm.seriesOrder || '1'}`
      : (fm.tags[0] ?? 'Writing');
    cards.set(fm.permalink, {
      eyebrow,
      title: fm.title,
      foot: `${longDate(fm.date)}   ·   ${readingMinutes(body)} min read`,
    });
  }

  const posts = files.length;

  // The pages that are not posts. Kept here rather than derived, because each
  // one wants a line of its own rather than a generated stub.
  cards.set('/', {
    eyebrow: 'Senior Software Engineer · Dhaka',
    title: 'I build the layer between a language model and software that already exists.',
    foot: 'Agent harnesses  ·  LLM infrastructure  ·  ML for biology',
  });
  cards.set('/writing/', {
    eyebrow: 'Writing',
    title: 'Long-form notes on agents, infrastructure, vision and biology.',
    foot: `${posts} posts  ·  shamspias.com/writing`,
  });
  cards.set('/series/', {
    eyebrow: 'Series',
    title: 'Multi-part runs, in reading order.',
    foot: 'Biomechanics · Agent harnesses · ML for biology · Retrieval',
  });
  cards.set('/tags/', {
    eyebrow: 'Subjects',
    title: 'Every subject written about here.',
    foot: 'From agent harnesses to peptides, docking and pose estimation',
  });
  cards.set('/projects/', {
    eyebrow: 'Projects',
    title: 'Things I built, and what each one taught me.',
    foot: 'Go  ·  Python  ·  open source where it can be',
  });
  cards.set('/surprised/', {
    eyebrow: 'A surprise arcade',
    title: 'Two dozen tiny games that each teach one idea.',
    foot: 'Logic  ·  physics  ·  maths  ·  played in the browser',
  });

  // A card per series, because those are real reading paths people share. The
  // 130 tag pages fall back to the /tags/ card: they are thin index hubs, and a
  // card each would be five megabytes of near-identical PNG in the repository.
  const series = new Map();
  for (const f of files) {
    const raw = await readFile(path.join(BLOG, f), 'utf8');
    const fm = frontmatter(raw);
    if (!fm.series) continue;
    series.set(fm.series, (series.get(fm.series) ?? 0) + 1);
  }
  const slugify = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  for (const [name, count] of series) {
    cards.set(`/series/${slugify(name)}/`, {
      eyebrow: 'Series',
      title: name,
      foot: `${count} parts, in reading order  ·  shamspias.com`,
    });
  }

  let written = 0;
  for (const [route, spec] of cards) {
    const svg = card(spec);
    const file = path.join(OUT, `${slugOf(route)}.png`);
    // 72 is librsvg's own unit-to-pixel base, so the raster comes out at
    // exactly the viewBox size. Open Graph consumers are told the dimensions in
    // the markup, and 1200x630 is the size they expect.
    await sharp(Buffer.from(svg), { density: 72 })
      .resize(W, H, { fit: 'contain', background: PAPER })
      .png({ compressionLevel: 9, palette: true })
      .toFile(file);
    written++;
  }

  console.log(`og cards: ${written} written to ${OUT}/`);
}

await main();
