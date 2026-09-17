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
  bar,
  barsH,
  dot,
  dualSeries,
  eyebrow,
  funnel,
  groupedBarsH,
  layers,
  lineChart,
  lollipop,
  path as svgPath,
  rule,
  svg,
  text,
  wrapText,
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

/* ====================================================================== *
 * Open Knowledge Format
 * ====================================================================== */

/* The whole argument for a shared format is arithmetic: four producers and
   four consumers are sixteen private integrations, or eight if they agree on
   one file layout first. Wires are the only honest way to draw that, because
   the point is the count of lines, not a quantity. */
function okfWiring() {
  const w = 760;
  const title = 'Why a shared format at all: sixteen wires, or eight';
  const sources = ['wiki pages', 'data catalog', 'code comments', 'dashboards'];
  const agents = ['chat assistant', 'coding agent', 'search index', 'analyst bot'];
  const boxW = 118, boxH = 30, step = 44, top = 56;
  const rowY = (i) => top + i * step;
  const mid = (i) => rowY(i) + boxH / 2;

  const node = (x, i, label, o = {}) => [
    bar(x, rowY(i), boxW, boxH, { fill: INK, opacity: 0.05, stroke: INK, strokeOpacity: 0.26, ...o }),
    text(x + 9, rowY(i) + 19, label, { size: 10.5, opacity: 0.8 }),
  ].join('\n');

  const out = [eyebrow(0, 13, title)];

  /* Left: every consumer reads every producer in that producer's own shape. */
  out.push(eyebrow(0, 36, 'one integration per pair'));
  sources.forEach((s, i) => out.push(node(0, i, s)));
  agents.forEach((a, i) => out.push(node(232, i, a)));
  for (let i = 0; i < sources.length; i++) {
    for (let j = 0; j < agents.length; j++) {
      out.push(rule(118, mid(i), 232, mid(j), { opacity: 0.16 }));
    }
  }
  out.push(text(0, 250, '4 x 4 = 16 wires to write and keep alive', { size: 11.5, opacity: 0.62 }));

  /* Right: the same eight boxes, with the format in the middle. */
  const ox = 400;
  out.push(eyebrow(ox, 36, 'one integration per side'));
  sources.forEach((s, i) => out.push(node(ox, i, s)));
  agents.forEach((a, i) => out.push(node(ox + 242, i, a)));
  const hubX = ox + 160, hubY = rowY(1) + 8, hubW = 64, hubH = 74;
  out.push(bar(hubX, hubY, hubW, hubH, { fill: ACCENT, opacity: 0.1, stroke: ACCENT, strokeOpacity: 0.6 }));
  out.push(text(hubX + hubW / 2, hubY + 36, 'OKF', { anchor: 'middle', size: 12, weight: 600, fill: ACCENT }));
  out.push(text(hubX + hubW / 2, hubY + 52, 'files', { anchor: 'middle', size: 10.5, fill: ACCENT, opacity: 0.7 }));
  sources.forEach((_, i) => out.push(rule(ox + boxW, mid(i), hubX, hubY + hubH / 2, { opacity: 0.3 })));
  agents.forEach((_, i) => out.push(rule(hubX + hubW, hubY + hubH / 2, ox + 242, mid(i), { opacity: 0.3 })));
  out.push(text(ox, 250, '4 + 4 = 8 wires, and the format is the contract', { size: 11.5, fill: ACCENT, opacity: 0.9 }));

  return svg({ w, h: 266, title, body: out.join('\n') });
}

/* One file, annotated. A reader who sees this once can write OKF, which is the
   entire claim the format makes about itself, so the figure has to be the file
   and not a diagram of the file. */
function okfAnatomy() {
  const w = 760;
  const title = 'One concept file, line by line';
  const boxW = 464;
  const top = 44;
  const lineH = 21;
  const annX = 496;

  const rows = [
    { t: '---', fm: true },
    { t: 'type: BigQuery Table', fm: true, note: 'the one field OKF insists on', accent: true },
    { t: 'title: Customer Orders', fm: true, note: 'a name a person would say' },
    { t: 'description: One row per order.', fm: true, note: 'one sentence, for previews' },
    { t: 'resource: https://console.../orders', fm: true, note: 'where the real thing lives' },
    { t: 'tags: [sales, revenue]', fm: true },
    { t: 'generated: { by: agent, at: ... }', fm: true, note: 'who wrote it, and when' },
    { t: 'verified: { by: human:sam, at: ... }', fm: true, note: 'who checked it, and when' },
    { t: '---', fm: true },
    { t: '# Schema' },
    { t: '| order_id | STRING | Order id. |' },
    { t: 'Joins [customers](/tables/customers.md).', note: 'a link is a relationship' },
  ];

  const out = [eyebrow(0, 13, title)];
  const fmCount = rows.filter((r) => r.fm).length;
  out.push(bar(0, top - 6, boxW, fmCount * lineH + 4, { fill: INK, opacity: 0.05 }));
  out.push(bar(0, top - 2 + fmCount * lineH, boxW, (rows.length - fmCount) * lineH + 2, { fill: INK, opacity: 0.02 }));
  out.push(text(annX, top + 8, 'FRONTMATTER: yaml, for machines', { size: 10.5, track: 1.4, opacity: 0.5 }));
  out.push(text(annX, top + 8 + fmCount * lineH, 'BODY: markdown, for people', { size: 10.5, track: 1.4, opacity: 0.5 }));

  rows.forEach((r, i) => {
    const y = top + 8 + i * lineH;
    out.push(text(14, y, r.t, { size: 11, opacity: r.accent ? 1 : 0.78, fill: r.accent ? ACCENT : INK, weight: r.accent ? 600 : 400 }));
    if (r.note) {
      out.push(rule(boxW + 6, y - 4, annX - 8, y - 4, { opacity: 0.22 }));
      out.push(text(annX, y, r.note, { size: 10.5, opacity: 0.6, fill: r.accent ? ACCENT : INK }));
    }
  });

  const h = top + 8 + rows.length * lineH + 10;
  return svg({ w, h, title, body: out.join('\n') });
}

figures['okf-wiring.svg'] = okfWiring();
figures['okf-anatomy.svg'] = okfAnatomy();

/* Trust is not a score in OKF, it is a tier a reader derives from one optional
   field. Three rows, because there are exactly three. */
figures['okf-trust-tiers.svg'] = layers({
  title: 'Three trust tiers, read straight off the verified field',
  inflow: 'one optional frontmatter field: verified',
  outflow: 'a signal for the reader, never a permission check',
  rows: [
    { n: '1', label: 'Unverified', detail: 'no verified field at all', note: 'usable, but nobody vouched for it' },
    { n: '2', label: 'Machine confirmed', detail: 'verified by an agent or a process', note: 'a job checked it against the source' },
    { n: '3', label: 'Human reviewed', detail: 'verified by an actor with the human: prefix', note: 'a person put their name on it', accent: true },
  ],
});

/* The attested-computation loop, in the order a consumer meets it. Six steps
   is two too many for box drawing once each step needs a note. */
