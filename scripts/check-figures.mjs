/**
 * Checks the generated figures for the two faults that are invisible in the
 * source and obvious on the page.
 *
 *   node scripts/check-figures.mjs
 *
 * 1. A text node that runs past the viewBox. SVG does not wrap or clip, so the
 *    label is simply gone.
 * 2. Two text nodes sitting on top of each other. This is what happens when a
 *    value label and an annotation are positioned from different anchors and
 *    the data brings them together.
 *
 * Both are measured rather than eyeballed. The figures are set in a monospaced
 * face, so the advance is a known constant of 0.6em plus whatever letter
 * spacing the node carries, and a box can be computed without a renderer.
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const DIR = 'public/figures';
const ADVANCE = 0.6;

const attr = (tag, name) => {
  const m = tag.match(new RegExp(`\\b${name}="([^"]*)"`));
  return m ? m[1] : null;
};

/** The box a <text> node occupies, in user units. */
function boxOf(tag, body) {
  const x = Number(attr(tag, 'x') ?? 0);
  const y = Number(attr(tag, 'y') ?? 0);
  const size = Number(attr(tag, 'font-size') ?? 11);
  const track = Number(attr(tag, 'letter-spacing') ?? 0);
  const anchor = attr(tag, 'text-anchor') ?? 'start';
  const w = body.length * (size * ADVANCE + track);
  const left = anchor === 'end' ? x - w : anchor === 'middle' ? x - w / 2 : x;
  // Cap height and descender, near enough for a collision test.
  return { x0: left, x1: left + w, y0: y - size * 0.78, y1: y + size * 0.26, body };
}

const overlap = (a, b) =>
  a.x1 > b.x0 + 1 && b.x1 > a.x0 + 1 && a.y1 > b.y0 + 1 && b.y1 > a.y0 + 1;

let problems = 0;
const files = readdirSync(DIR).filter((f) => f.endsWith('.svg')).sort();

for (const file of files) {
  const raw = readFileSync(path.join(DIR, file), 'utf8');
  const [, vbW, vbH] = raw.match(/viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/).map(Number);

  // A caption drawn after a translated group is not inside it, so groups are
  // tracked as a stack over the tags in document order rather than by position.
  const boxes = [];
  const stack = [{ dx: 0, dy: 0 }];
  const tokens = raw.matchAll(/<g\b([^>]*)>|<\/g>|<text\b([^>]*)>([^<]*)<\/text>/g);

  for (const t of tokens) {
    const [full, gAttrs, textAttrs, body] = t;
    if (full === '</g>') {
      if (stack.length > 1) stack.pop();
      continue;
    }
    if (gAttrs !== undefined) {
      const m = gAttrs.match(/translate\(\s*([-\d.]+)[ ,]*([-\d.]*)\s*\)/);
      const top = stack[stack.length - 1];
      stack.push({ dx: top.dx + Number(m?.[1] || 0), dy: top.dy + Number(m?.[2] || 0) });
      continue;
    }
    if (/transform="rotate/.test(textAttrs)) continue; // measured on the wrong axis
    const { dx, dy } = stack[stack.length - 1];
    const b = boxOf(full, body);
    b.x0 += dx; b.x1 += dx; b.y0 += dy; b.y1 += dy;
    boxes.push(b);
    if (b.x1 > vbW + 1 || b.x0 < -1 || b.y1 > vbH + 1 || b.y0 < -1) {
      console.log(`  ${file}\n    outside the viewBox: "${body}"`);
      problems++;
    }
  }

  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      if (overlap(boxes[i], boxes[j])) {
        console.log(`  ${file}\n    labels overlap: "${boxes[i].body}" / "${boxes[j].body}"`);
        problems++;
      }
    }
  }
}

console.log(
  problems === 0
    ? `\n${files.length} figures, no clipped or overlapping labels.`
    : `\n${files.length} figures, ${problems} problem(s).`,
);
process.exit(problems > 0 ? 1 : 0);
