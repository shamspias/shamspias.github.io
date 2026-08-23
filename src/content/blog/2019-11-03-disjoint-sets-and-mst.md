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

```cpp
struct DSU {
    vector<int> parent, size;

    DSU(int n) : parent(n), size(n, 1) {
        for (int i = 0; i < n; i++) parent[i] = i;         // everyone is their own root
    }

    int find(int x) {
        while (parent[x] != x) {
            parent[x] = parent[parent[x]];                 // path halving
            x = parent[x];
        }
        return x;
    }

    bool unite(int a, int b) {                             // "union" is a C++ keyword
        int ra = find(a), rb = find(b);
        if (ra == rb) return false;                        // already together
        if (size[ra] < size[rb]) swap(ra, rb);             // attach the smaller under the bigger
        parent[rb] = ra;
        size[ra] += size[rb];
        return true;
    }
};
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

**Path compression.** During `find`, point nodes closer to the root. The line `parent[x] = parent[parent[x]]` is *path halving*: it points each node at its grandparent as it walks past, which halves the path length. It is a single line, needs no recursion, and is as good as full compression in practice.

The `unite` returning `false` when the two are already together (the method cannot be called `union`, since `union` is a C++ keyword) is a small thing that turns out to be useful constantly: it tells you the edge you just tried to add would have created a cycle.

## 3. The running time, and why nobody writes it down

With both optimisations, `m` operations on `n` elements cost $\mathcal{O}(m \, \alpha(n))$, where $\alpha$ is the inverse Ackermann function. For any `n` you could physically store, $\alpha(n) < 5$.

So in practice: **treat it as constant time.** I write $\mathcal{O}(1)$ in my notes and have never regretted it. The proof that it is not quite constant is a famous piece of work and completely irrelevant to using the thing.

## 4. What it is for

**Counting components dynamically.** DFS counts components in a static graph. Union-find counts them while edges are being *added*, which DFS cannot do without rerunning.

```cpp
struct DSU {                                               // as in section 2
    vector<int> parent, size;
    DSU(int n) : parent(n), size(n, 1) {
        for (int i = 0; i < n; i++) parent[i] = i;
    }
    int find(int x) {
        while (parent[x] != x) { parent[x] = parent[parent[x]]; x = parent[x]; }
        return x;
    }
    bool unite(int a, int b) {
        int ra = find(a), rb = find(b);
        if (ra == rb) return false;
        if (size[ra] < size[rb]) swap(ra, rb);
        parent[rb] = ra;
        size[ra] += size[rb];
        return true;
    }
};

vector<int> components_after_each_edge(int n, const vector<pair<int, int>>& edges) {
    DSU dsu(n);
    int count = n;
    vector<int> out;
    for (auto [u, v] : edges) {
        if (dsu.unite(u, v)) {
            count -= 1;                                    // two groups became one
        }
        out.push_back(count);
    }
    return out;
}
```

**Cycle detection while building.** If `unite` returns `false`, both endpoints were already connected, so this edge closes a cycle.

**Kruskal's algorithm**, next section.

**Offline connectivity queries.** A classic trick: if the problem *removes* edges over time, union-find cannot help, because it has no split operation. But process the queries in reverse and removals become additions. Reversing time to turn deletions into insertions is a genuinely useful move and it applies well beyond this data structure.

## 5. Minimum spanning trees

A **spanning tree** connects every vertex with no cycles, which takes exactly `V - 1` edges. A **minimum** spanning tree is the cheapest such set. This is the "lay cable to every house for the least money" problem.

### Kruskal's algorithm

Sort the edges by weight. Take each one if it connects two different components. Stop at `V - 1` edges.

```cpp
struct Edge {
    long long w;                                           // weight
    int u, v;
};

struct DSU {                                               // as in section 2
    vector<int> parent, size;
    DSU(int n) : parent(n), size(n, 1) {
        for (int i = 0; i < n; i++) parent[i] = i;
    }
    int find(int x) {
        while (parent[x] != x) { parent[x] = parent[parent[x]]; x = parent[x]; }
        return x;
    }
    bool unite(int a, int b) {
        int ra = find(a), rb = find(b);
        if (ra == rb) return false;
        if (size[ra] < size[rb]) swap(ra, rb);
        parent[rb] = ra;
        size[ra] += size[rb];
        return true;
    }
};

