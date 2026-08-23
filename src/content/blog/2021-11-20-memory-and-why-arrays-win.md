---
title: "Memory: Why the Array Wins Even When the Step Count Says Otherwise"
seoTitle: "Why the Array Wins: Memory and the Cache"
description: "Big-O counts steps and assumes every step costs the same. It does not. A cache miss costs a hundred steps, and that is why a linked list loses to an array."
date: 2021-11-20
permalink: "/posts/2021/11/memory-and-why-arrays-win/"
lang: en
tags:
  - "algorithms"
  - "memory"
  - "cache"
  - "performance"
  - "problem solving"
series: "Problem Solving From Zero"
seriesOrder: 21
math: true
---

*Every part of this series has counted steps and treated them as equal. They are not. Reading a number your processor already holds is roughly a hundred times cheaper than reading one from main memory, and that factor of a hundred is invisible to Big-O. This last part is about the constant that the notation throws away, which is the constant that decides most real performance.*

## 1. The number that matters

Approximate costs, in units of a single arithmetic operation:

```
  add two registers            1
  read from L1 cache           3
  read from L2 cache          12
  read from L3 cache          40
  read from main memory      200
  read from an SSD        150,000
  read from a spinning disk  10,000,000
```

Two hundred to one, between the fastest and slowest read your processor does routinely. [Part 2](/posts/2016/04/big-o-without-the-maths/) said Big-O throws away constant factors because they do not survive a change of computer. This one does survive, it is large, and it is the reason two algorithms with identical step counts can differ by an order of magnitude.

## 2. Cache lines, and the one rule

Memory does not move one number at a time. It moves **cache lines**, typically 64 bytes, which is eight 64-bit integers or sixteen 32-bit ones.

So the first read of a line costs 200 and the next seven cost about 3 each. Walking an array in order pays the full price once per eight elements. Jumping around pays it every time.

```
  sequential walk over an array of 8-byte integers

  |----------- one 64-byte cache line -----------|
  [ a0 a1 a2 a3 a4 a5 a6 a7 ][ a8 a9 ... ]
    ^                          ^
   miss, 200                  miss, 200
    then 7 hits at 3 each

  average per element: (200 + 7*3) / 8  =  28

  random access over the same array

  [ .. a5 .. ][ .. a91 .. ][ .. a17 .. ]
      miss        miss         miss

  average per element: 200
```

Seven times slower, same number of reads. That is the entire subject in one diagram, and the rule that follows is short:

> **Touch memory in the order it is laid out.**

## 3. The array against the linked list

The classic demonstration. Both hold `n` numbers. Summing either is $\mathcal{O}(n)$.

```
  array: one block, contiguous

  [ 3 ][ 7 ][ 1 ][ 9 ][ 4 ][ 2 ]
   one cache line brings eight of them

  linked list: nodes wherever the allocator put them

  [ 3 | * ]---------------> [ 7 | * ]----+
                                          |
   +--------------------------------------+
   |
   v
  [ 1 | * ]------> [ 9 | * ]
```

Each list node needs its own cache line, plus 8 bytes of pointer per 8 bytes of payload, so half the memory traffic carries no data. In practice, summing a linked list of a million integers is five to ten times slower than summing an array of the same, and the step counts are identical.

Which is why: **in competitive programming, use arrays.** Use an array-backed queue, an array-backed heap, an adjacency list stored as arrays. The pointer-based data structure from the textbook is the right shape for reasoning and the wrong shape for the machine.

Concretely, for graphs, this layout is what fast solutions use:

```cpp
// adjacency stored as flat arrays: one contiguous block, no per-node objects
pair<vector<int>, vector<int>> build_flat(int n, const vector<pair<int, int>>& edges) {
    vector<int> deg(n + 1, 0);
    for (auto [u, v] : edges) {
        deg[u] += 1;
        deg[v] += 1;
    }
    vector<int> start(n + 2, 0);
    for (int i = 1; i <= n; i++)
        start[i + 1] = start[i] + deg[i];
    vector<int> adj(2 * edges.size(), 0);
    vector<int> fill = start;                 // running write position per vertex
    for (auto [u, v] : edges) {
        adj[fill[u]] = v; fill[u] += 1;
        adj[fill[v]] = u; fill[v] += 1;
    }
    return {start, adj};
}

// neighbours of u are adj[start[u] .. start[u + 1] - 1], all contiguous
```

