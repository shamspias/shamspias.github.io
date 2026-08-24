---
title: "Do You Actually Know If It Works?"
seoTitle: "Knowing If Your Code Works, in the AI Era"
description: "The scarce skill now is not writing code but knowing your own system: what you solved, how it works, and whether a new bug is even yours."
date: 2026-08-26
permalink: "/posts/2026/08/do-you-know-if-it-works/"
lang: en
tags:
  - "software engineering"
  - "debugging"
  - "working with ai"
  - "teamwork"
math: false
---

*Someone leans over and asks the simplest question there is: is this working or not? And you freeze. Not because you are a bad engineer, and not because the code is hard. You freeze because you genuinely do not know, and for a second you cannot even tell whether that is your fault. This post is about that moment, why it is happening to more of us now, and how to make sure it stops happening to you.*

## The question that catches you out

"Is this working?" sounds like a yes-or-no question. It is not. Buried inside it are three harder ones: do you know what "working" even means here, do you have a way to check, and do you trust the answer you get back. If you cannot answer those, the honest reply is "I do not know yet", and most people are too embarrassed to say that, so they guess. A guess dressed up as a fact is the most expensive thing you can hand a team.

I used to think the freeze meant I was not good enough at coding. It almost never did. The people who freeze are often strong coders. The freeze is a different gap: not being able to code, but not knowing your own system well enough to speak about it.

## Coding was never the hard part

For a long time the industry measured engineers by how well they wrote code, because writing code was the slow, scarce step. That has quietly stopped being true. A lot of what ships now is written with an AI sitting in the loop, and the raw act of producing a function is close to free.

When the typing gets cheap, the value moves somewhere else. It moves to judgement: knowing what to build, knowing whether what you built is right, and knowing where it will break. You can accept a hundred lines of generated code in a second. Understanding those hundred lines well enough to defend them takes exactly as long as it always did. That gap, between how fast code arrives and how slowly understanding arrives, is the new place people get lost.

So the skill to protect is not "can I write this". It is "do I know what I have". Those are different muscles, and only one of them got easier this year.

## What knowing your system actually means

When I say know your system, I mean three concrete things, and you should be able to say all three out loud without notes.

**What problem you actually solved.** Not the task you were given, the problem you solved. They drift apart constantly. You were asked to make the page load faster and you added a cache, but the real problem was one slow query, and the cache just hides it until the day it does not. If you cannot name the real problem, you cannot know if you solved it, and "it looks fast on my machine" is not knowing.

**How it works, in one breath.** You should be able to trace the path from input to output as a short story: the request comes in here, it calls this, which reads that, and the answer comes back this way. If your explanation is "the AI wrote it and it passed", you do not have a system, you have a lottery ticket. The fix is boring and it works: read the code it gave you, run it, and change one thing on purpose to see what moves. A model you built by poking is worth ten you were handed.

**Where the edges are.** Every piece of software has a set of inputs it handles and a wall past which it does something wrong. Knowing your system means knowing roughly where that wall is: what happens with an empty list, a huge file, a slow network, two people at once. You do not need to have handled every edge. You need to know which ones you did not, because those are the bugs you will be blamed for, and the ones you can honestly say are not yours yet.

## Is this bug mine, or not

Here is the question the AI era makes sharper. When something breaks in a system stitched together from many parts, some of which you wrote and some of which a machine wrote and some of which a stranger wrote years ago, the first real question is not how do I fix it. It is whose is this. Answering that fast is most of debugging.

A rough order that saves me every week:

- **Reproduce it first.** A bug you cannot trigger on purpose is a rumour. Find the exact steps that make it happen every time. Half of all "bugs" evaporate here, because they were a one-off, a stale cache, or someone testing the wrong thing.
- **Read the actual error, all of it.** Not the first line, the whole trace. It usually names the file and the line. That single habit answers "is it mine" faster than any amount of clever theorising, because the trace points at a place, and you either own that place or you do not.
- **Cut the system in half.** Does the failure happen before your part or after it? Log the value going in and the value coming out of the piece you own. If good data goes in and bad data comes out, it is yours. If bad data was already there, it is not, and now you know exactly where to walk next.
- **Check the boundary, not the middle.** Most bugs in a team system live at the seams, where your code hands off to someone else's, and each side assumed the other would handle it. This is why a clear contract, an agreed shape for what crosses the line, is worth so much: it turns "whose bug is this" into a thing you can look up instead of argue about. I wrote a whole post on [designing those contracts so they age well](/posts/2021/06/rest-api-that-ages-well/), and the reason it matters is exactly this moment.
- **You cannot judge what you cannot see.** If a request can cross five services and leave no trail, nobody can tell whose it was, and everyone guesses. The habits that make a system [observable](/posts/2023/05/backend-best-practices/), a log you can search, an id you can follow, are not paperwork. They are what lets you answer "is this mine" with a fact instead of a shrug.

Notice that none of this is about being a better typist. It is about being able to locate a problem in a space you understand. If you do not understand the space, every bug feels like it might be yours, which is exhausting, or like it definitely is not, which is worse.

## The honest answer is a skill

The most useful sentence in engineering is "I do not know yet, and here is how I am going to find out". It sounds like weakness. It is the opposite. It says you know the shape of your own ignorance, which is the first thing a real investigation needs.

Compare it to the two bad answers. "It works" when you have not checked is a lie that will find you later. "I have no idea" with a shrug is a dead end that makes you someone else's problem. The good answer sits between them: I do not know if it works, the way I will check is X, and I will know by Y. That is not hedging. That is the entire job, said plainly.

Get comfortable being the person who says it. It is worth more than the person who is confidently wrong, and everyone on a team past their first year knows it.

## On a team, confusion is contagious

One confused person is a small problem. The trouble is that confusion spreads, because when you cannot say whether your part works, the person downstream cannot say whether theirs does either, and now two people are guessing, then four. A team is a chain of people vouching for their piece. Every link that says "probably fine" instead of "yes, because I checked X" weakens the whole chain.

So the quiet, unglamorous thing that makes a team fast is not raw talent. It is a room full of people who can each say, clearly, this is mine and it works and here is how I know, or this is not mine and here is why. That clarity is a gift you give the people around you. It is also the thing that stops the 3 a.m. call from bouncing between five people who each think it belongs to someone else.

## How to keep knowing, when the machine writes it

You do not have to type the code to own it. You do have to do a few things the machine cannot do for you.

Read what it gave you, out loud if you must, until you can explain it to someone who was not there. Run it, and then break it on purpose, because a thing you have only seen succeed you have not really seen. Write the one test that proves the thing you claim, so that "it works" becomes "it works, and here is the check that says so, and it runs every time". Keep a short map, even just in your head, of what you own and what you do not, so that when the question comes you already know which side of the line the trouble is on.

The tools got faster. The bar for understanding did not move. If anything it went up, because now there is more code, arriving quicker, that somebody still has to actually know. Be that somebody. It is the part of the work that was always the point.

## The short version

- "Is this working?" is really three questions: do you know what working means, can you check it, and do you trust the answer. If not, the honest reply is "not yet", and a guess dressed as a fact is the costliest thing you can hand a team.
- Writing code got cheap; knowing your own system did not. The scarce skill now is judgement, not typing.
- Knowing your system means three things you can say out loud: the real problem you solved, how it works from input to output, and where its edges are.
- When something breaks, the first question is whose is it. Reproduce it, read the whole error, cut the system in half, check the seams, and make sure the system is observable enough to answer with a fact.
- "I do not know yet, here is how I will find out" is a strength, not a weakness. Confidently wrong is worse than honestly unsure.
- On a team, clarity is contagious and so is confusion. Be the person who can say this is mine and it works, or this is not mine and here is why.
- You do not have to type the code to own it, but you do have to read it, break it, test it, and keep a map of what is yours.
