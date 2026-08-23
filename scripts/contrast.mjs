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
    bg: '#fcfbf8',
    'bg-sunken': '#f5f3ee',
    'bg-code': '#f7f5f0',
    fg: '#191c20',
    'fg-strong': '#0d0f12',
    'fg-muted': '#545a62',
    'fg-faint': '#656c75',
    accent: '#0f5c74',
    'accent-hover': '#0a4356',
    rule: '#e3e0d8',
    'rule-strong': '#cdc8bd',
  },
  dark: {
    bg: '#14161a',
    'bg-sunken': '#1a1d22',
    'bg-code': '#1b1e23',
    fg: '#e7e5e0',
    'fg-strong': '#f6f4f0',
    'fg-muted': '#a3a8b0',
    'fg-faint': '#868c94',
    accent: '#79c2dc',
    'accent-hover': '#a3d6e8',
    rule: '#262a30',
    'rule-strong': '#363b43',
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
