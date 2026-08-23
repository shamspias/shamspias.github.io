/**
 * Every word of interface text, in the three languages.
 *
 * Counted phrases are functions rather than templates with a number spliced in.
 * English needs two forms and Bangla needs one, so the plural rule is part of
 * the string rather than something spliced in after translation.
 */
import { LOCALE_META, type Locale } from './config';

/** A number in the language's own digits. */
export const num = (locale: Locale, n: number): string =>
  new Intl.NumberFormat(LOCALE_META[locale].tag, {
    numberingSystem: LOCALE_META[locale].numerals,
  }).format(n);


type Strings = {
  /* chrome */
  skipToContent: string;
  primaryNav: string;
  language: string;
  languageOf: string;
  theme: string;
  themeSystem: string;
  themeLight: string;
  themeDark: string;
  role: string;
  home: string;
  /** The comma between a role and its organisation. */
  comma: string;
  /** Shown where a language's index has nothing in it yet. */
  emptyIndex: string;
  /** The site's own description, which is the front page's snippet. */
  siteDescription: string;

  /* nav and sections */
  writing: string;
  projects: string;
  series: string;
  subjects: string;
  surprised: string;
  cv: string;

  /* footer */
  elsewhere: string;
  read: string;
  thisSite: string;
  allWriting: string;
  bySubject: string;
  colophon: string;
  /** The copyright line: a year and a name, nothing more. */
  legal: (year: string, name: string) => string;

  /* counted phrases */
  nPosts: (n: number) => string;
  nSeries: (n: number) => string;
  nYears: (n: number) => string;
  nParts: (n: number) => string;
  nMinutes: (n: number) => string;

  /* writing index */
  writingLede: string;
  /** The snippet for the writing index. The lede is longer than a result shows. */
  writingDesc: string;
  browseAria: string;
  allSubjectsArrow: string;

  /* series */
  seriesLede: string;
  seriesInOrder: string;
  allSeries: string;
  partsInOrder: (n: number) => string;

  /* subjects */
  subjectsLede: string;
  subject: string;
  /** The generated snippet for a subject index page. */
  tagDesc: (tag: string, count: number, sample: string) => string;

  /* post */
  aboutThisPost: string;
  published: string;
  length: string;
  filedUnder: string;
  contents: string;
  otherPosts: string;
  previous: string;
  next: string;
  seriesStrip: (name: string) => string;
  partOf: (name: string) => string;

  /* translation state */
  notTranslated: string;
  readInEnglish: string;
  availableIn: string;

  /* 404 */
  notFoundLabel: string;
  notFoundTitle: string;
  notFoundLede: string;
  notFoundBack: string;
};

