---
title: "Finding Sick Plants From the Sky: DINOv2, a Linear Probe, and a Farmer With a Drone 🌾"
date: 2026-07-11
permalink: /posts/2026/07/crop-disease-from-the-sky/
tags:
  - computer vision
  - agriculture
  - DINOv2
  - linear probing
  - transfer learning
  - deep learning
math: true
---

*A farmer in Mymensingh flies a drone over three acres of rice, uploads the clip, and gets back:
this patch has bacterial leaf blight, it's affecting 12% of the canopy, here's what to buy. This
is how that works, and the architectural decision that made it possible with almost no labelled
data.*

---

## 1. The problem is not classification 🐛

The obvious framing: crop disease detection is image classification. Take a leaf photo, predict a
disease. PlantVillage exists, models get 99% on it, done.

Then you deploy and discover the actual problem has five parts, and classification is the easy
one.

**There are thousands of crop-disease combinations.** Rice alone has blast, bacterial leaf blight,
brown spot, sheath blight, tungro, false smut. Multiply by every crop a smallholder grows. No
labelled dataset covers your region's combinations.

**Your data is drone video, not clean leaf photos.** Motion blur, variable altitude, harsh noon
light, wind, and a frame that is 95% healthy canopy with one bad patch in the corner.

**Nobody will label ten thousand images for you.** A field officer might label forty photos.
That's your training set. Design for that number or don't ship.

**Location matters more than the label.** "Blight is present" is not actionable on three acres.
*Where* it is, and how much, decides what gets sprayed.

**The answer has to be an action.** A farmer cannot use "Xanthomonas oryzae, confidence 0.87".
They can use "spray this, this much, within three days", in Bangla, with a photo of the packet
they'll find at the shop.

So the system is a pipeline, and the classifier is one stage in it.

---

## 2. The decision that mattered: freeze the backbone 🧊

Standard advice for a new image task is fine-tune a pretrained CNN. With forty labelled images
per crop, fine-tuning is memorisation with extra electricity.

Instead: **use a frozen self-supervised backbone as a feature extractor, and train a tiny head
on top.** This is **linear probing**, and it's the single highest-leverage choice in the whole
system.

We use **DINOv2-Small**: Meta's self-supervised Vision Transformer, 22M parameters, with
384-dimensional embeddings.

```python
import torch
from transformers import AutoImageProcessor, AutoModel

processor = AutoImageProcessor.from_pretrained("facebook/dinov2-small")
backbone  = AutoModel.from_pretrained("facebook/dinov2-small").eval()

@torch.no_grad()
def embed(pil_image):
    inputs = processor(images=pil_image, return_tensors="pt")
    out = backbone(**inputs)
    return out.pooler_output.squeeze(0)        # (384,)
```

~50 ms per image on CPU. No GPU required for inference.

**Why DINOv2 specifically?** It was trained with self-distillation on 142 million unlabelled
images, and it was designed and evaluated for exactly this use. The DINOv2 paper's headline
result is that a *linear* classifier on frozen DINOv2 features rivals fine-tuned models. The
representation is built to be probed.

Our first version used a small disease-specific ViT (5.5M params, 192-dim). Swapping it for
DINOv2-Small was the single biggest accuracy jump in the project, and it required changing about
ten lines.

The key property, which is easy to miss: **DINOv2 has no disease classifier at all.** It has no
idea what blight is. It produces a general-purpose visual representation in which "diseased tissue
of this particular kind" happens to be linearly separable. All disease knowledge comes from
labelled photos, which means:

- the backbone works for **any crop**, including ones we've never seen;
- adding a crop means labelling photos, not retraining a network;
- a trained head is a **~10 KB JSON file** that loads instantly.

That last point turned out to be an operations superpower. A model per crop, versioned, diffable,
sitting in the database next to its training metadata.

---

## 3. The linear probe, properly trained 🎓

"Linear probe" sometimes means "we ran `LogisticRegression` once". Ours does real gradient descent,
because the details are what produce a defensible accuracy number.

