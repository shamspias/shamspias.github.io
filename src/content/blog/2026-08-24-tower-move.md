---
title: "Tower Move and the Idea That Repeats Itself"
seoTitle: "Tower Move: Recursion Explained Simply"
description: "Move a stack of discs in a tiny web game and meet recursion, the neat idea of a job that solves itself by doing a smaller copy."
date: 2026-08-24
permalink: "/posts/2026/08/tower-move/"
lang: en
tags:
  - "puzzles"
  - "recursion"
math: false
---

*Some of the best ideas in computing hide inside simple games. Tower Move is one of them. You slide discs from one peg to another, and without even noticing, you meet a big idea that programmers reach for every day.*

## What you do

There are three pegs. On one peg sits a stack of discs, the largest on the bottom and the smallest on top. Your goal is to move the whole stack over to another peg. There are only two rules. You move one disc at a time, and you never place a big disc on top of a smaller one. That is all. Give it a try and see how it feels. [play it](/surprised/#game-hanoi)

## What is really happening

Here is the trick that makes it simple. To move a tall tower, first move the smaller tower on top out of the way onto a spare peg. Now the big disc at the bottom is free, so move it to where it belongs. Then move the smaller tower back on top of that big disc. Done.

Notice the sneaky part. Moving the smaller tower is the very same job as before, just with fewer discs. So you solve the puzzle by solving a smaller copy of the same puzzle. That is what recursion means. A job that solves itself by doing a smaller version of itself.

Think of Russian nesting dolls, or a mirror facing a mirror. Each step looks like the one before it, only smaller, until the job is so tiny it is trivial. Moving a single disc needs no cleverness at all.

## Where it shows up

Once you spot this pattern, you start to see it everywhere. Sorting a big pile of cards by splitting it into smaller piles. Searching a family tree, branch by branch. Even breaking a long list of chores into shorter lists. It is the same idea, dressed in different clothes.

## The short version

- Move the small tower away, move the big disc, then move the small tower back.
- Moving the small tower is the same puzzle again, only smaller.
- A job that solves itself with a smaller copy of itself is called recursion.
