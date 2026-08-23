/**
 * The three languages this site is published in, and the rules that decide
 * which one a visitor gets.
 *
 * English is the default and lives at the root, so every URL that has ever been
 * published still resolves exactly as it did. Bangla and Arabic live under a
 * prefix. That asymmetry is deliberate: changing an existing address to make the
 * routing symmetrical would break every inbound link for the sake of tidiness.
 */

export const LOCALES = ['en', 'bn', 'ar'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';

export const isLocale = (v: unknown): v is Locale =>
  typeof v === 'string' && (LOCALES as readonly string[]).includes(v);

/** Everything that changes with the language, in one row per language. */
export const LOCALE_META: Record<
  Locale,
  {
    /** The BCP 47 tag that goes in `lang`, `hreflang` and `Intl`. */
    tag: string;
    /** Writing direction. Arabic is the only one that is not left to right. */
    dir: 'ltr' | 'rtl';
    /** The language's own name for itself, which is what a switcher must show. */
    endonym: string;
    /** Short label for the switcher, where there is room for two or three letters. */
    short: string;
    /** The Open Graph locale, which uses an underscore and wants a region. */
    og: string;
    /** Whether numerals are rendered in the language's own digits. */
    numerals: 'latn' | 'beng' | 'arab';
  }
> = {
  en: { tag: 'en', dir: 'ltr', endonym: 'English', short: 'EN', og: 'en_GB', numerals: 'latn' },
  bn: { tag: 'bn', dir: 'ltr', endonym: 'বাংলা', short: 'বাং', og: 'bn_BD', numerals: 'beng' },
  ar: { tag: 'ar', dir: 'rtl', endonym: 'العربية', short: 'ع', og: 'ar_AR', numerals: 'arab' },
};

/**
 * Which language a visitor is offered before they have chosen one.
 *
 * The site is a folder of static files, so there is no server to read a
 * country from a request. The best signal a browser will give is its IANA time
 * zone, which is a real place rather than a preference, and that is what the
 * rule below is written against: Bangladesh gets Bangla, the Arabic-speaking
 * countries get Arabic, everywhere else gets English.
 *
 * Time zones are listed rather than derived because there is no mapping from
 * zone to language anywhere in the platform, and because the list is short
 * enough to read. `Asia/Riyadh` covers most of the Gulf by aliasing, but the
 * aliases are spelled out so a browser that reports the specific zone is not
 * missed.
 */
export const ZONE_TO_LOCALE: Record<string, Locale> = {
  'Asia/Dhaka': 'bn',

  'Africa/Cairo': 'ar',
  'Africa/Algiers': 'ar',
  'Africa/Tripoli': 'ar',
  'Africa/Tunis': 'ar',
  'Africa/Casablanca': 'ar',
  'Africa/El_Aaiun': 'ar',
  'Africa/Khartoum': 'ar',
  'Africa/Juba': 'ar',
  'Africa/Nouakchott': 'ar',
  'Africa/Djibouti': 'ar',
  'Africa/Mogadishu': 'ar',
  'Asia/Riyadh': 'ar',
  'Asia/Aden': 'ar',
  'Asia/Kuwait': 'ar',
  'Asia/Bahrain': 'ar',
  'Asia/Qatar': 'ar',
  'Asia/Dubai': 'ar',
  'Asia/Muscat': 'ar',
  'Asia/Baghdad': 'ar',
  'Asia/Damascus': 'ar',
  'Asia/Beirut': 'ar',
  'Asia/Amman': 'ar',
  'Asia/Jerusalem': 'ar',
  'Asia/Hebron': 'ar',
  'Asia/Gaza': 'ar',
};

/** The language codes that map to a locale when only `navigator.language` is known. */
export const LANGUAGE_TO_LOCALE: Record<string, Locale> = {
  bn: 'bn',
  ar: 'ar',
  en: 'en',
};

/** Where the reader's explicit choice is remembered. */
export const LOCALE_STORAGE_KEY = 'lang';
