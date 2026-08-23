/**
 * Every word of interface text, in the three languages.
 *
 * Counted phrases are functions rather than templates with a number spliced in.
 * English needs two forms, Bangla needs one, and Arabic needs five: singular,
 * dual, a form for three to ten, another for eleven and up, and a form for
 * zero. Writing `${n} posts` and translating the word would produce Arabic that
 * is wrong four times out of five, so the plural rule is part of the string.
 */
import { LOCALE_META, type Locale } from './config';

/** A number in the language's own digits. */
export const num = (locale: Locale, n: number): string =>
  new Intl.NumberFormat(LOCALE_META[locale].tag, {
    numberingSystem: LOCALE_META[locale].numerals,
  }).format(n);

/** Arabic plural category for a count, which decides the shape of the noun. */
const arabicForm = (n: number): 'zero' | 'one' | 'two' | 'few' | 'many' | 'other' =>
  new Intl.PluralRules('ar').select(n) as never;

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
  /** The comma between a role and its organisation. Arabic has its own. */
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
  cv: string;

  /* footer */
  elsewhere: string;
  read: string;
  thisSite: string;
  allWriting: string;
  bySubject: string;
  colophon: string;
  legal: (span: string, name: string) => string;

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
  cv: 'Curriculum Vitae',

  elsewhere: 'Elsewhere',
  read: 'Read',
  thisSite: 'This site',
  allWriting: 'All writing',
  bySubject: 'by subject',
  colophon:
    'Written and built by hand. Static files, no tracking, no cookies, and nothing that needs your consent.',
  legal: (span, name) => `© ${span} ${name}. Words and code are mine; the code is MIT.`,

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
  cv: 'জীবনবৃত্তান্ত',

  elsewhere: 'অন্য জায়গায়',
  read: 'পড়ুন',
  thisSite: 'এই সাইট',
  allWriting: 'সব লেখা',
  bySubject: 'বিষয় অনুযায়ী',
  colophon:
    'নিজের হাতে লেখা এবং তৈরি। স্ট্যাটিক ফাইল, কোনো ট্র্যাকিং নেই, কুকি নেই, আর আপনার সম্মতি লাগে এমন কিছুই নেই।',
  legal: (span, name) =>
    `© ${span} ${name}। লেখা ও কোড আমার; কোডের লাইসেন্স MIT।`,

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

