/**
 * Checks every post against the house rules.
 *
 *   node scripts/lint-posts.mjs
 *
 * These are the rules that are cheap to break and expensive to notice: an em
 * dash that crept back in, an emoji in a heading, a frontmatter field that lost
 * its quotes, an internal link pointing at a page that does not exist, a
 * diagram line long enough to make the figure scroll.
 */
import { globSync, readFileSync } from 'node:fs';
import path from 'node:path';

const DIR = 'src/content/blog';
// Translations live in a folder named after their language, so the glob has to
// recurse. Every check below that depends on the language reads it from the
// frontmatter rather than from the path.
const files = globSync(`${DIR}/**/*.md`).sort();

const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{1F1E6}-\u{1F1FF}]/u;
const DIAGRAM_MAX = 74;
// A diagram that overflows is broken, because it cannot wrap. A long line
// inside real code is only untidy, and a string literal sometimes has no
// shorter form, so it warns rather than fails.
const CODE_MAX = 110;

// Every canonical URL on the site, so cross-links can be checked. A post that
// exists in Bangla is reachable at /bn + its permalink, so the prefixed forms
// count as real addresses too.
const LOCALES = ['bn'];
const permalinks = new Set();
for (const f of files) {
  const raw = readFileSync(f, 'utf8');
  const link = raw.match(/^permalink: "(.+)"$/m)?.[1];
  if (!link) continue;
  const lang = raw.match(/^lang: (\w+)$/m)?.[1] ?? 'en';
  permalinks.add(lang === 'en' ? link : `/${lang}${link}`);
}
const OTHER_PAGES = new Set([
  '/', '/writing/', '/projects/', '/series/', '/tags/', '/cv/', '/rss.xml', '/llms.txt',
  ...LOCALES.flatMap((l) => [`/${l}/`, `/${l}/writing/`, `/${l}/series/`, `/${l}/tags/`]),
]);

// The closing section, per language. Every post ends with one, and the heading
// is in the language the post is written in.
const CLOSING = {
  en: /^#{2,3} .*short version/im,
  bn: /^#{2,3} .*(সংক্ষেপে|সারসংক্ষেপ)/im,
};

let problems = 0;
let warnings = 0;
const report = (file, rule, detail) => {
  problems++;
  console.log(`  ${path.basename(file)}\n    ${rule}: ${detail}`);
};
const warn = (file, rule, detail) => {
  warnings++;
  console.log(`  ${path.basename(file)}\n    warn ${rule}: ${detail}`);
};

for (const file of files) {
  const raw = readFileSync(file, 'utf8');
  const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) {
    report(file, 'frontmatter', 'no frontmatter block');
    continue;
  }
  const [, fm, body] = m;
  const lines = raw.split('\n');

  // 1. em dashes, anywhere at all
  lines.forEach((l, i) => {
    if (l.includes('—')) report(file, 'em dash', `line ${i + 1}: ${l.trim().slice(0, 72)}`);
  });

  // 2. frontmatter shape
  for (const key of ['title', 'description', 'date', 'permalink', 'tags', 'math']) {
    if (!new RegExp(`^${key}:`, 'm').test(fm)) report(file, 'frontmatter', `missing ${key}`);
  }
  for (const key of ['title', 'description', 'permalink']) {
    const v = fm.match(new RegExp(`^${key}: (.*)$`, 'm'));
    if (v && !/^".*"$/.test(v[1].trim())) report(file, 'frontmatter', `${key} is not double-quoted`);
  }

  // A search result shows about 160 characters, and the content schema refuses
  // anything longer. Catching it here says which post and by how much, instead
  // of failing the build with a schema error.
  const descLen = (fm.match(/^description: "(.*)"$/m)?.[1] ?? '').length;
  if (descLen > 165) report(file, 'description', `${descLen} characters, ${descLen - 165} over the limit`);
  if (descLen > 0 && descLen < 70) report(file, 'description', `${descLen} characters, too short for a snippet`);

  const seo = fm.match(/^seoTitle: "(.*)"$/m)?.[1];
  if (seo && seo.length > 62) report(file, 'seoTitle', `${seo.length} characters, over 62`);
  const series = fm.match(/^series: /m);
  const order = fm.match(/^seriesOrder: /m);
  if (Boolean(series) !== Boolean(order)) report(file, 'frontmatter', 'series and seriesOrder must appear together');

  // 3. math flag matches reality
  const stripped = body.replace(/^ {0,3}```[\s\S]*?^ {0,3}```/gm, '').replace(/`[^`\n]*`/g, '');
  const hasMath = /\$\$[\s\S]*?\$\$|\$[^$\n]{1,120}\$/.test(stripped);
  const declared = /^math: true$/m.test(fm);
  if (hasMath !== declared) report(file, 'math flag', `body ${hasMath ? 'has' : 'has no'} maths but math: ${declared}`);

  // 4. emoji in the title or any heading
  const title = fm.match(/^title: "(.*)"$/m)?.[1] ?? '';
  if (EMOJI.test(title)) report(file, 'emoji', `title: ${title}`);
  let fence = false;
  lines.forEach((l, i) => {
    if (/^ {0,3}```/.test(l)) { fence = !fence; return; }
    if (fence) return;
    if (/^#{1,6}\s/.test(l) && EMOJI.test(l)) report(file, 'emoji', `heading line ${i + 1}: ${l.trim().slice(0, 60)}`);
  });

  // 5. internal links resolve
  for (const [, href] of body.matchAll(/\]\((\/[^)\s]*)\)/g)) {
    const clean = href.split('#')[0];
    const sectionish = /^\/(bn\/|ar\/)?(tags|series|figures)\//.test(clean);
    if (!permalinks.has(clean) && !OTHER_PAGES.has(clean) && !sectionish) {
      report(file, 'dead link', href);
    }
  }

  // 6. fenced blocks: line lengths, and a language tag on real code
  const fences = [...body.matchAll(/^( {0,3})```([^\n]*)\n([\s\S]*?)^ {0,3}```/gm)];
  for (const [, , info, content] of fences) {
    const lang = info.trim();
    const rows = content.split('\n');
    const limit = lang === '' ? DIAGRAM_MAX : CODE_MAX;
    const over = rows.filter((r) => [...r].length > limit);
    if (over.length) {
      const say = lang === '' ? report : warn;
      say(file, lang === '' ? 'diagram too wide' : 'code line too long',
        `${over.length} line(s) over ${limit}: ${over[0].trim().slice(0, 56)}`);
    }
  }

  // 7. closing section, in the post's own language
  const lang = fm.match(/^lang: (\w+)$/m)?.[1] ?? 'en';
  const closing = CLOSING[lang];
  if (!closing) report(file, 'frontmatter', `unknown lang: ${lang}`);
  else if (!closing.test(body)) report(file, 'structure', 'no closing summary section');

  // 8. a lead paragraph in italics
  const firstPara = body.trim().split('\n\n')[0].trim();
  if (!firstPara.startsWith('*')) report(file, 'structure', 'no italic lead paragraph');
}

console.log(
  problems === 0
    ? `\n${files.length} posts, no violations${warnings ? `, ${warnings} warning(s)` : ''}.`
    : `\n${files.length} posts, ${problems} violation(s), ${warnings} warning(s).`,
);
process.exit(problems > 0 ? 1 : 0);
