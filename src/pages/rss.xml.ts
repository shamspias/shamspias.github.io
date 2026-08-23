import rss from '@astrojs/rss';
import type { APIRoute } from 'astro';
import { SITE } from '../consts';
import { allPosts, plainTitle, urlOf } from '../lib/posts';

export const GET: APIRoute = async (context) => {
  const posts = await allPosts();

  return rss({
    title: `${SITE.name} — Writing`,
    description: SITE.description,
    site: context.site ?? SITE.url,
    trailingSlash: true,
    xmlns: { atom: 'http://www.w3.org/2005/Atom' },
    customData: [
      '<language>en-gb</language>',
      `<copyright>© ${new Date().getUTCFullYear()} ${SITE.name}</copyright>`,
      `<atom:link href="${new URL('/rss.xml', SITE.url).href}" rel="self" type="application/rss+xml" />`,
    ].join(''),
    items: posts.map((post) => ({
      title: plainTitle(post.data.title),
      description: post.data.description,
      pubDate: post.data.date,
      link: urlOf(post),
      categories: [...post.data.tags],
      customData: post.data.series
        ? `<category domain="series">${post.data.series}</category>`
        : undefined,
    })),
  });
};