figures['okf-attestation.svg'] = layers({
  title: 'What an attested computation adds: a number you can check',
  inflow: '"what was revenue in 2026?"',
  outflow: 'the number, plus evidence of the job that produced it',
  rows: [
    { n: '1', label: 'Discover', detail: 'find the Attested Computation concept', note: 'by its type field' },
    { n: '2', label: 'Load', detail: 'read the contract and the computation', note: 'frontmatter, then the code fence' },
    { n: '3', label: 'Parameterize', detail: 'the agent fills only the declared holes', note: 'year = 2026, and nothing else' },
    { n: '4', label: 'Execute', detail: 'the executor runs it, returns a receipt', note: 'job id, the query that really ran' },
    { n: '5', label: 'Attest', detail: 'plain code judges the receipt', note: 'no model gets a vote here', accent: true },
    { n: '6', label: 'Gate', detail: 'refuse to show a number that failed', note: 'or one past its stale_after' },
  ],
});

/* ====================================================================== *
 * Retrieval and RAG
 * ====================================================================== */

/* PageIndex retrieves by walking a document's own table of contents, so the
   figure has to be the walk: which subtrees the model opens, which it prunes
   unread, and how few pages survive. An indented tree is the shape the reader
   already knows from a book. */
function pageIndexTree() {
  const w = 760;
  const title = 'One question walking a document tree';
  const rows = [
    { d: 0, label: 'Annual Report 2023', pages: 'pp. 1 to 214', open: true, note: 'the tree, not the text' },
    { d: 1, label: 'Supervision and Regulation', pages: 'pp. 5 to 21', open: false },
    { d: 1, label: 'Financial Stability', pages: 'pp. 21 to 31', open: true },
    { d: 2, label: 'Monitoring Financial Vulnerabilities', pages: 'pp. 22 to 28', open: true, hit: true, note: 'read these 7 pages' },
    { d: 2, label: 'International Cooperation', pages: 'pp. 28 to 31', open: false },
    { d: 1, label: 'Monetary Policy', pages: 'pp. 31 to 75', open: false },
    { d: 1, label: 'Statistical Tables', pages: 'pp. 180 to 214', open: false },
  ];
  const top = 54, rowH = 32, indent = 26, pagesX = 462, askX = 496, noteX = 604;
  const out = [eyebrow(0, 13, title)];
  out.push(eyebrow(0, 36, 'section'));
  out.push(eyebrow(pagesX, 36, 'pages', { anchor: 'end' }));
  out.push(eyebrow(askX, 36, 'look inside?'));

  rows.forEach((r, i) => {
    const y = top + i * rowH;
    const x = 8 + r.d * indent;
    const colour = r.hit ? ACCENT : INK;
    // The connector is drawn from the row above at the parent's indent, which
    // is what makes the nesting readable without boxes.
    if (r.d > 0) {
      const px = 8 + (r.d - 1) * indent + 5;
      out.push(rule(px, y - rowH + 6, px, y - 4, { opacity: 0.22 }));
      out.push(rule(px, y - 4, x - 4, y - 4, { opacity: 0.22 }));
    }
    out.push(text(x, y, r.label, {
      size: 11.5,
      opacity: r.open ? (r.hit ? 1 : 0.88) : 0.42,
      fill: colour,
      weight: r.hit ? 600 : 400,
    }));
    out.push(text(pagesX, y, r.pages, { size: 10.5, anchor: 'end', opacity: r.open ? 0.6 : 0.32 }));
    out.push(text(askX, y, r.open ? 'yes' : 'no', {
      size: 10.5, track: 1.2, caps: true,
      fill: r.open ? ACCENT : INK,
      opacity: r.open ? 0.9 : 0.4,
    }));
    if (r.note) out.push(text(noteX, y, r.note, { size: 10.5, opacity: 0.55, fill: colour }));
  });

  const foot = top + rows.length * rowH + 12;
  out.push(rule(0, foot - 20, w, foot - 20, { opacity: 0.16 }));
  out.push(text(0, foot + 2, '214 pages in the document, 7 pages in the prompt, and a route you can print', { size: 11.5, opacity: 0.62 }));
  return svg({ w, h: foot + 14, title, body: out.join('\n') });
}

figures['pageindex-tree.svg'] = pageIndexTree();

/* The published OSS benchmark, with cost kept beside accuracy because reading
   either alone sells the method. Every figure is from the benchmark's own
   table; the last three points cost twenty-two times the first ninety-seven. */
figures['pageindex-cost-accuracy.svg'] = barsH({
  title: 'PageIndex OSS benchmark: 62 text questions over 34 PDFs',
  unit: '%',
  decimals: 1,
  max: 100,
  labelW: 214,
  rows: [
    { label: 'luna, no reasoning', value: 85.5, note: '$0.0031 per question' },
    { label: 'luna, medium', value: 91.9, note: '$0.0038' },
    { label: 'luna, high', value: 96.8, note: '$0.0036', accent: true },
    { label: 'terra, medium', value: 98.4, note: '$0.0303' },
    { label: 'terra, high', value: 100.0, note: '$0.0325' },
    { label: 'sol, medium', value: 100.0, note: '$0.0810', accent: true },
  ],
});

/* GraphRAG's index is a graph, and the thing that makes it work is not the
   graph but what sits on top of it: a hierarchy of LLM-written reports, one
   per community, that can be read without asking a question at all. Nodes and
   rings on the left, the report hierarchy they produce on the right. */
function graphCommunities() {
  const w = 760;
  const title = 'What the index actually is: clusters, then reports about clusters';
  // A fixed seed, because a figure that redraws differently on every build is
  // a figure nobody can review.
  let seed = 11;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const clusters = [
    { x: 96, y: 118 }, { x: 268, y: 96 }, { x: 108, y: 244 }, { x: 286, y: 236 },
  ];
  const nodes = clusters.flatMap((c, ci) =>
    Array.from({ length: 6 }, () => ({
      ci,
      x: c.x + (rnd() - 0.5) * 74,
      y: c.y + (rnd() - 0.5) * 70,
    })),
  );
  const out = [eyebrow(0, 13, title)];
  out.push(eyebrow(0, 36, 'entities and relationships'));
  out.push(eyebrow(470, 36, 'one report per community'));

  // Edges: dense inside a cluster, sparse between them. That contrast is the
  // whole reason community detection finds anything.
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const same = nodes[i].ci === nodes[j].ci;
      if (same ? rnd() < 0.5 : rnd() < 0.02) {
        out.push(rule(nodes[i].x, nodes[i].y, nodes[j].x, nodes[j].y, { opacity: same ? 0.26 : 0.3, dash: same ? null : '3 3' }));
      }
    }
  }
  clusters.forEach((c) =>
    out.push(`  <circle cx="${c.x}" cy="${c.y}" r="60" stroke="${ACCENT}" stroke-opacity="0.5" stroke-dasharray="4 4" fill="none"/>`),
  );
  nodes.forEach((n) => out.push(dot(n.x, n.y, 4.4, { fill: INK, opacity: 0.7 })));

  // The report hierarchy: four leaf communities, merged upward twice. Row
  // labels sit in their own gutter so no connector ever crosses a word.
  const box = (x, y, bw, label) =>
    [bar(x, y, bw, 24, { fill: ACCENT, opacity: 0.1, stroke: ACCENT, strokeOpacity: 0.5 }),
     text(x + bw / 2, y + 16, label, { size: 10.5, anchor: 'middle', fill: ACCENT, opacity: 0.95 })].join('\n');

  const leafY = 66, midY = 158, rootY = 250, labelX = 512;
  const leafX = [520, 580, 640, 700];
  leafX.forEach((x, i) => out.push(box(x, leafY, 52, `C${i + 1}`)));
  out.push(box(526, midY, 100, 'merged'));
  out.push(box(646, midY, 100, 'merged'));
  out.push(box(556, rootY, 160, 'root report'));
  leafX.forEach((x, i) => out.push(rule(x + 26, leafY + 24, i < 2 ? 576 : 696, midY, { opacity: 0.3 })));
  out.push(rule(576, midY + 24, 636, rootY, { opacity: 0.3 }));
  out.push(rule(696, midY + 24, 636, rootY, { opacity: 0.3 }));

  out.push(text(labelX, leafY + 16, 'one per cluster', { size: 10.5, anchor: 'end', opacity: 0.55 }));
  out.push(text(labelX, midY + 16, 'summarised again', { size: 10.5, anchor: 'end', opacity: 0.55 }));
  out.push(text(labelX, rootY + 16, 'the whole corpus', { size: 10.5, anchor: 'end', opacity: 0.55 }));

  const h = 330;
  out.push(text(0, h - 8, 'A global question is answered from the reports, never from the raw text', { size: 11.5, opacity: 0.62 }));
  return svg({ w, h, title, body: out.join('\n') });
}

