/**
 * The chart kit.
 *
 * Every figure on this site is generated from these primitives so they read as
 * one system rather than as a folder of unrelated pictures. Three rules hold
 * throughout:
 *
 *   1. Colour carries meaning or it is absent. Everything is `currentColor` at
 *      some opacity; the accent appears only on the mark the sentence beside the
 *      figure is about. A figure where everything is highlighted highlights
 *      nothing.
 *   2. No legend if a direct label will do, and no gridlines. A value belongs on
 *      its own mark, where the eye already is.
 *   3. The figures are inlined into the page, so `currentColor` and
 *      `var(--accent)` resolve against the reader's theme and follow the
 *      light/dark toggle. Nothing here may hard-code an ink or a paper colour.
 */

export const INK = 'currentColor';
export const ACCENT = 'var(--accent, #a8290f)';

/** Type sizes, in the same proportions the page uses. */
const T = { label: 10.5, tick: 11, value: 11.5, note: 11.5, title: 12 };
const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function svg({ w, h, title, body }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(title)}" fill="none" stroke="${INK}" font-family="${MONO}">
${body}
</svg>
`;
}

/* --- text -------------------------------------------------------------- */

export const text = (x, y, s, o = {}) => {
  const {
    size = T.tick,
    anchor = 'start',
    fill = INK,
    opacity = 1,
    weight = 400,
    track = 0,
    caps = false,
    rotate = null,
    knockout = false,
  } = o;
  const t = rotate ? ` transform="rotate(${rotate} ${x} ${y})"` : '';
  const lt = track ? ` letter-spacing="${track}"` : '';
  // A value label printed over a plotted line needs the line to stop behind
  // it. Painting the stroke first in the page background does that, and it
  // stays theme-aware because the paper colour comes from the CSS variable.
  const ko = knockout
    ? ' stroke="var(--bg, #fafafa)" stroke-width="3.5" stroke-linejoin="round" paint-order="stroke"'
    : ' stroke="none"';
  return `  <text x="${x}" y="${y}" text-anchor="${anchor}" font-size="${size}" font-weight="${weight}"${lt}${ko} fill="${fill}" fill-opacity="${opacity}"${t}>${esc(caps ? String(s).toUpperCase() : s)}</text>`;
};

/**
 * Wraps a caption to the figure width and returns the lines plus the height
 * they occupy. A caption is prose, so it has to wrap; a single <text> node runs
 * straight past the viewBox and gets clipped, which is the most common way a
 * generated figure ships broken.
 *
 * The character budget is derived from the mono advance, which is a known
 * constant (0.6em) rather than something that has to be measured.
 */
export function wrapText(s, { w, size = T.note, x = 0, y, lineH = 17, ...o }) {
  const perLine = Math.max(20, Math.floor(w / (size * 0.6)));
  const words = String(s).split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? line + ' ' + word : word;
    if (next.length > perLine && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return {
    lines: lines.length,
    height: lines.length * lineH,
    svg: lines.map((l, i) => text(x, y + i * lineH, l, { size, ...o })).join('\n'),
  };
}

/** The small tracked uppercase label the whole site uses for structure. */
export const eyebrow = (x, y, s, o = {}) =>
  text(x, y, s, { size: T.label, track: 1.7, caps: true, opacity: 0.58, ...o });

/* --- rules ------------------------------------------------------------- */

export const rule = (x1, y1, x2, y2, o = {}) => {
  const { opacity = 0.2, width = 1, dash = null, colour = INK } = o;
  const d = dash ? ` stroke-dasharray="${dash}"` : '';
  return `  <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${colour}" stroke-opacity="${opacity}" stroke-width="${width}"${d}/>`;
};

export const bar = (x, y, w, h, o = {}) => {
  const { fill = INK, opacity = 0.16, stroke = null, strokeOpacity = 1 } = o;
  const s = stroke ? ` stroke="${stroke}" stroke-opacity="${strokeOpacity}"` : ' stroke="none"';
  return `  <rect x="${x}" y="${y}" width="${Math.max(0, w)}" height="${h}" fill="${fill}" fill-opacity="${opacity}"${s}/>`;
};

export const dot = (cx, cy, r, o = {}) => {
  const { fill = INK, opacity = 1, stroke = null } = o;
  const s = stroke ? ` stroke="${stroke}"` : ' stroke="none"';
  return `  <circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r}" fill="${fill}" fill-opacity="${opacity}"${s}/>`;
};

