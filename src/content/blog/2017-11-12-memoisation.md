---
title: "Memoisation: Paying Once for an Answer"
description: "The cheapest optimisation in programming: remember what you already worked out. One dictionary turns an exponential recursion into a linear one."
date: 2017-11-12
permalink: "/posts/2017/11/memoisation/"
lang: en
tags:
  - "algorithms"
  - "memoisation"
  - "dynamic programming"
  - "problem solving"
series: "Problem Solving From Zero"
seriesOrder: 9
math: true
---

*This is the smallest idea in the series and the one with the largest payoff. A recursive function that recomputes the same subproblem is doing exponential work for a linear amount of information. Store the answers in a dictionary and the exponent disappears. That is memoisation, and it is the doorway to dynamic programming.*

## 1. The disaster

Fibonacci, written the way the definition reads.

```python
def fib(n):
    if n <= 1:
        return n
    return fib(n - 1) + fib(n - 2)
```

Correct, and catastrophically slow. `fib(40)` takes seconds. `fib(60)` will not finish in your lifetime.

Draw two levels of the call tree and the reason is obvious:

```
                    fib(5)
                  /        \
            fib(4)          fib(3)
           /      \        /      \
     fib(3)      fib(2)  fib(2)   fib(1)
     /    \      /   \   /   \
 fib(2) fib(1) f(1) f(0) f(1) f(0)
 /   \
f(1) f(0)
```

`fib(3)` is computed twice. `fib(2)` three times. `fib(1)` five times. For `fib(40)`, `fib(2)` is computed 102,334,155 times. The tree has about $1.618^n$ nodes, where 1.618 is the golden ratio, which is a nice piece of trivia and a terrible running time.

And here is the thing worth noticing: there are only **41** distinct values of `fib` between 0 and 40. We are doing a hundred million calls to compute forty-one numbers.

## 2. The fix, in three lines

Keep a dictionary. Before computing, look; after computing, store.

```python
def fib(n, memo={}):
    if n <= 1:
        return n
    if n in memo:
        return memo[n]
    memo[n] = fib(n - 1, memo) + fib(n - 2, memo)
    return memo[n]
```

`fib(500)` is now instant. The cost went from $\mathcal{O}(1.618^n)$ to $\mathcal{O}(n)$, because each of the `n` distinct subproblems is computed exactly once and looked up thereafter.

In Python the standard library does it for you, and this is what I actually write:

```python
from functools import lru_cache

@lru_cache(maxsize=None)
def fib(n):
    return n if n <= 1 else fib(n - 1) + fib(n - 2)
```

One decorator. Nothing else changed. That is the entire technique.

A warning about the first version, since it is a classic Python trap: `memo={}` as a default argument is created **once**, when the function is defined, and shared by every call. For a pure function of `n` that is exactly what you want, and it is why the trick works. But if the "right" answer ever depends on something outside `n`, that shared dictionary will hand you a stale result from a previous run and you will spend an hour finding it. Use `lru_cache`, or pass the dictionary explicitly.

## 3. When memoisation applies

Two conditions, and they are worth checking rather than assuming.

**The function must be pure.** Same arguments, same answer, no reading of anything that changes. If the result depends on a global that moves, caching it is caching a lie.

**Subproblems must repeat.** If every call is unique, the cache never hits and you have added overhead for nothing. Memoisation is not a free speedup; it is a trade of memory for repeated work, and it only pays when the work repeats.

The quantity to think about is the **number of distinct states**. That is what the cost becomes. For `fib` the state is one number `n`, so there are `n` states and the cost is $\mathcal{O}(n)$. For a function of two indices `i` and `j`, there are $n \times m$ states. The rule:

$$
\text{total cost} \approx (\text{number of states}) \times (\text{work per state})
$$

That single formula is how you decide whether a memoised recursion will be fast enough, before writing it. Count the states, multiply by the work each one does outside its recursive calls, and compare against [the hundred-million budget](/posts/2016/02/counting-the-steps/).

