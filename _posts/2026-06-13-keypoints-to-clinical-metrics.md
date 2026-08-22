---
title: "From 26 Keypoints to Clinical Metrics 🩺"
date: 2026-06-13
permalink: /posts/2026/06/keypoints-to-clinical-metrics/
tags:
  - biomechanics
  - computer vision
  - RTMPose
  - sports science
  - system design
  - multi-view
math: true
---

*A laptop demo that measures joint angles is a weekend project. A system a physiotherapist will
put in a medical record is a different animal. This is what sits between them.*

---

## 1. The gap 🕳️

The [previous post](/posts/2026/05/bowling-biomechanics-pose/) got us to a real measurement:
point a webcam at a bowler, get four joint angles, compare against literature thresholds.

Genuinely useful. Also nowhere near what a clinical system needs.

Here's the gap, laid out honestly:

| | Demo | Clinical system |
|---|---|---|
| Cameras | one | two or more, calibrated |
| Coordinates | image-plane pixels | metric 3-D, in millimetres |
| Frame rate | 30 FPS | 120–240 FPS |
| Output | numbers on screen | a versioned record, attributable |
| Failure mode | wrong number, shrug | wrong number in someone's medical file |
| Who reads it | you | a physio, a doctor, a lawyer |
| Data model | none | tenant-isolated, soft-delete, audited |

Notice how few of those rows are about computer vision. **Most of the distance between a demo
and a clinical tool is engineering, governance, and honesty about uncertainty**, not a better
pose model.

---

## 2. Why 26 keypoints instead of 33 🦴

MediaPipe gives 33 landmarks and runs on CPU. For clinical work we switched to **RTMPose** with
the **Halpe-26** keypoint set on GPU. Fewer points, better system. Three reasons.

**Halpe-26 includes the ones clinicians ask for.** MediaPipe's set is designed for general
human-pose applications, so it's rich in face landmarks and thin where biomechanics needs
resolution. Halpe-26 covers the body joints plus **head, neck, hip-centre, and both feet
(big toe, small toe, heel)**: the foot segments you need for ground-contact events and ankle
kinematics.

**Accuracy per millisecond is better.** RTMPose is built for the throughput/accuracy trade rather
than for on-device CPU. Given a GPU, you get lower keypoint error at a frame rate that actually
supports 240 FPS ingestion.

**Consistency under occlusion.** For a bowling action, with the arm crossing the body and the
trunk rotating, the difference in landmark stability is the difference between a usable
trajectory and one you have to hand-clean.

The general lesson: **pick a keypoint set by the measurements you need to compute, not by
keypoint count.** Twenty-six well-chosen points beat thirty-three generic ones.

---

## 3. Two cameras and some linear algebra 📷📷

Single-camera 2-D is the fundamental limitation from last post. A joint angle measured in the
image plane is wrong by an unknown amount whenever the limb has a component toward the camera,
and *the image gives you no way to know that amount*.

Two cameras fix it. The technique is **triangulation**, and it is genuinely elementary once the
calibration is done.

Each camera has a $3 \times 4$ projection matrix $P$ mapping a 3-D world point to image
coordinates:

$$
\begin{bmatrix} u \\ v \\ 1 \end{bmatrix} \sim P \begin{bmatrix} X \\ Y \\ Z \\ 1 \end{bmatrix}
$$

One camera gives two equations for three unknowns, which is underdetermined, hence the ambiguity.
Two cameras give four equations for three unknowns, and you solve the overdetermined system by
least squares:

```python
import numpy as np

def triangulate(P1, x1, P2, x2):
    """Direct Linear Transform. x1, x2 are (u, v) in each image."""
    A = np.array([
        x1[0] * P1[2] - P1[0],
        x1[1] * P1[2] - P1[1],
        x2[0] * P2[2] - P2[0],
        x2[1] * P2[2] - P2[1],
    ])
    _, _, Vt = np.linalg.svd(A)
    X = Vt[-1]
    return X[:3] / X[3]        # homogeneous -> Euclidean
```

Now your keypoints are in **millimetres in a world frame**, and joint angles computed from them
are real 3-D angles, not projections. Trunk rotation, which is basically unmeasurable from one
camera, becomes a direct calculation.

### The part that's actually hard

The triangulation is twenty lines. The **calibration** is the work.

You need each camera's intrinsics (focal length, principal point, lens distortion) and the
extrinsics (where each camera is relative to the other). Standard procedure: a checkerboard,
waved through the shared volume, `cv2.calibrateCamera` and `cv2.stereoCalibrate`.

What nobody warns you about:

- **Calibration drifts.** A camera nudged by a millimetre changes your extrinsics. Recalibrate
  per session and store the calibration *with the recording*, not in a config file that gets
  overwritten.
- **Synchronisation is critical.** At 240 FPS, one frame of offset between cameras is 4 ms, and
  at bowling-arm speeds that's centimetres of apparent displacement, triangulated into a
  physically impossible point. Hardware sync if you can; otherwise an audible/visual clap event
  and cross-correlation.
- **Shared volume.** Both cameras must see the joint. Two cameras at 90° maximise triangulation
  accuracy and minimise overlap. There's a real trade-off, and ~60–70° is usually the practical
  compromise.

---

## 4. Trajectories, not frames 📈

Clinical metrics are almost never single-frame quantities. They're properties of a curve.

```
        elbow angle through the delivery swing
  180° ┤                                    ╭──────
       │                                ╭───╯
  170° ┤                          ╭─────╯
       │                     ╭────╯
  160° ┤              ╭──────╯
       │        ╭─────╯
  150° ┤────────╯
       └────┬─────────┬─────────┬─────────┬────────
         arm-horiz                            release
       │←────────── extension = 28° ──────────────→│
```

