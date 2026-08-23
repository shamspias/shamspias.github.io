---
title: "Big-O Without the Maths: Naming the Shape of a Curve"
description: "Big-O is not a speed and not a stopwatch. It is a claim about the shape of a curve. Six shapes, where each one comes from, and the four rules for reading them."
date: 2016-04-23
permalink: "/posts/2016/04/big-o-without-the-maths/"
lang: en
tags:
  - "algorithms"
  - "complexity"
  - "big-o"
  - "problem solving"
series: "Problem Solving From Zero"
seriesOrder: 2
math: true
---

*Part 1 counted steps. This part gives the counts names. That is genuinely all Big-O is: a naming scheme for how a step count grows, with the unimportant parts deliberately thrown away. The throwing away is the useful bit, and it is the bit that gets taught last.*

In [part 1](/posts/2016/02/counting-the-steps/) we found that summing a list takes `n` steps and finding a zero-sum pair takes `n²`. Big-O is the notation for saying that out loud: the first is $\mathcal{O}(n)$, the second is $\mathcal{O}(n^2)$.

If you stop reading here you already have ninety per cent of the practical value. The rest of this part is about what gets discarded, and why discarding it is a feature.

## 1. What gets thrown away, and why

Suppose you count carefully and get this:

$$
\text{steps} = 3n^2 + 20n + 400
$$

Big-O throws away the `400`, throws away the `20n`, throws away the `3`, and calls it $\mathcal{O}(n^2)$. That looks like vandalism. It is not, and here is the reason, in one table.

| n | $3n^2$ | $20n$ | $400$ | $n^2$ share |
|---|---|---|---|---|
| 5 | 75 | 100 | 400 | 13% |
| 50 | 7,500 | 1,000 | 400 | 84% |
| 500 | 750,000 | 10,000 | 400 | 99% |
| 5,000 | 75,000,000 | 100,000 | 400 | 99.9% |

At `n = 5` the constant `400` dominates and the $n^2$ term is noise. By `n = 500` the $n^2$ term is everything and the others have vanished into rounding. Since the whole point of the exercise is *what happens when the input gets big*, keeping the terms that vanish would be keeping the noise and dropping the signal.

The `3` goes for a different reason. It is not a property of the algorithm; it is a property of the language, the compiler, the processor, and how you happened to write the loop. Move the same algorithm from Python to C and every constant changes while the shape does not. Big-O keeps the part that survives the move.

So the rules are:

1. **Drop constant factors.** $\mathcal{O}(3n)$ and $\mathcal{O}(n/2)$ are both $\mathcal{O}(n)$.
2. **Keep only the fastest-growing term.** $\mathcal{O}(n^2 + n)$ is $\mathcal{O}(n^2)$.
3. **Sequential code adds, and adding means the larger one wins.** A pass of $n$ followed by a pass of $n^2$ is $\mathcal{O}(n^2)$.
4. **Nested code multiplies.** A loop of $n$ containing a loop of $m$ is $\mathcal{O}(nm)$.

Rule 4 has a trap in it that I will come back to in section 4, because "nested loops means multiply" is not always true and the exception is genuinely useful.

## 2. The six shapes, and where each one comes from

You will meet these six over and over. Learn where each one *comes from* and you will be able to recognise the shape of a solution before you write it.

```
  cost
   |                                            n²
   |                                          .
   |                                       .
   |                                   .
   |                               .            n log n
   |                          .          _.-''
   |                     .        _.-''
   |                .   _.-''                   n
   |          . _.-''      ______________
   |     ._.-'' ____------
   |  .-''_-----                             log n
   | .---------------------------------------
   +-----------------------------------------------
                                              n
```

**$\mathcal{O}(1)$, constant.** The work does not depend on the input at all. Reading `a[i]`. Pushing onto a stack. Looking up a key in a hash map. The giveaway is the absence of a loop over the data.

**$\mathcal{O}(\log n)$, logarithmic.** You throw away a fixed fraction of the remaining work at every step. Halving 1,000,000 gets you to 1 in twenty steps; halving $10^{18}$ takes sixty. This is why binary search feels like cheating. Whenever you see "halve it", expect a log.

**$\mathcal{O}(n)$, linear.** You look at each thing a constant number of times. One pass, two passes, ten passes: still linear.

