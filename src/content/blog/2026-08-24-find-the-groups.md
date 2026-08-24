---
title: "Finding Groups When Nobody Told You the Groups"
seoTitle: "K-means Clustering Explained Simply for Beginners"
description: "A gentle beginner guide to k-means clustering, where a computer sorts dots into groups on its own, using a tiny web game you can try."
date: 2026-08-24
permalink: "/posts/2026/08/find-the-groups/"
lang: en
tags:
  - "machine learning"
  - "clustering"
math: false
---

*Imagine a big pile of mixed-up buttons on the floor. Nobody told you which buttons belong together, but you can still sort them into little heaps by putting each button near the ones it looks like. That simple habit of grouping things is exactly what our tiny game teaches, and it has a grown-up name too.*

## What you do

In the game you drop a few centre-markers onto a screen full of dots. Then you tap Step. Each dot looks around, finds the centre-marker closest to it, and takes on that colour. After that, every centre-marker slides over to sit in the middle of its own dots. You tap Step again, and again, and slowly the dots settle into neat groups. Soon nothing moves, and you are done. You can [play it](/surprised/#game-kmeans) and watch it happen.

## What is really happening

Sometimes we have lots of data but no labels. Nobody has said which dots are which kind. The computer figures out the groups on its own. It follows the same two little steps you saw. First, colour each dot by its nearest centre. Second, slide each centre to the middle of the dots that chose it. Repeat until the centres stop shifting. That is the whole trick. The proper name for it is k-means clustering, and the k just means how many centres you decided to drop.

## Where it shows up

Shops love this. A shop may have thousands of customers and no idea what kinds of shoppers they are. So it lets the computer find the groups. One group might buy lots of snacks late at night. Another might only shop during sales. Nobody told the computer these kinds in advance. It discovered them by grouping people who behave alike, just like you grouped the dots.

## The short version

- Sometimes you have data but no labels.
- Drop a few centres, then colour each dot by its nearest centre.
- Slide each centre to the middle of its dots, then repeat.
- Shops use it to find kinds of customers on their own.
