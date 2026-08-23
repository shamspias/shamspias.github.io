/**
 * Three small hast transforms that the long-form posts need.
 *
 * They are deliberately hand-rolled rather than pulled from npm: each is a
 * dozen lines, and the alternatives all drag in behaviour we do not want.
 */

const HEADINGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']);

/** Contiguous runs of emoji, including ZWJ sequences and variation selectors. */
function walk(node, parent, fn) {
  if (!node || typeof node !== 'object') return;
  fn(node, parent);
  const kids = node.children;
  if (!Array.isArray(kids)) return;
  for (let i = 0; i < kids.length; i++) walk(kids[i], node, fn);
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
        properties: { className: ['table-scroll'], tabindex: '0', role: 'region', 'aria-label': 'Table' },
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

/**
 * Turns a standalone image into a plate: a <figure> with a mono caption taken
 * from the markdown title attribute.
 *
 *     ![alt text](/figures/thing.svg "The caption, set in mono under the plate")
 *
 * Only images that are the sole child of a paragraph are lifted, so an inline
 * badge inside a sentence is left where it is.
 */
export function rehypeFigures() {
  return (tree) => {
    walk(tree, null, (node, parent) => {
      if (node.type !== 'element' || node.tagName !== 'p' || !parent) return;
      const kids = node.children.filter(
        (c) => !(c.type === 'text' && c.value.trim() === ''),
      );
      if (kids.length !== 1) return;
      const img = kids[0];
      if (img.type !== 'element' || img.tagName !== 'img') return;

      const caption = img.properties?.title;
      delete img.properties.title;

      const children = [img];
      if (caption) {
        children.push({
          type: 'element',
          tagName: 'figcaption',
          properties: {},
          children: [{ type: 'text', value: String(caption) }],
        });
      }

      const idx = parent.children.indexOf(node);
      if (idx === -1) return;
      parent.children[idx] = {
        type: 'element',
        tagName: 'figure',
        properties: { className: ['plate'] },
        children,
      };
    });
  };
}


/**
 * Anything that scrolls has to be reachable by keyboard (WCAG 2.1.1). Whether a
 * given block actually overflows depends on the viewport, so this cannot be
 * decided correctly at build time, and deciding it at runtime turned out to be
 * a race: a ResizeObserver does not fire when the webfont swap changes how much
 * the content inside a box overflows without changing the box.
 *
 * So every scroll container is marked focusable, always. The cost is a few
 * extra tab stops in a code-heavy post. The alternative is a keyboard user
 * meeting a code block they cannot scroll, which is worse and, being a race,
 * would only happen to some of them.
 */
export function rehypeFocusableScrollers() {
  return (tree) => {
    walk(tree, null, (node) => {
      if (node.type !== 'element') return;
      const isPre = node.tagName === 'pre';
      const isMath =
        node.tagName === 'span' && node.properties?.className?.includes?.('katex-display');
      const isFigure =
        node.tagName === 'div' && node.properties?.className?.includes?.('figure-svg');
      if (!isPre && !isMath && !isFigure) return;
      node.properties = node.properties ?? {};
      node.properties.tabindex = '0';
      // An inlined figure already carries role="img" and its alt text as the
      // accessible name; overwriting either would lose the description.
      if (!isFigure) {
        node.properties.role = 'region';
        node.properties['aria-label'] = isMath ? 'Equation' : 'Code block';
      }
    });
  };
}

/**
 * Inlines a local SVG figure into the document instead of leaving it in an
 * <img src>.
 *
 * This is what makes the charts theme-aware. An <img> is an opaque document: it
 * cannot see `currentColor`, cannot read `--accent`, and cannot respond to the
 * site's own light/dark toggle, only to the OS preference. The alternative was
 * an invert() filter over the whole plate, which flipped the one red to cyan.
 * Inlining the markup at build time means every stroke and label resolves
 * against the page's own tokens, in both themes and through the toggle, at no
 * runtime cost.
 *
 * Takes a resolver so the plugin stays free of filesystem concerns.
 */
export function rehypeInlineFigures({ read } = {}) {
  if (typeof read !== 'function') throw new Error('rehypeInlineFigures needs a read(src) function');

  return (tree) => {
    walk(tree, null, (node, parent) => {
      if (node.type !== 'element' || node.tagName !== 'img' || !parent) return;
      const src = node.properties?.src;
      if (typeof src !== 'string' || !src.startsWith('/figures/') || !src.endsWith('.svg')) return;

      const markup = read(src);
      if (!markup) return;

      const idx = parent.children.indexOf(node);
      if (idx === -1) return;

      // The alt text becomes the accessible name of the inlined graphic, so it
      // is not lost when the <img> goes away.
      const alt = typeof node.properties.alt === 'string' ? node.properties.alt : '';

      // A chart that shrinks to the width of a phone stops being readable: its
      // labels are set in absolute units inside the viewBox, so scaling the
      // figure scales the type with it. Below a floor the figure scrolls
      // instead of shrinking. The floor is the figure's own width, capped, so a
      // narrow diagram is never blown up to meet it.
      const natural = Number(markup.match(/\swidth="(\d+(?:\.\d+)?)"/)?.[1] ?? 0);
      const floor = natural ? Math.min(Math.round(natural), 620) : 0;

      parent.children[idx] = {
        type: 'element',
        tagName: 'div',
        properties: {
          className: ['figure-svg'],
          role: 'img',
          'aria-label': alt,
          style: floor ? `--fig-floor:${floor}px` : undefined,
        },
        children: [{ type: 'raw', value: markup }],
      };
    });
  };
}
