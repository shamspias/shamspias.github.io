---
title: "Fenwick Trees and Segment Trees: When Updates and Queries Interleave"
seoTitle: "Fenwick Trees and Segment Trees"
description: "Prefix sums break the moment an element changes. Two structures answer range questions and point updates in logarithmic time, and one of them is nine lines."
date: 2021-03-27
permalink: "/posts/2021/03/fenwick-and-segment-trees/"
lang: en
tags:
  - "algorithms"
  - "data structures"
  - "fenwick tree"
  - "segment tree"
  - "problem solving"
series: "Problem Solving From Zero"
seriesOrder: 19
math: true
---

*A prefix-sum array answers range queries in constant time and falls apart the instant an element changes: every prefix behind it is now wrong. Two structures fix that. The Fenwick tree is nine lines and does sums. The segment tree is thirty and does anything associative. Learn the first for speed of writing and the second for range of use.*

## 1. The gap

[Part 3](/posts/2016/07/prefix-sums-and-two-pointers/) gave prefix sums: build in $\mathcal{O}(n)$, query in $\mathcal{O}(1)$. Now suppose updates are mixed in with queries.

| | Plain array | Prefix sums | Fenwick or segment tree |
|---|---|---|---|
| Update one element | $\mathcal{O}(1)$ | $\mathcal{O}(n)$ | $\mathcal{O}(\log n)$ |
| Query a range | $\mathcal{O}(n)$ | $\mathcal{O}(1)$ | $\mathcal{O}(\log n)$ |

With $10^5$ of each operation, the two extremes are both $10^{10}$ steps and the middle column is $10^5 \times 17$, which is nothing. That is the whole motivation.

## 2. The Fenwick tree

Also called a binary indexed tree. Nine lines, and it is the structure I write most often.

```python
class Fenwick:
    def __init__(self, n):
        self.n = n
        self.t = [0] * (n + 1)                # 1-indexed

    def add(self, i, v):
        """Add v at position i (1-indexed)."""
        while i <= self.n:
            self.t[i] += v
            i += i & -i                       # next index that covers i

    def prefix(self, i):
        """Sum of positions 1..i."""
        s = 0
        while i > 0:
            s += self.t[i]
            i -= i & -i                       # strip the lowest set bit
        return s

    def range_sum(self, l, r):
        return self.prefix(r) - self.prefix(l - 1)
```

Both loops are $\mathcal{O}(\log n)$ because each step removes or adds one bit.

### What `i & -i` does, and why the structure works

`i & -i` isolates the lowest set bit of `i`. In two's complement, `-i` is `~i + 1`, which flips every bit above the lowest set bit and leaves that bit set, so the `and` keeps exactly it.

```
  i = 12 = 1100
 -i      = 0100  (in two's complement)
  i & -i = 0100 = 4
```

The structure: `t[i]` holds the sum of the `i & -i` elements ending at `i`. So `t[8]` covers positions 1 to 8, `t[12]` covers 9 to 12, `t[6]` covers 5 to 6, and `t[7]` covers just 7.

```
  index    1   2   3   4   5   6   7   8
  covers   1  1-2  3  1-4  5  5-6  7  1-8

  t[8] ------------------------------->  1..8
  t[4] --------------->  1..4
  t[2] ----->  1..2
  t[1] -> 1
                        t[6] ----->  5..6
                        t[5] -> 5
                                    t[7] -> 7
                              t[3] -> 3
```

A prefix query for 7 adds `t[7]` (position 7), then `t[6]` (5 to 6), then `t[4]` (1 to 4). Three terms, and `7 = 111` has three bits. That is the whole design: every prefix is a sum of $\mathcal{O}(\log n)$ blocks, one per set bit.

Two practical notes. **It is one-indexed**, and fighting that produces off-by-one bugs; keep the internal indexing at 1 and convert at the boundary. And it can be built in $\mathcal{O}(n)$ rather than by `n` calls to `add`:

```python
def build(self, values):
    """values is 1-indexed with a dummy at 0. O(n)."""
    self.t = values[:]
    for i in range(1, self.n + 1):
        j = i + (i & -i)
        if j <= self.n:
            self.t[j] += self.t[i]
```

### What it can and cannot do

It needs an operation with an **inverse**, because `range_sum` is a subtraction of two prefixes. Sums yes, exclusive or yes, products modulo a prime yes. **Minimum, no**: you cannot recover the minimum of a range from the minima of two prefixes. For minima you need a segment tree.

## 3. Range update, point query

The same structure, used differently. Keep a difference array in the Fenwick tree, exactly as in [part 3](/posts/2016/07/prefix-sums-and-two-pointers/), and the roles invert.

