---
title: "What the System Refuses to Measure"
description: "Three measured refusals in a markerless movement pipeline, the gaps that are still open, and why a clinician should prefer software that says not measured."
date: 2026-07-25
permalink: "/posts/2026/07/what-it-refuses-to-measure/"
tags:
  - "biomechanics"
  - "computer vision"
  - "pose estimation"
  - "validation"
  - "measurement"
  - "clinical software"
  - "agent harness"
series: "Biomechanics from Video"
seriesOrder: 7
math: false
---

*Six parts of this series were about making a movement measurement better. This one is about
the three changes I am proudest of, all of which made the system measure less. Every one of
them looks like a regression on a leaderboard and like the only defensible option in front of
a physiotherapist. The last section is the one I would want a reviewer to read first: the list
of things I still cannot measure at all.*

---

## 1. A fabricated number is not a weak measurement

Here is the situation in plain terms. A coach uploads a wide shot of a fast bowler. The
athlete is about sixty pixels tall in frame. The pose detector still returns a full skeleton,
because that is what pose detectors do: they always return something. Ask the software for
peak knee flexion and it has two options. Guess, or say it does not know.

[Part 1](/posts/2026/01/joint-angle-accuracy/) argued that a score without a tolerance is not a
claim anybody can check. This part is the other half of that argument: a reading without an
observability condition is not a measurement anybody can use.

Guessing looks better on every chart, and it is what an early version of this pipeline did. The
number it produced was 169.9 degrees of peak knee flexion. That figure is not a bad measurement,
it is the anatomical bound itself, roughly the most a knee can be bent. The detector attaches a
confidence to every keypoint, a keypoint being one of the dots it places on hip, knee, ankle and
the rest, and the confidence is its own estimate of whether the dot is really on the joint. On
that footage 59% of the keypoints in the knee chain scored below 0.3, and the tenth percentile
was 0.063, so one dot in ten was barely above zero. The knee-flexion series spanned minus
179 to plus 179 degrees, and the reported peak was simply whichever noise sample landed nearest
the ceiling. All of that is recorded in the comment above
`DEFAULT_ANGLE_CONF_FLOOR` in `pose-service/src/pose_service/pipeline/angles_from_2d.py`, which
is where the fix lives too: a keypoint must reach 0.35 confidence to contribute a clinical
angle, well above the 0.0 to 0.2 band where the SimCC decode returns essentially arbitrary
coordinates, and below RTMPose's typical 0.5 to 0.8 for a cleanly localised joint so a smaller
subject is not silenced outright.

The important part is not the threshold. It is the plumbing that makes a refusal travel without
turning into a zero that somebody later reads as a measurement.

```
How a refusal travels. Nothing downstream reports a number it does
not have, and every refusal is counted rather than hidden. The
confidence and facing gates are monocular; the projection ratio
belongs to the multi-view path.

  per-frame joint angle
        │
        ├─ keypoint confidence below 0.35 ─────┐
        ├─ projection ratio below 0.45 ────────┤
        ├─ facing direction unresolved ────────┤
        │                                      ▼
        │                                  emit 0.0
        │                             ("not measured")
        ▼                                      │
   measured value                              │
        │                                      │
        └──────────────► aggregate ◄───────────┘
                             │
              _drop_zeros(): exact 0.0 removed
                             │
                   ┌─────────┴──────────┐
                   ▼                    ▼
            peak and range over   coverage fraction,
            measured frames only  shown beside it
```

`_drop_zeros` in `pose-service/src/pose_service/pipeline/aggregate.py` carries the comment that
explains why that 0.0 sentinel has to be dropped rather than averaged: treating a missing frame
as "the athlete was exactly at neutral" pulls the minimum down to zero, inflates every range and
biases every peak. The coverage fraction beside each metric is the other half. A peak derived
from 12% of frames is a different claim from one derived from 96%, and the front end renders
both, because `PoseMetricsQuality` in `frontend/src/types/api.ts` carries `coverage` as a
first-class field rather than an afterthought.

