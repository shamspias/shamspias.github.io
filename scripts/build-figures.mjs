/**
 * Draws the figures that box-drawing characters cannot.
 *
 *   node scripts/build-figures.mjs      (runs from `npm run assets`)
 *
 * The site draws most of its diagrams in a fenced block, which is the right
 * medium for a pipeline or a funnel. These are the few that need real geometry:
 * a helical wheel is trigonometry, a scaffold split is a scatter, a skeleton is
 * a skeleton. Each is written as a plain SVG in the site's two inks, using
 * `currentColor` for every stroke so the plate follows the theme.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const OUT = path.resolve(import.meta.dirname, '..', 'public', 'figures');
const ACCENT = '#a8290f';

const svg = (w, h, body, title) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${title}" fill="none" stroke="currentColor" font-family="ui-monospace, monospace">
${body}
</svg>
`;

/* ------------------------------------------------------------------------ *
 * 1. The helical wheel.
 *
 * An alpha helix turns 100 degrees per residue, so residue i and residue i+3
 * or i+4 land on nearly the same side. Plotting a sequence around a circle at
 * 100 degrees a step is the only honest way to show why a peptide can have a
 * greasy face and a charged face at once, and it is exactly the periodicity
 * that CKSAAP's k=2 and k=3 gaps detect.
 * ------------------------------------------------------------------------ */

function helicalWheel() {
  const seq = 'GLFDIIKKIAESF';
  const HYDROPHOBIC = new Set('AVLIMFWYC');
  const POSITIVE = new Set('KRH');
  const NEGATIVE = new Set('DE');

  const cx = 210, cy = 210, r = 132;
  const parts = [];

  parts.push(`  <circle cx="${cx}" cy="${cy}" r="${r}" stroke="currentColor" stroke-opacity="0.18"/>`);

  const pts = [...seq].map((aa, i) => {
    const deg = -90 + i * 100;
    const rad = (deg * Math.PI) / 180;
    return { aa, i, x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  });

  // The backbone path, so the reader can follow the order round the wheel.
  parts.push(
    `  <path d="${pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')}" stroke="currentColor" stroke-opacity="0.28" stroke-width="1"/>`,
  );

  for (const p of pts) {
    const greasy = HYDROPHOBIC.has(p.aa);
    const charged = POSITIVE.has(p.aa) || NEGATIVE.has(p.aa);
    parts.push(`  <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="15"
    fill="${greasy ? 'currentColor' : 'none'}" fill-opacity="${greasy ? 0.1 : 0}"
    stroke="${charged ? ACCENT : 'currentColor'}" stroke-width="${charged ? 1.6 : 1.1}"/>`);
    parts.push(`  <text x="${p.x.toFixed(1)}" y="${(p.y + 4.5).toFixed(1)}" text-anchor="middle"
    font-size="14" font-weight="600" stroke="none"
    fill="${charged ? ACCENT : 'currentColor'}">${p.aa}</text>`);
    parts.push(`  <text x="${p.x.toFixed(1)}" y="${(p.y - 21).toFixed(1)}" text-anchor="middle"
    font-size="8.5" stroke="none" fill="currentColor" fill-opacity="0.5">${p.i + 1}</text>`);
  }

  // The two faces, named on the side each actually falls on. Which side that
  // is comes out of the 100-degree step, so the labels are derived from the
  // plotted points rather than assumed.
  const mean = (set) => {
    const xs = pts.filter((p) => set(p.aa));
    return xs.reduce((a, p) => a + p.x, 0) / xs.length;
  };
  const greasyRight = mean((a) => HYDROPHOBIC.has(a)) > cx;
  const label = (text, right, colour, opacity) => {
    const x = right ? 414 : 6;
    const anchor = right ? 'end' : 'start';
    return `  <text x="${x}" y="${cy + 4}" text-anchor="${anchor}" font-size="10.5"
    letter-spacing="1.6" stroke="none" fill="${colour}" fill-opacity="${opacity}"
    transform="rotate(${right ? 90 : -90} ${x} ${cy})">${text}</text>`;
  };
  parts.push(label('GREASY FACE', greasyRight, 'currentColor', 0.6));
  parts.push(label('CHARGED FACE', !greasyRight, ACCENT, 0.85));
  parts.push(`  <text x="${cx}" y="${cy - 4}" text-anchor="middle" font-size="10.5" letter-spacing="1.4"
    stroke="none" fill="currentColor" fill-opacity="0.45">100° PER</text>`);
  parts.push(`  <text x="${cx}" y="${cy + 12}" text-anchor="middle" font-size="10.5" letter-spacing="1.4"
    stroke="none" fill="currentColor" fill-opacity="0.45">RESIDUE</text>`);

  return svg(420, 420, parts.join('\n'), 'Helical wheel of the peptide GLFDIIKKIAESF');
}

/* ------------------------------------------------------------------------ *
 * 2. Random split against scaffold split.
 *
 * Two panels of the same chemical space. Under a random split a test point sits
 * inside a cluster the model has already memorised; under a scaffold split
 * whole clusters are held out. This is the difference between 0.94 and 0.78,
 * and a scatter is the only way to see it.
 * ------------------------------------------------------------------------ */

function scaffoldSplit() {
  // Deterministic pseudo-random, so the figure is byte-identical on every build.
  let seed = 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);

  const clusters = [
    { x: 62, y: 66 }, { x: 150, y: 48 }, { x: 108, y: 132 },
    { x: 188, y: 122 }, { x: 60, y: 168 }, { x: 168, y: 196 },
  ];
  const points = clusters.flatMap((c, ci) =>
    Array.from({ length: 9 }, () => ({
      ci,
      x: c.x + (rnd() - 0.5) * 46,
      y: c.y + (rnd() - 0.5) * 42,
    })),
  );

  const panel = (ox, title, isTest) => {
    const out = [
      `  <text x="${ox}" y="20" font-size="10.5" letter-spacing="1.6" stroke="none"
    fill="currentColor" fill-opacity="0.6">${title}</text>`,
      `  <rect x="${ox}" y="32" width="250" height="230" stroke="currentColor" stroke-opacity="0.2"/>`,
    ];
    for (const p of points) {
      const test = isTest(p);
      const x = (ox + 8 + p.x * 0.92).toFixed(1);
      const y = (40 + p.y * 0.9).toFixed(1);
      out.push(
        `  <circle cx="${x}" cy="${y}" r="4.4" stroke="${test ? ACCENT : 'currentColor'}"
    stroke-opacity="${test ? 1 : 0.45}" fill="${test ? ACCENT : 'none'}" fill-opacity="${test ? 0.9 : 0}"/>`,
      );
    }
    return out.join('\n');
  };

  const L = 8, R = 304; // panel origins, with a margin so nothing clips
  const body = [
    // Left: test points scattered inside every cluster.
    panel(L, 'RANDOM SPLIT', (p) => (p.x * 7 + p.y * 3) % 5 < 1),
    // Right: two whole clusters held out.
    panel(R, 'SCAFFOLD SPLIT', (p) => p.ci === 2 || p.ci === 5),
    `  <text x="${L}" y="288" font-size="11" stroke="none" fill="currentColor" fill-opacity="0.62">a test point sits beside one it has seen</text>`,
    `  <text x="${R}" y="288" font-size="11" stroke="none" fill="currentColor" fill-opacity="0.62">whole scaffolds held out, nothing to lean on</text>`,
    `  <text x="${L}" y="308" font-size="11.5" stroke="none" fill="${ACCENT}">ROC-AUC 0.94</text>`,
    `  <text x="${R}" y="308" font-size="11.5" stroke="none" fill="${ACCENT}">ROC-AUC 0.78</text>`,
  ].join('\n');

  return svg(596, 322, body, 'Random split against scaffold-clustered split');
}

