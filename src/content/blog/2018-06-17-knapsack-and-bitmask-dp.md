---
title: "The Knapsack Family, and When the State Is a Set"
description: "Knapsack is one recurrence with a dozen disguises. Learn the family, then learn to put a set of items in the state with a bitmask when n is small."
date: 2018-06-17
permalink: "/posts/2018/06/knapsack-and-bitmask-dp/"
lang: en
tags:
  - "algorithms"
  - "dynamic programming"
  - "knapsack"
  - "bitmask"
  - "problem solving"
series: "Problem Solving From Zero"
seriesOrder: 11
math: true
---

*Knapsack is not one problem, it is a family, and most of them are the same six lines with a loop direction changed. Learn the family and you will recognise it inside problems that never mention bags or weights. Then, when the items number twenty or fewer, you can put an entire set of them into the state as an integer, and a different class of problem opens up.*

## 1. The 0/1 knapsack

`n` items, each with a weight and a value. A bag that holds `W` weight. Each item may be taken once or not at all. Maximise the value.

Greedy by value per weight fails, and [part 7](/posts/2017/04/greedy-when-it-works/) explains why: with indivisible items, the densest item can leave a gap that a slightly less dense one would have filled exactly.

So, the [four questions](/posts/2018/02/dp-as-a-table/).

1. **State:** how many items we have considered, and how much capacity is left.
2. **Meaning:** `dp[i][w]` is the best value using only the first `i` items, with capacity `w`.
3. **Base:** `dp[0][w] = 0` for all `w`. No items, no value.
4. **Order:** increasing `i`, any order of `w`.

For each item there are two choices: skip it, or take it if it fits.

```cpp
int knapsack(const vector<int>& weights, const vector<int>& values, int W) {
    int n = (int)weights.size();
    vector<vector<int>> dp(n + 1, vector<int>(W + 1, 0));
    for (int i = 1; i <= n; ++i) {
        int wi = weights[i - 1], vi = values[i - 1];
        for (int w = 0; w <= W; ++w) {
            dp[i][w] = dp[i - 1][w];                         // skip
            if (wi <= w) {
                dp[i][w] = max(dp[i][w], dp[i - 1][w - wi] + vi);   // take
            }
        }
    }
    return dp[n][W];
}
```

$\mathcal{O}(nW)$ time and space.

```
  items (weight, value): (2,3) (3,4) (4,5) (5,6)     W = 5

  w:        0  1  2  3  4  5
  no items  0  0  0  0  0  0
  + (2,3)   0  0  3  3  3  3
  + (3,4)   0  0  3  4  4  7      3 + 4, using both
  + (4,5)   0  0  3  4  5  7
  + (5,6)   0  0  3  4  5  7      6 alone is worse than 3 + 4

  answer: 7
```

### The one-row version, and the direction that matters

`dp[i]` only reads `dp[i-1]`, so one row is enough. But there is a trap, and it is the single most instructive detail in this whole post.

```cpp
int knapsack_1d(const vector<int>& weights, const vector<int>& values, int W) {
    vector<int> dp(W + 1, 0);
    for (size_t i = 0; i < weights.size(); ++i) {
        int wi = weights[i], vi = values[i];
        for (int w = W; w >= wi; --w) {        // DOWNWARD
            dp[w] = max(dp[w], dp[w - wi] + vi);
        }
    }
    return dp[W];
}
```

The inner loop goes **downward**. Here is why. When we compute `dp[w]`, we want `dp[w - wi]` to be the value from the *previous* item, because each item may be used once. Going downward, `dp[w - wi]` is at a lower index that we have not touched yet this round, so it still holds the previous row. Going upward, we would already have updated it this round, and the item would be counted twice.

Which is a bug in the 0/1 problem and exactly the feature you want in the next one.

## 2. Unbounded knapsack: the same loop, upward

Same problem, but each item may be taken any number of times.

```cpp
int knapsack_unbounded(const vector<int>& weights, const vector<int>& values, int W) {
    vector<int> dp(W + 1, 0);
    for (size_t i = 0; i < weights.size(); ++i) {
        int wi = weights[i], vi = values[i];
        for (int w = wi; w <= W; ++w) {        // UPWARD
            dp[w] = max(dp[w], dp[w - wi] + vi);
        }
    }
    return dp[W];
}
```

The only change is the loop direction. Upward, `dp[w - wi]` has already been updated with this item, so the item can be reused, which is precisely the definition of unbounded.

```
  0/1:        dp[w - wi] is from the previous item   ->  each item once
  unbounded:  dp[w - wi] is from this item too       ->  each item freely

  loop down for 0/1, up for unbounded.
```

That is the highest-value thing in this post. If you remember nothing else, remember that a single loop direction is the difference between "once" and "any number of times".

## 3. The rest of the family

Every one of these is the same recurrence with a different combining operation or a different question.

**Subset sum.** Is there a subset that sums to exactly `T`? Same as 0/1 with values equal to weights, but boolean.

```cpp
bool subset_sum(const vector<int>& a, int T) {
    vector<bool> dp(T + 1, false);
    dp[0] = true;                             // the empty subset
    for (int x : a) {
        for (int t = T; t >= x; --t) {
            dp[t] = dp[t] || dp[t - x];
        }
    }
    return dp[T];
}
```

