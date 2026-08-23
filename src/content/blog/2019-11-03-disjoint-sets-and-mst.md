---
title: "Disjoint Sets, and the Cheapest Way to Connect Everything"
description: "Twelve lines of code, two operations, and a running time so close to constant that nobody bothers with the difference. Then minimum spanning trees for free."
date: 2019-11-03
permalink: "/posts/2019/11/disjoint-sets-and-mst/"
lang: en
tags:
  - "algorithms"
  - "graphs"
  - "union find"
  - "minimum spanning tree"
  - "problem solving"
series: "Problem Solving From Zero"
seriesOrder: 15
math: true
---

*Union-find is the best value-per-line data structure there is. Twelve lines, two operations, and it answers "are these two things in the same group?" fast enough that its cost is usually not worth writing down. Once you have it, minimum spanning trees are a sort and a loop.*

## 1. The problem it solves

You have `n` things, initially each in its own group. Two operations, repeatedly and interleaved:

- **union(a, b)**: merge the group containing `a` with the group containing `b`.
- **find(a)**: which group is `a` in?

Sounds trivial. It is not, if you want both operations fast. Keeping a list per group makes `find` instant and `union` cost the size of a group. Keeping a group label per element makes `find` instant and `union` cost a full relabelling pass.

The trick is to store each group as a **tree**, with the root as its name. Then `union` is one pointer change, and `find` is a walk to the root.

## 2. The implementation

```python
class DSU:
    def __init__(self, n):
        self.parent = list(range(n))       # everyone is their own root
        self.size = [1] * n

    def find(self, x):
        while self.parent[x] != x:
            self.parent[x] = self.parent[self.parent[x]]   # path halving
            x = self.parent[x]
        return x

    def union(self, a, b):
        ra, rb = self.find(a), self.find(b)
        if ra == rb:
            return False                  # already together
        if self.size[ra] < self.size[rb]:
            ra, rb = rb, ra               # attach the smaller under the bigger
        self.parent[rb] = ra
        self.size[ra] += self.size[rb]
        return True
```

Twelve lines. Two optimisations are doing all the work, and both are one line each.

**Union by size.** Always hang the smaller tree under the larger one. Without this, unions in a bad order build a linked list and `find` becomes $\mathcal{O}(n)$.

```
  without union by size            with union by size
  union(1,0) union(2,1) ...

    3                                  0
    |                                / | \
    2                               1  2  3
    |
    1        find(3) walks 3        find(3) walks 1
    |
    0
```

**Path compression.** During `find`, point nodes closer to the root. The line `self.parent[x] = self.parent[self.parent[x]]` is *path halving*: it points each node at its grandparent as it walks past, which halves the path length. It is a single line, needs no recursion, and is as good as full compression in practice.

The `union` returning `False` when the two are already together is a small thing that turns out to be useful constantly: it tells you the edge you just tried to add would have created a cycle.

## 3. The running time, and why nobody writes it down

With both optimisations, `m` operations on `n` elements cost $\mathcal{O}(m \, \alpha(n))$, where $\alpha$ is the inverse Ackermann function. For any `n` you could physically store, $\alpha(n) < 5$.

So in practice: **treat it as constant time.** I write $\mathcal{O}(1)$ in my notes and have never regretted it. The proof that it is not quite constant is a famous piece of work and completely irrelevant to using the thing.

## 4. What it is for

**Counting components dynamically.** DFS counts components in a static graph. Union-find counts them while edges are being *added*, which DFS cannot do without rerunning.

```python
def components_after_each_edge(n, edges):
    dsu = DSU(n)
    count = n
    out = []
    for u, v in edges:
        if dsu.union(u, v):
            count -= 1                    # two groups became one
        out.append(count)
    return out
```

**Cycle detection while building.** If `union` returns `False`, both endpoints were already connected, so this edge closes a cycle.

**Kruskal's algorithm**, next section.

**Offline connectivity queries.** A classic trick: if the problem *removes* edges over time, union-find cannot help, because it has no split operation. But process the queries in reverse and removals become additions. Reversing time to turn deletions into insertions is a genuinely useful move and it applies well beyond this data structure.

## 5. Minimum spanning trees

A **spanning tree** connects every vertex with no cycles, which takes exactly `V - 1` edges. A **minimum** spanning tree is the cheapest such set. This is the "lay cable to every house for the least money" problem.

### Kruskal's algorithm

Sort the edges by weight. Take each one if it connects two different components. Stop at `V - 1` edges.

```python
def kruskal(n, edges):
    """edges is a list of (weight, u, v). Returns (total, chosen)."""
    dsu = DSU(n)
    total, chosen = 0, []
    for w, u, v in sorted(edges):
        if dsu.union(u, v):               # different components
            total += w
            chosen.append((u, v, w))
            if len(chosen) == n - 1:
                break
    return total, chosen
```

$\mathcal{O}(E \log E)$, which is the sort; the union-find part is effectively free. That is the whole algorithm, and union-find is what makes it four lines instead of forty.

```
  edges by weight

  (1, A, B)   take    A-B
  (2, B, C)   take    A-B-C
  (2, A, C)   skip    A and C already connected
  (3, C, D)   take    A-B-C-D
  (4, A, D)   skip    already connected
  (5, D, E)   take    A-B-C-D-E     4 edges, 5 vertices: done

  total: 1 + 2 + 3 + 5 = 11
```

### Why greedy works here

