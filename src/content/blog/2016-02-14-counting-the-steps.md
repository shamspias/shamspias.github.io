---
title: "Counting the Steps: What Your Loop Actually Costs"
description: "Before any algorithm makes sense you need one habit: counting how many times a line runs. Here is that habit, built from four small programs and a stopwatch."
date: 2016-02-14
permalink: "/posts/2016/02/counting-the-steps/"
lang: en
tags:
  - "algorithms"
  - "complexity"
  - "problem solving"
  - "beginners"
series: "Problem Solving From Zero"
seriesOrder: 1
math: true
---

*Every algorithm you will ever learn is an answer to the same question: how many times does this line run? Not "is this fast", which depends on your laptop, but "how many steps", which does not. This part builds that one habit, because nothing else in the series makes sense without it.*

I want to start somewhere genuinely small. Not with a definition, and not with a Greek letter. With a program that adds up numbers.

## 1. The first program, and the first question

You are given a list of numbers and asked for their sum.

```python
def total(numbers):
    running = 0
    for n in numbers:
        running += n
    return running
```

Now the only question that matters: **how many times does `running += n` run?**

Once per number. If the list has 10 numbers it runs 10 times. If it has 1,000,000 it runs 1,000,000 times. Write that down as a rule and you have said something true about this program on every computer that has ever existed:

```
  steps  =  n
```

where `n` is how many numbers there are. That is the whole idea. Everything else in this series is that idea applied to harder programs.

Notice what we did *not* do. We did not time it. Timing tells you about your laptop, the weather in the data centre, and whether Chrome was open. Counting tells you about the program.

## 2. A second program that looks the same and is not

Now a different task. You are given a list of numbers, and asked: is there a pair that adds up to zero?

Here is the honest first attempt, the one everybody writes:

```python
def has_zero_pair(numbers):
    for a in numbers:
        for b in numbers:
            if a is not b and a + b == 0:
                return True
    return False
```

How many times does the comparison run? For each of the `n` values of `a`, the inner loop runs `n` times. So:

```
  steps  =  n × n  =  n²
```

Those two programs look about equally complicated on the page. They are not remotely equally expensive. Put numbers on it:

| n | sum: n steps | pair: n² steps |
|---|---|---|
| 10 | 10 | 100 |
| 1,000 | 1,000 | 1,000,000 |
| 100,000 | 100,000 | 10,000,000,000 |
| 1,000,000 | 1,000,000 | 1,000,000,000,000 |

Read the bottom row again. One million steps is instant. One *trillion* steps, at a very optimistic billion steps per second, is about seventeen minutes. Same-looking code, seventeen minutes versus nothing.

This is the moment the habit pays for itself, and it is why we count before we write.

## 3. The rule of thumb that will get you through a contest

Modern hardware does very roughly $10^8$ to $10^9$ simple operations per second. Contest problems are usually set with a one or two second limit. So the working rule is:

> Your solution should do somewhere under a hundred million steps.

Combine that with the size of the input the problem gives you, and the problem has told you which algorithm it wants. This table is the single most useful thing in this post. I still use it.

| If n is up to | you can afford | which means |
|---|---|---|
| 10 | $n!$ | try every ordering |
| 20 | $2^n$ | try every subset |
| 500 | $n^3$ | three nested loops |
| 5,000 | $n^2$ | two nested loops |
| $10^6$ | $n \log n$ | sort it, or a heap |
| $10^7$ | $n$ | one pass |
| $10^{18}$ | $\log n$ | binary search, or maths |

A problem that says "n up to 200,000" is telling you, in plain language, that $n^2$ is not going to work and you need to find something around $n \log n$. That is not a hint hidden in the statement. It *is* the statement.

## 4. Where the steps hide

Counting is easy when the loops are visible. The mistakes come from steps you did not write.

**A loop inside a library call.** This looks like one line:

```python
if x in numbers:      # numbers is a list
    ...
```

It is not one step. Python walks the list looking for `x`, so it is up to `n` steps. Put it inside a loop over the same list and you have written $n^2$ without typing a nested loop. Use a `set` and the same line becomes roughly one step:

```python
seen = set(numbers)   # n steps, once
if x in seen:         # about 1 step, every time
    ...
```

**String concatenation in a loop.** In most languages a string cannot be extended in place, so `s = s + c` copies the whole string. Do it `n` times and the copies add up to $1 + 2 + 3 + \dots + n$, which is $n(n+1)/2$, which is $n^2$ dressed up.

