---
title: "From Pixels to a Knee Angle"
description: "The whole monocular pipeline for one number, and what the detector's pixel error costs once you express it in degrees instead of in average precision."
date: 2026-02-28
permalink: "/posts/2026/02/pixels-to-joint-angles/"
tags:
  - "biomechanics"
  - "computer vision"
  - "pose estimation"
  - "RTMPose"
  - "measurement"
  - "validation"
  - "sports science"
series: "Biomechanics from Video"
seriesOrder: 2
math: true
---

*[Part 1](/posts/2026/01/joint-angle-accuracy/) argued that a joint-angle number means nothing
without the configuration it was measured in. This part is the inside of one configuration:
every stage between a video file and a single knee angle, what each stage charges, and the one
number that almost nobody publishes, which is what the detector's pixel error costs when you
convert it into the product's own units.*

---

## 1. What we are actually computing

A coach watching a fast bowler wants to know how much the front knee collapses at ground
contact. That is a number: the angle at the knee, in degrees, at the moment the foot lands.
Zero means the thigh and the shank are in a straight line. Positive means the knee is bent. A
high peak on one leg and not the other is the thing a physiotherapist wants flagged.

Precisely: this is signed sagittal-plane knee flexion, clinical neutral zero, computed per frame
per side from the detector's 2D landmarks, then reduced over the clip to a peak. The sagittal
plane is the one you see from directly side-on, which is why how far the camera sits off side-on
matters so much ([part 5](/posts/2026/05/camera-grades-its-own-footage/) is entirely about
measuring that). The whole monocular path in Athlete Intelligence, the system this series is
about, means one camera and no markers on the athlete, and it is six stages long. The shipped
configuration is `rtmpose-l_body8-halpe26_256x192` plus `rtmdet_m` on an RTX 2080 Ti, and every
figure below was produced on it.

```
  video file, one camera
      │
      ▼
┌────────────────────────────────────────────────────────────────┐
│ 1  extract    decode, sample at up to 60 fps, 16 per batch     │
├────────────────────────────────────────────────────────────────┤
│ 2  detect     rtmdet_m finds every person, one is the          │
│                  athlete: right person on 79.0% of frames      │
├────────────────────────────────────────────────────────────────┤
│ 3  localise   rtmpose-l emits 26 (x, y, confidence) triples    │
│                  AP 78.6 / AR 81.2 on COCO val2017             │
├────────────────────────────────────────────────────────────────┤
│ 4  smooth     1-Euro filter, per joint, per axis, 1.0 Hz       │
├────────────────────────────────────────────────────────────────┤
│ 5  geometry   three points → one signed angle, per frame       │
│                  7.38° mean error against a human annotator    │
├────────────────────────────────────────────────────────────────┤
│ 6  aggregate  median filter, drop impossible, 95th-pct peak    │
└────────────────────────────────────────────────────────────────┘
      │
      ▼
  one row: knee flexion peak L/R, with its coverage
```

Six stages, six independent ways to be wrong. AP and AR in that diagram are the pose field's
own pixel-accuracy scores, taken apart in section 7. The interesting part is that stage 3, the
neural network everybody talks about, is not where most of the trouble lives, and its own
error is easier to characterise than any of the others.

Costs and limits, up front. This is the monocular path, which scores 31 / 52 / 64 out of 100
readings within 5, 10 and 15 degrees of 3D ground truth on ASPset-510, a public sprint dataset
carrying laboratory-measured 3D joint positions, single camera, unmarked athlete. Part 1 covers
why that is the honest headline and why averaging it with the multi-view row would be dishonest.
This post is about the machinery, not a defence of the score. And the system is not a medical
device: it produces evidence a clinician reads, never a decision it makes on their behalf.

---

## 2. Finding the person, not the people

A detector draws boxes round people. On a training-ground clip that is trivial. On a broadcast
frame it is the hardest stage in the pipeline, because there are a dozen people in shot and
only one of them is the athlete you were asked about.

