---
title: "Shortest Paths: Dijkstra, Bellman-Ford, Floyd-Warshall"
description: "Three algorithms, three different jobs. Which one to reach for depends on negative edges, on how many sources you have, and on nothing else."
date: 2019-06-09
permalink: "/posts/2019/06/shortest-paths/"
lang: en
tags:
  - "algorithms"
  - "graphs"
  - "shortest paths"
  - "dijkstra"
  - "problem solving"
series: "Problem Solving From Zero"
seriesOrder: 14
math: true
---

*BFS finds shortest paths when every edge costs the same. Give the edges weights and it breaks, because the queue stops handing you vertices in distance order. Three algorithms fix that, in three different circumstances, and choosing between them is a two-question decision.*

## 1. The decision, first

Because this is the part people get wrong, and it is genuinely simple.

| Question | Answer | Use |
|---|---|---|
| All edges weight 1? | yes | BFS, $\mathcal{O}(V + E)$ |
| Weights only 0 or 1? | yes | 0-1 BFS with a deque, $\mathcal{O}(V + E)$ |
| Any negative weights? | no | **Dijkstra**, $\mathcal{O}((V + E)\log V)$ |
| Any negative weights? | yes | **Bellman-Ford**, $\mathcal{O}(VE)$ |
| Need every pair, and `V` is small? | yes | **Floyd-Warshall**, $\mathcal{O}(V^3)$ |
| Weighted, but the graph is a DAG? | yes | topological order plus one pass, $\mathcal{O}(V + E)$ |

That table is the post. The rest is why, and how.

## 2. Dijkstra

The idea: keep a set of vertices whose shortest distance is final, and repeatedly take the nearest vertex that is not yet final. Its distance cannot improve, because every remaining route to it goes through something further away.

That last sentence is the correctness argument, and it is also exactly where the negative-edge restriction comes from. Hold onto it.

```python
import heapq

def dijkstra(g, start, n):
    """g[u] is a list of (neighbour, weight)."""
    INF = float('inf')
    dist = [INF] * n
    dist[start] = 0
    pq = [(0, start)]                       # (distance, vertex)
    while pq:
        d, u = heapq.heappop(pq)
        if d > dist[u]:
            continue                        # a stale entry, already improved
        for v, w in g[u]:
            nd = d + w
            if nd < dist[v]:
                dist[v] = nd
                heapq.heappush(pq, (nd, v))
    return dist
```

$\mathcal{O}((V + E)\log V)$. Three details that matter:

**The staleness check.** `if d > dist[u]: continue`. We push a new entry rather than updating an existing one, because a binary heap cannot cheaply find and change an arbitrary element. So the heap accumulates outdated entries, and this line discards them. Without it the algorithm is still correct but does redundant work; with it, each vertex is expanded once.

**Push, do not decrease-key.** The textbook version uses a priority queue with `decrease_key`. Lazy insertion with a staleness check is simpler, and the heap holds at most `E` entries, which is fine.

**The tuple order.** `(distance, vertex)`, distance first, because that is what the heap compares on.

```
        (0)
       /   \
     4/     \1
     /       \
   (1)---2---(2)
     \       /
     5\     /8
       \   /
        (3)

  dijkstra from 0

  pop (0,0)   dist = [0, 4, 1, inf]
  pop (1,2)   relax 2->1: 1+2=3 < 4  ->  dist[1]=3
              relax 2->3: 1+8=9      ->  dist[3]=9
  pop (3,1)   relax 1->3: 3+5=8 < 9  ->  dist[3]=8
  pop (4,1)   stale, 4 > dist[1]=3, skipped
  pop (8,3)   nothing to relax
  pop (9,3)   stale

  dist = [0, 3, 1, 8]
```

Note the stale `(4,1)` entry being discarded, and note that `dist[1]` improved from 4 to 3 *after* 1 was already in the heap. That is why the check is needed.

### Why negative edges break it

Dijkstra finalises a vertex when it pops it, on the grounds that nothing further away can lead to something closer. A negative edge destroys that: a long way round can end with a `-10` and come out shorter.

```
      2        -10
  A ----> B --------> C
   \                  ^
    \        1        |
     +----------------+

  Dijkstra from A:
    pops C at distance 1, finalises it
    later finds A -> B -> C = 2 - 10 = -8, but C is already final
  reports 1, and the answer is -8
```

