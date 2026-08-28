/**
 * The helpers every localised page uses: which language am I, what does a URL
 * look like in that language, and how does a date read in it.
 */
import {
  DEFAULT_LOCALE,
  LOCALES,
  LOCALE_META,
  isLocale,
  type Locale,
} from './config';
import { STRINGS, num, yearNum, type Strings } from './strings';

export { DEFAULT_LOCALE, LOCALES, LOCALE_META, isLocale, STRINGS, num, yearNum };
export type { Locale, Strings };

/** The interface strings for one language. */
export const t = (locale: Locale): Strings => STRINGS[locale];

/**
 * The rest parameter that produces a locale's routes. English is `undefined`,
 * which is what makes `/writing/` and not `/en/writing/`.
 */
export const localeParam = (locale: Locale) => (locale === DEFAULT_LOCALE ? undefined : locale);

/** Every locale as a route parameter, for `getStaticPaths`. */
export const localePaths = () =>
  LOCALES.map((locale) => ({ params: { locale: localeParam(locale) }, props: { locale } }));

/** Reads the locale back out of a rest parameter. */
export const localeFromParam = (param: string | undefined): Locale =>
  isLocale(param) ? param : DEFAULT_LOCALE;

/**
 * A site path in a given language.
 *
 * Takes the English path and prefixes it, so every page can be written once
 * against the canonical structure. Passing a path that already carries a prefix
 * is a bug rather than something to be tolerated, because the result would be
 * `/bn/bn/writing/` and nothing would notice until a reader clicked it.
 */
export function localise(path: string, locale: Locale): string {
  if (!path.startsWith('/')) throw new Error(`localise expects an absolute path, got ${path}`);
  for (const l of LOCALES) {
    if (l !== DEFAULT_LOCALE && (path === `/${l}` || path.startsWith(`/${l}/`))) {
      throw new Error(`localise received an already-prefixed path: ${path}`);
    }
  }
  if (locale === DEFAULT_LOCALE) return path;
  return path === '/' ? `/${locale}/` : `/${locale}${path}`;
}

/** Strips a locale prefix back off, giving the canonical English path. */
export function delocalise(path: string): { locale: Locale; path: string } {
  for (const l of LOCALES) {
    if (l === DEFAULT_LOCALE) continue;
    if (path === `/${l}/` || path === `/${l}`) return { locale: l, path: '/' };
    if (path.startsWith(`/${l}/`)) return { locale: l, path: path.slice(`/${l}`.length) };
  }
  return { locale: DEFAULT_LOCALE, path };
}

/** Writing direction, for the `dir` attribute and for direction-aware CSS. */
export const dir = (locale: Locale) => LOCALE_META[locale].dir;

/** The BCP 47 tag, for `lang`, `hreflang` and every `Intl` call. */
export const tag = (locale: Locale) => LOCALE_META[locale].tag;

const dateOptions = { timeZone: 'UTC' } as const;

/** "20 August 2026", in the language and its own numerals. */
export const formatDateIn = (d: Date, locale: Locale): string =>
  new Intl.DateTimeFormat(LOCALE_META[locale].tag, {
    ...dateOptions,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    numberingSystem: LOCALE_META[locale].numerals,
  }).format(d);

/** "Aug 2026", for a dense index. */
export const shortDateIn = (d: Date, locale: Locale): string =>
  new Intl.DateTimeFormat(LOCALE_META[locale].tag, {
    ...dateOptions,
    month: 'short',
    year: 'numeric',
    numberingSystem: LOCALE_META[locale].numerals,
  }).format(d);

/** A year on its own, in local numerals, never grouped (2026, not 2,026). */
export const yearIn = (year: number, locale: Locale): string =>
  new Intl.NumberFormat(LOCALE_META[locale].tag, {
    numberingSystem: LOCALE_META[locale].numerals,
    useGrouping: false,
  }).format(year);

/**
 * A two-digit part number, in the language's numerals.
 *
 * `padStart` on a Latin string then converting would pad with the wrong zero,
 * so the padding happens after the digits are converted.
 */
export function ordinalIn(n: number, locale: Locale): string {
  const digits = num(locale, n);
  const zero = num(locale, 0);
  return digits.length >= 2 ? digits : zero + digits;
}