**$\mathcal{O}(n \log n)$, linearithmic.** You do a linear amount of work at each of $\log n$ levels. Merge sort is the canonical example: $\log n$ levels of splitting, each level merging every element once. This is the practical ceiling for "I have to sort or organise everything".

**$\mathcal{O}(n^2)$, quadratic.** Every element meets every other element. All pairs. A nested loop over the same data. Fine to about $n = 5000$, hopeless past that.

**$\mathcal{O}(2^n)$ and $\mathcal{O}(n!)$, exponential and factorial.** Every subset, or every ordering. These only work on tiny inputs, and when a problem gives you `n ≤ 20` it is telling you that $2^n$ is the intended answer.

Here is what those shapes cost in wall-clock time, at a billion steps a second:

| n | $\log n$ | $n$ | $n \log n$ | $n^2$ | $2^n$ |
|---|---|---|---|---|---|
| 10 | instant | instant | instant | instant | 1 μs |
| 30 | instant | instant | instant | instant | 1 second |
| 50 | instant | instant | instant | instant | 13 days |
| 1,000 | instant | 1 μs | 10 μs | 1 ms | forever |
| $10^6$ | instant | 1 ms | 20 ms | 17 minutes | forever |
| $10^9$ | instant | 1 second | 30 seconds | 30 years | forever |

The column that surprises people is $2^n$: it goes from instant to impossible between `n = 30` and `n = 50`. There is no "get a faster computer" out of that. A machine a thousand times faster buys you ten more elements.

## 3. Reading it off code, four examples

**One loop, one pass.**

```python
for x in a:          # n times
    total += x       # O(1) each
```
$\mathcal{O}(n)$.

**Two loops in sequence, not nested.**

```python
for x in a:          # n
    ...
for y in a:          # n
    ...
```
$n + n = 2n$, and constants go, so $\mathcal{O}(n)$. Sequential work adds; two linear passes are still linear. This is worth internalising because it stops you contorting code to avoid a second pass that costs nothing.

**Two loops nested over different things.**

```python
for x in a:          # n
    for y in b:      # m
        ...
```
$\mathcal{O}(nm)$. Not $\mathcal{O}(n^2)$. If `a` has a million elements and `b` has three, this is linear in `a`. Naming the sizes separately is not pedantry; it is the difference between "too slow" and "fine".

**A loop that halves.**

```python
lo, hi = 0, n - 1
while lo <= hi:            # log n times
    mid = (lo + hi) // 2
    ...
```
$\mathcal{O}(\log n)$, because the range `hi - lo` halves every pass and can only halve about $\log_2 n$ times before it is empty.

## 4. The trap in "nested loops means multiply"

This is the one thing in this post I would most like you to remember, because it comes up constantly and the wrong answer is very believable.

```python
for i in range(n):
    for j in range(i):
        ...
```

The inner loop runs 0 times, then 1, then 2, up to $n-1$. So the total is

$$
0 + 1 + 2 + \dots + (n-1) = \frac{n(n-1)}{2}
$$

which is $\mathcal{O}(n^2)$. Multiplying gave the right answer here, roughly, off by a factor of two that Big-O discards anyway. Fine.

Now this one:

```python
i = 0
for j in range(n):
    while i < n and cheap(i):
        i += 1
    ...
```

Two nested loops. Multiplying says $\mathcal{O}(n^2)$. But look at `i`: it never resets. Across the *entire* run of the outer loop, the inner `while` can execute at most `n` times in total, because `i` only ever goes up and stops at `n`. So the whole thing is $\mathcal{O}(n)$.

That reasoning has a name, **amortised analysis**, and the useful version of it is a question: *is there a counter that only moves one way?* If yes, bound the total number of moves instead of multiplying the loops. The two-pointer technique in part 3, and the reason a dynamic array's `append` is $\mathcal{O}(1)$ rather than $\mathcal{O}(n)$, are both this.

```
  multiply the loops        follow the counter
  ------------------        ------------------
  i: 0 1 2 3 ...            i: 0 . . 1 . 2 3 .
  j: 0 1 2 3 ...            j: 0 1 2 3 4 5 6 7
  n × n  =  n²              i moves at most n times
                            total  =  O(n)
```

## 5. Worst, average, and the one that actually matters

