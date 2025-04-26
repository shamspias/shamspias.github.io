---
title: "First-Order Logic Made Friendly: From ‘Socrates Is Mortal’ to Automatic Proofs"
date: 2023-12-25
permalink: /posts/2023/12/first-order-logic/
tags:
  - artificial intelligence
  - first-order logic
  - unification
  - forward chaining
  - backward chaining
  - resolution
  - beginner
math: true
---

*If you’ve ever said “**Everyone** in the club must pay dues, therefore  
**Alice** must pay,” you’ve already used **first-order logic** (FOL).*

This post turns Chapters 8 & 9 into bite-sized steps:

1. **Why We Outgrew Propositional Logic**
2. **Syntax & Semantics of FOL**
3. **Talking in FOL: Examples & Patterns**
4. **Knowledge Engineering Tips**
5. **Inference: How to Prove Stuff in FOL**
    * Unification & Lifting
    * Forward vs Backward Chaining
    * Full First-Order Resolution
6. **Cheat-Sheet & DIY Exercises**

No headaches—just tiny formulas, word-pictures, and micro-code.

---

## 1 Representation Revisited (8·1)

Propositional logic says only **whole sentences** are true or false.  
But the world has **objects**, **relations**, **quantities**.

| Need                                 | Propositional? | First-Order? |
|--------------------------------------|----------------|--------------|
| “*Any* cat that purrs is happy”      | ❌              | ✅️           |
| Nested relations (`Loves(Alice, x)`) | ❌              | ✅️           |
| Infinite domains (all integers)      | ❌              | ✅️           |

---

## 2 Syntax & Semantics of FOL (8·2)

| Piece          | Symbol   | Example       | Reads as                  |
|----------------|----------|---------------|---------------------------|
| **Constant**   | `a`      | `alice`       | a thing                   |
| **Variable**   | `x`      | `x`           | unknown thing             |
| **Predicate**  | `P`      | `Cat(x)`      | property/relationship     |
| **Function**   | `f`      | `MotherOf(x)` | object from object        |
| **Quantifier** | `∀`, `∃` | `∀x Cat(x)`   | “for all”, “there exists” |

Example sentence:

$$
\forall x \, (Cat(x) \rightarrow Loves(x,\;FishOfTheDay)).
$$

> “Every cat loves the fish-of-the-day.”

**Semantics:** interpret over some **domain**. A sentence is *true* if it holds in **every** world that follows the
interpretation.

---

## 3 Using First-Order Logic (8·3)

### 3·1 Rules in English → FOL

| English                      | FOL                                                                        |
|------------------------------|----------------------------------------------------------------------------|
| “All surgeons are doctors.”  | $$ ( \forall x\, (Surgeon(x) \rightarrow Doctor(x)) ) $$                   |
| “Some doctor loves Alice.”   | $$ ( \exists y\, (Doctor(y) \land Loves(y,\,alice)) ) $$                   |
| “There is exactly one king.” | $$ ( \exists k\, (King(k) \land \forall x \,(King(x)\rightarrow x=k)) ) $$ |

> **Tip:** write English, mark *every noun phrase* → variable; *is/are* → predicate.

---

## 4 Knowledge Engineering in FOL (8·4)

1. **Choose the right ontology** – constants vs functions (use `ParentOf(x)` **or** binary `Parent(x,y)`, not both).
2. **Avoid endless equality chains** – add `UniqueID(x)` facts or use **unique-name assumption** when safe.
3. **Layer your KB** – *facts* ➜ *rules* ➜ *meta-rules*; keep each layer short and coherent.

> **Debug trick:** query your KB with a SAT/first-order prover after every batch of rules—catch contradictions early.

---

## 5 Inference in FOL (Ch. 9)

### 5·1 Propositional vs First-Order Inference (9·1)

Propositional **resolution** works on *ground* sentences.  
FOL lifts it by adding **variables** & **substitution**—more power, same taste.

---

### 5·2 Unification & Lifting (9·2)

**Unify** two atomic sentences by finding a substitution θ that makes them identical.

```python
def unify(x, y, θ={}):
    if θ is None: return None
    if x == y:   return θ
    if is_var(x): return unify_var(x, y, θ)
    if is_var(y): return unify_var(y, x, θ)
    if is_compound(x) and is_compound(y):
        return unify(x.args, y.args, unify(x.op, y.op, θ))
    return None
```

Example:

```
Knows(John, y)  and  Knows(x, Mother(x))
θ = { x/John , y/Mother(John) }
```

---

### 5·3 Forward Chaining (9·3)

*Data-driven*: start with facts, repeatedly fire rules that match.

1. Index predicates for O(1) retrieval.
2. Each new inferred fact goes into an **agenda**; loop until agenda empty.

Great for **databases** with many facts but few queries.

---

### 5·4 Backward Chaining (9·4)

*Goal-driven*: start with query, break into sub-goals.

Prolog = backward chaining + depth-first search + unification.

```prolog
mortal(X) :- human(X).
human(socrates).
?- mortal(socrates).   % succeeds
```

Backtracking explores alternate proofs on failure.

---

### 5·5 First-Order Resolution (9·5)

1. **Skolemise** (eliminate ∃ by functions).
2. Convert to **clausal form** (CNF).
3. Apply **LG (Lifted Ground)-resolution**:  
   Choose clauses **C₁**, **C₂**, find literals **L** & **¬L'** that unify via θ, derive `C₁θ ∪ C₂θ`.

Sound & complete; real solvers add **ordering & subsumption** to prune.

---

## 6 Cheat-Sheet 🧾

```
FOL syntax    = Constants, variables, predicates, functions, ∀, ∃
Semantics     = Interpret over a domain; truth = true in all models
Unification   = Build θ s.t. αθ = βθ
Forward chain = Data-driven rule firing
Backward chain= Goal-driven sub-goal breakdown (Prolog)
Lifting       = Turn propositional resolution into variable form
Skolemization = Remove ∃ by new functions/constants
Sound         = Never proves false; Complete = proves all truths
```

---

## 7 Try It Yourself 🧪

1. **Family Tree KB**  
   Encode `Parent`, `Ancestor`, `Sibling` rules. Prove `Ancestor(alice, bob)` with backward chaining.
2. **Tiny SAT vs FOL**  
   Translate three FOL facts about pets into propositional ground instances; compare clause counts.
3. **Prolog Wumpus**  
   Port your propositional Wumpus agent into Prolog rules with variables (much shorter!).

---

### 🚀Final Words

Propositional logic was **chess in 2 × 2 board**.  
First-Order Logic unlocks *all* pieces, letting agents talk about **things**, **groups**, **relations**.

Learn to:

- **Write** crisp FOL sentences,
- **Unify** symbols like puzzle pieces,
- **Chain** rules forward or backward, and
- **Resolve** any dispute to the empty clause.

Then your AI won’t just *list* facts—it will **reason** about *who, what, where,* and *why*.

**Happy proving—may your substitutions always unify!**