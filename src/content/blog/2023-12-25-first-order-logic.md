---
title: "First-Order Logic Made Friendly: From ‘Socrates Is Mortal’ to Automatic Proofs"
seoTitle: "First-Order Logic Made Friendly"
description: "Quantifiers, unification, forward and backward chaining, and resolution, from Socrates to a solver that finds the proof for you."
date: 2023-12-25
permalink: "/posts/2023/12/first-order-logic/"
tags:
  - "artificial intelligence"
  - "first-order logic"
  - "unification"
  - "forward chaining"
  - "backward chaining"
  - "resolution"
  - "beginner"
series: "AI Foundations"
seriesOrder: 8
math: true
---

*Part 8 of the AI Foundations series. Propositional logic made me write one rule per square of
the board. First-order logic lets me write the rule once, with a variable in it, and that single
change is what turns a lookup table into something that can reason.*

---

## 1. Why propositional logic ran out of room

In [part 7](/posts/2023/12/logical-agents/) we built an agent that survives the Wumpus world, a
small grid of caves with hidden pits and one monster, by reasoning in propositional logic. It
worked, and writing it taught me exactly what propositional logic cannot do.

The rule I wanted was *"a breeze means there is a pit next door"*. What I actually had to write
was one sentence per square:

```
B11 → P12 ∨ P21
B12 → P11 ∨ P13 ∨ P22
B13 → P12 ∨ P14 ∨ P23
...  and so on, sixteen times, for a 4x4 grid
```

Read `→` as "implies" and `∨` as "or", so the first line says "a breeze in square (1,1)
means a pit in (1,2) or a pit in (2,1)". On a 10x10 grid that is a hundred sentences saying
the same thing. Worse, none of them says the thing. There is no sentence in that knowledge
base meaning *"for any square, if it is breezy then some neighbour has a pit"*. The
generalisation lives in my head and in the script that generated the file, never in the logic.

That is the whole limitation. In propositional logic the smallest unit of meaning is a complete
fact. `B11` is atomic: it has no interior, no parts you can talk about. The world, meanwhile,
is made of **objects** (squares, people, integers), **relations** between them (`Adjacent`,
`Loves`), and **functions** on them (`MotherOf`, `successor`). First-order logic gives you
symbols for all three, plus quantifiers to range over them.

| What you want to say | Propositional logic | First-order logic |
|---|---|---|
| "Square (1,3) has a pit" | yes | yes |
| "Any breezy square has a pit next door" | no, one rule per square | yes, one rule |
| "Alice's mother's employer" | no, no nesting | yes, nested functions |
| "Every integer has a successor" | no, the domain is infinite | yes |

You pay for this. Propositional satisfiability is NP-complete, which is bad but **decidable**:
a SAT solver always terminates with an answer. First-order entailment is only
**semi-decidable**, and the two halves of that word have different authors. Gödel's
completeness theorem gives you the good half: if the knowledge base entails your query, a
complete procedure will eventually find the proof. Church and Turing supplied the bad half in
1936: no procedure decides the general case, so when the entailment does not hold, the search
may run forever without ever being able to tell you so. In practice this means every
first-order prover you use has a timeout, and a timeout means "I do not know", not "no".

---

## 2. The five pieces of syntax

Everything in first-order logic is built from five kinds of symbol, plus the connectives
(`¬ ∧ ∨ →`) you already know, plus equality.

| Piece | Written | Example | What it denotes |
|---|---|---|---|
| Constant | lower case | `socrates` | one specific object |
| Variable | `x`, `y` | `x` | any object, when quantified |
| Predicate | capitalised | `Cat(x)` | a property or relation, true or false |
| Function | capitalised | `MotherOf(x)` | an object, given objects |
| Quantifier | `∀`, `∃` | `∀x Cat(x)` | "for every", "there exists" |

The distinction that trips people up is **predicate versus function**. A predicate returns a
truth value; a function returns an object. `Mother(alice, beth)` is a claim you can argue
about. `MotherOf(beth)` is a thing you can pass to another predicate. You can write
`Doctor(MotherOf(beth))` but not `Doctor(Mother(alice, beth))`, because the second one is
already a sentence and sentences are not objects.

Here is a whole sentence with its parts named:

```
  ∀x ( Cat(x) → Loves(x, fishOfTheDay) )
  │    │   │    │     │  │
  │    │   │    │     │  └── constant: one specific named object
  │    │   │    │     └───── variable: bound by the ∀ above
  │    │   │    └─────────── predicate: Loves, a 2-place relation
  │    │   └──────────────── variable: any object in the domain
  │    └──────────────────── predicate: Cat, a 1-place property
  └───────────────────────── quantifier: "for every object x"
```

