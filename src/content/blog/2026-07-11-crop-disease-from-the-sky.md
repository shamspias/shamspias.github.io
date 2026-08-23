---
title: "Finding Sick Plants From the Sky: DINOv2, a Linear Probe, and a Farmer With a Drone"
description: "A frozen vision backbone, a linear probe trained on forty photos, and a three-tier fallback so that a drone survey works on day one."
date: 2026-07-11
permalink: "/posts/2026/07/crop-disease-from-the-sky/"
tags:
  - "computer vision"
  - "agriculture"
  - "DINOv2"
  - "linear probing"
  - "transfer learning"
  - "deep learning"
series: "Vision in the Real World"
seriesOrder: 3
math: true
---

*A farmer in Mymensingh flies a drone over three acres of rice, uploads the clip, and gets back:
this patch has bacterial leaf blight, it is affecting 12% of the canopy, here is what to buy.
This is how that works, and the one architectural decision that made it possible with almost no
labelled data.*

---

## 1. The problem is not classification

The obvious framing: crop disease detection is image classification. Take a leaf photo, predict
a disease. PlantVillage exists, models score 99% on it, done.

That 99% is real and almost useless. PlantVillage is single detached leaves, photographed
against a uniform background under even light, so the model learns the studio as much as the
lesion. The paper that reported the 99% also reported what happened on images taken under
different conditions: accuracy fell to roughly a third. Every field deployment since has
rediscovered the same thing.

Deploy for real and the problem turns out to have five parts, of which classification is the
easy one.

**There are thousands of crop and disease combinations.** Rice alone has blast, bacterial leaf
blight, brown spot, sheath blight, tungro and false smut. Multiply that by every crop a
smallholder grows on the same plot in the same year. No labelled dataset covers your region's
combinations.

**Your data is drone video, not clean leaf photos.** Motion blur, changing altitude, harsh noon
light, wind moving the canopy, and a frame that is 95% healthy plant with one bad patch in a
corner.

**Nobody will label ten thousand images for you.** A field officer might label forty photos
between visits. That is your training set. Design for that number or do not ship.

**Location matters more than the label.** "Blight is present" is not actionable across three
acres. *Where* it is and how much of the canopy it covers decides what gets sprayed and whether
spraying is worth the money at all.

**The answer has to be an action.** A farmer cannot use "Xanthomonas oryzae, confidence 0.87".
They can use "spray this, this much, within three days", in Bangla, with a photo of the packet
they will actually find at the shop.

So the system is a pipeline, and the classifier is one stage inside it. The
[previous post](/posts/2026/06/keypoints-to-clinical-metrics/) made the same argument about
clinical pose analysis: the model is the part everyone talks about and the smallest part of
the work.

---

## 2. The decision that mattered: freeze the backbone

The standard advice for a new image task is to fine-tune a pretrained network. With forty
labelled images per class, fine-tuning a 20M-parameter model is memorisation with extra
electricity. The model will fit your forty photos perfectly and learn that blight means "shot on
Karim's phone at 11am".

The alternative is to use a frozen self-supervised backbone as a fixed feature extractor and
train a tiny classifier on top of it. That is **linear probing**, and it is the highest-leverage
choice in the whole system.

Think of the backbone as a very good pair of eyes that has never been told what anything is
called. It has looked at a hundred million photographs and learned to describe what it sees:
this region is fibrous, yellowing at the margin, with a grey centre and a water-soaked edge. It
hands you that description as a few hundred numbers. Your forty labelled photos are only used to
learn the naming, which is a far smaller job than learning to see.

We used **DINOv2-Small**, Meta's self-supervised Vision Transformer: ViT-S/14, about 21M
parameters, 384-dimensional output, Apache-2.0 licensed.

```python
import torch
from transformers import AutoImageProcessor, AutoModel

processor = AutoImageProcessor.from_pretrained("facebook/dinov2-small")
backbone = AutoModel.from_pretrained("facebook/dinov2-small").eval()


@torch.inference_mode()
def embed(pil_image):
    inputs = processor(images=pil_image, return_tensors="pt")
    out = backbone(**inputs).last_hidden_state          # (1, 1 + n_patches, 384)
    cls = out[:, 0]
    # The DINOv2 linear-eval recipe concatenates the class token with the mean of
    # the patch tokens: the patch mean carries texture the class token smooths away.
    patch_mean = out[:, 1:].mean(dim=1)
    return torch.cat([cls, patch_mean], dim=-1).squeeze(0)   # (768,)
```