Two mechanical facts make it hard. `rtmdet_m` resizes its input to 640 by 640. On ASPset-510's
3840 by 2160 frames that is a 6x downscale, so an athlete occupying 60 by 140 pixels reaches
the network at roughly 10 by 23 pixels and is often missed outright. And matching a candidate
box against the athlete's box on the *previous* frame fails on exactly the motion this system
exists to measure, because a sprint stride moves the athlete further than their own bounding
box between sampled frames, at which point overlap is zero and the track drops on the most
interesting part of the clip.

Both are fixed and both were measured against a paired control on the same 12 clips. Sliced
inference, meaning the detector also runs over overlapping native-resolution tiles when the
whole-frame pass finds nothing or finds only a tiny subject, moved the fraction of frames
tracking the right person from 0.946 to 0.976, monocular MAE from 14.42 to 13.85 degrees, and
runtime from 355 s to 394 s, an 11% cost. The tile grid is capped at 12 tiles, because a 4K
frame's natural grid wants about 32 and that is not deployable. Motion-predicted association,
ablated in the hinted path on the same clips, moved right-person tracking from 0.912 to 0.991
and multi-view MAE from 6.79 to 4.33 degrees.

Where it breaks: on the unhinted path across the ASPset-510 trainval split (n=1986, three
cameras) the tracker still lands on the right person only 79.0% of the time, and the per-view
histogram is starkly bimodal, 61 views near 100% and 20 views near 0%. That is whole-view
failure, not scattered noise. The fix that worked was not a better heuristic but a button:
letting the operator tap the athlete once takes 79.0% to 94.0%, and the 0-10% bucket disappears
entirely. That story belongs to part 1 and to [part
7](/posts/2026/07/what-it-refuses-to-measure/); mentioned here because a knee angle measured on
a bystander is not a bad measurement, it is a measurement of somebody else.

---

## 3. Halpe-26, and why the feet are the whole point

The pose model returns a fixed list of body landmarks with an x, a y and a confidence for
each. The commonly used list is COCO-17: nose, eyes, ears, shoulders, elbows, wrists, hips,
knees, ankles. Halpe-26 is that same list of seventeen in the same order, plus nine more.

```
    17  head
    18  neck
    19  hip (pelvis centre)
    20  L big toe      21  R big toe
    22  L small toe    23  R small toe
    24  L heel         25  R heel
```

The neck and the pelvis centre remove a noise source from hip flexion. Hip flexion is thigh
against trunk, and the trunk line needs two points. With COCO-17 you synthesise both from
midpoints of the shoulder pair and the hip pair, which means the trunk line inherits the error
of four landmarks instead of two. With Halpe-26 the service reads the native `hip_centre` and
`neck` landmarks and falls back to midpoints only when they are missing.

The six foot landmarks do something you cannot get any other way. Ankle dorsiflexion is the
angle between the shank and the foot. Without a heel and a toe there is no foot segment, so
there is nothing to take an angle against.

```
COCO-17: the leg ends         │  Halpe-26: the foot is a segment
                              │
     13  knee                 │       13  knee
      │                       │        │
      │  shank                │        │  shank
      │                       │        │
     15  ankle                │       15  ankle
      ●                       │        ●
                              │       ╱ ╲
  nothing below it.           │   24 ●   ● 20
  No foot segment, so         │   heel    big toe
  no ankle angle and          │   └─ foot vector ─┘
  no ground-contact           │
  event.                      │    DF = |∠(shank, foot)| − 90
```

That single vector, heel to big toe, does three separate jobs. It defines dorsiflexion, which is
one of the two Tier-A metrics and now has an accuracy figure: 3.50 degrees aligned MAE against
marker-based mocap on the LBMC gait trial (participant_02, all 9 cameras, n=200 frames). Aligned
means a constant offset was removed first, because the reference multibody model and this one
put their neutral zeros in different places. The raw number before that subtraction is 17.71
degrees, and the honest reading is that the waveform agrees (Pearson r = 0.789) while the zero
does not. It is also the primary signal for which way the athlete is facing, because feet point
where the athlete faces, which sets the sign of every sagittal angle at once. And it is what
makes ground-contact events legible at all: a heel and a toe with a known vertical relationship
is how you tell a heel strike from a flat foot from a toe-off, whereas a lone ankle landmark
tells you only that a leg ends somewhere near the floor.

