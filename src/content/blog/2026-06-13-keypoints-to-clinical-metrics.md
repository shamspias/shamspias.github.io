---
title: "From 26 Keypoints to Clinical Metrics"
description: "Two calibrated cameras, DLT triangulation, trajectory filtering, and honest uncertainty intervals: what turns a pose demo into a record a clinician will sign."
date: 2026-06-13
permalink: "/posts/2026/06/keypoints-to-clinical-metrics/"
tags:
  - "biomechanics"
  - "computer vision"
  - "RTMPose"
  - "sports science"
  - "system design"
  - "multi-view"
series: "Vision in the Real World"
seriesOrder: 2
math: true
---

*A laptop demo that measures joint angles is a weekend project. A system a physiotherapist will
put in a medical record is a different animal. This is what sits between them.*

---

## 1. The gap

The [previous post](/posts/2026/05/bowling-biomechanics-pose/) got us to a real measurement:
point a webcam at a bowler, get four joint angles, compare them against thresholds from the
sports science literature. Genuinely useful, and nowhere near what a clinical system needs.

Here is the gap, laid out honestly.

| | Demo | Clinical system |
|---|---|---|
| Cameras | one | two or more, calibrated together |
| Coordinates | image-plane pixels | metric 3-D, in millimetres |
| Frame rate | phone slow motion, unsynchronised | 120–240 FPS, hardware synchronised |
| Output | numbers on a screen | a versioned record, attributable |
| Failure mode | wrong number, shrug | wrong number in someone's medical file |
| Who reads it | you | a physio, a doctor, possibly a lawyer |
| Data model | none | tenant-isolated, soft-delete, audited |

Notice how few of those rows are about computer vision. Most of the distance between a demo and
a clinical tool is engineering, governance and honesty about uncertainty, not a better pose
model. Drawn as layers, the thing everybody talks about is the bottom one:

```
┌──────────────────────────────────────────────────────────────┐
│ clinical record: screening, workload, return-to-play         │
├──────────────────────────────────────────────────────────────┤
│ governance: tenancy, roles, soft delete, audit, provenance   │
├──────────────────────────────────────────────────────────────┤
│ measurement: events, windows, metrics, uncertainty           │
├──────────────────────────────────────────────────────────────┤
│ vision: detect, keypoints, triangulate            the demo   │
└──────────────────────────────────────────────────────────────┘
                                                       ▲
                                         the weekend project stops here
```

---

## 2. Twenty-six keypoints, chosen rather than counted

MediaPipe gives 33 landmarks and runs on a laptop CPU. For clinical work I moved to **RTMPose**
with the **Halpe-26** keypoint set, on a GPU. Fewer points, better system, and the reasons are
worth spelling out, because "more landmarks" sounds like it ought to win.

Halpe-26 is the COCO 17 (eyes, ears, nose, shoulders, elbows, wrists, hips, knees, ankles) plus
nine that biomechanics actually uses: head, neck, mid-hip, and then big toe, small toe and heel
on each foot. MediaPipe's 33 spends eleven landmarks on the face and mouth, has no neck and no
mid-hip point (you synthesise those by averaging, which averages the noise too), and gives one
generic `foot_index` per foot rather than a big toe and a small toe. That last difference is not
cosmetic. A heel and one toe point give you the long axis of the foot, which is enough for
foot-strike angle and for transverse-plane foot progression. Two toe points plus the heel give
you a plane, and with it the medio-lateral axis, which is what any claim about inversion or
eversion has to rest on. A line cannot tell you which way the foot rolled.

