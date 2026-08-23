/**
 * The one-paragraph description of each series, per language.
 *
 * A series name is data: it is written once, in English, in the frontmatter of
 * every post that belongs to it, and it is what groups them. The prose about it
 * is interface text, so it is translated here. Anything without a translation
 * falls back to English rather than disappearing, because a missing blurb would
 * silently turn a described series into a bare list.
 */
import { DEFAULT_LOCALE, type Locale } from './config';

type Blurbs = Partial<Record<Locale, string>>;

const SERIES: Record<string, Blurbs> = {
  'Biomechanics from Video': {
    en:
      'The measurement programme behind Athlete Intelligence: what "accurate" means for a joint ' +
      'angle, why 2D beat 3D on the angles that matter, how a camera can be taught to grade its own ' +
      'footage, and what the system refuses to measure. Every figure is one I measured, including ' +
      'the ones that came out badly.',
  },
  'Agent Harness': {
    en:
      'The layer between a language model and software that already exists: what to expose, how to ' +
      'keep it safe, and how to store an agent so it can be changed without a deploy.',
  },
  'Machine Learning for Biology': {
    en:
      'From what a peptide is, through the descriptor zoo and protein language models, to screening ' +
      'four hundred thousand natural products and docking the survivors.',
  },
  'Vision in the Real World': {
    en:
      'Pose estimation and image models pointed at problems that pay: a bowling action, a clinical ' +
      'record, a diseased field seen from a drone.',
  },
  'Mixture of Experts': {
    en:
      'How sparse expert models route a token, and what to do about the one expert that holds ' +
      'everyone else up.',
  },
  'Retrieval and RAG': {
    en:
      'Which retrieval numbers actually matter, and a reproducible way to find out which stack to ' +
      'build on.',
  },
  'AI Foundations': {
    en:
      'A run through the classical ground: linear algebra, search, adversarial search, constraint ' +
      'satisfaction, logic, and planning. Written for someone starting from nothing.',
  },
};

/** The blurb for a series in a language, falling back to English. */
export const seriesBlurb = (name: string, locale: Locale): string | undefined =>
  SERIES[name]?.[locale] ?? SERIES[name]?.[DEFAULT_LOCALE];

/** Registers or replaces a series blurb. Used by the tests, not by the pages. */
export const knownSeries = () => Object.keys(SERIES);

export default SERIES;