```python
# n² total copying
s = ''
for c in chars:
    s = s + c

# n, because the join copies once
s = ''.join(chars)
```

**Slicing.** `numbers[1:]` in Python builds a new list. A recursive function that slices the input on every call is doing far more work than the recursion suggests.

The habit that catches all three: for every line in your loop, ask *is this really one step*. If the line touches a whole collection, it is not.

## 5. Worked example: the largest sum of a run

Here is a real problem, and the four versions I would have written in 2014, 2015, and now. The problem: given a list of numbers, find the largest possible sum of a **contiguous** run of them. For `[3, -2, 5, -1]` the answer is `6`, from `[3, -2, 5]`.

**Version one: try every run, add it up.** Two loops to pick the start and end, and a third to add.

```python
def best_v1(a):
    n = len(a)
    best = a[0]
    for i in range(n):
        for j in range(i, n):
            s = 0
            for k in range(i, j + 1):
                s += a[k]
            best = max(best, s)
    return best
```

Three nested loops: $n^3$. At $n = 5000$ that is $1.25 \times 10^{11}$ steps. Far too slow.

**Version two: stop re-adding.** The third loop is pure waste. As `j` moves right by one, the sum only needs one addition, not a fresh walk.

```python
def best_v2(a):
    best = a[0]
    for i in range(len(a)):
        s = 0
        for j in range(i, len(a)):
            s += a[j]
            best = max(best, s)
    return best
```

$n^2$. At $n = 5000$ that is 25 million steps, which is fine. At $n = 10^6$ it is not.

**Version three: ask a better question.** Instead of "what is the best run", ask "what is the best run *that ends here*". Walk left to right, and at each position you have exactly two choices: extend the run you were already building, or throw it away and start fresh at this element.

```python
def best_v3(a):
    best = here = a[0]
    for x in a[1:]:
        here = max(x, here + x)     # extend, or start again
        best = max(best, here)
    return best
```

One loop. $n$ steps. At $n = 10^6$ it is a millisecond.

```
  a       3    -2     5    -1
          |     |     |     |
  here    3     1     6     5      extend or restart
  best    3     3     6     6      the running answer
```

That is Kadane's algorithm, and I am not showing it because you need to memorise it. I am showing it because of the shape of the story: $n^3 \to n^2 \to n$, and each step came from noticing repeated work and refusing to do it twice. That is what algorithm design *is*. Almost every part of this series is another instance of it.

## 6. The thing nobody tells you first

Counting steps tells you how the cost *grows*. It deliberately says nothing about the constant in front. A program doing $100n$ steps and one doing $2n$ steps are both "$n$", and one is fifty times slower.

That is not a flaw, it is the point. Growth is the part that survives a new laptop; the constant is not. But it means two honest things follow:

1. For small inputs, the "worse" algorithm often wins. Insertion sort beats quicksort below about a dozen elements, which is why real sort implementations switch to it at the bottom.
2. When two solutions have the same growth, the constant is all there is, and then you *do* measure. Part 20 of this series is entirely about constants that come from memory rather than from step counts.

## 7. Practice that actually helps

Do this for a week and the habit sticks. Take any function you have written and answer three questions in writing:

1. What is `n`? Name it. Half of all confusion here is a program with two different sizes in it, like a grid that is `r` rows by `c` columns, being described with one letter.
2. How many times does the innermost line run, in terms of `n`?
3. Given the input size the problem allows, is that under a hundred million?

If you cannot answer question one, you do not yet understand the problem. That happens more often than you would like, and finding out early is the whole benefit.

## The short version

- Count how many times the innermost line runs. Do not time it; timing measures your laptop, counting measures your program.
- $n$ and $n^2$ look equally simple on the page. At a million elements one is instant and the other takes seventeen minutes.
- Roughly a hundred million steps per second is the budget. The input size in the problem statement tells you which algorithm is being asked for.
- Steps hide inside innocent-looking lines: `in` on a list, string concatenation in a loop, slicing. If a line touches a whole collection, it is not one step.
- Better algorithms almost always come from spotting work being repeated and refusing to repeat it. That is the whole trick, and the rest of this series is variations on it.

Next: putting a name to the growth, and why $\mathcal{O}(n)$ is a claim about the shape of a curve rather than a speed.
