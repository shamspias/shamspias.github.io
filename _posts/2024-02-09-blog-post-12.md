---
title: "Brains Behind the Bots: Classical Planning from Ground Up"
date: 2024-02-09
permalink: /posts/2024/02/classical-planning/
tags:
  - classical planning
  - search
  - PDDL
  - HTN
  - multi-agent systems
  - knowledge representation
  - AI foundations
  - beginner
math: true
---

*“A goal without a plan is just a wish—unless a planner makes it real.”*  
This guide lifts the lid on the algorithms that tell robots **what to do next**, one step at a time.

---

## 1 Why split planning from doing?

Imagine you’re teaching a child to build a LEGO tower:

1. **Work out the moves** (*pick red brick → stack on base → pick blue brick…*).
2. **Carry them out** with small hands that might wobble.

If the tower collapses, is the list of moves bad, or did shaky fingers cause trouble? Keeping “find a good sequence”
separate from “execute it” lets you debug the right half.

---

## 2 A map of the search space 🗺️

Think of the world as a graph:

* **Nodes** = states of the world
* **Edges** = actions that flip one state to another

| Search style  | How it walks the graph                | Finishes?  | Finds shortest path?                | Good for…                  |
|---------------|---------------------------------------|------------|-------------------------------------|----------------------------|
| Breadth-first | Level by level                        | Always     | Yes                                 | Tiny grids, puzzles        |
| Depth-first   | One long tunnel                       | Not always | No                                  | When memory is tight       |
| **A\***       | Chooses the most promising node first | Always     | Yes (if its guess never overshoots) | Big maps, games            |
| IDA\*         | A\* but with tiny memory              | Always     | Yes                                 | Large puzzles like 15-tile |

**Everyday example**  
Getting from home to work on foot: A\* plays navigator, using straight-line distance as a guess (“I’m 800 m away now”).
That guess helps it skip lanes that point away from the goal.

---

## 3 Planning Graphs in plain English

Picture a flip-book:

1. First page: facts true right now.
2. Next page: all actions you could take together (no clashes).
3. Next: the results of those actions.
4. Repeat.

When every goal fact pops up on the same page **without stepping on each other**, you know how many turns you *must*
spend. That count is a solid, cheap guide for later search.

**Pancake example**  
Goal: cook two pancakes and pour coffee.  
If the stove has one burner you can’t fry both pancakes at once, so the flip-book shows “pancake1 ready, pancake2 ready,
coffee poured” no earlier than page 3.

---

## 4 Three roads to a plan

| Route                        | Big idea                                                              | Shines when…                         |
|------------------------------|-----------------------------------------------------------------------|--------------------------------------|
| **SAT-Plan**                 | Turn “action + time” into a giant logic puzzle and call a SAT solver. | Horizon (number of steps) is small.  |
| **Constraint (CSP)**         | Each time slot holds an action variable. Enforce rules like a Sudoku. | Lots of numeric limits.              |
| **Heuristic forward search** | Start state → explore with a smart guess (FF or LM-cut).              | Wide domains with dozens of actions. |

*Tiny domain?* Solve as SAT.  
*Huge domain?* Trust a heuristic.

---

## 5 Life happens: time, fuel, and chance ⏰

Real jobs break the toy-world rules.

| Twist                | What changes                       | Quick picture                           |
|----------------------|------------------------------------|-----------------------------------------|
| **Durative actions** | Actions last minutes, can overlap. | Bake cake while the kettle boils.       |
| **Resources**        | Actions eat numbers (fuel, money). | Drone can only fly 40 km on one charge. |
| **Uncertainty**      | Actions may fail.                  | “Pick up box” could drop it.            |
| **Monitoring**       | Check mid-run; fix or redo plan.   | GPS says road is closed—reroute.        |

---

## 6 Hierarchical Task Networks (HTN) 🍳

Break a chore into recipes.

*Top task:* **Cook breakfast**  
*Methods:*

1. **Make eggs** → { crack, whisk, fry }
2. **Make toast** → { slice, toast, butter }
3. **Serve** → { plate food, pour juice }

Planners like SHOP2 swap in methods until nothing is left but low-level moves. Fewer choices mean faster search.

---

## 7 When sensors lie: contingent planning 🎲

If a robot isn’t sure the door is open, its plan might branch:

```text
Sense door
|-- open  → walk through
|-- closed → unlock → walk through
```

A policy is born: *do X if Y, else do Z*.

---

## 8 Two (or more) bots, one goal

Approaches:

* **Central brain** – mash both bots into one monster problem. Easy logic, rough scaling.
* **Separate brains** – each bot plans, then they swap proposals. Works if they chat.
* **Game style** – each bot has its own reward. Think soccer, not assembly line.

Treat “send message” as an action with cost and you’ll discover times when silence wins.

---

## 9 Smart world models prune search 🌳

* Type hierarchies (“cup” is a kind of “container”) stop illegal picks.
* Default facts (“every light is off unless stated”) shrink the start state.
* Axioms (“on(table, block) ⇒ clear(block) is false”) beat dead-ends early.

---

## 10 Hands-on: Towers of Hanoi

