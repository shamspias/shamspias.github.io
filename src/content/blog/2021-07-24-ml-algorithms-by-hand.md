---
title: "Machine Learning Algorithms by Hand"
description: "Four algorithms in forty lines each, with no library. k-nearest neighbours, linear and logistic regression, k-means, and a decision tree, plus what each one assumes."
date: 2021-07-24
permalink: "/posts/2021/07/ml-algorithms-by-hand/"
lang: en
tags:
  - "algorithms"
  - "machine learning"
  - "regression"
  - "k-means"
  - "decision trees"
series: "Problem Solving From Zero"
seriesOrder: 19
math: true
---

*Four classical machine learning algorithms, written from nothing, in Python, with no imports beyond the standard library. Not because you should ship these, but because each one is forty lines and understanding those forty lines is the difference between using a library and being used by one. Every section ends with what the algorithm assumes, because the assumptions are where results go wrong.*

## 1. k-nearest neighbours

The simplest thing that works. To classify a point, find the `k` closest training points and take a vote.

There is no training. The model *is* the data.

```python
import math
from collections import Counter

def knn_predict(train, labels, point, k=3):
    """train: list of feature vectors. labels: list of class labels."""
    distances = []
    for x, y in zip(train, labels):
        d = math.sqrt(sum((a - b) ** 2 for a, b in zip(x, point)))
        distances.append((d, y))
    distances.sort()
    return Counter(y for _, y in distances[:k]).most_common(1)[0][0]
```

$\mathcal{O}(nd)$ per prediction with `n` training points and `d` features, plus the sort. Slow to predict, instant to train, which is the opposite of everything else here.

**Choosing `k`.** Small `k` follows the noise; large `k` washes out real structure. The usual approach is to try several values and keep whichever does best on data the model has not seen.

```
  k = 1                       k = 15

  ....A|B....                 ....A A|B B....
  ...AA|BB...                 ...A A A|B B B..
  ..A A|x B..                 ..A A A|x B B B.
     a wiggly boundary           a smooth one
     that chases outliers        that ignores detail
```

**What it assumes, and this is the important part: that your features are on comparable scales.** Euclidean distance adds squared differences, so a feature measured in thousands drowns one measured in fractions. Income in rupees and age in years, added together, is a distance dominated entirely by income.

The fix is to standardise every feature before measuring anything:

```python
def standardise(rows):
    """Shift each feature to mean 0 and scale to standard deviation 1."""
    n, d = len(rows), len(rows[0])
    means = [sum(r[j] for r in rows) / n for j in range(d)]
    sds = []
    for j in range(d):
        var = sum((r[j] - means[j]) ** 2 for r in rows) / n
        sds.append(math.sqrt(var) or 1.0)          # avoid dividing by zero
    return [[(r[j] - means[j]) / sds[j] for j in range(d)] for r in rows]
```

Compute the means and standard deviations on the **training** data only, then apply the same numbers to the test data. Computing them over everything lets information from the test set leak into training, and the resulting score is optimistic and wrong. That is the most common methodological error in applied machine learning and it is worth being pedantic about.

## 2. Linear regression by gradient descent

Predict a number. Fit $y = w \cdot x + b$ by minimising the mean squared error

$$
L = \frac{1}{n}\sum_{i=1}^{n}\left(w \cdot x_i + b - y_i\right)^2
$$

The gradient of that, worked out once and then just used:

$$
\frac{\partial L}{\partial w_j} = \frac{2}{n}\sum_i \left(\hat y_i - y_i\right)x_{ij},
\qquad
\frac{\partial L}{\partial b} = \frac{2}{n}\sum_i \left(\hat y_i - y_i\right)
$$

Then walk downhill.

