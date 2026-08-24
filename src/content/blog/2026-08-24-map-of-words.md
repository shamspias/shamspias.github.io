---
title: "How Computers Draw a Map of Words"
seoTitle: "How Computers Draw a Map of Words"
description: "A friendly guide to embeddings, where computers place each word as a point so that words with similar meanings sit close together."
date: 2026-08-24
permalink: "/posts/2026/08/map-of-words/"
lang: en
tags:
  - "how ai works"
math: false
---

*Imagine a giant map where every word has its own spot. On this map, words that mean similar things live close to each other, like neighbours on the same street. The word cat sits near dog, and both sit far away from pizza. That map is the idea behind a tiny game called Map of Words, and it is also how many computer programs quietly make sense of language.*

## What you do

You tap a word on the map. The game then shows you the words sitting nearby. Tap apple, and you might find banana, orange, and pear close by. Tap happy, and you may see glad, joyful, and cheerful gathered around it. It feels a bit like a treasure hunt. You are not told the answers. You explore, and the neighbours give away the secret. Ready to try? [play it](/surprised/#game-embeddings) and see which words become friends.

## What is really happening

Here is the clever part. A computer cannot read the way you do. So it turns each word into a list of numbers. That list acts like an address, a point in space. The program arranges every point so that words with similar meanings sit close together. Distances and directions on this map carry real meaning. That is why you can do a kind of word arithmetic. Start at king, take away man, add woman, and you land right next to queen. These points made of numbers are called embeddings. The map you played with is a simple picture of them.

## Where it shows up

You meet this idea more often than you think. When a search box guesses what you meant, it is measuring which words sit close together. When an app suggests a song like the one you love, similar things are near each other again. Even helpful chat programs lean on this same trick to follow what you say.

## The short version

- Computers turn each word into a list of numbers, a point on a map.
- Words with similar meanings sit close together on that map.
- Directions carry meaning, so king minus man plus woman lands near queen.
- These number points have a name: embeddings.
