---
title: "Dynamic Programming Is a Table You Fill In"
description: "Four questions turn a problem into a dynamic program: what is the state, what is the answer for a state, what is the base, and in what order do you fill it."
date: 2018-02-25
permalink: "/posts/2018/02/dp-as-a-table/"
lang: en
tags:
  - "algorithms"
  - "dynamic programming"
  - "problem solving"
  - "tabulation"
series: "Problem Solving From Zero"
seriesOrder: 10
math: true
---

*Dynamic programming has a reputation for being hard. It is not hard, it is unhelpfully named. It means "fill in a table where each entry is built from earlier entries", and every DP problem is the same four questions. This part is those four questions, applied five times until the pattern is boring.*

## 1. The four questions

Whatever the problem, ask these in order. Write the answers down before writing code, in words, on paper.

1. **What is the state?** The smallest set of facts that determines the rest of the problem. This is the hard one and the one worth most of your time.
2. **What does one entry mean?** Complete the sentence "`dp[i]` is the ...". If you cannot complete it precisely, you do not have the state right.
3. **What is the base case?** The entries you can write down without looking at any other entry.
4. **What order fills it safely?** Every entry must be computed after everything it depends on.

That is the whole method. The [memoised recursion of part 9](/posts/2017/11/memoisation/) answers questions 1 to 3 and lets the recursion sort out question 4. Doing it bottom-up means answering question 4 yourself, and in exchange you get a smaller constant factor, no stack limit, and the ability to throw away rows you no longer need.

## 2. The smallest possible example

Climbing stairs. You can go up one step or two at a time. How many distinct ways to reach step `n`?

1. **State:** which step you are on. One number.
2. **Meaning:** `dp[i]` is the number of ways to reach step `i`.
3. **Base:** `dp[0] = 1`, one way to be at the bottom, namely do nothing. `dp[1] = 1`.
4. **Order:** increasing `i`, because `dp[i]` needs `dp[i-1]` and `dp[i-2]`.

```python
def stairs(n):
    dp = [0] * (n + 1)
    dp[0] = 1
    if n >= 1:
        dp[1] = 1
    for i in range(2, n + 1):
        dp[i] = dp[i - 1] + dp[i - 2]
    return dp[n]
```

```
  i      0   1   2   3   4   5   6
  dp     1   1   2   3   5   8  13
             \   /
              sum of the two before
```

Which is Fibonacci, of course. The point is not the answer; it is that the four questions produced the code mechanically, with no insight required.

And once the table is written, notice: `dp[i]` only ever reads the two entries behind it. So the array is unnecessary.

```python
def stairs(n):
    a, b = 1, 1                # dp[i-2], dp[i-1]
    for _ in range(2, n + 1):
        a, b = b, a + b
    return b
```

$\mathcal{O}(n)$ time, $\mathcal{O}(1)$ space. **Look at what the recurrence reads, and keep only that.** This is the standard space optimisation and it applies to a large fraction of DP problems.

## 3. Two dimensions: the grid

Count the paths from the top-left of an `r × c` grid to the bottom-right, moving only right or down, with some cells blocked.

1. **State:** which cell you are in. Two numbers.
2. **Meaning:** `dp[i][j]` is the number of paths from the start to cell `(i, j)`.
3. **Base:** `dp[0][0] = 1` if that cell is open.
4. **Order:** row by row, left to right, because `(i, j)` depends on `(i-1, j)` and `(i, j-1)`, both of which come earlier in that order.

```python
def paths(grid):
    r, c = len(grid), len(grid[0])
    dp = [[0] * c for _ in range(r)]
    dp[0][0] = 1 if grid[0][0] == '.' else 0
    for i in range(r):
        for j in range(c):
            if grid[i][j] == '#':          # blocked
                dp[i][j] = 0
                continue
            if i > 0:
                dp[i][j] += dp[i - 1][j]
            if j > 0:
                dp[i][j] += dp[i][j - 1]
    return dp[r - 1][c - 1]
```

