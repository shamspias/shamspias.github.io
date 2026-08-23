import { getCollection, type CollectionEntry } from 'astro:content';
import { SERIES_ORDER } from '../consts';

export type Post = CollectionEntry<'blog'>;

const isPublished = (p: Post) => import.meta.env.DEV || !p.data.draft;

/** Every published post, newest first. */
export async function allPosts(): Promise<Post[]> {
  const posts = (await getCollection('blog')).filter(isPublished);
  return posts.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

/** The path a post lives at. Read straight off the frontmatter, never derived. */
export const urlOf = (p: Post) => p.data.permalink;

/** `/posts/2026/02/slug/` -> `2026/02/slug`, the rest-param for the route. */
export const routeParam = (p: Post) => p.data.permalink.slice('/posts/'.length).replace(/\/$/, '');

export function formatDate(d: Date): string {
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function shortDate(d: Date): string {
  return d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' });
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

export const slugifyTag = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

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