That gives a 768-dimensional feature instead of 384. It costs nothing at inference and it is
what the DINOv2 authors used for their own linear evaluations. Our first version used
`pooler_output`, which is just the class token, and switching to the concatenation was worth a
couple of points of accuracy for one line of code.

Cost: a few tens of milliseconds per 224x224 crop on a modern laptop CPU, and 150 to 300 ms on
the cheap shared vCPU you will actually rent in Dhaka. No GPU required for inference, which is
the whole point.

**Why a self-supervised backbone specifically?** DINOv2 was trained by self-distillation on 142
million curated unlabelled images, and the paper's headline claim is that a *linear* classifier
on frozen DINOv2 features rivals fine-tuned networks on a wide range of tasks. The
representation was built to be probed. Supervised ImageNet backbones are optimised to throw away
everything that does not separate the thousand ImageNet classes, and lesion texture is exactly
the sort of thing they throw away.

**Where the field has moved since.** Meta released DINOv3 in August 2025, trained on far more
data, with distilled small variants that drop into the same code path. On our data the
ViT-S-sized DINOv3 is modestly better at the same cost, so benchmark it. The reason we have not
moved everything across is licensing rather than accuracy: DINOv2 is Apache-2.0, DINOv3 ships
under Meta's own licence, and someone at your organisation has to read that licence before it
goes into a commercial product. That is a real cost and it does not appear on any leaderboard.

The property that is easy to miss, and that everything downstream depends on:

```
        frozen, shipped once            trained per crop, per region
 ┌────────────────────────────┐     ┌────────────────────────────┐
 │ DINOv2-S backbone          │     │ LayerNorm + Linear head    │
 │ 21M params, ~88 MB         │ ──► │ 768 x n_classes floats     │
 │ knows: edges, texture,     │     │ ~10 KB of weights          │
 │ shape, material, foliage   │     │ knows: which of those      │
 │ knows nothing whatever     │     │ patterns a field officer   │
 │ about blight               │     │ decided to call blight     │
 └────────────────────────────┘     └────────────────────────────┘
   changes when we choose to          changes on a Tuesday, when
   swap backbones, which is a         someone uploads forty new
   deliberate, tested event           photos and clicks train
```

All disease knowledge lives in the head. Which means the backbone works for **any crop**,
including ones we have never seen; adding a crop means labelling photos, not retraining a
network; and a trained model is a 10 KB file that loads instantly, sits in a database row next
to its training metadata, and can be diffed between versions.

That last point turned out to matter more in operations than in accuracy. When a model gets
worse, we can see which weights changed and which upload changed them.

This is the same trick as
[freezing ESM-2 for peptides](/posts/2026/01/protein-language-models/): different modality,
identical shape. A big frozen model that knows the domain's texture, and a small trained head
that knows your labels.

---

## 3. The linear probe, properly trained

"Linear probe" sometimes means "we called `LogisticRegression` once and moved on". That is often
fine, and with cached embeddings and forty examples a well-regularised scikit-learn fit is a
perfectly respectable baseline. We run gradient descent instead because we want a checkpoint
selection rule, class weights, and a training curve to look at when a field officer complains.

```python
import torch.nn as nn

head = nn.Sequential(
    nn.LayerNorm(768),                  # see below: this matters more than it looks
    nn.Linear(768, n_classes),
)

opt = torch.optim.AdamW(head.parameters(), lr=1e-3, weight_decay=1e-2)
sched = torch.optim.lr_scheduler.CosineAnnealingLR(opt, T_max=200)
lossf = nn.CrossEntropyLoss(weight=class_weights, label_smoothing=0.05)

for epoch in range(200):
    for xb, yb in loader:               # mini-batches over cached float16 embeddings
        opt.zero_grad()
        lossf(head(xb), yb).backward()
        opt.step()
    sched.step()
    keep_if_best_on_val(head)           # stratified 80/20, best-checkpoint selection
```

Six choices worth explaining.

**LayerNorm first.** Embedding dimensions have wildly different scales, and a handful of
high-variance dimensions will otherwise dominate the gradient. Normalising first makes the
optimisation problem round, and the probe converges faster to something better.