const en: Strings = {
  skipToContent: 'Skip to content',
  primaryNav: 'Primary',
  language: 'Language',
  languageOf: 'Choose a language',
  theme: 'Theme',
  themeSystem: 'System theme',
  themeLight: 'Light theme',
  themeDark: 'Dark theme',
  role: 'Senior Software Engineer',
  home: 'Home',
  comma: ', ',
  emptyIndex: 'Nothing here yet in this language.',
  siteDescription:
    'Shamsuddin Ahmed, senior software engineer in Dhaka: agent harnesses, LLM serving ' +
    'infrastructure, and machine learning for biology. Long-form notes on all three.',

  writing: 'Writing',
  projects: 'Projects',
  series: 'Series',
  subjects: 'Subjects',
  surprised: 'Surprised',
  cv: 'Curriculum Vitae',

  elsewhere: 'Elsewhere',
  read: 'Read',
  thisSite: 'This site',
  allWriting: 'All writing',
  bySubject: 'by subject',
  colophon:
    'Written and built by hand. Static files, no tracking, no cookies, and nothing that needs your consent.',
  legal: (year, name) => `© ${year} ${name}`,

  nPosts: (n) => `${n} ${n === 1 ? 'post' : 'posts'}`,
  nSeries: (n) => `${n} ${n === 1 ? 'series' : 'series'}`,
  nYears: (n) => `${n} ${n === 1 ? 'year' : 'years'}`,
  nParts: (n) => `${n} ${n === 1 ? 'part' : 'parts'}`,
  nMinutes: (n) => `${n} min read`,

  writingLede:
    'I write to understand things, not to look clever. Everything here explains a hard idea the way I wish someone had explained it to me, with analogies, runnable code, and honest numbers.',
  writingDesc:
    'Long-form notes on agent harnesses, LLM infrastructure, machine learning for biology, ' +
    'computer vision, and the AI foundations underneath all of it.',
  browseAria: 'Browse by series and subject',
  allSubjectsArrow: 'All subjects',

  seriesLede:
    'Some things do not fit in one piece. These are the runs: each part stands on its own, and they are stronger read in order.',
  seriesInOrder: 'Written to be read in order, and to stand up out of it.',
  allSeries: 'All series',
  partsInOrder: (n) => `${n} ${n === 1 ? 'part' : 'parts'}, in reading order`,

  subjectsLede:
    'Every subject written about here. The bigger the count, the longer I have been circling it.',
  subject: 'Subject',
  tagDesc: (tag, count, sample) =>
    `${count} ${count === 1 ? 'post' : 'posts'} on ${tag} by Shamsuddin Ahmed` +
    (sample ? `, including ${sample}.` : '.') +
    ' Worked examples, measured results, and the code behind them.',

  aboutThisPost: 'About this post',
  published: 'Published',
  length: 'Length',
  filedUnder: 'Filed under',
  contents: 'Contents',
  otherPosts: 'Other posts',
  previous: 'Previous',
  next: 'Next',
  seriesStrip: (name) => `The ${name} series`,
  partOf: (name) => `Part of ${name}`,

  notTranslated: 'This one is not translated yet.',
  readInEnglish: 'Read it in English',
  availableIn: 'Also in',

  notFoundLabel: 'Error 404',
  notFoundTitle: 'This page does not exist.',
  notFoundLede:
    'The address is wrong, or something moved and I did not leave a forwarding note. Everything published here is still one link away.',
  notFoundBack: 'Go to the writing index',
};