The failure is silent: you get a number, no error, and it is wrong. Do not "just try it" on a graph with negative edges.

## 3. Bellman-Ford

The idea: a shortest path uses at most `V - 1` edges, since more than that would repeat a vertex. So relax *every* edge, `V - 1` times, and after pass `k` every distance reachable within `k` edges is correct.

```python
def bellman_ford(edges, start, n):
    """edges is a list of (u, v, w)."""
    INF = float('inf')
    dist = [INF] * n
    dist[start] = 0
    for _ in range(n - 1):
        changed = False
        for u, v, w in edges:
            if dist[u] != INF and dist[u] + w < dist[v]:
                dist[v] = dist[u] + w
                changed = True
        if not changed:
            break                            # settled early
    return dist
```

$\mathcal{O}(VE)$: slower than Dijkstra, and it handles negative weights.

### Detecting a negative cycle

This is Bellman-Ford's other job, and it is the reason it survives. If any edge can still be relaxed after `V - 1` passes, there is a cycle of negative total weight, and "shortest path" has no meaning: go round the cycle forever.

```python
def has_negative_cycle(edges, start, n):
    dist = [0] * n                           # 0, to catch cycles anywhere
    for _ in range(n - 1):
        for u, v, w in edges:
            if dist[u] + w < dist[v]:
                dist[v] = dist[u] + w
    for u, v, w in edges:                    # one more pass
        if dist[u] + w < dist[v]:
            return True
    return False
```

Starting every distance at 0 rather than infinity is deliberate: it looks for a negative cycle anywhere in the graph, not only one reachable from a particular start.

Where this matters in practice: **currency arbitrage**. Take the exchange rates, use `-log(rate)` as the edge weight, and a negative cycle is a sequence of trades that returns more than you started with, since sums of logs are products of rates.

## 4. Floyd-Warshall

Different question: shortest distance between *every* pair. Three nested loops and an adjacency matrix.

```python
def floyd_warshall(n, edges):
    INF = float('inf')
    d = [[INF] * n for _ in range(n)]
    for i in range(n):
        d[i][i] = 0
    for u, v, w in edges:
        d[u][v] = min(d[u][v], w)            # min, in case of parallel edges

    for k in range(n):                       # the intermediate vertex
        for i in range(n):
            for j in range(n):
                if d[i][k] + d[k][j] < d[i][j]:
                    d[i][j] = d[i][k] + d[k][j]
    return d
```

$\mathcal{O}(V^3)$ time, $\mathcal{O}(V^2)$ space, so `V` up to about 400 is comfortable and 1000 is pushing it.