figures['graphrag-communities.svg'] = graphCommunities();

/* The paper's Table 3, which is the number that decides whether any of this is
   affordable: answering from root reports reads 2.6% of the corpus, and the
   quality it gives up is small. Every value is from the Podcast dataset row. */
figures['graphrag-context-tokens.svg'] = barsH({
  title: 'Tokens read to answer one global question, Podcast corpus',
  labelW: 236,
  rows: [
    { label: 'Source text, summarised', value: 1014611, note: '1,669 chunks, the whole corpus' },
    { label: 'Level 3 communities', value: 746100, note: '1,310 reports' },
    { label: 'Level 2 communities', value: 565720, note: '969 reports' },
    { label: 'Level 1 communities', value: 225756, note: '367 reports' },
    { label: 'Root communities', value: 26657, note: '34 reports, 2.6% of the text', accent: true },
  ],
});

/* The parsing argument is impossible to make in prose, because the damage is
   visual: a table that survives as a grid can be queried, and the same table
   flattened into a sentence cannot. Two panels of the same page. */
function parsingTwoWays() {
  const w = 760;
  const title = 'The same page, parsed two ways';
  const out = [eyebrow(0, 13, title)];
  const top = 60;

  out.push(eyebrow(0, 38, 'text dump'));
  const dump = [
    'Segment revenue 2024 2025 Product',
    '412 501 Services 188 211 Total 600',
    '712 see note 7 for the restatement',
  ];
  dump.forEach((l, i) => out.push(text(0, top + 4 + i * 22, l, { size: 11, opacity: 0.7 })));
  out.push(text(0, top + 92, 'rows and columns are gone', { size: 10.5, opacity: 0.55 }));
  out.push(text(0, top + 112, 'nothing knows which page it was on', { size: 10.5, opacity: 0.55 }));

  out.push(eyebrow(400, 38, 'structure-aware parse'));
  const cols = [400, 512, 604, 696];
  const rows = ['Segment,2024,2025', 'Product,412,501', 'Services,188,211', 'Total,600,712'];
  rows.forEach((r, i) => {
    const y = top - 12 + i * 26;
    const cells = r.split(',');
    if (i === 0) out.push(bar(cols[0], y, cols[3] + 56 - cols[0], 26, { fill: INK, opacity: 0.06 }));
    out.push(rule(cols[0], y + 26, cols[3] + 56, y + 26, { opacity: 0.16 }));
    cells.forEach((c, j) =>
      out.push(text(j === 0 ? cols[0] + 6 : cols[j] + 46, y + 17, c, {
        size: 11,
        anchor: j === 0 ? 'start' : 'end',
        opacity: i === 0 ? 0.85 : 0.72,
        weight: i === 0 ? 600 : 400,
      })),
    );
  });
  out.push(rule(cols[0], top - 12, cols[0], top + 92, { opacity: 0.16 }));
  out.push(text(400, top + 112, 'cells keep their row, column and page', { size: 10.5, opacity: 0.55, fill: ACCENT }));

  const h = top + 150;
  out.push(rule(0, h - 30, w, h - 30, { opacity: 0.16 }));
  out.push(text(0, h - 10, 'Only one of these can answer: what were services in 2025?', { size: 11.5, opacity: 0.62 }));
  return svg({ w, h, title, body: out.join('\n') });
}

figures['parsing-two-ways.svg'] = parsingTwoWays();

/* Docling's pipeline, in the order a page meets it. Each stage is a place the
   document can lose something a retriever later needs. */
figures['docling-pipeline.svg'] = layers({
  title: 'What has to happen before a retriever ever sees the text',
  inflow: 'a 200-page PDF nobody can query',
  outflow: 'text a retriever can index, with page numbers still attached',
  rows: [
    { n: '1', label: 'Read', detail: 'open the file, page by page', note: 'PDF, DOCX, PPTX, HTML, images' },
    { n: '2', label: 'Layout', detail: 'find the blocks and their reading order', note: 'a model trained on DocLayNet' },
    { n: '3', label: 'Tables', detail: 'recover rows, columns and spans', note: 'the TableFormer model' },
    { n: '4', label: 'Text', detail: 'OCR when there is no text layer to read', note: 'or one VLM for the whole page' },
    { n: '5', label: 'Assemble', detail: 'one document object, with provenance', note: 'body tree, texts, tables, pictures', accent: true },
    { n: '6', label: 'Export', detail: 'markdown, HTML, DocTags or lossless JSON', note: 'now chunk it by structure' },
  ],
});

/* Vector memory is arithmetic, not opinion, and the arithmetic is published:
   these are Elasticsearch's own per-vector formulas at 1,024 dimensions with
   the HNSW graph (m=16) included. The graph is the small term, which is why
   tuning it saves nothing and quantising saves everything. */
figures['vector-memory.svg'] = barsH({
  title: 'RAM for one million 1,024-dimension vectors, HNSW graph included',
  labelW: 250,
  unit: ' GiB',
  decimals: 2,
  rows: [
    { label: 'float32, the default', value: 3.87, note: '4 bytes per dimension' },
    { label: 'int8 scalar quantised', value: 1.02, note: '1 byte per dimension, plus 4' },
    { label: 'int4', value: 0.54, note: 'half a byte, plus 4' },
    { label: 'binary, with rescoring', value: 0.19, note: '1 bit, plus 14 bytes', accent: true },
  ],
});

/* The trade nobody looks at: on the same million vectors, an inverted-file
   index is a hundredth of the graph's memory and more accurate, and pays for
   it in latency. Every number is from Faiss's own published measurements. */
figures['index-memory-tradeoff.svg'] = barsH({
  title: 'Index memory on one million SIFT vectors, beyond the 512 MB of vectors',
  labelW: 234,
  unit: ' MB',
  decimals: 0,
  rows: [
    { label: 'HNSW graph', value: 796, note: '0.081 s per query, recall 0.820' },
    { label: 'IVF, 16,384 lists', value: 8, note: '0.538 s per query, recall 0.898', accent: true },
  ],
});