const bn: Strings = {
  skipToContent: 'মূল অংশে যান',
  primaryNav: 'প্রধান',
  language: 'ভাষা',
  languageOf: 'ভাষা বেছে নিন',
  theme: 'থিম',
  themeSystem: 'সিস্টেম থিম',
  themeLight: 'হালকা থিম',
  themeDark: 'গাঢ় থিম',
  role: 'সিনিয়র সফটওয়্যার ইঞ্জিনিয়ার',
  home: 'হোম',
  comma: ', ',
  emptyIndex: 'এই ভাষায় এখনো কিছু নেই।',
  siteDescription:
    'শামসুদ্দিন আহমেদ, ঢাকার সিনিয়র সফটওয়্যার ইঞ্জিনিয়ার: এজেন্ট হারনেস, এলএলএম সার্ভিং ' +
    'পরিকাঠামো, আর জীববিজ্ঞানের জন্য মেশিন লার্নিং। তিনটি নিয়েই বিস্তারিত লেখা।',

  writing: 'লেখা',
  projects: 'প্রকল্প',
  series: 'সিরিজ',
  subjects: 'বিষয়',
  surprised: 'চমক',
  cv: 'জীবনবৃত্তান্ত',

  elsewhere: 'অন্য জায়গায়',
  read: 'পড়ুন',
  thisSite: 'এই সাইট',
  allWriting: 'সব লেখা',
  bySubject: 'বিষয় অনুযায়ী',
  colophon:
    'নিজের হাতে লেখা এবং তৈরি। স্ট্যাটিক ফাইল, কোনো ট্র্যাকিং নেই, কুকি নেই, আর আপনার সম্মতি লাগে এমন কিছুই নেই।',
  legal: (year, name) => `© ${year} ${name}`,

  nPosts: (n) => `${num('bn', n)}টি লেখা`,
  nSeries: (n) => `${num('bn', n)}টি সিরিজ`,
  nYears: (n) => `${num('bn', n)} বছর`,
  nParts: (n) => `${num('bn', n)}টি পর্ব`,
  nMinutes: (n) => `${num('bn', n)} মিনিট`,

  writingLede:
    'আমি লিখি বুঝতে চাই বলে, চালাক দেখানোর জন্য নয়। এখানে প্রতিটি কঠিন ধারণা সেভাবেই বোঝানো হয়েছে যেভাবে কেউ আমাকে বোঝালে ভালো হতো: উপমা দিয়ে, চালিয়ে দেখার মতো কোড দিয়ে, আর সৎ সংখ্যা দিয়ে।',
  writingDesc:
    'এজেন্ট হারনেস, এলএলএম পরিকাঠামো, জীববিজ্ঞানের জন্য মেশিন লার্নিং, কম্পিউটার ভিশন আর ' +
    'এসবের নিচে থাকা এআইয়ের মূল ভিত্তি নিয়ে বিস্তারিত লেখা।',
  browseAria: 'সিরিজ ও বিষয় ধরে দেখুন',
  allSubjectsArrow: 'সব বিষয়',

  seriesLede:
    'কিছু জিনিস এক লেখায় ধরে না। এগুলো সেই ধারাবাহিক লেখা: প্রতিটি পর্ব একা পড়া যায়, তবে ক্রমে পড়লে বেশি কাজে দেয়।',
  seriesInOrder: 'ক্রমে পড়ার জন্য লেখা, আর ক্রম ছাড়াও দাঁড়িয়ে থাকার জন্য।',
  allSeries: 'সব সিরিজ',
  partsInOrder: (n) => `${num('bn', n)}টি পর্ব, পড়ার ক্রমে`,

  subjectsLede:
    'এখানে যেসব বিষয়ে লেখা হয়েছে, সবগুলো। সংখ্যা যত বড়, বিষয়টি নিয়ে তত বেশি দিন ঘুরপাক খেয়েছি।',
  subject: 'বিষয়',
  tagDesc: (tag, count, sample) =>
    `${tag} নিয়ে ${num('bn', count)}টি লেখা, লিখেছেন শামসুদ্দিন আহমেদ` +
    (sample ? `, যার মধ্যে আছে ${sample}।` : '।') +
    ' হাতে-কলমে উদাহরণ, মেপে দেখা ফলাফল, আর তার পেছনের কোড।',

  aboutThisPost: 'এই লেখা সম্পর্কে',
  published: 'প্রকাশিত',
  length: 'দৈর্ঘ্য',
  filedUnder: 'বিষয়',
  contents: 'সূচিপত্র',
  otherPosts: 'অন্য লেখা',
  previous: 'পূর্ববর্তী',
  next: 'পরবর্তী',
  seriesStrip: (name) => `${name} সিরিজ`,
  partOf: (name) => `${name} সিরিজের একটি পর্ব`,

  notTranslated: 'এই লেখাটি এখনো অনুবাদ করা হয়নি।',
  readInEnglish: 'ইংরেজিতে পড়ুন',
  availableIn: 'আরও আছে',

  notFoundLabel: 'ত্রুটি ৪০৪',
  notFoundTitle: 'এই পাতাটি নেই।',
  notFoundLede:
    'ঠিকানাটি ভুল, বা কিছু সরে গেছে আর আমি নতুন ঠিকানা রেখে যাইনি। এখানে প্রকাশিত সবকিছু এখনো এক ক্লিক দূরে।',
  notFoundBack: 'লেখার তালিকায় যান',
};


export const STRINGS: Record<Locale, Strings> = { en, bn };
export type { Strings };