export const path = (d, o = {}) => {
  const { colour = INK, opacity = 1, width = 1.6, dash = null, cap = 'round' } = o;
  const ds = dash ? ` stroke-dasharray="${dash}"` : '';
  return `  <path d="${d}" stroke="${colour}" stroke-opacity="${opacity}" stroke-width="${width}" stroke-linecap="${cap}"${ds}/>`;
};

/* ---------------------------------------------------------------------- *
 * Horizontal bars.
 *
 * The default chart for "these things differ in one measured quantity". Rows
 * read top to bottom in the order given, because a chart that reorders the
 * table beside it makes the reader do work for nothing.
 * ---------------------------------------------------------------------- */

export function barsH({
  rows,                 // [{ label, value, note?, accent? }]
  unit = '',
  w = 760,
  labelW = 250,
  rowH = 30,
  gap = 9,
  max = null,
  title,
  caption = null,
  threshold = null,     // { at, label } draws a hairline the bars are read against
  decimals = null,
}) {
  const top = 30;
  const plotX = labelW + 14;
  // A row note lives in its own right-hand gutter, sized from the longest note
  // rather than guessed. Printing notes inside the bars reads well only while
  // every bar is long, and the interesting rows are usually the short ones.
  const longestNote = Math.max(0, ...rows.map((r) => (r.note ? r.note.length : 0)));
  const noteW = longestNote ? longestNote * (T.label * 0.6 + 0.6) + 22 : 0;
  const plotW = w - plotX - 74 - noteW;
  const hi = max ?? Math.max(...rows.map((r) => r.value));
  const cap = caption ? wrapText(caption, { w, y: 0, opacity: 0.58 }) : null;
  const h =
    top + rows.length * (rowH + gap) + (threshold ? 20 : 0) + (cap ? cap.height + 22 : 4);
  const out = [];

  if (title) out.push(eyebrow(0, 13, title));

  const fmt = (v) =>
    decimals === null ? v.toLocaleString('en-GB') : v.toFixed(decimals);

  // The threshold label sits under the axis, where the title is not.
  if (threshold) {
    const tx = plotX + (threshold.at / hi) * plotW;
    const base = top + rows.length * (rowH + gap) - gap + 2;
    out.push(rule(tx, top - 6, tx, base, { opacity: 0.34, dash: '3 4' }));
    out.push(text(tx, base + 15, threshold.label, { size: T.label, anchor: 'middle', opacity: 0.5, track: 1.2, caps: true }));
  }

  rows.forEach((r, i) => {
    const y = top + i * (rowH + gap);
    const bw = (r.value / hi) * plotW;
    const colour = r.accent ? ACCENT : INK;
    out.push(text(labelW, y + rowH * 0.68, r.label, { anchor: 'end', size: T.tick, opacity: r.accent ? 0.95 : 0.72 }));
    out.push(bar(plotX, y, bw, rowH, { fill: colour, opacity: r.accent ? 0.9 : 0.16 }));
    out.push(
      text(plotX + bw + 9, y + rowH * 0.68, fmt(r.value) + unit, {
        size: T.value,
        fill: r.accent ? ACCENT : INK,
        opacity: r.accent ? 1 : 0.72,
        weight: r.accent ? 600 : 400,
      }),
    );
    if (r.note) {
      out.push(text(w, y + rowH * 0.68, r.note, { size: T.label, anchor: 'end', opacity: 0.5, track: 0.6 }));
    }
  });

  out.push(rule(plotX, top + rows.length * (rowH + gap) - gap + 2, plotX, top - 6, { opacity: 0.28 }));

  if (cap) out.push(wrapText(caption, { w, y: h - cap.height, opacity: 0.58 }).svg);
  return svg({ w, h, title, body: out.join('\n') });
}

/* ---------------------------------------------------------------------- *
 * Grouped horizontal bars.
 *
 * For "the same thing measured at several tolerances", which is the shape the
 * whole biomechanics scorecard takes.
 * ---------------------------------------------------------------------- */