The middle branch of that figure is section 2's subject. The third is
[part 4](/posts/2026/04/facing-and-sign/): facing sets the sign of every sagittal angle at once,
so a frame with no resolvable facing reports 0.0 rather than a mirrored measurement, and the
loss shows up as a gap.

What it costs: on a genuinely small subject, a genuinely visible joint sometimes falls below
0.35 and gets dropped. That shows up as coverage loss on footage a human would call usable, and
the floor is overridable per deployment through `ANGLE_CONFIDENCE_FLOOR`. And the floor itself
has no validation of its own. It is an engineering judgement about where a decoder stops
carrying information, argued from the numbers above, not measured against ground truth.

The clearest evidence that the machinery works is a clip with no ground truth at all. Of the
nine sports clips run end-to-end through the deployed stack (validation README, section 8b),
the bench press is the one I show people: the athlete is lying down, the legs are barely
visible, facing is rarely resolvable, and the system reports 14% coverage with knee peaks of 5
and 1 degrees rather than inventing a squat. That is the correct output. Refusing to measure is
what makes the other eight clips worth reading.

---

## 2. Refusal one: flexion when the limb points sideways

Plain version first. Shoulder flexion means how far the arm has swung forwards. To measure it,
the system flattens the arm into the plane that divides the body into left and right (the
sagittal plane) and reads the direction of the flattened arm. If the athlete holds the arm out
sideways, the flattened arm is not an arm any more. It is a stub a few centimetres long in the
reconstruction, and the direction of a stub is whatever error survived triangulation.

Precisely: in `_hip_or_shoulder_angles`
(`pose-service/src/pose_service/pipeline/angles_from_3d.py`) the limb vector is projected onto
the sagittal plane, and flexion is the angle between that projection and the downward body
axis. The quantity that governs whether the answer means anything is the sagittal-projection
ratio, the fraction of the limb's length that survives that projection.

```
Flexion is the DIRECTION of the limb AFTER projection onto the
sagittal plane. Projection shortens the limb. It does not shrink
the detector's error, so the same wobble sweeps a wider arc.

 projection ratio 0.97, arm swinging forwards
   shoulder ●━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━● elbow
                                            ╲ residual noise
   measured shoulder-flexion MAE    4.69°    (93.8% of readings)

 projection ratio 0.13, arm held out to the side
   shoulder ●━━━━● elbow
                  ╲ the same residual noise
   measured shoulder-flexion MAE  122.38°    (0.4% of readings)
```

Measured on ASPset-510 mocap with 4 px of synthetic keypoint noise, so triangulation is the
only error source in the table (validation README, section 4b):

| Sagittal-projection ratio | Share of readings | Shoulder-flexion MAE |
|---|---|---|
| 0.80 and above | 93.8% | 4.69° |
| 0.60 to 0.80 | 3.4% | 16.25° |
| 0.45 to 0.60 | 1.2% | 8.69° |
| 0.30 to 0.45 | 0.5% | 81.17° |
| 0.15 to 0.30 | 0.6% | 28.18° |
| below 0.15 | 0.4% | 122.38° |

![Horizontal bars of shoulder-flexion error by sagittal-projection ratio, from 4.69 degrees when the limb is fully visible to 122.38 degrees when it is almost edge on, with the ten-degree clinical threshold marked](/figures/flexion-observability.svg "How much of the limb the camera can see, against the error that follows. The ratio is computed before any angle is reported, so the refusal sits in front of the measurement rather than in a footnote after it.")

Two things in that table are worth staring at. The error at the bottom is not degraded, it is
meaningless: 122 degrees of mean absolute error on a joint whose full clinical range is about
180 degrees is a random number generator with a units label. And the ladder is not monotonic,
because each bin below 0.45 holds half a percent or less of the readings and their means bounce
around. I am printing it as measured rather than smoothing it, because a tidy monotonic curve
here would be a curve I fitted rather than one I found.

The gate itself is a handful of lines:

```python
# _MIN_FLEX_PERP_RATIO = 0.45 rejects a limb lying within about 27
# degrees of the measuring plane's normal, where the projection is
# too short for its direction to mean anything.
limb_sag = limb - float(np.dot(limb, body_right)) * body_right
flex = _angle_between(limb_sag, -body_up)
if float(np.dot(limb_sag, body_forward)) < 0:
    flex = -flex
ratio = float(np.linalg.norm(limb_sag)) / limb_len
if abs(flex) > 0.0 and ratio < _MIN_FLEX_PERP_RATIO:
    flex = 0.0
```

Refusing below a ratio of 0.45 costs 2.1% of readings and takes the shoulder-flexion MAE from
6.21 degrees to 5.10 degrees. End to end on ASPset-510, the effect is small and real: monocular
19.72 to 19.44, multi-view calibrated 9.01 to 8.94, canonical rig 22.83 to 21.16.

**That is a refusal, not an accuracy gain, and the distinction is the whole point of this
post.** The estimator did not get better at anything. It did not learn a better prior, see more
data, or improve its geometry by a single degree. It stopped emitting flexion angles that the
geometry cannot support, and the MAE movement is the arithmetic consequence of dropping
fabricated readings out of the average. If I reported "MAE improved from 6.21 to 5.10" without
that sentence attached, I would be claiming an improvement in estimation that did not happen.
The honest headline is "2.1% of shoulder-flexion readings were fiction and are now absent".

One design detail keeps the gate from silencing the limb entirely. The same 0.45 floor is
applied to abduction, in the frontal plane, and the two projections are complementary: an arm
straight out to the side has no sagittal signal and a long frontal projection, and an arm
straight forwards has the reverse. Gating both never leaves a limb with nothing to say. What it
does mean is that the axis with the answer changes between frames, so coverage becomes
per-metric rather than per-clip, which is exactly why coverage is reported per metric key.

Where it breaks: 0.45 is a fixed threshold on a continuous quantity, and the 0.45 to 0.60 band
measures 8.69 degrees, better than the 0.60 to 0.80 band's 16.25. I am refusing some readings
that would have been acceptable and keeping some that are worse than the ones I dropped. A
smooth per-reading uncertainty would be better than a cliff. That is a design I have not built,
not a design I have rejected.

---

## 3. Refusal two: axial rotation on one camera, reported as not measured

Axial rotation is the twist of a limb about its own long axis: the internal and external
rotation a physiotherapist reads with the knee or elbow flexed to ninety degrees. It is the
axis that hip Total ARC and shoulder Total ROM are built from, and it is the hardest thing in
this whole system to see.

From one camera it is not hard, it is impossible. The module docstring in `angles_from_2d.py`
lists what the monocular path deliberately does not produce: axial rotations, knee valgus,
ankle inversion and pelvis angles, described there as structurally unobservable or clinically
indefensible from a single view. They stay at 0.0 so the schema is identical across paths and
the aggregate reads them as not measured. This is the difference between a system that says
"unavailable" and one that says "about 40 degrees, probably". The second is easier to build, it
demonstrates better, and it is the version I would refuse to put in front of a clinician.

With multiple cameras the axis becomes observable, but only under a condition. The rotation is
recovered from the distal segment acting as a pointer: with the knee bent, the shank swings
around the femur's long axis, which is precisely the geometry the manual test uses.
`_axial_rotation_deg` therefore requires the perpendicular component of the pointer to reach
`_MIN_ROTATION_PERP_RATIO = 0.30` of the pointer's own length, roughly a 17 degree bend at the
knee or elbow, and returns 0.0 below it. A straight leg carries no information about hip
rotation, so the code reports nothing rather than reporting the noise.

Then there is the number itself, which is where I have to be careful, because the same code with
the same detector produces three very different answers depending only on where the cameras are:

| Rig | Axial-rotation MAE | Source |
|---|---|---|
| ASPset-510, 3 cameras in a shallow arc about 10 m out | 41.3° | validation README, section 4 |
| CMU Panoptic, 21 views in a dome around the subject | 6.9° | validation README, section 5 |
| LBMC, 9 cameras in a 360 degree surround | 4.27° aligned | validation README, 8e |

