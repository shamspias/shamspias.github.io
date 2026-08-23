---
title: "Intelligent Agents & Search: A Baby-Steps Tour from ‘What is Rational?’ to ‘How do we find the goal?’"
description: "Rational agents, problem formulation, and the search algorithms that get you from a start state to a goal."
date: 2023-04-26
permalink: "/posts/2023/04/ai-agents-search/"
tags:
  - "artificial intelligence"
  - "intelligent agents"
  - "search algorithms"
  - "heuristic"
  - "beginner"
  - "python"
series: "AI Foundations"
seriesOrder: 3
math: true
---

*If you’ve ever followed Google Maps or played hide-and-seek,  
you already know the heart of **agents** and **search**.*

This friendly post tackles two classic A.I. chapters, one toddler step at a time:

1. **Chapter 2 – Intelligent Agents**  
   (What *is* an agent? What counts as smart?)
2. **Chapter 3 – Solving Problems by Searching**  
   (How do agents *actually* reach the goal?)

No heavy jargon—just pocket-sized math, cartoons-in-words, and run-it-now code.

---

## 1 Intelligent Agents

### 1·1 Agents & Environments
> **Agent =** *thing that perceives → acts.*  
> **Environment =** the playground it lives in.

| Example agent | Sensors (percepts) | Actuators (actions) | Environment |
|---------------|--------------------|---------------------|-------------|
| Roomba        | bump sensor, IR    | wheels, vacuum      | Living room |
| Chess AI      | board state        | move generator      | Chess game  |

**Loop**: sense → think → act, forever.

---

### 1·2 Good Behavior = Rationality
An agent is **rational** if, *given what it can sense*, it does whatever **maximizes its expected score**.

$$
a^* = \arg\!\max\nolimits_{a} \mathbb{E}[\text{Performance} \mid \text{percepts}, a]
$$

Think “best guess”, *not* perfect prophecy—your GPS can’t foresee roadworks, yet still picks the shortest-known route.

---

### 1·3 The Nature of Environments

| Property         | Meaning                         | Mnemonic |
|------------------|---------------------------------|----------|
| **Observable?**  | Can the agent see *everything*? | “Eyes”   |
| **Deterministic?**| Same action = same outcome?     | “Luck”   |
| **Episodic?**    | Does today ignore yesterday?    | “TV show”|
| **Static?**      | Does the world change on its own?| “Freeze” |
| **Discrete?**    | Finite chunks vs real numbers?  | “Boxes”  |

A **fully-observable, deterministic, static, discrete** world (e.g. chess) is easy-mode. A **partially-observable, stochastic, dynamic, continuous** world (e.g. driving) is nightmare-mode.

---

### 1·4 Inside the Agent: Four Flavors

1. **Simple Reflex** – *If dirt → Suck.*  
2. **Model-Based Reflex** – remembers unseen rooms.
3. **Goal-Based** – plans toward *finish line*.  
4. **Utility-Based** – maximizes happiness points.

---

### 1·5 One-Screen Demo – Reflex Vacuum

```python
def reflex_vacuum(percept):
    room, state = percept              # e.g. ("A", "Dirty")
    rules = {("A", "Dirty"): "Suck",
             ("B", "Dirty"): "Suck",
             ("A", "Clean"): "Right",
             ("B", "Clean"): "Left"}
    return rules[(room, state)]
```

Drop it in a loop that feeds back new percepts—voilà, Chapter 2 in 12 lines.

---

## 2 Solving Problems by Searching

### 2·1 Problem-Solving Agents
Now the agent has **goal = find path**.  
Input: problem description.  
Output: sequence of actions reaching_goal.

---

### 2·2 Classic Toy Problems

| Puzzle                | Start → Goal                                  |
|-----------------------|-----------------------------------------------|
| **8-Puzzle**          | Scramble tiles → arrange 1-2-3 … 8-blank       |
| **Route Finding**     | City A → City B (shortest kilometres)         |
| **Missionaries & Cannibals** | Everyone crosses river safely          |

Pick one → plug into a generic search engine.

---

### 2·3 Search Trees & Graphs

* **Node** = world-state + path-cost so far.  
* **Tree** because we *branch* on every action.  
* **Frontier** = “open list” of leaves to explore next.

---

### 2·4 Uninformed (Blind) Search

| Strategy | Fringe order | Optimal? | Memory | When use it |
|----------|--------------|----------|--------|-------------|
| **BFS**  | shallowest   | ✔        | huge   | Few steps, costs equal |
| **DFS**  | deepest      | ✖        | tiny   | Really deep, any solution okay |
| **Uniform-Cost** | lowest path-cost | ✔ | huge | Varying step costs |

---

### 2·5 Informed (Heuristic) Search

A **heuristic** \( h(n) \) estimates distance-to-goal.  
Good \( h \) = cheap to compute, *never* overestimates (→ admissible).

| Strategy | Uses \( h(n) \) | Optimal? |
|----------|-----------------|----------|
| **Greedy Best-First** | as priority | ✖ (fast, risky) |
| **A\***               | \( f(n)=g+h \) | ✔ (if \( h \) admissible) |

> **Rule of thumb:**  
> *Maze?* → **A\*** with Manhattan distance.  
> *GPS?* → **A\*** with straight-line kilometres.

---

### 2·6 Code: Tiny A\* on a Grid

```python
from heapq import heappush, heappop

def astar(start, goal, walls, width, height):
    def h(p):           # Manhattan distance
        return abs(p[0]-goal[0]) + abs(p[1]-goal[1])

    frontier = []
    heappush(frontier, (h(start), 0, start, []))  # (f, g, node, path)
    explored = set()

    while frontier:
        f, g, node, path = heappop(frontier)
        if node == goal:
            return path + [node]

        if node in explored: 
            continue
        explored.add(node)

        for dx, dy in [(1,0),(-1,0),(0,1),(0,-1)]:
            nxt = (node[0]+dx, node[1]+dy)
            if 0<=nxt[0]<width and 0<=nxt[1]<height and nxt not in walls:
                heappush(frontier, (g+1+h(nxt), g+1, nxt, path+[node]))
```

Drop a rectangle of walls, hit `astar((0,0),(9,9), walls, 10,10)`—watch the path pop out.

---

## 3 Cheat-Sheet 🧾

```
Agent          = Sensor + Actuator + Program
Rationality    = Best expected outcome, given what’s known
Environment    = {observable?, deterministic?, episodic?, static?, discrete?}
Reflex         = Rule table
Goal-Based     = Needs search
Utility-Based  = Needs numbers

Search Tree    = Nodes of (state, cost)
BFS/DFS/UCS    = No heuristics
Heuristic h(n) = Guess of distance-to-goal
Greedy         = Smallest h(n)
A*             = Smallest g(n)+h(n)  (optimal if h never overestimates)
```

---

## 4 Try It Yourself 🧪

1. **Vacuum Variations**  
   Add a third room **C**—watch the rules explode.  
   Now code a *model-based* agent instead.
2. **Write Your Own Heuristic**  
   For the 8-puzzle, implement `h = number_of_misplaced_tiles`. Then upgrade to *Manhattan distance*.
3. **Blind vs Heuristic Race**  
   Time BFS vs A\* on a 20×20 maze. Count nodes expanded—see the power of a good guess.

---

### 🚀Final Words
Whether it’s a Roomba dodging socks or a path-planner steering Mars rovers, an **agent** must *decide* and often must *search*.  
Keep the loop simple—**perceive → plan → act**—and arm it with a smart heuristic.  
Soon your code won’t just tidy the living room; it’ll conquer any maze you care to draw.

**Happy coding, and may your heuristic always point the way!**