$$
\forall x \, \bigl(Cat(x) \rightarrow Loves(x,\; fishOfTheDay)\bigr)
$$

### Semantics, without the fog

Syntax is just marks on a page. **Semantics** is the rule that decides which marks are true.

An **interpretation** picks a set of objects called the domain, then maps each constant to one
object, each predicate to a set of tuples of objects, and each function to an actual mapping.
A **model** of your knowledge base is any interpretation that makes every sentence in it true.
Entailment, written $KB \models \alpha$, means: every single model of $KB$ also makes $\alpha$
true. Not most of them. All of them.

That is why proofs feel so strict. To prove something you have to rule out every world in
which the knowledge base holds and the conclusion fails, including the strange ones you did
not think of.

### The one mistake everyone makes

`∀` goes with `→`. `∃` goes with `∧`. Swap them and you write nonsense that still parses.

$$
\forall x \, \bigl(Cat(x) \land Loves(x, fish)\bigr)
$$

does not say "every cat loves fish". It says **every object in the universe is a cat**, and
also loves fish. Your chair, the number 7, Belgium: all cats.

$$
\exists x \, \bigl(Cat(x) \rightarrow Loves(x, fish)\bigr)
$$

does not say "some cat loves fish". An implication is true whenever its antecedent is false, so
this sentence is satisfied by any object that simply is not a cat. My laptop makes it true. It
asserts almost nothing.

The intuition: `→` inside `∀` is a filter, it narrows the universe down to the things you meant.
`∧` inside `∃` is a conjunction of demands, it says the witness must satisfy both. I still check
this every time I write a quantified sentence.

---

## 3. Saying things in first-order logic

| English | First-order logic |
|---|---|
| "All surgeons are doctors." | $\forall x \,(Surgeon(x) \rightarrow Doctor(x))$ |
| "Some doctor loves Alice." | $\exists y \,(Doctor(y) \land Loves(y, alice))$ |
| "No cat is a dog." | $\forall x \,\lnot(Cat(x) \land Dog(x))$ |
| "There is exactly one king." | $\exists k \,(King(k) \land \forall x \,(King(x) \rightarrow x = k))$ |

That last one is worth reading twice, because it shows what equality buys you. "At least one
king" is easy. "At most one" needs the second clause: anything that is a king has to *be* that
same king. Uniqueness is not a primitive, you build it out of equality.

### Quantifier order is not decoration

Swapping two adjacent quantifiers of different kinds changes the meaning completely.

$$
\forall x \, \exists y \; Loves(x, y)
\qquad\text{versus}\qquad
\exists y \, \forall x \; Loves(x, y)
$$

The first says everybody loves somebody, and each person may love a different somebody. The
second says there is one specific person whom everybody loves. The first is a mild claim about
a population. The second is a claim about a celebrity. Same four symbols, different order.

The practical rule when translating: read left to right and picture the choices being made in
that order. A later quantifier is allowed to depend on an earlier one. An earlier one cannot
depend on a later one. This is exactly the dependency that Skolemisation makes explicit in
section 5.3, so it is worth getting comfortable with now.

---

## 4. Knowledge engineering that survives contact

Writing a few sentences is easy. Writing a knowledge base that stays consistent after six months
of edits is the actual skill. Four things I would tell my earlier self:

**Pick function or relation, and never both.** If a thing is total and single-valued, use a
function: everyone has exactly one biological mother, so `MotherOf(x)` is right. If it can be
missing or plural, use a relation: `Parent(x, y)`. Modelling the same fact both ways is how you
end up with two half-populated views of the world that quietly disagree.

**Decide your assumptions explicitly.** Pure first-order logic makes neither the **unique names
assumption** (different constants may denote the same object) nor the **closed world
assumption** (anything not provable is false). Databases and Prolog make both, which is why
Prolog's `\+` means "not provable" rather than "false". Neither choice is wrong, but silently
mixing them produces bugs that look like the prover is broken. Write down which one you are in.

**Layer the knowledge base.** Facts, then domain rules, then meta-rules. Keep each layer small
enough to read in one sitting. When something contradicts, you want to know which layer to
blame.

**Run a prover after every batch of rules.** Add the sentences, then ask the solver whether the
knowledge base is still satisfiable. An inconsistent knowledge base entails everything, so it
will happily "prove" your query and you will believe it. Catching that on the day you introduce
it is worth far more than catching it a month later.

