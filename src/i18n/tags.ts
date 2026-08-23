/**
 * Subject labels, per language.
 *
 * A tag is a key. It is written in English in every language's frontmatter,
 * exactly like a series name, for three reasons: one subject page per subject
 * per language that can be cross-linked with hreflang, ASCII slugs, and no risk
 * of the same subject splitting into three unconnected pages.
 *
 * What is translated is the label a reader sees. Anything without a translation
 * falls back to the key, which is English and therefore always readable.
 */
import { DEFAULT_LOCALE, type Locale } from './config';

const LABELS: Record<string, Partial<Record<Locale, string>>> = {
  algorithms: { bn: 'অ্যালগরিদম' },
  complexity: { bn: 'জটিলতা' },
  'problem solving': { bn: 'প্রবলেম সলভিং' },
  beginners: { bn: 'শুরুর জন্য' },
  'big-o': { bn: 'বিগ-ও' },
  arrays: { bn: 'অ্যারে' },
  'prefix sums': { bn: 'প্রিফিক্স সাম' },
  'two pointers': { bn: 'টু পয়েন্টার' },
  sorting: { bn: 'সর্টিং' },
  'binary search': { bn: 'বাইনারি সার্চ' },
  greedy: { bn: 'গ্রিডি' },
  recursion: { bn: 'রিকার্শন' },
  memoisation: { bn: 'মেমোয়াইজেশন' },
  'dynamic programming': { bn: 'ডায়নামিক প্রোগ্রামিং' },
  graphs: { bn: 'গ্রাফ' },
  'game theory': { bn: 'গেম থিওরি' },
  'number theory': { bn: 'সংখ্যাতত্ত্ব' },
  strings: { bn: 'স্ট্রিং' },
  'data structures': { bn: 'ডেটা স্ট্রাকচার' },
  'machine learning': { bn: 'মেশিন লার্নিং' },
  memory: { bn: 'মেমরি' },
  cache: { bn: 'ক্যাশ' },
  performance: { bn: 'পারফরম্যান্স' },
};

/** The label for a subject in a language, falling back to the English key. */
export const tagLabel = (tag: string, locale: Locale): string =>
  locale === DEFAULT_LOCALE ? tag : (LABELS[tag]?.[locale] ?? tag);

export default LABELS;