/* ------------------------------------------------------------------------ *
 * 3. The four angles of a bowling action.
 *
 * A stick figure at front-foot contact with the four measured angles marked.
 * Box drawing cannot draw a body.
 * ------------------------------------------------------------------------ */

function bowlingAngles() {
  const J = {
    head: [196, 44], neck: [196, 74], shoulderR: [166, 86], shoulderL: [226, 86],
    elbowR: [140, 132], wristR: [150, 76], hipR: [176, 168], hipL: [214, 168],
    kneeF: [246, 232], ankleF: [258, 300], kneeB: [150, 236], ankleB: [116, 300],
  };
  const p = (k) => J[k].join(',');
  const line = (a, b, w = 2, o = 1) =>
    `  <line x1="${J[a][0]}" y1="${J[a][1]}" x2="${J[b][0]}" y2="${J[b][1]}" stroke="currentColor" stroke-width="${w}" stroke-opacity="${o}" stroke-linecap="round"/>`;

  const body = [
    `  <line x1="60" y1="300" x2="340" y2="300" stroke="currentColor" stroke-opacity="0.25"/>`,
    `  <circle cx="${J.head[0]}" cy="${J.head[1]}" r="17" stroke="currentColor" stroke-width="2"/>`,
    line('neck', 'shoulderR'), line('neck', 'shoulderL'),
    line('neck', 'hipR', 2, 0.9), line('hipR', 'hipL'),
    line('shoulderR', 'elbowR'), line('elbowR', 'wristR'),
    line('hipL', 'kneeF'), line('kneeF', 'ankleF'),
    line('hipR', 'kneeB', 2, 0.5), line('kneeB', 'ankleB', 2, 0.5),
    // the four measurements
    `  <path d="M232,206 A28,28 0 0,1 262,214" stroke="${ACCENT}" stroke-width="1.6"/>`,
    `  <text x="272" y="222" font-size="11" stroke="none" fill="${ACCENT}">front knee 150-180°</text>`,
    `  <path d="M132,110 A26,26 0 0,0 146,100" stroke="${ACCENT}" stroke-width="1.6"/>`,
    `  <text x="18" y="112" font-size="11" stroke="none" fill="${ACCENT}">elbow 160-180°</text>`,
    `  <path d="M196,96 A34,34 0 0,1 210,124" stroke="${ACCENT}" stroke-width="1.6"/>`,
    `  <text x="228" y="128" font-size="11" stroke="none" fill="${ACCENT}">trunk lean 0-30°</text>`,
    `  <path d="M170,86 A30,30 0 0,1 200,80" stroke="${ACCENT}" stroke-width="1.6" stroke-dasharray="3 3"/>`,
    `  <text x="18" y="66" font-size="11" stroke="none" fill="${ACCENT}">shoulder 20-50°</text>`,
    `  <text x="60" y="330" font-size="10.5" letter-spacing="1.6" stroke="none"
    fill="currentColor" fill-opacity="0.55">FRONT-FOOT CONTACT</text>`,
  ].join('\n');

  return svg(432, 348, body, 'The four angles measured at front-foot contact');
}

await mkdir(OUT, { recursive: true });

const figures = {
  'helical-wheel.svg': helicalWheel(),
  'scaffold-split.svg': scaffoldSplit(),
  'bowling-angles.svg': bowlingAngles(),
};

for (const [name, contents] of Object.entries(figures)) {
  await writeFile(path.join(OUT, name), contents, 'utf8');
}

console.log(`figures: ${Object.keys(figures).join(', ')}`);
