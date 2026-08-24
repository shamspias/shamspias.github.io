---
title: "How Four Little Numbers Can Bend a Whole Grid"
seoTitle: "How Four Numbers Bend a Whole Grid"
description: "Change four numbers and watch a square spin, stretch, and lean, and see how the same idea powers every layer of a neural network."
date: 2026-08-24
permalink: "/posts/2026/08/bend-the-grid/"
lang: en
tags:
  - "mathematics"
  - "linear algebra"
math: false
---

*Imagine a square drawn on a stretchy sheet. Now imagine you could spin it, pull it wide, or push it sideways, all by turning four little dials. That is the whole idea behind a small web game we made, and behind a big word from maths called a matrix.*

## What you do

You will see a square sitting on a grid. Under it are four numbers. Change one number and the square moves. Turn it a little and the square rotates, like a steering wheel. Change another and the square stretches tall or wide, like pulling on dough. Change the rest and the square leans over, like a stack of books tipping to one side. The four numbers work together. Play with them and watch what each one does.

## What is really happening

Those four numbers are a tiny machine that bends the whole grid, not just the square. Every point on the sheet gets moved by the same rule. That machine has a name. It is a two by two matrix. Just four numbers can rotate the plane, stretch it, or shear it, and shear is the fancy word for leaning. There is one more trick. If you combine the four numbers in a certain way, you get a single number called the determinant. It tells you how much bigger or smaller the area becomes. If the determinant is 2, areas double. If it is negative, the shape flips over, like turning a glove inside out.

## Where it shows up

This is not just a game. It is one of the building blocks of the machines that help computers see and speak. Inside a neural network, the kind of program behind many smart tools today, every layer does exactly this. It takes numbers and bends them into new shapes, again and again. So when you play, you are doing a baby version of what those big systems do millions of times a second. Want to try? [play it](/surprised/#game-matrix) and wiggle the dials.

## The short version

- Four numbers in a small grid can rotate, stretch, or shear the whole plane.
- The determinant tells you how much area grows, shrinks, or flips over.
- Every layer in a neural network is a transformation just like this.