Throughput is the second reason. RTMPose is top-down (find the person first, then find that
person's joints) and tuned for accuracy per millisecond on CPU and GPU alike, so with one
athlete in frame and a GPU behind it, inference keeps up with a 240 FPS camera and a ten-second
capture is finished before the bowler has walked back to his mark. The third reason is stability
under occlusion: the bowling arm crosses the body and the trunk rotates, and the difference in
landmark jitter is the difference between a trajectory you can filter and one you have to
hand-clean.

Both of those models are older than they look, which matters more than the brand name. On the
MediaPipe side the legacy `mp.solutions.pose` wrapper is gone and everything goes through the
Tasks `PoseLandmarker` now, as the previous post already had to account for. RTMPose dates from
2023, with RTMO (one-stage) and RTMW (whole-body) since, alongside the ViTPose family. So put
the detector behind an interface that returns named keypoints with per-keypoint confidence, and
swap it freely. Model tier moves your numbers by a degree or two. Keypoint set, calibration and
frame rate move them by an order of magnitude more than that.

The general lesson: **pick a keypoint set by the measurements you need to compute, not by
keypoint count.** Twenty-six well-chosen points beat thirty-three generic ones.

---

## 3. Two cameras and some linear algebra

Single-camera 2-D is the fundamental limitation from the last post. A joint angle measured in
the image plane is wrong by an unknown amount whenever the limb has a component pointing toward
the camera, and *the image gives you no way to recover that amount*. It is not a precision
problem. The information is not there.

Two cameras put it there. The technique is **triangulation**, done here with the direct linear
transform (DLT), and it is elementary once calibration is done. Each camera has a
$3 \times 4$ projection matrix $P$ taking a world point to image coordinates:

$$
\begin{bmatrix} u \\ v \\ 1 \end{bmatrix} \sim P \begin{bmatrix} X \\ Y \\ Z \\ 1 \end{bmatrix}
$$

One camera gives two equations for three unknowns, which is underdetermined, which is the
ambiguity. Two cameras give four equations for three unknowns, and you take the least-squares
solution of the overdetermined system. Geometrically: each camera casts a ray through the pixel
where it thinks the elbow is, and you want the point closest to both rays.

```python
import numpy as np

def triangulate(views):
    """Direct Linear Transform over N >= 2 views.

    views: [(P, (u, v)), ...] with P a 3x4 projection matrix and (u, v)
    already undistorted. Returns the point in calibration units (mm).
    """
    rows = []
    for P, (u, v) in views:
        rows.append(u * P[2] - P[0])
        rows.append(v * P[2] - P[1])
    _, _, Vt = np.linalg.svd(np.asarray(rows, dtype=float))
    X = Vt[-1]
    return X[:3] / X[3]


def reprojection_error(X, views):
    """Mean pixel distance between the reprojected point and each detection.

    This is the cheapest honest quality signal you have per keypoint.
    """
    errs = []
    for P, uv in views:
        p = P @ np.append(X, 1.0)
        errs.append(np.linalg.norm(p[:2] / p[2] - np.asarray(uv)))
    return float(np.mean(errs))
```

Two things people get wrong here. First, `cv2.triangulatePoints` exists and is correct, but it
takes exactly two views; once you have three cameras you want the N-view form above, and with
four or more you want it wrapped in a small RANSAC so one badly occluded view cannot drag the
point. Second, **undistort before you triangulate** (`cv2.undistortPoints`, and pass `P=` unless
you want normalised coordinates back rather than pixels). Lens distortion left in the pixel
coordinates goes straight into your millimetres, and it is largest at the edges of the frame,
which is exactly where a run-up happens.

Now your keypoints are in millimetres in a world frame, and joint angles computed from them are
real 3-D angles rather than projections. Trunk rotation, essentially unmeasurable from one
camera, becomes a direct calculation.

### 3.1 The part that is actually hard

The triangulation is twenty lines. The calibration is the work.

You need each camera's intrinsics (focal length, principal point, distortion coefficients) and
the extrinsics (where each camera sits relative to the other). The modern procedure is a ChArUco
board rather than a plain checkerboard, waved through the shared volume: ChArUco corners are
individually identified, so partial views still contribute, which matters enormously when you
are trying to cover the corners of a net. `cv2.aruco.CharucoDetector` then `cv2.calibrateCamera`
and `cv2.stereoCalibrate`.

The camera geometry is a genuine trade-off, and it is worth seeing from above:

```
            plan view, looking down on the crease

   cam A ▣                                       ▣ cam B
           ╲                                   ╱
             ╲                               ╱
               ╲                           ╱
                 ╲         ~65°          ╱
                   ╲                   ╱
                     ╲               ╱
                       ╲           ╱
                         ╲       ╱
                           ╲   ╱
                             ● bowler

   narrow baseline  depth badly conditioned, error along the rays
   90 degrees       best conditioning, worst overlap and occlusion
   60 to 70         what actually survives a real net session
```

What nobody warns you about:

- **Calibration drifts.** A tripod nudged by a millimetre changes your extrinsics and therefore
  every millimetre downstream. Recalibrate per session, and store the calibration *with the
  recording*, not in a config file that the next session overwrites.
- **Synchronisation is critical.** At 240 FPS one frame of offset is 4.2 ms, and at bowling-arm
  speeds that is centimetres of apparent displacement, triangulated into a physically impossible
  point. Hardware trigger or genlock if you can afford it. If you cannot, a sharp clap in frame
  and audio cross-correlation gets you to sub-frame alignment for free, and you should verify it
  every session rather than assume it holds.
- **Test the rig, not the maths.** Triangulate a rigid wand with two markers a known distance
  apart, moved around the capture volume. If the measured length is 500 mm ± 2 mm everywhere,
  your calibration is good. If it reads 494 mm in one corner, you have found the problem before
  it found a patient record. This test costs nothing and catches most disasters.

One expectation to set before you promise anything to a clinician. Markerless multi-view has
real open tooling now (OpenCap and the OpenSim ecosystem are the usual entry points, Theia3D the
commercial comparison), and published validations broadly agree on the shape of the result:
markerless matches marker-based to within a few degrees on large sagittal-plane angles, and does
noticeably worse on axial rotations and small joints. Good in the plane of motion, shakier out
of it.

---

## 4. Trajectories, not frames

Clinical metrics are almost never single-frame quantities. They are properties of a curve.

```
        elbow angle through the delivery swing
  180° ┤                                    ╭──────
       │                                ╭───╯
  170° ┤                          ╭─────╯
       │                     ╭────╯
  160° ┤              ╭──────╯
       │        ╭─────╯
  150° ┤────────╯
       └────────┬───────────────────────────┬──────
         arm-horizontal                  release
                │←──── extension = 30° ────→│
```

So this is a signal-processing pipeline, and the order of operations is where the subtle bugs
live:

```
  right order                          the trap

  2-D keypoints                        2-D keypoints
      │                                    │
      ▼  gate on confidence                ▼
  drop bad views                       compute angles
      │                                    │
      ▼                                    ▼
  triangulate to mm                    smooth the angles
      │                                    │
      ▼  Savitzky-Golay on x, y, z         ▼
  smooth trajectory                    peaks shifted, and
      │                                nothing tells you
      ▼                                by how much
  events, windows, metrics
```

**Gate on confidence first.** A landmark with confidence 0.2 is a guess, and smoothing a guess
just spreads it over its neighbours. With multiple cameras you have a better option than
dropping the frame: drop that *view* of that keypoint and triangulate from the remaining ones,
falling back to "unusable window" only when fewer than two views survive.

**Filter the landmarks, not the angles.** A joint angle is a nonlinear function of coordinates.
Smoothing the angle smooths a nonlinear function of the noise, which shifts your extrema, which
means a confidently wrong peak, which is worse than a noisy one.

```python
from scipy.signal import savgol_filter

# xyz is (frames, joints, 3) in millimetres; filter along the time axis.
# Window 9 at 240 FPS is 37 ms, comfortably shorter than the swing.
xyz_smooth = savgol_filter(xyz, window_length=9, polyorder=3, axis=0)
```

That window length is not a magic number: it is a claim that the true signal does not turn
faster than about 37 ms. At 30 FPS the same 9-frame window spans 300 ms and would flatten the
entire delivery swing. Filter windows are in seconds, not frames, and code that hard-codes
frames breaks silently when someone swaps the camera.

**Then detect events, then compute over windows.** Front-foot contact, arm-horizontal and
release come from velocity zero-crossings and extrema exactly as in the previous post, but now
on metric 3-D coordinates, which makes them far more robust: the vertical velocity of an ankle
in millimetres is a physical quantity, and the same thing in pixels was partly a statement about
camera distance. Metrics are peak, range, timing and rate over the window between two events.

---

## 5. The interval is the deliverable

This is the step that separates a clinical output from a number, and the one most demos skip.

Where does the interval come from? Not the model's confidence score: that number says how peaked
the model's own output is, and it is not calibrated in millimetres of anything. Measure the
detector's real 2-D error yourself, against a static marker at the working distance, and get a
standard deviation in pixels. Then push that through the whole chain by resampling, because the
chain is nonlinear and there is no clean closed form:

```python
def metric_interval(window, sigma_px, compute, n_boot=500, seed=0):
    """95% interval for a scalar metric, by resampling 2-D landmark noise.

    window:   [[[(P, (u, v)), ...], ...], ...]  views per joint per frame
    sigma_px: measured detector error, not the model's confidence score
    compute:  takes (frames, joints, 3) in mm, returns one number
    """
    rng = np.random.default_rng(seed)
    samples = []
    for _ in range(n_boot):
        xyz = np.array([
            [triangulate([(P, uv + rng.normal(0, sigma_px, 2)) for P, uv in j])
             for j in frame]
            for frame in window
        ])
        samples.append(compute(savgol_filter(xyz, 9, 3, axis=0)))
    return np.percentile(samples, [2.5, 97.5])
```

Five hundred resamples over a 20-frame window costs a fraction of a second, nothing next to the
video decode, and 500 rather than 50 because a 2.5th percentile read off a handful of tail
samples is itself noise. The output a clinician receives is then a record, not a scalar:

```python
metric = {
    "name":           "elbow_extension",
    "value_deg":      30.4,
    "ci95_deg":       [26.1, 34.7],
    "frames_used":    19,
    "fps":            240,
    "min_confidence": 0.81,
    "max_reproj_px":  1.7,
    "quality":        "good",        # good | marginal | insufficient
    "model_version":  "rtmpose-halpe26@2026.02",
    "calibration_id": "cal-2026-06-13-net3",
}
```

A physiotherapist can act on `30.4° with a 95% interval of 26 to 35, quality good`. They cannot
act on `30.4`, because nothing tells them whether it means 30 or 42. **A number without an
interval is not a measurement, it is a rumour.**

And note the interval does the refusing for you. If the resampled spread crosses the 15-degree
legality threshold, the honest output is not a verdict, it is `marginal` plus the reason.

---

## 6. The unglamorous three quarters

Here is what surprised me about building this properly: the vision pipeline is maybe a quarter
of the system. The rest is what makes it usable by an organisation.

**Tenant isolation.** A platform serving several clubs must guarantee that club A never sees
club B's athletes. Enforced at the query layer, on every query, and tested rather than
documented. Same principle as
[principal scoping in agent harnesses](/posts/2025/12/safe-by-default-agents/): the boundary has
to live in code, because a boundary that lives in a convention gets crossed.

**Soft delete, always.** Medical history does not get destroyed. A "deleted" injury record is
flagged, not removed, because someone will need it for a return-to-play decision or a dispute in
three years. Soft-delete-first is a data-model decision you cannot retrofit cheaply.

**Role-based access (RBAC).** Physio, strength coach, team doctor, analyst and athlete each see
a different subset. The athlete's own injury notes are not the analyst's business, and a
permission model that treats "staff" as one role will leak.

**An IOC-aligned clinical domain.** Injury and illness recording follows the international
consensus statement on recording and reporting in sport: agreed categories, mechanisms, severity
and time-loss definitions. Inventing your own schema means your data can never be compared with
anyone else's, pooled for research, or published. This is the least glamorous decision in the
system and one of the highest-leverage.

**Versioning and provenance.** Which model version produced this metric, and which calibration?
That is why those two fields sit in the metric record above. A metric recomputed next year with
a better pose model must be distinguishable from the original, never silently overwritten.
Otherwise a chart showing improvement might just be showing a software upgrade, and you will not
find out until someone asks.

**Screening, workload and return-to-play as first-class objects.** A single measurement is
nearly useless. The clinical value is in the series, and the sentence you want to be able to
write is of this shape: trunk lean up 6° over eight weeks while bowling workload rose 30%. That
is a conversation. One number is not.

---

## 7. What I would tell myself at the start

**Design the record before the algorithm.** What does a physio need to see, with what
uncertainty, in what context? Then work backwards to the measurement. I did this in the wrong
order first and rebuilt.

**Refusing to answer is a feature.** `quality: insufficient` with a reason is the most valuable
output when the input cannot support a claim. Frame rate too low, joint occluded in both views,
calibration stale: say so. A system that always produces a number teaches people to trust
numbers that should not be trusted.

**Consistency beats accuracy.** A systematic 3° bias that is stable across sessions is more
clinically useful than a randomly ±8° "unbiased" measurement, because the clinical question is
almost always *change*, not absolute value.

**Store raw everything.** Video, 2-D detections, calibration, model version. Metrics are derived
and will be recomputed as methods improve. Anything you throw away is gone, and storage is the
cheapest part of the whole system by an order of magnitude.

**Nobody cares about your pose model.** They care whether the report is trustworthy, whether it
arrives while it is still actionable, and whether it says something they can act on.

---

## 8. The short version

- Halpe-26 over MediaPipe's 33 for the joints clinicians need, not for the count: neck, mid-hip
  and a foot that is a segment rather than a direction.
- Treat the detector as swappable. Keypoint set, calibration and frame rate move your numbers
  far more than the model tier does.
- **Two calibrated cameras plus DLT triangulation** turn image-plane angles into metric 3-D.
  Undistort first, and use the N-view form once you have three cameras.
- The triangulation is twenty lines. Calibration, synchronisation and drift are the real work,
  and a two-marker wand of known length is the test that catches most of it.
- Clinical metrics are properties of **trajectories**. Gate on confidence, filter landmarks and
  not angles, then detect events and compute over windows.
- **Always attach an interval and a quality flag**, derived from measured detector error rather
  than model confidence. A number without an interval is a rumour.
- Three quarters of the system is tenant isolation, soft delete, RBAC, an IOC-aligned domain,
  and provenance on every metric.
- Design the clinical record first, and make "insufficient data" a valid, respected answer.

---

*Next: the same freeze-a-backbone, train-a-tiny-head trick from
[the ESM-2 post](/posts/2026/01/protein-language-models/), applied to
[crop disease from a drone](/posts/2026/07/crop-disease-from-the-sky/).*
