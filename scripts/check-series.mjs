/**
 * Checks that the series numbering is consistent.
 *
 *   node scripts/check-series.mjs
 *
 * Two things drift silently. A series can end up with two posts claiming the
 * same seriesOrder, or a gap in the numbering. And a cross-reference written as
 * `[part 7](/posts/.../slug/)` can point at a post whose seriesOrder is not 7,
 * usually because a new part was inserted and the prose number was not updated.
 * Both mislead the reader without breaking the build, so both are checked here.
 */
import { globSync, readFileSync } from 'node:fs';
import path from 'node:path';

const files = globSync('src/content/blog/**/*.md').sort();

// permalink -> { order, series, lang, file }
const byPermalink = new Map();
// series -> lang -> [order...]
const orders = new Map();
// slug -> Set of the distinct tag strings that produce it
const tagSlugs = new Map();

const slugify = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

for (const file of files) {
  const raw = readFileSync(file, 'utf8');
  const fm = raw.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? '';
  const permalink = fm.match(/^permalink: "(.+)"$/m)?.[1];
  const series = fm.match(/^series: "(.+)"$/m)?.[1];
  const order = Number(fm.match(/^seriesOrder: (\d+)$/m)?.[1] ?? 0);
  const lang = fm.match(/^lang: (\w+)$/m)?.[1] ?? 'en';
  if (permalink) byPermalink.set(`${lang}:${permalink}`, { order, series, lang, file });

  // Tags are keys shared across languages; two spellings that slugify to the
  // same segment (c and c++, "api design" and "API design") silently collide on
  // one /tags/<slug>/ page and break the thin-tag/sitemap bookkeeping.
  const tagBlock = fm.match(/^tags:\n((?: {2}- .*\n?)+)/m)?.[1] ?? '';
  for (const line of tagBlock.trim().split('\n').filter(Boolean)) {
    const tag = line.replace(/^\s*-\s*/, '').replace(/^"|"$/g, '');
    const slug = slugify(tag);
    if (!tagSlugs.has(slug)) tagSlugs.set(slug, new Set());
    tagSlugs.get(slug).add(tag);
  }

  if (series) {
    if (!orders.has(series)) orders.set(series, new Map());
    const perLang = orders.get(series);
    if (!perLang.has(lang)) perLang.set(lang, []);
    perLang.get(lang).push({ order, file });
  }
}

let problems = 0;
const fail = (file, msg) => {
  problems++;
  console.log(`  ${path.basename(file)}\n    ${msg}`);
};

// 1. Each series, in each language, is 1..N with no gaps and no duplicates.
for (const [series, perLang] of orders) {
  for (const [lang, items] of perLang) {
    const seen = new Map();
    for (const it of items) {
      if (seen.has(it.order)) {
        fail(it.file, `series "${series}" (${lang}) has two posts at order ${it.order}`);
      }
      seen.set(it.order, it.file);
    }
    const nums = [...seen.keys()].sort((a, b) => a - b);
    for (let i = 0; i < nums.length; i++) {
      if (nums[i] !== i + 1) {
        fail(items[0].file, `series "${series}" (${lang}) is not 1..${nums.length}: has ${nums.join(', ')}`);
        break;
      }
    }
  }
}

// 2. Every `[part N](/permalink/)` has N equal to that post's seriesOrder, in
//    the same language (English posts link to English parts, and so on).
for (const file of files) {
  const raw = readFileSync(file, 'utf8');
  const lang = raw.match(/^lang: (\w+)$/m)?.[1] ?? 'en';
  for (const m of raw.matchAll(/\[part (\d+)\]\((\/(?:bn|ar)\/)?(\/?posts\/[^)]+?\/)\)/g)) {
    const claimed = Number(m[1]);
    // Reassemble the permalink the link points at, dropping any locale prefix.
    const permalink = m[3].startsWith('/') ? m[3] : '/' + m[3];
    const prefix = m[2] ? m[2].slice(1, 3) : lang;
    const target = byPermalink.get(`${prefix}:${permalink}`) ?? byPermalink.get(`en:${permalink}`);
    if (!target) continue; // dead links are the linter's job
    if (target.order && claimed !== target.order) {
      fail(file, `"[part ${claimed}]" points at a post whose order is ${target.order}: ${permalink}`);
    }
  }
}

// 3. No two distinct tag spellings may slugify to the same segment.
for (const [slug, spellings] of tagSlugs) {
  if (spellings.size > 1) {
    problems++;
    console.log(
      `  tag slug collision: /tags/${slug}/ is produced by ${[...spellings]
        .map((s) => `"${s}"`)
        .join(' and ')} — pick one spelling`,
    );
  }
}

console.log(
  problems === 0
    ? `\n${files.length} posts, series numbering and tag slugs consistent.`
    : `\n${problems} problem(s).`,
);
process.exit(problems > 0 ? 1 : 0);
