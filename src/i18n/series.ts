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
  'Building Backends': {
    en:
      'The plumbing that turns a prototype into a service, written between 2019 and 2023: the ' +
      'handful of design patterns you actually use, choosing between Django and FastAPI, what a ' +
      'database transaction really guarantees, when to reach past SQL and when not to, REST APIs ' +
      'that age well, the real-time spectrum from polling to WebSocket to WebRTC, gRPC between ' +
      'services, and the small tricks that keep a backend boring. Problems, solutions, and the ' +
      'reason behind each.',
  },
  'LLM and Agent Security': {
    en:
      'Security for systems built on language models, where the oldest bug wears a new face: ' +
      'the model treats every piece of text as an instruction, so untrusted input is untrusted ' +
      'code. Prompt injection, direct and indirect, the blast radius of a tool-calling agent, ' +
      'masking PII and secrets before they reach the model, exfiltration through the model own ' +
      'output, and the harness that keeps an agent inside the authority of the person who asked. ' +
      'Every attack paired with the practice that contains it.',
  },
  'Security From the Ground Up': {
    en:
      'How systems get broken, and how they get defended, from first principles. Every ' +
      'vulnerability is one confusion: code mistaking data for instructions, or trusting ' +
      'input it should have checked. SQL injection, cross-site scripting, cross-site request ' +
      'forgery, broken access control, memory corruption, and what actually stops each one. ' +
      'Written to make you a developer who does not ship the bug, not a headline.',
  },
  'Problem Solving From Zero': {
    en:
      'Twenty parts, written between 2016 and 2021, from counting the steps in a loop to ' +
      'implementing machine learning by hand. Greedy, graphs, dynamic programming, game theory, ' +
      'number theory, strings, segment trees, and what the memory hierarchy does to all of them. ' +
      'Every part assumes only the part before it.',
    bn:
      'কুড়িটি পর্ব, ২০১৬ থেকে ২০২১ সালের মধ্যে লেখা: লুপের ধাপ গোনা থেকে শুরু করে নিজের হাতে ' +
      'মেশিন লার্নিং লেখা পর্যন্ত। গ্রিডি, গ্রাফ, ডায়নামিক প্রোগ্রামিং, গেম থিওরি, সংখ্যাতত্ত্ব, ' +
      'স্ট্রিং, সেগমেন্ট ট্রি, আর মেমরির স্তরবিন্যাস এই সবের ওপর যা করে। প্রতিটি পর্ব কেবল তার ' +
      'আগের পর্বটুকু ধরে নেয়।',
    ar:
      'عشرون جزءًا، كُتبت بين ٢٠١٦ و٢٠٢١: من عدّ الخطوات في حلقة تكرار إلى كتابة تعلّم الآلة ' +
      'باليد. الخوارزميات الجَشِعة، والرسوم البيانية، والبرمجة الديناميكية، ونظرية الألعاب، ' +
      'ونظرية الأعداد، والنصوص، وأشجار المقاطع، وما يفعله تدرّج الذاكرة بكل ذلك. كل جزء لا ' +
      'يفترض إلا الجزء الذي قبله.',
  },
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
