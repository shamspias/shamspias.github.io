---
title: "Math for AI Made Simple: The Linear-Algebra Lego Set Behind Every Model"
description: "Scalars, vectors, matrices and tensors, the five operations every neural network is made of, and the shape rules that cause most of the bugs."
date: 2023-01-23
permalink: "/posts/2023/01/math-for-ai-linear-algebra-basics/"
tags:
  - "math"
  - "AI"
  - "linear algebra"
  - "beginner"
  - "python"
series: "AI Foundations"
seriesOrder: 1
math: true
---

*Part 1 of the AI Foundations series. Every model you will ever train is four shapes of number
and five things you can do to them. Here is the whole set, plus the shape rules that cause most
of the bugs and the reason batching exists at all.*

---

## 1. Why this is the maths that matters

A neural network, stripped of the branding, does three things. It **stores numbers** (the
weights). It **mixes those numbers with your input** (multiply, add, scale). It **measures how
wrong the result was** (the loss). Linear algebra is the language of the middle step, and the
middle step is where essentially all the compute goes.

Precisely: a dense layer, meaning one layer in which every input touches every output, computes
$y = xW^{\top} + b$. A transformer block is a handful of those plus a similarity score that is
itself a pile of dot products, the move defined in section 3. When people report that a model
took 10²⁵ floating-point operations to train, almost every one of those operations happened
inside a matrix multiply.

