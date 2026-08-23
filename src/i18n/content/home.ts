/**
 * The front page, in three languages.
 *
 * The prose lives here rather than in the page because a page that holds its own
 * English text has nowhere to put the other two. Links, organisation names and
 * repository names are not translated: they are addresses and proper nouns.
 */
import type { Locale } from '../config';

export type Role = {
  role: string;
  org: string;
  href?: string;
  when: string;
  what: string;
};

export type Thread = {
  n: string;
  title: string;
  body: string;
  links: { label: string; href: string }[];
};

export type HomeContent = {
  location: string;
  heroTitle: string;
  heroProse: string;
  ctaWriting: string;
  ctaProjects: string;
  portraitAlt: string;
  sectionNow: string;
  sectionThreads: string;
  sectionRecent: string;
  allPosts: (label: string) => string;
  seriesLink: (label: string) => string;
  now: Role[];
  threads: Thread[];
};

const LINKS = {
  reins: 'https://github.com/shamspias/reins',
  veldra: 'https://github.com/shamspias/customizable-gpt-chatbot',
  deepnat: 'https://github.com/shamspias/DeepNatProtease',
  fennec: 'https://github.com/shamspias/fennec',
  voidmon: 'https://github.com/shamspias/voidmon',
  clawkido: 'https://github.com/shamspias/clawkido',
};

const en: HomeContent = {
  location: 'Dhaka, Bangladesh',
  heroTitle: 'I build the layer between a language model and software that already exists.',
  heroProse:
    'Five-plus years on the same stubborn question: how do you take something that works in a ' +
    'notebook and make it survive real users? Mostly that has meant backend systems, production ' +
    'machine learning, and the harness layer in between. Lately a fourth thread has crept in, ' +
    'machine learning for biology, where the datasets are small, the labels are noisy, and being ' +
    'honest about your numbers matters more than beating a leaderboard.',
  ctaWriting: 'Read the writing',
  ctaProjects: 'See the projects',
  portraitAlt: 'Shamsuddin Ahmed, photographed in Dhaka',
  sectionNow: 'Now',
  sectionThreads: 'What I think about',
  sectionRecent: 'Recent writing',
  allPosts: (label) => `All ${label}`,
  seriesLink: (label) => label,
  now: [
    {
      role: 'Senior Software Engineer',
      org: 'Mevrik',
      href: 'https://mevrik.com',
      when: 'Since Aug 2026',
      what:
        'An AI customer-experience platform used by telecom operators and several hundred smaller ' +
        'businesses. I work on the AI side: agents, retrieval, and the serving infrastructure ' +
        'underneath.',
    },
    {
      role: 'Founder',
      org: 'AlgolyzerLab',
      href: 'https://algolyzerlab.com',
      when: 'Since 2024',
      what:
        'A small studio for applied AI that does not fit a product roadmap: sports science for ' +
        'elite cricket, clinical software for doctors, agriculture AI, and research engineering.',
    },
  ],
  threads: [
    {
      n: '01',
      title: 'Agent harnesses',
      body:
        'A model is only as useful as the surface you hand it. Most teams give an LLM raw tables ' +
        'and generated specs instead of the intent-named operations their own code already has.',
      links: [
        { label: 'Reins', href: LINKS.reins },
        { label: 'Veldra', href: LINKS.veldra },
        { label: 'The series', href: '/series/agent-harness/' },
      ],
    },
    {
      n: '02',
      title: 'Machine learning for biology',
      body:
        'Anti-inflammatory peptide prediction, and structure-aware virtual screening of natural ' +
        'products against understudied viral proteases. Both taught the same lesson: the dataset ' +
        'you choose decides the result long before the model does.',
      links: [
        { label: 'DeepNatProtease', href: LINKS.deepnat },
        { label: 'The series', href: '/series/machine-learning-for-biology/' },
      ],
    },
    {
      n: '03',
      title: 'Systems that stay explainable',
      body:
        'Small, readable, zero-magic tools I actually use: perceptual image compression, a ' +
        'terminal system monitor, actor-model agent swarms. Single binaries, no framework ' +
        'underneath.',
      links: [
        { label: 'Fennec', href: LINKS.fennec },
        { label: 'VoidMon', href: LINKS.voidmon },
        { label: 'Clawkido', href: LINKS.clawkido },
      ],
    },
  ],
};

