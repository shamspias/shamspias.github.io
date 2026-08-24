---
title: "How a Robot Guesses the Next Word"
seoTitle: "How a Robot Guesses the Next Word"
description: "A friendly, no maths look at how a language model builds sentences by guessing one likely next word at a time, with a tiny game to try."
date: 2026-08-24
permalink: "/posts/2026/08/finish-the-sentence/"
lang: en
tags:
  - "how ai works"
math: false
---

*Have you ever noticed how your phone offers a word while you are typing a message? A language model plays that same little game, only much better. It looks at the words you have written so far and tries to guess what comes next. That is the whole trick, and once you see it, chatbots feel a lot less like magic.*

## What you do

In our tiny game called Finish the Sentence, you start with a few words. A friendly robot then shows you a short list of words it thinks might come next. Each one has a chance next to it, like a weather forecast for words. You tap the word you like, it gets added to your sentence, and the robot thinks again. Word by word, tap by tap, you build a whole sentence together. Want to see it in action? You can [play it](/surprised/#game-next-token) right now.

## What is really happening

Behind the robot is a language model, and it has one job. Given the words so far, guess the next word, and show the guesses as a list of chances. You pick one, it gets added, and the model guesses again. That is the entire loop. There is no hidden plan for the sentence. The model is simply very good at the game of what usually comes next, because it has read an enormous pile of text, more than any person could read in a thousand lifetimes.

## Where it shows up

This same loop is how a chatbot writes long answers. It does not write a paragraph all at once. It guesses one word, adds it, and guesses the next, over and over, faster than you can blink. String enough good guesses together and you get sentences, then paragraphs, then a full reply. The chatbot on your screen is really just this quiet little game running at top speed.

## The short version

- A language model guesses the next word from the words so far.
- Each guess comes as a list of chances, and one word gets picked.
- Repeat that loop, trained on lots of text, and you get whole paragraphs.