```
  grid              dp

  . . . .           1  1  1  1
  . # . .           1  0  1  2
  . . . .           1  1  2  4
  . . # .           1  2  0  4

  each open cell is the sum of the cell above and the cell to its
  left; a blocked cell is 0 and contributes nothing onward.
  answer: dp[3][3] = 4
```

The `dp[0][0]` base and the two `if` guards handle the edges. Note that I did not write special cases for the first row and first column: the guards do it, which is fewer lines and fewer places to be wrong.

Space again: row `i` only reads row `i-1`. So one row suffices, updated in place.

```python
def paths_small(grid):
    r, c = len(grid), len(grid[0])
    row = [0] * c
    row[0] = 1 if grid[0][0] == '.' else 0
    for i in range(r):
        for j in range(c):
            if grid[i][j] == '#':
                row[j] = 0
            elif j > 0:
                row[j] += row[j - 1]      # row[j] is still the row above
    return row[c - 1]
```

That works because when we reach `row[j]`, it still holds the value from the row above, and `row[j-1]` has already been updated to this row. Reading an array that is half-updated is either a beautiful trick or an impossible bug, depending entirely on whether you wrote down which is which. Write a comment. I always do.

## 4. The classic: longest increasing subsequence

Given an array, find the length of the longest strictly increasing subsequence, where the elements need not be adjacent. For `[3, 1, 4, 1, 5, 9, 2, 6]` the answer is 4, for example `1, 4, 5, 9`.

The state choice here is instructive, because the obvious one does not work. "The answer for the first `i` elements" is not enough: to extend a subsequence you need to know what it *ends with*.

1. **State:** an index, with the extra condition that the subsequence ends there.
2. **Meaning:** `dp[i]` is the length of the longest increasing subsequence **ending at** `i`.
3. **Base:** `dp[i] = 1` for all `i`, since any single element is a subsequence of length 1.
4. **Order:** increasing `i`, looking back at all `j < i`.

```python
def lis(a):
    n = len(a)
    dp = [1] * n
    for i in range(n):
        for j in range(i):
            if a[j] < a[i]:
                dp[i] = max(dp[i], dp[j] + 1)
    return max(dp) if dp else 0
```

```
  a      3   1   4   1   5   9   2   6
  dp     1   1   2   1   3   4   2   4

  dp[2]=2  the 4 extends the 3        (3,4)
  dp[4]=3  the 5 extends the 4        (3,4,5)
  dp[5]=4  the 9 extends the 5        (3,4,5,9)
  dp[7]=4  the 6 extends the 5        (3,4,5,6)

  answer: max(dp) = 4, and it is not dp[7] by luck
```

$\mathcal{O}(n^2)$. The answer is `max(dp)`, not `dp[n-1]`, because the longest subsequence does not have to end at the last element. That is a real bug people write.

The lesson to take: **"ending at `i`" is one of the most useful state definitions there is.** It appears in maximum subarray, in LIS, in longest palindromic substring, and in most path problems. When "the answer for the first `i` things" is not enough, adding "and it ends here" is usually what fixes it.

There is an $\mathcal{O}(n \log n)$ version of LIS using binary search, and it is worth learning after this one. It maintains, for each length, the smallest possible tail value, and binary searches that list for each element. I mention it because the technique of "keep the best boundary for each size" recurs.

## 5. Reconstructing the answer, not just its size

DP usually gives you a number, and often the question asks for the actual thing. There are two ways.

**Store a parent pointer.** Alongside each entry, record which earlier entry produced it, then walk backwards.

```python
def lis_sequence(a):
    n = len(a)
    dp = [1] * n
    parent = [-1] * n
    for i in range(n):
        for j in range(i):
            if a[j] < a[i] and dp[j] + 1 > dp[i]:
                dp[i] = dp[j] + 1
                parent[i] = j
    end = max(range(n), key=lambda i: dp[i])
    out = []
    while end != -1:
        out.append(a[end])
        end = parent[end]
    return out[::-1]
```

**Or walk the table backwards afterwards.** From the final cell, ask which predecessor is consistent with the value you see, and step there. This uses no extra memory but needs care to break ties consistently.