```python
class RangeAddPointQuery:
    def __init__(self, n):
        self.f = Fenwick(n)

    def add_range(self, l, r, v):
        self.f.add(l, v)
        self.f.add(r + 1, -v)                 # if r+1 <= n

    def get(self, i):
        return self.f.prefix(i)               # accumulated changes up to i
```

For both range update and range query, use two Fenwick trees, or a segment tree with lazy propagation.

## 4. The segment tree

More code, and it handles any **associative** operation: sum, minimum, maximum, greatest common divisor, matrix product. No inverse required.

```python
class SegTree:
    def __init__(self, values, identity=0, combine=lambda a, b: a + b):
        self.n = len(values)
        self.identity = identity
        self.combine = combine
        self.t = [identity] * (2 * self.n)
        self.t[self.n:] = values                          # leaves
        for i in range(self.n - 1, 0, -1):                # internal nodes
            self.t[i] = combine(self.t[2 * i], self.t[2 * i + 1])

    def update(self, i, v):
        i += self.n
        self.t[i] = v
        i //= 2
        while i:
            self.t[i] = self.combine(self.t[2 * i], self.t[2 * i + 1])
            i //= 2

    def query(self, l, r):
        """Combine over [l, r), half-open."""
        res_l = res_r = self.identity
        l += self.n
        r += self.n
        while l < r:
            if l & 1:
                res_l = self.combine(res_l, self.t[l]); l += 1
            if r & 1:
                r -= 1; res_r = self.combine(self.t[r], res_r)
            l //= 2
            r //= 2
        return self.combine(res_l, res_r)
```

This is the iterative, bottom-up form. It is shorter than the recursive one, has no stack depth to worry about, and is faster. Three things to note.

**The tree is stored in an array of size `2n`**, with leaves at `n` to `2n-1` and node `i`'s children at `2i` and `2i+1`. No pointers, no allocation per node.

**Queries are half-open**, `[l, r)`. Pick one convention and keep it everywhere; mixing conventions between the tree and the caller is the main source of bugs here.

**The two accumulators are not decoration.** `res_l` and `res_r` are kept separate and combined at the end, in that order, so the operation need not be commutative. That matters for matrix products and for string concatenation. If you only ever do sums it looks redundant, and the day you need a non-commutative combine you will be glad it is there.

Using it:

```python
sums = SegTree([1, 2, 3, 4, 5])
minima = SegTree([1, 2, 3, 4, 5], identity=float('inf'), combine=min)
gcds = SegTree([12, 18, 24], identity=0, combine=gcd)
```

The identity has to be the neutral element of the operation: 0 for sums, infinity for minima, 0 for gcd (since `gcd(0, x) = x`), 1 for products. Get it wrong and empty ranges poison the answer.

```
  values          1   2   3   4   5   0   0   0
  leaves        [ 8] [9] [10][11][12][13][14][15]

  internal      [4]=3   [5]=7   [6]=5   [7]=0
                    [2]=10          [3]=5
                            [1]=15

  query [1, 4) : leaves 9, 10, 11
    l=9 is odd  -> take t[9]=2,  l=10
    r=12 is even
    l=5, r=6:  l odd -> take t[5]=7, l=6
    l=3, r=3:  stop
    total 2 + 7 = 9   which is 2 + 3 + 4
```

## 5. Lazy propagation, in one paragraph and some code

For range updates *and* range queries, a segment tree needs to defer work. Store a pending operation at each node and push it down only when you need to look inside.

```python
class LazySum:
    """Range add, range sum. Recursive, for clarity."""
    def __init__(self, n):
        self.n = n
        self.t = [0] * (4 * n)
        self.lazy = [0] * (4 * n)

    def _push(self, node, l, r):
        if self.lazy[node]:
            self.t[node] += self.lazy[node] * (r - l + 1)
            if l != r:
                self.lazy[2 * node] += self.lazy[node]
                self.lazy[2 * node + 1] += self.lazy[node]
            self.lazy[node] = 0

    def add(self, node, l, r, ql, qr, v):
        self._push(node, l, r)
        if qr < l or r < ql:
            return
        if ql <= l and r <= qr:
            self.lazy[node] += v
            self._push(node, l, r)
            return
        mid = (l + r) // 2
        self.add(2 * node, l, mid, ql, qr, v)
        self.add(2 * node + 1, mid + 1, r, ql, qr, v)
        self.t[node] = self.t[2 * node] + self.t[2 * node + 1]

    def query(self, node, l, r, ql, qr):
        self._push(node, l, r)
        if qr < l or r < ql:
            return 0
        if ql <= l and r <= qr:
            return self.t[node]
        mid = (l + r) // 2
        return (self.query(2 * node, l, mid, ql, qr)
                + self.query(2 * node + 1, mid + 1, r, ql, qr))
```