### What changed since this post was first written

Most working engineers in 2026 never touch a classical first-order theorem prover. They meet
the same machinery through three doors instead:

- **SMT solvers.** Z3 and cvc5 are first-order provers with built-in theories for arithmetic,
  arrays and bit-vectors. They handle quantifiers through E-matching and model-based
  quantifier instantiation, neither of which is a decision procedure for full first-order
  logic, so `unknown` is a genuine answer you must handle. This is what sits under Dafny,
  F\*, and a good deal of production symbolic execution. AWS analyses IAM and S3 policies
  with an SMT-backed tool of exactly this kind.
- **Datalog.** A function-free, negation-restricted fragment where forward chaining always
  terminates and runs in time polynomial in the size of the data. Soufflé compiles it to
  parallel C++ and is the engine behind serious points-to analyses such as Doop.
- **Description logics.** OWL and the knowledge-graph world use carefully chosen decidable
  fragments of first-order logic, trading expressiveness for a guarantee of termination.

There is also a newer pattern worth naming. Rather than trusting a language model's own chain
of reasoning, you use it as a **translator**: natural language in, formal sentences out, then
hand those to a solver that is actually sound. The model does the part it is good at, guessing
a formalisation, and the solver does the part it is good at, refusing to be wrong. If you want
verified reasoning in a product today, that split is the honest architecture.

---

## 5. Inference: how you actually prove things

### 5.1 Unification, the workhorse

Every first-order inference rule needs one primitive: given two patterns, find the assignment of
variables that makes them the same expression. Programmers already know this as destructuring
with pattern matching, except it matches in both directions at once and remembers what it bound.

```
Knows(john, y)   and   Knows(x, MotherOf(x))

θ = { x/john , y/MotherOf(john) }
```

Note that `y` did not get bound to a constant. It got bound to a whole term, one built out of
what `x` was bound to, and applying θ to both sentences has to leave them literally identical.
The substitution you want is the **most general unifier**: the one that commits to as little
as possible, so downstream inferences stay as widely applicable as they can.

Here is a unifier that actually runs:

```python
Var = str                      # a variable is a string starting with "?"
Compound = tuple               # ("Knows", "john", ("MotherOf", "?x"))


def is_var(t):
    return isinstance(t, Var) and t.startswith("?")


def unify(x, y, subst):
    """Most general unifier of x and y, extending subst. None means failure."""
    if subst is None:          # threading failure through keeps callers simple
        return None
    if x == y:
        return subst
    if is_var(x):
        return unify_var(x, y, subst)
    if is_var(y):
        return unify_var(y, x, subst)
    if isinstance(x, Compound) and isinstance(y, Compound):
        if len(x) != len(y):   # different arity, so no substitution can help
            return None
        for a, b in zip(x, y):  # element 0 is the functor, compared like any term
            subst = unify(a, b, subst)
        return subst
    return None


def unify_var(var, x, subst):
    if var in subst:
        return unify(subst[var], x, subst)
    if is_var(x) and x in subst:
        return unify(var, subst[x], subst)
    if occurs(var, x, subst):
        return None            # ?x = MotherOf(?x) has no finite solution
    return {**subst, var: x}


def occurs(var, t, subst):
    if var == t:
        return True
    if is_var(t) and t in subst:
        return occurs(var, subst[t], subst)
    if isinstance(t, Compound):
        return any(occurs(var, a, subst) for a in t)
    return False


print(unify(("Knows", "john", "?y"),
            ("Knows", "?x", ("MotherOf", "?x")), {}))
# {'?x': 'john', '?y': ('MotherOf', '?x')}
```

That dictionary is the same unifier as the θ above, left unresolved: `?y` maps to a term that
still mentions `?x`, and you chase the bindings when you apply it. Resolve it all the way and
you get `?y/MotherOf(john)`. Most implementations keep it lazy like this, so apply the
substitution until it stops changing, not once.

Two details that matter in real systems.

**The occurs check.** Unifying `?x` with `MotherOf(?x)` should fail, because no finite term
satisfies it. Standard Prolog **omits this check by default**, because it costs time on every
unification, and the result is that Prolog will happily build a cyclic term and become unsound.
SWI-Prolog gives you `unify_with_occurs_check/2` when you need the honest version. That is a
real trade-off, chosen deliberately, not a bug.