Worth a paragraph, since [part 7](/posts/2017/04/greedy-when-it-works/) insisted on proofs. The relevant fact is the **cut property**: for any way of splitting the vertices into two halves, the cheapest edge crossing the split is in some minimum spanning tree.

The exchange argument: take an MST that does not contain that cheapest crossing edge `e`. Adding `e` creates a cycle, and that cycle must cross the split somewhere else, at an edge `f` that is at least as expensive. Swap `e` in and `f` out: still spanning, still a tree, and no more expensive. So an MST containing `e` exists.

Kruskal's takes the cheapest edge joining two components every time, which is exactly a cheapest edge across the cut separating one component from the rest. So each choice is safe.

### Prim's algorithm

The other one. Grow a single tree: repeatedly add the cheapest edge from the tree to a vertex outside it. Structurally it is Dijkstra with "distance from the tree" instead of "distance from the start".

```python
import heapq

def prim(g, n, start=0):
    """g[u] is a list of (neighbour, weight)."""
    seen = [False] * n
    pq = [(0, start)]
    total = 0
    taken = 0
    while pq and taken < n:
        w, u = heapq.heappop(pq)
        if seen[u]:
            continue
        seen[u] = True
        total += w
        taken += 1
        for v, wt in g[u]:
            if not seen[v]:
                heapq.heappush(pq, (wt, v))
    return total if taken == n else None      # None if not connected
```

$\mathcal{O}(E \log V)$.

| | Kruskal | Prim |
|---|---|---|
| Needs | edge list, sorted | adjacency list, a heap |
| Cost | $\mathcal{O}(E \log E)$ | $\mathcal{O}(E \log V)$ |
| Better for | sparse graphs | dense graphs |
| Handles disconnected input | yes, gives a forest | no, only reaches one component |
| Easier to write | yes, with union-find | comparable |

I use Kruskal by default. The edge list is usually how the input arrives, the sort is one call, and the disconnected case falls out for free.

## 6. Three problems that are secretly union-find

**The minimum bottleneck path.** Find a route between two vertices minimising the *largest* single edge on it. Sort the edges and add them one at a time until the two vertices are connected; the last edge added is the answer. This is also exactly the maximum edge on the path between them in the MST, which is a fact worth knowing.

**Clustering into `k` groups.** Run Kruskal but stop when `k` components remain. That is single-linkage clustering, and the largest edge you refused to add is the separation between clusters.

```python
def cluster(n, edges, k):
    dsu = DSU(n)
    groups = n
    for w, u, v in sorted(edges):
        if groups == k:
            return w                      # the spacing between clusters
        if dsu.union(u, v):
            groups -= 1
    return 0
```

**Redundant connection.** Given `V` edges on `V` vertices, find the one edge whose removal leaves a tree. It is the first edge whose `union` returns `False`.

## 7. Two extensions worth knowing

**Union-find with parity**, for "these two things are on opposite sides" constraints. Store, alongside the parent, whether a node is the same as or opposite to its parent, and combine as you walk. That solves bipartite checking under edge insertions, and it solves systems of "a and b differ" constraints.

```python
class DSUParity:
    def __init__(self, n):
        self.parent = list(range(n))
        self.rel = [0] * n                # 0 same as parent, 1 opposite

    def find(self, x):
        """Returns (root, parity relative to the root)."""
        p = 0
        while self.parent[x] != x:
            p ^= self.rel[x]
            x = self.parent[x]
        return x, p

    def union(self, a, b, differ):
        """differ is 1 if a and b must be on opposite sides."""
        ra, pa = self.find(a)
        rb, pb = self.find(b)
        if ra == rb:
            return (pa ^ pb) == differ    # consistent with what we know?
        self.parent[rb] = ra
        self.rel[rb] = pa ^ pb ^ differ
        return True
```

**Rollback**, for when you need to undo unions. Skip path compression, record every change on a stack, and pop to undo. Each operation becomes $\mathcal{O}(\log n)$ rather than nearly constant, which is the price of being able to go back. This is what "DSU on tree" and offline dynamic connectivity are built on.

## 8. Mistakes

**Forgetting union by size.** Works, then times out on a large adversarial input. Both one-liners are load-bearing.

**Recursive `find` on 200,000 elements.** Stack overflow. The iterative path-halving version above has no such problem, which is why I wrote it that way.

**Comparing `parent[a] == parent[b]` instead of `find(a) == find(b)`.** Two nodes can be in the same group with different immediate parents. Always compare roots.

**Assuming it can split.** Union-find merges. It has no un-merge. If the problem removes edges, reverse the timeline or use a different structure.

## The short version

- Union-find stores each group as a tree named by its root. `union` is one pointer change, `find` is a walk up.
- Two one-line optimisations do all the work: hang the smaller tree under the larger, and point nodes at their grandparents while walking. Skip either and it degrades to a linked list.
- The real cost involves the inverse Ackermann function, which is under 5 for any storable `n`. Treat it as constant.
- `union` returning false means the two were already connected, which is a cycle test you get for free.
- Kruskal's MST is: sort the edges, take each one whose endpoints are in different components, stop at `V - 1`. Four lines on top of union-find.
- Greedy is correct because of the cut property, and the proof is an exchange argument: adding the cheapest crossing edge creates a cycle you can break at something no cheaper.
- Prim's is Dijkstra with distance-from-the-tree. Kruskal for sparse graphs and for disconnected input, Prim for dense.
- It merges and never splits. If the problem deletes edges, process the queries in reverse so deletions become insertions.

Next: game theory. Nim, the losing positions, and the theorem that turns any impartial game into a single number.
