---
title: "Every Little Game in the Arcade, and What It Teaches"
seoTitle: "The Surprised Arcade: Every Game Explained"
description: "A plain tour of every tiny game in the arcade: what you do in each one, and the big idea it sneaks in, from fractions to how a neural network learns."
date: 2026-08-24
permalink: "/posts/2026/08/surprised-arcade-guide/"
lang: en
tags:
  - "games"
  - "learning"
  - "machine learning"
  - "teaching"
math: false
---

*The [arcade](/surprised/) is a wall of little games. This is the tour: for each one, what you actually do, and the big idea it slips in while you play. No maths degree needed, and a curious eight-year-old is exactly the right reader.*

Every game is small on purpose. You poke it, something happens, and the idea shows up on its own. Below they are grouped the same way the arcade groups them. Tap any name to jump straight to it and play.

## Robot Brains: teaching a computer to learn

This is machine learning, which sounds hard and is really just one thing: a computer getting better at a job by looking at examples, instead of being told every rule.

- **[Rolling Downhill](/surprised/#game-gradient-descent).** You roll a ball down a hill to the lowest spot. That is exactly how a computer learns: it takes small steps toward the answer with the fewest mistakes. Big steps overshoot and fly out, which is a real thing that goes wrong in real training.
- **[Draw the Line](/surprised/#game-classify).** You slide a line to split the blue apples from the pink oranges. Sorting things by drawing a line between them is what a classifier does, and the "let it learn" button lets the computer place the line for you.
- **[One Brain Cell](/surprised/#game-perceptron).** You set the dials on a single pretend brain cell until it lights up for the right inputs. That cell, adding things up and firing when the total is big enough, is the tiny piece every AI is built from.
- **[Teach the Brain](/surprised/#game-neural-net).** You press Train and watch a little brain of a few cells learn a pattern that one cell alone can never get. The colours bending into shape are the learning happening in front of you.
- **[Bendy Lines](/surprised/#game-activation).** You pick a curve and slide a dot along it. Brain cells bend their answers with curves like these, and that bend is what lets a big stack of cells learn more than a straight line ever could.
- **[Find the Groups](/surprised/#game-kmeans).** You drop a few markers, tap Step, and the computer sorts the dots into groups by itself, with nobody telling it the right answer. That is learning with no labels at all.
- **[Ask the Neighbours](/surprised/#game-knn).** You drag a new grey dot around and it takes the colour of whatever dots are closest. It is the simplest way to guess something new: look at what it sits near.
- **[Just Right](/surprised/#game-overfit).** You slide from a plain line to a wiggly one and watch it go from missing the shape to memorising every bump. The best answer is in the middle, and that lesson, not too simple and not too clever, sits at the heart of the whole field.

## Inside AI: how chatbots really work

These open up the machine behind modern AI. None of it is magic once you have poked it.

- **[Share the Pie](/surprised/#game-softmax).** You slide some scores and they turn into a pie of chances that always adds up to one whole. Almost every AI ends by doing this to pick its answer, and a "heat" dial decides whether it plays safe or takes a gamble.
- **[Who Looks at Who](/surprised/#game-attention).** You tap a word in a sentence and the other words light up by how much it should look at them. That looking is called attention, and it is the trick that made chatbots suddenly good.
- **[Finish the Sentence](/surprised/#game-next-token).** You build a sentence by tapping the robot's guesses. A chatbot is really just this, guessing the next word over and over, on a much bigger pile of reading.
- **[Memory Belt](/surprised/#game-state-space).** You press play and watch one little memory update as words go by. Some AIs remember the past by carrying a small note forward instead of re-reading everything, which is faster.
- **[Build a Robot Brain](/surprised/#game-model-builder).** You stack blocks and make them wider, and the size counter shoots up. Bigger brains can do more but cost far more to build, which is why the famous models are such a big deal.
- **[Map of Words](/surprised/#game-embeddings).** You tap words on a map and find that similar ones sit close together. You can even do word maths on it, like king minus man plus woman landing right on queen.

## Puzzles: one clever answer, hiding

Old logic puzzles, the kind that feel impossible until they suddenly click.

- **[Lights Out](/surprised/#game-lights-out).** You turn off every light, but each tap flips its neighbours too. It is a puzzle about which taps cancel each other out.
- **[Tower Move](/surprised/#game-hanoi).** You move a stack of discs to another peg without ever putting a big one on a small one. The trick is that moving a whole tower means moving a smaller tower first.
- **[Sliding Puzzle](/surprised/#game-fifteen).** You slide tiles one at a time into the empty space to put the numbers in order. Every move looks like a step backward, yet they add up to the goal.
- **[Last Stone Wins](/surprised/#game-nim).** You take stones and try to grab the last one, against a computer that plays perfectly. This game is completely solved, so the right moves always win.
- **[Secret Colours](/surprised/#game-mastermind).** You guess four hidden colours and the clues tell you how close you are. Each guess is a little experiment that shrinks what is left.
- **[Wire the Light](/surprised/#game-logic-gates).** You flip switches and change the box, AND or OR, to turn on a bulb. Every computer alive is built from millions of tiny switches exactly like these.
- **[River Crossing](/surprised/#game-river-crossing).** You row a wolf, a goat, and a cabbage across a river without leaving the wrong pair alone. The catch: sometimes you have to carry something back to win.
- **[Safe Crossing](/surprised/#game-missionaries).** You ferry people across while keeping both banks safe on every single trip. Keeping a rule true at every step is how computers solve timetables too.
- **[Measure Four](/surprised/#game-water-jugs).** You pour water between a five and a three litre jug to measure exactly four. You can only make amounts that fit the two jug sizes, which is a hidden bit of number theory.
- **[Push the Boxes](/surprised/#game-sokoban).** You push boxes onto dots, but you can only push, never pull, so one careless shove gets stuck forever. Real planning means thinking before you move.
- **[Mini Sudoku](/surprised/#game-sudoku4).** You fill a small grid so every row, column, and box has all four numbers. Each square you fill quietly takes choices away from the rest.

## Numbers: maths you can play

Numbers, shapes, and patterns, each turned into a game with a score.

- **[Prime Hunt](/surprised/#game-primes).** You cross out the multiples of each number, and the primes are whatever survive. It is a hunting trick more than two thousand years old.
- **[Times Race](/surprised/#game-times-table).** You answer as many times-table questions as you can before the clock runs out. Pure speed practice, and it works.
- **[Pizza Fractions](/surprised/#game-fractions).** You look at a shaded pizza and pick the fraction that matches. A fraction is just a slice of a whole thing.
- **[Fit the Line](/surprised/#game-guess-line).** You tilt and lift a line until it threads through a cloud of dots. Finding the best line through data is a huge part of how computers predict things.
- **[Guess How Many](/surprised/#game-estimate).** Dots flash for a moment and you guess how many there were. You have a built-in sense of number, and it sharpens with practice.
- **[What Comes Next](/surprised/#game-pattern).** You spot the rule behind a run of numbers and give the next one. Add, times, squares, or the Fibonacci trick.
- **[Point It](/surprised/#game-angle).** You turn an arrow to aim at a dot and read the angle off a protractor. Ninety degrees is a square corner.
- **[The Slope](/surprised/#game-derivative).** You slide a dot along a hill and see how steep it is right there. Where it goes flat is the top or the bottom, and finding that flat spot is exactly what training a model does.
- **[Fill the Space](/surprised/#game-integral).** You fill the space under a curve with thin blocks, and more blocks give a closer answer. That is how you measure a curvy area.
- **[Two Arrows](/surprised/#game-vectors).** You drag two arrows and see how much they agree. That agreement number is the very same maths behind attention.
- **[Bend the Grid](/surprised/#game-matrix).** You change four numbers and watch a square spin, stretch, and flip. Every layer inside a neural network is a bend just like this.

## Real World: physics you can poke

Little sandboxes running the real rules of gravity, springs, and crashes.

- **[Cannon](/surprised/#game-projectile).** You set an angle and a power to hit a target. Gravity pulls the shot into a curve.
- **[Orbits](/surprised/#game-orbit).** You fling a planet and try to make it loop the star instead of crashing or flying away. An orbit is really just falling forever and always missing.
- **[Swings](/surprised/#game-pendulum).** You set two swing lengths and the longer one always swings slower. The weight makes no difference at all, only the length.
- **[The Ramp](/surprised/#game-incline).** You change how steep a ramp is and drop a ball. Steeper means faster, by a neat amount.
- **[Bounce Box](/surprised/#game-bounce).** You fling balls that bounce and knock each other about. Two equal balls swap their speeds when they bump.
- **[Balance](/surprised/#game-balance).** You drop weights on a see-saw to balance it. A weight far from the middle pushes as hard as a heavier weight sitting close in.
- **[Springy](/surprised/#game-spring).** You pull a block on a spring and let go. A stiffer spring bounces faster, no matter how far you pull.
- **[Cart Crash](/surprised/#game-collide).** You crash two carts of different weights. A heavy one barely notices a light one hitting it.

## Your Brain: a quick test on you

The last few measure something about you, not the computer.

- **[Simon Says](/surprised/#game-simon).** You repeat a pattern that grows by one every round. A workout for the memory you use to hold a phone number.
- **[Memory Match](/surprised/#game-memory-match).** You flip cards to find matching pairs. A test of remembering where things are.
- **[Fast Tap](/surprised/#game-reaction).** You tap the instant the screen turns green. People take about a fifth of a second, and now you can measure yours.
- **[Colour Trick](/surprised/#game-stroop).** You name the ink colour and ignore the word, which is weirdly hard. Your reading brain keeps butting in, an effect with a name and a hundred years of study behind it.
- **[Robot Numbers](/surprised/#game-binary).** You flip on and off switches to build a target number. That is how every computer counts, with nothing but on and off.

## Why games at all

You can read that a pendulum's swing depends only on its length. You will forget it by dinner. But set two swings going, watch the long one lag, and it sticks, because you found it rather than being told. Every game here is built on that bet. The idea is never written on the screen in big letters. It is the thing that happens when you play, and noticing it is the whole point.

If one of these grabs you and you want the grown-up version, the rest of this site has the long form: the [writing index](/writing/) has full posts on the algorithms, the machine learning, and the security behind a lot of these toys.

## The short version

- The [arcade](/surprised/) is fifty small games, and each one hides a single big idea inside something you can poke.
- Robot Brains is machine learning made playable: a ball rolling downhill is training, a line splitting dots is a classifier, and a few cells learning a pattern is a neural network doing its thing.
- Inside AI opens the machine: softmax turns scores into chances, attention is words looking at each other, a language model just guesses the next word, and bigger models mean far more parts to build.
- Puzzles, Numbers, Real World, and Your Brain cover logic, maths, physics, and a quick test on you, from crossing a river to measuring the space under a curve.
- The bet behind all of it: an idea you find by playing sticks, and an idea you are simply told does not.