**The loop order is not negotiable.** `k` must be the outermost loop. This is dynamic programming where `d[i][j]` after iteration `k` means "shortest path from `i` to `j` using only vertices `0..k` as intermediates". Put `k` inside and you are reading entries that have not been computed yet, and the answers are wrong. This is [part 9's question four](/posts/2018/02/dp-as-a-table/), and it is the classic instance of getting the fill order wrong.

Floyd-Warshall handles negative edges. It gives nonsense if there is a negative cycle, which you can detect afterwards: if any `d[i][i]` is negative, `i` sits on one.

It also does two other jobs with the same three loops, which is why it is worth knowing even when you do not need distances:

**Transitive closure.** Replace `min` and `+` with `or` and `and` and you get reachability between every pair.

```python
reach[i][j] = reach[i][j] or (reach[i][k] and reach[k][j])
```

**Minimax path.** Replace `+` with `max` and you get, for every pair, the path whose largest single edge is smallest. That is the "widest bottleneck" question, and it comes up in network capacity problems.

## 5. Shortest paths on a DAG

Worth a section because it is often overlooked and it is the fastest of all. If the graph is acyclic, take a topological order and relax edges in that order, once.

```python
def dag_shortest(g, order, start, n):
    INF = float('inf')
    dist = [INF] * n
    dist[start] = 0
    for u in order:
        if dist[u] == INF:
            continue
        for v, w in g[u]:
            dist[v] = min(dist[v], dist[u] + w)
    return dist
```

$\mathcal{O}(V + E)$, handles negative weights without complaint, and gives **longest** paths just as easily by swapping `min` for `max`. There is no negative cycle to worry about because there are no cycles at all. If a problem's graph is a DAG, this is the answer.

## 6. Recovering the path

Same as always: parent pointers.

```python
def dijkstra_path(g, start, goal, n):
    INF = float('inf')
    dist = [INF] * n
    parent = [-1] * n
    dist[start] = 0
    pq = [(0, start)]
    while pq:
        d, u = heapq.heappop(pq)
        if d > dist[u]:
            continue
        if u == goal:
            break
        for v, w in g[u]:
            if d + w < dist[v]:
                dist[v] = d + w
                parent[v] = u
                heapq.heappush(pq, (dist[v], v))
    if dist[goal] == INF:
        return None
    path, node = [], goal
    while node != -1:
        path.append(node)
        node = parent[node]
    return path[::-1]
```

## 7. Where the interesting problems hide: change the graph

The techniques are standard. The skill is noticing that the graph you have been given is not the graph you should search. Four moves that come up repeatedly.

**Split a vertex to model a cost of passing through it.** If waiting at a station costs time, replace each station with an "arrive" node and a "depart" node joined by an edge of that cost.

**Add a dimension to the state.** "Shortest path, and you may use at most one free teleport" becomes Dijkstra on `(vertex, teleports_used)`, which is a graph of twice the size. This is the single most useful move in the list. Fuel, keys collected, a parity constraint, a limit on turns: all extra dimensions.

```python
# shortest path where you may cross at most k toll roads
# state is (vertex, tolls_used); the graph is (V x (k+1)) vertices
def dijkstra_with_budget(g, start, goal, n, k):
    INF = float('inf')
    dist = [[INF] * (k + 1) for _ in range(n)]
    dist[start][0] = 0
    pq = [(0, start, 0)]
    while pq:
        d, u, used = heapq.heappop(pq)
        if d > dist[u][used]:
            continue
        for v, w, is_toll in g[u]:
            nused = used + (1 if is_toll else 0)
            if nused > k:
                continue
            if d + w < dist[v][nused]:
                dist[v][nused] = d + w
                heapq.heappush(pq, (d + w, v, nused))
    return min(dist[goal])
```

**Add a super-source.** For "shortest distance from any of these `k` starts", add one artificial vertex with a zero-weight edge to each start and run one Dijkstra. This is the weighted version of [multi-source BFS](/posts/2018/10/graphs-and-bfs/).

**Reverse the edges.** For "shortest distance from every vertex *to* a target", reverse every edge and run one Dijkstra from the target.

## 8. Mistakes worth naming

**Dijkstra on negative edges.** Silent wrong answers. Check the constraints before choosing.

**Forgetting the staleness check.** Correct but slow, and on a dense graph slow enough to fail.

**`k` not outermost in Floyd-Warshall.** Wrong answers, and the code looks perfectly reasonable.

**Integer overflow on `INF`.** In C++ with `INF = INT_MAX`, computing `dist[u] + w` overflows to a negative number and everything falls apart. Use a large finite value such as $10^{18}$ with 64-bit integers, or guard with `if dist[u] != INF`.

**Using $\mathcal{O}(V^2)$ Dijkstra on a sparse graph.** The array-scan version is right for dense graphs; with a heap it is $\mathcal{O}(E \log V)$, which is much better when `E` is near `V`.

## The short version

- Negative edges and the number of sources are the only two questions. All 1: BFS. Weights 0 or 1: deque BFS. Non-negative: Dijkstra. Negative: Bellman-Ford. Every pair with small `V`: Floyd-Warshall. A DAG: topological order, one pass.
- Dijkstra finalises a vertex when it pops it, which is exactly why a negative edge breaks it, and it breaks silently.
- Push new heap entries rather than updating old ones, and discard stale pops with `if d > dist[u]: continue`.
- Bellman-Ford's real value is detecting negative cycles: one extra pass that still improves something proves one exists. With `-log(rate)` weights that is currency arbitrage.
- In Floyd-Warshall, `k` is the outermost loop. Not a style preference: it is the DP fill order, and getting it wrong gives wrong answers from code that looks fine.
- The same three loops give transitive closure with `or` and `and`, and widest-bottleneck paths with `max`.
- Most hard shortest-path problems are easy ones on a modified graph. Add a dimension to the state, split a vertex, add a super-source, or reverse the edges.

Next: disjoint sets, and the two-function data structure that makes minimum spanning trees trivial.