**Weight decay of 1e-2.** With forty examples and 768 dimensions the problem is underdetermined:
there are infinitely many separating hyperplanes and almost all of them are nonsense.
Regularisation is doing most of the generalisation work here, not the optimiser.

**Class weights.** Field data is never balanced. You get sixty photos of the common disease and
nine of the one that matters. Without weighting, the probe learns to predict the common class
and reports a good average accuracy while being useless.

**Cosine schedule over 200 epochs.** Embeddings are computed once and cached as float16, so an
epoch over a few hundred vectors takes milliseconds. Two hundred epochs is free. The expensive
part of training happened when the photos were uploaded.

**Stratified 80/20 with best-checkpoint selection.** The number we report is measured on
held-out data, using the checkpoint that was best on held-out data, not the last epoch. With
eight validation examples per class that number has an error bar you could drive a tractor
through, and we say so in the UI rather than printing a decimal point we cannot defend.

**Report the real number.** When someone trains a model on forty photos and gets 71%, the
console says 71%. It is extremely tempting to show training accuracy, because 99% makes the
product feel good in a demo. It also makes the product a liar, and the first time a farmer
sprays the wrong chemical on a 99%-confident wrong prediction you have destroyed the only asset
you had.

One caveat on top of that. A softmax trained on forty examples is badly calibrated: it says 0.95
when it means something nearer 0.75, and there is not enough validation data to fit a
temperature properly. So we treat the probability as a ranking signal and show three coarse
confidence bands instead of two decimal places. With a few hundred labels per crop, fit a
temperature on a held-out split and show the calibrated number.

---

## 4. Three tiers, so day one works

New crop, zero labelled photos, and the farmer is uploading video right now. What do you show
them?

The answer is a fallback cascade, evaluated in order:

```
 ┌─────────────────────────────────────────────────────────────┐
 │ TIER 1   trained linear probe                               │
 │          gradient descent on labelled photos                │
 │          confidence band from softmax, top band available   │
 │          needs: roughly 20+ photos per class                │
 └───────────────────────────┬─────────────────────────────────┘
                             │ not enough labelled data
 ┌───────────────────────────▼─────────────────────────────────┐
 │ TIER 2   nearest-centroid gallery                           │
 │          cosine distance to each class mean embedding       │
 │          confidence from the margin between top two         │
 │          needs: a handful of photos per class               │
 └───────────────────────────┬─────────────────────────────────┘
                             │ still nothing labelled
 ┌───────────────────────────▼─────────────────────────────────┐
 │ TIER 3   zero-shot match against the advice library         │
 │          lesion crop vs each disease's written description  │
 │          CONFIDENCE HARD-CAPPED, never the top band         │
 │          needs: nothing                                     │
 └─────────────────────────────────────────────────────────────┘
```

The cap on tier 3 is the most important decision in that diagram, and it is not a technical one.

Tier 3 started as a colour and texture heuristic: brown spot is brown, blast lesions have grey
centres with brown margins. That is genuinely weak. It is also better than an empty screen,
because it produces a finding, and a finding gives the farmer a starting point and gives the
field officer something concrete to correct. Every correction is a label, and labels are what
promote the crop to tier 2 and then tier 1.

Uncapped, that heuristic would occasionally emit 0.9 and be believed. Capped, and rendered
differently in the UI, it reads as what it is: a guess pending better data.

**Never let a weak method borrow a strong method's confidence scale.** That principle has saved
me more grief than any model improvement in this project.

The 2026 update to this tier: the colour heuristic is no longer the best available zero-shot
option. An image-text model such as SigLIP 2 or an open CLIP variant can score the lesion crop
against the disease descriptions we already maintain in the advice library, in whatever language
they are written in, with no per-crop engineering at all. It is a much better tier 3. It is
still tier 3, and the cap still applies, because "the text embedding of *brown spot* is nearest"
is not a diagnosis.

---

## 5. From video to findings

The vision pipeline, in order, with the numbers from a typical three-minute survey clip:

```
 drone clip, 3 min at 30 fps
 ┌──────────────────────┐
 │ 5,400 frames         │
 └──────────┬───────────┘
            │ sample every 15th frame
 ┌──────────▼───────────┐
 │ 360 frames           │
 └──────────┬───────────┘
            │ drop blurred frames (variance of Laplacian)
 ┌──────────▼───────────┐
 │ ~290 usable frames   │
 └──────────┬───────────┘
            │ canopy mask, then lesion blobs over 200 px
 ┌──────────▼───────────┐      severity ratio
 │ ~40 lesion crops     │ ───► map pin / timeline mark
 └──────────┬───────────┘      overlay shown to the farmer
            │ DINOv2 embedding, then the head
 ┌──────────▼───────────┐
 │ ~40 predictions      │
 └──────────┬───────────┘
            │ merge by class and locality, drop singletons
 ┌──────────▼───────────┐
 │ 3 findings + advice  │
 └──────────────────────┘
```

**Localise before you classify.** This is the step that separates "blight somewhere on your
land" from something a person can act on. Segment the canopy away from soil and sky, then find
off-colour blobs inside the canopy.

```python
import cv2
import numpy as np

GREEN = ((25, 40, 40), (95, 255, 255))       # OpenCV hue is 0..179, not 0..359
OFF_COLOUR = ((10, 40, 40), (30, 255, 255))  # yellow through brown


def canopy_mask(bgr):
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    return cv2.inRange(hsv, *GREEN)


def lesion_boxes(bgr, canopy, min_area=200):
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    off = cv2.bitwise_and(cv2.inRange(hsv, *OFF_COLOUR), canopy)
    # Opening removes single-pixel speckle from JPEG noise and moving leaf tips,
    # which otherwise generate dozens of junk findings per frame.
    off = cv2.morphologyEx(off, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    _, _, stats, _ = cv2.connectedComponentsWithStats(off)
    return [
        (s[cv2.CC_STAT_LEFT], s[cv2.CC_STAT_TOP],
         s[cv2.CC_STAT_WIDTH], s[cv2.CC_STAT_HEIGHT])
        for s in stats[1:]                    # row 0 is the background component
        if s[cv2.CC_STAT_AREA] >= min_area
    ]
```

Deliberately classical. It is fast, it is debuggable at three in the morning, it needs no
training data, and its output feeds four things at once: the crop handed to the classifier, the
severity number, the map pin, and the overlay the farmer sees. A learned segmenter would be
better on hard frames and would also need labelled masks, which brings us back to problem three.

The obvious weakness is that fixed HSV thresholds are sensitive to light. Two things help more
than tuning constants: apply a grey-world white balance before converting, and treat the
thresholds as per-crop configuration rather than universal truth, because a mature rice canopy
and a young maize canopy are not the same green.

**Severity is affected canopy area, not a model output.** It is a ratio:

$$
\text{severity} = \frac{\text{lesion pixels}}{\text{canopy pixels}}
$$

A physical quantity the farmer can sanity-check by standing in the field and looking. That
checkability buys more trust than any accuracy claim, because they can catch us being wrong
without understanding anything about the model.

**Classify the lesion crop, not the whole frame.** Feeding the full frame to DINOv2 buries the
signal in 95% healthy canopy: the class token averages over the whole image and the lesion is
noise in that average. Crop to the blob with about 20% margin, then embed.

**Read the GPS when it is there.** Drone video often carries an ISO 6709 location tag:

```bash
ffprobe -v quiet -print_format json -show_format clip.mp4 | grep -i location
# "location": "+24.7471+090.4203/"
```

When present, findings get pinned on a representative aerial frame with severity-coloured
markers. When absent, we fall back to a video timeline with one-tap jumps to each finding, which
is what most users actually get, because most phones and most cheap drones strip the tags on
export or share.

**Design for the fallback, not the ideal.** The timeline view took longer to build than the map
view and gets used ten times more often.

---

## 6. The output is advice, not a label

This is the part that makes it a product rather than a demo.

A finding surfaces as: the exact frame the camera saw, a confidence band, the clip seeked to
that moment, a severity gauge, a plain-language explanation, three treatment steps, and a ranked
list of medicines to buy **with photographs of the actual packets**. In English or বাংলা.

Several things follow from taking that seriously.

**The advice library is editable content, not code.** Staff maintain per-language explanations,
ranked product recommendations and guidance steps through a console with autosave. Agronomy
advice changes with the season, product availability changes with the district, and a redeploy
is the wrong mechanism for either.