That is called compressed sparse row, and it is the layout every serious graph library uses.

## 4. Row-major order, and the loop that is ten times slower

The most famous example, and worth doing yourself once so it is not just a story.

A two-dimensional array in C, C++ or Go is stored **row by row**. A `vector<vector<double>>` is not one block, each row is its own allocation, so the rule holds inside a row and a column walk is worse still. So `m[i][j]` and `m[i][j+1]` are neighbours in memory, while `m[i][j]` and `m[i+1][j]` are a whole row apart.

```cpp
// fast: walks memory in order
long long sum_fast(const vector<vector<int>>& m, int n) {
    long long total = 0;
    for (int i = 0; i < n; i++)
        for (int j = 0; j < n; j++)
            total += m[i][j];
    return total;
}

// slow: jumps a row every step
long long sum_slow(const vector<vector<int>>& m, int n) {
    long long total = 0;
    for (int j = 0; j < n; j++)
        for (int i = 0; i < n; i++)
            total += m[i][j];
    return total;
}
```

Same steps. Same answer. On a 2000 by 2000 matrix of doubles, the second is commonly five to ten times slower in a compiled language, because every read is a fresh cache line and the array is far too big to keep resident.

**The rule: the innermost loop should vary the last index.** For matrix multiplication that means reordering the classic triple loop:

```cpp
// the naive order: k innermost walks B down a column
void matmul_ijk(const vector<vector<double>>& A, const vector<vector<double>>& B,
                vector<vector<double>>& C, int n) {
    for (int i = 0; i < n; i++)
        for (int j = 0; j < n; j++)
            for (int k = 0; k < n; k++)
                C[i][j] += A[i][k] * B[k][j];
}

// ikj order: the innermost loop walks both A's row and B's row
void matmul_ikj(const vector<vector<double>>& A, const vector<vector<double>>& B,
                vector<vector<double>>& C, int n) {
    for (int i = 0; i < n; i++)
        for (int k = 0; k < n; k++) {
            double aik = A[i][k];                 // hoisted out of the inner loop
            for (int j = 0; j < n; j++)
                C[i][j] += aik * B[k][j];
        }
}
```

Identical arithmetic, identical $\mathcal{O}(n^3)$, and the second is several times faster because every innermost access is sequential. This is the single most-cited example in the subject and it is genuinely that stark.

## 5. Where this bites in the rest of the series

**Sorting.** Merge sort and quicksort are both $\mathcal{O}(n \log n)$, and quicksort is usually faster in practice. Part of that is a smaller instruction count, and part is that partitioning walks the array from both ends sequentially while merging reads two arrays and writes a third, tripling the streams the cache must hold. [Part 4](/posts/2016/10/sorting-what-to-know/) mentioned real sorts switching to insertion sort for small chunks; the cache is part of why.

**Hash maps.** $\mathcal{O}(1)$ lookup, and the constant is a cache miss, because a hash sends you to an essentially random location. A sorted array plus binary search is $\mathcal{O}(\log n)$ with `log n` misses, but for small `n` its sequential locality can win outright. Under about a hundred elements, a flat array scanned linearly frequently beats a hash map, which is why compilers and interpreters use small arrays for small symbol tables.

**BFS against DFS.** BFS's queue is written at one end and read at the other, both sequential. DFS's stack is written and read at the same end, which is even better for the cache. Both, however, follow edges to arbitrary vertices, and that is the miss you cannot avoid. It is the reason graph algorithms are memory-bound rather than compute-bound, and the reason vertex reordering, relabelling vertices so neighbours have nearby indices, is a real optimisation.

**Dynamic programming.** A DP over a two-dimensional table is a cache exercise. Filling row by row is sequential; filling column by column on a row-major table is a miss per cell. The one-row space optimisation from [part 10](/posts/2018/02/dp-as-a-table/) is not only about memory: a single row usually fits in L2, so it is faster as well as smaller. That is my favourite instance of two goals pointing the same way.

**Segment trees.** The iterative bottom-up form in [part 19](/posts/2021/03/fenwick-and-segment-trees/) beats the recursive form for two reasons: no call overhead, and the array layout means the nodes on a path are close together, so several of them share a cache line near the leaves.

