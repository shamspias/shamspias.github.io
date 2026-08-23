---
title: "What \"Accurate\" Means For a Joint Angle"
description: "A percentage without a tolerance is not a claim. Here is the full scorecard for a video biomechanics system, by configuration, and why 10 degrees is the number that settles it."
date: 2026-01-31
permalink: "/posts/2026/01/joint-angle-accuracy/"
tags:
  - "biomechanics"
  - "computer vision"
  - "pose estimation"
  - "RTMPose"
  - "sports science"
  - "validation"
  - "measurement"
series: "Biomechanics from Video"
seriesOrder: 1
math: false
---

*Part 1 of eight. I spent a long time measuring how wrong my own joint angles are, and the
most useful thing I learned had nothing to do with the model. It was that a number cannot be
checked until you say what it is allowed to be wrong by. This post sets the standard the
other seven posts are held to.*

---

## 1. The claim a coach actually hears

Someone demonstrates a system that reads joint angles off a video, and the sentence in the
room is "it's about 95% accurate".

Try to check that. You cannot, and not because you lack the data. In plain terms, imagine a
tape measure sold as "97% accurate". Accurate to the nearest what? The nearest millimetre, the
nearest centimetre, the nearest arm's length? Until somebody says, the number is a mood.

Precisely: a percentage is a proportion of some population that satisfies some predicate, and
a claim of the form "N% accurate" states the proportion while leaving the predicate blank. It
is unfalsifiable by construction. The repair is one word long. Say the tolerance:

> "91% of readings land within 15 degrees."

That is a claim. It names a population (readings), a predicate (absolute error at or below 15
degrees) and a proportion. You can go and disagree with it. You can run the same protocol, get
a different number, and we have something to argue about. Every score in this series is shaped
that way, and the shape is not decoration: it is the difference between a marketing line and a
measurement.

There is a cost to being this explicit, and it is worth stating up front. One number becomes a
table, the table has rows that look bad, and a table with bad rows in it is harder to sell than
a single confident percentage. That is the trade. I would rather print the figure that came out
badly than round it, partly out of taste and mostly because the bad rows are the ones that tell
you where the system must not be used.

---

## 2. The system under discussion

Everything measured in this series comes from one real system, which I built. It is called
Athlete Intelligence: a multi-tenant athlete performance management platform for elite sport,
covering an athlete registry, an injury and illness register, screening, fitness testing,
workload, return to play, dashboards, an in-app AI assistant, and a GPU pose pipeline that
turns ordinary video into clinical movement metrics.

The stack, for the engineers: Go with `chi` and GORM over PostgreSQL on the backend, Next.js 16
and React 19 on the front end, and a Python and FastAPI pose service running RTMPose with a
2D clinical geometry path and multi-view triangulation. It deploys as multi-stage Docker images,
on RunPod Serverless or self-hosted.

Two things to be clear about before any number appears.

It is proprietary. It is described here, never published. There is no paper, no venue and no
co-author behind any figure in this series. These are my own measurements of my own system, run
on the configuration that ships, and the only reason to believe them is that the harness and
the report are in the repository with the checkpoint hash and dataset split stamped into them.

And it is not a medical device. The README says it in one line and I will repeat it: Athlete
Intelligence supports performance and clinical decision making, it does not diagnose or treat,
and clinical judgement stays with qualified professionals.

Every figure below was produced by a script in `pose-service/benchmarks/` on the shipped
configuration: `rtmpose-l_body8-halpe26_256x192` plus `rtmdet_m`, checkpoint hash
`a09ef9971f13`, on an RTX 2080 Ti. Throughput on that card is 79 poses per second, which
matters only in that the accuracy numbers are not from some slower research configuration I
would never deploy.

---

## 3. Score one: against a human annotator

The first question is narrow and answerable. If you hand the same image to a human annotator
and to the detector (the model that marks where the joints are), and push both sets of
keypoints, the dots it places on shoulder, hip, knee and ankle, through the same geometry code,
how far apart are the joint angles?