The cost is a trap, and it is the reason there is a whole module for keypoint schemas rather
than a set of integer constants. The service used to hard-code COCO-WholeBody's foot indices.
Those are correct for the 133-landmark wholebody model, and silently wrong for Halpe-26,
because wholebody groups feet by side (L, L, L, R, R, R at 17 to 22) while Halpe interleaves
them by toe type (L, R, L, R, L, R at 20 to 25). Feeding a Halpe-26 array through wholebody
constants reads the neck as a toe and the pelvis as a heel and produces plausible-looking
garbage.

```python
HALPE26 = KeypointSchema(
    name="halpe26",
    num_keypoints=26,
    head=17, neck=18, hip_centre=19,
    l_big_toe=20, r_big_toe=21,
    l_small_toe=22, r_small_toe=23,
    l_heel=24, r_heel=25,
)

@property
def has_feet(self) -> bool:
    """True when heel + big-toe exist, so ankle DF is computable."""
    return self.has(self.l_heel) and self.has(self.l_big_toe)
```

Every consumer resolves indices through `resolve_schema(num_keypoints)`, and an unknown
keypoint count resolves to the COCO-17 core with every extension marked missing. That trade is
deliberate: lose ankle dorsiflexion, never fabricate it from a neck landmark.

The honest gap is on the validation side. COCO has no heel or toe landmark, so the detector
angle-error benchmark in section 7 below cannot score ankle dorsiflexion at all. Its only
accuracy figure comes from level gait, whose ankle range is a fraction of what a bowling
stride reaches.

---

## 4. Smoothing, because four pixels is a degree

RTMPose detections jitter by 3 to 5 pixels per frame even on a stationary subject. On a
skeleton overlay that looks like a wobble. In a clinical number it is worse than that: a 4 px
wobble on a 200 px shank is roughly 1 degree of phantom knee motion, and a peak reduction over
the clip is precisely the statistic that hunts for single-frame excursions.

A plain low-pass filter trades latency for noise rejection, and on fast motion, say the
back-leg foot during a fastball delivery, that latency shows up as a visible smear in the
angle trace. The 1-Euro filter (Casiez, Roussel and Vogel, 2012) avoids the trade by adapting
its cutoff to the signal's own velocity: heavy smoothing at rest, light smoothing during fast
motion.

```python
raw_derivative = (value - s.last_value) / dt_s
alpha_d = _lowpass_alpha(self.derivative_cutoff_hz, dt_s)
smoothed_derivative = alpha_d * raw_derivative + (1.0 - alpha_d) * s.last_derivative
s.last_derivative = smoothed_derivative

# Adapt the value-filter cutoff to the speed.
cutoff = self.min_cutoff_hz + self.beta * abs(smoothed_derivative)
alpha = _lowpass_alpha(cutoff, dt_s)
smoothed = alpha * value + (1.0 - alpha) * s.last_value
```

Shipped as `OnlineKeypointSmoother(min_cutoff_hz=1.0, beta=0.05)`, causal, one filter pair per
joint, the same constants in the monocular and multi-view paths so both modes are equally
steady. It runs inside a single interleaved pass, detect then smooth then angles per batch of
16 frames, which bounds memory at roughly 100 MB for 1080p rather than holding every decoded
frame.

Two details that matter more than the filter itself.

The smoothed stream feeds the angles, not just the overlay. That sounds obvious and was not
always true: the filter was originally added so the drawn skeleton would stop wobbling, and
the angles were computed from the raw detections beside it. Fixing that was a small change and a
real accuracy change, because the jitter was landing directly in the clinical numbers.