On the ASPset frames where axial rotation measured 41.3 degrees, sagittal angles on the same
frames measured 8.9. The estimator is not uniformly bad; the transverse plane is simply
unconstrained by three cameras sitting in a shallow arc in front of the athlete. LBMC's rig is
the one that resembles the product's canonical layout, with measured azimuths of
34/78/132/157/196/214/277/322/356 degrees and a largest gap of 62.8 degrees, and on that rig the
same code reads 4.27.

The refusal here is in how those numbers are quoted. Both are reported and neither is quoted
alone. I could quote 4.27 by itself and be technically truthful: one participant, one gait
trial, one rig built for markerless benchmarking. Someone would then film an athlete with three
phones in a line and expect it. So the validation page carries 41.3 as the worst case set by
one dataset's rig, 4.27 as the best case on a rig resembling the product's own, and the
argument that the difference between them is geometry rather than method.

There is a smaller refusal in the same file that I like more than it deserves.
`MAX_PLAUSIBLE_RANGE` in `aggregate.py` caps hip rotation range at 130 degrees and shoulder
rotation range at 240, and a reading above the cap is **rejected, not clipped**. Clipping would
turn a measurement that has demonstrably failed into a plausible-looking number, which is the
one thing worse than reporting nothing. That distinction was learnt the expensive way: cricket
and football clips once reported 43 to 46 degrees of peak ankle dorsiflexion, which no ankle
does, because the anatomical ceiling in the code was plus 70 and matched no source. With the
ceiling at plus 45, those readings are rejected and the same clips re-run at 21 to 31 (cricket)
and 33 to 36 (football), which is where a loaded ankle actually sits. Plantarflexion keeps its
minus 80, because a ballet pointe really does reach it.

---

## 4. Refusal three: an evidence tier that gates the clinical alarm

The previous two refusals drop readings. This one keeps the reading and refuses the
consequence, which took me longer to accept as the right shape.

Every metric carries a tier. `METRIC_TIERS` in `aggregate.py` is a dictionary of eight entries:
knee flexion and ankle dorsiflexion, left and right, are Tier A, the validated sagittal class;
hip ARC and shoulder ROM, left and right, are Tier C, transverse-plane axial rotation. The front
end's type is deliberately narrow, `export type PoseEvidenceTier = "A" | "C"`, with no B,
because there is nothing in the middle that I have evidence for.

A Tier C value is still shown, because a coach looking at a clip should see what the pipeline
computed. What is gated is the asymmetry flag, the thing that says "review this athlete". The
workbook's bilateral thresholds are 10 degrees for hip Total ARC and 15 for shoulder Total ROM,
and those bars were set for goniometry, an instrument with published repeatability. Applying a
goniometer-grade threshold to an axis measured at 41 degrees of error on one rig manufactures
clinical alarms out of measurement noise.

```
Hip Total ARC, left against right. The VALUE is always reported.
The clinical FLAG must clear two independent gates.

  delta L-R = 14°, axis measured on 41% of frames
                      │
          ┌───────────┴───────────┐
          ▼                       ▼
  coverage >= 0.50?       delta > 2.0 x 10°?
      41% -> no               14° -> no
          │                       │
          └───────────┬───────────┘
                      ▼
┌─────────────────────────────────────────────┐
│ flag withheld, and written to               │
│ quality.suppressed_flags with: test, delta, │
│ workbook_threshold, required_threshold,     │
│ coverage, required_coverage, reason         │
└─────────────────────────────────────────────┘
```

`TIER_C_MIN_COVERAGE = 0.5` and `TIER_C_THRESHOLD_FACTOR = 2.0` are the two constants, and both
conditions are required. Coverage matters because axial rotation is only observable while the
knee or elbow is bent, so a clip of an athlete standing still yields a handful of measured
frames whose min-to-max range is noise rather than motion. The doubled threshold is a
deliberately conservative stand-in, to be replaced by study-derived numbers rather than tuned,
and the code comment says so in as many words. Note the exemption: a metric whose value came
from a goniometer baseline rather than from video keeps the original workbook threshold, because
the gate exists to compensate for an uncharacterised camera, not to weaken a flag that was
never camera-derived.

