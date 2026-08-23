import { getCollection, type CollectionEntry } from 'astro:content';
import { SERIES_ORDER } from '../consts';
import { DEFAULT_LOCALE, formatDateIn, localise, shortDateIn, type Locale } from '../i18n';

export type Post = CollectionEntry<'blog'>;

const isPublished = (p: Post) => import.meta.env.DEV || !p.data.draft;

/**
 * Every published post in one language, newest first.
 *
 * The collection holds all three languages, so a page that forgets to say which
 * one it wants would list the same post three times. The parameter is therefore
 * required in spirit and defaulted to English only because English is where
 * every existing caller already was.
 */
export async function allPosts(locale: Locale = DEFAULT_LOCALE): Promise<Post[]> {
  const posts = (await getCollection('blog')).filter(
    (p) => isPublished(p) && p.data.lang === locale,
  );
  return posts.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

/** Every post in every language, for the cross-language lookups. */
export async function everyPost(): Promise<Post[]> {
  return (await getCollection('blog')).filter(isPublished);
}

/**
 * The path a post lives at, in its own language. The permalink in the
 * frontmatter is always the canonical English shape; the language prefix is
 * applied here so it is applied the same way everywhere.
 */
export const urlOf = (p: Post) => localise(p.data.permalink, p.data.lang);

/** `/posts/2026/02/slug/` -> `2026/02/slug`, the rest-param for the route. */
export const routeParam = (p: Post) => p.data.permalink.slice('/posts/'.length).replace(/\/$/, '');

/**
 * Which languages a given post exists in, keyed by the permalink they share.
 * This is what the language switcher needs: not "which languages does the site
 * have" but "which languages does this page have", so it can offer the same
 * post rather than dropping the reader on a home page.
 */
export async function translationsOf(permalink: string): Promise<Map<Locale, Post>> {
  const found = new Map<Locale, Post>();
  for (const p of await everyPost()) {
    if (p.data.permalink === permalink) found.set(p.data.lang, p);
  }
  return found;
}

export function formatDate(d: Date, locale: Locale = DEFAULT_LOCALE): string {
  return formatDateIn(d, locale);
}

export function shortDate(d: Date, locale: Locale = DEFAULT_LOCALE): string {
  return shortDateIn(d, locale);
}

export const isoDate = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Reading time in whole minutes. Words are counted on the raw markdown with
 * fenced code blocks removed, because nobody reads a 200-line snippet at prose
 * speed; the block is then charged a flat few seconds instead.
 */
export function readingTime(body: string | undefined): number {
  if (!body) return 1;
  const fences = body.match(/^```[\s\S]*?^```/gm) ?? [];
  const prose = body.replace(/^```[\s\S]*?^```/gm, ' ');
  const words = (prose.match(/\S+/g) ?? []).length;
  const codeLines = fences.reduce((n, f) => n + f.split('\n').length, 0);
  const minutes = words / 220 + codeLines / 90;
  return Math.max(1, Math.round(minutes));
}

/** Posts of one series, in reading order. */
export function seriesOf(posts: Post[], name: string): Post[] {
  return posts
    .filter((p) => p.data.series === name)
    .sort((a, b) => (a.data.seriesOrder ?? 0) - (b.data.seriesOrder ?? 0));
}

/** All series, in the curated order, each with its posts in reading order. */
export function groupBySeries(posts: Post[]): { name: string; posts: Post[] }[] {
  const names = [...new Set(posts.map((p) => p.data.series).filter((s): s is string => !!s))];
  names.sort((a, b) => {
    const ia = SERIES_ORDER.indexOf(a as (typeof SERIES_ORDER)[number]);
    const ib = SERIES_ORDER.indexOf(b as (typeof SERIES_ORDER)[number]);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
  return names.map((name) => ({ name, posts: seriesOf(posts, name) }));
}

/**
 * A tag or series name as a URL segment.
 *
 * Tags are keys, not display text: they are written in English in every
 * language's frontmatter and translated for display through src/i18n/tags. That
 * keeps one subject page per subject per language, correctly cross-linked, and
 * it keeps the slugs ASCII.
 *
 * A name that slugifies to nothing would collide with the index route and fail
 * deep inside the build with "Missing parameter", so it is caught here.
 */
export function slugifyTag(t: string): string {
  const slug = t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  if (!slug) {
    throw new Error(
      `tag or series name has no ASCII characters to slugify: "${t}". ` +
        'Tags are English keys; translate the label in src/i18n/tags.ts instead.',
    );
  }
  return slug;
}

/** Every tag with its post count, most used first then alphabetical. */
export function tagCounts(posts: Post[]): { tag: string; slug: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const p of posts) for (const t of p.data.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, slug: slugifyTag(tag), count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

/** Posts grouped by year, newest year first. */
export function byYear(posts: Post[]): { year: number; posts: Post[] }[] {
  const years = new Map<number, Post[]>();
  for (const p of posts) {
    const y = p.data.date.getUTCFullYear();
    (years.get(y) ?? years.set(y, []).get(y)!).push(p);
  }
  return [...years.entries()].sort((a, b) => b[0] - a[0]).map(([year, ps]) => ({ year, posts: ps }));
}

/** Titles are plain text now that no emoji remain in them. */
export const plainTitle = (text: string) => text.trim();