export function groupedBarsH({
  rows,                 // [{ label, values: [n,n,n], accent? }]
  seriesLabels,
  unit = '',
  w = 760,
  labelW = 268,
  barH = 13,
  barGap = 3,
  groupGap = 15,
  max = 100,
  title,
  caption = null,
}) {
  const top = 46;
  const plotX = labelW + 14;
  const plotW = w - plotX - 62;
  const groupH = seriesLabels.length * barH + (seriesLabels.length - 1) * barGap;
  const cap = caption ? wrapText(caption, { w, y: 0, opacity: 0.58 }) : null;
  const h = top + rows.length * (groupH + groupGap) + (cap ? cap.height + 22 : 2);
  const out = [];

  if (title) out.push(eyebrow(0, 13, title));

  // Series key, once, at the top, in the same order the bars stack. Laid out
  // from the label widths rather than a fixed step, so a long series name
  // cannot run into the next one. Mono advance is 0.6em plus the tracking.
  let keyX = plotX;
  seriesLabels.forEach((s, j) => {
    out.push(bar(keyX, 24, 16, 8, { fill: INK, opacity: 0.16 + j * 0.26 }));
    out.push(text(keyX + 22, 32, s, { size: T.label, opacity: 0.6, track: 1.1, caps: true }));
    keyX += 22 + s.length * (T.label * 0.6 + 1.1) + 26;
  });

  rows.forEach((r, i) => {
    const gy = top + i * (groupH + groupGap);
    out.push(
      text(labelW, gy + groupH / 2 + 4, r.label, {
        anchor: 'end',
        size: T.tick,
        opacity: r.accent ? 0.95 : 0.7,
        weight: r.accent ? 600 : 400,
      }),
    );
    r.values.forEach((v, j) => {
      const y = gy + j * (barH + barGap);
      const bw = (v / max) * plotW;
      out.push(
        bar(plotX, y, bw, barH, {
          fill: r.accent ? ACCENT : INK,
          opacity: r.accent ? 0.34 + j * 0.3 : 0.2 + j * 0.24,
        }),
      );
      out.push(
        text(plotX + bw + 7, y + barH - 2.5, v + unit, {
          size: T.label,
          opacity: r.accent ? 0.95 : 0.62,
          fill: r.accent ? ACCENT : INK,
        }),
      );
    });
  });

  out.push(rule(plotX, top - 8, plotX, top + rows.length * (groupH + groupGap) - groupGap, { opacity: 0.28 }));
  if (cap) out.push(wrapText(caption, { w, y: h - cap.height, opacity: 0.58 }).svg);
  return svg({ w, h, title, body: out.join('\n') });
}

/* ---------------------------------------------------------------------- *
 * Lollipop with a bias tick.
 *
 * A bar chart implies "how much of the thing", which is wrong for an error: an
 * error is a position on a scale, not a quantity of stuff. A dot puts the value
 * where it belongs and leaves room for a second mark, which is what lets bias
 * sit beside magnitude in one figure.
 * ---------------------------------------------------------------------- */

export function lollipop({
  rows,                 // [{ label, value, bias?, accent? }]
  unit = '',
  w = 760,
  labelW = 210,
  rowH = 32,
  max = null,
  title,
  caption = null,
  decimals = 2,
}) {
  const top = 50;
  const plotX = labelW + 14;
  // Room for the value label plus the bias gutter on the right.
  const plotW = w - plotX - 132;
  const hi = max ?? Math.max(...rows.map((r) => r.value)) * 1.12;
  const cap = caption ? wrapText(caption, { w, y: 0, opacity: 0.58 }) : null;
  const h = top + rows.length * rowH + (cap ? cap.height + 26 : 8);
  const out = [];

  if (title) out.push(eyebrow(0, 13, title));
  out.push(text(plotX, 35, 'mean absolute error', { size: T.label, opacity: 0.5, track: 1.1, caps: true }));
  if (rows.some((r) => r.bias !== undefined)) {
    out.push(text(w, 35, 'bias', { size: T.label, anchor: 'end', opacity: 0.5, track: 1.1, caps: true }));
  }

  rows.forEach((r, i) => {
    const y = top + i * rowH + rowH / 2;
    const cx = plotX + (r.value / hi) * plotW;
    const colour = r.accent ? ACCENT : INK;
    out.push(text(labelW, y + 4, r.label, { anchor: 'end', size: T.tick, opacity: r.accent ? 0.95 : 0.72 }));
    out.push(rule(plotX, y, cx, y, { opacity: r.accent ? 0.42 : 0.22, colour }));
    out.push(dot(cx, y, r.accent ? 6 : 5, { fill: colour, opacity: r.accent ? 1 : 0.66 }));
    out.push(
      text(cx + 12, y + 4, r.value.toFixed(decimals) + unit, {
        size: T.value,
        fill: colour,
        opacity: r.accent ? 1 : 0.75,
        weight: r.accent ? 600 : 400,
      }),
    );
    if (r.bias !== undefined) {
      const sign = r.bias > 0 ? '+' : '';
      out.push(text(w, y + 4, sign + r.bias.toFixed(2), { size: T.label, anchor: 'end', opacity: 0.55 }));
    }
  });

  out.push(rule(plotX, top + 4, plotX, top + rows.length * rowH - 4, { opacity: 0.28 }));
  if (cap) out.push(wrapText(caption, { w, y: h - cap.height, opacity: 0.58 }).svg);
  return svg({ w, h, title, body: out.join('\n') });
}

