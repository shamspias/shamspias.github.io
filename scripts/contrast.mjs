/**
 * Verifies every text-on-background pair in the token set against WCAG.
 *
 *   node scripts/contrast.mjs
 *
 * The ratios are written into global.css as comments; this is what keeps those
 * comments honest.
 */
const THEMES = {
  light: {
    bg: '#faf7f0',
    'bg-sunken': '#f2eee3',
    'bg-code': '#f5f1e6',
    fg: '#1c1815',
    'fg-strong': '#0f0d0b',
    'fg-muted': '#56504a',
    'fg-faint': '#6a635b',
    accent: '#a8290f',
    'accent-hover': '#7d1c07',
    rule: '#e3dccc',
    'rule-strong': '#c9bfa8',
  },
  dark: {
    bg: '#15130f',
    'bg-sunken': '#1d1a15',
    'bg-code': '#1e1b15',
    fg: '#e9e3d7',
    'fg-strong': '#f7f3ea',
    'fg-muted': '#a69d8f',
    'fg-faint': '#8d8477',
    accent: '#f0705a',
    'accent-hover': '#f79781',
    rule: '#2b2620',
    'rule-strong': '#3d372d',
  },
};

const TEXT = ['fg', 'fg-strong', 'fg-muted', 'fg-faint', 'accent', 'accent-hover'];
const BACKS = ['bg', 'bg-sunken', 'bg-code'];

// Non-text tokens still have to be perceivable as a boundary: WCAG 1.4.11
// asks for 3:1 on meaningful non-text contrast. A hairline divider is
// decorative, so it is checked but only reported, never failed.
const NONTEXT = ['rule', 'rule-strong'];

const srgb = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
};

const lum = (hex) => {
  const [r, g, b] = srgb(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

let failures = 0;

for (const [name, t] of Object.entries(THEMES)) {
  console.log(`\n${name}`);
  for (const back of BACKS) {
    for (const text of TEXT) {
      const r = ratio(t[text], t[back]);
      // fg-faint is only ever used at >=16px for metadata labels, which is
      // still normal text, so AA 4.5 applies to everything here.
      const pass = r >= 4.5;
      if (!pass) failures++;
      console.log(
        `  ${pass ? 'ok  ' : 'FAIL'} ${r.toFixed(2).padStart(5)}:1  --${text} on --${back}`,
      );
    }
  }
  for (const nt of NONTEXT) {
    const r = ratio(t[nt], t.bg);
    console.log(`  info ${r.toFixed(2).padStart(5)}:1  --${nt} on --bg (divider, not text)`);
  }
}

console.log(failures === 0 ? '\nAll text pairs meet WCAG AA (4.5:1).' : `\n${failures} pair(s) below AA.`);
process.exit(failures > 0 ? 1 : 0);