So the pipeline is a signal-processing pipeline, and the order of operations matters:

**1. Filter the landmarks, not the angles.** Savitzky–Golay over each coordinate's time series.
Filtering computed angles smooths a nonlinear function of noise and shifts your peaks, a subtle
bug that produces confidently wrong extrema.

```python
from scipy.signal import savgol_filter
# (frames, joints, 3) -> filter along the time axis
xyz_smooth = savgol_filter(xyz, window_length=9, polyorder=3, axis=0)
```

**2. Gate on confidence before filtering.** A landmark with visibility 0.2 is a guess; smoothing
it just spreads the guess to its neighbours. Drop it and interpolate, or mark the window
unusable.

**3. Detect events.** Front-foot contact, arm-horizontal, release, all from velocity
zero-crossings and extrema, as in the previous post, but now on metric 3-D coordinates, which
makes them far more robust.

**4. Compute metrics over windows.** Peak, range, timing, and rate: `max(angle) - min(angle)`
between two events, time from contact to release, angular velocity at release.

**5. Attach uncertainty.** This is the step that separates a clinical output from a number.

```python
metric = {
    "name":            "elbow_extension",
    "value_deg":       28.4,
    "ci95_deg":        [24.1, 32.7],       # from triangulation residuals + landmark variance
    "frames_used":     19,
    "fps":             240,
    "min_confidence":  0.81,
    "quality":         "good",             # good | marginal | insufficient
}
```

A physiotherapist can act on `28.4° ± 4.3°, quality: good`. They cannot act on `28.4`, because
they have no way to know whether it means 28 or 40. **A number without an interval is not a
measurement, it's a rumour.**

---

## 5. And then the unglamorous three-quarters 🏗️

Here's the thing that surprised me about building this properly: the vision pipeline is maybe a
quarter of the system. The rest is what makes it usable by an organisation.

**Tenant isolation.** A platform serving multiple clubs must guarantee that club A never sees
club B's athletes. Enforced at the query layer, on every single query, and tested rather than
documented. This is the same principle as
[principal scoping in agent harnesses](/posts/2025/12/safe-by-default-agents/): the boundary has
to be in code, because a boundary in a convention gets crossed.

**Soft delete, always.** Medical history does not get destroyed. A "deleted" injury record is
flagged, not removed. Someone will need it for a return-to-play decision or a dispute in three
years. Soft-delete-first is a data-model decision you cannot retrofit.

**Role-based access.** Physio, strength coach, team doctor, analyst, and athlete see different
subsets. The athlete's own injury notes are not the analyst's business, and a permission model
that treats "staff" as one role will leak.

**An IOC-aligned clinical domain.** Injury and illness recording follows international consensus
statements: categories, mechanisms, severity, time-loss definitions. Inventing your own schema
means your data can never be compared to anyone else's, or pooled for research, or published.
This is the least glamorous decision in the system and one of the highest-leverage.

**Versioning and provenance.** Which model version produced this metric? Which calibration? A
metric recomputed next year with a better pose model must be *distinguishable* from the original,
not silently overwritten. Otherwise a chart showing improvement might just be showing a software
upgrade.

**Screening, workload, return-to-play as first-class objects.** A single measurement is nearly
useless. The clinical value is in the series: this athlete's trunk lean has increased 6° over
eight weeks while their bowling workload rose 30%. That's a conversation. One number is not.

---

## 6. What I'd tell myself at the start 📌

**Design the record before the algorithm.** What does a physio need to see, with what
uncertainty, in what context? Work backwards to the measurement. I did this in the wrong order
first, and rebuilt.

**Refusing to answer is a feature.** `quality: insufficient` with a reason is the most valuable
output when the input can't support a claim. Frame rate too low, joint occluded, calibration
stale, then say so. A system that always produces a number teaches people to trust numbers that
shouldn't be trusted.

**Consistency beats accuracy.** A systematic 3° bias that is stable across sessions is more
clinically useful than a randomly-±8° "unbiased" measurement, because the clinical question is
usually *change*, not absolute value.

**Store raw everything.** Video, landmarks, calibration, model version. Metrics are derived and
will be recomputed as methods improve. Anything you throw away is gone; storage is the cheapest
part of the whole system.

**Nobody cares about your pose model.** They care whether the report is trustworthy, whether it
arrives while it's still actionable, and whether it says something they can do something about.

---

## 7. The short version 📝

- Halpe-26 over MediaPipe's 33 not for count but for **the joints clinicians need**, including
  foot segments, plus better accuracy at high frame rates on GPU.
- **Two calibrated cameras + DLT triangulation** turn image-plane angles into metric 3-D. The
  triangulation is twenty lines; calibration, sync, and drift are the real work.
- Clinical metrics are properties of **trajectories**, not frames. Gate on confidence, filter
  **landmarks** (not angles), detect events, compute over windows.
- **Always attach an uncertainty interval and a quality flag.** A number without an interval is
  a rumour.
- Three-quarters of the system is tenant isolation, soft delete, RBAC, an **IOC-aligned domain**,
  and provenance.
- Design the clinical record first. Make "insufficient data" a valid, respected answer.

---

*Next: the same freeze-a-backbone, train-a-tiny-head trick from
[the ESM-2 post](/posts/2026/01/protein-language-models/), applied to
[crop disease from a drone](/posts/2026/07/crop-disease-from-the-sky/).*