const ar: Strings = {
  skipToContent: 'تجاوَز إلى المحتوى',
  primaryNav: 'الرئيسية',
  language: 'اللغة',
  languageOf: 'اختر اللغة',
  theme: 'المظهر',
  themeSystem: 'مظهر النظام',
  themeLight: 'المظهر الفاتح',
  themeDark: 'المظهر الداكن',
  role: 'مهندس برمجيات أول',
  home: 'الرئيسية',
  comma: '، ',
  emptyIndex: 'لا يوجد شيء بهذه اللغة بعد.',
  siteDescription:
    'شمس الدين أحمد، مهندس برمجيات أول في دكا: طبقة التحكّم بالوكلاء، وبنية تشغيل النماذج ' +
    'اللغوية، وتعلّم الآلة لعلم الأحياء. مقالات مطوّلة في المجالات الثلاثة.',

  writing: 'المقالات',
  projects: 'المشاريع',
  series: 'السلاسل',
  subjects: 'الموضوعات',
  cv: 'السيرة الذاتية',

  elsewhere: 'مواقع أخرى',
  read: 'للقراءة',
  thisSite: 'عن الموقع',
  allWriting: 'كل المقالات',
  bySubject: 'حسب الموضوع',
  colophon:
    'مكتوب ومبني يدويًا. ملفات ثابتة، بلا تتبّع، بلا كوكيز، ولا شيء يحتاج إلى موافقتك.',
  legal: (span, name) => `© ${span} ${name}. النصوص والكود لي، والكود بترخيص MIT.`,

  nPosts: (n) => {
    const d = num('ar', n);
    switch (arabicForm(n)) {
      case 'one':
        return 'مقال واحد';
      case 'two':
        return 'مقالان';
      case 'few':
        return `${d} مقالات`;
      default:
        return `${d} مقالًا`;
    }
  },
  nSeries: (n) => {
    const d = num('ar', n);
    switch (arabicForm(n)) {
      case 'one':
        return 'سلسلة واحدة';
      case 'two':
        return 'سلسلتان';
      case 'few':
        return `${d} سلاسل`;
      default:
        return `${d} سلسلة`;
    }
  },
  nYears: (n) => {
    const d = num('ar', n);
    switch (arabicForm(n)) {
      case 'one':
        return 'سنة واحدة';
      case 'two':
        return 'سنتان';
      case 'few':
        return `${d} سنوات`;
      default:
        return `${d} سنة`;
    }
  },
  nParts: (n) => {
    const d = num('ar', n);
    switch (arabicForm(n)) {
      case 'one':
        return 'جزء واحد';
      case 'two':
        return 'جزءان';
      case 'few':
        return `${d} أجزاء`;
      default:
        return `${d} جزءًا`;
    }
  },
  nMinutes: (n) => `${num('ar', n)} دقيقة قراءة`,

  writingLede:
    'أكتب لأفهم، لا لأبدو ذكيًا. كل ما هنا يشرح فكرة صعبة بالطريقة التي كنت أتمنى أن يشرحها لي أحد: بالتشبيهات، وبكود يمكن تشغيله، وبأرقام صادقة.',
  writingDesc:
    'مقالات مطوّلة عن طبقة التحكّم بالوكلاء، وبنية تشغيل النماذج اللغوية، وتعلّم الآلة لعلم ' +
    'الأحياء، والرؤية الحاسوبية، والأساسيات تحتها جميعًا.',
  browseAria: 'التصفّح حسب السلسلة والموضوع',
  allSubjectsArrow: 'كل الموضوعات',

  seriesLede:
    'بعض الأفكار لا تتّسع لمقال واحد. هذه هي السلاسل: كل جزء قائم بذاته، وقراءتها بالترتيب أنفع.',
  seriesInOrder: 'مكتوبة لتُقرأ بالترتيب، وقادرة على الوقوف بمفردها.',
  allSeries: 'كل السلاسل',
  partsInOrder: (n) => {
    const d = num('ar', n);
    switch (arabicForm(n)) {
      case 'one':
        return 'جزء واحد، بترتيب القراءة';
      case 'two':
        return 'جزءان، بترتيب القراءة';
      case 'few':
        return `${d} أجزاء، بترتيب القراءة`;
      default:
        return `${d} جزءًا، بترتيب القراءة`;
    }
  },

  subjectsLede:
    'كل موضوع كُتب عنه هنا. كلما كبر العدد، طال الوقت الذي دُرت فيه حول الموضوع.',
  subject: 'موضوع',
  tagDesc: (tag, count, sample) =>
    `${ar.nPosts(count)} عن ${tag} بقلم شمس الدين أحمد` +
    (sample ? `، منها ${sample}.` : '.') +
    ' أمثلة عملية، ونتائج مقيسة، والكود الذي وراءها.',

  aboutThisPost: 'عن هذا المقال',
  published: 'تاريخ النشر',
  length: 'المدة',
  filedUnder: 'مُصنَّف تحت',
  contents: 'المحتويات',
  otherPosts: 'مقالات أخرى',
  previous: 'السابق',
  next: 'التالي',
  seriesStrip: (name) => `سلسلة ${name}`,
  partOf: (name) => `جزء من سلسلة ${name}`,

  notTranslated: 'هذا المقال لم يُترجم بعد.',
  readInEnglish: 'اقرأه بالإنجليزية',
  availableIn: 'متوفر أيضًا بـ',

  notFoundLabel: 'خطأ ٤٠٤',
  notFoundTitle: 'هذه الصفحة غير موجودة.',
  notFoundLede:
    'العنوان خاطئ، أو أن شيئًا ما انتقل ولم أترك عنوانًا جديدًا. كل ما نُشر هنا لا يزال على بعد رابط واحد.',
  notFoundBack: 'إلى فهرس المقالات',
};

export const STRINGS: Record<Locale, Strings> = { en, bn, ar };
export type { Strings };
