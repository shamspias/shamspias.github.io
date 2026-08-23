---
title: "Machine Learning 101: PyTorch, TensorFlow & Decision Trees"
description: "What a deep-learning framework actually does for you, how a decision tree picks its questions, and which of the three to reach for on real data."
date: 2023-02-13
permalink: "/posts/2023/02/ml-101-pytorch-tf-decision-tree/"
tags:
  - "machine learning"
  - "deep learning"
  - "pytorch"
  - "tensorflow"
  - "decision tree"
  - "beginner"
  - "python"
series: "AI Foundations"
seriesOrder: 2
math: true
---

*Part 2 of AI Foundations. Part 1 gave you the shapes of numbers. This part gives you the two
tools that move them: a framework that does calculus for you, and a tree that asks yes/no
questions. I have written this post twice now, and the first version was too kind to
TensorFlow.*

---

## 1. What a framework is actually for

Suppose you have to count every marble in a swimming pool by hand. You could do it. You would
rather not. In machine learning the marbles are millions of numbers, and the counting happens
thousands of times per second.

A framework is the thing that does the counting. Precisely, PyTorch and TensorFlow give you
four services, and it is worth knowing which is which, because people say "framework" when
they mean only one of them:

| Service | What it does | Why you cannot skip it |
|---|---|---|
| Tensors | n-dimensional arrays, one number type (dtype), one device | NumPy is CPU-only |
| Autograd | records every op, replays it backwards | hand-derived gradients hide bugs |
| Optimisers | SGD, Adam, AdamW, learning-rate schedules | you would reimplement them badly |
| Dispatch | picks a compiled kernel per device | the same line runs on CPU, CUDA, Metal |

Autograd is the one that matters. (NumPy is Python's standard array library; SGD, Adam and
AdamW are the three optimisers you will meet in every codebase.) Everything else on that list
you could write in a weekend. Automatic differentiation is the reason nobody has derived a
gradient by hand since about 2015.

```
  your code   loss = loss_fn(model(x), y);  loss.backward()
                                      │
                                      ▼
              ┌────────────────────────────────────────────────┐
              │  tensors    n-d arrays, one dtype, one device  │
  framework   │  autograd   tape of ops, replayed backwards    │
              │  optimisers SGD, Adam, AdamW, schedules        │
              │  dispatch   one compiled kernel per device     │
              └────────────────────────────────────────────────┘
                                      │
                                      ▼
  hardware    CPU (AVX)   GPU (CUDA / ROCm / Metal)   TPU
```

Autograd works because of the chain rule. If $L$ depends on $w$ through a chain of operations,
the framework stores each link on the forward pass and multiplies the local derivatives on the
way back:

$$
\frac{\partial L}{\partial w} = \frac{\partial L}{\partial z_n}
\cdot \frac{\partial z_n}{\partial z_{n-1}} \cdots \frac{\partial z_1}{\partial w}
$$

That is the whole trick. The cost is memory: every intermediate value on the forward pass has
to be kept until the backward pass consumes it, which is why activation memory, not parameter
count, is usually what makes you run out of GPU.

---

## 2. PyTorch and TensorFlow in 2026

When I first wrote this post, the honest answer was "PyTorch for research, TensorFlow for
production". That answer has expired. Here is where things actually stand.

**PyTorch won the default slot.** It runs most published research, most open-weight model
releases, and a large share of production inference. `torch.compile`, which arrived with
PyTorch 2.0 in 2023, closed the one real gap: you now get graph capture and kernel fusion
without giving up ordinary Python control flow. You write a loop, you add one decorator, you
get a compiled graph.

**TensorFlow is maintained, not fashionable.** It is still a perfectly good piece of software
and there is an enormous amount of it deployed. But new projects rarely start there, and the
on-device story got renamed: TensorFlow Lite is now LiteRT, and it happily runs models that
came from PyTorch or JAX.

**Keras stopped being a TensorFlow thing.** Keras 3 is multi-backend. The same
`keras.Sequential` code runs on TensorFlow, PyTorch or JAX depending on one environment
variable. If you like the Keras API, you no longer have to buy TensorFlow to get it.

