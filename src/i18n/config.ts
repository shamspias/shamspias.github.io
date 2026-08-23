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

/*
 * There is deliberately no location or browser-language detection here. English
 * is the default for every first-time visitor, and Bangla or Arabic are reached
 * only by an explicit choice (the switcher, a `/bn` or `/ar` link, or `?lang=`),
 * which is then remembered. An earlier version auto-switched on the browser's
 * time zone; that was removed because a default should be a decision the reader
 * makes, not one the site guesses from where they happen to be.
 */

/** Where the reader's explicit choice is remembered. */
export const LOCALE_STORAGE_KEY = 'lang';