And a low-confidence joint resets its own filter rather than being smoothed. Without that
reset a single garbage detection smears into the trajectory for several frames afterwards.
Three different confidence floors sit in the monocular path, and confusing them is a bug (the
multi-view triangulator carries a fourth of its own, at 0.3):

| Floor | Value | Question it answers |
|---|---|---|
| Smoothing reset | 0.05 | Is there a keypoint here at all |
| Geometric hints | 0.15 | Which way is the athlete facing, which side is near |
| Clinical angle | 0.35 | Should a physio be shown a number from this |

0.05 is the right question for resetting a filter and the wrong question for reporting a
measurement. On real wide-shot footage of a bowler about 60 px tall, 59% of the knee-chain
keypoints scored below 0.3 and the tenth percentile was 0.063. The detector was guessing.
Passing those through produced a knee-flexion series spanning minus 179 to plus 179 degrees,
whose peak was then whatever noise sample landed nearest the anatomical bound: the reported
figure was 169.9 degrees, which is the bound itself. That is not a weak measurement, it is a
fabricated one.

---

## 5. Three points, one angle

Here is the whole of the interesting maths. Take the hip, the knee and the ankle. The thigh
vector runs hip to knee, the shank vector runs knee to ankle. The knee's bend is the signed
rotation from the first to the second, which is the arctangent of their 2D cross product over
their dot product:

$$\theta = \operatorname{atan2}\big(v_1 \times v_2,\; v_1 \cdot v_2\big)$$

`atan2` rather than `arccos` because `arccos` loses half its significant digits near 0 and 180
degrees, exactly where a nearly-straight leg sits, and because `atan2` needs no domain clamp.

```python
def _signed_angle(v1: np.ndarray, v2: np.ndarray) -> float:
    """Signed angle v1 to v2 in degrees, positive counter-clockwise (y-up)."""
    cross = float(v1[0] * v2[1] - v1[1] * v2[0])
    dot = float(v1[0] * v2[0] + v1[1] * v2[1])
    if abs(cross) < 1e-12 and abs(dot) < 1e-12:
        return 0.0
    return float(np.degrees(np.arctan2(cross, dot)))


def _hinge_flexion(proximal, middle, distal, facing, flex_ccw_when_facing_right):
    """Signed hinge flexion (knee / elbow), 0 deg = segments aligned."""
    seg_prox = _up(middle) - _up(proximal)
    seg_dist = _up(distal) - _up(middle)
    if np.linalg.norm(seg_prox) < 1e-6 or np.linalg.norm(seg_dist) < 1e-6:
        return 0.0
    bend = _signed_angle(seg_prox, seg_dist)
    sense = 1.0 if flex_ccw_when_facing_right else -1.0
    return sense * facing * bend
```

Three things in that function are the difference between a number and a measurement.

`_up` flips image y, because image coordinates run downward and rotation sense is meaningless
until you have agreed which way is up. `facing` is plus one for image-right and minus one for
image-left, and multiplying by it is what makes a bowler running right and a bowler running
left produce the same sign for the same movement. `flex_ccw_when_facing_right` encodes that
the knee folds the shank backward while the elbow folds the forearm forward, so the same
function serves both hinges with one boolean. Hyperextension comes out negative for free.

The gate around it is as important as the geometry:

```python
def ok(*idx: int) -> bool:
    """True when EVERY listed keypoint is confident enough to measure."""
    return all(conf(i) > angle_floor for i in idx)

knee_flex_l = 0.0
if facing != 0 and ok(L_HIP, L_KNEE, L_ANKLE):
    knee_flex_l = _hinge_flexion(
        kp(L_HIP), kp(L_KNEE), kp(L_ANKLE), facing,
        flex_ccw_when_facing_right=False,
    )
```

Every keypoint in the chain, not most of them. An angle is defined by its whole chain, and one
guessed vertex makes the angle a guess: a hip and a knee placed confidently with an invented
ankle yields a confident-looking number about nothing. And `facing != 0`, because an unknown
facing would give a coin-flip sign, and a mirrored measurement is not a small error. Facing
scored 100 out of 100 on the frames where it was comparable (COCO val2017, n=919), which is
why [part 4](/posts/2026/04/facing-and-sign/) is about it: the thing that never fails is the
thing whose failure would be catastrophic.