$\mathcal{O}(\log n)$ per operation. The array is `4n` rather than `2n` because the recursive layout is not perfectly packed. `_push` at the top of both operations is the rule: **never read a node before pushing its pending work down.**

Lazy propagation is where segment trees get genuinely fiddly. My advice: write it once, keep it in a file, and adapt it rather than rewriting from memory under time pressure.

## 6. Choosing

| Need | Use |
|---|---|
| Point update, prefix or range sum | Fenwick, nine lines |
| Range update, point query | Fenwick on a difference array |
| Range update, range sum | two Fenwicks, or a lazy segment tree |
| Point update, range minimum or maximum | segment tree |
| Any associative operation | segment tree |
| Static array, range minimum, many queries | sparse table, $\mathcal{O}(1)$ per query |
| 2-D point update, rectangle sum | 2-D Fenwick |
| Frequencies over values, `k`-th smallest | Fenwick over values, descend the tree |

**Sparse table** is worth knowing for the static case: precompute the answer for every power-of-two length, then any range is covered by two overlapping blocks. $\mathcal{O}(n \log n)$ to build, $\mathcal{O}(1)$ per query, no updates allowed.

```python
def build_sparse(a):
    n = len(a)
    k = n.bit_length()
    table = [a[:]]
    j = 1
    while (1 << j) <= n:
        prev = table[-1]
        row = [min(prev[i], prev[i + (1 << (j - 1))])
               for i in range(n - (1 << j) + 1)]
        table.append(row)
        j += 1
    return table

def query_sparse(table, l, r):
    """min over [l, r], inclusive."""
    j = (r - l + 1).bit_length() - 1
    return min(table[j][l], table[j][r - (1 << j) + 1])
```

That works for minimum and maximum because overlapping blocks are harmless. It does **not** work for sums, where the overlap would be counted twice.

## 7. The problem shapes these solve

**Counting inversions.** How many pairs are out of order? Walk left to right, and for each element ask how many already-seen elements are larger. A Fenwick tree over values answers that in $\mathcal{O}(\log n)$ each, so $\mathcal{O}(n \log n)$ overall.

```python
def inversions(a):
    order = {v: i + 1 for i, v in enumerate(sorted(set(a)))}   # compress
    f = Fenwick(len(order))
    total = 0
    for x in reversed(a):
        total += f.prefix(order[x] - 1)      # already seen and smaller
        f.add(order[x], 1)
    return total
```

The **coordinate compression** in the first line is a technique in its own right: values up to $10^9$ become indices up to `n`, so the tree is `n` wide instead of $10^9$.

**The `k`-th smallest, with insertions and deletions.** Keep counts in a Fenwick tree over compressed values, then descend it to find the position where the running total reaches `k`. $\mathcal{O}(\log n)$.

**Interval overlaps, stabbing counts, and the sweep line.** Sort events by coordinate, sweep left to right, and keep the active set in a Fenwick or segment tree.

## 8. Mistakes

**Zero-indexing a Fenwick tree.** `i & -i` is 0 when `i` is 0, so the loop never moves. Keep it one-indexed internally.

**The wrong identity in a segment tree.** 0 for a minimum tree makes every query return 0.

**Mixing inclusive and half-open ranges.** Pick one and write it in the docstring.

**Reading a lazy node without pushing.** Stale values, and they surface only on the second overlapping update.

**Forgetting to compress coordinates.** A tree sized $10^9$ is not going to allocate.

**A sparse table for sums.** The overlap double-counts. Only for idempotent operations such as min, max and gcd.

## The short version

- Prefix sums die when an element changes. These structures make both update and query $\mathcal{O}(\log n)$, which turns $10^{10}$ into a couple of million.
- The Fenwick tree is nine lines. `t[i]` covers the `i & -i` elements ending at `i`, so every prefix is a sum of one block per set bit.
- It needs an operation with an inverse, because a range is the difference of two prefixes. Sums and exclusive or yes, minimum no.
- Put a difference array in a Fenwick tree and it does range update with point query instead.
- The segment tree handles any associative operation, no inverse needed. Store it in a `2n` array, iterate bottom-up, and keep the left and right accumulators separate so non-commutative operations work.
- The identity must be the neutral element: 0 for sums, infinity for minima, 1 for products, 0 for gcd.
- Lazy propagation is the fiddly part. Push before you read, and keep a known-good copy rather than rewriting it under time pressure.
- Compress coordinates when values are large and few. A tree over $10^9$ values will not allocate; a tree over `n` distinct ones will.
- For a static array with many range-minimum queries, a sparse table gives constant-time answers. Not for sums: the overlap double-counts.

Next: machine learning algorithms written by hand, because four of them fit in forty lines each and understanding them beats importing them.
