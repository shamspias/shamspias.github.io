---
title: "Teaching a Camera to Grade Its Own Footage"
description: "Camera obliquity is invisible to one lens, so the system infers it from anatomy. Banding its own error by that estimate beats banding by ground truth."
date: 2026-05-23
permalink: "/posts/2026/05/camera-grades-its-own-footage/"
tags:
  - "biomechanics"
  - "computer vision"
  - "pose estimation"
  - "RTMPose"
  - "validation"
  - "measurement"
  - "sports science"
series: "Biomechanics from Video"
seriesOrder: 5
math: true
---

*Part 5 of eight. This is the best result in the whole programme, and it is not a better
estimator. It is the system learning to tell you which row of its own accuracy table your clip
belongs in. The strange part is what fell out of measuring that: the system's guess about the
camera predicts its error better than the true camera geometry does.*

---

## 1. The table nobody could stand in

[Part 1](/posts/2026/01/joint-angle-accuracy/) ended with a configuration table, and I still
think it is the most honest thing on the validation page. One camera on free sport action puts
52 out of 100 joint-angle readings within 10° of 3D ground truth, which here means the angles
from the dataset's own three-camera 3D reconstruction of the same movement. Three calibrated
cameras, plus one tap on screen to say which person in frame is the athlete, puts 92 out of 100
within 10°. Same code, same detector, same weights. The configuration is the measurement
(`validation/README.md` §1, ASPset-510).

Underneath that sat a second table, which is the one that actually governs a single-camera clip:
one phone, no rig. Monocular (single-camera) error is not a number, it is a function of how far
round from side-on the camera was standing. That angle is called obliquity. The middle column
below is mean absolute error (MAE), the average size of the mistake in degrees with the
direction thrown away (`validation/README.md` §3, ASPset-510, n=1986):

| Obliquity, true | Monocular MAE | n |
|---|---|---|
| 0-15° | 12.79° | 305 |
| 15-30° | 11.99° | 298 |
| 30-45° | 16.32° | 356 |
| 45-60° | 20.70° | 381 |
| 60-75° | 26.33° | 291 |
| 75-90° | 34.63° | 355 |

A factor of nearly three, decided entirely by where a phone was propped. And the table was
useless, because obliquity is defined against the athlete's 3D hip axis, and the monocular path
never recovers a 3D hip axis. That is the whole point of it being monocular. So a coach holding
a clip and a report could not tell whether their number came from the 12.79° row or the 34.63°
row, which means the table told them nothing they could act on. Publishing an error curve
indexed by a quantity your user cannot observe is only slightly better than publishing one
number.

In engineering terms: the strongest single predictor of monocular error was unavailable at
inference time. That is the problem this post is about, and it matters most for the monocular
path because that is the one most clips actually take
([part 3](/posts/2026/03/why-2d-beat-3d/)).

## 2. What obliquity is, and why one lens cannot see it

Plainly: stand square to the side of a runner and you see their knee bend across the frame, the
full arc, nothing hidden. Walk round to stand in front of them and the same knee bend now
happens mostly toward you and away from you, which a flat image barely records at all. Obliquity
is how far round you have walked. Zero degrees is dead side-on. Ninety degrees is face-on.

Precisely: obliquity is the angle between the athlete's transverse hip axis and the camera's
optical axis, and in the benchmark harness it is computed from the dataset's own calibration and
mocap as the arccosine of `abs(cos)`, the absolute dot product of the normalised hip vector with
the optical axis, absolute because facing toward or away from the lens is equally measurable
(`pose-service/benchmarks/bench_aspset.py`, `_obliquity_deg`). Sagittal flexion is measured by
projecting a limb onto the image plane. At 90° obliquity that projection is along the optical
axis, so the motion the metric exists to measure has nowhere to land.

The cost of not knowing it is not abstract. Every sagittal number in a monocular report carries
an error bar somewhere between 12° and 35°, and nothing on the page says which.

## 3. Anatomy as a ruler