/* The k in reciprocal rank fusion, as the paper that introduced it actually
   measured it. Bars of near-identical length are the finding: the constant
   the whole industry ships is not the peak, and the choice barely matters. */
figures['rrf-k-sweep.svg'] = barsH({
  title: 'Mean average precision against the RRF constant, from the 2009 paper',
  labelW: 96,
  decimals: 4,
  max: 0.22,
  rows: [
    { label: 'k = 0', value: 0.2072, note: 'no smoothing at all' },
    { label: 'k = 10', value: 0.2123 },
    { label: 'k = 20', value: 0.2134 },
    { label: 'k = 30', value: 0.2139 },
    { label: 'k = 40', value: 0.2138 },
    { label: 'k = 50', value: 0.2144 },
    { label: 'k = 60', value: 0.2145, note: 'the value everyone ships' },
    { label: 'k = 70', value: 0.2146 },
    { label: 'k = 80', value: 0.2147, note: 'the actual peak', accent: true },
    { label: 'k = 90', value: 0.2145 },
    { label: 'k = 100', value: 0.2142 },
  ],
});

figures['helical-wheel.svg'] = helicalWheel();
figures['scaffold-split.svg'] = scaffoldSplit();
figures['bowling-angles.svg'] = bowlingAngles();

/* ====================================================================== *
 * Mixture of Experts
 * ====================================================================== */

/* Part 3. The pruning recipe, in the order the work happens. Six steps, each
   with a note, which is past what box drawing carries. The two accented rows
   are the ones that decide whether the pruned model is any good. */
figures['expert-pruning-recipe.svg'] = layers({
  title: 'Expert pruning, in the order the work happens',
  inflow: 'one MoE model, the whole school, and a month of real bank traffic',
  outflow: 'the same model, minus the experts your traffic never woke',
  rows: [
    { n: '1', label: 'Collect', detail: 'real questions in every language and intent, no answers', note: 'a few hundred thousand tokens is plenty' },
    { n: '2', label: 'Trace', detail: 'run it once, log which experts each token used, per layer', note: 'router logits and gate weights, every layer' },
    { n: '3', label: 'Score', detail: 'how often chosen, how much weight, how much it changed y', note: 'frequency, gate x activation, or reconstruction' },
    { n: '4', label: 'Choose', detail: 'keep the top experts per layer; never touch shared experts', note: 'the keep-count can differ by layer', accent: true },
    { n: '5', label: 'Rewire and heal', detail: 'router picks top-k among survivors; short LoRA fine-tune', note: 'a few thousand steps on your own data' },
    { n: '6', label: 'Verify', detail: 'held-out questions, each language, against the full model', note: 'the step people skip, and the one that matters', accent: true },
  ],
});

/* Part 3. Lu et al. (2024), Table 3. The same model, the same number of
   experts removed, and the only thing that changes between the plain and the
   accented bar is which text the pruner watched while deciding. */
figures['pruning-calibration-gsm8k.svg'] = barsH({
  title: 'Mixtral 8x7B on GSM8K after expert pruning, by what the pruner watched',
  unit: '%',
  decimals: 2,
  max: 70,
  labelW: 236,
  rows: [
    { label: 'All 8 experts', value: 58.61, note: 'nothing removed' },
    { label: 'Keep 6, watched web text', value: 41.02, note: 'C4' },
    { label: 'Keep 6, watched maths', value: 51.25, note: 'MATH train set', accent: true },
    { label: 'Keep 4, watched web text', value: 24.87, note: 'C4' },
    { label: 'Keep 4, watched maths', value: 37.07, note: 'MATH train set', accent: true },
  ],
});

/* Part 3. Measured here with each model's own tokenizer.json on six banking
   questions, each written in English and in Bangla. The English bars are the
   same length in every row, which is the point: the model did not get
   worse at English, it got a different alphabet. */
figures['bangla-tokens.svg'] = groupedBarsH({
  title: 'Tokens for six banking questions, the same six in English and in Bangla',
  seriesLabels: ['English, 106 words', 'Bangla, 83 words'],
  max: 560,
  labelW: 214,
  rows: [
    { label: 'Gemma 3 4B, 262k vocabulary', values: [118, 120], accent: true },
    { label: 'Qwen3 4B, 152k vocabulary', values: [118, 468] },
    { label: 'Llama 3.2 3B, 128k vocabulary', values: [118, 534] },
  ],
});

/* Part 3. The teacher-student recipe. Seven steps, and the two accented
   rows are the checks: grading the teacher's answers, and comparing the
   student with the teacher afterwards. Everything else is plumbing. */
figures['teacher-student-recipe.svg'] = layers({
  title: 'Teacher and student, in the order the work happens',
  inflow: 'every question a customer might ask, written down first',
  outflow: 'a 4B model that answers your questions the way the big one did',
  rows: [
    { n: '1', label: 'Ask', detail: 'thousands of questions: logs, paraphrases, both languages', note: 'the dataset is the product; spend here' },
    { n: '2', label: 'Answer', detail: 'the big model answers, with the same RAG the student gets', note: 'same retrieved context, same prompt shape' },
    { n: '3', label: 'Check', detail: 'grade every answer; drop anything wrong or unverified', note: 'a second model, then people on a sample', accent: true },
    { n: '4', label: 'Build', detail: 'question, retrieved context, answer, in the serving format', note: 'plus refusals and hand-offs' },
    { n: '5', label: 'Pick', detail: 'a 2B to 4B model whose tokenizer handles your language', note: 'measure tokens per word before anything else' },
    { n: '6', label: 'Train', detail: 'LoRA on the student, a few epochs, low learning rate', note: 'one 24 GB GPU is enough' },
    { n: '7', label: 'Compare', detail: 'held-out questions, student against teacher, per language', note: 'then quantise, and test again', accent: true },
  ],
});

/* Part 3. Bytes per parameter is arithmetic, and the two pruned rows use the
   reductions Lu et al. measured on this exact model. The student rows are the
   argument: pruning takes you from one node to one node; a student takes you
   to one card. */
figures['memory-ladder.svg'] = barsH({
  title: 'Weights you must hold in memory, in gigabytes',
  unit: ' GB',
  decimals: 0,
  labelW: 268,
  rows: [
    { label: 'Mixtral 8x7B, all 8 experts, bf16', value: 93, note: '46.7B parameters' },
    { label: 'Mixtral 8x7B, 6 of 8 experts', value: 71, note: '24% smaller' },
    { label: 'Mixtral 8x7B, 4 of 8 experts', value: 49, note: '48% smaller' },
    { label: 'Gemma 3 4B student, bf16', value: 9, note: 'one consumer GPU', accent: true },
    { label: 'Gemma 3 4B student, 4-bit', value: 3, note: 'a laptop', accent: true },
  ],
});

/* Part 3. Three questions, asked in order, and where each answer sends you.
   A flowchart is the one shape a decision has; the reader should be able to
   put a finger on the top box and follow it down without reading the post. */
