/**
 * Three small hast transforms that the long-form posts need.
 *
 * They are deliberately hand-rolled rather than pulled from npm: each is a
 * dozen lines, and the alternatives all drag in behaviour we do not want.
 */

const HEADINGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']);

/** Contiguous runs of emoji, including ZWJ sequences and variation selectors. */
const EMOJI_RUN =
  /(?:\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic}|[\u{1F3FB}-\u{1F3FF}])*)+|[\u{1F1E6}-\u{1F1FF}]{2}/gu;

function walk(node, parent, fn) {
  if (!node || typeof node !== 'object') return;
  fn(node, parent);
  const kids = node.children;
  if (!Array.isArray(kids)) return;
  for (let i = 0; i < kids.length; i++) walk(kids[i], node, fn);
}

/**
 * Every post in this collection puts an emoji at the end of its title and of
 * most headings. Left alone at full size they shout; wrapped in a span they can
 * be held back to read as ornament. CSS cannot select an emoji, so this is the
 * only place the job can be done.
 */
export function rehypeHeadingEmoji() {
  return (tree) => {
    walk(tree, null, (node) => {
      if (node.type !== 'element' || !HEADINGS.has(node.tagName)) return;
      node.children = splitEmoji(node.children);
    });
  };
}

function splitEmoji(children) {
  const out = [];
  for (const child of children) {
    if (child.type !== 'text' || !EMOJI_RUN.test(child.value)) {
      out.push(child);
      continue;
    }
    EMOJI_RUN.lastIndex = 0;
    let last = 0;
    let m;
    while ((m = EMOJI_RUN.exec(child.value)) !== null) {
      if (m.index > last) out.push({ type: 'text', value: child.value.slice(last, m.index) });
      out.push({
        type: 'element',
        tagName: 'span',
        properties: { className: ['e'], role: 'presentation' },
        children: [{ type: 'text', value: m[0] }],
      });
      last = m.index + m[0].length;
    }
    if (last < child.value.length) out.push({ type: 'text', value: child.value.slice(last) });
  }
  return out;
}

/**
 * A deep link on every h2/h3/h4. Astro has already assigned the ids, so this
 * only has to hang an anchor off them. Hidden until hover, and hidden entirely
 * on small screens where there is no room and no pointer to reveal it.
 */
export function rehypeHeadingAnchors() {
  return (tree) => {
    walk(tree, null, (node) => {
      if (node.type !== 'element') return;
      if (!['h2', 'h3', 'h4'].includes(node.tagName)) return;
      const id = node.properties?.id;
      if (!id) return;
      node.children.unshift({
        type: 'element',
        tagName: 'a',
        properties: {
          className: ['heading-anchor'],
          href: `#${id}`,
          'aria-label': 'Permalink to this section',
        },
        children: [{ type: 'text', value: '#' }],
      });
    });
  };
}

/**
 * Wrap every table so a wide comparison table scrolls on its own axis. Without
 * this a nine-column table gives the whole document a horizontal scrollbar on a
 * phone, which is the single ugliest failure mode in a technical post.
 *
 * tabindex makes the scroll container reachable by keyboard, which is required
 * once anything scrolls.
 */
export function rehypeScrollableTables() {
  return (tree) => {
    walk(tree, null, (node, parent) => {
      if (node.type !== 'element' || node.tagName !== 'table' || !parent) return;
      if (parent.type === 'element' && parent.properties?.className?.includes?.('table-scroll')) return;
      const idx = parent.children.indexOf(node);
      if (idx === -1) return;
      parent.children[idx] = {
        type: 'element',
        tagName: 'div',
        // No tabindex here: a runtime pass adds one only when the box really
        // overflows, so a table that fits does not become a tab stop.
        properties: { className: ['table-scroll'] },
        children: [node],
      };
    });
  };
}

/**
 * Two posts were written with `#` for their in-body sections, which would put
 * a second, third and nineteenth h1 on the page underneath the real title.
 * Rather than edit the prose, shift every heading down one level whenever a
 * document contains an h1, which restores a single-h1 outline without touching
 * a word. Must run before ids are assigned.
 */
export function rehypeDemoteHeadings() {
  return (tree) => {
    let hasH1 = false;
    walk(tree, null, (node) => {
      if (node.type === 'element' && node.tagName === 'h1') hasH1 = true;
    });
    if (!hasH1) return;
    walk(tree, null, (node) => {
      if (node.type !== 'element' || !HEADINGS.has(node.tagName)) return;
      const level = Number(node.tagName[1]);
      node.tagName = `h${Math.min(level + 1, 6)}`;
    });
  };
}