/* ---------------------------------------------------------------------- *
 * Two series against one category axis, on independent scales.
 *
 * Built for exactly one argument, which the biomechanics series makes twice:
 * an error figure and a survival figure move in opposite directions and reading
 * either alone misleads you. Both are labelled directly, because a dual axis
 * with a legend is a puzzle.
 * ---------------------------------------------------------------------- */

export function dualSeries({
  categories,           // [string]
  left,                 // { label, values, unit, accent? }
  right,                // { label, values, unit }
  w = 760,
  h: hIn = 300,
  title,
  caption = null,
  zero = true,          // false when both series sit in a narrow band well above zero
}) {
  const cap = caption ? wrapText(caption, { w, y: 0, opacity: 0.58 }) : null;
  const h = hIn + (cap ? cap.height - 14 : 0);
  const padL = 58, padR = 58, top = 58;
  const bottom = 62 + (cap ? cap.height - 14 : 0);
  const plotW = w - padL - padR;
  const plotH = h - top - bottom;
  const n = categories.length;
  const x = (i) => padL + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  // With `zero`, each series is drawn against its own zero, which is the honest
  // default. A series whose whole range sits far from zero would then be a flat
  // line pinned to the top of an empty box, so `zero: false` pads the observed
  // range instead. Every point carries its own printed value either way, so the
  // shape is a reading aid and not the quantitative claim.
  const band = (values) => {
    const hi = Math.max(...values);
    if (zero) return [0, hi * 1.15 || 1];
    const lo = Math.min(...values);
    const pad = (hi - lo) * 0.35 || Math.abs(hi) * 0.1 || 1;
    return [lo - pad, hi + pad];
  };
  const [lLo, lHi] = band(left.values);
  const [rLo, rHi] = band(right.values);
  const yL = (v) => top + plotH - ((v - lLo) / (lHi - lLo)) * plotH;
  const yR = (v) => top + plotH - ((v - rLo) / (rHi - rLo)) * plotH;
  const out = [];

  if (title) out.push(eyebrow(0, 13, title));
  out.push(rule(padL, top + plotH, padL + plotW, top + plotH, { opacity: 0.28 }));

  // right series first, so the accent series draws over it
  out.push(path(right.values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${yR(v).toFixed(1)}`).join(' '), { opacity: 0.3, width: 1.4, dash: '4 4' }));
  right.values.forEach((v, i) => out.push(dot(x(i), yR(v), 3.4, { opacity: 0.38 })));

  out.push(path(left.values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${yL(v).toFixed(1)}`).join(' '), { colour: left.accent ? ACCENT : INK, opacity: 0.85, width: 2 }));
  left.values.forEach((v, i) => {
    out.push(dot(x(i), yL(v), 4.6, { fill: left.accent ? ACCENT : INK, opacity: 1 }));
    out.push(text(x(i), yL(v) - 12, v + left.unit, { size: T.label, anchor: 'middle', fill: left.accent ? ACCENT : INK, opacity: 0.95, knockout: true }));
  });
  // Where the two series cross, their value labels land on top of each other.
  // Push the quieter one clear rather than letting the reader untangle it.
  right.values.forEach((v, i) => {
    const near = Math.abs(yL(left.values[i]) - yR(v)) < 30;
    out.push(
      text(x(i), yR(v) + (near ? 32 : 18), v + right.unit, {
        size: T.label, anchor: 'middle', opacity: 0.5, knockout: true,
      }),
    );
  });

  categories.forEach((c, i) =>
    out.push(text(x(i), top + plotH + 24, c, { size: T.label, anchor: 'middle', opacity: 0.6 })),
  );

  out.push(text(padL, 34, left.label, { size: T.label, track: 1.1, caps: true, fill: left.accent ? ACCENT : INK, opacity: 0.9 }));
  out.push(text(w - padR, 34, right.label, { size: T.label, anchor: 'end', track: 1.1, caps: true, opacity: 0.5 }));

  if (cap) out.push(wrapText(caption, { w, y: h - cap.height, opacity: 0.58 }).svg);
  return svg({ w, h, title, body: out.join('\n') });
}