function chooseYourRoute() {
  const w = 760;
  const title = 'Which route, decided by three questions';
  const qW = 392, qH = 62, oX = 460, oW = 300, step = 110, top = 44;
  const rows = [
    {
      q: 'Does the job need the whole model?', d: 'open-ended questions, many subjects, hard reasoning',
      side: 'yes', down: 'no',
      o: 'Keep the big model', on: 'prune lightly, heal, verify',
    },
    {
      q: 'How much smaller must it get?', d: 'compare the weights to the memory you actually have',
      side: '2 to 4x', down: '10x or more',
      o: 'Prune experts', on: 'calibrate on your traffic, every language',
    },
    {
      q: 'Can you write down the questions?', d: 'thousands of them, with a teacher to answer each',
      side: 'no', down: 'yes',
      o: 'Prune hard, or pick a smaller MoE', on: 'no answers to write, but expect a heal step',
    },
  ];
  const out = [eyebrow(0, 13, title)];

  const box = (x, y, bw, bh, label, note, accent) => [
    bar(x, y, bw, bh, {
      fill: accent ? ACCENT : INK, opacity: accent ? 0.1 : 0.05,
      stroke: accent ? ACCENT : INK, strokeOpacity: accent ? 0.55 : 0.24,
    }),
    text(x + 14, y + 24, label, { size: 11.5, weight: 600, fill: accent ? ACCENT : INK, opacity: accent ? 0.98 : 0.85 }),
    text(x + 14, y + 42, note, { size: 10.5, opacity: 0.58, fill: accent ? ACCENT : INK }),
  ].join('\n');

  rows.forEach((r, i) => {
    const y = top + i * step;
    out.push(box(0, y, qW, qH, r.q, r.d, false));
    out.push(box(oX, y, oW, qH, r.o, r.on, false));
    // Sideways: the answer that leaves the ladder.
    out.push(rule(qW, y + qH / 2, oX, y + qH / 2, { opacity: 0.3 }));
    out.push(text((qW + oX) / 2, y + qH / 2 - 6, r.side, { size: 10, anchor: 'middle', track: 1.2, caps: true, opacity: 0.6 }));
    // Down: the answer that asks the next question.
    out.push(rule(14, y + qH, 14, y + step, { opacity: 0.3 }));
    out.push(svgPath(`M10,${y + step - 7} L14,${y + step} L18,${y + step - 7}`, { opacity: 0.3, width: 1.2 }));
    out.push(text(24, y + qH + 30, r.down, { size: 10, track: 1.2, caps: true, opacity: 0.6 }));
  });

  const y = top + rows.length * step;
  out.push(box(0, y, qW, qH, 'Teach a student', 'pick it by tokenizer; quantise last; test every language', true));
  const h = y + qH + 14;
  return svg({ w, h, title, body: out.join('\n') });
}

figures['choose-your-route.svg'] = chooseYourRoute();

/* Part 3. Salary day, as arithmetic. Qwen3-235B-A22B has 94 layers and 4
   key-value heads of 128 dimensions, so one token of KV cache is
   2 x 94 x 4 x 128 x 2 bytes, 192,512 bytes, and one conversation holding
   4,096 tokens keeps 0.79 GB of it on the GPU. The weights are the small
   bar, which is the surprise the story turns on. */
figures['salary-day.svg'] = barsH({
  title: 'What a thousand conversations in flight need in GPU memory, Qwen3-235B-A22B',
  unit: ' GB',
  decimals: 0,
  max: 900,
  labelW: 262,
  threshold: { at: 640, label: 'one node, 8 x 80 GB' },
  rows: [
    { label: 'Weights, fp8', value: 235, note: '235B parameters, one byte each' },
    { label: 'KV cache, 100 conversations', value: 79, note: '4,096 tokens each, bf16' },
    { label: 'KV cache, 1,000 conversations', value: 789, note: 'the same, ten times over', accent: true },
  ],
});

/* Part 3. The eight weeks, so a reader can hold the whole story in one
   look before any of it is explained. The two accented rows are the two
   bad days, which are also the two days anything was learned. */
figures['bank-story.svg'] = layers({
  title: 'Eight weeks at the bank, in the order it happened',
  inflow: 'a demo that went too well',
  outflow: 'a 4B student on cheap cards, and the big model kept for the hard ones',
  rows: [
    { n: '1', label: 'Week 1. The biggest brain', detail: 'rent the largest open MoE there is; the demo is perfect', note: 'one customer at a time' },
    { n: '2', label: 'Week 4. Salary day', detail: 'a thousand customers at once; memory, latency, then anger', note: 'weights plus KV cache beat one node', accent: true },
    { n: '3', label: 'Week 5. The meeting', detail: '"send the poets home"; no poets, but a usage table', note: 'part 1, section 4' },
    { n: '4', label: 'Week 6. Pruning', detail: 'delete the experts traffic never wakes; English tests pass', note: 'memory down by a quarter, or half' },
    { n: '5', label: 'Week 6. The Bangla demo', detail: 'the pruned, quantised model answers in confetti', note: 'no expert holds a language', accent: true },
    { n: '6', label: 'Week 7. The answer book', detail: 'the big model answers every question; people check them', note: 'the dataset is the product' },
    { n: '7', label: 'Week 8. The student', detail: 'a 4B model trained on the checked book, tested in Bangla', note: '9 GB of weights on a 24 GB card' },
  ],
});

/* ---- Part 3, the story pictures. Drawn, not charted, because each one is
   a scene: a building, a crowd, a row of doors, a broom, scissors, a book.
   Colour rules as everywhere else: ink at opacities, the accent only on the
   thing the sentence beside the picture is about. ---- */

const BANGLA = 'Kohinoor Bangla, Nirmala UI, Vrinda, Noto Sans Bengali, sans-serif';
/* A text node in a face that has Bengali glyphs. The kit's text() is mono on
   purpose; this is the one place the figures need another script. */
const bangla = (x, y, str, o = {}) => {
  const { size = 12, anchor = 'start', fill = INK, opacity = 1, weight = 400 } = o;
  const safe = String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `  <text x="${x}" y="${y}" text-anchor="${anchor}" font-family="${BANGLA}" font-size="${size}" font-weight="${weight}" stroke="none" fill="${fill}" fill-opacity="${opacity}">${safe}</text>`;
};
const person = (x, y, o = {}) => {
  const { colour = INK, opacity = 0.7, scale = 1 } = o;
  const s = scale;
  return [
    `  <circle cx="${x}" cy="${y}" r="${7 * s}" stroke="${colour}" stroke-opacity="${opacity}" stroke-width="1.6" fill="none"/>`,
    svgPath(`M${x},${y + 7 * s} L${x},${y + 30 * s} M${x - 11 * s},${y + 17 * s} L${x + 11 * s},${y + 17 * s} M${x},${y + 30 * s} L${x - 9 * s},${y + 46 * s} M${x},${y + 30 * s} L${x + 9 * s},${y + 46 * s}`, { colour, opacity, width: 1.6 }),
  ].join('\n');
};
const seeded = (seed) => () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);

/* The model as a building. Seven of the 94 floors, 32 cells standing for the
   128 rooms on each, eight lit per floor for the same token, never the same
   eight twice. Everything unlit is still on the payroll. */