Narrow, because it isolates one error source. The reference and the prediction go through the
service's own `angles_from_2d`, so every convention (facing detection, clinical zero, sign)
is identical on both sides and cancels out. Crops come from the ground-truth bounding box, so
a missed or mis-associated person cannot contaminate the result. What is left is keypoint
localisation error, expressed in degrees.

On COCO val2017, n = 2000 (`report_coco-val2017-detector-angle-error`):

| Tolerance | Score |
|---|---|
| within 5 degrees | 58 / 100 |
| within 10 degrees | 83 / 100 |
| within 15 degrees | 91 / 100 |

The raw report figures are 58.30, 82.70 and 91.10. Same run, same 2000 annotations. Notice
that all three are true at once, and that a vendor free to pick one would pick 91.

```
 the same distribution of errors, read at three tolerances
 COCO val2017, n = 2000, one column = 2 readings out of 100

 within  5 deg  █████████████████████████████░░░░░░░░░░░░░░░░░░░░░  58
 within 10 deg  ██████████████████████████████████████████░░░░░░░░  83
 within 15 deg  ██████████████████████████████████████████████░░░░  91

 "91% accurate" is any one of these three lines, or none of them.
 The tolerance is not a footnote to the percentage. It is half of it.
```

Per joint, because the mean hides which joint is letting you down:

| Joint | MAE | Bias | Within 10 degrees |
|---|---|---|---|
| Shoulder flexion | 5.11 | minus 0.33 | 88 / 100 |
| Hip flexion | 6.60 | minus 0.25 | 83 / 100 |
| Knee flexion | 7.31 | minus 0.78 | 83 / 100 |
| Elbow flexion | 10.49 | minus 0.28 | 77 / 100 |
| Mean | 7.38 | | 83 / 100 |

Read the bias column beside the MAE. In plain terms, the detector is shaky rather than
crooked: it misses in both directions roughly equally, so averaging over the frames of a clip
cancels part of the error rather than accumulating it. Precisely, a mean absolute error of
7.38 degrees with a bias under one degree on every joint means the error is close to
zero-mean, so a peak or mean statistic over many frames is better conditioned than any single
frame. That is a real property and I lean on it later in the series.

Where it breaks, and the caveats are in the report for a reason. This is agreement with a
human annotator on a 2D image, not accuracy against physical truth, so a perfect score would
mean "as good as the annotator", not "correct". The annotator's own error is inside the
reference. COCO is everyday photography with arbitrary camera angles, occlusion and crowds,
which makes it a stress test rather than an estimate of in-service accuracy. And ankle
dorsiflexion is not scored at all here, because COCO has no heel or toe landmark. Closing that
gap took a different dataset, and it is the subject of
[part 7](/posts/2026/07/what-it-refuses-to-measure/).

For reference, from the companion run on the same weights, over 4791 ground-truth person crops,
the keypoint metrics a vision engineer will want: AP 78.63, AP at 50 of 93.60, AP at 75 of
85.84, AR 81.25 (`report_coco-val2017-keypoints-body17-gt`). Different report, different n, so
it is quoted beside the angle numbers and never mixed into them.

---

## 4. Score two: against 3D ground truth

The harder and more honest test replaces the human annotator with a motion-capture
reconstruction, and asks the whole pipeline rather than the detector alone. ASPset-510 gives
three real calibrated cameras and 3D joint positions for free sport action.

Here the single-number instinct dies, because the same code, the same weights and the same
clip yield wildly different scores depending on how the footage was captured and how much the
operator was willing to help.

Share of readings within each tolerance of 3D ground truth, ASPset-510 trainval, as the
system's own validation summary reports them:

| Configuration | within 5 | within 10 | within 15 |
|---|---|---|---|
| Multi-view, calibrated, athlete marked | 75 / 100 | 92 / 100 | 96 / 100 |
| Multi-view, calibrated | 67 / 100 | 83 / 100 | 87 / 100 |
| Multi-view, canonical rig | 42 / 100 | 58 / 100 | 66 / 100 |
| Monocular, athlete marked | 35 / 100 | 57 / 100 | 70 / 100 |
| Monocular, single camera | 31 / 100 | 52 / 100 | 64 / 100 |
| Monocular, frames read as within 30 degrees of side-on | 52 / 100 | 74 / 100 | 83 / 100 |

![Grouped horizontal bars comparing six capture configurations by the share of joint-angle readings within 5, 10 and 15 degrees of the ground truth, from multi-view calibrated with athlete markers at the top to a single camera at the bottom](/figures/scorecard-configurations.svg "The same table as a picture. Every row is the same code on the same clips; what changes is how much the camera and the calibration are told. The last row is the fifth one again, scored only on the frames the system itself flags as well captured.")

Three of those rows deserve a sentence each.

**"Athlete marked"** means the operator tapped the athlete once, on one frame, to say which
person in the crowd is the subject. In these runs the tap is simulated from the centre of the
dataset's own athlete box on the first annotated frame, one mark per camera, no per-frame help.
That single tap is the largest improvement measured anywhere in this project, and it came from
the interface rather than the estimator. [Part 3](/posts/2026/03/why-2d-beat-3d/) is where that
bill gets itemised.

**"Canonical rig"** means three cameras put in declared positions with no calibration target
in the room. The system starts from the layout it was told, then refines that layout from the
footage itself, which is not the same thing as having measured it. It is the configuration a
club can actually run, and it is the worst multi-view row on the table.
[Part 6](/posts/2026/06/triangulation-and-cameras/) is about why.

**The last row is not a seventh configuration.** It is the same monocular code as the fifth
row, scored only on the frames the system itself flags as close to side-on: n = 463, pooled
from its own estimated 0 to 15 and 15 to 30 degree obliquity bands. The estimator did not get
better at anything. It got able to tell its good conditions from its bad ones, which is a
different and in some ways more useful property.
[Part 5](/posts/2026/05/camera-grades-its-own-footage/) is entirely about that row.

Here is the same table as a mechanism, because the interesting thing is which knob buys what:

```
 MONOCULAR PATH                   MULTI-VIEW PATH (3 cameras)
 share within 10 deg              share within 10 deg

  1 camera, as filmed             canonical rig, uncalibrated
        52 / 100                        58 / 100
           │                               │
           │ tap the athlete               │ calibrate the rig
           │           + 5                 │           + 25
           ▼                               ▼
  1 camera, marked                calibrated rig
        57 / 100                        83 / 100
           │                               │
           │ keep only frames it           │ tap the athlete
           │ reads within 30 deg           │           + 9
           │  n = 463, a SUBSET            ▼
           ▼  of the rows above   calibrated rig, marked
  1 camera, within 30 deg of side-on    92 / 100
        74 / 100

 The two chains do not join. The 74 is a filtered subset, not a
 configuration you can choose, and 58 sits BELOW 74: three
 uncalibrated cameras are worse than one well-aimed camera.
```

That last line is the one that cost me the most. Left to find the athlete on its own, the
uncalibrated canonical rig scores 19.09 degrees mean error, level with a single camera on the
same run: three cameras arranged by eye bought nothing at all. Marking the athlete is what
changes it, to 11.66 against 15.5 for one marked camera, and that is the first time "use three
cameras without calibrating them" was advice worth giving. Rig refinement's own contribution is
coverage rather than accuracy. It multiplies the frames the solver can use by roughly five, and
it does not rescue a rig whose geometry is nothing like the real one.

---

### Where these numbers come from, and a caveat about that

Every figure in this series is quoted from the validation summary that ships with the system,
which is itself generated from harnesses in the repository. Those harnesses get re-run more
often than the summary gets rewritten, so a reader who opens the individual reports will find
small differences in some rows: a 31 that is now 32.3, a 19.4 that is now 19.21. I am quoting
the summary because it is the document that states which configuration each row belongs to, and
the configuration is the measurement.

