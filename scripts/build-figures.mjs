/**
 * Generates every figure on the site.
 *
 *   node scripts/build-figures.mjs      (runs from `npm run assets`)
 *
 * Most diagrams here are drawn in box-drawing characters inside a code fence,
 * which is the right medium for a pipeline or a small comparison. These are the
 * ones that are not: real geometry, four orders of magnitude, a curve against a
 * second curve on a different scale. Anything a monospace grid draws well stays
 * in the prose.
 *
 * Every number below also appears in the prose beside its figure. Change one
 * and change both, or the page starts arguing with itself.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  ACCENT,
  INK,
  barsH,
  dualSeries,
  eyebrow,
  funnel,
  groupedBarsH,
  layers,
  lollipop,
  path as svgPath,
  rule,
  svg,
  text,
} from './figures/kit.mjs';

const OUT = path.resolve(import.meta.dirname, '..', 'public', 'figures');
const figures = {};

/* ====================================================================== *
 * Biomechanics from Video
 * ====================================================================== */

/* Part 1. The whole argument of the series is that these rows cannot be
   collapsed into one number, so the figure has to show them as rows. */
figures['scorecard-configurations.svg'] = groupedBarsH({
  title: 'Share of joint-angle readings within tolerance of 3D ground truth',
  seriesLabels: ['within 5°', 'within 10°', 'within 15°'],
  max: 100,
  rows: [
    { label: 'Multi-view, calibrated, athlete marked', values: [75, 92, 96] },
    { label: 'Multi-view, calibrated', values: [67, 83, 87] },
    { label: 'Multi-view, canonical rig', values: [42, 58, 66] },
    { label: 'Monocular, athlete marked', values: [35, 57, 70] },
    { label: 'Monocular, single camera', values: [31, 52, 64] },
    { label: 'Monocular, frames it reads as side-on', values: [52, 74, 83], accent: true },
  ],
});

/* Part 2. An error is a position on a scale, not a quantity of stuff, so dots
   and not bars. Bias sits beside magnitude because together they say what
   neither says alone: noisy but unbiased, so frames average out and a single
   frame does not. */
figures['detector-cost-in-degrees.svg'] = lollipop({
  title: 'What the detector’s pixel error costs, in clinical degrees',
  unit: '°',
  decimals: 2,
  rows: [
    { label: 'Shoulder flexion', value: 5.11, bias: -0.33 },
    { label: 'Hip flexion', value: 6.6, bias: -0.25 },
    { label: 'Knee flexion', value: 7.31, bias: -0.78 },
    { label: 'Elbow flexion', value: 10.49, bias: -0.28, accent: true },
  ],
});

/* Part 5. The result that looks backwards. The story is entirely in the first
   and last pairs, so nothing else is highlighted. */
figures['obliquity-banding.svg'] = groupedBarsH({
  title: 'The same monocular readings, banded two ways',
  seriesLabels: ['by true obliquity', 'by the estimate'],
  max: 36,
  unit: '°',
  labelW: 150,
  rows: [
    { label: '0 to 15°', values: [12.79, 7.69], accent: true },
    { label: '15 to 30°', values: [11.99, 11.13] },
    { label: '30 to 45°', values: [16.32, 14.18] },
    { label: '45 to 60°', values: [20.7, 20.72] },
    { label: '60 to 75°', values: [26.33, 26.11] },
    { label: '75 to 90°', values: [34.63, 26.7] },
  ],
});

/* Part 6. The entire point is that the two lines move in opposite directions,
   so a reader looking at either alone is misled. */
figures['calibration-sensitivity.svg'] = dualSeries({
  title: 'Calibration error becomes missing data, not wrong data',
  categories: ['perfect', '5 cm / 2°', '10 cm / 5°', '20 cm / 10°', '40 cm / 15°'],
  left: { label: 'joint-angle MAE', values: [0.0, 0.78, 2.11, 5.37, 6.46], unit: '°', accent: true },
  right: { label: 'frames surviving the gate', values: [100, 30, 14, 6, 3], unit: '%' },
});

/* Part 6. Angles barely separate the variants, millimetres separate them
   decisively, and reprojection error moves the wrong way. */
figures['dlt-weighting-ablation.svg'] = dualSeries({
  title: 'Confidence-weighted triangulation, scored three ways',
  categories: ['plain DLT', 'confidence', 'depth', 'confidence + depth'],
  left: { label: 'PA-MPJPE, millimetres', values: [40.5, 49.8, 40.8, 60.3], unit: ' mm', accent: true },
  right: { label: 'reprojection error, pixels', values: [3.21, 2.97, 3.18, 2.97], unit: ' px' },
  zero: false,
  h: 250,
});

/* Part 7. The refusal. The argument is visible in the shape: two orders of
   magnitude between a limb the camera can see and one pointing at it. */
