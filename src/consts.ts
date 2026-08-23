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
 * The CV is deliberately absent. It stays reachable at /cv/ for anyone given
 * the link, but it is not advertised in the nav, the footer, the sitemap or to
 * search engines.
 */
export const NAV = [
  { label: 'Writing', href: '/writing/' },
  { label: 'Projects', href: '/projects/' },
] as const;

export const SOCIAL = [
  { label: 'GitHub', href: 'https://github.com/shamspias', handle: 'shamspias' },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/in/shamspias0', handle: 'shamspias0' },
  { label: 'Email', href: `mailto:${SITE.email}`, handle: SITE.email },
] as const;

/**
 * Fixed display order for series, most recent body of work first. Anything not
 * listed here still renders; it just sorts after the known ones.
 */
export const SERIES_ORDER = [
  'Biomechanics from Video',
  'Agent Harness',
  'Machine Learning for Biology',
  'Vision in the Real World',
  'Mixture of Experts',
  'Retrieval and RAG',
  'AI Foundations',
] as const;