const bn: HomeContent = {
  location: 'ঢাকা, বাংলাদেশ',
  heroTitle: 'ভাষা-মডেল আর আগে থেকেই চলতে থাকা সফটওয়্যারের মাঝের স্তরটা আমি বানাই।',
  heroProse:
    'পাঁচ বছরের বেশি সময় একই একগুঁয়ে প্রশ্ন নিয়ে কেটেছে: নোটবুকে যা কাজ করে, সেটাকে সত্যিকারের ' +
    'ব্যবহারকারীর সামনে টিকিয়ে রাখা যায় কীভাবে? বেশির ভাগ সময় তার মানে ব্যাকএন্ড সিস্টেম, ' +
    'প্রোডাকশনে মেশিন লার্নিং, আর মাঝখানের হারনেস স্তর। সম্প্রতি চতুর্থ একটা সুতো ঢুকেছে: ' +
    'জীববিজ্ঞানের জন্য মেশিন লার্নিং, যেখানে ডেটাসেট ছোট, লেবেল ঘোলা, আর লিডারবোর্ড জেতার চেয়ে ' +
    'নিজের সংখ্যার ব্যাপারে সৎ থাকা বেশি জরুরি।',
  ctaWriting: 'লেখা পড়ুন',
  ctaProjects: 'প্রকল্প দেখুন',
  portraitAlt: 'শামসুদ্দিন আহমেদ, ঢাকায় তোলা ছবি',
  sectionNow: 'এখন',
  sectionThreads: 'যা নিয়ে ভাবি',
  sectionRecent: 'সাম্প্রতিক লেখা',
  allPosts: (label) => `সব ${label}`,
  seriesLink: (label) => label,
  now: [
    {
      role: 'সিনিয়র সফটওয়্যার ইঞ্জিনিয়ার',
      org: 'Mevrik',
      href: 'https://mevrik.com',
      when: 'আগস্ট ২০২৬ থেকে',
      what:
        'টেলিকম অপারেটর আর কয়েকশো ছোট ব্যবসার ব্যবহৃত একটি এআই কাস্টমার-এক্সপেরিয়েন্স প্ল্যাটফর্ম। ' +
        'আমি এআই দিকটায় কাজ করি: এজেন্ট, রিট্রিভাল, আর তার নিচের সার্ভিং পরিকাঠামো।',
    },
    {
      role: 'প্রতিষ্ঠাতা',
      org: 'AlgolyzerLab',
      href: 'https://algolyzerlab.com',
      when: '২০২৪ থেকে',
      what:
        'প্রয়োগমুখী এআইয়ের ছোট একটি স্টুডিও, যেসব কাজ কোনো প্রোডাক্ট রোডম্যাপে বসে না: অভিজাত ' +
        'ক্রিকেটের জন্য স্পোর্টস সায়েন্স, ডাক্তারদের জন্য ক্লিনিকাল সফটওয়্যার, কৃষিতে এআই, আর ' +
        'রিসার্চ ইঞ্জিনিয়ারিং।',
    },
  ],
  threads: [
    {
      n: '০১',
      title: 'এজেন্ট হারনেস',
      body:
        'একটা মডেল ততটাই কাজের, যতটা কাজের তাকে দেওয়া পৃষ্ঠতল। বেশির ভাগ দল এলএলএমকে নিজেদের ' +
        'কোডে আগে থেকেই থাকা উদ্দেশ্য-নামের অপারেশন না দিয়ে কাঁচা টেবিল আর জেনারেট করা স্পেক ' +
        'ধরিয়ে দেয়।',
      links: [
        { label: 'Reins', href: LINKS.reins },
        { label: 'Veldra', href: LINKS.veldra },
        { label: 'সিরিজটি', href: '/series/agent-harness/' },
      ],
    },
    {
      n: '০২',
      title: 'জীববিজ্ঞানের জন্য মেশিন লার্নিং',
      body:
        'অ্যান্টি-ইনফ্ল্যামেটরি পেপটাইড পূর্বানুমান, আর কম-অনুসন্ধিত ভাইরাল প্রোটিয়েজের বিরুদ্ধে ' +
        'প্রাকৃতিক যৌগের স্ট্রাকচার-সচেতন ভার্চুয়াল স্ক্রিনিং। দুটোই একই শিক্ষা দিয়েছে: মডেল ঠিক ' +
        'করার অনেক আগেই ডেটাসেট বাছাই ফলাফলটা ঠিক করে ফেলে।',
      links: [
        { label: 'DeepNatProtease', href: LINKS.deepnat },
        { label: 'সিরিজটি', href: '/series/machine-learning-for-biology/' },
      ],
    },
    {
      n: '০৩',
      title: 'যেসব সিস্টেম বোঝা যায়',
      body:
        'ছোট, পড়ার মতো, জাদু-ছাড়া টুল যেগুলো আমি নিজে ব্যবহার করি: পারসেপচুয়াল ইমেজ কম্প্রেশন, ' +
        'টার্মিনালে সিস্টেম মনিটর, অ্যাক্টর-মডেল এজেন্ট সোয়ার্ম। একক বাইনারি, নিচে কোনো ফ্রেমওয়ার্ক ' +
        'নেই।',
      links: [
        { label: 'Fennec', href: LINKS.fennec },
        { label: 'VoidMon', href: LINKS.voidmon },
        { label: 'Clawkido', href: LINKS.clawkido },
      ],
    },
  ],
};


export const HOME: Record<Locale, HomeContent> = { en, bn };
