---
title: "How Computers Guess by Asking the Neighbours"
seoTitle: "How Computers Guess by Asking the Neighbours"
description: "A gentle, playful look at k-nearest neighbours, the lazy way a computer labels something new by asking the dots closest to it."
date: 2026-08-24
permalink: "/posts/2026/08/ask-the-neighbours/"
lang: en
tags:
  - "machine learning"
  - "classification"
math: false
---

*Imagine you move to a new street and you are not sure which football team to cheer for. You peek at the houses closest to yours. If most of your nearest neighbours cheer for the blue team, you probably will too. That simple idea is the whole trick behind this little game.*

## What you do

In the game you drag a small grey dot around a field of coloured dots. [play it](/surprised/#game-knn) and watch. Wherever you drop the grey dot, it looks at the coloured dots sitting closest to it. Then it counts them like a tiny vote. If red is winning nearby, the grey dot turns red. Move a little to the left and blue might win instead, so it turns blue. You are not teaching it anything. You are just moving it into a new neighbourhood.

## What is really happening

The grown-up name for this is k-nearest neighbours, but do not let that scare you. Here is the honest version. To guess the colour of something new, you look at the few examples closest to it and let them vote. There is no studying and no practice. The rule is simply this, you are like your neighbours.

The letter k is just how many neighbours get to vote. If only one neighbour votes, the answer can jump around a lot, because a single odd dot changes everything. If you let more neighbours vote, say the seven closest, the answer gets calmer and smoother. One strange dot cannot bully the whole vote. More voters, less jumpiness.

## Where it shows up

This same lazy trick is all around you. A shop might guess what you would enjoy by looking at customers most like you. A photo app might sort pictures by finding the ones that look nearest to each other. Even a game recommending your next level can peek at players who behave the way you do. Look at what sits closest, take a vote, done.

## The short version
- To label something new, look at its closest neighbours and take a vote.
- There is no training. The dot simply becomes like its neighbours.
- The letter k is how many neighbours vote.
- More voters give a smoother, less jumpy answer.