The cost is a false negative, and I want to be blunt about it. A real 14 degree hip ARC
asymmetry on a well-covered clip will not raise a flag, because 14 is below the widened bar of
20. That athlete's asymmetry goes unremarked by the software. I chose that over the alternative,
which is a screen of red flags that a physiotherapist learns within a fortnight to ignore, and
the mitigation is that the suppression is written into the job's quality block with every
number that produced the decision. The flag is withheld, not deleted: an auditable withholding
is a different object from a silent one.

---

## 5. What is not measured, which matters as much as the tables

Everything above is a refusal I built. This section is the refusals I have not built and the
measurements I do not have. It sits in section 9 of the validation README and it is the part I
would put first if I were reviewing this work.

**No in-vivo validation.** Every figure in this series is agreement with a public dataset's own
reconstruction, not with a goniometer on a real athlete in a real clinic. ASPset-510's ground
truth is itself a reconstruction; LBMC's reference is a marker-based multibody model carrying
soft-tissue artefact of its own, worst in exactly the axial rotation I most want to check.
Public numbers bound the estimator. Only a clinical study licenses a clinical threshold, and I
do not have one.

**No test-retest reliability and no minimal detectable change.** This is the gap that annoys me
most, because it means the single most common question a coach asks cannot be answered. "Has
this athlete's hip ARC improved since March?" requires knowing how much the reading moves when
nothing about the athlete has changed. I have accuracy against a reference and no repeatability
figure at all, so there is no defensible threshold for a change. The system can tell you the
reading, and it cannot yet tell you whether a difference in the reading is a difference in the
athlete.

**Monocular limb foreshortening is identified and not implemented.** Section 2's gate lives in
the 3D path, where the projection ratio is directly computable from the reconstructed limb. The
monocular path has the identical failure mode, a thigh pointing at the camera projecting to a
few pixels, and it currently rejects only a limb of literally zero length. The obliquity
estimate from [part 5](/posts/2026/05/camera-grades-its-own-footage/) covers it partially,
because heavy foreshortening and high camera obliquity tend to coincide, but a per-limb gate
against anatomically expected segment length would be tighter. Identified, not implemented, is
the honest label.

**The camera-count sweep is one subject and one sequence.** The finding from
[part 6](/posts/2026/06/triangulation-and-cameras/), that extra cameras buy consistency rather
than accuracy, comes from a single CMU Panoptic sequence. LBMC reproduced the shape of it on a
different rig with a different reference, which raises my confidence and does not make it two
subjects.

The study that closes them is written down, carried over from the original improvement proposal
which is otherwise fully implemented: 15 to 20 athletes; a guided protocol per metric (squat and
gait for knee, hip and ankle sagittal; a seated 90/90 internal-external rotation sweep with a
frontal camera, and multi-view for rotation); reference goniometry by two raters, plus one
marker-based session if accessible. Reported per metric per side: MAE, bias, Bland-Altman limits
of agreement, and test-retest minimal detectable change.

Those numbers then do three specific jobs. They replace the workbook's 10 and 15 degree
asymmetry bars with video-specific ones, so section 4's doubling can stop being a guess. They
decide whether hip ARC and shoulder ROM ship as metrics or stay screening badges. And they give
ankle dorsiflexion its first accuracy figure outside level gait, where the loaded range a
bowling stride reaches is several times the range the current figure was measured over. That
figure is 3.50 degrees, from LBMC gait, one participant, 200 frames (validation README, 8e).

---

## 6. The same argument, one layer up

The pose pipeline refuses to emit a number the geometry cannot support. The agent that sits on
top of the same database refuses to take an action the user has not confirmed, and the two are
the same design instinct pointed at different failure modes.