Here is the trick, and it is almost embarrassingly simple once you see it.

Turning away from side-on does not only hide the flexion. It also squashes the athlete's hip
line and shoulder line in the image. Side-on, the hips are one behind the other and the hip line
projects to nearly nothing. Face-on, the hips are side by side and the hip line projects to its
full width. So the width you can see *is* the obliquity, if you know what the full width should
have been.

```
  Overhead view. The camera is below the page, looking up it.

  obliquity 0°          obliquity 45°         obliquity 90°
  clean profile         oblique               face-on

       L                    L                 L──────R
       │                     ╲
       │                      ╲
       │                       ╲
       │                        ╲
       │                         R
       │
       R

      ▕▏                   ▕─────▏           ▕───────▏
      ~0 px                0.71 w            1.00 w

  sagittal flexion      flexion partly        flexion points
  fully visible         along the axis        at the lens

  Bottom rows: the hip line's width on the sensor, as a fraction of
  its true width. It is 5 of 7 columns at 45° because sin 45° = 0.71.
```

Knowing "what the full width should have been" is the part that needs care, because a hip line
20 pixels wide could be a side-on adult close to the lens or a face-on child at forty metres.
The fix is to divide by something that does not foreshorten with obliquity: the trunk. Mid-hip
to mid-shoulder is roughly vertical, so rotating the athlete about their own long axis does not
change its projected length. Dividing by it cancels both the subject's size and the camera's
distance in one step.

That gives the estimator, where $w$ is the projected hip or shoulder width in pixels, $\ell$ is
the projected trunk length in pixels, and $K$ is the anatomical width-to-trunk ratio:

$$\sin\theta \;\approx\; \frac{w / \ell}{K}$$

Both transverse axes are used when both are visible. The shoulders are wider, so their
signal-to-noise is better, but they are more often occluded by the arms. Here is the shipped
implementation, trimmed of its comments:

```python
HIP_WIDTH_TRUNK_RATIO = 0.343
SHOULDER_WIDTH_TRUNK_RATIO = 0.719
_MIN_TRUNK_PX_FOR_OBLIQUITY = 20.0


def estimate_obliquity_deg(keypoints_xy, confidence):
    floor = HINT_CONF_FLOOR  # 0.15, a position hint, not a measurement
    if not (
        confidence[L_SHOULDER] > floor
        and confidence[R_SHOULDER] > floor
        and confidence[L_HIP] > floor
        and confidence[R_HIP] > floor
    ):
        return float("nan")

    mid_sh = 0.5 * (keypoints_xy[L_SHOULDER] + keypoints_xy[R_SHOULDER])
    mid_hip = 0.5 * (keypoints_xy[L_HIP] + keypoints_xy[R_HIP])
    trunk_px = float(np.linalg.norm(mid_sh - mid_hip))
    if trunk_px < _MIN_TRUNK_PX_FOR_OBLIQUITY:
        return float("nan")

    hip_px = float(np.linalg.norm(keypoints_xy[L_HIP] - keypoints_xy[R_HIP]))
    sh_px = float(np.linalg.norm(
        keypoints_xy[L_SHOULDER] - keypoints_xy[R_SHOULDER]))
    sines = [
        (hip_px / trunk_px) / HIP_WIDTH_TRUNK_RATIO,
        (sh_px / trunk_px) / SHOULDER_WIDTH_TRUNK_RATIO,
    ]
    sin_obl = float(np.mean([min(1.0, max(0.0, s)) for s in sines]))
    return float(np.degrees(np.arcsin(min(1.0, sin_obl))))
```

Three details in there are load-bearing, and each of them is a refusal rather than a
computation.

The confidence gate uses `HINT_CONF_FLOOR`, 0.15, not the 0.35 floor that gates a reported
angle. Getting obliquity slightly wrong costs a caveat; demanding clinical confidence on four
torso landmarks would leave usable clips with no estimate at all
(`pose-service/src/pose_service/pipeline/angles_from_2d.py`).