figures['flexion-observability.svg'] = barsH({
  title: 'Shoulder-flexion error by how much of the limb the camera can see',
  unit: '°',
  decimals: 2,
  labelW: 226,
  threshold: { at: 10, label: 'clinical threshold' },
  rows: [
    { label: '0.80 and above', value: 4.69, note: '93.8% of readings' },
    { label: '0.60 to 0.80', value: 16.25, note: '3.4%' },
    { label: '0.45 to 0.60', value: 8.69, note: '1.2%' },
    { label: '0.30 to 0.45', value: 81.17, note: '0.5%', accent: true },
    { label: '0.15 to 0.30', value: 28.18, note: '0.6%' },
    { label: 'below 0.15', value: 122.38, note: '0.4%', accent: true },
  ],
});

/* Part 8. Authority drawn as what it is: a chain in which nothing is added. */
figures['kinetix-authority.svg'] = layers({
  title: 'The agent inherits authority. It is never granted any.',
  inflow: 'HTTP request, session cookie',
  outflow: 'the same rows the REST route would have written',
  rows: [
    { n: '1', label: 'CurrentUser', detail: 'UserID, OrganizationID, Role, LinkedAthleteID', note: 'built by middleware, copied into the run' },
    { n: '2', label: 'Permission gate', detail: 'offered only if the role already holds the permission', note: '60 tools, filtered per user' },
    { n: '3', label: 'Confirm gate', detail: 'every mutating tool pauses until the user approves it', note: '29 of the 60, default-deny', accent: true },
    { n: '4', label: 'The real service', detail: 'tenant scoping, self-scoping, sign-off gating, validation', note: 'the agent cannot see these, only obey them' },
    { n: '5', label: 'Audit', detail: 'every call persisted, then streamed to the UI', note: 'append-only' },
  ],
});

/* ====================================================================== *
 * Machine Learning for Biology
 * ====================================================================== */

figures['screening-funnel.svg'] = funnel({
  title: 'From every catalogued natural product to a shortlist a lab can afford',
  stages: [
    { label: 'COCONUT, as downloaded', value: 400000 },
    { label: 'valid and standardised', value: 390000, note: 'drop invalid, duplicate' },
    { label: 'plausible physicochemistry', value: 180000, note: 'permissive drug-likeness' },
    { label: 'ML-prioritised, top 1%', value: 1800, note: 'per-virus model' },
    { label: 'clean chemistry', value: 1200, note: 'PAINS, toxicophores' },
    { label: 'scaffold-diverse', value: 300, note: 'cap per Murcko scaffold' },
    { label: 'structurally plausible', value: 60, note: 'docking, at or below -8.0' },
    { label: 'candidates for the bench', value: 20, note: 'catalytic-site contact' },
  ],
});

figures['descriptor-dimensions.svg'] = barsH({
  title: 'Hand-crafted peptide descriptors, by dimension',
  labelW: 232,
  rows: [
    { label: 'CKSAAP, pairs at 0 to 3 gaps', value: 1600, accent: true },
    { label: 'DPC, adjacent pairs', value: 400 },
    { label: 'DDE, surprising pairs', value: 400 },
    { label: 'CTD, class composition', value: 147 },
    { label: 'autocorrelation', value: 96 },
    { label: 'QSO, quasi-sequence order', value: 80 },
    { label: 'PAAC, pseudo composition', value: 50 },
    { label: 'AAC, letter counts', value: 20 },
    { label: 'physicochemical', value: 20 },
  ],
});

figures['honest-negatives.svg'] = barsH({
  title: 'Reported accuracy, and what each setup actually measures',
  unit: '%',
  labelW: 252,
  max: 100,
  rows: [
    { label: 'Published predictor A', value: 92, note: 'length, mostly' },
    { label: 'Published predictor B', value: 88, note: 'length, mostly' },
    { label: 'A length-only decision stump', value: 90, note: 'length, entirely' },
    { label: 'IEDB-validated negatives', value: 76, note: 'anti-inflammatory activity', accent: true },
  ],
});

/* ====================================================================== *
 * Agent Harness
 * ====================================================================== */

figures['harness-layers.svg'] = layers({
  title: 'What a harness is: five answers a model cannot give itself',
  inflow: '"refund order 8842 and tell the customer"',
  outflow: 'your application code, then the database',
  rows: [
    { n: '1', label: 'Capability surface', detail: 'what may be done at all', note: 'your verbs, typed' },
    { n: '2', label: 'Meaning', detail: 'what each operation is for', note: 'names and docstrings' },
    { n: '3', label: 'Policy', detail: 'whether this caller may do it now', note: 'read or write, principal' },
    { n: '4', label: 'Approval', detail: 'whether a human signs it first', note: 'default-deny', accent: true },
    { n: '5', label: 'Audit', detail: 'what actually happened', note: 'append-only' },
  ],
});

