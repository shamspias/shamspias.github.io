---
title: "Machine Learning 101: PyTorch, TensorFlow & Decision Trees"
description: "How PyTorch, TensorFlow and decision trees really differ, and which one to reach for when you are starting out."
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

*If you can put toys into big and small groups,  
or ask “Is it an animal?” when you play **Guess Who?**,  
then you already think like a machine learning model!*

This post answers three gentle questions, one baby step at a time:

1. **What are PyTorch and TensorFlow?**
2. **Why do we need them?**
3. **How does a Decision Tree work?**

No scary symbols—just tiny doses of math, colourful pictures, and short code you can run in a notebook.

---

## 1  Why Bother With ML *Libraries*?

Imagine you have to count all the marbles in a swimming pool—**by hand**. Ouch! A calculator (or a friendly big sibling)
would help. In ML the “marbles” are *millions* of numbers. PyTorch and TensorFlow are the helpful siblings that:

| Hard thing                 | The library does it for you               |
|----------------------------|-------------------------------------------|
| Keep track of every number | Wrap them in **tensors**                  |
| Do giant chains of maths   | Use your computer’s **GPU** (super fast)  |
| Work out derivatives       | Provide **autograd** (automatic calculus) |
| Save & reload models       | One‑line functions like `torch.save()`    |

Result: you spend time on *ideas*, not on counting marbles.

---

## 2  Meet the Friendly Giants: PyTorch vs TensorFlow

|              | **PyTorch**                        | **TensorFlow / Keras**                             |
|--------------|------------------------------------|----------------------------------------------------|
| *Feels like* | Regular Python + NumPy             | Building blocks that snap into a *graph*           |
| Main fans    | Researchers, hobby projects        | Large companies, production apps                   |
| Debugging    | `print()` works instantly          | Needs the Keras “eager” switch (now on by default) |
| Fancy extras | TorchAudio, TorchVision, TorchText | TensorBoard, TF‑Lite (phones), TPUs                |

> **Tiny rule‑of‑thumb:**
> *Prototyping fast?* → **PyTorch**.  
> *Shipping to millions of phones?* → **TensorFlow**.

### 2·1  One‑Screen Demo – Linear Regression in Each Library

#### PyTorch

```python
import torch, torch.nn as nn

a = torch.randn(100, 1)
b = 3 * a + 0.5 + 0.1 * torch.randn_like(a)

model = nn.Linear(1, 1)
optim = torch.optim.SGD(model.parameters(), lr=0.1)
loss_fn = nn.MSELoss()

for _ in range(300):
    optim.zero_grad()
    loss = loss_fn(model(a), b)
    loss.backward()
    optim.step()

print(model.weight.item(), model.bias.item())  # ~3.0 and ~0.5
```

#### TensorFlow / Keras

```python
import tensorflow as tf
from tensorflow.keras import layers

# Generate data
x = tf.random.normal((100, 1))
y = 3 * x + 0.5 + 0.1 * tf.random.normal((100, 1))

# Define the model using Input layer
model = tf.keras.Sequential([
    tf.keras.Input(shape=(1,)),
    layers.Dense(1)
])

model.compile(optimizer="sgd", loss="mse")
model.fit(x, y, epochs=300, verbose=0)

# Print learned weights and bias
print(model.weights[0].numpy(), model.weights[1].numpy())  # ~3.0, ~0.5
```

Same maths, same answer—the libraries just do the heavy lifting.

---

## 3  Decision Trees: The “20 Questions” Algorithm

### 3·1A Story First

Picture a basket of **fruit**: apples and oranges. You want a *robot kid* to tell them apart.

1. **Ask a yes/no question** like *“Is the fruit orange‑coloured?”*
2. Put every fruit that says **yes** on the left, every **no** on the right.
3. Keep asking new questions on each pile until **every pile holds only one kind** of fruit.
4. To classify a *new* fruit, start at the top question and follow the answers down to a leaf node.

That’s a **Decision Tree**—nothing fancier than a flow‑chart of yes/no gates.


### 3·2  How Does the Tree Pick a “Good” Question?

It chooses the question that makes the piles **cleaner**.

We measure ‘clean-ness’ (or *messiness*) with a tiny formula called **entropy**. Think of entropy as the level of **confusion** in a pile:

- A pile that’s half apples, half oranges = **very messy** → entropy ≈ 1  
- A pile that’s all apples = **super clean** → entropy = 0

#### 🍎🍊 Real Talk: What’s This Formula?

The formula is:

$$
H(S) = -\sum_{c} p_c \log_2 p_c,
$$

Where:

- **$$ ( S ) $$** = a group of fruits (a pile)
- **$$ ( c ) $$** = each class (like 🍎 or 🍊)
- **$$ ( p_c ) $$** = the **fraction of the pile that is class \( c \)**

#### 🧮 Let’s Do It With Fruit