/* ---------------------------------------------------------------------- *
 * A funnel with proportional widths.
 *
 * ASCII bars approximate this; the point of a funnel is that four orders of
 * magnitude are visible at once, and only real geometry does that. The widths
 * are on a log scale, stated in the caption, because on a linear scale every
 * stage after the first is invisible.
 * ---------------------------------------------------------------------- */

export function funnel({
  stages,               // [{ label, value, note? }]
  w = 760,
  stageH = 40,
  gap = 12,
  title,
  caption = null,
}) {
  const top = 34;
  const labelW = 250;
  const plotX = labelW + 14;
  const plotW = w - plotX - 96;
  const cap = caption ? wrapText(caption, { w, y: 0, opacity: 0.58 }) : null;
  const h = top + stages.length * (stageH + gap) + (cap ? cap.height + 22 : 2);
  const logs = stages.map((s) => Math.log10(Math.max(s.value, 1)));
  const lo = Math.min(...logs), hi = Math.max(...logs);
  const width = (l) => 28 + ((l - lo) / (hi - lo || 1)) * (plotW - 28);
  const out = [];

  if (title) out.push(eyebrow(0, 13, title));

  stages.forEach((s, i) => {
    const y = top + i * (stageH + gap);
    const bw = width(logs[i]);
    const last = i === stages.length - 1;
    out.push(text(labelW, y + stageH * 0.62, s.label, { anchor: 'end', size: T.tick, opacity: last ? 0.95 : 0.72, weight: last ? 600 : 400 }));
    out.push(bar(plotX, y, bw, stageH, { fill: last ? ACCENT : INK, opacity: last ? 0.85 : 0.14 }));
    // Counts share one right-hand column. Setting them at the end of each bar
    // reads well at the top of a funnel and collides with the filter note by
    // the bottom, which is exactly where the interesting stages are.
    out.push(text(w, y + stageH * 0.62, s.value.toLocaleString('en-GB'), {
      size: T.value, anchor: 'end', fill: last ? ACCENT : INK, opacity: last ? 1 : 0.7, weight: last ? 600 : 400,
    }));
    if (s.note) out.push(text(plotX + 10, y + stageH * 0.62, s.note, { size: T.label, opacity: 0.52, track: 0.6 }));
    if (!last) {
      const cy = y + stageH + gap / 2;
      out.push(path(`M${plotX + 13},${cy - 3} L${plotX + 13},${cy + 3}`, { opacity: 0.3, width: 1.2 }));
    }
  });

  if (cap) out.push(wrapText(caption, { w, y: h - cap.height, opacity: 0.58 }).svg);
  return svg({ w, h, title, body: out.join('\n') });
}

/* ---------------------------------------------------------------------- *
 * A line over a numeric x axis.
 * ---------------------------------------------------------------------- */

export function lineChart({
  points,               // [{ x, y, label? }]
  xLabel,
  yLabel,
  w = 760,
  h = 300,
  title,
  caption = null,
  unit = '',
  annotate = null,      // { atX, text }
}) {
  const padL = 62, padR = 40, top = 52, bottom = 60;
  const plotW = w - padL - padR, plotH = h - top - bottom;
  const xs = points.map((p) => p.x), ys = points.map((p) => p.y);
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const yMax = Math.max(...ys) * 1.18;
  const X = (v) => padL + ((v - xMin) / (xMax - xMin || 1)) * plotW;
  const Y = (v) => top + plotH - (v / yMax) * plotH;
  const out = [];

  if (title) out.push(eyebrow(0, 13, title));
  out.push(rule(padL, top + plotH, padL + plotW, top + plotH, { opacity: 0.28 }));
  out.push(rule(padL, top, padL, top + plotH, { opacity: 0.28 }));

  out.push(path(points.map((p, i) => `${i ? 'L' : 'M'}${X(p.x).toFixed(1)},${Y(p.y).toFixed(1)}`).join(' '), { colour: ACCENT, opacity: 0.85, width: 2 }));
  points.forEach((p) => {
    out.push(dot(X(p.x), Y(p.y), 4.6, { fill: ACCENT }));
    out.push(text(X(p.x), Y(p.y) - 13, p.y + unit, { size: T.label, anchor: 'middle', fill: ACCENT, opacity: 0.95 }));
    out.push(text(X(p.x), top + plotH + 22, p.label ?? p.x, { size: T.label, anchor: 'middle', opacity: 0.6 }));
  });

  if (annotate) {
    const ax = X(annotate.atX);
    out.push(rule(ax, top - 4, ax, top + plotH, { opacity: 0.26, dash: '3 4' }));
    out.push(text(ax + 8, top + 8, annotate.text, { size: T.label, opacity: 0.6 }));
  }

  out.push(text(padL, 34, yLabel, { size: T.label, track: 1.1, caps: true, opacity: 0.5 }));
  out.push(text(padL + plotW, h - (caption ? 32 : 14), xLabel, { size: T.label, anchor: 'end', track: 1.1, caps: true, opacity: 0.5 }));
  if (caption) out.push(text(0, h - 12, caption, { size: T.note, opacity: 0.58 }));
  return svg({ w, h, title, body: out.join('\n') });
}