`_MIN_TRUNK_PX_FOR_OBLIQUITY = 20.0` refuses a distant athlete outright. Below about twenty
pixels of trunk, the width-to-trunk ratio is dominated by rounding rather than by geometry, and
a number built from rounding that reads "clean profile" is worse than no number.

The clamp before averaging matters for the same reason. A ratio above 1 means the observed width
exceeded the anatomical maximum, which happens with off-average proportions or a foreshortened
trunk, and it carries no information beyond "as frontal as it gets". Without the clamp, arcsin
gets a domain error or a lie.

## 4. The two constants, measured once

$K$ is a population number, so it had to be measured rather than assumed. Both ratios come from
ASPset-510's mocap, 12,070 frames across 60 clips and 6 subjects: hip width to trunk 0.343 with
a between-subject SD of 0.021, shoulder width to trunk 0.719 with an SD of 0.035
(`validation/README.md` §3b, and the same figures as constants in `angles_from_2d.py`).

Those SDs are about 6% and 5% of the ratios, which is the honest bound on the method's precision
and it is not a small one. But look where it bites. The derivative of arcsin is gentle near zero
and unbounded near one, so a fixed error in the ratio buys a small angular error near profile
and a large one near frontal. That is the right way round: the estimator is sharpest where the
decision matters, telling a clean profile from a moderately oblique clip, and vaguest at the
frontal end where the only actionable conclusion ("do not trust sagittal flexion here") has
already been reached.

The unit tests pin that behaviour rather than trusting it. On synthetic torsos projected through
a perspective camera at known angles, the estimate lands within 3° of truth across the whole
0-90° range; at proportions scaled 15% off the population mean, well beyond the measured
between-subject spread, a 10° view must still read below 25° and an 80° view must still read
above 55°, because what the product acts on is the regime and not the decimal
(`pose-service/tests/test_view_obliquity.py`).

## 5. How well the estimate works

Two conditions, because estimator error and detector error must stay separable. Noise-free
projections score the geometry alone. Real detections are what production sees
(`validation/README.md` §3b, ASPset-510, n=1986 each):

| Condition | MAE | Bias | Pearson r |
|---|---|---|---|
| Noise-free projections | 8.75° | +2.57° | 0.909 |
| Real detections | 14.47° | +5.45° | 0.686 |

Read the bias column before the MAE column. It is positive in both rows, and the method predicts
that it should be: a camera on a stand looks slightly down, which shortens the observed trunk,
which inflates the width-to-trunk ratio, which inflates the estimate. So the estimator errs
toward calling a clip *more* oblique than it is. That is the safe direction. Overstating
obliquity costs a caveat on a clip that did not need one. Understating it grants false
confidence to a measurement that has none, which is the failure I care about. There is a test
whose only job is to stop a future change quietly inverting that sign
(`test_camera_pitch_biases_upward_not_downward`).

A 14.47° MAE on real detections is not a precise instrument. Hold that number, because it is the
whole argument in section 8.

## 6. The result that looks backwards

Now the part I did not expect.

The point of the estimate was to let a reader place their clip on the §3 curve. So I banded
the monocular error by the estimate, expecting a blurred, weaker version of the true-obliquity
table: the same shape, flattened by the estimator's own 14.47° error.

It came out sharper.

