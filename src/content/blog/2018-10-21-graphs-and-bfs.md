---
title: "Graphs: How to Store One, and Breadth-First Search"
description: "Half of all algorithm problems are graph problems in disguise. Here is how to represent a graph, and the search that finds shortest paths for free."
date: 2018-10-21
permalink: "/posts/2018/10/graphs-and-bfs/"
lang: en
tags:
  - "algorithms"
  - "graphs"
  - "bfs"
  - "problem solving"
series: "Problem Solving From Zero"
seriesOrder: 12
math: true
---

*A graph is a set of things and a set of connections between them. That is the whole definition, and it is why so many problems turn out to be graph problems: a maze, a set of tasks with prerequisites, a word ladder, a network of friends, and a state machine are all the same object. This part is representation and breadth-first search, which gives you shortest paths without asking for them.*

## 1. Vocabulary, briefly

- **Vertex** or **node**: a thing. **Edge**: a connection.
- **Directed** if edges have a one-way arrow, **undirected** if they go both ways.
- **Weighted** if edges carry a number, **unweighted** otherwise.
- **Degree**: how many edges touch a vertex.
- **Path**: a sequence of vertices each joined to the next. **Cycle**: a path back to where it started.
- **Connected**: every vertex reachable from every other. A **component** is a maximal connected piece.
- **Tree**: connected with no cycles. Equivalently, connected with exactly `n - 1` edges.

Two sizes matter throughout: `V` vertices and `E` edges. In a simple graph, `E` is at most about $V^2/2$. A graph with `E` close to $V^2$ is **dense**, and one with `E` close to `V` is **sparse**. Almost every real graph is sparse, which is why the representation below is the right default.

## 2. Storing a graph

Two representations, and the choice matters.

**Adjacency list.** For each vertex, a list of its neighbours. Space $\mathcal{O}(V + E)$.

```python
from collections import defaultdict

def build(n, edges, directed=False):
    g = defaultdict(list)
    for u, v in edges:
        g[u].append(v)
        if not directed:
            g[v].append(u)
    return g
```

**Adjacency matrix.** A `V × V` grid where `m[u][v]` says whether the edge exists. Space $\mathcal{O}(V^2)$.

```python
def build_matrix(n, edges, directed=False):
    m = [[0] * n for _ in range(n)]
    for u, v in edges:
        m[u][v] = 1
        if not directed:
            m[v][u] = 1
    return m
```

| | Adjacency list | Adjacency matrix |
|---|---|---|
| Space | $\mathcal{O}(V + E)$ | $\mathcal{O}(V^2)$ |
| Is there an edge `u,v`? | $\mathcal{O}(\deg u)$ | $\mathcal{O}(1)$ |
| Iterate the neighbours of `u` | $\mathcal{O}(\deg u)$ | $\mathcal{O}(V)$ |
| Good for | sparse graphs, which is most of them | dense graphs, Floyd-Warshall |

**Use the adjacency list by default.** With `V = 200,000` a matrix is $4 \times 10^{10}$ entries and simply cannot be allocated, while the list is a few megabytes. Reach for the matrix only when the graph is genuinely dense, `V` is small (a few hundred), or the algorithm wants it, which in practice means Floyd-Warshall.

## 3. Breadth-first search

BFS visits vertices in order of how many edges away they are. A queue is the whole implementation.

```python
from collections import deque

def bfs(g, start):
    dist = {start: 0}
    q = deque([start])
    while q:
        u = q.popleft()
        for v in g[u]:
            if v not in dist:            # not seen yet
                dist[v] = dist[u] + 1
                q.append(v)
    return dist
```

$\mathcal{O}(V + E)$: every vertex enters the queue once, and every edge is examined once from each end.

```
        1 --- 2 --- 5
        |     |
        0     3 --- 4

  bfs from 0

  layer 0:  0                    dist 0
  layer 1:  1                    dist 1
  layer 2:  2                    dist 2
  layer 3:  3   5                dist 3
  layer 4:  4                    dist 4

  queue:  [0] -> [1] -> [2] -> [3,5] -> [5,4] -> [4] -> []
```