/* ====================================================================== *
 * Bespoke geometry: the figures that are not charts
 * ====================================================================== */

/* A helical wheel is trigonometry. An alpha helix turns 100 degrees per residue,
   so residues i and i+3 or i+4 land on the same side, which is exactly the
   periodicity CKSAAP detects at k=2 and k=3 without being told a helix exists. */
function helicalWheel() {
  const seq = 'GLFDIIKKIAESF';
  const HYDROPHOBIC = new Set('AVLIMFWYC');
  const CHARGED = new Set('KRHDE');
  const cx = 214, cy = 214, r = 134;
  const out = [`  <circle cx="${cx}" cy="${cy}" r="${r}" stroke="${INK}" stroke-opacity="0.16" fill="none"/>`];

  const pts = [...seq].map((aa, i) => {
    const rad = ((-90 + i * 100) * Math.PI) / 180;
    return { aa, i, x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  });

  out.push(svgPath(pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '), { opacity: 0.22, width: 1 }));

  for (const p of pts) {
    const greasy = HYDROPHOBIC.has(p.aa);
    const charged = CHARGED.has(p.aa);
    out.push(
      `  <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="15.5" fill="${greasy ? INK : 'none'}" fill-opacity="${greasy ? 0.11 : 0}" stroke="${charged ? ACCENT : INK}" stroke-opacity="${charged ? 0.9 : 0.4}" stroke-width="${charged ? 1.7 : 1.1}"/>`,
    );
    out.push(text(p.x, p.y + 4.6, p.aa, { anchor: 'middle', size: 14, weight: 600, fill: charged ? ACCENT : INK, opacity: charged ? 1 : 0.92 }));
    out.push(text(p.x, p.y - 22, p.i + 1, { anchor: 'middle', size: 8.5, opacity: 0.45 }));
  }

  // Which side each face falls on is a consequence of the 100-degree step, so
  // the labels are derived from the plotted points rather than assumed.
  const meanX = (pred) => {
    const s = pts.filter((p) => pred(p.aa));
    return s.reduce((a, p) => a + p.x, 0) / s.length;
  };
  const greasyRight = meanX((a) => HYDROPHOBIC.has(a)) > cx;
  const side = (t, right, fill, op) =>
    text(right ? 420 : 8, cy, t, {
      anchor: 'middle', size: 10.5, track: 1.7, caps: true, fill, opacity: op,
      rotate: right ? 90 : -90,
    });
  out.push(side('greasy face', greasyRight, INK, 0.55));
  out.push(side('charged face', !greasyRight, ACCENT, 0.85));
  out.push(text(cx, cy - 4, '100° per', { anchor: 'middle', size: 10.5, track: 1.3, opacity: 0.4, caps: true }));
  out.push(text(cx, cy + 12, 'residue', { anchor: 'middle', size: 10.5, track: 1.3, opacity: 0.4, caps: true }));

  // Title above, caption below, same as every generated chart: the wheel is
  // drawn against its own origin and then shifted down to make room.
  // Wider than the wheel needs, because the two rotated face labels sit at the
  // extreme left and right and a rotated glyph is centred on its baseline.
  const w = 470;
  const title = 'A helical wheel: which face each side chain lands on';
  // The wheel is drawn with its own margin, so it needs very little clearance
  // under the title.
  const wheelTop = 2;
  const h = wheelTop + 374;
  return svg({
    w,
    h,
    title,
    body: [
      eyebrow(0, 13, title),
      `<g transform="translate(21,${wheelTop})">`,
      out.join('\n'),
      '</g>',
    ].join('\n'),
  });
}

/* Two panels of the same chemical space. Under a random split a held-out
   molecule sits inside a cluster the model memorised; under a scaffold split
   whole clusters are held out. A scatter is the only honest way to show it. */
function scaffoldSplit() {
  let seed = 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const clusters = [
    { x: 62, y: 66 }, { x: 150, y: 48 }, { x: 108, y: 132 },
    { x: 188, y: 122 }, { x: 60, y: 168 }, { x: 168, y: 196 },
  ];
  const points = clusters.flatMap((c, ci) =>
    Array.from({ length: 9 }, () => ({ ci, x: c.x + (rnd() - 0.5) * 46, y: c.y + (rnd() - 0.5) * 42 })),
  );
  const panel = (ox, heading, isTest) => {
    const o = [eyebrow(ox, 16, heading), `  <rect x="${ox}" y="30" width="250" height="228" stroke="${INK}" stroke-opacity="0.18" fill="none"/>`];
    for (const p of points) {
      const t = isTest(p);
      o.push(
        `  <circle cx="${(ox + 8 + p.x * 0.92).toFixed(1)}" cy="${(38 + p.y * 0.9).toFixed(1)}" r="4.4" stroke="${t ? ACCENT : INK}" stroke-opacity="${t ? 1 : 0.42}" fill="${t ? ACCENT : 'none'}" fill-opacity="${t ? 0.9 : 0}"/>`,
      );
    }
    return o.join('\n');
  };
  const L = 8, R = 306;
  const w = 620;
  const title = 'The same molecules, split two ways';
  const panelTop = 26;
  const h = panelTop + 318;
  const body = [
    eyebrow(0, 13, title),
    `<g transform="translate(0,${panelTop})">`,
    panel(L, 'random split', (p) => (p.x * 7 + p.y * 3) % 5 < 1),
    panel(R, 'scaffold split', (p) => p.ci === 2 || p.ci === 5),
    text(L, 284, 'a test point sits beside one it has seen', { size: 11.5, opacity: 0.6 }),
    text(R, 284, 'whole scaffolds held out, nothing to lean on', { size: 10.8, opacity: 0.6 }),
    text(L, 305, 'ROC-AUC 0.94', { size: 12, fill: ACCENT, weight: 600 }),
    text(R, 305, 'ROC-AUC 0.78', { size: 12, fill: ACCENT, weight: 600 }),
    '</g>',
  ].join('\n');
  return svg({ w, h, title, body });
}

/* A skeleton is a skeleton. */
function bowlingAngles() {
  const J = {
    head: [196, 46], neck: [196, 76], shoulderR: [166, 88], shoulderL: [226, 88],
    elbowR: [140, 134], wristR: [150, 78], hipR: [176, 170], hipL: [214, 170],
    kneeF: [246, 234], ankleF: [258, 302], kneeB: [150, 238], ankleB: [116, 302],
  };
  const seg = (a, b, o = {}) =>
    svgPath(`M${J[a][0]},${J[a][1]} L${J[b][0]},${J[b][1]}`, { width: 2.1, opacity: 1, ...o });
  const body = [
    rule(58, 302, 344, 302, { opacity: 0.22 }),
    `  <circle cx="${J.head[0]}" cy="${J.head[1]}" r="17" stroke="${INK}" stroke-width="2" fill="none"/>`,
    seg('neck', 'shoulderR'), seg('neck', 'shoulderL'),
    seg('neck', 'hipR', { opacity: 0.9 }), seg('hipR', 'hipL'),
    seg('shoulderR', 'elbowR'), seg('elbowR', 'wristR'),
    seg('hipL', 'kneeF'), seg('kneeF', 'ankleF'),
    seg('hipR', 'kneeB', { opacity: 0.42 }), seg('kneeB', 'ankleB', { opacity: 0.42 }),
    svgPath('M232,208 A28,28 0 0,1 262,216', { colour: ACCENT, width: 1.7 }),
    text(272, 224, 'front knee 150 to 180°', { size: 11.5, fill: ACCENT }),
    svgPath('M132,112 A26,26 0 0,0 146,102', { colour: ACCENT, width: 1.7 }),
    text(6, 110, 'elbow 160 to 180°', { size: 11.5, fill: ACCENT }),
    rule(126, 108, 133, 110, { opacity: 0.5, colour: ACCENT }),
    svgPath('M196,98 A34,34 0 0,1 210,126', { colour: ACCENT, width: 1.7 }),
    text(228, 130, 'trunk lean 0 to 30°', { size: 11.5, fill: ACCENT }),
    svgPath('M170,88 A30,30 0 0,1 200,82', { colour: ACCENT, width: 1.7, dash: '3 3' }),
    text(6, 62, 'shoulder 20 to 50°', { size: 11.5, fill: ACCENT }),
    // The shoulder arc sits behind the bowling arm, so its label needs a leader
    // to say which mark it belongs to. The other three sit beside their arcs.
    rule(128, 60, 168, 80, { opacity: 0.5, colour: ACCENT }),
  ].join('\n');
  // The drawing is authored against its own origin; the title is set above it.
  return svg({
    w: 440,
    h: 344,
    title: 'The four angles measured at front-foot contact',
    body: `${eyebrow(0, 13, 'The four angles measured at front-foot contact')}\n<g transform="translate(0,28)">\n${body}\n</g>`,
  });
}

figures['helical-wheel.svg'] = helicalWheel();
figures['scaffold-split.svg'] = scaffoldSplit();
figures['bowling-angles.svg'] = bowlingAngles();

/* ---------------------------------------------------------------------- */

await mkdir(OUT, { recursive: true });
for (const [name, contents] of Object.entries(figures)) {
  await writeFile(path.join(OUT, name), contents, 'utf8');
}
console.log(`figures: ${Object.keys(figures).length}`);
for (const n of Object.keys(figures).sort()) console.log(`  ${n}`);
