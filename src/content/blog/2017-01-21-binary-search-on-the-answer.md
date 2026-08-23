---
title: "Binary Search, and Binary Search on the Answer"
description: "Searching a sorted array is the easy half. The useful half is guessing the answer and asking a monotone yes-or-no question, with no array in sight."
date: 2017-01-21
permalink: "/posts/2017/01/binary-search-on-the-answer/"
lang: en
tags:
  - "algorithms"
  - "binary search"
  - "problem solving"
  - "monotonicity"
series: "Problem Solving From Zero"
seriesOrder: 5
math: true
---

*Everyone learns binary search as "find a value in a sorted array". That version is worth ten minutes. The version worth a career is "guess the answer, ask a yes-or-no question, and halve the range". It solves problems with no array and no sorting anywhere in sight, and it is the single highest-value technique in this series.*

## 1. The version you already know

A sorted array, and you want the index of `target`.

```python
def find(a, target):
    lo, hi = 0, len(a) - 1
    while lo <= hi:
        mid = (lo + hi) // 2
        if a[mid] == target:
            return mid
        if a[mid] < target:
            lo = mid + 1
        else:
            hi = mid - 1
    return -1
```

$\mathcal{O}(\log n)$: the range halves each pass. On a million elements that is twenty comparisons.

Fine. Now let me talk about the bugs, because this loop is famously easy to get subtly wrong, and then get to the part that matters.

## 2. The three bugs, and how to stop having them

**Bug one: overflow.** `(lo + hi) // 2` can overflow in a fixed-width integer language. In C++ with `int`, `lo + hi` exceeds two billion long before `hi` does. Write `lo + (hi - lo) / 2` instead. Python has arbitrary-size integers so it does not matter there, but the habit costs nothing.

**Bug two: the infinite loop.** If you write `lo = mid` instead of `lo = mid + 1`, and `mid` happens to equal `lo`, nothing changes and the loop spins forever. The rule: **every branch must shrink the range.**

**Bug three: off by one at the boundary.** `while lo <= hi` with `hi = len(a) - 1`, or `while lo < hi` with `hi = len(a)`. Both work. Mixing them does not.

Here is how I stopped having these bugs: I stopped writing that loop. Instead I write one shape, always, and it answers a different question.

```python
def first_true(lo, hi, ok):
    """Smallest x in [lo, hi] with ok(x) true.
    Requires: ok is false, false, ..., false, true, true, ..., true.
    Returns hi + 1 if ok is never true."""
    while lo < hi:
        mid = lo + (hi - lo) // 2
        if ok(mid):
            hi = mid            # mid might be the answer, keep it
        else:
            lo = mid + 1        # mid is not, discard it
    return lo
```

One loop, `lo < hi`, `hi = mid` on true and `lo = mid + 1` on false. It always terminates because `mid < hi` whenever `lo < hi`, so the `hi = mid` branch strictly shrinks the range too. I have written this function from memory for eight years and it has never been wrong, because there is only one version of it to remember.

Finding a value becomes a special case:

```python
i = first_true(0, len(a), lambda i: i < len(a) and a[i] >= target)
found = i < len(a) and a[i] == target
```

And the standard library already has it: `bisect_left` in Python, `lower_bound` in C++.

## 3. The idea that matters: search the answer, not the data

Here is the shift. Binary search does not need an array. It needs two things:

1. A **range of candidate answers**, which you can usually read off the problem.
2. A **yes-or-no test** on a candidate that is *monotone*: once it starts being true it stays true.

That is it. No sorting, no array, no data structure. If you can answer "is `x` good enough?" then you can find the smallest good `x` in $\log$ of the range.

```
  candidate answer      1   2   3   4   5   6   7   8   9
  is it good enough?    n   n   n   n   y   y   y   y   y
                                        ^
                                    the answer

  each test halves the range: 9 candidates, 4 tests
```

The monotonicity condition is the whole thing. It is what makes halving valid: if `x` is good then everything bigger is good, so you never need to look left of a success. When binary search on the answer fails, it is almost always because the test is not actually monotone, not because the search was coded wrong.

## 4. Worked example: splitting an array

A problem that looks nothing like search. You have an array of `n` positive numbers and you must split it into exactly `k` contiguous parts. The cost of a split is the largest part sum. Minimise that cost.

`n` up to 200,000, `k` up to `n`. Trying all splits is astronomically many.

Now apply the shift. **Guess the answer.** Suppose the answer is `x`, meaning "no part may sum to more than `x`". The test becomes: *can the array be cut into at most `k` parts, each summing to at most `x`?*

That test is easy and greedy: walk left to right, keep adding to the current part, and start a new part the moment adding would exceed `x`.

```python
def parts_needed(a, x):
    """How many parts, if no part may exceed x."""
    parts, running = 1, 0
    for v in a:
        if running + v > x:
            parts += 1
            running = v
        else:
            running += v
    return parts

def min_largest_part(a, k):
    lo, hi = max(a), sum(a)        # the answer is somewhere in here
    return first_true(lo, hi, lambda x: parts_needed(a, x) <= k)
```

