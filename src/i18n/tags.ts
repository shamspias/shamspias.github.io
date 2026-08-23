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
  algorithms: { bn: 'অ্যালগরিদম', ar: 'الخوارزميات' },
  complexity: { bn: 'জটিলতা', ar: 'التعقيد' },
  'problem solving': { bn: 'প্রবলেম সলভিং', ar: 'حل المسائل' },
  beginners: { bn: 'শুরুর জন্য', ar: 'للمبتدئين' },
  'big-o': { bn: 'বিগ-ও', ar: 'رمز التعقيد' },
  arrays: { bn: 'অ্যারে', ar: 'المصفوفات' },
  'prefix sums': { bn: 'প্রিফিক্স সাম', ar: 'مجاميع البدايات' },
  'two pointers': { bn: 'টু পয়েন্টার', ar: 'المؤشران' },
  sorting: { bn: 'সর্টিং', ar: 'الترتيب' },
  'binary search': { bn: 'বাইনারি সার্চ', ar: 'البحث الثنائي' },
  greedy: { bn: 'গ্রিডি', ar: 'الجَشِعة' },
  recursion: { bn: 'রিকার্শন', ar: 'الاستدعاء الذاتي' },
  memoisation: { bn: 'মেমোয়াইজেশন', ar: 'التخزين المؤقت للنتائج' },
  'dynamic programming': { bn: 'ডায়নামিক প্রোগ্রামিং', ar: 'البرمجة الديناميكية' },
  graphs: { bn: 'গ্রাফ', ar: 'الرسوم البيانية' },
  'game theory': { bn: 'গেম থিওরি', ar: 'نظرية الألعاب' },
  'number theory': { bn: 'সংখ্যাতত্ত্ব', ar: 'نظرية الأعداد' },
  strings: { bn: 'স্ট্রিং', ar: 'النصوص' },
  'data structures': { bn: 'ডেটা স্ট্রাকচার', ar: 'هياكل البيانات' },
  'machine learning': { bn: 'মেশিন লার্নিং', ar: 'تعلّم الآلة' },
  memory: { bn: 'মেমরি', ar: 'الذاكرة' },
  cache: { bn: 'ক্যাশ', ar: 'الذاكرة المخبأة' },
  performance: { bn: 'পারফরম্যান্স', ar: 'الأداء' },
};

/** The label for a subject in a language, falling back to the English key. */
export const tagLabel = (tag: string, locale: Locale): string =>
  locale === DEFAULT_LOCALE ? tag : (LABELS[tag]?.[locale] ?? tag);

export default LABELS;