I would rather point that out than let you find it. It is also the same failure the summary
itself warns about in its own first section, which is that an earlier draft quoted a mean error
from one run beside a table from another. Keeping a summary and its evidence in step is work,
and it is work that never feels urgent until somebody checks.

## 5. Averaging the rows is a lie by compression

Look at the "within 10" column and the temptation is obvious. Six numbers, take the mean,
publish one figure.

Do it: (92 + 83 + 58 + 57 + 52 + 74) / 6 = 69.3. So, "69% of readings within 10 degrees".

Every part of that is wrong, and the ways it is wrong are worth separating.

It is wrong arithmetically. That is an unweighted mean over configurations, not over readings.
The real proportion depends on how many clips of each kind you happen to score, so the
"system accuracy" would move if I filmed more clips with one camera and none with three, while
the system itself changed in no respect at all. A number that moves when nothing moves is not
a measurement of the system.

It is wrong structurally. Row six is a subset of row five's frames, so averaging counts the
same frames twice under two different labels.

And it is wrong in the way that actually harms someone. A coach reading 69 has no way to know
that their setup, one phone on a tripod at whatever angle the pitch allowed, is the 52 row, and
that the 92 row belongs to a configuration they have never once used. The average is not a
summary of the table. It is a device for moving credit from the good configurations to the bad
ones.

So the rule this series follows, stated once:

> Do not average these into one number. The configuration is the measurement.

The engineering consequence is that "what is your accuracy" has no answer, and the product has
to carry the configuration with the number all the way to the screen. Every pose job in
Athlete Intelligence writes a quality block alongside its metrics: per-metric coverage, the
clinical evidence tier, the view provenance for monocular jobs, and the rig calibration
before and after for multi-view jobs. The metric and the conditions it was measured under are
stored together, because separating them is how 69 gets published.

The single most useful sentence I can give a coach is therefore not a percentage. It is a
percentage with its conditions attached: with three calibrated cameras and one tap to say
which person is the athlete, 92 out of 100 joint-angle readings land within 10 degrees of 3D
ground truth. Without the tap, 83. With one camera on free sport action, 52, and back up to 74
on the clips the system reads as side-on.

---

## 6. Why the tolerance is 10 degrees

Now the part that makes the whole exercise something other than a benchmark hobby.

Ten degrees is not a round number I chose because it looked reasonable. It is the decision
boundary the clinical workbook already uses. The screening module flags a bilateral asymmetry,
left side against right side, when hip total arc of rotation differs by more than 10 degrees.
That threshold predates the video pipeline. It comes from the physical screening protocol,
where a physio measures both hips with a goniometer and writes down two numbers.

Straight from the domain layer, with the human-readable note field trimmed for width:

```go
// backend/internal/domain/calc.go
if in.HipARC_L != nil && in.HipARC_R != nil {
    l, r := *in.HipARC_L, *in.HipARC_R
    if delta := math.Abs(l - r); delta > 10 {
        out = append(out, AsymmetryFlag{
            Test:      "Hip Total ARC",
            Side:      sideOfDeficit(l, r),
            Left:      l,
            Right:     r,
            Delta:     delta,
            Threshold: 10,
        })
    }
}
```

And the thresholds are shipped to the client as data, so the front end and the video path read
the same constants the goniometry path does:

```go
// backend/internal/domain/lookups.go
AsymmetryThresholds: AsymmetryLimits{
    HipARCDeg:      10,
    ShoulderROMDeg: 15,
    GripPercent:    10,
    KTWcm:          1.0,
},
WorkbookVersion: "HP_Master_Database_v1.0",
```

That reframes the accuracy question completely. The system was not bought to produce small
error bars. It was bought to answer one question: *is this athlete more than 10 degrees
asymmetric?* Which means the tolerance in the scorecard is not an evaluation choice at all. It
is the size of the thing the user is trying to see.