Kinetix, the in-app assistant, exposes 60 tools, of which 29 are marked `Mutating`
(`backend/internal/service/kinetix_tools.go`). Every mutating call pauses the run and waits for
an explicit confirmation carrying the tool's human-readable `Title` and its arguments with
secret values masked. The waiting is bounded rather than open:
`confirmTimeout = 10 * time.Minute` in `kinetix_agent.go`, so an abandoned confirmation cannot
hold a concurrency slot open forever, and `providerCallTimeout = 90 * time.Second` is applied
per provider call rather than per run, so a long multi-tool turn is not punished for length.
The agent loop runs with the caller's own identity in context, so tenant scoping, athlete
self-scoping and clinical sign-off gating all apply to the agent as they apply to the human:
it can never exceed the authority of the person who asked. A budget gate refuses the run
before any paid call, and a mid-run check halts the turn when accumulated spend reaches the
remaining monthly cap.

The parallel is exact in the part that matters. In both layers the software's most valuable
output is sometimes a refusal, and in both layers the refusal has to be *legible*: a coverage
fraction beside a peak, a suppressed flag with its reason, a confirm dialog naming the record it
is about to change. An agent that silently does the wrong write and a pose pipeline that
silently reports 169.9 degrees are the same bug wearing different clothes. I set out what a
harness is in [part 1 of the harness series](/posts/2025/08/what-is-an-agent-harness/) and the
refusal machinery in [safe-by-default agents](/posts/2025/12/safe-by-default-agents/); the
pattern of putting the gate in the harness rather than in the prompt is the argument of
[an agent is data, not code](/posts/2026/08/an-agent-is-data-not-code/).

Why should a clinician prefer this? Because a system that always returns a number transfers the
entire burden of scepticism onto the reader, and the reader cannot discharge it. Faced with
"peak knee flexion 169.9 degrees", a physio has to know that the athlete was sixty pixels tall,
that the confidence floor was too low, and that 169.9 is suspiciously close to the anatomical
bound. Faced with "not measured, coverage 14%", they know exactly what to do: re-film it, or
measure it by hand. The first system looks more capable and quietly outsources its failures. The
second one is a colleague who says "I could not see that from where I was standing", which is
the most useful thing a colleague ever says.

None of this makes the software a medical device, and it is not one. It supports a clinical
decision and does not make it, which is only a defensible position if the support is honest
about its own limits.

---

## The short version

- A pose detector always returns a skeleton, so the interesting engineering is deciding when to
  discard what it returns. An early version of this pipeline reported 169.9 degrees of peak knee
  flexion, which was the anatomical ceiling rather than a measurement.
- Refusals travel as an exact 0.0 sentinel, which the aggregate drops, so a refusal shows up as
  a coverage fraction instead of a fake neutral reading.
- Flexion is refused below a sagittal-projection ratio of 0.45. Below 0.15 the measured MAE is
  122.38 degrees. Refusing costs 2.1% of readings and moves shoulder-flexion MAE from 6.21 to
  5.10, which is a refusal and not an accuracy gain: the estimator improved at nothing.
- Axial rotation from a single camera is reported as not measured, not estimated. On three
  cameras in a shallow arc it reads 41.3 degrees of error; on a 360 degree rig, 4.27. Both are
  quoted, never one alone, because the difference is rig geometry rather than method.
- Hip ARC and shoulder ROM stay Tier C. The value is shown; the asymmetry flag needs 50% axial
  coverage and double the workbook threshold, and every withheld flag is written into the job's
  quality block with the numbers that suppressed it.
- The gaps matter more than the tables: no in-vivo validation, no test-retest or minimal
  detectable change, monocular foreshortening identified but not gated, and a sweep on one
  subject. Until the 15 to 20 athlete study reports MAE, bias, Bland-Altman limits of agreement
  and MDC per metric per side, none of these figures licenses a clinical threshold.
- A system that says "not measured" hands the reader a decision they can act on. One that always
  returns a number hands them a burden of scepticism they have no way to discharge.

*Part 8 turns to the other half of the product: the clinical agent that sits on this data, its
60 tools, and why 29 of them stop and ask.
[Kinetix, the clinical agent](/posts/2026/08/kinetix-clinical-agent/).*