Three flavours, and confusion about them causes real arguments.

- **Worst case.** The most steps over all inputs of size `n`. This is what Big-O usually means when nobody says otherwise, and it is the right default because it is a guarantee.
- **Average case.** The expected steps over some assumed distribution of inputs. Useful, but only as honest as the assumption. Quicksort is $\mathcal{O}(n \log n)$ on average and $\mathcal{O}(n^2)$ in the worst case, and the worst case is "already sorted", which is not a rare input in real life.
- **Amortised.** The average per operation over a long sequence of operations, with no probability involved. Appending to a dynamic array is amortised $\mathcal{O}(1)$: most appends are one step, occasionally one costs `n` because the array is copied to a bigger one, and the copies are rare enough to average out.

Amortised is a guarantee. Average case is a bet. That distinction is worth keeping.

There are also two siblings to Big-O worth knowing by name so you can read papers:

| Notation | Means | In plain terms |
|---|---|---|
| $\mathcal{O}(f)$ | at most, up to constants | upper bound, a ceiling |
| $\Omega(f)$ | at least, up to constants | lower bound, a floor |
| $\Theta(f)$ | both | it is exactly this shape |

Strictly, $\mathcal{O}(n^2)$ is true of a linear algorithm, because a ceiling of $n^2$ is a correct if useless statement about something that runs in $n$. In practice everyone writes $\mathcal{O}$ and means $\Theta$. I will too, for the rest of the series, and now you know it is a small lie.

## 6. Memory counts too, and it is often the real limit

Every count in this post has been about time. The same notation describes space, and in contests space is a hard wall you hit without warning.

A typical limit is 256 MB. A 64-bit integer is 8 bytes, so an array of $10^7$ of them is 80 MB, and three of those arrays is your whole budget. A two-dimensional table of size $n \times n$ with `n = 20000` is $4 \times 10^8$ entries, which is not going to happen.

```
  O(1) space      a few variables, whatever n is
  O(n) space      one array the size of the input
  O(n²) space     a table of all pairs: n = 20,000 is already too big
```

This matters most in part 10, on dynamic programming, where the naive table is often $\mathcal{O}(n^2)$ and the trick is noticing you only ever read the previous row, which brings it down to $\mathcal{O}(n)$.

## 7. Where Big-O will lie to you

Being straight about the limits, since I have spent a post selling the tool.

**Constants matter at real sizes.** $\mathcal{O}(n \log n)$ with a huge constant loses to $\mathcal{O}(n^2)$ with a tiny one at `n = 100`. Real sort implementations switch to insertion sort for small chunks for exactly this reason.

**Memory access is not one step.** Reading a value your processor already has in cache is roughly a hundred times cheaper than reading one from main memory. Two algorithms with identical step counts can differ by an order of magnitude because one walks memory in order and the other jumps around. This is the whole subject of part 21, and it is the reason an array of numbers beats a linked list of numbers in practice even where the step counts say otherwise.

**The hidden constant in the notation.** $\mathcal{O}(n)$ with a constant of 1000 is worse than $\mathcal{O}(n \log n)$ for every input you will ever see.

None of this makes Big-O wrong. It makes it the *first* question rather than the only one. Get the shape right first, because no amount of tuning saves a quadratic algorithm on a million elements. Then, and only then, look at constants.

## The short version

- Big-O names how a step count grows. Drop the constant factors and every term but the fastest-growing one, because those are the parts that do not survive a change of computer.
- Six shapes cover almost everything: $1$, $\log n$, $n$, $n \log n$, $n^2$, $2^n$. Learn where each one comes from and you can guess the intended solution from the input size.
- Sequential work adds, so two linear passes are still linear. Nested work multiplies, *unless* there is a counter that only moves one way, in which case bound its total movement instead. That exception is amortised analysis and it is everywhere.
- Worst case is a guarantee, average case is a bet on the input distribution, amortised is a guarantee about a sequence. Do not mix them up.
- Count space as well as time. A 256 MB limit is about $3 \times 10^7$ 64-bit integers, and an $n \times n$ table hits it long before you expect.
- Get the shape right first, then worry about constants. But do worry about them: memory locality can cost you a factor of a hundred that no step count will show.

Next: the array. Prefix sums, the two-pointer walk, and how to answer a thousand range queries without ever looping over a range.