In plain terms: if your ruler is wobbly by a centimetre, you cannot use it to decide whether
two planks differ by a centimetre. Precisely: when the measurement error is comparable to the
decision threshold, the flag it feeds is dominated by noise, and the false positive and false
negative rates converge on coin-flipping regardless of how good the underlying biology signal
is.

```
 mean joint-angle error, one column = 1 degree
 the mark at 10 deg is the workbook's own asymmetry threshold
 near side-on = the frames the system reads within 15 deg of side-on

                                        10 deg
                                        │
 3 cams, calib, marked   4.5  ████      │
 1 cam, near side-on     7.7  ████████  │
 3 cams, calibrated      8.9  █████████ │
 canonical rig, marked  11.7  ████████████
 1 cam, as filmed       19.4  ███████████████████
 axial rotation, ASPset 41.3  █████████████████████████████████████████

 Above the mark, the error is bigger than the thing being decided.
 That is not a slightly worse measurement. It is a different product.
```

The bottom row is the honest disaster, and it is the reason the tier system exists. Axial
rotation, the twist of a limb about its own long axis, reads 41.3 degrees mean error on
ASPset with the dataset's own true calibration, on the very frames where sagittal angles
measured 8.9. Hip total arc and shoulder total range of motion, the two metrics the workbook
flags at 10 and 15 degrees, key off exactly that axis.

So the code refuses to treat them as measurements. The comment in the aggregation step spells
out the reasoning, and the two constants beneath it are the gate:

```python
# src/pose_service/pipeline/aggregate.py
METRIC_TIERS: dict[str, str] = {
    "hip_arc_l": "C",
    "hip_arc_r": "C",
    "shoulder_rom_l": "C",
    "shoulder_rom_r": "C",
    "knee_flexion_l": "A",
    "knee_flexion_r": "A",
    "ankle_df_l": "A",
    "ankle_df_r": "A",
}

TIER_C_MIN_COVERAGE = 0.5
TIER_C_THRESHOLD_FACTOR = 2.0
```

Tier A is sagittal-plane flexion: a validated class, defensible. Tier C is transverse-plane
axial rotation, screening only. A Tier-C asymmetry flag survives only if both sides cleared 50%
frame coverage and the bilateral difference exceeds twice the workbook threshold. As the
comment in that file records, doubling 10 degrees to 20 is *still* inside the noise, which is
why Tier-C values are a prompt to go and measure by hand and never a measurement.

Where this breaks, and it is a real break rather than a caveat: 41.3 degrees is a worst case
set by one dataset's rig, not an intrinsic limit. ASPset's three cameras sit in a shallow arc
about 10 metres out, which barely constrains the transverse plane at all. The same code on
CMU Panoptic's 21-view dome reads 6.90 degrees, and on the LBMC dataset's genuine 360 degree
nine-camera rig it reads 4.27, once a constant offset and a sign convention are taken out, on
one participant's gait trial of 200 frames. The product's canonical rig surrounds the athlete,
so it resembles Panoptic far more than ASPset. Both numbers are reported and neither is quoted
alone, and until an in-vivo study gives limits of agreement on a real rig, hip arc and shoulder
range of motion stay Tier C with their flags gated.
[Part 6](/posts/2026/06/triangulation-and-cameras/) is where the rig geometry argument is made
properly.

---

## 7. What the scorecard does not cover

This section matters as much as the tables, and it is the section a benchmark page usually does
not have.

**There is no in-vivo validation.** Every figure above is agreement with a dataset's
reconstruction, not with a goniometer on a real athlete. Public datasets bound the estimator.
Only a clinical study licenses a clinical threshold.

**Test-retest reliability and minimal detectable change are unmeasured.** So the question a
coach actually asks over a season, "did this athlete change?", has no defensible threshold yet.
Agreement with truth on one occasion says nothing about how much of a week-to-week difference
is real.