![Paired horizontal bars for six obliquity bands, each band showing the error when banded by true obliquity and by the system's own estimate; the estimate separates the best band at 7.69 degrees against 12.79 for the truth](/figures/obliquity-banding.svg "The same monocular readings, banded by true obliquity and by the system's own estimate of it. The estimate separates good frames from bad ones more sharply than the truth does, which is the result I went looking for a bug over.")

With the within-tolerance scores and the frame counts, from `validation/README.md` §3b:

| Estimated band | MAE | Within 10° | n |
|---|---|---|---|
| 0-15° | 7.69° | 81 / 100 | 153 |
| 15-30° | 11.13° | 71 / 100 | 310 |
| 30-45° | 14.18° | 59 / 100 | 320 |
| 45-60° | 20.72° | 50 / 100 | 396 |
| 60-75° | 26.11° | 35 / 100 | 469 |
| 75-90° | 26.70° | 30 / 100 | 159 |
| saturated at 90° | 37.37° | 23 / 100 | 179 |

The true-obliquity table has no separation at the good end at all: 12.79° in the 0-15° band
against 11.99° in the 15-30° band, which inverts. The estimate splits them cleanly, 7.69°
against 11.13°, and that lowest band is where a coach lives. Pooling the two best estimated
bands is what produces the scorecard row that looks like a different system: 74 out of 100
readings within 10°, on n=463, from the same monocular code that scores 52 overall
(`validation/README.md` §1). Nothing was improved. The estimator simply became able to tell its
good conditions from its bad ones.

An approximation beating the quantity it approximates is the sort of result that should make you
go looking for the bug. I did. There isn't one.

## 7. Why that happens, and the general lesson

The reason is that the estimate and the angles are computed from the same detections.

```
                        ┌────────────────────┐
      one video frame ─▶│  RTMDet + RTMPose  │
                        └──────────┬─────────┘
                                   │ 26 keypoints + confidences
                     ┌─────────────┴─────────────┐
                     ▼                           ▼
          ┌────────────────────┐      ┌────────────────────┐
          │ sagittal joint     │      │ obliquity estimate │
          │ angles             │      │ width / trunk      │
          └──────────┬─────────┘      └──────────┬─────────┘
                     ▼                           ▼
              the measurement              the band label
                      ╲                        ╱
                       ╲   both inherit the   ╱
                        ╲  SAME landmark     ╱
                         ╲     noise        ╱
                          ▼                ▼
             which is why the band predicts the error
             better than the true camera angle does
```

This is the second viewpoint fact this system infers from the 2D landmarks instead of measuring
it, after facing direction ([part 4](/posts/2026/04/facing-and-sign/)), and the two behave very
differently. Facing reads the heel-to-toe vector, falling back to the nose against the shoulder
centre, and scores 100 out of 100 on COCO val2017 (n=919) because it only has to pick a sign.
Obliquity is built from four torso landmarks and has to produce a magnitude, and it manages
14.47°.

True obliquity is a fact about the camera and nothing else. It knows where the lens was standing
and it knows nothing about whether RTMPose found the athlete's hips, whether motion blur smeared
the shoulder line, whether the athlete was thirty pixels tall, or whether the skeleton was
tracking a bystander. The estimate knows all of that, because a frame whose landmarks are poorly
localised yields both a worse angle and an inflated obliquity. It is a viewpoint estimate that
happens to double as a detection-quality estimate, and detection quality is the other half of
the error budget.

I can show that coupling directly, from a completely different experiment. Three runs of the
same crowded cricket clip on the deployed stack, differing only in the operator's mark (no mark,
a mark on the mid-field player, a mark on the far-left player), produce view obliquity of 77.7°,
90° and 90°, and peak ankle dorsiflexion of 31.2°, 38.3° and 23.2°
(`validation/README.md` §8). The camera did not move
between those runs. The obliquity reading moved because the *evidence* moved, which is
precisely the property that makes it a better predictor than the geometry.

So, stated as generally as I am willing to state it:

> A system's self-assessed capture-quality signal can be a better predictor of that system's own
> error than the ground-truth condition it was built to approximate, because the signal absorbs
> every upstream failure that the ground truth is blind to.

That is worth carrying to any confidence-estimation problem, and it inverts a habit I had. My
instinct was always to validate a quality heuristic by how closely it tracks the true condition,
and to reject it when the correlation was mediocre. Pearson r of 0.686 against true obliquity is
mediocre. It is also irrelevant, because the job is not to measure obliquity. The job is to
predict this system's error, and the right way to score a confidence signal is by how well it
stratifies the error it is meant to qualify, not by how well it recovers the physical quantity
you had in mind when you designed it. Those are different objectives and this is the first
time I have had a measurement showing them come apart.