```python
import torch.nn as nn

head = nn.Sequential(
    nn.LayerNorm(384),          # normalise before the linear map: matters more than it looks
    nn.Linear(384, n_classes),
)

opt   = torch.optim.AdamW(head.parameters(), lr=1e-3, weight_decay=1e-2)
sched = torch.optim.lr_scheduler.CosineAnnealingLR(opt, T_max=200)
lossf = nn.CrossEntropyLoss()

for epoch in range(200):
    for xb, yb in loader:                       # mini-batch over cached embeddings
        opt.zero_grad()
        lossf(head(xb), yb).backward()
        opt.step()
    sched.step()
    validate_and_keep_best(head)                # stratified 80/20, best-checkpoint selection
```

Five choices worth explaining:

**LayerNorm first.** Embedding dimensions have wildly different scales. Without normalisation a
few dimensions dominate the gradient and the probe converges slowly to something worse.

**Weight decay of 1e-2.** With forty examples and 384 dimensions, regularisation is doing most of
the generalisation work.

**Cosine schedule over 200 epochs.** Embeddings are cached, so an epoch takes milliseconds. Two
hundred epochs is free.

**Stratified 80/20 split with best-checkpoint selection.** The reported accuracy is on held-out
data, and it's the checkpoint that was best on held-out data, not the last epoch.

**Report the real number.** When a field officer trains a model on forty photos and gets 71%, the
console says 71%. It is *extremely* tempting to show training accuracy, because 99% makes the
product feel good. It also makes the product lie, and the first time a farmer sprays the wrong
thing on a 99%-confident wrong prediction, you have destroyed the only asset you had.

---

## 4. Three tiers, so day one works 🪜

New crop, zero labelled photos, and the farmer is uploading video right now. What do you show
them?

The answer is a **fallback cascade**, evaluated in order:

```
   ┌──────────────────────────────────────────────────────────┐
   │ TIER 1  trained linear probe                             │
   │         real gradient descent on labelled photos         │
   │         calibrated softmax confidence, up to ~0.95       │
   │         requires: ~20+ photos per class                  │
   └────────────────────────┬─────────────────────────────────┘
                            │ not enough data?
   ┌────────────────────────▼─────────────────────────────────┐
   │ TIER 2  k-NN gallery                                     │
   │         nearest class centroid in embedding space         │
   │         confidence from margin between top-2              │
   │         requires: a handful of photos per class           │
   └────────────────────────┬─────────────────────────────────┘
                            │ still nothing?
   ┌────────────────────────▼─────────────────────────────────┐
   │ TIER 3  zero-shot colour / texture heuristic             │
   │         match lesion region against each disease's        │
   │         canonical signature from the advice library       │
   │         CONFIDENCE CAPPED AT ~0.66                        │
   │         requires: nothing                                 │
   └──────────────────────────────────────────────────────────┘
```

The confidence cap on tier 3 is the most important design decision in this diagram, and it isn't
a technical one.

A heuristic that matches lesion colour against "brown spot is brown, blast has grey centres" is
*genuinely weak*. But it produces a finding, and a finding gives the farmer a starting point and
gives the field officer something to label and correct. Uncapped, it would occasionally emit 0.9
and be believed. Capped at 0.66 and displayed differently in the UI, it reads as what it is: a
guess pending better data.

**Never let a weak method borrow a strong method's confidence scale.** That principle has saved
me more grief than any model improvement.

---

## 5. From video to findings 🎥

The vision pipeline, in order:

**Sample frames.** A three-minute 30 FPS clip is 5,400 frames of mostly the same canopy. Sample
at an interval, and skip frames that fail a blur check (variance of Laplacian below a threshold).

**Localise before you classify.** This is the step that makes the difference between "blight
somewhere" and something actionable. Segment the canopy from soil and sky, then find lesion blobs
within the canopy.

```python
import cv2, numpy as np

def canopy_mask(bgr):
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    return cv2.inRange(hsv, (25, 40, 40), (95, 255, 255))     # green-ish range

def lesion_blobs(bgr, canopy):
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    off = cv2.inRange(hsv, (10, 40, 40), (30, 255, 255))      # yellow/brown
    off = cv2.bitwise_and(off, canopy)
    off = cv2.morphologyEx(off, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    n, labels, stats, _ = cv2.connectedComponentsWithStats(off)
    return [s for s in stats[1:] if s[cv2.CC_STAT_AREA] > 200]
```

Deliberately classical. It's fast, it's debuggable, it needs no training data, and its output
feeds four things at once: the crop passed to the classifier, the severity number, the map pin,
and the anomaly overlay the farmer sees.

**Severity as affected canopy area.** Not a model output, just a ratio:

