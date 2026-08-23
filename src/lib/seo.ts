/**
 * Everything a crawler reads, in one place.
 *
 * Two jobs. First, resolve which Open Graph card a page shares, which is a
 * question about what exists on disk. Second, build the structured data, which
 * is the part search engines use to work out that a page is a post in a series
 * written by a person, rather than a wall of text at a URL.
 *
 * The schema is emitted as a single `@graph` per page. Separate blocks work, but
 * a graph lets the nodes reference each other by `@id`, so the person, the site
 * and the article are stated once and pointed at from everywhere else.
 */
import { readdirSync } from 'node:fs';
import { SITE, SOCIAL } from '../consts';
import { DEFAULT_LOCALE, LOCALES, LOCALE_META, delocalise, localise, t, type Locale } from '../i18n';

/* --- identity ----------------------------------------------------------- */

const ORIGIN = SITE.url;

export const abs = (p: string) => new URL(p, ORIGIN).href;

/**
 * Trims a generated description to something a result can actually show.
 * Google cuts the snippet around 160 characters, so anything past that is
 * written for nobody. Cuts on a word boundary and keeps the sentence readable.
 */
export function clamp(text: string, limit = 158): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= limit) return clean;
  const cut = clean.slice(0, limit).replace(/[\s,;:.]+\S*$/, '');
  return `${cut}.`;
}

/** Stable node ids, so the graph can be stitched together across pages. */
export const ID = {
  person: `${ORIGIN}/#person`,
  website: `${ORIGIN}/#website`,
  blog: `${ORIGIN}/writing/#blog`,
} as const;

/* --- Open Graph cards --------------------------------------------------- */

// Read once at build time. A page asks for its card by route; if the card was
// never rendered, it falls back to the card for its section rather than to a
// generic image, so a shared tag page still looks like this site.
const CARDS: Set<string> = (() => {
  try {
    return new Set(
      readdirSync('public/og')
        .filter((f) => f.endsWith('.png'))
        .map((f) => f.replace(/\.png$/, '')),
    );
  } catch {
    return new Set<string>();
  }
})();

/**
 * The card slug for a path. The language prefix is stripped first: a card is
 * keyed by the page it belongs to, and a translated page shares the card of the
 * page it translates unless a card of its own has been rendered.
 */
export const cardSlug = (pathname: string) => {
  const { locale, path } = delocalise(pathname);
  const base = path.replace(/^\/|\/$/g, '').replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'home';
  return locale === DEFAULT_LOCALE ? base : `${locale}-${base}`;
};

/** The card a page shares, and the alt text that goes with it. */
export function ogCard(pathname: string, title: string, locale: Locale = DEFAULT_LOCALE) {
  const { path } = delocalise(pathname);
  const english = cardSlug(path);
  const section = path.startsWith('/tags/') ? 'tags' : path.startsWith('/series/') ? 'series' : 'home';

  // In order: a card for this page in this language, the English card for the
  // same page, the card for the section, the site card.
  const candidates = [cardSlug(pathname), english, section];
  const use = candidates.find((c) => CARDS.has(c));
  return {
    url: use ? abs(`/og/${use}.png`) : abs('/og.png'),
    width: 1200,
    height: 630,
    alt: `${title} — ${SITE.name}, ${t(locale).role}`,
  };
}

/* --- schema nodes ------------------------------------------------------- */

/** The person every page attributes its content to. */
export const person = () => ({
  '@type': 'Person',
  '@id': ID.person,
  name: SITE.name,
  alternateName: 'Shams',
  url: ORIGIN,
  email: `mailto:${SITE.email}`,
  jobTitle: SITE.role,
  description: SITE.description,
  image: abs('/og/home.png'),
  address: { '@type': 'PostalAddress', addressLocality: 'Dhaka', addressCountry: 'BD' },
  worksFor: { '@type': 'Organization', name: 'Mevrik', url: 'https://mevrik.com' },
  founder: { '@type': 'Organization', name: 'AlgolyzerLab', url: 'https://algolyzerlab.com' },
  sameAs: SOCIAL.filter((s) => s.href.startsWith('http')).map((s) => s.href),
  knowsAbout: [
    'Agent harnesses',
    'Tool calling and function calling',
    'Large language model serving',
    'Retrieval-augmented generation',
    'Mixture-of-experts models',
    'Machine learning for biology',
    'Peptide bioactivity prediction',
    'Molecular docking and virtual screening',
    'Human pose estimation',
    'Sports biomechanics',
    'Computer vision',
    'Backend engineering',
    'Go',
    'Python',
  ],
});