Failed frames report 0.0, which the aggregator treats as "not measured", and the coverage
figure makes the loss visible instead of silent.

---

## 6. The guard that drops the impossible

Even after all that, some frames produce a knee flexed 175 degrees. No knee does that. So the
aggregator carries a table of anatomical bounds and a guard that applies it.

```python
ANATOMICAL_BOUNDS: dict[str, tuple[float, float]] = {
    "knee_flex":    (-20.0, 170.0),   # hyperextension to heel-to-glute
    "hip_flex":     (-60.0, 160.0),   # extension to deep flex (squat)
    "elbow_flex":   (-15.0, 170.0),   # boxer hyperextend to bicep curl
    "ankle_df":     (-80.0, 45.0),
    "shoulder_rot": (-200.0, 200.0),  # baseball pitcher ER + IR arc
}


def _clip_to_bounds(values: list[float], metric_key: str) -> list[float]:
    """Drop values outside the anatomical range for this joint."""
    bounds = ANATOMICAL_BOUNDS.get(metric_key)
    if bounds is None:
        return values
    lo, hi = bounds
    return [v for v in values if lo <= v <= hi]
```

Note that it drops rather than clips, despite the name. Clipping would replace a demonstrably
failed measurement with a plausible-looking one, which is the single worst thing this pipeline
could do. Dropping makes the failure visible in the coverage figure if a whole clip is bad.

The bounds are deliberately generous where sport is generous. Shoulder rotation runs to plus
and minus 200 degrees because a baseball pitcher at peak cocking reaches roughly 180 degrees
of external rotation, and a tighter bound would clip the exact reading that matters most for
arm health. Ankle dorsiflexion runs the other way. Its ceiling used to be plus 70 degrees,
which matched no published source, and real cricket and football clips were passing 43 to 46
degree "peak dorsiflexion" readings. Norkin and White give 0 to 20 degrees non-weight-bearing,
and even a deep weight-bearing lunge in a very mobile athlete tops out near 40. The ceiling is
now plus 45. Re-running the same clips afterwards: cricket 25-46 degrees became 21-31,
football 44-46 became 33-36, which is where a bowler's and a footballer's loaded ankle
actually sits. That is a plausibility bound, not a validation. A value that survives it is not
verified, merely not impossible.

Two more guards sit alongside it. A peak is not reported at all below 8 measured frames,
because a peak range of motion derived from three surviving frames is an anecdote. And the
peak is the 95th percentile, not the maximum, because `max()` is an extreme-value statistic
whose expectation grows with the number of samples: the same athlete performing the same
movement would score a higher peak ROM on a three-minute clip than on a thirty-second one,
purely because the longer clip gave noise more chances to spike. A number that depends on how
long the camera was running is not a property of the athlete.

---

## 7. What the detector's pixel error costs, in degrees

Now the part that gets skipped. Pose papers report AP and AR, and this deployment reproduces
its model's published spec inside its own pipeline: AP 78.63, AP@50 93.60, AP@75 85.84, AR
81.25 on COCO val2017 with ground-truth boxes, 4791 person crops, 79.4 poses per second.

AP is a number about pixels. Nobody buys pixels. So the same detector was scored in the
product's own units, by computing angles two ways from the same image and the same bounding
box: once from the human annotator's keypoints, once from the detector's. Both sides are
pushed through the service's own `angles_from_2d`, so every convention (facing, clinical zero,
sign) is identical on both sides and cancels. The Halpe-26 output is truncated to the COCO-17
core so both sides resolve to the same schema, otherwise the prediction would use native neck
and pelvis landmarks while the reference synthesised them from midpoints, and that
definitional difference would masquerade as detector error. Crops come from the ground-truth
box, so a missed or mis-associated person cannot contaminate the number. COCO val2017, n=2000,
minimum 10 labelled keypoints.

