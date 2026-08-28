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