Say your pile has **2 apples and 2 oranges**. That means:

- $$ ( p_{\text{apple}} = 2/4 = 0.5 ) $$
- $$ ( p_{\text{orange}} = 2/4 = 0.5 ) $$

Plug it in:

$$
H(S) = -[0.5 \log_2 0.5 + 0.5 \log_2 0.5] = -[0.5 \times (-1) + 0.5 \times (-1)] = 1.0
$$

So this pile is **very messy**—totally mixed up.

Now, suppose we ask **“Is the fruit orange-coloured?”** and split the fruits like this:

- **Left pile** → both oranges → $$ ( p = 1.0 ) $$ → entropy = 0
- **Right pile** → both apples → $$ ( p = 1.0 ) $$ → entropy = 0

Boom! Now both piles are perfectly clean.

---

### 🔍 What’s *Information Gain*?

Information Gain is just the **drop in entropy** when you split a pile:

$$
\text{Gain} = H(\text{parent}) - \left(\frac{|L|}{|S|}H(L) + \frac{|R|}{|S|}H(R)\right)
$$

- $H(\text{parent})$ = entropy of the big pile before splitting
- $H(L)$, $H(R)$ = entropy of the left/right piles
- $|L|/|S|$, $|R|/|S|$ = how big each new pile is, as a fraction

In our example:

- Before split: entropy = 1.0
- After split: both piles = 0.0
- So Gain = 1.0 – 0 = **1.0** ← **perfect!**

---

**Summary**:  
The decision tree is basically playing “20 Questions,” trying to find the question that makes the biggest mess shrink. That’s what “Information Gain” measures.

*(Don’t panic: Scikit‑Learn figures this all out for you automatically.)*

### 3·3  Hands‑On Example With Only Four Fruits

| # | Colour score (0 = light, 1 = dark) | Diameter cm | Label |
|:-:|:----------------------------------:|:-----------:|:-----:|
| 1 |                 0                  |     3.0     |  🍊   |
| 2 |                 0                  |     3.2     |  🍊   |
| 3 |                 1                  |     3.4     |  🍎   |
| 4 |                 1                  |     3.6     |  🍎   |

Try the question **“Colour ≤ 0.5?”**

* Left pile → rows 1 & 2 → all oranges → entropy = 0
* Right pile → rows 3 & 4 → all apples → entropy = 0
* Parent entropy ≈ 1.0 → **Gain = 1.0 – 0 = 1.0** (perfect!)

One question and the job is done.

### 3·4  Code: Grow & Draw a Tree

```python
from sklearn.datasets import load_iris
from sklearn.tree import DecisionTreeClassifier, plot_tree
import matplotlib.pyplot as plt

X, y = load_iris(return_X_y=True)
model = DecisionTreeClassifier(max_depth=3, criterion="entropy").fit(X, y)

plt.figure(figsize=(10, 6))
plot_tree(model,
          feature_names=["sepal len", "sepal wid", "petal len", "petal wid"],
          class_names=load_iris().target_names,
          filled=True, rounded=True);
plt.show()
```

Run it in a notebook—the picture spells out every yes/no gate.

---

## 4  Trees vs Neural Nets at a Glance

|                          | **Decision Tree**          | **Neural Net (PyTorch / TF)** |
|--------------------------|----------------------------|-------------------------------|
| How it learns            | Greedy splits, no calculus | Gradient descent + autograd   |
| Needs scaling?           | **No**                     | Often **yes**                 |
| Explains itself easily?  | **Yes** (draw the tree)    | Hard (needs extra tools)      |
| Loves small tabular data | ✔️                         | ❌ (needs lots of data)        |

---

## 5  Try It Yourself 🧪

1. **Change the Fruit Basket**  
   Make up your own table with *shape*, *colour*, *weight* and run `DecisionTreeClassifier` again.
2. **PyTorch vs TensorFlow**  
   Rewrite the tiny linear‑regression demo above in the *other* library.
3. **Entropy on Paper**  
   Calculate the entropy of `Colour ≤ 0.5` split by hand—see that it really is 0.

---

## 6 Cheat‑Sheet 🧾

```
PyTorch          = Pythonic, research‑friendly tensor toolkit
TensorFlow/Keras = End‑to‑end, production‑friendly ML factory
Decision Tree    = A flow‑chart that asks yes/no questions to classify data

Entropy          = Messiness in a pile (0 = pure, 1 ≈ mixed)
Info Gain        = Entropy drop after a split
Best Split       = Question with the biggest Info Gain
```

---

### 🚀Final Words

If you can sort fruit or play “20 Questions,” you already grasp the soul of Decision Trees.

Frameworks like **PyTorch** and **TensorFlow** are simply powerful calculators that help your computer juggle the
numbers so you don’t have to.

Master these gentle ideas and the door to the ML playground swings wide open.

**Happy learning—and may your questions always split the pile just right!**
