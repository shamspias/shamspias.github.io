---
title: "How Two Switches and a Bulb Explain Computers"
seoTitle: "How Two Switches and a Bulb Explain Computers"
description: "Flip two switches, pick a gate, and light a bulb to discover the simple true or false logic that quietly powers every computer."
date: 2026-08-24
permalink: "/posts/2026/08/wire-the-light/"
lang: en
tags:
  - "puzzles"
  - "logic"
math: false
---

*Imagine a little light that only turns on when you get the switches just right. That is the whole game, and hidden inside it is one of the biggest ideas in how computers think.*

## What you do

You flip two switches on or off. Each switch is either on or off, like a lamp in a room. Then you pick a gate, which is a tiny rule that decides what the light does. Some settings make the bulb glow, and some leave it dark. Your job is to try different flips and different rules until you get the bulb to shine.

## What is really happening

Each gate is a small decision maker. It looks at your two switches and gives one answer back: on or off, yes or no, true or false. An AND gate is fussy. It only lights up when both switches are on. An OR gate is easygoing. It lights up if either switch is on, or if both are. An exclusive-or gate, often shortened to XOR, is the odd one out. It lights up only when the two switches disagree, one on and one off.

That is really the whole trick. A gate takes true or false in, and it gives true or false out.

## Where it shows up

Here is the surprising part. Wire millions of these tiny gates together and you get a computer. The screen you are reading, and the game you are about to play, are all built from a handful of these simple rules stacked over and over. Nothing magic is going on, just yes and no, repeated a huge number of times, very fast.

Want to feel it for yourself? [play it](/surprised/#game-logic-gates) and watch the bulb.

## The short version

- A gate takes two on or off switches and gives one on or off answer.
- AND needs both on, OR needs at least one on, and XOR needs them to differ.
- Stack millions of these simple gates and you have built a computer.
