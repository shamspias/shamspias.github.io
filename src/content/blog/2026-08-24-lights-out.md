---
title: "The Puzzle Where Every Tap Changes Its Neighbours"
seoTitle: "Lights Out and the Simple Idea of Odd and Even"
description: "A gentle look at Lights Out, the tapping puzzle where turning off one light flips its neighbours and quietly teaches you about odd and even."
date: 2026-08-24
permalink: "/posts/2026/08/lights-out/"
lang: en
tags:
  - "puzzles"
  - "logic"
math: false
---

*Some puzzles look simple and then quietly teach you something big. Lights Out is one of them. You see a small grid of lights, some on and some off, and your job is to switch them all off. The catch is that every light is joined to the ones next to it, so a single tap never acts alone.*

## What you do

You tap a light to change it. On becomes off, and off becomes on. But the light you tap is not the only one that moves. Its neighbours, the lights directly above, below, left, and right, flip at the same time. So one tap can change three, four, or five lights at once. Your goal is to reach a board where every light is off. It feels a bit like flipping pancakes that are all stuck together.

## What is really happening

Here is the secret. Tapping the same light twice does nothing. The first tap flips it, and the second tap flips it right back. So you never need to tap any light more than once. That means the whole puzzle is not about the order of your taps. It is about which lights you choose to tap and which you leave alone.

Because taps cancel in pairs, only one thing matters for each light: was it touched an odd number of times or an even number of times. Odd means it changed. Even means it stayed. This idea, the difference between odd and even, is called parity. You solve the puzzle every time you sort the taps into the ones that help and the ones that undo each other.

## Where it shows up

This same odd and even trick is everywhere. It helps computers check that a message arrived without mistakes. It shows up in the light switches at the top and bottom of a staircase. Anywhere two actions can cancel out, parity is hiding nearby. Once you notice it, you start seeing it in ordinary life.

Ready to try it yourself? [play it](/surprised/#game-lights-out) and see how few taps you need.

## The short version

- Each tap flips a light and all of its neighbours.
- Tapping the same light twice cancels out, so once is enough.
- What matters is odd or even taps, and that idea is called parity.