/** The site itself. Named separately so a post can say which site it is on. */
export const website = () => ({
  '@type': 'WebSite',
  '@id': ID.website,
  url: ORIGIN,
  name: SITE.name,
  alternateName: 'shamspias.com',
  description: SITE.description,
  inLanguage: 'en',
  publisher: { '@id': ID.person },
  copyrightHolder: { '@id': ID.person },
  copyrightYear: SITE.since,
});

/**
 * A minimal stand-in for the blog, so a post's `isPartOf` resolves inside its
 * own graph instead of pointing at a node only `/writing/` defines. The full
 * node, with its post list, lives on that page.
 */
export const blogRef = () => ({
  '@type': 'Blog',
  '@id': ID.blog,
  url: abs('/writing/'),
  name: 'Writing by Shamsuddin Ahmed',
  publisher: { '@id': ID.person },
});

/**
 * Breadcrumbs are the one piece of structured data whose effect is visible in
 * the result itself: the path replaces the raw URL under the title.
 */
export const breadcrumb = (trail: { name: string; url: string }[]) => ({
  '@type': 'BreadcrumbList',
  '@id': `${abs(trail[trail.length - 1]?.url ?? '/')}#breadcrumb`,
  itemListElement: trail.map((step, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    name: step.name,
    item: abs(step.url),
  })),
});

/** An ordered list of links, for an index page that is mostly links. */
export const itemList = (
  id: string,
  items: { name: string; url: string }[],
  extra: Record<string, unknown> = {},
) => ({
  '@type': 'ItemList',
  '@id': `${id}#list`,
  numberOfItems: items.length,
  itemListOrder: 'https://schema.org/ItemListOrderDescending',
  itemListElement: items.map((item, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    url: abs(item.url),
    name: item.name,
  })),
  ...extra,
});

/**
 * The `hreflang` set for a page.
 *
 * Every language version points at every other one and at itself, which is what
 * the specification requires: a set where one member is missing the return
 * reference is ignored. `x-default` names the version a crawler should show when
 * it has no better idea, and that is English.
 */
export function alternates(path: string, available: readonly Locale[] = LOCALES) {
  const rows = available.map((locale) => ({
    locale,
    hreflang: LOCALE_META[locale].tag,
    href: abs(localise(path, locale)),
  }));
  if (available.includes(DEFAULT_LOCALE)) {
    rows.push({ locale: DEFAULT_LOCALE, hreflang: 'x-default', href: abs(localise(path, DEFAULT_LOCALE)) });
  }
  return rows;
}

/** Wraps a set of nodes as the page's single JSON-LD block. */
export const graph = (...nodes: unknown[]) => ({
  '@context': 'https://schema.org',
  '@graph': nodes.filter(Boolean),
});

/**
 * A page that is a list of other pages. `about` carries the subject keywords so
 * a thin index still declares what it is an index of.
 */
export function collectionPage({
  url,
  name,
  description,
  trail,
  items,
  about,
  locale = DEFAULT_LOCALE,
}: {
  url: string;
  name: string;
  description: string;
  trail: { name: string; url: string }[];
  items: { name: string; url: string }[];
  about?: string[];
  locale?: Locale;
}) {
  const id = abs(url);
  return graph(
    person(),
    website(),
    {
      '@type': 'CollectionPage',
      '@id': id,
      url: id,
      name,
      description,
      inLanguage: LOCALE_META[locale].tag,
      isPartOf: { '@id': ID.website },
      author: { '@id': ID.person },
      about: about?.length ? about.map((t) => ({ '@type': 'Thing', name: t })) : undefined,
      breadcrumb: { '@id': `${id}#breadcrumb` },
      mainEntity: { '@id': `${id}#list` },
    },
    breadcrumb(trail),
    itemList(id, items),
  );
}