**Partition into two equal halves.** Subset sum with `T = total / 2`, after checking the total is even. In C++ `/` between two ints already truncates, and `//` would start a comment rather than divide. A problem that sounds nothing like knapsack and is exactly knapsack.

**Counting the ways to make change.** Replace `max` with `+` and you are counting instead of optimising.

```cpp
long long count_change(int amount, const vector<int>& coins) {
    vector<long long> dp(amount + 1, 0);      // counts outgrow 32 bits quickly
    dp[0] = 1;                                // one way to make nothing
    for (int c : coins) {                     // coins outer: combinations
        for (int a = c; a <= amount; ++a) {
            dp[a] += dp[a - c];
        }
    }
    return dp[amount];
}
```

The loop nesting here decides what you are counting, and this catches people constantly:

```
  for coin:  for amount:      counts COMBINATIONS   (2+3 same as 3+2)
  for amount: for coin:       counts PERMUTATIONS   (2+3 and 3+2 differ)
```

Both are correct code. They answer different questions. Read the problem statement again and decide which one it wants.

**Minimum coins.** Replace `max` with `min`, start the table at infinity, keep `dp[0] = 0`.

**Bounded knapsack**, where item `i` may be taken up to `c[i]` times. The naive answer is to expand item `i` into `c[i]` copies and run 0/1, which costs $\mathcal{O}(W \sum c_i)$. The good answer is **binary splitting**: replace `c` copies with copies of size 1, 2, 4, 8, and a remainder, because any count up to `c` is a sum of those. That is $\mathcal{O}(W \sum \log c_i)$.

```cpp
// 1, 2, 4, ... and a remainder: any total up to count is reachable.
vector<int> split_counts(int count) {
    vector<int> out;
    int k = 1;
    while (k <= count) {
        out.push_back(k);
        count -= k;
        k *= 2;
    }
    if (count > 0) {
        out.push_back(count);
    }
    return out;
}
```

Here is the family in one table:

| Problem | Combine with | Loop direction | Base |
|---|---|---|---|
| 0/1 knapsack, max value | `max` | down | `dp[0] = 0` |
| Unbounded knapsack | `max` | up | `dp[0] = 0` |
| Subset sum, feasibility | `\|\|` | down | `dp[0] = true` |
| Count combinations | `+` | up, coins outer | `dp[0] = 1` |
| Count permutations | `+` | up, amount outer | `dp[0] = 1` |
| Minimum coins | `min` | up | `dp[0] = 0`, rest infinite |
| Bounded, `c` copies | `max` | down, binary split | `dp[0] = 0` |

Seven problems, one recurrence. This is why I keep saying knapsack is a family and not a problem.

## 4. A note on pseudo-polynomial time

$\mathcal{O}(nW)$ looks polynomial and is not, quite, and the distinction occasionally matters.

The input size is `n` items plus the number of bits it takes to write `W`. If `W` is $10^9$, writing it takes 30 bits, but the table has $10^9$ entries. So the cost is polynomial in the *value* of `W` and exponential in its *length*. That is called pseudo-polynomial, and it is why the knapsack problem is NP-hard while this algorithm exists and works fine.

Practically: this algorithm is great when `W` is up to about $10^7$ and useless when `W` is $10^{18}$. If a problem gives you an enormous capacity, the intended solution is something else, often [binary search on the answer](/posts/2017/01/binary-search-on-the-answer/) or a greedy argument.

## 5. When the state is a set

Now the second half. Sometimes the state is not "how many items" but "which items", and order matters so you cannot reduce it to a count.

If `n ≤ 20`, a set of items fits in a single integer. Bit `i` of the integer says whether item `i` is in the set. There are $2^n$ such integers, which is a million for `n = 20`: a perfectly reasonable table size.

The bit operations, since they are the whole vocabulary:

```cpp
int bit_vocabulary(int mask, int i, int n, int sub) {
    int added    = mask | (1 << i);            // add item i
    int cleared  = mask & ~(1 << i);           // remove item i
    int isIn     = mask & (1 << i);            // is item i in the set (non-zero if yes)
    int toggled  = mask ^ (1 << i);            // toggle item i
    int items    = __builtin_popcount(mask);   // how many items (popcount)
    bool full    = mask == (1 << n) - 1;       // is the set complete
    sub = (sub - 1) & mask;                    // iterate submasks, from mask down to 0
    return added + cleared + isIn + toggled + items + full + sub;   // keeps every value used
}
```

### The travelling salesman, properly

Visit all `n` cities exactly once starting from city 0, minimising total distance. Brute force is $\mathcal{O}(n!)$: at `n = 12` that is 479 million orderings and at `n = 15` it is a trillion.

The insight: to decide where to go next, you do not need the *order* you visited things in. You only need **which cities are visited** and **where you are now**. Two different orderings arriving at the same city with the same visited set have identical futures, so they can share one table entry.