```python
def linear_fit(X, y, lr=0.01, epochs=1000):
    n, d = len(X), len(X[0])
    w = [0.0] * d
    b = 0.0
    for _ in range(epochs):
        gw = [0.0] * d
        gb = 0.0
        for xi, yi in zip(X, y):
            pred = sum(wj * xj for wj, xj in zip(w, xi)) + b
            err = pred - yi
            for j in range(d):
                gw[j] += 2 * err * xi[j] / n
            gb += 2 * err / n
        for j in range(d):
            w[j] -= lr * gw[j]
        b -= lr * gb
    return w, b
```

```
  loss
   |  \
   |   \                  learning rate too small:
   |    \_                creeps, never arrives
   |      \__
   |         \____
   +---------------- steps

  loss
   |    /\    /\          learning rate too large:
   |   /  \  /  \         overshoots, diverges
   |  /    \/    \
   +---------------- steps
```

**The learning rate is the one knob that matters.** Too small and it never converges in the epochs you allow. Too large and the loss increases. Print the loss every hundred steps: if it is not falling, halve the rate. If it is falling but slowly, double it.

**What it assumes.** That the relationship is linear, that the errors have roughly constant variance, and, again, that the features are scaled. Gradient descent on unscaled features zigzags: the loss surface is a long narrow valley and the step size that suits one direction is wrong for the other.

For small problems there is an exact answer, the normal equation $w = (X^\top X)^{-1} X^\top y$, no iteration and no learning rate. It costs $\mathcal{O}(d^3)$ for the inverse, so it is the right choice when `d` is small and the wrong one when `d` is large.

## 3. Logistic regression

Predict a probability. Same linear combination, squashed into `(0, 1)` by the logistic function:

$$
\sigma(z) = \frac{1}{1 + e^{-z}}, \qquad \hat y = \sigma(w \cdot x + b)
$$

The loss is no longer squared error but log loss, also called cross-entropy:

$$
L = -\frac{1}{n}\sum_i \Big[ y_i \log \hat y_i + (1 - y_i)\log(1 - \hat y_i) \Big]
$$

And here is the pleasant surprise: the gradient comes out to exactly the same shape as linear regression.

$$
\frac{\partial L}{\partial w_j} = \frac{1}{n}\sum_i (\hat y_i - y_i) x_{ij}
$$

```python
def sigmoid(z):
    # split by sign to avoid overflow in exp for large negative z
    if z >= 0:
        return 1.0 / (1.0 + math.exp(-z))
    e = math.exp(z)
    return e / (1.0 + e)

def logistic_fit(X, y, lr=0.1, epochs=2000):
    n, d = len(X), len(X[0])
    w = [0.0] * d
    b = 0.0
    for _ in range(epochs):
        gw = [0.0] * d
        gb = 0.0
        for xi, yi in zip(X, y):
            p = sigmoid(sum(wj * xj for wj, xj in zip(w, xi)) + b)
            err = p - yi
            for j in range(d):
                gw[j] += err * xi[j] / n
            gb += err / n
        for j in range(d):
            w[j] -= lr * gw[j]
        b -= lr * gb
    return w, b

def logistic_predict(w, b, x, threshold=0.5):
    return 1 if sigmoid(sum(wj * xj for wj, xj in zip(w, x)) + b) >= threshold else 0
```

The `sigmoid` written in two branches is not fussiness. `math.exp(-z)` for `z = -800` overflows and raises; splitting by sign keeps both exponentials at or below 1.

**The threshold is a separate decision from the model.** 0.5 is a default, not a law. If a false negative costs far more than a false positive, move it. The model gives you a probability; turning it into a decision is your business, and conflating the two is why "accuracy" is such a poor way to report a classifier.

**What it assumes.** That log-odds are linear in the features, and that your classes are not wildly imbalanced. At 99 to 1, a model that always says "no" scores 99 per cent accuracy and is useless, which is exactly [the honest-negatives problem](/posts/2026/02/honest-negatives-peptide-benchmark/) I ran into with peptides years later.

## 4. k-means clustering

