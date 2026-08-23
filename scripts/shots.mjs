/**
 * Screenshot sheet for design review.
 *
 *   node scripts/shots.mjs <outDir> [baseUrl]
 *
 * Uses real CDP viewport emulation rather than --window-size, which macOS
 * clamps to a minimum width and silently renders a wider layout than asked for.
 */
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const OUT = process.argv[2] ?? './shots';
const BASE = process.argv[3] ?? 'http://127.0.0.1:4321';
const CHROME =
  process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const SHOTS = [
  { name: 'home-light', url: '/', w: 1440, h: 1100, theme: 'light', full: false },
  { name: 'home-dark', url: '/', w: 1440, h: 1100, theme: 'dark', full: false },
  { name: 'home-2560', url: '/', w: 2560, h: 1400, theme: 'light', full: false },
  { name: 'home-3840', url: '/', w: 3840, h: 1600, theme: 'light', full: false },
  { name: 'home-390', url: '/', w: 390, h: 1400, theme: 'light', full: false },
  { name: 'post-light', url: '/posts/2026/02/honest-negatives-peptide-benchmark/', w: 1440, h: 1500, theme: 'light', full: false },
  { name: 'post-dark', url: '/posts/2026/02/honest-negatives-peptide-benchmark/', w: 1440, h: 1500, theme: 'dark', full: false },
  { name: 'post-2560', url: '/posts/2026/03/screening-400k-natural-products/', w: 2560, h: 1400, theme: 'light', full: false },
  { name: 'post-390', url: '/posts/2026/02/honest-negatives-peptide-benchmark/', w: 390, h: 1500, theme: 'light', full: false },
  { name: 'post-768', url: '/posts/2026/02/honest-negatives-peptide-benchmark/', w: 768, h: 1400, theme: 'light', full: false },
  { name: 'writing', url: '/writing/', w: 1440, h: 1500, theme: 'light', full: false },
  { name: 'writing-390', url: '/writing/', w: 390, h: 1400, theme: 'light', full: false },
  { name: 'series', url: '/series/', w: 1440, h: 1400, theme: 'light', full: false },
  { name: 'cv', url: '/cv/', w: 1440, h: 1600, theme: 'light', full: false },
  { name: 'cv-390', url: '/cv/', w: 390, h: 1500, theme: 'light', full: false },
  { name: 'projects', url: '/projects/', w: 1440, h: 1400, theme: 'light', full: false },
  { name: 'tags', url: '/tags/', w: 1440, h: 1200, theme: 'light', full: false },
  { name: 'notfound', url: '/404.html', w: 1440, h: 900, theme: 'light', full: false },
  { name: 'tables-and-code', url: '/posts/2026/01/protein-language-models/', w: 1440, h: 1600, theme: 'light', full: false },
  { name: 'ascii-diagram', url: '/posts/2025/12/safe-by-default-agents/', w: 1440, h: 1500, theme: 'light', full: false },
];

await mkdir(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--hide-scrollbars', '--force-device-scale-factor=1', '--no-sandbox'],
});

for (const s of SHOTS) {
  const page = await browser.newPage();
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: s.theme }]);
  await page.setViewport({ width: s.w, height: s.h, deviceScaleFactor: 1 });
  await page.goto(BASE + s.url, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts?.ready);
  await new Promise((r) => setTimeout(r, 120));
  await page.screenshot({ path: path.join(OUT, `${s.name}.png`), fullPage: s.full });
  await page.close();
  console.log(`${s.name.padEnd(18)} ${s.w}x${s.h} ${s.theme} ${s.url}`);
}

await browser.close();
