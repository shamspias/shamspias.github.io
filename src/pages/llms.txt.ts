import type { APIRoute } from 'astro';
import { SITE, SOCIAL } from '../consts';
import { allPosts, groupBySeries, isoDate, plainTitle, urlOf } from '../lib/posts';

/**
 * `/llms.txt`, the plain-text index a language model can read in one request.
 *
 * A crawler that renders pages gets the sitemap and the structured data. A model
 * asked "what has this person written about docking" gets a hundred and eighty
 * HTML pages and a token budget. This is the same information as one flat file:
 * every post, its subject, its date and one line of what it argues, grouped by
 * series so the reading order survives.
 *
 * Generated from the same content collection as the site, so it cannot drift.
 */
export const GET: APIRoute = async () => {
  const posts = await allPosts();
  const series = groupBySeries(posts);
  const inSeries = new Set(series.flatMap((s) => s.posts.map((p) => p.id)));
  const loose = posts.filter((p) => !inSeries.has(p.id));

  const line = (p: (typeof posts)[number]) =>
    `- [${plainTitle(p.data.title)}](${new URL(urlOf(p), SITE.url).href}): ${p.data.description} (${isoDate(p.data.date)})`;

  const out: string[] = [
    `# ${SITE.name}`,
    '',
    `> ${SITE.description}`,
    '',
    `${SITE.role} at Mevrik, founder of AlgolyzerLab, based in ${SITE.location}.`,
    'Everything below is written by hand and free to read. Figures and numbers come',
    'from measurements taken on the systems described, and the posts say when a',
    'result came out badly.',
    '',
    '## Site',
    '',
    `- [Home](${SITE.url}/): who I am and what I am working on now.`,
    `- [Writing](${SITE.url}/writing/): all ${posts.length} posts, newest first.`,
    `- [Series](${SITE.url}/series/): ${series.length} multi-part runs, each in reading order.`,
    `- [Subjects](${SITE.url}/tags/): every subject, as an index.`,
    `- [Projects](${SITE.url}/projects/): what I have built, and what each one taught me.`,
    `- [RSS](${SITE.url}/rss.xml): the feed.`,
    '',
    '## Series',
    '',
  ];

  for (const s of series) {
    out.push(`### ${s.name}`, '');
    out.push(...s.posts.map(line), '');
  }

  if (loose.length) {
    out.push('## Standalone posts', '', ...loose.map(line), '');
  }

  out.push(
    '## Elsewhere',
    '',
    ...SOCIAL.filter((s) => s.href.startsWith('http')).map((s) => `- ${s.label}: ${s.href}`),
    '',
  );

  return new Response(out.join('\n'), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