**JAX is the third framework.** Functional, composable transforms (`jit`, `grad`, `vmap`,
`shard_map`), heavy use inside Google DeepMind and in a lot of large-scale training code. It is
not a beginner's tool, but you should know the name so you are not surprised by it.

| | PyTorch | TensorFlow / Keras 3 | JAX |
|---|---|---|---|
| Feels like | Python plus NumPy | layers you stack and `fit` | NumPy with a compiler |
| Debugging | `print()` and `pdb` work | one layer removed | trace-time errors are cryptic |
| Speed lever | `torch.compile` | XLA via `jit_compile=True` | `jax.jit`, always on |
| On device | ExecuTorch, ONNX Runtime | LiteRT | via export |
| Start here if | you are learning | you inherited a Keras codebase | you train at huge scale |

If you are starting today with no legacy to respect: learn PyTorch. Learn Keras 3 second, if
you want the short path to a trained model. Learn JAX when someone pays you to.

### 2.1 The same model in both

A linear regression, fit twice. This is the smallest complete thing a framework can do, and it
shows you the whole loop.

```python
import torch
from torch import nn

x = torch.randn(100, 1)
y = 3 * x + 0.5 + 0.1 * torch.randn_like(x)

model = nn.Linear(1, 1)
opt = torch.optim.SGD(model.parameters(), lr=0.1)
loss_fn = nn.MSELoss()

for _ in range(300):
    opt.zero_grad()  # gradients accumulate by default, so clear them first
    loss = loss_fn(model(x), y)
    loss.backward()
    opt.step()

print(model.weight.item(), model.bias.item())  # about 3.0 and 0.5
```

The `opt.zero_grad()` line is the one beginners drop. PyTorch accumulates gradients rather than
overwriting them, because that is what you want for gradient accumulation across micro-batches.
Forget it and your model quietly trains on the sum of every batch it has ever seen.

```python
import keras
import numpy as np

rng = np.random.default_rng(0)
x = rng.normal(size=(100, 1)).astype("float32")
y = (3 * x + 0.5 + 0.1 * rng.normal(size=(100, 1))).astype("float32")

model = keras.Sequential([keras.Input(shape=(1,)), keras.layers.Dense(1)])
model.compile(optimizer=keras.optimizers.SGD(learning_rate=0.1), loss="mse")
model.fit(x, y, epochs=300, batch_size=100, verbose=0)

w, b = model.get_weights()
print(w.ravel()[0], b[0])  # about 3.0 and 0.5
```

Same maths, same answer. The difference is where the loop lives: PyTorch hands it to you,
Keras hides it inside `fit`. That is the entire philosophical argument between the two camps,
and it matters far less than either camp claims.

One detail worth stealing: `batch_size=100` makes Keras do full-batch updates, matching the
PyTorch loop. Leave it at the default of 32 and you get four updates per epoch instead of one,
which converges faster and makes the two snippets look like they disagree when they do not.

---

## 3. Decision trees: twenty questions, formalised

Now the other tool, and the one I reach for more often than people expect.

Picture a basket of apples and oranges. You want a machine to tell them apart. You ask a yes/no
question, put the yes fruits on the left and the no fruits on the right, and repeat on each pile
until a pile holds only one kind of fruit. To classify a new fruit, start at the top and follow
the answers down.

That is a decision tree. It is a flow chart, learned from data.

```
            38 fruits: 20 apples, 18 oranges
                        H = 0.998
                            │
             ┌──────────────┴──────────────┐
       colour ≤ 0.5                  colour > 0.5
             │                             │
   18 oranges, 0 apples          20 apples, 0 oranges
         H = 0.000                     H = 0.000
             │                             │
        [ orange ]                     [ apple ]

  Gain = 0.998 - ( 18/38 x 0.000 + 20/38 x 0.000 ) = 0.998
```

### 3.1 How the tree picks a good question

It picks the question that makes the piles cleaner. To do that it needs a number for messiness,
and the usual one is **entropy**:

$$
H(S) = -\sum_{c} p_c \log_2 p_c
$$