| Joint | MAE | Bias | Within 10° |
|---|---|---|---|
| Shoulder flexion | 5.11° | −0.33° | 88 / 100 |
| Hip flexion | 6.60° | −0.25° | 83 / 100 |
| Knee flexion | 7.31° | −0.78° | 83 / 100 |
| Elbow flexion | 10.49° | −0.28° | 77 / 100 |

![A lollipop chart of mean absolute error for four joint angles, shoulder at 5.11 degrees rising to elbow at 10.49 degrees, with a bias column showing every value within a degree of zero](/figures/detector-cost-in-degrees.svg "Pixel error converted into the unit a clinician actually reads. Angles from human annotations against angles from the detector, same image and same box, COCO val2017. Bias stays under a degree in every joint, so the detector is noisy rather than skewed.")
| Mean | 7.38° | | 83 / 100 |

Overall, 58.3% of readings within 5 degrees, 82.7% within 10, 91.1% within 15.

The bias column is the interesting one and it is why the table is shaped this way. Bias is the
average signed error. Near-zero bias with a non-trivial MAE means the detector is noisy but
unbiased: its errors scatter around the truth rather than sitting to one side of it.

```
   knee flexion error, 1152 readings   MAE 7.31°  bias −0.78°

             ▁▂▃▅▇█▇▅▃▂▁
    ──────────────┼──────────────────  ► error, degrees
                  0
                  ▲
                  └ the cloud is centred on zero, so a mean over
                    many frames of a movement pulls toward the truth

   a biased detector would look like this instead:

                        ▁▂▃▅▇█▇▅▃▂▁
    ──────────────┼──────────────────  ► error, degrees
                  0          ▲
                             └ averaging converges on the wrong answer
```

That has a direct product consequence. A metric computed over many frames, a peak reduced from
a whole movement, a mean trunk lean across a stride cycle, partly cancels this error. A
single-frame reading gets none of that benefit and carries the full 7.4 degrees. So "the knee
angle at ground contact on frame 214" and "peak knee flexion across the delivery stride" are
not the same quality of measurement even though they come off the same detector, and the
second is the one worth putting in front of a physiotherapist.

One more reason to believe the number. The ASPset-510 harness computes angles twice, once from
noise-free projections of the mocap and once from the real detector, and differences out to
about 7.7 degrees for the detector's contribution against 3D truth (11.72 degrees perfect
projections, 19.44 with the detector). That independently matches the 7.38 measured on COCO by
a completely different route, on a different dataset, against a different kind of reference.
Two harnesses agreeing is the reason either is trustworthy.

Where it breaks: this is agreement with a human annotator on a 2D image, not accuracy against
physical truth. A perfect score would mean "as good as the annotator", not "correct". And COCO
is everyday photography, arbitrary camera angles, heavy occlusion, crowds, nothing like a
coached side-on capture, so this is a stress test rather than an estimate of in-service
accuracy.

---

## 8. Why the elbow is worst, and what that predicts

The elbow is the outlier: 10.49 degrees against the shoulder's 5.11, more than twice as bad.
Reading the per-side rows in the generating report tells you *how* it is worst, which is more
useful than knowing that it is.

| Joint, side | MAE | RMSE | n |
|---|---|---|---|
| Shoulder flexion, left | 5.12° | 7.44° | 715 |
| Shoulder flexion, right | 5.09° | 7.63° | 696 |
| Knee flexion, left | 7.63° | 24.50° | 575 |
| Knee flexion, right | 6.98° | 12.56° | 577 |
| Elbow flexion, left | 10.44° | 28.47° | 714 |
| Elbow flexion, right | 10.55° | 30.75° | 688 |

The shoulder's RMSE is 1.45 and 1.50 times its MAE, left and right. The elbow's is 2.7 and
2.9. RMSE punishes large errors quadratically, so a ratio that high says the elbow's problem
is not a wider cloud, it is a tail: most elbow readings are fine and a minority are
catastrophic.