function schoolOfExperts() {
  const w = 760;
  const title = 'One question walks up the school';
  const floors = ['floor 94', 'floor 93', 'floor 92', null, 'floor 3', 'floor 2', 'floor 1'];
  const top = 44, rowH = 30, x0 = 150, cell = 14, gap = 4, n = 32;
  const rnd = seeded(3);
  const out = [eyebrow(0, 13, title)];
  floors.forEach((f, i) => {
    const y = top + i * rowH;
    if (!f) {
      out.push(text(x0 + (n * (cell + gap)) / 2, y + 12, '· · · eighty-seven more floors · · ·', { size: 10, anchor: 'middle', opacity: 0.4, track: 1 }));
      return;
    }
    out.push(text(x0 - 12, y + 11, f, { size: 10.5, anchor: 'end', opacity: 0.55, track: 1, caps: true }));
    const lit = new Set();
    while (lit.size < 8) lit.add(Math.floor(rnd() * n));
    for (let c = 0; c < n; c++) {
      const x = x0 + c * (cell + gap);
      const on = lit.has(c);
      out.push(bar(x, y, cell, cell, { fill: on ? ACCENT : INK, opacity: on ? 0.9 : 0.07, stroke: on ? null : INK, strokeOpacity: 0.16 }));
    }
  });
  // The token climbing the stairwell on the left.
  const bottom = top + floors.length * rowH;
  out.push(svgPath(`M40,${bottom + 4} L40,${top + 2}`, { colour: ACCENT, opacity: 0.6, width: 1.4, dash: '3 4' }));
  out.push(svgPath(`M35,${top + 9} L40,${top + 1} L45,${top + 9}`, { colour: ACCENT, opacity: 0.6, width: 1.4 }));
  floors.forEach((f, i) => {
    if (!f) return;
    const y = top + i * rowH + 7;
    out.push(rule(40, y, 52, y, { opacity: 0.5, colour: ACCENT }));
  });
  out.push(text(0, bottom + 24, 'one token: balance', { size: 11, fill: ACCENT, opacity: 0.9 }));
  out.push(text(x0, bottom + 24, '8 rooms awake for this token on each floor, 120 asleep, all 128 in memory', { size: 11, opacity: 0.6 }));
  out.push(text(x0, bottom + 42, 'the next token wakes a different eight. so does the next floor.', { size: 11, opacity: 0.6 }));
  return svg({ w, h: bottom + 56, title, body: out.join('\n') });
}

/* Salary day as a cloakroom. Each conversation is a backpack of 0.79 GB, the
   node is the room they have to fit in, and a thousand of them do not. */
function salaryDayCrowd() {
  const w = 760;
  const title = 'One customer brought a backpack. A thousand brought a thousand.';
  const out = [eyebrow(0, 13, title)];

  // Left: one customer and the backpack.
  out.push(eyebrow(0, 40, 'the demo'));
  out.push(person(40, 76));
  out.push(bar(64, 92, 20, 24, { fill: ACCENT, opacity: 0.75 }));
  out.push(text(94, 102, '0.79 GB', { size: 11.5, fill: ACCENT, weight: 600 }));
  out.push(text(94, 118, 'one conversation,', { size: 10.5, opacity: 0.6 }));
  out.push(text(94, 133, '4,096 tokens', { size: 10.5, opacity: 0.6 }));

  // Middle: a thousand of them.
  out.push(eyebrow(250, 40, 'salary day, 10:03'));
  const gx = 250, gy = 54, cols = 50, rows = 20, step = 5;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      out.push(dot(gx + c * step, gy + r * step, 1.5, { opacity: 0.45 }));
    }
  }
  out.push(text(gx, gy + rows * step + 22, '1,000 conversations in flight', { size: 11, opacity: 0.7 }));
  out.push(text(gx, gy + rows * step + 38, 'each carrying 0.79 GB of KV cache', { size: 11, opacity: 0.7 }));

  // Right: the cloakroom. 1 GB is 0.2 px, the floor is y = 240.
  const cx = 540, cw = 100, floor = 240, px = 0.2;
  const weights = 235 * px, packs = 789 * px, node = 640 * px;
  out.push(bar(cx, floor - weights, cw, weights, { fill: INK, opacity: 0.16 }));
  out.push(bar(cx, floor - weights - packs, cw, packs, { fill: ACCENT, opacity: 0.8 }));
  out.push(rule(cx - 8, floor - node, cx + cw + 8, floor - node, { opacity: 0.6, dash: '3 4' }));
  out.push(rule(cx - 8, floor, cx + cw + 8, floor, { opacity: 0.4 }));
  out.push(text(cx + cw + 14, floor - 6, 'weights', { size: 10.5, opacity: 0.6 }));
  out.push(text(cx + cw + 14, floor - 21, '235 GB', { size: 11.5, weight: 600, opacity: 0.75 }));
  out.push(text(cx + cw + 14, floor - node + 4, 'the node, 640 GB', { size: 10.5, opacity: 0.7 }));
  out.push(text(cx + cw + 14, floor - weights - packs + 12, 'backpacks', { size: 10.5, fill: ACCENT, opacity: 0.85 }));
  out.push(text(cx + cw + 14, floor - weights - packs + 28, '789 GB', { size: 11.5, fill: ACCENT, weight: 600 }));
  out.push(text(cx, floor + 18, 'the cloakroom, drawn to scale', { size: 10.5, opacity: 0.5 }));
  return svg({ w, h: 268, title, body: out.join('\n') });
}

/* The myth is four doors with subjects on them. The reality is a grid where
   the same word knocks on different doors on every floor. */
function poetsHome() {
  const w = 760;
  const title = 'What everyone imagines, and what the router actually does';
  const out = [eyebrow(0, 13, title)];

  out.push(eyebrow(0, 40, 'the myth'));
  const doors = ['maths', 'poetry', 'cooking', 'money'];
  doors.forEach((d, i) => {
    const x = 10 + i * 84, y = 56, sent = d === 'poetry' || d === 'cooking';
    out.push(bar(x, y, 62, 92, { fill: INK, opacity: sent ? 0.03 : 0.07, stroke: sent ? ACCENT : INK, strokeOpacity: sent ? 0.7 : 0.3 }));
    out.push(dot(x + 50, y + 50, 2.2, { opacity: 0.5 }));
    out.push(text(x + 31, y + 108, d, { size: 10, anchor: 'middle', track: 1.3, caps: true, opacity: sent ? 0.9 : 0.6, fill: sent ? ACCENT : INK }));
    if (sent) out.push(text(x + 31, y + 30, 'go home', { size: 9.5, anchor: 'middle', fill: ACCENT, opacity: 0.9, track: 0.8 }));
  });
  out.push(text(0, 196, 'one room per subject; send two home', { size: 11, opacity: 0.6 }));

  out.push(eyebrow(400, 40, 'the reality'));
  const tokens = ['what', 'is', 'my', 'balance', '?'];
  const gx = 400, cellW = 26, cellH = 16, gap = 4, cols = 10;
  tokens.forEach((t, i) => {
    const hero = t === 'balance';
    out.push(text(gx + 20 + i * 62, 66, t, { size: 11.5, fill: hero ? ACCENT : INK, opacity: hero ? 1 : 0.55, weight: hero ? 600 : 400 }));
  });
  const rnd = seeded(9);
  const floorsY = [82, 112, 142];
  floorsY.forEach((y, f) => {
    // Every token picks two rooms; only "balance" is drawn in the accent.
    const picks = tokens.map(() => {
      const a = Math.floor(rnd() * cols);
      let b = Math.floor(rnd() * cols);
      if (b === a) b = (a + 3) % cols;
      return [a, b];
    });
    const hero = new Set(picks[3]);
    const others = new Set(picks.flatMap((p, i) => (i === 3 ? [] : p)));
    for (let c = 0; c < cols; c++) {
      const x = gx + c * (cellW + gap);
      const isHero = hero.has(c), isOther = others.has(c) && !isHero;
      out.push(bar(x, y, cellW, cellH, {
        fill: isHero ? ACCENT : INK, opacity: isHero ? 0.9 : isOther ? 0.3 : 0.06,
        stroke: isHero ? null : INK, strokeOpacity: 0.16,
      }));
    }
    out.push(text(gx + cols * (cellW + gap) + 8, y + 12, `floor ${f + 1}`, { size: 10, opacity: 0.5, track: 1, caps: true }));
  });
  out.push(text(400, 180, 'balance: two rooms per floor, never the same two', { size: 11, fill: ACCENT, opacity: 0.9 }));
  out.push(text(400, 196, 'other words knock elsewhere; nobody owns a subject', { size: 11, opacity: 0.6 }));
  return svg({ w, h: 212, title, body: out.join('\n') });
}