There is a warning attached, the same one that runs through [part
6](/posts/2026/06/triangulation-and-cameras/) about reprojection error. A signal computed from
the same evidence as the answer is a good stratifier and a terrible auditor. It cannot catch a
systematic failure that corrupts both halves in step, and a whole view tracked on the wrong body
is exactly that: the estimate and the angles will agree, confidently, about a bystander. The
band label is a triage signal, not an audit. The audit is the skeleton overlay and a human eye.

## 8. What ships, and what it deliberately does not do

Every monocular job reports four fields in its quality block:

```json
{
  "view_obliquity_deg": 22.4,
  "view_obliquity_coverage": 0.94,
  "view_obliquity_band": "sagittal",
  "view_matches_declared": true
}
```

The degrees figure is the median over frames where it could be computed, and the coverage
figure is the fraction of frames that was, so a mostly-refused estimate cannot pass itself off
as a confident one. The band edges are asserted in a test rather than left to drift. They are
round numbers, but they are not there for being round: they are the two places the measured
answer changes usefulness:

```python
OBLIQUITY_SAGITTAL_MAX_DEG = 30.0
OBLIQUITY_OBLIQUE_MAX_DEG = 60.0


def _obliquity_band(median_deg):
    if median_deg is None:
        return None
    if median_deg <= OBLIQUITY_SAGITTAL_MAX_DEG:
        return "sagittal"
    if median_deg <= OBLIQUITY_OBLIQUE_MAX_DEG:
        return "oblique"
    return "frontal"
```

`view_matches_declared` is the one that catches a real operator mistake. The upload declares a
camera plane, because the geometry alone cannot tell a shoulder abduction job from a shoulder
flexion job, and that declaration routes the shoulder angle into the flexion fields or the
abduction fields. If footage submitted as sagittal reads frontal, the flexion numbers are being
read off a projection that barely contains the motion, and until this existed nothing in the job
said so. It fires only on a genuine contradiction: an oblique clip declared sagittal is a
degraded measurement, which the coverage and band chips already report, so the mismatch flag
stays quiet there. Its test spends more assertions on the cases where it must stay quiet than on
the ones where it fires (`test_view_mismatch_only_fires_on_a_real_contradiction`).

In the review page they land as chips, worded as things to check:

```
  camera 22° off side-on (sagittal)          tone: ok
  camera 71° off side-on (frontal)           tone: warn
  footage doesn't look sagittal              tone: warn
    - check the camera plane you selected
```

And here is the product decision, which is the one I would defend hardest.

It is reported and never enforced. No job is rejected for reading frontal. No angle is
suppressed, no number is recomputed, no upload is refused. At 14.47° MAE the estimate is strong
enough to prompt a second look at a clip and not strong enough to overrule the person who filmed
it. A gate at 30° on a signal with a 14° error would refuse good sagittal footage often enough
to teach operators that the system is wrong, which is how a safety feature becomes a habit of
clicking past warnings.

That is a different judgement from the flexion observability gate in [part
7](/posts/2026/07/what-it-refuses-to-measure/), which does refuse, and the difference is
instructive. There, the sagittal-projection ratio is computed from triangulated 3D and the
thing it predicts is catastrophic: below a ratio of 0.15, shoulder-flexion MAE is 122.38°,
which is not a degraded reading but a fabricated one. Refusing below 0.45 costs 2.1% of
readings (`validation/README.md` §4b). Here the worst band is 37.37° MAE, which is bad and is
still a measurement, on a signal that is itself an inference. Precision of the signal, and
severity of what it predicts, together decide whether you report or refuse. Neither alone
does.

## 9. Where it breaks