That fits the geometry exactly. Sagittal flexion of a hinge is measured by its projection onto
the image plane. The knee's distal segment, the shank, is anatomically constrained to stay
roughly in the plane of the leg. The elbow's distal segment, the forearm, goes anywhere: a
batsman's forearm points at the camera as often as across it. When a limb points down the
optical axis it projects to a stub, and the direction of a stub is noise, so the angle it
yields can be off by 90 degrees rather than by 8. Frames where the forearm happens to lie in
the image plane are fine. Frames where it does not are the tail.

If that reading is right, it makes a prediction: the elbow's error is an observability
problem, not a localisation problem, so recovering the missing dimension should help the elbow
much more than it helps the knee. The LBMC camera-count sweep tests it directly, aligned MAE
against marker-based mocap, mean over ten random camera subsets at each count:

| Cameras | Knee | Elbow |
|---|---|---|
| 3 | 2.80° | 3.13° |
| 4 | 2.40° | 2.16° |
| 5 | 2.33° | 1.71° |
| 6 | 2.29° | 1.66° |

The knee improves by 0.51 degrees between three cameras and six. The elbow improves by 1.47,
and overtakes the knee on the way. On all nine LBMC cameras the elbow is the best-measured
joint in the set, 1.73 degrees aligned MAE at Pearson r = 0.997, against the knee's 2.52. The
joint that is worst from one camera is best from nine, which is what an observability problem
looks like and what a localisation problem does not.

The careful version of the conclusion, because there is a real trap in it. "The elbow needs
the third dimension" does not mean "guess the third dimension from one camera". Those are
different claims and the second one is false, measurably, on exactly these metrics. Recovering
depth from multiple real viewpoints is triangulation. Recovering it from a single viewpoint is
inference, and for sagittal flexion the inference costs more than it buys. That is
[part 3](/posts/2026/03/why-2d-beat-3d/), and it is the reason the monocular path in this
system computes angles from 2D geometry rather than from a fitted body model.

---

## The short version

- One knee angle is six stages deep: extract, detect, localise, smooth, geometry, aggregate.
  The neural network is one of them and not the leakiest.
- Halpe-26 buys a neck and a pelvis landmark (a cleaner trunk line for hip flexion) and six
  foot landmarks. The heel-to-toe vector is what defines ankle dorsiflexion, sets the facing
  sign, and makes ground-contact events legible. COCO-17 can do none of that.
- Keypoint indices are a real trap: wholebody groups feet by side, Halpe interleaves them by
  toe type, and mixing the two reads the neck as a toe. Resolve schemas, never hard-code
  indices.
- Smoothing is not cosmetic. A 4 px jitter on a 200 px shank is about 1 degree of phantom knee
  motion, and a peak reduction hunts for exactly that. The 1-Euro filter adapts its cutoff to
  velocity, so it does not smear fast motion.
- Three confidence floors in the monocular path answer three different questions: 0.05 for "is
  anything here", 0.15 for geometric hints, 0.35 for "show a physio a number". Confusing them
  produced a fabricated 169.9 degree knee peak on a 60-pixel bowler.
- Expressed in the product's own units, the detector costs 7.38 degrees mean (knee 7.31, elbow
  10.49, shoulder 5.11, hip 6.60) on COCO val2017, n=2000, with bias under 0.8 degrees
  everywhere. Noisy but unbiased, so multi-frame metrics partly cancel it and single-frame
  readings do not.
- The elbow is worst by a tail, not by a wider cloud, RMSE 2.7 to 2.9 times MAE against the
  shoulder's 1.45 to 1.50. That is out-of-plane geometry, and adding cameras fixes it: 3.13
  degrees at three cameras to 1.66 at six on LBMC, against the knee's 2.80 to 2.29.

*Part 3 takes the obvious next step and finds it goes the wrong way:
[why direct 2D beat monocular 3D](/posts/2026/03/why-2d-beat-3d/) on the very angles this
system reports, and why a body model was removed from the clinical path rather than added to
it.*