/* ---------------------------------------------------------------------- *
 * A stack of labelled layers, each with a right-hand annotation.
 *
 * For architecture: the harness layers, the pose pipeline, the agent loop.
 * Box drawing does this well at four rows and badly at seven, because the
 * annotations stop fitting.
 * ---------------------------------------------------------------------- */

export function layers({
  rows,                 // [{ n?, label, detail, note?, accent? }]
  w = 760,
  rowH = 56,
  gap = 8,
  title,
  caption = null,
  inflow = null,
  outflow = null,
}) {
  const top = 34 + (inflow ? 34 : 0);
  const boxW = 430;
  const cap = caption ? wrapText(caption, { w, y: 0, opacity: 0.58 }) : null;
  const h = top + rows.length * (rowH + gap) + (outflow ? 40 : 6) + (cap ? cap.height + 18 : 2);
  const out = [];

  if (title) out.push(eyebrow(0, 13, title));
  if (inflow) {
    out.push(text(0, 34, inflow, { size: T.tick, opacity: 0.66 }));
    out.push(path(`M14,42 L14,${top - 6}`, { opacity: 0.3, width: 1.2 }));
    out.push(path(`M10,${top - 12} L14,${top - 5} L18,${top - 12}`, { opacity: 0.3, width: 1.2 }));
  }

  // A line of detail that runs past the box it sits in is the one failure this
  // shape has, and it is invisible in the source. Mono advance is a constant, so
  // the fit can be checked here rather than found in a screenshot.
  const fits = (s, room) => s.length * (T.label * 0.6) <= room;

  rows.forEach((r, i) => {
    const y = top + i * (rowH + gap);
    const colour = r.accent ? ACCENT : INK;
    const inset = r.n ? 44 : 14;
    if (!fits(r.detail, boxW - inset - 12)) {
      throw new Error(`layers: detail overflows its box (${r.detail.length} chars): ${r.detail}`);
    }
    if (r.note && !fits(r.note, w - boxW - 26)) {
      throw new Error(`layers: note overflows the gutter (${r.note.length} chars): ${r.note}`);
    }
    out.push(bar(0, y, boxW, rowH, { fill: colour, opacity: r.accent ? 0.1 : 0.05, stroke: colour, strokeOpacity: r.accent ? 0.55 : 0.24 }));
    if (r.n) out.push(text(14, y + 22, r.n, { size: T.label, fill: colour, opacity: r.accent ? 0.95 : 0.5, track: 1 }));
    out.push(text(r.n ? 44 : 14, y + 22, r.label, { size: T.value, weight: 600, opacity: r.accent ? 0.98 : 0.85, fill: colour }));
    out.push(text(r.n ? 44 : 14, y + 40, r.detail, { size: T.label, opacity: 0.58 }));
    if (r.note) out.push(text(boxW + 20, y + 32, r.note, { size: T.label, opacity: 0.55 }));
  });

  if (outflow) {
    const y = top + rows.length * (rowH + gap);
    out.push(path(`M14,${y - 2} L14,${y + 14}`, { opacity: 0.3, width: 1.2 }));
    out.push(text(0, y + 30, outflow, { size: T.tick, opacity: 0.66 }));
  }
  if (cap) out.push(wrapText(caption, { w, y: h - cap.height, opacity: 0.58 }).svg);
  return svg({ w, h, title, body: out.join('\n') });
}