Parent pointers are less clever and much harder to get wrong. Use them.

## 6. The recipe on a hard problem

One more, to show the four questions surviving contact with something less obvious. **Word break:** given a string and a dictionary of words, can the string be cut into a sequence of dictionary words?

1. **State:** a position in the string.
2. **Meaning:** `dp[i]` is true if the first `i` characters can be cut into dictionary words.
3. **Base:** `dp[0] = True`, the empty prefix is trivially cuttable.
4. **Order:** increasing `i`. For each `i`, try every `j < i` and ask whether `dp[j]` is true and `s[j:i]` is a word.

```python
def word_break(s, words):
    vocab = set(words)
    n = len(s)
    dp = [False] * (n + 1)
    dp[0] = True
    for i in range(1, n + 1):
        for j in range(i):
            if dp[j] and s[j:i] in vocab:
                dp[i] = True
                break
    return dp[n]
```

$\mathcal{O}(n^2)$ pairs, and the slice `s[j:i]` costs its own length, so strictly $\mathcal{O}(n^3)$ in the worst case. Fine for a few hundred characters. Note the `vocab = set(words)`, which is [the hidden loop from part 1](/posts/2016/02/counting-the-steps/): `in` on a list would have made this a factor of `len(words)` slower.

The `dp[0] = True` base is the interesting line, and it is the same structural point as the `seen[0] = 1` in the prefix-sum counting problem and the `p[0] = 0` in the prefix array. **The empty case is almost always a real case, and forgetting it is almost always the bug.**

## 7. How to recognise a DP problem

Signals, roughly in order of reliability:

- **"Count the number of ways"** and the count is large or asked for modulo something.
- **"Minimum or maximum cost to do X"** where choices interact.
- **Small `n` with a big answer.** `n ≤ 1000` and an answer that needs a big integer is DP-shaped.
- **A greedy rule that you can break with a counterexample.** [Part 6](/posts/2017/04/greedy-when-it-works/) says look for one; finding one is evidence for DP.
- **Overlapping subproblems in the recursion.** If you write the brute force and see the same call twice, that is the tell.

And the anti-signals, where DP is the wrong reflex: `n` up to $10^6$ with a two-dimensional state, since the table will not fit; or a problem where the choices genuinely do not interact, where greedy is simpler and correct.

## 8. Debugging a DP

When it gives the wrong answer, the fault is nearly always in one of four places, and checking them in this order is fastest.

1. **The base case.** Print `dp` after initialisation. Is `dp[0]` what you claimed? Should it be 0 or 1, and does "0 ways" or "1 way to do nothing" match the question?
2. **The order.** Print the table and check that everything an entry read was already filled. Reading a zero that should have been a value is the classic symptom.
3. **The meaning.** Say the sentence out loud: "`dp[i]` is the ...". Then check one entry by hand against that sentence. If they disagree, the recurrence is computing something other than what you think.
4. **The final read.** `dp[n]` or `max(dp)`? Getting this wrong looks like a subtle algorithm bug and is a one-character fix.

Print the whole table for a five-element input. Every time. It takes a minute and it beats staring at the recurrence.

## The short version

- Four questions: what is the state, what does one entry mean, what is the base, and in what order can it be filled safely. Answer them in words before writing code.
- Complete the sentence "`dp[i]` is the ...". If you cannot say it precisely, the state is wrong, and no amount of fiddling with the recurrence will fix that.
- "Ending at `i`" is one of the most useful state definitions there is. Reach for it when "the first `i` things" is not enough information.
- Look at what the recurrence actually reads. If it only reads the previous row, keep one row and drop the table.
- The empty case is a real case. `dp[0]`, `p[0]`, `seen[0]`: forgetting it is the most common DP bug there is.
- To recover the answer and not just its size, store parent pointers. Less clever than walking the table backwards, and much harder to get wrong.
- When it is wrong, check in this order: base case, fill order, the meaning of an entry, then which cell you read at the end. Print the table for a five-element input first.

Next: the knapsack family, and what to do when the state is a set rather than a number.
