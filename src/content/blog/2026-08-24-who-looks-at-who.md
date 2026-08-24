---
title: "How a Computer Figures Out What Words Mean"
seoTitle: "How a Computer Figures Out What Words Mean"
description: "A gentle, playful look at attention, the simple idea that lets a computer figure out which words in a sentence belong together."
date: 2026-08-24
permalink: "/posts/2026/08/who-looks-at-who/"
lang: en
tags:
  - "how ai works"
math: false
---

*Read this sentence: the tiger chased the deer because it was hungry. Who was hungry? You know it means the tiger, not the deer, and not the grass nearby. You worked that out without even trying. This little game lets you peek at how a computer figures out the very same thing.*

## What you do

You tap a word in a sentence. The other words light up. The brighter a word glows, the more your chosen word is looking at it. Tap the word "it" and watch which word shines back. Try a few sentences and see who looks at who. [play it](/surprised/#game-attention)

## What is really happening

When a model reads, it lets each word look at every other word. Then it pulls in the ones that matter and pays less attention to the rest. This is a lot like sitting at a busy dinner table. A hundred people are talking, but you tune in to the one friend who just said your name. You do not hear every voice equally. You weight them by how much they matter to you right now.

The model does the same with words. For the word "it", the word "tiger" matters a lot, so "it" leans toward "tiger". The word "grass" matters little, so it fades. By weighting words by relevance, the model works out that "it" refers to the tiger, not the tree.

## Where it shows up

This trick has a name. It is called attention. It is the heart of a design called the Transformer, which is the engine behind modern chatbots. Every time a helpful assistant answers your question, it is quietly letting words look at each other, again and again, to understand what you mean. The game you just played is a tiny, friendly version of that same idea.

## The short version

- Each word looks at every other word and leans toward the ones that matter.
- Weighting words by relevance is how a model knows "it" means the tiger.
- This idea is called attention, the heart of the Transformer behind chatbots.