## 4. Choosing the state, which is the actual skill

The code is a decorator. The thinking is picking what to memoise on, and getting it wrong shows up in two ways: a cache that never hits, or a cache that hits when it should not and returns wrong answers.

Three rules.

**Include everything the answer depends on.** If `solve(i)` gives a different answer depending on how much money you have left, then the state is `(i, money)`, not `i`. A cache keyed on too little is not slow, it is *wrong*, and it will be wrong quietly.

**Include nothing else.** Every extra dimension multiplies the state count. If you pass the whole remaining list when an index would do, every call has a unique key and the cache is dead weight.

**States must be hashable and cheap to hash.** A tuple of integers is ideal. A list is not hashable. A frozenset works but hashing it costs proportional to its size, which can quietly dominate.

Here is the mistake in its natural habitat. Counting paths through a grid, only moving right or down:

```python
# Wrong: the key is the whole remaining grid, so nothing ever repeats
@lru_cache(maxsize=None)
def paths(grid_tuple, r, c):
    ...

# Right: the grid never changes, so it is not part of the state
@lru_cache(maxsize=None)
def paths(r, c):
    if r == 0 or c == 0:
        return 1
    return paths(r - 1, c) + paths(r, c - 1)
```

The grid is constant across the whole computation, so putting it in the key adds nothing but cost. Everything that varies goes in; everything that does not, stays out.

## 5. A worked example: edit distance

The real thing. Given two strings, what is the smallest number of single-character insertions, deletions and substitutions that turns one into the other? This is the algorithm behind spell-checkers, `diff`, and DNA sequence alignment.

Follow the [recursion habit from part 8](/posts/2017/07/recursion-and-backtracking/): write the contract, find the base case, build from the smaller calls.

**Contract.** `dist(i, j)` is the edit distance between the first `i` characters of `a` and the first `j` characters of `b`.

**Base cases.** If `i` is 0, the only way to build `j` characters from nothing is `j` insertions. Symmetrically for `j` being 0.

**Body.** Look at the last characters. If `a[i-1] == b[j-1]`, they cost nothing and the answer is `dist(i-1, j-1)`. If they differ, there are exactly three moves, and we take the cheapest:

- delete `a[i-1]`, leaving `dist(i-1, j)`
- insert `b[j-1]`, leaving `dist(i, j-1)`
- substitute, leaving `dist(i-1, j-1)`

```python
from functools import lru_cache

def edit_distance(a, b):
    @lru_cache(maxsize=None)
    def dist(i, j):
        if i == 0:
            return j                 # insert everything left of b
        if j == 0:
            return i                 # delete everything left of a
        if a[i - 1] == b[j - 1]:
            return dist(i - 1, j - 1)
        return 1 + min(dist(i - 1, j),        # delete
                       dist(i, j - 1),        # insert
                       dist(i - 1, j - 1))    # substitute
    return dist(len(a), len(b))
```

States: $i$ from 0 to $n$, $j$ from 0 to $m$, so $(n+1)(m+1)$ of them. Work per state: constant, three comparisons and a `min`. Total: $\mathcal{O}(nm)$.

Without the cache this recursion is roughly $3^{n}$, since each call spawns three. With it, two thousand-character strings take four million steps.

```
  a = "kitten"   b = "sitting"

      ""  s  i  t  t  i  n  g
  ""   0  1  2  3  4  5  6  7
  k    1  1  2  3  4  5  6  7
  i    2  2  1  2  3  4  5  6
  t    3  3  2  1  2  3  4  5
  t    4  4  3  2  1  2  3  4
  e    5  5  4  3  2  2  3  4
  n    6  6  5  4  3  3  2  3

  answer: 3   (k->s, e->i, insert g)
```