Two details that are the difference between working and not.

**Mark when you enqueue, not when you dequeue.** In the code above, `dist[v]` is set at the moment `v` is added to the queue. If you instead check and mark at pop time, a vertex reachable from two places gets queued twice, and on a dense graph that degenerates badly.

**The `dist` dictionary is doing two jobs.** It stores distances and it serves as the visited set. That is deliberate: two structures that must agree are two structures that can disagree.

## 4. Why BFS gives shortest paths

Worth understanding rather than accepting, because it tells you exactly when it stops being true.

BFS processes vertices in non-decreasing order of distance. When it first reaches a vertex `v`, it came from some `u` that was already at its final distance `d`, so `v` gets `d + 1`. Could `v` really be closer? No: any shorter path would have gone through a vertex at distance less than `d`, and all of those were processed earlier, so `v` would have been found then.

The step that argument depends on is "every edge adds exactly one to the distance". That is why BFS is only correct for **unweighted** graphs, or equivalently graphs where every edge has the same weight. Give edges different weights and the queue no longer processes vertices in distance order, and you need Dijkstra. That is [part 14](/posts/2019/06/shortest-paths/).

## 5. Recovering the path

Distances are usually not enough; you want the route. Keep a parent pointer, exactly as in [part 10](/posts/2018/02/dp-as-a-table/).

```python
def bfs_path(g, start, goal):
    parent = {start: None}
    q = deque([start])
    while q:
        u = q.popleft()
        if u == goal:
            break
        for v in g[u]:
            if v not in parent:
                parent[v] = u
                q.append(v)
    if goal not in parent:
        return None
    path, node = [], goal
    while node is not None:
        path.append(node)
        node = parent[node]
    return path[::-1]
```

## 6. The grid, which is the most common graph you will meet

Grid problems are graph problems where the edges are implicit: each cell connects to its neighbours. There is no need to build an adjacency list at all.

```python
def bfs_grid(grid, start):
    rows, cols = len(grid), len(grid[0])
    DIRS = ((-1, 0), (1, 0), (0, -1), (0, 1))       # up down left right
    dist = [[-1] * cols for _ in range(rows)]
    sr, sc = start
    dist[sr][sc] = 0
    q = deque([start])
    while q:
        r, c = q.popleft()
        for dr, dc in DIRS:
            nr, nc = r + dr, c + dc
            if not (0 <= nr < rows and 0 <= nc < cols):
                continue                            # off the board
            if grid[nr][nc] == '#' or dist[nr][nc] != -1:
                continue                            # wall, or already seen
            dist[nr][nc] = dist[r][c] + 1
            q.append((nr, nc))
    return dist
```

The `DIRS` tuple is the idiom worth copying. Writing the four neighbours out by hand as four blocks of code is four chances to make a typo, and eight-direction movement then means eight blocks. One tuple and one loop means one place to be wrong. For diagonals, add the four combinations of ±1.

Two habits that eliminate most grid bugs:

**Check the bounds before reading the cell.** Every time. In Python a negative index silently wraps around to the other end of the row, so an out-of-bounds read does not crash, it returns the wrong cell, and you get a wrong answer with no error.

**Use `-1` for unvisited in the distance array**, not `0`, so distance zero is representable and distinguishable.

## 7. Multi-source BFS

Underrated technique. If the question is "distance to the *nearest* of these things", do not run BFS from each of them. Put them all in the queue at distance zero.

```python
def nearest_source(grid, sources):
    rows, cols = len(grid), len(grid[0])
    dist = [[-1] * cols for _ in range(rows)]
    q = deque()
    for r, c in sources:
        dist[r][c] = 0
        q.append((r, c))
    # then exactly the same loop as before
    ...
```

The layers now expand from every source at once, so each cell ends up with the distance to its closest source. One BFS instead of `k`, so $\mathcal{O}(V + E)$ instead of $\mathcal{O}(k(V + E))$. "Rotting oranges", "distance to the nearest wall", "how long until the fire reaches every cell": all multi-source BFS.

## 8. 0-1 BFS, and the deque trick

