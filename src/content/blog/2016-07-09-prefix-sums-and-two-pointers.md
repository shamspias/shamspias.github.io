---
title: "Prefix Sums and Two Pointers: The Array Tricks You Will Use Forever"
seoTitle: "Prefix Sums and Two Pointers"
description: "Two techniques that turn a quadratic loop into a linear one, on the humblest data structure there is. Range sums in constant time, and the sliding window."
date: 2016-07-09
permalink: "/posts/2016/07/prefix-sums-and-two-pointers/"
lang: en
tags:
  - "algorithms"
  - "arrays"
  - "prefix sums"
  - "two pointers"
  - "problem solving"
series: "Problem Solving From Zero"
seriesOrder: 3
math: true
---

*Two techniques, one data structure, and both of them do the same thing: they remove work you were about to do twice. Prefix sums answer any range question in one step. Two pointers walk a window through an array without ever backing up. Between them they solve a startling number of problems, and neither needs anything cleverer than an array.*

The array is the most boring data structure in the world and by far the most useful. It has one superpower: you can read `a[i]` without looking at anything else. Everything in this part is built on that.

## 1. The problem prefix sums solve

You are given an array of 200,000 numbers and 200,000 questions. Each question is a pair `(l, r)` and asks for the sum of `a[l] + a[l+1] + ... + a[r]`.

The obvious answer:

```python
def range_sum(a, l, r):
    return sum(a[l:r + 1])
```