**Standardising apart.** Before using a rule you rename its variables to fresh ones. Otherwise
the `x` in the rule collides with an unrelated `x` in the query and unification fails for no
good reason.

### 5.2 Forward versus backward chaining

Both start from the same knowledge base and get to the same conclusions. They differ in which
end they push from, and that difference decides which one you should use.

```
  KB:  human(?x) → mortal(?x)        Query:  mortal(socrates)?
       human(socrates)
       human(plato)

  FORWARD (data-driven)             BACKWARD (goal-driven)
  ─────────────────────             ──────────────────────
  human(socrates) ─┐                mortal(socrates)
  human(plato)    ─┤                      │  unify with rule head
                   │ fire rule            │  θ = {?x/socrates}
                   ▼                      ▼
  mortal(socrates)                  human(socrates)
  mortal(plato)   ← derived,              │  matches a fact
                    nobody asked          ▼
                                        proved

  work grows with the KB            work grows with the query
```

**Forward chaining** starts with the facts and fires every rule whose premises are satisfied,
adding what it derives, until nothing new appears. Index your predicates so retrieving matching
facts is a hash lookup, and keep an agenda of newly derived facts so you only reconsider rules
that could have been newly triggered. That agenda idea, generalised, is the RETE algorithm in
business rule engines, and semi-naive evaluation in Datalog.

It is the right choice when you have many facts, few queries, and the queries are unpredictable:
you pay once and answer instantly. It is also the choice that terminates. For Datalog (no
function symbols) the set of derivable facts is finite, so forward chaining always halts. Add
function symbols and it need not: `successor(?x)` will cheerfully generate integers forever.

**Backward chaining** starts from the query and works out what would have to be true. It is
Prolog, more or less exactly: backward chaining plus depth-first search plus unification.

```prolog
mortal(X) :- human(X).
human(socrates).
human(plato).

?- mortal(socrates).
true.

?- mortal(Who).
Who = socrates ;
Who = plato.
```

It is the right choice when the fact base is enormous and each query touches a slice of it. You
only ever do work relevant to the goal.

The catch is that depth-first search is **incomplete**. Write your rule the natural way round
and Prolog loops forever before it ever tries a fact:

```prolog
% left recursion: the first subgoal is the goal again
ancestor(X, Y) :- ancestor(X, Z), parent(Z, Y).
ancestor(X, Y) :- parent(X, Y).
```

Two fixes. The cheap one is discipline: base case first, recursive call last. The proper one is
**tabling**, also called SLG resolution, which memoises subgoals and detects the loop.
SWI-Prolog and XSB both support it with a directive:

```prolog
:- table ancestor/2.
```

Or write it in Datalog and let the engine handle recursion for you, which is what Datalog is
for:

```prolog
.decl parent(a: symbol, b: symbol)
.decl ancestor(a: symbol, b: symbol)

ancestor(x, y) :- parent(x, y).
ancestor(x, y) :- ancestor(x, z), parent(z, y).

.output ancestor
```

### 5.3 Getting to clausal form

Resolution needs everything in one flat shape: a conjunction of clauses, each clause a
disjunction of literals, no quantifiers left. Converting is mechanical. This is the classic
worked example, and the interesting step is the third one:

```
  "Everyone who loves all animals is loved by someone."
        │
        ▼  translate
  ∀x [ ∀y (Animal(y) → Loves(x,y)) ] → [ ∃z Loves(z,x) ]
        │
        ▼  eliminate →, push ¬ inwards past the quantifiers
  ∀x [ ∃y (Animal(y) ∧ ¬Loves(x,y)) ] ∨ [ ∃z Loves(z,x) ]
        │
        ▼  Skolemise: each ∃ inside ∀x becomes a function of x
  ∀x [ (Animal(F(x)) ∧ ¬Loves(x,F(x))) ] ∨ Loves(G(x),x)
        │
        ▼  drop ∀, distribute ∨ over ∧
  Animal(F(x))     ∨ Loves(G(x),x)
  ¬Loves(x,F(x))   ∨ Loves(G(x),x)
```

**Skolemisation** is the step worth understanding rather than memorising. "There exists a `y`"
means you can name one, so name it. But if that `y` sits inside a `∀x`, the witness is allowed
to be different for each `x`, so the name has to depend on `x`. It becomes a function symbol,
`F(x)`, invented on the spot. That is quantifier order from section 3, made into syntax.

Skolemisation does not preserve logical equivalence. It preserves **satisfiability**, which is
all a refutation proof needs.

### 5.4 First-order resolution