No labels this time. Group `n` points into `k` clusters. Two steps, repeated: assign each point to the nearest centre, then move each centre to the mean of its points.

```python
def kmeans(points, k, iterations=100, seed=0):
    # deterministic start: spread the initial centres through the data
    step = max(1, len(points) // k)
    centres = [points[(i * step) % len(points)][:] for i in range(k)]

    for _ in range(iterations):
        groups = [[] for _ in range(k)]
        for p in points:
            best = min(range(k), key=lambda c: sum(
                (a - b) ** 2 for a, b in zip(p, centres[c])))
            groups[best].append(p)

        moved = False
        for c in range(k):
            if not groups[c]:
                continue                        # empty cluster: leave it
            new = [sum(vals) / len(vals) for vals in zip(*groups[c])]
            if new != centres[c]:
                centres[c] = new
                moved = True
        if not moved:
            break                               # converged
    return centres, groups
```

$\mathcal{O}(nkd)$ per iteration. It always converges, because each step can only reduce the total squared distance and there are finitely many assignments.

```
  iteration 0            iteration 1            converged

  x  x     o             x  x     o             x  x     o
   x   C1    o            x  C1     o            xC1       o
      x       C2             x      C2             x      C2 o
   x     o  o              x    o  o o           x       o o
       centres start        they move to           they stop
       badly placed         the means              moving
```

**It converges to a local optimum, not the best one.** Different starting centres give different answers. The standard fix is k-means++, which chooses initial centres far apart with probability proportional to squared distance from the nearest existing centre. Or run it ten times and keep the result with the lowest total distance.

**What it assumes, and this is the assumption people forget: that clusters are roughly spherical and of similar size.** It is minimising squared Euclidean distance to a centre, so it can only find blobs. Two crescent shapes interleaved will be cut straight down the middle, correctly by its own objective and uselessly by yours.

**Choosing `k`** is not something the algorithm can do. Plot total within-cluster distance against `k`, look for the bend, and be honest that the bend is often not there. If `k` genuinely matters to your conclusion, k-means may be the wrong tool.

## 5. A decision tree

The last one, and the only one here that is not about distance, which is why it needs no scaling at all.

Split the data on one feature at one threshold, chosen to make the two halves as pure as possible. Recurse. Stop at a depth limit or when a node is pure.

Purity is measured with Gini impurity: for a node with class proportions $p_c$,

$$
G = 1 - \sum_c p_c^2
$$

Zero when the node holds one class, and highest when the classes are evenly mixed.

```python
def gini(labels):
    if not labels:
        return 0.0
    counts = Counter(labels)
    n = len(labels)
    return 1.0 - sum((c / n) ** 2 for c in counts.values())

def best_split(X, y):
    """Returns (feature, threshold, weighted impurity) or None."""
    n, d = len(X), len(X[0])
    base = gini(y)
    best = None
    for j in range(d):
        values = sorted(set(row[j] for row in X))
        # midpoints between consecutive distinct values
        for a, b in zip(values, values[1:]):
            thr = (a + b) / 2
            left = [y[i] for i in range(n) if X[i][j] <= thr]
            right = [y[i] for i in range(n) if X[i][j] > thr]
            if not left or not right:
                continue
            score = (len(left) * gini(left) + len(right) * gini(right)) / n
            if score < base and (best is None or score < best[2]):
                best = (j, thr, score)
    return best

def build_tree(X, y, depth=0, max_depth=5, min_size=2):
    if depth >= max_depth or len(set(y)) == 1 or len(y) < min_size:
        return ('leaf', Counter(y).most_common(1)[0][0])
    split = best_split(X, y)
    if split is None:
        return ('leaf', Counter(y).most_common(1)[0][0])
    j, thr, _ = split
    li = [i for i in range(len(X)) if X[i][j] <= thr]
    ri = [i for i in range(len(X)) if X[i][j] > thr]
    return ('node', j, thr,
            build_tree([X[i] for i in li], [y[i] for i in li], depth + 1, max_depth, min_size),
            build_tree([X[i] for i in ri], [y[i] for i in ri], depth + 1, max_depth, min_size))

def predict_tree(tree, x):
    while tree[0] == 'node':
        _, j, thr, left, right = tree
        tree = left if x[j] <= thr else right
    return tree[1]
```

