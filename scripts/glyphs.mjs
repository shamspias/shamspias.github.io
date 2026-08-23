/**
 * Asserts that the mono webfont file actually contains the characters the ASCII
 * diagrams are drawn with.
 *
 *   npm run build && node scripts/glyphs.mjs
 *
 * Why this exists, and why it checks the binary rather than the rendered page:
 *
 * The corpus draws its diagrams with 1,657 box-drawing characters, 155 block
 * elements and 197 arrows. A `latin`-subset webfont usually does not contain
 * any of them, so they resolve from whatever monospace font the visitor's
 * system provides. On macOS that is Menlo, whose advance is 0.6em, identical to
 * the webfont's, so the drawings look perfect and the bug is invisible. On a
 * machine that falls back to Consolas (0.55em) the same drawings shear.
 *
 * Measuring the rendered page therefore proves nothing except what the machine
 * running the test happens to have installed. The only platform-independent
 * check is whether the glyph is in the file, so that is what is asserted here.
 */
import { globSync, readFileSync } from 'node:fs';

const FONT_DIR = 'dist/_astro/fonts';

/** Every non-ASCII character that appears inside a <pre> anywhere in the corpus. */
const SETS = {
  'box drawing': '─│┌┐└┘├┤┬┴┼═╪╭╮╯╰╱╲',
  'block elements': '█▏▎▌░▒▓',
  geometric: '▲▼●○▪◄',
  arrows: '←↑→↓↔↕⇒',
  'math operators': '∀∃∈√∧∨∩∪≈≠≤≥∆−×',
  greek: 'αβγδεθλπσμ',
  'sub/superscript': '₀₁₂₃₄₅⁺²³',
  marks: '✓✔✗',
};

// fontkit is a namespace export, with no default.
const fontkit = await import('fontkit');

const files = globSync(`${FONT_DIR}/*.woff2`);
if (files.length === 0) {
  console.log(`no fonts in ${FONT_DIR} — run \`npm run build\` first`);
  process.exit(1);
}

/**
 * The face under test is the one the diagrams are set in.
 *
 * Advance-width uniformity looked like the principled way to find it, but it is
 * not a test: Noto Naskh Arabic carries latin glyphs at a single advance too, so
 * it was picked up and then failed for lacking box-drawing characters it has no
 * business carrying. The mono family is named in astro.config.mjs, so name it
 * here as well and assert it was found.
 */
const MONO_FAMILY = /commit\s*mono/i;
const monos = [];
for (const f of files) {
  let font;
  try {
    font = fontkit.create(readFileSync(f));
  } catch {
    continue;
  }
  const adv = (c) => {
    const g = font.layout(c).glyphs[0];
    return g ? g.advanceWidth : null;
  };
  if (!MONO_FAMILY.test(font.familyName ?? '')) continue;

  // Having found it by name, still check it is monospaced: a diagram drawn with
  // a proportional face shears, and that is the failure this script exists for.
  const probe = [...'0WimlM.@#'].map(adv);
  const first = probe[0];
  if (!first || !probe.every((w) => w === first)) {
    console.log(`\n${font.familyName}: latin advances are not uniform, so diagrams will shear`);
    monos.push({ file: f, font, advance: first ?? 0, upm: font.unitsPerEm, glyphs: font.numGlyphs });
    continue;
  }
  monos.push({ file: f, font, advance: first, upm: font.unitsPerEm, glyphs: font.numGlyphs });
}

if (monos.length === 0) {
  console.log(`no face matching ${MONO_FAMILY} among the emitted fonts`);
  process.exit(1);
}

let failures = 0;

for (const m of monos) {
  const name = m.font.familyName ?? m.file.split('/').pop();
  console.log(
    `\n${name}  (${m.file.split('/').pop()})\n  ${m.glyphs} glyphs, ${m.advance}/${m.upm} advance = ${(m.advance / m.upm).toFixed(3)}em`,
  );

  const has = (c) => {
    const g = m.font.layout(c).glyphs;
    return g.length > 0 && g[0].id !== 0;
  };

  for (const [label, chars] of Object.entries(SETS)) {
    const missing = [...chars].filter((c) => !has(c));
    const ok = missing.length === 0;
    if (!ok) failures++;
    console.log(
      `  ${ok ? 'ok  ' : 'FAIL'} ${label.padEnd(18)} ${[...chars].length - missing.length}/${[...chars].length}` +
        (ok ? '' : `   missing: ${missing.join(' ')}`),
    );
  }

  // Uniform advance across the diagram characters, inside the file itself.
  const advances = new Set(
    ['0', '─', '█', '→', '≤', 'α'].filter(has).map((c) => m.font.layout(c).glyphs[0].advanceWidth),
  );
  const uniform = advances.size === 1;
  if (!uniform) failures++;
  console.log(
    `  ${uniform ? 'ok  ' : 'FAIL'} uniform advance    ${[...advances].join(', ')}`,
  );
}

console.log(
  failures === 0
    ? '\nThe mono face carries every diagram character itself. Nothing falls back.'
    : `\n${failures} problem(s). Diagram characters will resolve from the visitor's system font, whose advance may not match.`,
);
process.exit(failures > 0 ? 1 : 0);