// edges is a list of (weight, u, v). Returns (total, chosen).
pair<long long, vector<Edge>> kruskal(int n, vector<Edge> edges) {
    DSU dsu(n);
    long long total = 0;
    vector<Edge> chosen;
    sort(edges.begin(), edges.end(), [](const Edge& a, const Edge& b) {
        return tie(a.w, a.u, a.v) < tie(b.w, b.u, b.v);    // by weight, then endpoints
    });
    for (const Edge& e : edges) {
        if (dsu.unite(e.u, e.v)) {                         // different components
            total += e.w;
            chosen.push_back(e);
            if ((int)chosen.size() == n - 1) {
                break;
            }
        }
    }
    return {total, chosen};
}
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

```cpp
// g[u] is a list of (neighbour, weight).
long long prim(const vector<vector<pair<int, long long>>>& g, int n, int start = 0) {
    vector<bool> seen(n, false);
    priority_queue<pair<long long, int>, vector<pair<long long, int>>,
                   greater<pair<long long, int>>> pq;      // min-heap, like heapq
    pq.push({0, start});
    long long total = 0;
    int taken = 0;
    while (!pq.empty() && taken < n) {
        auto [w, u] = pq.top();
        pq.pop();
        if (seen[u]) {
            continue;
        }
        seen[u] = true;
        total += w;
        taken += 1;
        for (auto [v, wt] : g[u]) {
            if (!seen[v]) {
                pq.push({wt, v});
            }
        }
    }
    return taken == n ? total : -1;                        // -1 if not connected
}
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

```cpp
struct Edge {
    long long w;                                           // weight
    int u, v;
};

struct DSU {                                               // as in section 2
    vector<int> parent, size;
    DSU(int n) : parent(n), size(n, 1) {
        for (int i = 0; i < n; i++) parent[i] = i;
    }
    int find(int x) {
        while (parent[x] != x) { parent[x] = parent[parent[x]]; x = parent[x]; }
        return x;
    }
    bool unite(int a, int b) {
        int ra = find(a), rb = find(b);
        if (ra == rb) return false;
        if (size[ra] < size[rb]) swap(ra, rb);
        parent[rb] = ra;
        size[ra] += size[rb];
        return true;
    }
};

long long cluster(int n, vector<Edge> edges, int k) {
    DSU dsu(n);
    int groups = n;
    sort(edges.begin(), edges.end(), [](const Edge& a, const Edge& b) {
        return tie(a.w, a.u, a.v) < tie(b.w, b.u, b.v);
    });
    for (const Edge& e : edges) {
        if (groups == k) {
            return e.w;                                    // the spacing between clusters
        }
        if (dsu.unite(e.u, e.v)) {
            groups -= 1;
        }
    }
    return 0;
}
```

**Redundant connection.** Given `V` edges on `V` vertices, find the one edge whose removal leaves a tree. It is the first edge whose `unite` returns `false`.

## 7. Two extensions worth knowing

**Union-find with parity**, for "these two things are on opposite sides" constraints. Store, alongside the parent, whether a node is the same as or opposite to its parent, and combine as you walk. That solves bipartite checking under edge insertions, and it solves systems of "a and b differ" constraints.

```cpp
struct DSUParity {
    vector<int> parent;
    vector<int> rel;                                       // 0 same as parent, 1 opposite

    DSUParity(int n) : parent(n), rel(n, 0) {
        for (int i = 0; i < n; i++) parent[i] = i;
    }

    // Returns (root, parity relative to the root).
    pair<int, int> find(int x) {
        int p = 0;
        while (parent[x] != x) {
            p ^= rel[x];
            x = parent[x];
        }
        return {x, p};
    }

    // differ is 1 if a and b must be on opposite sides.
    bool unite(int a, int b, int differ) {
        auto [ra, pa] = find(a);
        auto [rb, pb] = find(b);
        if (ra == rb) {
            return (pa ^ pb) == differ;                    // consistent with what we know?
        }
        parent[rb] = ra;
        rel[rb] = pa ^ pb ^ differ;
        return true;
    }
};
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
- `unite` returning false means the two were already connected, which is a cycle test you get for free.
- Kruskal's MST is: sort the edges, take each one whose endpoints are in different components, stop at `V - 1`. Four lines on top of union-find.
- Greedy is correct because of the cut property, and the proof is an exchange argument: adding the cheapest crossing edge creates a cycle you can break at something no cheaper.
- Prim's is Dijkstra with distance-from-the-tree. Kruskal for sparse graphs and for disconnected input, Prim for dense.
- It merges and never splits. If the problem deletes edges, process the queries in reverse so deletions become insertions.

Next: game theory. Nim, the losing positions, and the theorem that turns any impartial game into a single number.
