---
title: "How Computers Turn Scores Into Chances"
seoTitle: "Share the Pie: Softmax for Beginners"
description: "A gentle beginner guide to softmax, the little step that turns a model's raw scores into a pie of chances that adds up to a whole."
date: 2026-08-24
permalink: "/posts/2026/08/share-the-pie/"
lang: en
tags:
  - "how ai works"
math: false
---

*Imagine you have a few snacks, and you must guess which one your friend wants most. You do not just pick one and shout it out. You give each snack a share of the pie, a slice that shows how likely it is. That is the game called Share the Pie, and grown-ups call the idea softmax.*

## What you do

You slide some scores up and down. Each score is just a number that says how strongly the computer likes an option. When you move a slider, the pie changes. The slices always add up to one whole pie, which is 100 percent. No slice is ever empty, and no slice is ever less than nothing. A bigger score means a bigger slice.

## What is really happening

A model, the smart part inside apps, looks at a choice and gives every option a raw score. Those raw scores are messy. Some are big, some are small, and some can even be below zero. Softmax is the neat trick that turns them into slices of a pie. Every slice is positive, and together they make one whole. Now we can read them as chances, like saying there is a 70 percent chance of one thing and a 30 percent chance of another.

There is also a temperature knob. Turn it low and the model gets confident. It hands almost the whole pie to its top pick. Turn it high and the model gets adventurous. It spreads the slices out and gives the smaller options a real chance too.

## Where it shows up

This little step is nearly everywhere. When a photo app decides if a picture is a cat or a dog, softmax makes the final slices. When a chat helper picks the next word to write, softmax gives each possible word a slice, and one is chosen. It is the last step in most sorting tools, and in every language model.

Want to feel it for yourself? [play it](/surprised/#game-softmax) and watch the pie move as you slide.

## The short version

- Raw scores go in, and neat slices of a pie come out.
- Every slice is positive, and they add up to 100 percent.
- Low temperature is confident, high temperature is adventurous.
- It is the final step in most classifiers and every language model.