One rule. Take two clauses, find a literal `L` in the first and a literal `¬L'` in the second
such that `L` and `L'` unify with most general unifier θ, and derive the union of what is left,
with θ applied throughout.

To prove $KB \models \alpha$, you never prove $\alpha$ directly. You add $\lnot\alpha$ to the
knowledge base, convert everything to clauses, and resolve until you derive the **empty
clause**, a clause with no literals left, which cannot be satisfied by anything. That means the
knowledge base plus the negated query is contradictory, which means the knowledge base entails
the query.

Socrates in four lines:

```
  1. ¬Human(x) ∨ Mortal(x)      from  ∀x Human(x) → Mortal(x)
  2. Human(socrates)            fact
  3. ¬Mortal(socrates)          the NEGATED goal
  ────────────────────────────────────────────────────────────
  4. Mortal(socrates)           resolve 1,2 with θ = {x/socrates}
  5. ⊥  (empty clause)          resolve 3,4
```

Resolution is **refutation-complete**, which is a narrower promise than "complete" and worth
stating carefully: if a set of clauses is unsatisfiable, resolution will eventually derive the
empty clause. If it is satisfiable, resolution may search forever. The semi-decidability from
section 1 has not gone anywhere, it has just taken a specific shape.

Naive resolution is also unusable in practice, because the number of derivable clauses explodes.
Real provers such as Vampire and E, which have dominated the CASC competition for years, run a
given-clause loop with heavy machinery on top: **ordered resolution and superposition** so
equality is handled natively rather than through axioms, **subsumption** to throw away clauses
weaker than ones you already have, and **demodulation** to rewrite with known equalities. The
one rule is the theory. Everything that makes it fast is engineering.

You are far more likely to reach for an SMT solver, where the same refutation idea is one API
call:

```python
from z3 import (DeclareSort, Function, BoolSort, Const, ForAll,
                Implies, Not, Solver)

Person = DeclareSort("Person")
human = Function("human", Person, BoolSort())
mortal = Function("mortal", Person, BoolSort())
socrates = Const("socrates", Person)
x = Const("x", Person)

s = Solver()
s.add(ForAll([x], Implies(human(x), mortal(x))))
s.add(human(socrates))
s.add(Not(mortal(socrates)))   # negate the goal, same refutation trick
print(s.check())               # unsat  =>  the goal follows from the KB
```

`unsat` is your proof. Treat `unknown` as "the quantifier heuristics gave up", not as "no".

---

## 6. Try it yourself

1. **Family tree.** Encode `parent`, `ancestor` and `sibling` in Prolog, then prove
   `ancestor(alice, bob)`. Now write `ancestor` left-recursively and watch it hang. Add
   `:- table ancestor/2.` and watch it stop hanging.
2. **Count the blow-up.** Take three first-order sentences about a domain of five objects and
   expand them into ground propositional instances. Count the clauses, then redo it for fifty
   objects. That growth curve is the argument for lifting.
3. **Break unification.** Delete the `occurs` check from the unifier above and unify `?x` with
   `("MotherOf", "?x")`. Then work out what nonsense a prover could now derive.

---

## 7. The short version

- Propositional logic's atoms have no interior, so you write one rule per case. First-order
  logic adds objects, relations, functions and quantifiers, so you write the rule once.
- You pay in decidability. First-order entailment is semi-decidable, so every prover has a
  timeout and a timeout means "I do not know", never "no".
- `∀` pairs with `→`, `∃` pairs with `∧`. Swap them and you get a sentence that parses fine and
  means something absurd.
- Quantifier order carries real meaning, and Skolemisation is that dependency turned into a
  function symbol.
- Unification is the primitive under everything. Keep the occurs check unless you have measured
  a reason not to, and standardise variables apart before every rule application.
- Forward chaining for many facts and unpredictable queries, backward chaining for huge fact
  bases and narrow queries. Prolog is backward chaining with depth-first search, so mind the
  left recursion and reach for tabling.
- Resolution is refutation-complete on one rule. Everything that makes real provers fast,
  ordering, subsumption, demodulation, is engineering on top of that rule.
- In 2026 you will most likely meet all of this as Z3 or cvc5, as Datalog in Soufflé, or as a
  language model translating English into sentences a sound solver then checks.

---

*Series: **AI Foundations**. Next up, we stop asking what is true and start asking what to do
about it: [classical planning](/posts/2024/01/classical-planning/), where STRIPS turns a to-do
list into an algorithm that guarantees the order works.*
