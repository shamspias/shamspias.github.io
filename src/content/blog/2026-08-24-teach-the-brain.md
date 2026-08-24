---
title: "Watch a Tiny Network Learn a Pattern"
seoTitle: "How a Tiny Network Learns What One Cell Cannot"
description: "Press Train and watch a small network of cells learn a pattern one cell cannot, a gentle first look at neural networks and backpropagation."
date: 2026-08-24
permalink: "/posts/2026/08/teach-the-brain/"
lang: en
tags:
  - "machine learning"
  - "neural networks"
math: false
---

*Some ideas are easier to feel than to explain. Teaching a computer to learn is one of them. This little game lets you watch it happen, one small step at a time, so the mystery turns into something you can see.*

## What you do

You press Train. On the screen sits a tiny network of a few cells, and a pattern it does not know yet. Each time you train, the cells nudge themselves closer to getting the pattern right. At first the answers are messy. After a while, the network settles and the pattern clicks into place. You can [play it](/surprised/#game-neural-net) and watch the whole thing unfold.

## What is really happening

Think of one cell as a helper that can only draw a single straight line to sort things into two groups. That works for easy patterns. But some patterns are sneaky. One famous one turns on only when the two inputs are different, and off when they are the same. No single straight line can separate that. One cell is stuck.

So we stack cells into layers. Working together, layers can bend the space, like folding a sheet of paper, until a boundary finally fits around the tricky pattern.

How does it learn to fold the right way? The network makes a guess, checks how wrong it is, then passes the blame backward through the layers. Each cell hears, in effect, you pushed us a little too far this way, so it tweaks its own settings by a small amount. Repeat this thousands of times and the mistakes shrink. That backward blame-passing has a name, backpropagation, and it is the heart of how deep learning learns.

## Where it shows up

This same trick sits behind things you already use. It helps phones recognise faces, helps apps understand speech, and helps computers translate languages. None of them were handed the rules. They practised, checked their mistakes, and adjusted, exactly like the cells in the game.

## The short version

- One cell can only split with a straight line, so hard patterns beat it.
- Stacking cells into layers lets them bend the space to fit.
- Learning means checking the error and passing blame backward, which is backpropagation.