```python
from pyperplan.planner import search_plan, SEARCHES, HEURISTICS

# run A* + FF on the 3-disk problem
plan3 = search_plan(
    'hanoi-domain.pddl',
    'hanoi-problem-3.pddl',
    SEARCHES['astar'],   # A* search
    HEURISTICS['hff']    # FF heuristic
)

# plan3 is a list of Operator objects, so print their names:
print(len(plan3), "steps")
print('\n'.join(op.name for op in plan3))

```

## 10.0 PDDL domain for Towers of Hanoi 🏰

```pddl
(define (domain hanoi)
  (:requirements :typing)
  (:types disk peg)

  (:predicates
      (on      ?d - disk   ?x - (either peg disk))
      (clear   ?x - (either peg disk))
      (smaller ?d - disk   ?x - (either peg disk))
  )

  (:action move
    :parameters (?d - disk
                 ?from - (either peg disk)
                 ?to   - (either peg disk))
    :precondition (and
      (on      ?d   ?from)
      (clear   ?d)
      (clear   ?to)
      (smaller ?d   ?to))
    :effect (and
      (on    ?d   ?to)
      (clear ?from)
      (not   (on    ?d   ?from))
      (not   (clear ?to)))
  )
)

```

Make `hanoi-problem-5.pddl` and watch run time balloon—hello, exponential growth.

---

## 10.1 Crafting a 5‑disk PDDL file 📝

Need a bigger challenge? Here’s a template for **`hanoi-problem-5.pddl`** that matches the classic Towers of Hanoi
domain used by most textbooks and by *pyperplan*.

```pddl
(define (problem hanoi-5)
  (:domain hanoi)

  (:objects
      d1 d2 d3 d4 d5 - disk
      pegA pegB pegC - peg)

  (:init
      ;; Disk < disk (all 10 pairs)
      (smaller d1 d2) (smaller d1 d3) (smaller d1 d4) (smaller d1 d5)
      (smaller d2 d3) (smaller d2 d4) (smaller d2 d5)
      (smaller d3 d4) (smaller d3 d5)
      (smaller d4 d5)

      ;; Disk < peg (as before)
      (smaller d1 pegA) (smaller d2 pegA) (smaller d3 pegA)
      (smaller d4 pegA) (smaller d5 pegA)
      (smaller d1 pegB) (smaller d2 pegB) (smaller d3 pegB)
      (smaller d4 pegB) (smaller d5 pegB)
      (smaller d1 pegC) (smaller d2 pegC) (smaller d3 pegC)
      (smaller d4 pegC) (smaller d5 pegC)

      ;; Initial stacking: largest at bottom of pegA
      (on d5 pegA)
      (on d4 d5)
      (on d3 d4)
      (on d2 d3)
      (on d1 d2)

      ;; Only the top disk and empty pegs are clear
      (clear d1) (clear pegB) (clear pegC)
  )

  (:goal (and
      ;; Same stack on pegC
      (on d5 pegC)
      (on d4 d5)
      (on d3 d4)
      (on d2 d3)
      (on d1 d2)
  ))
)

```

**Why just the "smaller" chain?**  
Many Hanoi domains encode size with a binary `smaller` predicate that only needs *adjacent* facts—for five disks, four
facts are enough. The planner infers transitivity when it checks `can-move` operators.

**Try it out**

```python
plan5 = search_plan(
    'hanoi-domain.pddl',
    'hanoi-problem-5.pddl',
    SEARCHES['astar'],
    HEURISTICS['hff']
)

print(len(plan5), "steps")
print('\n'.join(op.name for op in plan5))

```

Expect the line count to jump from **7 moves (3 disks)** to **31 moves (5 disks)**—and the open list to mushroom along
the way.

---

## 11 Cheat sheet 📜

```
Breadth-first       – shortest path, huge memory
Depth-first         – low memory, can loop forever
A* / IDA*           – uses a guess to focus search
Planning graph      – flip-book for cheap distance
SAT / CSP           – compile to a solver
FF, LM-cut          – flagship heuristics
HTN                 – top-down recipes
Contingent planning – plan trees for “if”“else”
Multi-agent         – join, negotiate, or compete
```

---

## 12 Try it at home 🧪

1. **Campus delivery race**  
   Two wheeled robots must drop pizza and soda. Give them a map with one narrow bridge. Test central vs. separate
   planning.
2. **HTN makeover**  
   Take the classic *Blocks World* and write methods like “build tower”. Compare node counts.
3. **Resource crunch**  
   Drone with 100 Wh battery must film three spots and return. Add wind that changes costs. How does the plan adapt?

---

## 13 Last thoughts

Planning is the thinking part before action. With the right heuristics and a tidy model, the open list stays small, and
robots spend time *doing* rather than scratching their heads. Happy building, and may your search trees stay shallow.

---

## 14 Colab playground

Grab the notebook with Graphplan visuals, FF heat maps, and automatic problem generators:

[Open the “Brains Behind the Bots” Colab](https://drive.google.com/file/d/14NDICgxNBSkmVy98RwzclZvofTFngQVO/view?usp=sharing)

Clone it, plug in your own domains, and share what you find!