/* The usage table for one floor, then the same floor after the broom. The
   numbers are a sketch of the shape, not a measurement; the shape is the
   point, seven busy rooms and five that a month of traffic barely opened. */
function usageBroom() {
  const w = 760;
  const title = 'One floor, a month of bank questions, then the broom';
  const usage = [92, 61, 6, 100, 2, 1, 47, 1, 7, 68, 3, 44, 1, 27, 1, 74];
  const gone = new Set([4, 5, 7, 12, 14]);
  const out = [eyebrow(0, 13, title)];

  out.push(eyebrow(0, 40, 'tokens that woke each room, per thousand'));
  const top = 54, rowH = 12, gap = 4, bx = 40, maxW = 260;
  usage.forEach((u, i) => {
    const y = top + i * (rowH + gap);
    const g = gone.has(i);
    out.push(text(bx - 8, y + 10, `E${i}`, { size: 9.5, anchor: 'end', opacity: g ? 0.95 : 0.55, fill: g ? ACCENT : INK }));
    out.push(bar(bx, y, Math.max(2, (u / 100) * maxW), rowH, { fill: g ? ACCENT : INK, opacity: g ? 0.85 : 0.18 }));
    out.push(text(bx + Math.max(2, (u / 100) * maxW) + 6, y + 10, g ? `${u}, swept` : String(u), { size: 9.5, opacity: g ? 0.95 : 0.55, fill: g ? ACCENT : INK }));
  });

  out.push(eyebrow(420, 40, 'the same floor, after'));
  const cx0 = 420, cw = 76, ch = 40, cg = 8;
  for (let i = 0; i < 16; i++) {
    const x = cx0 + (i % 4) * (cw + cg), y = top + Math.floor(i / 4) * (ch + cg);
    const g = gone.has(i);
    if (g) {
      out.push(`  <rect x="${x}" y="${y}" width="${cw}" height="${ch}" fill="none" stroke="${ACCENT}" stroke-opacity="0.5" stroke-dasharray="3 3"/>`);
      out.push(text(x + cw / 2, y + 24, 'gone', { size: 10, anchor: 'middle', fill: ACCENT, opacity: 0.8, track: 1, caps: true }));
    } else {
      out.push(bar(x, y, cw, ch, { fill: INK, opacity: 0.06, stroke: INK, strokeOpacity: 0.3 }));
      out.push(text(x + cw / 2, y + 24, `E${i}`, { size: 11, anchor: 'middle', opacity: 0.7 }));
    }
  }
  const gy = top + 4 * (ch + cg) + 14;
  out.push(text(cx0, gy, '11 rooms left; the router picks its top 8 from 11', { size: 11, opacity: 0.7 }));
  out.push(text(cx0, gy + 17, '5 rooms of memory freed here, and on every floor', { size: 11, opacity: 0.7 }));
  const h = top + 16 * (rowH + gap) + 12;
  return svg({ w, h, title, body: out.join('\n') });
}

/* The word for savings, as three tokenizers actually cut it. The pieces are
   the real output of each model's tokenizer.json, measured for the post. */
function banglaConfetti() {
  const w = 760;
  const title = 'The word for savings, cut three ways';
  const cuts = [
    { name: 'Gemma 3 4B', pieces: ['সে', 'ভি', 'ংস'], bn: true },
    { name: 'Qwen3 4B', pieces: ['à¦¸', 'à§ĩ', 'à¦Ń', 'à¦¿à¦', 'Ĥ', 'à¦¸'], bn: false },
    { name: 'Llama 3.2 3B', pieces: ['à¦', '¸', 'à§ĩ', 'à¦', 'Ń', 'à¦¿à¦', 'Ĥ', 'à¦', '¸'], bn: false, accent: true },
  ];
  const out = [eyebrow(0, 13, title)];
  out.push(bangla(0, 62, 'সেভিংস', { size: 30, weight: 600 }));
  out.push(text(140, 50, 'six letters, one word, what a customer types', { size: 11, opacity: 0.6 }));
  out.push(text(140, 66, 'the router never sees it whole', { size: 11, opacity: 0.6 }));

  const rnd = seeded(21);
  cuts.forEach((c, r) => {
    const y = 104 + r * 62;
    out.push(text(0, y + 15, c.name, { size: 10.5, track: 1.2, caps: true, opacity: c.accent ? 0.95 : 0.55, fill: c.accent ? ACCENT : INK }));
    let x = 132;
    c.pieces.forEach((p) => {
      const bw = c.bn ? 40 : 10 + p.length * 8;
      out.push(bar(x, y, bw, 24, { fill: c.accent ? ACCENT : INK, opacity: c.accent ? 0.12 : 0.06, stroke: c.accent ? ACCENT : INK, strokeOpacity: c.accent ? 0.6 : 0.3 }));
      if (c.bn) out.push(bangla(x + bw / 2, y + 17, p, { size: 12, anchor: 'middle' }));
      else out.push(text(x + bw / 2, y + 16, p, { size: 11, anchor: 'middle', opacity: 0.85 }));
      // Each piece is routed on its own.
      const e = Math.floor(rnd() * 128);
      out.push(rule(x + bw / 2, y + 24, x + bw / 2, y + 32, { opacity: 0.3 }));
      out.push(text(x + bw / 2, y + 43, `E${e}`, { size: 8.5, anchor: 'middle', opacity: 0.45 }));
      x += bw + 10;
    });
    out.push(text(w, y + 16, `${c.pieces.length} pieces`, { size: 11.5, anchor: 'end', weight: c.accent ? 600 : 400, fill: c.accent ? ACCENT : INK, opacity: c.accent ? 1 : 0.6 }));
  });
  const h = 104 + cuts.length * 62 + 4;
  out.push(text(0, h - 6, 'every piece knocks on its own eight doors per floor; none of them is the word', { size: 11, opacity: 0.6 }));
  return svg({ w, h: h + 10, title, body: out.join('\n') });
}

/* Four stations, left to right: the questions, the teacher with the fee
   schedule open, the checkers, the student reading the book. */