The bound I am least comfortable with is that every obliquity figure here is agreement with
ASPset-510's mocap reconstruction, on one dataset, whose three cameras sit in a shallow arc
about ten metres out (`validation/README.md` §8c). There is no in-vivo validation anywhere in
this programme: not one of these numbers is a comparison against a goniometer on a real athlete
(`validation/README.md` §9). Public datasets
bound the estimator. Only a clinical study licenses a clinical threshold, and the outstanding
one is 15-20 athletes with reference goniometry by two raters, reporting MAE, bias,
Bland-Altman limits of agreement and test-retest MDC per metric per side.

The rest, honestly:

- **Saturation is a real band, not an edge case.** 179 of the readings hit the 90° clamp and
  score 37.37° MAE, the worst row in the table. The clamp is right, since a width above the
  anatomical maximum means only "as frontal as it gets", but a saturated estimate carries no
  gradient and cannot be read as a measurement.
- **The two anatomical constants come from six subjects.** Between-subject SD is 0.021 and
  0.035, measured on ASPset's own mocap. Children, and athletes far from the population mean in
  shoulder-to-trunk proportion, are outside anything I have measured.
- **Camera pitch is unmodelled.** It is the mechanism behind the positive bias. I know the sign
  and I have a test pinning it, and I do not have a correction.
- **Monocular limb foreshortening is still not gated.** A thigh pointing at the lens projects to
  a few pixels and its angle is noise, and the monocular path currently rejects only a
  zero-length limb. High obliquity and foreshortening coincide, so the band label partly covers
  it, but a per-limb gate against anatomically expected length would be tighter. Identified, not
  implemented (`validation/README.md` §9).
- **The band is not evidence the right person was tracked.** All nine of the cross-sport clips
  reported `multi_person_frame_fraction` between 0.77 and 1.00, and the cricket experiment above
  shows the obliquity reading moving with the subject choice. A confident sagittal chip on a
  bystander is a possible output.

The honest summary of the feature is narrower than the result: on this dataset the system can
sort its own frames into error regimes better than the true camera geometry can, and it says so
on the page in units an operator can act on. That is a triage improvement and an interface
improvement. It is not a measurement improvement, and I would rather say so than let a coach
read 7.69° as an accuracy figure for their clip.

## The short version

- Monocular error is a function of camera obliquity, from 12.79° at side-on to 34.63° face-on on
  ASPset-510, and the table was unusable because obliquity is defined against a 3D hip axis a
  single camera never recovers.
- Obliquity foreshortens the hip and shoulder lines, so normalising projected width by trunk
  length recovers the sine of it up to anatomy: hip-to-trunk 0.343 and shoulder-to-trunk 0.719,
  measured from 12,070 mocap frames over 60 clips and 6 subjects.
- The estimate scores 8.75° MAE on noise-free projections and 14.47° on real detections, with
  positive bias in both, because camera pitch shortens the observed trunk. It errs toward
  flagging a clip as more oblique than it is, which is the safe direction.
- Banding the monocular error by the estimate separates the regimes better than banding by the
  truth does: 7.69° against 12.79° in the best band. That is not an accident and not a bug.
- It happens because the estimate is computed from the same detections as the angles, so it
  absorbs detection quality as well as viewpoint. A self-assessed capture-quality signal can
  predict a system's own error better than the ground-truth condition does.
- So score a confidence signal by how well it stratifies the error, not by how faithfully it
  recovers the physical quantity you had in mind. Pearson r of 0.686 against true obliquity is
  mediocre and irrelevant.
- The same coupling makes it a bad auditor: it cannot catch a failure that corrupts the angles
  and the estimate together, which is what tracking the wrong body does.
- It ships as `view_obliquity_deg`, a coverage figure, a band label and `view_matches_declared`,
  reported and never enforced. At 14.47° MAE the estimate is strong enough to prompt a second
  look and not to overrule the operator.

*Part 6 moves to the multi-view path, where the athlete's hip axis is directly observable and
the interesting failures move somewhere else entirely: a solver that makes its own objective
look better while landing the joints 23% further out in millimetres.*
