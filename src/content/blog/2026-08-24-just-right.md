---
title: "Just Right, Not Too Simple and Not Too Wiggly"
seoTitle: "Just Right: Overfitting Explained for Beginners"
description: "A gentle beginner guide to overfitting, where sliding a line from plain to wiggly shows why the middle fit works best on new data."
date: 2026-08-24
permalink: "/posts/2026/08/just-right/"
lang: en
tags:
  - "machine learning"
  - "overfitting"
math: false
---

*Imagine you are learning to draw a road on a map. Draw it too straight and you miss the bends. Draw it too shaky and you copy every little bump, even the ones that do not matter. There is a happy line in between, and this little game lets you feel it with your own hand. No maths needed, just a slider and your eyes.*

## What you do

You start with a plain, calm line. Then you slide a control and the line grows wiggly, bending to touch each dot you can see. On those dots it looks better and better, and that feels like progress. But keep an eye on the new dots, the ones the line never learned from. As the line gets more wiggly, its guesses on those new dots get worse. The line was so busy pleasing the old dots that it forgot to stay useful. You can [play it](/surprised/#game-overfit) and try this for yourself.

## What is really happening

Every dot carries a little of the real pattern and a little random noise, like a small wobble in your hand. A very simple line is too lazy. It misses the real shape. A very wiggly line is too eager. It memorises the noise, the wobble that will never repeat the same way twice. The best line sits calmly in the middle. It follows the true shape and lets the wobble go, so it still works on dots it has never seen.

## Where it shows up

This is not only a game. It is one of the most important ideas in all of machine learning, and it even has a name: overfitting. A weather app that memorised last year's exact days would be useless tomorrow. A reading helper that only ever saw your handwriting might stumble on a friend's. Good learning, for a person or a machine, means catching the pattern and letting the noise go.

## The short version

- Too simple misses the real shape and the real pattern.
- Too complex memorises the noise and then fails on brand new points.
- The best model sits in the middle, catching the shape without chasing every wobble.
- That balance has a name, overfitting, and it matters everywhere.
