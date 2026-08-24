---
title: "Two Arrows and One Friendly Number"
seoTitle: "The Dot Product Explained With Two Arrows"
description: "A gentle beginner guide to the dot product, using two draggable arrows to show how much they agree and why AI attention relies on it."
date: 2026-08-24
permalink: "/posts/2026/08/two-arrows/"
lang: en
tags:
  - "mathematics"
  - "linear algebra"
math: false
---

*Imagine two friends pushing a shopping trolley. If they both push the same way, the trolley flies forward. If one pushes sideways, a lot of that effort is wasted. There is a simple number that tells you how well two pushes work together, and it is the same maths that helps modern AI decide what to pay attention to.*

## What you do

You drag two arrows on the screen. Each arrow has a direction, the way it points, and a length, how long it is. As you move them, a number changes. Point them the same way and the number grows big. Turn one until they make a right angle, a perfect corner, and the number drops to zero. Point them in opposite directions and the number goes negative. That number is called the dot product, and it measures how much the two arrows agree.

## What is really happening

An arrow, in maths, is called a vector. It carries two pieces of news, which way it points and how far it reaches. The dot product mixes both. When the arrows line up, their lengths pull together and the number is large. When they stand at a right angle, they share no common direction at all, so the answer is zero. It is a bit like two people singing. In tune, the sound is full. Far apart, the voices cancel.

## Where it shows up

This tiny idea is everywhere. When AI reads a sentence, it turns each word into an arrow. To work out which words belong together, it checks how much their arrows agree, using the very same dot product you are dragging around. That trick is called attention, and it helps the machine focus on what matters. So the game in your hands is not a toy version. It is the real thing, just slowed down so you can see it. Give it a try and [play it](/surprised/#game-vectors).

## The short version

- An arrow, or vector, has a direction and a length.
- The dot product is one number for how much two arrows agree.
- It is big when they line up and zero at a right angle.
- The same maths powers attention in AI.