$$
\text{severity} = \frac{\text{lesion pixels}}{\text{canopy pixels}}
$$

A physical quantity the farmer can sanity-check against what they can see with their own eyes.
That checkability is worth a lot of trust.

**Classify the lesion crop, not the whole frame.** Feeding the full frame to DINOv2 buries the
signal in 95% healthy canopy. Crop to the blob with margin, then embed.

**Read the GPS.** Drone video often carries ISO-6709 location tags in its metadata:

```bash
ffprobe -v quiet -print_format json -show_format clip.mp4 | grep -i location
# "location": "+24.7471+090.4203/"
```

When present, findings get pinned on a representative aerial frame with severity-coloured
markers. When absent, we fall back to a video timeline with one-tap jumps to each finding, which
is what most farmers actually get, because most phones and cheap drones strip the tags.

**Design for the fallback, not the ideal.** The timeline view took longer to build than the map
view and gets used ten times more.

---

## 6. The output is advice, not a label 💬

Here's the part that makes it a product rather than a demo.

A finding surfaces as: the exact frame the camera saw, the AI's confidence, a clip seeked to that
moment, a severity gauge, a plain-language explanation, three treatment steps, and a ranked list
of **medicines to buy with photos of the actual packets**. In English or বাংলা.

Several things follow from taking that seriously:

**The advice library is editable content, not code.** Staff maintain per-language explanations,
ranked product recommendations, and guidance steps through a console with autosave. Agronomy
changes; product availability changes; a redeploy is the wrong mechanism for that.

**Packet photos matter enormously.** A chemical name means nothing at a rural agro-shop. A photo
of the packet means everything. This is the highest-value feature in the app and there is no
machine learning in it.

**Bilingual is not a translation layer.** Advice is authored in both languages, because a
translated agronomy instruction is often subtly wrong in a way that matters when someone is
mixing a spray.

**Local units.** Field size in hectares, acres, **bigha, katha, decimal**, or m². If your form
only accepts hectares, Bangladeshi farmers cannot use your software. This is a five-line change
that decides adoption.

**Show the evidence.** Every finding displays the frame it came from. When the model is wrong,
and it is wrong sometimes, the farmer can see that it flagged a shadow, and their trust in the
*rest* of the report survives. Hiding the evidence is how you lose a user permanently on the
first mistake.

---

## 7. What's genuinely hard 🚧

**DINOv2 wants close-up scouting footage.** It is a feature extractor trained on ordinary
photographs. A frame from 40 m altitude where each leaf is four pixels does not contain disease
information, at any model size. We tell users to fly low and slow, and the tool flags frames
whose effective resolution is too low rather than guessing.

**Distribution shift is relentless.** A model trained on photos from one district in one season
degrades in the next district in the next season. Different cultivars, soils, light, phone
cameras. The mitigation is structural, not algorithmic: make retraining so cheap (label photos,
click train, 10 KB output) that every region maintains its own head.

**Confusable diseases.** Brown spot and blast lesions look similar early, and early is exactly
when the diagnosis is worth money. When the top-2 margin is thin, the honest output is *both*
with the distinguishing features described, not a coin-flip presented as an answer.

**No labels means no ground truth.** For most deployments we have field-officer labels, not lab
confirmation. Our accuracy numbers are "agreement with an experienced human", not "agreement with
a pathology test", and we say so.

---

## 8. The short version 📝

- Crop-disease detection is a **pipeline**; classification is the easy stage.
- **Freeze DINOv2, train a linear probe.** With ~40 labels per class, fine-tuning is
  memorisation. A frozen self-supervised backbone plus a LayerNorm+Linear head is the right
  shape, and the head is a 10 KB file.
- The backbone knows **nothing** about disease. That's the feature: it works for any crop, and
  crop knowledge lives in labelled photos.
- **Three-tier fallback** (probe → k-NN → zero-shot heuristic) so day one works, with the
  weakest tier's **confidence capped**, always.
- **Localise before classifying.** Classical segmentation gives you the crop, the severity, the
  map pin, and the overlay, with no training data.
- Severity as **affected canopy area**: a physical ratio a farmer can verify by looking.
- The output is **advice**: packet photos, local units, authored bilingual text, and the frame as
  evidence. Design for the fallback path, because that's the one people get.

---

*Next, and back to agents: [an agent is data, not code](/posts/2026/08/an-agent-is-data-not-code/).*