A halfway case worth knowing, because it lets you avoid Dijkstra entirely in a common situation: every edge weight is either 0 or 1.

Use a deque. Push zero-weight edges to the **front** and one-weight edges to the **back**. The deque stays sorted by distance without a priority queue.

```python
def bfs01(g, start, n):
    INF = float('inf')
    dist = [INF] * n
    dist[start] = 0
    q = deque([start])
    while q:
        u = q.popleft()
        for v, w in g[u]:               # w is 0 or 1
            if dist[u] + w < dist[v]:
                dist[v] = dist[u] + w
                if w == 0:
                    q.appendleft(v)
                else:
                    q.append(v)
    return dist
```

$\mathcal{O}(V + E)$, no log factor. The classic use: a grid where moving is free but breaking a wall costs one, and you want the fewest walls broken.

## 9. Problems that are secretly BFS

The real skill is recognising the graph. In each of these, the vertices are not given to you.

**Word ladder.** Turn `hit` into `cog` one letter at a time, staying in a dictionary. Vertices are words, edges join words differing in one letter, and BFS gives the shortest chain.

**Knight's shortest path.** Vertices are squares, edges are the eight knight moves. Straight grid BFS with a different `DIRS`.

**The state graph.** This is the one that unlocks the hardest problems. Vertices need not be places; they can be *situations*. Two jugs of capacity 3 and 5 litres, and you want exactly 4 litres. The vertices are pairs `(a, b)` of current contents, the edges are fill, empty and pour, and BFS finds the fewest moves.

```python
def jugs(cap_a, cap_b, target):
    start = (0, 0)
    dist = {start: 0}
    q = deque([start])
    while q:
        a, b = q.popleft()
        if a == target or b == target:
            return dist[(a, b)]
        pour_ab = min(a, cap_b - b)
        pour_ba = min(b, cap_a - a)
        moves = [
            (cap_a, b), (a, cap_b),                  # fill either
            (0, b), (a, 0),                          # empty either
            (a - pour_ab, b + pour_ab),              # pour a into b
            (a + pour_ba, b - pour_ba),              # pour b into a
        ]
        for s in moves:
            if s not in dist:
                dist[s] = dist[(a, b)] + 1
                q.append(s)
    return -1
```

That is BFS on a graph with no edges written down anywhere. **The habit: when a problem says "minimum number of moves", ask what a situation is, and what one move does to it.** If you can answer both, you have a graph and BFS solves it.

**Bipartite checking.** Colour the start black, its neighbours white, theirs black. If BFS ever tries to give a vertex a colour it already has differently, the graph has an odd cycle and is not bipartite.

```python
def is_bipartite(g, n):
    colour = [-1] * n
    for s in range(n):
        if colour[s] != -1:
            continue
        colour[s] = 0
        q = deque([s])
        while q:
            u = q.popleft()
            for v in g[u]:
                if colour[v] == -1:
                    colour[v] = 1 - colour[u]
                    q.append(v)
                elif colour[v] == colour[u]:
                    return False
    return True
```

The outer loop over `s` is the part people forget: the graph may have several components, and each needs its own start.

## The short version

- A graph is things plus connections. Mazes, prerequisites, word ladders and state machines are all the same object, which is why so many problems are graph problems.
- Use an adjacency list unless the graph is genuinely dense. At `V = 200,000` a matrix cannot be allocated at all.
- BFS is a queue. Mark vertices when you enqueue them, not when you dequeue them, and let the distance map double as the visited set.
- BFS gives shortest paths because every edge adds exactly one. That is also precisely why it stops working the moment edges have different weights.
- For grids, keep the four offsets in one tuple and loop over it. Check bounds before reading the cell: in Python a negative index quietly returns the wrong cell rather than failing.
- If the question is "distance to the nearest of these", seed the queue with all of them at once. One BFS, not `k`.
- When every weight is 0 or 1, use a deque and push zero-weight edges to the front. Linear time, no priority queue.
- When a problem says "minimum number of moves", ask what a situation is and what a move does to it. That gives you a graph even when no graph was mentioned.

Next: depth-first search, the shape of the recursion, and what it can tell you that BFS cannot.