## 6. Four practical techniques

**Structure of arrays, not array of structures.** If you process one field of many records, store each field in its own array. Then a pass over that field touches only the bytes it needs.

```
  array of structures: {x,y,z}{x,y,z}{x,y,z}
  a pass over x reads every y and z too, wasting two thirds of every line

  structure of arrays: {x,x,x}{y,y,y}{z,z,z}
  a pass over x reads only x
```

**Use the smallest type that fits.** An `int32` array holds twice as many elements per cache line as `int64`. For a sieve up to $10^8$, a byte array is 100 MB and a bit array is 12 MB, and the bit array is faster despite the extra shifting because it fits in cache where the other does not. That is a case where doing *more* arithmetic is faster, which Big-O cannot express at all.

**Block or tile the loops.** Instead of a full pass over a huge array, process it in chunks that fit in cache and finish all the work on each chunk before moving on. This is the standard technique behind fast matrix multiplication and it can be a factor of two or three.

**Reorder the data once, then read it many times.** If you will scan something a thousand times, spend $\mathcal{O}(n \log n)$ sorting it into the access order first. The sort pays for itself immediately.

## 7. Measure, do not guess

Everything above is a tendency, not a law. Your processor's line size, cache sizes, prefetcher and out-of-order execution all interfere, and so does your language. In C++ a `vector<int>` really is one contiguous block of machine integers, so everything above shows up directly, but the containers can still surprise you: `vector<vector<int>>` is one allocation per row rather than one block, `vector<bool>` packs bits and pays a shift on every access, and `std::list` or `std::map` hands you exactly the scattered-node layout this part warns about.

So the honest procedure:

1. **Get the complexity right first.** No amount of cache tuning saves a quadratic algorithm on a million elements. This is the order that matters, and it is why this part is last in the series rather than first.
2. **Then measure.** Time it. Change one thing. Time it again.
3. **Then look at layout**, if it is still too slow and the complexity is already right.

The order is what I want to leave you with. Cache effects are a factor of two to ten. Choosing $n \log n$ over $n^2$ at a million elements is a factor of fifty thousand. Do the big one first, always.

## 8. The series, in one page

Twenty parts, and this is what I would keep:

- **Count the steps** before writing anything, and compare against a hundred million.
- **The input size tells you the intended algorithm.** `n ≤ 20` means subsets. `n ≤ 5000` means quadratic. `n ≤ 10^6` means one pass or a sort.
- **Better algorithms come from noticing repeated work and refusing to repeat it.** Prefix sums, memoisation, and the two-pointer walk are all that one idea.
- **When a counter only moves one way, bound its total movement** instead of multiplying the loops. That is amortised analysis and it is everywhere.
- **Guess the answer and test it** when a problem says "minimise the maximum". Binary search on the answer is the highest-value technique in the series.
- **For greedy, find the exchange argument or find the counterexample.** "It passed the samples" is not knowing.
- **For DP, answer four questions in words**: the state, the meaning of one entry, the base case, the fill order. Then the code is mechanical.
- **When a problem says "minimum number of moves", ask what a situation is and what a move does.** That gives you a graph even when none was mentioned.
- **Write the brute force.** To find counterexamples, to check a pattern, to verify a fast solution. It is the cheapest tool here and the one most often skipped.
- **Then, and only then, think about the machine.**

## The short version

- Big-O assumes every step costs the same. A main-memory read costs about two hundred times a register operation, and that constant does not go away on a faster computer.
- Memory moves in 64-byte lines, so a sequential walk pays the miss once per eight integers and a random walk pays it every time. Touch memory in the order it is laid out.
- Arrays beat linked lists at identical step counts, by five to ten times, because list nodes are scattered and half their bytes are pointers. In contests, use arrays for everything, including queues, heaps and adjacency lists.
- Two-dimensional arrays are stored row by row. The innermost loop must vary the last index, and the `ikj` matrix multiplication order is several times faster than `ijk` for that reason alone.
- Store one array per field rather than an array of records when you process fields separately. Use the smallest type that fits: a bit sieve beats a byte sieve because it fits in cache, despite doing more arithmetic.
- Get the complexity right first. Cache work buys a factor of two to ten; choosing $n \log n$ over $n^2$ at a million elements buys fifty thousand.
- Then measure. Change one thing. Measure again.