where $S$ is a pile, $c$ ranges over the classes, and $p_c$ is the fraction of the pile that
belongs to class $c$. Read it as "how surprised am I by the next fruit I pull out of this pile".
A pile of pure apples has no surprise left in it, so $H = 0$. A pile that is exactly half and
half is maximally surprising, so $H = 1$ bit.

```
  H  1.0 ┤           ╭───╮
         │       ╭───╯   ╰───╮
     0.5 ┤    ╭──╯           ╰──╮
         │  ╭─╯                 ╰─╮
     0.0 ┼──╯──────────┬──────────╰──╴
        0.0           0.5           1.0
          p (fraction that is apples)
```

Two apples and two oranges gives $p = 0.5$ for both classes, so

$$
H(S) = -\left[0.5 \log_2 0.5 + 0.5 \log_2 0.5\right] = 1.0
$$

Split that pile perfectly and both children have $H = 0$. The improvement is **information
gain**, the parent's entropy minus the size-weighted entropy of the children:

$$
\text{Gain} = H(S) - \left(\frac{|L|}{|S|}H(L) + \frac{|R|}{|S|}H(R)\right)
$$

The weighting is the part people skip, and it is the part that stops the tree from cheating. A
split that peels off one perfectly pure sample and leaves the mess behind gets almost no credit,
because that pure child carries almost no weight.

Two things worth knowing that the tutorials leave out. First, scikit-learn's default criterion
is Gini impurity, not entropy, and in practice the two pick nearly the same splits; the choice
almost never shows up in your validation score. Second, raw information gain is biased towards
features with many distinct values, because slicing finely always looks like progress. CART, the
algorithm scikit-learn implements, only ever makes binary threshold splits, which blunts the
problem but does not remove it. If you have a high-cardinality categorical column, watch it.

### 3.2 Four fruits, by hand

| # | Colour score (0 = light, 1 = dark) | Diameter cm | Label |
|:-:|:---:|:---:|:---|
| 1 | 0 | 3.0 | orange |
| 2 | 0 | 3.2 | orange |
| 3 | 1 | 3.4 | apple |
| 4 | 1 | 3.6 | apple |

Try the question "colour ≤ 0.5?". Left pile is rows 1 and 2, both oranges, $H = 0$. Right
pile is rows 3 and 4, both apples, $H = 0$. The parent had $H = 1.0$, so the gain is a full
bit and the job is finished in one question.

Now notice that "diameter ≤ 3.3?" gives exactly the same perfect split. The tree will pick
one of them, essentially arbitrarily, and you will never learn which feature actually
matters. That is the honest limit of "trees are interpretable": a single tree is readable
but not stable. Perturb the data slightly and you can get a completely different-looking
tree with the same accuracy.

### 3.3 Code: grow one, read it, then check it

```python
from sklearn.datasets import load_iris
from sklearn.model_selection import train_test_split
from sklearn.tree import DecisionTreeClassifier, export_text, plot_tree
import matplotlib.pyplot as plt

data = load_iris()
X_tr, X_te, y_tr, y_te = train_test_split(
    data.data, data.target, test_size=0.3, stratify=data.target, random_state=0
)

# max_depth is the pruning here; an unbounded tree memorises the training set
tree = DecisionTreeClassifier(
    max_depth=3, criterion="entropy", random_state=0
).fit(X_tr, y_tr)

print(tree.score(X_te, y_te))
print(export_text(tree, feature_names=list(data.feature_names)))

plot_tree(tree, feature_names=data.feature_names,
          class_names=list(data.target_names), filled=True)
plt.show()
```

Two things differ from the version I first published, and both of those were real mistakes on
my part. This one holds out a test set instead of scoring on the training data, and it prints
`export_text`, which gives you the rules as plain text you can paste into a code review. Iris
is an easy dataset and a depth-3 tree scores well up in the nineties, but that number means
nothing unless it comes from rows the tree has never seen.

If you drop `max_depth`, the tree will grow until every leaf is pure, hit 100% on training data,
and get worse on the test set. That is overfitting in its purest and most visible form. Your
controls are `max_depth`, `min_samples_leaf` and `ccp_alpha` (cost-complexity pruning).
Reach for `min_samples_leaf` first; it maps most directly onto "do not trust a rule
supported by three rows".

