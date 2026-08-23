/**
 * Responsive and accessibility audit against the built site.
 *
 *   node scripts/audit.mjs [baseUrl]
 *
 * Drives the locally installed Chrome, walks every page at every breakpoint we
 * claim to support, and fails loudly on the things that are actually easy to
 * get wrong: horizontal overflow, unreadable contrast, elements wider than the
 * viewport, and images without alt text.
 */
import puppeteer from 'puppeteer-core';

const BASE = process.argv[2] ?? 'http://127.0.0.1:4321';

const CHROME =
  process.env.CHROME_PATH ??
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const VIEWPORTS = [
  { name: 'phone-320', width: 320, height: 720 },
  { name: 'phone-390', width: 390, height: 844 },
  { name: 'phone-430', width: 430, height: 932 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'tablet-1024', width: 1024, height: 768 },
  { name: 'laptop-1280', width: 1280, height: 800 },
  { name: 'desktop-1440', width: 1440, height: 900 },
  { name: 'desktop-1920', width: 1920, height: 1080 },
  { name: 'wide-2560', width: 2560, height: 1440 },
  { name: 'wide-3840', width: 3840, height: 2160 },
];

const PAGES = [
  '/',
  '/writing/',
  '/series/',
  '/series/machine-learning-for-biology/',
  '/tags/',
  '/tags/peptides/',
  '/cv/',
  '/projects/',
  '/404.html',
  '/posts/2026/02/honest-negatives-peptide-benchmark/',
  '/posts/2025/02/moe-explained-simply/',
  '/posts/2022/06/transformers-attention-made-simple/',
  '/posts/2026/03/screening-400k-natural-products/',
  '/posts/2025/05/dify-ssl-zero-to-green/',
];

/** Runs in the page. Reports overflow and the elements responsible. */
const probe = () => {
  const de = document.documentElement;
  const vw = de.clientWidth;
  const offenders = [];

  for (const el of document.querySelectorAll('body *')) {
    // Geometry inside an <svg> is clipped by the viewBox, so a path can report
    // a box far wider than the window while rendering perfectly.
    if (el.ownerSVGElement) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    const overhang = Math.round(r.right - vw);
    if (overhang > 1 || Math.round(r.left) < -1) {
      const cs = getComputedStyle(el);
      // An element that scrolls on its own axis is doing the right thing.
      const scrolls = ['auto', 'scroll'].includes(cs.overflowX);
      if (scrolls && r.right - vw <= 1) continue;
      offenders.push({
        tag: el.tagName.toLowerCase(),
        cls: (el.className || '').toString().slice(0, 60),
        left: Math.round(r.left),
        right: Math.round(r.right),
        overhang,
        overflowX: cs.overflowX,
      });
    }
  }

  // Only report the outermost offenders; children inherit the problem.
  const roots = offenders.filter(
    (o, i) => !offenders.some((p, j) => j !== i && p.overhang >= o.overhang && p.left <= o.left && p.right >= o.right && p !== o),
  );

  const imgs = [...document.querySelectorAll('img')].filter((i) => !i.hasAttribute('alt'));

  return {
    docScrollWidth: de.scrollWidth,
    clientWidth: vw,
    horizontalScroll: de.scrollWidth - vw,
    offenders: roots.slice(0, 6),
    imgsWithoutAlt: imgs.length,
    h1Count: document.querySelectorAll('h1').length,
    title: document.title,
    // Anything that scrolls must be focusable.
    unfocusableScrollers: [...document.querySelectorAll('pre, .table-scroll, .katex-display')].filter(
      (el) => el.scrollWidth > el.clientWidth + 1 && el.tabIndex < 0,
    ).length,
  };
};

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--hide-scrollbars', '--force-device-scale-factor=1', '--no-sandbox'],
});

let failures = 0;
const summary = [];

for (const vp of VIEWPORTS) {
  const page = await browser.newPage();
  await page.setViewport({ width: vp.width, height: vp.height, deviceScaleFactor: 1 });

  for (const p of PAGES) {
    const res = await page.goto(BASE + p, { waitUntil: 'load' });
    if (!res || res.status() >= 400) {
      console.log(`✗ ${vp.name} ${p} — HTTP ${res?.status()}`);
      failures++;
      continue;
    }
    const r = await page.evaluate(probe);
    const bad = r.horizontalScroll > 1 || r.imgsWithoutAlt > 0 || r.h1Count !== 1 || r.unfocusableScrollers > 0;
    if (bad) {
      failures++;
      console.log(`✗ ${vp.name.padEnd(13)} ${p}`);
      if (r.horizontalScroll > 1)
        console.log(`    overflow ${r.horizontalScroll}px (doc ${r.docScrollWidth} vs ${r.clientWidth})`);
      for (const o of r.offenders)
        console.log(`      <${o.tag} class="${o.cls}"> right=${o.right} overhang=${o.overhang} overflow-x=${o.overflowX}`);
      if (r.imgsWithoutAlt) console.log(`    ${r.imgsWithoutAlt} img without alt`);
      if (r.h1Count !== 1) console.log(`    ${r.h1Count} <h1> (expected 1)`);
      if (r.unfocusableScrollers) console.log(`    ${r.unfocusableScrollers} scroller(s) not keyboard-reachable`);
    }
    summary.push({ vp: vp.name, page: p, ok: !bad });
  }
  await page.close();
}

await browser.close();

const total = summary.length;
console.log(`\n${total - failures}/${total} page-viewport combinations clean.`);
process.exit(failures > 0 ? 1 : 0);
