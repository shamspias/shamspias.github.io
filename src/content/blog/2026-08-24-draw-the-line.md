---
title: "Draw the Line and Meet Your First Classifier"
seoTitle: "Draw the Line and Meet a Classifier"
description: "Slide a line to sort blue apples from pink oranges, and learn how a classifier sorts new things the way spam filters do."
date: 2026-08-24
permalink: "/posts/2026/08/draw-the-line/"
lang: en
tags:
  - "machine learning"
  - "classification"
math: false
---

*Have you ever sorted your toys into two piles, one for cars and one for blocks? A computer can learn to do something just like that. In a tiny game called Draw the Line, you help it by sliding a single straight line across the screen. The idea has a grown-up name, a classifier, but the game makes it easy to feel.*

## What you do

You see a screen full of dots. The blue ones are apples. The pink ones are oranges. Your job is to slide the line until every blue apple sits on one side and every pink orange sits on the other. When the line splits them cleanly, you win. Go ahead and [play it](/surprised/#game-classify) and wiggle the line around until the two colours are apart.

## What is really happening

A classifier is just a decider. It looks at something and answers one question, which group do you belong to? With two kinds of dots, the computer draws a line so each kind sits on its own side. After that, any new dot is labelled by which side it lands on. A dot above the line, orange. A dot below, apple. Simple.

Learning is the interesting part. The computer does not get the perfect line on the first try. It starts with a wonky line, checks how many dots are on the wrong side, and nudges the line a little to fix them. Then it checks again and nudges again. Bit by bit, the line slides into the right spot, the same way you do it with your finger.

## Where it shows up

This little trick is everywhere. A spam filter looks at an email and decides, junk or not junk. A photo app looks at a picture and decides, cat or dog. They use far more than one line and far more than two colours, but the heart of it is the same idea you just played with. Draw a line, put each group on its own side, and let new things fall where they may.

## The short version

- A classifier decides which group something belongs to.
- The computer draws a line so each kind of dot sits on its own side.
- Learning means nudging that line until it separates the examples.
- Spam filters and photo taggers do a fancier version of the same trick.