---

## 4. Trees or neural nets

| | Decision tree | Neural net |
|---|---|---|
| How it learns | greedy splits, no calculus | gradient descent via autograd |
| Needs feature scaling | no | usually yes |
| Handles missing values | natively, in modern GBDTs | you impute first |
| Readable by a human | one tree, yes; an ensemble, no | not without extra tooling |
| Small tabular data | strong | weak |
| Images, audio, text | weak | strong |
| Training cost | seconds to minutes on CPU | GPU hours and up |

The headline is not close, and it surprises people: on ordinary tabular data, gradient-boosted
trees still beat neural networks, and they do it with less tuning. Grinsztajn, Oyallon and
Varoquaux made this case carefully in "Why do tree-based models still outperform deep
learning on typical tabular data?" at NeurIPS 2022. Their reasons are structural: tabular
features are not smooth, many are uninformative, and they are not rotation-invariant the
way pixels are.

One honest update since. Pretrained tabular foundation models, TabPFN being the name to
know, do now win on small datasets: think a few thousand rows and a modest number of
columns, classified in a single forward pass with no per-dataset training. Past that size
boosted trees are still the thing to beat, and they are still the cheaper baseline to run
first.

So the practical shape is: a single tree to understand your data, a boosted ensemble to ship, a
neural network when your data is perceptual or sequential.

```
  what does your data look like?
      │
      ├─ rows and columns
      │    ├─ must explain every decision  →  one shallow tree
      │    ├─ want the best score          →  LightGBM / XGBoost
      │    └─ want zero setup              →  HistGradientBoosting
      │
      ├─ images, audio, video  →  PyTorch, fine-tune a backbone
      ├─ text                  →  a pretrained transformer
      └─ novel long sequences  →  PyTorch + torch.compile, and a budget
```

The baseline I actually start with on any tabular problem, before anything clever:

```python
from sklearn.ensemble import HistGradientBoostingClassifier

gb = HistGradientBoostingClassifier(max_iter=300, early_stopping=True)
gb.fit(X_tr, y_tr)
print(gb.score(X_te, y_te))
```

No scaling, no imputation, no encoding of ordinals, no GPU. If a deep model cannot beat that
after a day of work, the deep model is not the answer to this problem.

---

## 5. Three exercises worth the time

1. Delete `opt.zero_grad()` from the PyTorch loop and watch what happens to the printed weights.
   Understanding that failure once will save you a day later.
2. Fit an unbounded `DecisionTreeClassifier` on the iris split above, then sweep `max_depth`
   from 1 to 10 and plot training and test accuracy together. The gap between the two
   curves is overfitting, drawn.
3. Add a fifth row to the four-fruit table that breaks the clean split, and recompute the
   gain for both candidate questions by hand. The tree's preference now turns on a third
   decimal place, which tells you how much to trust it.

---

## The short version

- A framework buys you four things: tensors, autograd, optimisers, device dispatch. Autograd is
  the one you could not write yourself in a weekend.
- In 2026, start with PyTorch. TensorFlow is maintained rather than growing, Keras 3 is
  multi-backend and no longer implies TensorFlow, and JAX is the research-scale third option.
- `torch.compile` removed the old "PyTorch is slower in production" argument. Judge on
  ecosystem and team familiarity instead.
- A decision tree is a learned flow chart. It picks each question by maximising information
  gain: the drop in entropy, weighted by how big each child pile is.
- Gini and entropy almost never disagree in a way that changes your score. Pruning settings do.
- A single tree is readable but unstable. Two features that split equally well are chosen
  almost at random, so do not read causation off the diagram.
- On tabular data, gradient-boosted trees are still the thing to beat past a few thousand
  rows; below that, pretrained tabular models like TabPFN now win. Start with
  `HistGradientBoostingClassifier` and make the deep model earn its place.

*Next in AI Foundations: [intelligent agents and search](/posts/2023/04/ai-agents-search/),
where the model stops predicting and starts choosing what to do. If you want the maths
under the tensors first, part 1 is
[the linear-algebra Lego set](/posts/2023/01/math-for-ai-linear-algebra-basics/).*
