---
title: "The River Puzzle That Hides a Big Idea"
seoTitle: "Safe Crossing: The River Puzzle With a Hidden Rule"
description: "Ferry everyone across a river while keeping both banks safe, and meet constraint satisfaction, the friendly idea behind timetables and Sudoku."
date: 2026-08-24
permalink: "/posts/2026/08/safe-crossing/"
lang: en
tags:
  - "puzzles"
  - "problem solving"
math: false
---

*You have a small boat and a group of people who all need to reach the other side of a river. Only you can row, and the boat is tiny. The tricky part is not the rowing. It is making sure that nobody is left in an unsafe group, on either bank, after every single trip.*

## What you do

You carry people across the river, one boatload at a time. Some of the travellers are missionaries and some are cannibals. On each side of the river, the cannibals must never outnumber the missionaries. If they do, things go badly for the missionaries. So before you push the boat away, you check both banks. The side you leave and the side you arrive at must both still be safe.

## What is really happening

There is a hidden rule that has to stay true the whole time. Cannibals can be equal to missionaries, or fewer, but never more, on either bank. Every move you make has to keep that rule true in two places at once. Grown-ups call this constraint satisfaction. A constraint is just a rule that must hold. You are not only trying to reach a goal. You are trying to reach it without ever breaking the rule along the way.

## Where it shows up

This same idea is everywhere. When a school builds a timetable, it must fit every class into a room without putting two lessons in the same place at the same time. When you solve a Sudoku, each row, column and box must hold the digits one to nine with no repeats. In each case a person or a computer is juggling rules that all have to stay true together. Safe Crossing is a friendly, bite sized version of that big idea. Want to try it? [play it](/surprised/#game-missionaries) and see how few trips you need.

## The short version

- You move everyone across the river without ever letting cannibals outnumber missionaries on either bank.
- Every move must keep one rule true on both sides at the same time.
- That is constraint satisfaction, the same idea behind timetables and Sudoku.