`best_split` is $\mathcal{O}(n^2 d)$ as written, because it rebuilds the two halves for every candidate threshold. Sorting each feature once and sweeping while updating the class counts brings it to $\mathcal{O}(nd \log n)$, which is what a real implementation does.

**What it assumes: almost nothing**, which is its appeal. No scaling needed, since it only compares within one feature at a time. Mixed feature types are fine. Non-linear boundaries are fine, as long as they are axis-aligned staircases.

**Its weakness is variance.** A single tree grown deep memorises the training data: it will happily build a leaf per example. The two standard fixes are both about averaging: a **random forest** grows many trees on bootstrap samples with a random subset of features at each split and votes; **gradient boosting** grows shallow trees in sequence, each fitting the previous one's errors. Nearly every winning solution on tabular data is one of those two, which is why this is the algorithm here that is most worth understanding properly.

## 6. Measuring it honestly

Forty lines of algorithm is the easy part. The hard part is knowing whether it works, and this section is the one that matters most in practice.

**Never score on the training data.** A model that memorises scores perfectly and predicts nothing. Split the data, or better, use `k`-fold cross-validation: divide into `k` parts, train on `k-1`, test on the held-out one, rotate, and average.

```python
def k_fold(rows, labels, k, fit, predict):
    n = len(rows)
    fold = n // k
    scores = []
    for i in range(k):
        lo, hi = i * fold, (i + 1) * fold if i < k - 1 else n
        test_x, test_y = rows[lo:hi], labels[lo:hi]
        train_x = rows[:lo] + rows[hi:]
        train_y = labels[:lo] + labels[hi:]
        model = fit(train_x, train_y)
        correct = sum(predict(model, x) == t for x, t in zip(test_x, test_y))
        scores.append(correct / len(test_y))
    return sum(scores) / len(scores)
```

**Accuracy is usually the wrong number.** With 99 per cent negatives, "always no" scores 99 per cent. Report precision, recall, or the Matthews correlation coefficient, which stays honest under imbalance.

**Split before you preprocess.** Compute means, standard deviations, and any vocabulary on the training fold alone. Fitting the scaler on everything leaks the test set into training, and the score you report is not the score you would get.

**Compare against a baseline that is embarrassingly simple.** Always predict the majority class. Predict using one feature and a threshold. If your model does not clearly beat that, it has not learned what you think it has. I have watched a published-looking result evaporate against a one-feature decision stump, and it is the cheapest check there is.

## The short version

- k-nearest neighbours has no training: the model is the data. It lives or dies on feature scaling, because Euclidean distance is dominated by whichever feature has the largest units.
- Standardise features using the **training** statistics only, then apply the same numbers to test data. Fitting the scaler on everything leaks and inflates your score.
- Linear and logistic regression share the same gradient shape, $(\hat y - y)x$. The learning rate is the knob that matters: print the loss, halve the rate if it rises, double it if it crawls.
- Write `sigmoid` in two branches by sign, or large negative inputs overflow.
- A classification threshold is a decision about costs, not part of the model. 0.5 is a default, not a law.
- k-means converges to a local optimum and can only find round, similar-sized blobs. Different starts give different answers, so restart it several times and keep the best.
- A decision tree needs no scaling and handles mixed feature types, and a deep one memorises. Averaging many trees, by bagging or boosting, is what makes them the default for tabular data.
- The measurement matters more than the algorithm. Cross-validate, do not report accuracy under class imbalance, and always compare against a one-feature baseline that would embarrass you.

Next, and last: what the memory hierarchy does to every algorithm in this series.