function answerBook() {
  const w = 760;
  const title = 'The head teacher writes the answer book';
  const out = [eyebrow(0, 13, title)];
  const y0 = 70, boxH = 84;

  // 1. the stack of question cards
  for (let i = 2; i >= 0; i--) {
    out.push(bar(0 + i * 6, y0 - i * 6, 132, 72, { fill: INK, opacity: 0.05, stroke: INK, strokeOpacity: 0.3 }));
  }
  out.push(text(10, y0 + 22, 'minimum balance?', { size: 10.5, opacity: 0.8 }));
  out.push(text(10, y0 + 40, 'card swallowed?', { size: 10.5, opacity: 0.8 }));
  out.push(bangla(10, y0 + 60, 'সর্বনিম্ন ব্যালেন্স?', { size: 11, opacity: 0.8 }));
  out.push(eyebrow(0, y0 + 100, '9,000 questions'));

  const arrow = (x1, x2, y) => [
    rule(x1, y, x2, y, { opacity: 0.4 }),
    svgPath(`M${x2 - 6},${y - 4} L${x2},${y} L${x2 - 6},${y + 4}`, { opacity: 0.4, width: 1.2 }),
  ].join('\n');

  // 2. the teacher
  out.push(arrow(150, 186, y0 + 36));
  out.push(bar(190, y0 - 6, 168, boxH, { fill: INK, opacity: 0.06, stroke: INK, strokeOpacity: 0.35 }));
  out.push(text(202, y0 + 18, 'the 235B teacher', { size: 11.5, weight: 600, opacity: 0.85 }));
  out.push(text(202, y0 + 36, 'reads the fee schedule,', { size: 10.5, opacity: 0.6 }));
  out.push(text(202, y0 + 51, 'writes the answer', { size: 10.5, opacity: 0.6 }));
  out.push(bar(318, y0 - 18, 44, 30, { fill: ACCENT, opacity: 0.1, stroke: ACCENT, strokeOpacity: 0.6 }));
  out.push(text(340, y0 - 4, 'RAG', { size: 9.5, anchor: 'middle', fill: ACCENT, opacity: 0.9, track: 1 }));
  out.push(text(340, y0 + 8, '§ 4.2', { size: 9, anchor: 'middle', fill: ACCENT, opacity: 0.8 }));
  out.push(eyebrow(190, y0 + 100, 'all week, one at a time'));

  // 3. the checkers
  out.push(arrow(362, 398, y0 + 36));
  const cx = 402;
  ['ok', 'ok', 'drop', 'ok'].forEach((v, i) => {
    const y = y0 - 4 + i * 20;
    const bad = v === 'drop';
    out.push(bar(cx, y, 118, 15, { fill: bad ? ACCENT : INK, opacity: bad ? 0.14 : 0.06, stroke: bad ? ACCENT : INK, strokeOpacity: bad ? 0.6 : 0.25 }));
    out.push(text(cx + 8, y + 11, `answer ${i + 1}`, { size: 9.5, opacity: 0.6 }));
    out.push(text(cx + 110, y + 11, v, { size: 9.5, anchor: 'end', fill: bad ? ACCENT : INK, opacity: bad ? 0.95 : 0.6, track: 1, caps: true }));
  });
  out.push(eyebrow(cx, y0 + 100, 'checked by people'));

  // 4. the student
  out.push(arrow(524, 560, y0 + 36));
  out.push(bar(564, y0 + 6, 196, 60, { fill: ACCENT, opacity: 0.08, stroke: ACCENT, strokeOpacity: 0.6 }));
  out.push(text(576, y0 + 30, 'the 4B student', { size: 11.5, weight: 600, fill: ACCENT }));
  out.push(text(576, y0 + 48, 'reads the checked book', { size: 10.5, fill: ACCENT, opacity: 0.8 }));
  out.push(eyebrow(564, y0 + 100, 'LoRA, one 24 GB card'));

  out.push(rule(0, y0 + 120, w, y0 + 120, { opacity: 0.16 }));
  out.push(text(0, y0 + 140, 'The student never meets a question the teacher did not answer first, and a person did not check.', { size: 11, opacity: 0.62 }));
  return svg({ w, h: y0 + 152, title, body: out.join('\n') });
}

/* Salary day, second attempt: the crowd, the cheap cards, and the one in
   twenty that goes up to the big model. */
function whatTheyShipped() {
  const w = 760;
  const title = 'Salary day, second attempt';
  const out = [eyebrow(0, 13, title)];

  const gx = 0, gy = 50, cols = 40, rows = 25, step = 4.6;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) out.push(dot(gx + c * step, gy + r * step, 1.4, { opacity: 0.45 }));
  }
  out.push(text(gx, gy + rows * step + 20, '1,000 customers at 10:03', { size: 11, opacity: 0.7 }));

  // the cards
  const cx = 250, cy = 48;
  for (let i = 0; i < 4; i++) {
    const y = cy + i * 32;
    out.push(bar(cx, y, 200, 24, { fill: ACCENT, opacity: 0.1, stroke: ACCENT, strokeOpacity: 0.6 }));
    out.push(text(cx + 10, y + 16, 'student, 9 GB', { size: 10.5, fill: ACCENT, opacity: 0.95 }));
    out.push(text(cx + 190, y + 16, '24 GB card', { size: 9.5, anchor: 'end', fill: ACCENT, opacity: 0.6 }));
  }
  out.push(rule(gx + cols * step + 6, gy + 60, cx - 6, gy + 60, { opacity: 0.4 }));
  out.push(svgPath(`M${cx - 12},${gy + 56} L${cx - 6},${gy + 60} L${cx - 12},${gy + 64}`, { opacity: 0.4, width: 1.2 }));
  out.push(text(cx, cy + 4 * 32 + 12, 'add cards the way a branch adds tellers', { size: 10.5, opacity: 0.6 }));

  // 19 in 20 answered
  out.push(text(cx, cy + 4 * 32 + 40, '19 in 20: answered in Bangla, under 2 seconds', { size: 11, fill: ACCENT, weight: 600 }));

  // the big model, top right
  out.push(bar(520, 48, 240, 56, { fill: INK, opacity: 0.06, stroke: INK, strokeOpacity: 0.35 }));
  out.push(text(532, 70, 'the big model', { size: 11.5, weight: 600, opacity: 0.85 }));
  out.push(text(532, 88, 'one node, one customer at a time', { size: 10.5, opacity: 0.6 }));
  out.push(rule(cx + 200, cy + 12, 520, 76, { opacity: 0.4, dash: '3 3' }));
  out.push(text(520, 124, '1 in 20 goes up to it,', { size: 10.5, opacity: 0.6 }));
  out.push(text(520, 140, 'the questions not in the book', { size: 10.5, opacity: 0.6 }));

  return svg({ w, h: 220, title, body: out.join('\n') });
}

figures['school-of-experts.svg'] = schoolOfExperts();
figures['salary-day-crowd.svg'] = salaryDayCrowd();
figures['poets-home.svg'] = poetsHome();
figures['usage-broom.svg'] = usageBroom();
figures['bangla-confetti.svg'] = banglaConfetti();
figures['answer-book.svg'] = answerBook();
figures['what-they-shipped.svg'] = whatTheyShipped();


/* ---------------------------------------------------------------------- */

await mkdir(OUT, { recursive: true });
for (const [name, contents] of Object.entries(figures)) {
  await writeFile(path.join(OUT, name), contents, 'utf8');
}
console.log(`figures: ${Object.keys(figures).length}`);
for (const n of Object.keys(figures).sort()) console.log(`  ${n}`);