**Monocular limb foreshortening is not gated.** A thigh pointing at the camera projects to a
few pixels and the angle of a few pixels is noise. The 3D path gates this by projection ratio.
The monocular path currently rejects only a zero-length limb. Identified, not implemented, and
written down as such in the validation page rather than left to be discovered.

**The camera-count sweep is one subject and one sequence.** Whatever it appears to show about
how many cameras you need needs a second sequence before it should be generalised.

The study that closes most of this is specified and not yet run: 15 to 20 athletes, a guided
protocol per metric, reference goniometry by two raters, reporting mean absolute error, bias,
Bland-Altman limits of agreement and test-retest minimal detectable change, per metric and per
side. Those numbers would then replace the workbook's 10 and 15 degree thresholds for video,
decide whether hip arc and shoulder range of motion ship as metrics or stay screening badges,
and give ankle dorsiflexion its first accuracy figure on loaded sport rather than level gait.

Until that exists, everything in this series is a bound on an estimator, and I try never to
write a sentence that implies otherwise.

---

## 8. What the rest of the series does

The scorecard above is the contract. Each remaining post takes one row of it apart.

- [Part 2, from pixels to joint angles](/posts/2026/02/pixels-to-joint-angles/): how a keypoint
  becomes a clinical angle, and every convention that has to be pinned down first.
- [Part 3, why 2D beat 3D](/posts/2026/03/why-2d-beat-3d/): the tap that halved the error, and
  why the interface outperformed the estimator.
- [Part 4, facing and sign](/posts/2026/04/facing-and-sign/): facing direction is correct 100
  times out of 100 on n = 919, and getting it wrong mirrors every sagittal angle at once.
- [Part 5, the camera grades its own footage](/posts/2026/05/camera-grades-its-own-footage/):
  the row that beat ground truth at predicting error.
- [Part 6, triangulation and cameras](/posts/2026/06/triangulation-and-cameras/): calibration
  sensitivity, how many cameras buy what, and one standard technique I measured and rejected.
- [Part 7, what it refuses to measure](/posts/2026/07/what-it-refuses-to-measure/): the gates,
  the tiers, and why a refusal is not an accuracy gain.
- [Part 8, the clinical agent](/posts/2026/08/kinetix-clinical-agent/): the in-app assistant
  with 60 tools, 29 of them mutating, and how it is kept inside the user's own authority.

Two earlier and lighter posts cover the same ground from further back, if this one moved too
fast: [bowling biomechanics from pose](/posts/2026/05/bowling-biomechanics-pose/) and
[from keypoints to clinical metrics](/posts/2026/06/keypoints-to-clinical-metrics/).

---

## The short version

- A percentage without a tolerance is not a claim. "91% accurate" cannot be checked. "91% of
  readings within 15 degrees" can.
- Against a human annotator on COCO val2017, n = 2000, the shipped detector scores 58, 83 and
  91 out of 100 within 5, 10 and 15 degrees. All three are the same run.
- Against 3D ground truth on ASPset-510, the same code scores 92 within 10 degrees with three
  calibrated cameras and one tap, and 52 with one camera on free sport action.
- Averaging those rows into 69 is a lie by compression: it weights configurations rather than
  readings, double-counts a filtered subset, and moves credit from the setups that work to the
  setups a coach actually uses. The configuration is the measurement.
- Ten degrees is not an arbitrary tolerance. It is the bilateral asymmetry threshold the
  clinical workbook already flags at, so a system whose error is bigger than 10 degrees cannot
  answer the question it was bought to answer.
- Which is why axial rotation, at 41.3 degrees mean error on ASPset, ships as Tier C with a
  gated flag rather than as a metric, even though the same code reads 4.27 on a 360 degree rig,
  on one participant's gait trial.
- What is missing is as important as what is measured: no in-vivo validation, no test-retest
  minimal detectable change, no gate on monocular foreshortening.

*Next: [part 2, from pixels to joint angles](/posts/2026/02/pixels-to-joint-angles/), where the
keypoints turn into degrees and every convention that has to be nailed down first gets nailed
down.*