Check the two conditions.

**The range.** The answer cannot be less than the largest single element, because that element sits in some part on its own at best. It cannot be more than the total, because one part containing everything is always allowed. So `[max(a), sum(a)]`.

**Monotonicity.** If a budget of `x` needs at most `k` parts, then a budget of `x + 1` needs at most as many, because every cut that was legal is still legal. So the test goes false, false, ..., true, true. Monotone.

Cost: $\mathcal{O}(n)$ per test, $\log(\sum a)$ tests. With sums up to $10^{14}$ that is about 47 tests, so roughly $47n$ steps. Instant.

```
  a = [7, 2, 5, 10, 8]     k = 2      sum = 32, max = 10

  x = 21   parts: [7,2,5] [10,8]        = 2  <= 2   y
  x = 15   parts: [7,2,5] [10] [8]      = 3  >  2   n
  x = 18   parts: [7,2,5] [10,8]        = 2  <= 2   y
  x = 16   parts: [7,2,5] [10] [8]      = 3  >  2   n
  x = 17   parts: [7,2,5] [10] [8]      = 3  >  2   n
  answer: 18
```

Notice what happened to the difficulty. "Minimise the largest part" is a hard optimisation problem. "Can it be done within budget `x`" is a five-line greedy walk. Binary search converted the first into the second, and that conversion is the technique.

## 5. The shapes this covers

Once you have the habit, you start seeing it constantly. A partial list, with the test in each case:

| Problem | Candidate answer | The yes-or-no test |
|---|---|---|
| Minimise the largest part of a split | the largest allowed part sum | greedy: how many parts does budget `x` need |
| Ship packages in `d` days | daily capacity | greedy: how many days at capacity `x` |
| Place `k` cows in stalls, maximise the minimum gap | the minimum gap | greedy: how many cows fit with gap at least `x` |
| Cut `k` planks of equal length from logs | the plank length | sum of `log // x` over all logs |
| Smallest `x` with $x^2 \ge n$ | the root | `x * x >= n`, no floating point needed |
| Minimum time for `m` workers to finish | the time | how much work is done in time `x` |
| Median of two sorted arrays | the split point | count of elements below |

The pattern in the middle column is always the same: **the thing being minimised or maximised becomes the thing you guess.** If the problem says "minimise the maximum" or "maximise the minimum", that phrasing alone is close to a guarantee that this technique applies.

## 6. Binary search on real numbers

Sometimes the answer is not an integer. The loop changes shape: you cannot iterate until `lo == hi`, because floating point may never get there.

```python
def first_true_real(lo, hi, ok, iterations=100):
    for _ in range(iterations):
        mid = (lo + hi) / 2
        if ok(mid):
            hi = mid
        else:
            lo = mid
    return lo
```

Fix the iteration count instead of testing for equality. Each pass halves the interval, so 100 passes shrinks it by $2^{-100}$, which is far below any precision you will ever be asked for. 100 iterations of a cheap test is nothing, and it removes an entire category of "it hangs on some inputs" bug.

Do not write `while hi - lo > 1e-9`. Whether that terminates depends on the magnitudes involved, and for large values the smallest representable gap can exceed your epsilon.

## 7. Where it goes wrong

**The test is not monotone.** The one real failure mode. If "good" is true, then false, then true again, halving will land on one of the true regions or miss entirely, and there is no way to know which. Before coding, say out loud: *if `x` works, does `x + 1` work?* If the answer is not obviously yes, stop.

**The range is wrong.** Too narrow and the answer is outside it, and you will confidently return a boundary. Too wide costs a couple of extra iterations, which is free. Always err wide.

**The test is expensive.** The whole cost is (cost of test) × $\log(\text{range})$. If the test is $\mathcal{O}(n \log n)$ and the range is $10^{18}$, you have $60 n \log n$, which may be too slow. Usually the test is a linear greedy walk, which is the ideal case.

**Integer division rounding.** With `lo + (hi - lo) // 2` and negative bounds, Python's floor division rounds toward negative infinity and C++ truncates toward zero. If your range can go negative, shift it to be non-negative or be very careful.

## The short version

- Learn one binary search: `first_true(lo, hi, ok)`, with `lo < hi`, `hi = mid` on true and `lo = mid + 1` on false. One version to remember means no boundary bugs.
- Use `lo + (hi - lo) // 2`, never `(lo + hi) // 2`, so the habit survives a language with fixed-width integers.
- The real technique is binary search on the *answer*: guess the result, test it with a yes-or-no question, halve the range. No array and no sorting required.
- It needs exactly two things: a range of candidate answers, and a test that is monotone. Monotonicity is the whole condition, and a failure here is almost always the reason it does not work.
- "Minimise the maximum" and "maximise the minimum" in a problem statement are close to a guarantee that this applies.
- On real numbers, run a fixed 100 iterations rather than testing against an epsilon.
- Total cost is the test cost times the log of the range. Keep the test linear and the range generous.

Next: greedy algorithms, and how to tell the difference between a greedy rule that is correct and one that merely passes the samples.