**Packet photographs matter enormously.** A chemical name means nothing at a rural agro-shop
where the shopkeeper stocks whatever the distributor brought. A photograph of the packet means
everything. This is the highest-value feature in the application and there is no machine
learning anywhere in it.

**Bilingual is not a translation layer.** Advice is authored in both languages by people who
know the crop, because a machine-translated agronomy instruction is often subtly wrong in
exactly the way that matters when someone is measuring out a spray concentration.

**Local units.** Field size in hectares, acres, bigha, katha, decimal or square metres. If your
form only accepts hectares, Bangladeshi farmers cannot use your software. This is a five-line
change and it decides adoption.

**Show the evidence.** Every finding displays the frame it came from. When the model is wrong,
and it is wrong sometimes, the farmer can see for themselves that it flagged a shadow on a leaf,
and their trust in the *rest* of the report survives. Hiding the evidence is how you lose a user
permanently on the first mistake.

---

## 7. What is genuinely hard

**Altitude is a hard physical limit, not a model problem.** DINOv2 is a feature extractor
trained on ordinary photographs. If a lesion is smaller than a pixel, no backbone at any size
can help. The arithmetic, for a 4K frame from a drone camera with roughly an 84 degree
horizontal field of view, where ground width is about 1.8 times the altitude:

```
altitude   ground width   mm per pixel   a 15 mm lesion is
  40 m         72 m           18.8        under 1 pixel
  20 m         36 m            9.4        1.6 pixels
  10 m         18 m            4.7        3.2 pixels
   5 m          9 m            2.3        6.4 pixels
```

The crop is resized to 224 pixels before it reaches the backbone, and that adds no information:
upsampling a six-pixel lesion just spreads six pixels of evidence over more of DINOv2's 14-pixel
patches. What counts is pixels on the lesion in the original frame. In practice that means
flying at scouting altitude, under roughly 10 m, flying slowly, and accepting that the earliest
lesions need a phone held next to the leaf rather than a drone. We tell users so directly, and
the tool flags frames whose ground resolution is too coarse rather than quietly guessing.

**Distribution shift is relentless.** A model trained on photos from one district in one season
degrades in the next district in the next season: different cultivars, soil colour, light, phone
cameras. The mitigation is structural rather than algorithmic. Make retraining so cheap, meaning
label photos, click train, get a 10 KB file, that every region maintains its own head and nobody
has to feel precious about it.

**Confusable diseases are confusable for good reasons.** Brown spot and early blast lesions look
similar, and early is precisely when the diagnosis is worth money. When the top-two margin is
thin, the honest output is both, with the distinguishing features spelled out in words the
farmer can go and check against a leaf, rather than a coin flip presented as an answer.

**No labels means no ground truth.** For most deployments we have field-officer labels, not
laboratory confirmation. Our accuracy numbers mean "agreement with an experienced human", not
"agreement with a pathology test", and we write it that way in the report. The two are not the
same number and pretending otherwise would be the beginning of a much worse habit.

---

## 8. The short version

- Crop disease detection is a **pipeline**. Classification is the easy stage, and the 99% you
  see on PlantVillage does not survive contact with a field.
- **Freeze the backbone, train a linear probe.** With forty labels per class, fine-tuning is
  memorisation. Concatenate the class token with the patch mean, add LayerNorm and one linear
  layer, and the trained model is a 10 KB file.
- The backbone knows **nothing** about disease, and that is the feature: it works for any crop,
  and all crop knowledge lives in labelled photos that a field officer can add on a Tuesday.
- **Three-tier fallback**, probe then nearest centroid then zero-shot, so day one works. The
  weakest tier's confidence is capped, always. In 2026 that tier should be an image-text model,
  not a colour heuristic, but the cap does not change.
- **Localise before classifying.** Classical segmentation gives you the crop, the severity, the
  map pin and the overlay, with no training data at all.
- Severity as **affected canopy area**: a physical ratio the farmer can verify by looking, which
  is worth more than an accuracy claim they cannot check.
- The output is **advice**: packet photographs, local units, authored bilingual text, and the
  frame as evidence. Design for the fallback path, because that is the one people get.

---

*That closes this series. Next, and back to agents:
[an agent is data, not code](/posts/2026/08/an-agent-is-data-not-code/).*
