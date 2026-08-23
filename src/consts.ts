export const SITE = {
  url: 'https://shamspias.com',
  name: 'Shamsuddin Ahmed',
  role: 'Senior Software Engineer',
  location: 'Dhaka, Bangladesh',
  title: 'Shamsuddin Ahmed',
  tagline: 'Agent harnesses, LLM infrastructure, and machine learning for biology.',
  description:
    'Shamsuddin Ahmed, senior software engineer in Dhaka: agent harnesses, LLM serving ' +
    'infrastructure, and machine learning for biology. Long-form notes on all three.',
  email: 'info@shamspias.com',
  locale: 'en',
  since: 2021,
} as const;

/**
 * The nav is built in the header, per language, from the translated labels in
 * src/i18n. It is three links: Writing, Projects, and Surprised (the games page).
 *
 * The CV is deliberately absent from it. It stays reachable at /cv/ for anyone
 * given the link, but it is not advertised in the nav, the footer, the sitemap
 * or to search engines.
 */

export const SOCIAL = [
  { label: 'GitHub', href: 'https://github.com/shamspias', handle: 'shamspias' },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/in/shamspias0', handle: 'shamspias0' },
  { label: 'Email', href: `mailto:${SITE.email}`, handle: SITE.email },
] as const;

/*
 * There is no hand-maintained series order any more. The series pages and the
 * home page rank series by their most recent post (see groupBySeries in
 * src/lib/posts.ts), so a newly written series rises to the top on its own.
 */