1. **State:** `(mask, here)`, the set visited and the current city.
2. **Meaning:** `dp[mask][here]` is the cheapest way to have visited exactly `mask` and be standing at `here`.
3. **Base:** `dp[1][0] = 0`, only city 0 visited, standing at city 0.
4. **Order:** increasing `mask`, since adding a city only ever increases the integer.

```cpp
long long tsp(const vector<vector<int>>& dist) {
    int n = (int)dist.size();
    const long long INF = LLONG_MAX / 4;          // headroom, so adding cannot overflow
    vector<vector<long long>> dp(1 << n, vector<long long>(n, INF));
    dp[1][0] = 0;                                 // start at city 0

    for (int mask = 0; mask < (1 << n); ++mask) {
        for (int here = 0; here < n; ++here) {
            if (dp[mask][here] == INF) {
                continue;
            }
            if (!(mask & (1 << here))) {
                continue;
            }
            for (int nxt = 0; nxt < n; ++nxt) {
                if (mask & (1 << nxt)) {          // already visited
                    continue;
                }
                int nmask = mask | (1 << nxt);    // `new` is a C++ keyword
                long long cost = dp[mask][here] + dist[here][nxt];
                if (cost < dp[nmask][nxt]) {
                    dp[nmask][nxt] = cost;
                }
            }
        }
    }

    int full = (1 << n) - 1;
    long long best = INF;
    for (int c = 0; c < n; ++c) {
        best = min(best, dp[full][c] + dist[c][0]);
    }
    return best;
}
```

Cost: $2^n$ masks × `n` current cities × `n` next cities, so $\mathcal{O}(2^n n^2)$. At `n = 15` that is 7.4 million, instant. At `n = 20` it is a billion, borderline. Compare to $n!$ at 15: a trillion. The exponential did not go away, but $2^n$ is a very different exponential from $n!$.

```
  n      n!                2^n · n²
  10     3,628,800         102,400
  12     479,001,600       589,824
  15     1.3 × 10^12       7,372,800
  20     2.4 × 10^18       419,430,400
```

### Assignment problems

The same shape solves a large family: `n` people, `n` jobs, a cost for each pairing, minimise the total. The state is the set of jobs already filled, and the number of people assigned so far is just the popcount of the mask, so it does not need its own dimension.

```cpp
long long assignment(const vector<vector<int>>& cost) {
    int n = (int)cost.size();
    const long long INF = LLONG_MAX / 4;         // headroom, so adding cannot overflow
    vector<long long> dp(1 << n, INF);
    dp[0] = 0;
    for (int mask = 0; mask < (1 << n); ++mask) {
        if (dp[mask] == INF) {
            continue;
        }
        int person = __builtin_popcount(mask);    // how many are placed already
        if (person == n) {
            continue;
        }
        for (int job = 0; job < n; ++job) {
            if (mask & (1 << job)) {
                continue;
            }
            int nmask = mask | (1 << job);       // `new` is a C++ keyword
            dp[nmask] = min(dp[nmask], dp[mask] + cost[person][job]);
        }
    }
    return dp[(1 << n) - 1];
}
```

$\mathcal{O}(2^n n)$, and the trick of reading one dimension of the state off the popcount instead of storing it is worth remembering. It is the difference between a table of $2^n$ and a table of $2^n \times n$.

## 6. Reading the input size as a hint

This is worth stating plainly, because it turns problem-setting conventions into free information.

| `n` up to | The intended solution is probably |
|---|---|
| 10 to 12 | $\mathcal{O}(n!)$, brute force over permutations |
| 16 to 20 | $\mathcal{O}(2^n)$ or $\mathcal{O}(2^n n^2)$, bitmask DP |
| 40 | meet in the middle, two halves of $2^{20}$ |
| 100 to 500 | $\mathcal{O}(n^3)$, interval DP or Floyd-Warshall |
| 5,000 | $\mathcal{O}(n^2)$ |
| $10^5$ to $10^6$ | $\mathcal{O}(n \log n)$ |

When a problem says `n ≤ 20` it is not being cautious. It is telling you the answer involves subsets. That single reading has saved me more time than any algorithm in this series.

## The short version

- Knapsack is a family, not a problem. One recurrence covers 0/1, unbounded, subset sum, partitioning, counting change, minimum coins and bounded copies.
- Loop **down** over capacity for "each item once", **up** for "any number of times". That one direction is the entire difference.
- With `+` instead of `max` you are counting. Coins in the outer loop counts combinations; amount in the outer loop counts permutations. Both compile, and they answer different questions.
- $\mathcal{O}(nW)$ is pseudo-polynomial: fine to about $W = 10^7$, useless at $10^{18}$. A huge capacity means the intended solution is something else.
- When `n ≤ 20`, a set of items fits in one integer and the table has $2^n$ entries. That turns $\mathcal{O}(n!)$ into $\mathcal{O}(2^n n^2)$, which at `n = 15` is seven million instead of a trillion.
- For a path problem, the state is which items are done plus where you are now, not the order you did them in. Two orders reaching the same place with the same set have the same future.
- If part of the state can be read off the popcount, do not store it.
- The input size in the statement tells you which of these is intended. Read it before you think.

Next: graphs. How to store one, and the search that visits everything in order of distance.