That table is what the cache contains after the run. Note that we filled it top-down, following the recursion, and only the cells the recursion asked for. Filling it bottom-up in two loops instead is the subject of the next part, and it is the same table either way.

## 6. Top-down or bottom-up

Memoised recursion is called **top-down** dynamic programming: start at the answer you want and recurse down. Filling a table with loops is **bottom-up**. Both compute the same values.

| | Top-down (memoised) | Bottom-up (tabulated) |
|---|---|---|
| Shape | recursion plus a cache | nested loops |
| Order | driven by the recursion | you choose it |
| Computes | only the states it needs | every state in the range |
| Depth limit | yes, can overflow the stack | no |
| Constant factor | higher, function calls and hashing | lower, array indexing |
| Easier to write | usually, follows the definition | needs the ordering worked out |
| Easier to optimise for space | no | yes, keep one row |

My habit, and I recommend it: **write it top-down first.** The recursion follows the problem definition, so it is much harder to get wrong. Then, if it is too slow or too deep, convert it to bottom-up, where the constant factor is smaller and the memory can be squeezed. Getting a correct slow solution and then speeding it up beats trying to write a fast one directly.

## 7. Two more examples, quickly

**Coin change, counting the ways.** How many ways to make `amount` from a list of coin values, order not mattering?

```python
def ways(amount, coins):
    @lru_cache(maxsize=None)
    def go(i, left):
        if left == 0:
            return 1
        if left < 0 or i == len(coins):
            return 0
        return go(i + 1, left) + go(i, left - coins[i])
    return go(0, amount)
```

The state is `(i, left)`: which coins remain available, and how much is left to make. Passing `i` rather than allowing any coin at any time is what stops `2 + 3` and `3 + 2` being counted separately.

**Longest common subsequence.** The other half of `diff`.

```python
def lcs(a, b):
    @lru_cache(maxsize=None)
    def go(i, j):
        if i == 0 or j == 0:
            return 0
        if a[i - 1] == b[j - 1]:
            return 1 + go(i - 1, j - 1)
        return max(go(i - 1, j), go(i, j - 1))
    return go(len(a), len(b))
```

Same state space as edit distance, same $\mathcal{O}(nm)$. Notice how similar the two functions are: once you see the shape "two indices walking backwards through two sequences", a whole family of problems opens up at once.

## 8. What to watch for

**Cache key too small.** Wrong answers, not slow ones. If a memoised solution gives inconsistent results, this is the first thing to check.

**Cache key too big.** No speedup, and memory blowing up. Check that the state count is what you think it is.

**Unhashable state.** Lists and dictionaries cannot be keys. Convert to tuples, and if you are tempted to key on a set, ask whether an index would do instead.

**Stack depth.** A memoised recursion `n` levels deep still needs `n` stack frames the first time down. With `n = 200,000`, raise the limit or go bottom-up.

**Memory.** An $n \times m$ cache with both at 10,000 is $10^8$ entries, which will not fit. That is the case where bottom-up plus keeping only the previous row is not an optimisation but the only option.

## The short version

- A recursion that recomputes subproblems is doing exponential work for a linear amount of information. `fib(40)` computes `fib(2)` a hundred million times to produce forty-one numbers.
- The fix is a dictionary: look before computing, store after. In Python that is one `lru_cache` decorator.
- It applies when the function is pure and subproblems actually repeat. It is a trade of memory for repeated work, not a free speedup.
- Cost is the number of distinct states times the work per state. Count the states before writing anything and compare against the budget.
- Choosing the state is the real skill. Include everything the answer depends on, nothing else, and keep it a tuple of integers.
- A key that is too small gives wrong answers quietly. A key that is too big gives no speedup at all.
- Write it top-down first, because the recursion follows the definition and is hard to get wrong. Convert to bottom-up when you need the smaller constant or the smaller memory.

Next: the same tables, filled with loops instead of recursion, and the four questions that turn any problem into a dynamic program.