So you do not need proofs. You need two things: fluency with **shapes**, because that is what
breaks, and a feel for **where the time and memory go**, because that is what you will be
paid to fix. This post gives you both. If you want the geometric intuition on top, 3Blue1Brown's
[Essence of Linear Algebra](https://www.3blue1brown.com/topics/linear-algebra) is still the best
thing on the internet for it.

---

## 2. Four shapes of number

Everything is one array type wearing different numbers of dimensions.

| Everyday object | Name   | Shape in code | What it actually is in a model     |
|-----------------|--------|---------------|------------------------------------|
| A single marble | Scalar | `()`          | Learning rate, a bias term, a loss |
| A row of beads  | Vector | `(n,)`        | One word embedding, one gradient   |
| A chessboard    | Matrix | `(m, n)`      | One layer's weights, a grey image  |
| A Rubik's cube  | Tensor | `(*dims)`     | A batch of images, a batch of text |

```
rank 0  scalar   ()             ┌─┐
                                └─┘         learning rate, 3e-4

rank 1  vector   (768,)         ┌─┬─┬─┬─┬─┐
                                └─┴─┴─┴─┴─┘  one token's embedding

rank 2  matrix   (768, 768)     ┌─┬─┬─┬─┬─┐
                                ├─┼─┼─┼─┼─┤
                                ├─┼─┼─┼─┼─┤  one layer's weight grid
                                └─┴─┴─┴─┴─┘

rank 3  tensor   (8, 512, 768)  ┌─┬─┬─┬─┬─┐┐┐
                                ├─┼─┼─┼─┼─┤││  8 sequences, 512 tokens
                                ├─┼─┼─┼─┼─┤││  each, 768 numbers per
                                └─┴─┴─┴─┴─┘┘┘  token
```

One honest correction, because it confuses people who studied physics or maths first. In those
fields a tensor is a multilinear map with strict rules about how its components change under a
change of basis. In machine learning, "tensor" just means "array with any number of dimensions".
PyTorch and NumPy use the loose meaning. Nothing you read in an ML paper depends on the strict
one, so let the word go.

The Lego picture still holds, and it is worth keeping: a scalar is one brick, a vector is a
row of bricks, a matrix is a flat baseplate, a tensor is a stack of baseplates. Rank is just
how many numbers you need to point at a single brick.

---

## 3. The five moves

| Move             | What you type    | Where you meet it                        |
|------------------|------------------|------------------------------------------|
| Add vectors      | `a + b`          | Residual connections, summing gradients  |
| Scale            | `c * v`          | Learning rate times gradient             |
| Dot product      | `a @ b`          | Similarity, one neuron's output          |
| Matrix by vector | `A @ x`          | One dense layer, one sample              |
| Matrix by matrix | `A @ B`          | One dense layer, a whole batch           |

Three more you will use weekly: `A.T` flips rows and columns, `np.eye(n)` is the do-nothing
matrix, and `np.outer(a, b)` builds a full matrix from two vectors (which is exactly the shape a
weight gradient takes).

```python
import numpy as np

x = np.array([1.0, 2.0, 3.0])            # vector, shape (3,)
W = np.array([[0.5, -1.2, 0.3],          # matrix, shape (2, 3)
              [1.7,  0.0, 0.8]])
b = np.array([0.1, -0.1])                # bias,   shape (2,)

y     = W @ x + b                        # matrix-vector, shape (2,)
sim   = x @ x                            # dot product, a plain scalar
outer = np.outer(x, x)                   # shape (3, 3)

print(y.shape, y)                        # (2,) [-0.9  4. ]
print(sim)                               # 14.0
print(outer.shape)                       # (3, 3)
```

Two habits worth forming now, because the older tutorials will tell you otherwise.

**Use `@`, not `np.dot`.** They agree on 1-D and 2-D inputs, but they disagree the moment you
add a batch axis: `@` broadcasts over the leading dimensions and multiplies the last two,
which is what you want, while `np.dot` does a sum-product over a different pair of axes and
quietly returns a four-dimensional array. Every real model has a batch axis, so start as you
mean to go on.

**Never use `np.matrix`.** It exists, it makes `*` mean matrix multiplication, and NumPy's own
docs have discouraged it for years. Regular arrays with `@` are the answer.

When an expression gets hard to read, name the axes instead of counting them:

```python
np.einsum("bi,oi->bo", x_batch, W, optimize=True)    # same as x_batch @ W.T
```

That documents the intent, but do not assume it is free. In PyTorch and JAX `einsum` lowers to
the same matmul kernel and costs nothing. In NumPy it does not: with the default
`optimize=False` it runs its own loop instead of dispatching to BLAS, and on my laptop a
512 by 512 case took roughly thirty times as long as `a @ b.T`. Pass `optimize=True` on anything
hot. The `einops` library does the same job for reshapes and permutations, and is worth the
dependency in any codebase where people have to read each other's tensor code.

---

## 4. What a matrix actually does

Take the milkshake machine. Your order is a vector, `x = [1, 0, 1]`, meaning chocolate yes,
vanilla no, strawberry yes. The machine's recipe book is a matrix `W` with one row per drink it
knows how to make. Multiply `W @ x` and each row tastes your order and returns one number: how
much of that drink to pour. Change the rows and the drinks change. That is training.

Precisely: **each row of a matrix is a vector, and a matrix-vector product is that row's dot
product with your input.** A layer with 3,072 outputs is 3,072 rows, each asking one question of
the same input, all at once. The dot product answers "how much does this input point in the
direction I care about", which is why the same operation shows up as a similarity score, as a
projection, and as one neuron's pre-activation. It is all one move.

This is also what attention is. Every query vector takes a dot product with every key vector, so
the entire similarity table is one matrix multiply, $QK^{\top}$. If that sentence is the
interesting one for you, [Transformers and attention made
simple](/posts/2022/06/transformers-attention-made-simple/) picks it up from there.

Geometrically, a matrix rotates, stretches, shears and projects. The rows are the questions, the
shape tells you the answer's size, and the numbers inside are the only part gradient descent is
allowed to change.

---

## 5. Shapes are the whole game

Almost every bug you hit in the first year is a shape bug. There are exactly two rules.

**Rule one: for `A @ B`, the inner dimensions must match, and they disappear.**

```
                (m, n) @ (n, p)  ->  (m, p)
                    │     │
                    └─────┘
                these must be equal, and they cancel

  a real dense layer, batch of 32 tokens, 768 in, 3072 out:

        x         (32,  768)
        W.T       (768, 3072)
        ---------------------
        x @ W.T   (32, 3072)      the 768 cancels
```

**Rule two: [broadcasting](https://numpy.org/doc/stable/user/basics.broadcasting.html) lines
shapes up from the right, pads the left with 1s, and stretches any axis of length 1.**

```
   x      (32, 1, 768)
   bias   (       768,)
          --------------
   align  (32, 1, 768)
          ( 1, 1, 768)    bias is padded on the left with 1s
          --------------
   result (32, 1, 768)    ok


   x      (32, 768)
   y      (768, 32)
          --------------
   align  ( 32, 768)
          (768,  32)      32 against 768, neither is 1
          --------------
   result ValueError      no stretch is possible
```

Broadcasting is the dangerous one, because it succeeds when you wanted it to fail. Adding a
`(32,)` vector to a `(32, 1)` column silently gives you a `(32, 32)` matrix and a loss that
never converges, and nothing raises.

| Mistake                   | What you see                        | What to do                |
|---------------------------|-------------------------------------|---------------------------|
| Inner dims disagree       | `ValueError: shapes (2,3) and (4,)` | Compare shapes, transpose |
| Row and column confused   | Wrong numbers, no error             | Use `reshape(-1, 1)`      |
| Accidental broadcast      | Loss will not fall, no error        | Assert the expected shape |
| Assuming `A @ B == B @ A` | Wrong numbers, no error             | Matmul does not commute   |

The cheapest defence I know is one line per layer:

```python
assert y.shape == (batch, out_features), y.shape
```

Two modern details worth knowing. NumPy 2.0 added `.mT`, which transposes only the last two axes
and is what you almost always want on a batched array; plain `.T` reverses every axis, which
on a `(8, 512, 768)` tensor gives you `(768, 512, 8)` and a mess. Use `np.random.default_rng()`
rather than the legacy `np.random.seed()` plus `np.random.randn()` pair that older tutorials
still show.

One more piece of stale advice to retire: `np.linalg.inv(A)` is almost never the right call. If
you want to solve $Ax = b$, use `np.linalg.solve(A, b)`, or `np.linalg.lstsq` when the system is
overdetermined. Both are faster and far better behaved numerically. Explicit inverses in deep
learning are rare enough that seeing one should make you suspicious.

---

## 6. Where the time and memory actually go

Here is the fact that turns this from vocabulary into engineering. A matrix-vector product and a
matrix-matrix product do very different amounts of work per byte read from memory.

```
 One 4096 x 4096 weight matrix in float32 is 67 MB to read from memory.

   batch 1     work   2 x 1 x 4096 x 4096   =  0.034 GFLOP
               read   67 MB of weights
               ratio  0.5 FLOP per byte     memory-bound, GPU waits

   batch 256   work   2 x 256 x 4096 x 4096 =  8.6 GFLOP
               read   67 MB of weights, the same 67 MB
               ratio  128 FLOP per byte     compute-bound, GPU works

 Same weights, 256 times the work, near-identical memory traffic.
 That is the entire reason batching exists.
```

The FLOP count for a dense layer is $2 \times B \times m \times n$: one multiply and one add per
weight per sample. Memorise it and you can cost any model on the back of an envelope.

Three practical consequences:

- **Keep hidden dimensions round.** Tensor cores, the GPU units that do the matrix multiplies,
  work on fixed-size tiles, so dimensions that are multiples of 64 or 128 hit the fast path. A
  hidden size of 769 can be meaningfully slower than 768 for no gain.
- **Precision changes the answer, not just the speed.** Floating-point addition is not
  associative at any precision, but in the 16-bit formats used for training (bfloat16, float16)
  the rounding error is large enough to see, so the same matmul on a different GPU or with a
  different batch size can give slightly different numbers. This is expected, not a bug. Do not
  spend a day hunting it.
- **Single-sample inference is memory-bound.** If you are serving one request at a time and the
  GPU shows low utilisation, the weights are the bottleneck, not the arithmetic. Batching or
  quantising helps; a faster GPU often does not.

---

## 7. Do it by hand, once

Do these on paper. It takes ten minutes and it makes the shape rules stop being abstract.

**Dot product.**

$$
\mathbf a = (2,\,-1,\,4), \qquad \mathbf b = (1,\,0,\,3)
$$

$$
\mathbf a \cdot \mathbf b = 2\cdot 1 + (-1)\cdot 0 + 4\cdot 3 = 14
$$

**Matrix by vector.** Note the shapes: $(3,2)$ times $(2,)$ gives $(3,)$.

$$
A = \begin{bmatrix} 1 & 2 \\ 0 & -1 \\ 3 & 4 \end{bmatrix},
\qquad
x = \begin{bmatrix} 2 \\ 1 \end{bmatrix}
$$

$$
Ax = \begin{bmatrix} 1\cdot 2 + 2\cdot 1 \\ 0\cdot 2 + (-1)\cdot 1 \\ 3\cdot 2 + 4\cdot 1
\end{bmatrix} = \begin{bmatrix} 4 \\ -1 \\ 10 \end{bmatrix}
$$

Then write the layer yourself, in the same convention PyTorch uses. Its
[`nn.Linear`](https://pytorch.org/docs/stable/generated/torch.nn.Linear.html) stores its
`weight` with shape `(out_features, in_features)`, which is why the transpose is there:

```python
def dense(x, W, b):
    """W is (out, in), matching torch.nn.Linear, so we transpose it here."""
    return x @ W.T + b

rng = np.random.default_rng(0)
x = rng.standard_normal((5, 3))          # 5 samples, 3 features each
W = rng.standard_normal((4, 3))          # 4 outputs, 3 inputs
b = rng.standard_normal(4)

print(dense(x, W, b).shape)              # (5, 4)
```

Then break it deliberately. Pass `W` without the transpose and read the error. Then give `b` the
shape `(5, 1)`, a column instead of a row: it broadcasts along the feature axis, adds one
sample's number to all four of that sample's outputs, and hands back the `(5, 4)` you expected,
so even the shape assert passes. That second one is the bug you will actually meet. A `(5,)`
bias, by contrast, fails loudly: 5 against 4 on the last axis, and neither is 1.

---

## 8. The short version

- Four shapes: scalar, vector, matrix, tensor. In ML, "tensor" just means "array with n
  dimensions", nothing stricter.
- Five moves: add, scale, dot, matrix by vector, matrix by matrix. Everything else is built from
  these.
- A matrix-vector product is one dot product per row. Each row is a question asked of the input,
  and training edits the questions.
- Use `@`, not `np.dot`, once a batch axis exists. Skip `np.matrix` entirely, and prefer
  `np.linalg.solve` over `np.linalg.inv`.
- Two shape rules: inner dimensions must match and then cancel, and broadcasting aligns from the
  right while stretching axes of length 1.
- The dangerous bugs are the ones that do not raise. Assert the output shape of every layer, and
  watch bias shapes: a column bias broadcasts silently and the assert still passes.
- A dense layer costs $2Bmn$ FLOPs. Batch size barely changes memory traffic but multiplies the
  work, which is why batching is the first performance lever you reach for.
- Keep hidden sizes on multiples of 64 or 128, and expect small numeric differences in bfloat16.
  Both are normal.

*Part 2 puts these shapes to work: [Machine Learning 101, PyTorch, TensorFlow and decision
trees](/posts/2023/02/ml-101-pytorch-tf-decision-tree/), where the same problem gets solved two
different ways and you learn which one to reach for.*