For one question that is fine. For 200,000 questions, each potentially covering the whole array, we are looking at $\mathcal{O}(qn)$ where both are 200,000: forty billion steps. Using [part 1's budget](/posts/2016/02/counting-the-steps/), we are about four hundred times over.

Here is the fix, and it is three lines.

## 2. Prefix sums: pay once, answer forever

Build a new array where each entry holds the sum of everything up to that point.

```python
def build_prefix(a):
    p = [0] * (len(a) + 1)
    for i, x in enumerate(a):
        p[i + 1] = p[i] + x
    return p
```

Now any range sum is one subtraction:

```python
def range_sum(p, l, r):
    return p[r + 1] - p[l]
```

Why that works, drawn out. `p[i]` is the sum of the first `i` elements, so `p[r+1]` covers everything from the start through `r`, and `p[l]` covers everything strictly before `l`. Subtract and the shared front cancels, leaving exactly the middle.

```
  index      0    1    2    3    4    5    6
  a          3    1    4    1    5    9    2

  p[i]    0    3    4    8    9   14   23   25
  i       0    1    2    3    4    5    6    7
          ^                   ^              ^
         p[0]                p[3]           p[7]

  sum a[3..5]  =  p[6] - p[3]
               =  (3+1+4+1+5+9) - (3+1+4)
               =  23 - 8
               =  15          and a[3]+a[4]+a[5] = 1+5+9 = 15
```

The two arrays are offset by one, and that offset is where every bug in this technique comes from. Note the shape of it: `p` has `n + 1` entries, `p[i]` sums the first `i` elements of `a`, and `p[0] = 0` stands for the empty prefix. The leading zero is not decoration. It is what makes a query starting at `l = 0` work without a special case.

Before using a prefix array, do this: write down in words what `p[i]` holds, then check one query by hand on a four-element example. An off-by-one here is silent. You do not get a crash or an exception, you get a number, and the number is wrong. Silent wrong answers are far more expensive than loud ones, which is why the thirty seconds of checking is worth it every time.

Total cost: $\mathcal{O}(n)$ to build, $\mathcal{O}(1)$ per question. Forty billion steps became four hundred thousand.

### Two dimensions

The same idea in a grid, which is where it starts to feel like magic. `P[i][j]` is the sum of the rectangle from the top-left corner to `(i-1, j-1)`.

```python
def build_prefix_2d(g):
    r, c = len(g), len(g[0])
    P = [[0] * (c + 1) for _ in range(r + 1)]
    for i in range(r):
        for j in range(c):
            P[i + 1][j + 1] = g[i][j] + P[i][j + 1] + P[i + 1][j] - P[i][j]
    return P

def rect_sum(P, r1, c1, r2, c2):
    return P[r2 + 1][c2 + 1] - P[r1][c2 + 1] - P[r2 + 1][c1] + P[r1][c1]
```

Both formulas are inclusion and exclusion. Adding the block above and the block to the left double-counts their overlap, so subtract it once:

```
   +-------+-----+          want:  the box marked #
   |   A   |  B  |
   |       |     |          A + B + C + # is P[r2+1][c2+1]
   +-------+-----+          A + B     is P[r1][c2+1]
   |   C   |  #  |          A     + C is P[r2+1][c1]
   |       |     |          A         is P[r1][c1]
   +-------+-----+
                            # = P[r2+1][c2+1]
                                - P[r1][c2+1]
                                - P[r2+1][c1]
                                + P[r1][c1]
```

Any rectangle sum, in four lookups, whatever its size.

### The trick's other direction: difference arrays

Prefix sums answer range questions. Turn them around and they *apply* range updates.

Suppose you must add `v` to every element from `l` to `r`, many times, and only read the array at the end. Instead of touching the range, record the change at its two edges:

```python
def build_difference(n):
    return [0] * (n + 1)

def add_range(d, l, r, v):
    d[l] += v
    d[r + 1] -= v          # cancel the addition after the range ends

def finish(d, n):
    out, running = [], 0
    for i in range(n):
        running += d[i]
        out.append(running)
    return out
```

Each update is two writes instead of `r - l + 1`, and one final pass turns the record into the answer. This is exactly the same identity read backwards, and it is the standard answer to "there are 200,000 range updates and one query".

## 3. Two pointers: never back up

The second technique. Here is the problem that motivates it: given a **sorted** array, is there a pair that sums to exactly `target`?

The nested-loop answer is $\mathcal{O}(n^2)$. The insight is that sortedness tells you which way to move.

Put one pointer at each end. Look at the sum:

- Too small? The only way to make it bigger is to move the left pointer right.
- Too big? The only way to make it smaller is to move the right pointer left.
- Equal? Found it.

```python
def has_pair(a, target):
    lo, hi = 0, len(a) - 1
    while lo < hi:
        s = a[lo] + a[hi]
        if s == target:
            return (lo, hi)
        if s < target:
            lo += 1
        else:
            hi -= 1
    return None
```

```
  a = [1, 3, 4, 6, 8, 11]        target = 10

  lo=0 hi=5   1 + 11 = 12  >  10   move hi left
  lo=0 hi=4   1 +  8 =  9  <  10   move lo right
  lo=1 hi=4   3 +  8 = 11  >  10   move hi left
  lo=1 hi=3   3 +  6 =  9  <  10   move lo right
  lo=2 hi=3   4 +  6 = 10   found
```

Why is this $\mathcal{O}(n)$ and not $\mathcal{O}(n^2)$? This is exactly [the amortised argument from part 2](/posts/2016/04/big-o-without-the-maths/): every iteration moves `lo` right or `hi` left, they never move back, and they meet after at most `n` moves in total. Two pointers, one loop, linear.

The reason it is *correct* is worth a sentence, because "it works on the example" is not a proof. When the sum is too big, every pair using the current `hi` and any `lo` further right would be even bigger, so `hi` can be discarded, and no answer is lost. Same argument mirrored for the other case. Each move eliminates a whole row or column of the pair table without checking it.

## 4. The sliding window, which is the same idea

Now the version you will reach for most often. Given an array of **positive** numbers, find the shortest run whose sum is at least `target`.

Both pointers move right this time. The right edge expands to bring the sum up; the left edge contracts while the sum is still large enough, recording the best length as it goes.

```python
def shortest_at_least(a, target):
    best = float('inf')
    left = 0
    running = 0
    for right, x in enumerate(a):
        running += x
        while running >= target:            # shrink while still valid
            best = min(best, right - left + 1)
            running -= a[left]
            left += 1
    return None if best == float('inf') else best
```

```
  a = [2, 3, 1, 2, 4, 3]      target = 7

  right=0  window [2]              sum 2
  right=1  window [2,3]            sum 5
  right=2  window [2,3,1]          sum 6
  right=3  window [2,3,1,2]        sum 8  >= 7   len 4, shrink
           window [3,1,2]          sum 6
  right=4  window [3,1,2,4]        sum 10 >= 7   len 4, shrink
           window [1,2,4]          sum 7  >= 7   len 3, shrink
           window [2,4]            sum 6
  right=5  window [2,4,3]          sum 9  >= 7   len 3, shrink
           window [4,3]            sum 7  >= 7   len 2, shrink   <- best
           window [3]              sum 3

  answer: 2
```

The inner `while` looks like it makes this quadratic. It does not, for the same reason as before: `left` only ever increases, so across the whole run the inner loop body executes at most `n` times. Linear.

**Where this breaks.** It needs the "positive numbers" condition, and it is worth understanding why rather than memorising it. The window works because growing it can only increase the sum and shrinking it can only decrease it. That monotonicity is what makes "shrink while valid" safe. Introduce a negative number and shrinking the window might *increase* the sum, the reasoning collapses, and you need prefix sums with a different structure instead. Any time a sliding-window solution looks wrong, check that assumption first.

## 5. A worked problem, end to end

Real problem, from a contest: given an array of `n` integers and a number `k`, count the subarrays whose sum equals exactly `k`. Negative numbers allowed.

Sliding window is out, because of the negatives. So think in prefix sums. A subarray `a[l..r]` has sum `k` exactly when

$$
p[r+1] - p[l] = k \quad\Longleftrightarrow\quad p[l] = p[r+1] - k
$$

So walk left to right keeping a count of every prefix value seen so far. At each position, the number of subarrays ending here with sum `k` is the number of times `p[r+1] - k` has already appeared.

```python
from collections import defaultdict

def count_subarrays(a, k):
    seen = defaultdict(int)
    seen[0] = 1              # the empty prefix, so a[0..r] can be counted
    running = 0
    total = 0
    for x in a:
        running += x
        total += seen[running - k]
        seen[running] += 1
    return total
```

$\mathcal{O}(n)$ time, $\mathcal{O}(n)$ space, and it handles negatives without a special case. The `seen[0] = 1` line is the one people forget: without it, a subarray that starts at index 0 is never counted, because its matching prefix is the empty one.

Note the shape of the move. We turned "find a pair of positions with a property" into "for each right end, look up how many left ends work". That reframing, from searching pairs to counting matches, is one of the highest-value habits in competitive programming, and it will come back in part 17 on hashing.

## 6. When to reach for which

A short decision table, which is really what this part is for.

| The problem says | Reach for |
|---|---|
| many range sum queries, no updates | prefix sums |
| many range updates, one final read | difference array |
| rectangle sums in a grid | 2-D prefix sums |
| sorted array, find a pair | two pointers from both ends |
| shortest or longest run with a property, all positive | sliding window |
| count subarrays with an exact sum, negatives allowed | prefix sums plus a hash map |
| range sums **and** updates, interleaved | a Fenwick tree, part 18 |

That last row is the honest limit of this part. Prefix sums are static: change one element and the whole array behind it is wrong, costing $\mathcal{O}(n)$ to repair. When updates and queries are mixed, you need a structure that can do both in $\mathcal{O}(\log n)$, and that is what part 18 is about.

## The short version

- A prefix array `p`, where `p[i]` is the sum of the first `i` elements, turns any range sum into one subtraction. Build in $\mathcal{O}(n)$, query in $\mathcal{O}(1)$.
- Write down what `p[i]` means and check it on a four-element example before using it. Off-by-one here is silent: you get a number, and it is wrong.
- Read the identity backwards and you get difference arrays: record `+v` at `l` and `-v` at `r+1`, and one final pass applies every range update at once.
- Two pointers work when sortedness tells you which pointer to move. The cost is linear because neither pointer ever goes back, which is the amortised argument, not a multiplication.
- The sliding window needs the sum to move monotonically with the window, which is why it needs positive values. If a window solution looks wrong, check that first.
- "Find a pair of positions" is often better solved as "for each right end, count the left ends that work". Keep the counts in a hash map.
- All of this is static. The moment updates and queries interleave, you want a Fenwick tree.

Next: sorting. Which algorithm to know, which to actually call, and the far more useful question of what to sort *by*.
