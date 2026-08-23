---
title: "Facing, Sign, and the Error That Mirrors Everything"
description: "Which way an athlete faces sets the sign of every sagittal angle at once. A one-bit decision, 100 out of 100 on 919 comparisons, and why sign errors are not small errors."
date: 2026-04-25
permalink: "/posts/2026/04/facing-and-sign/"
tags:
  - "biomechanics"
  - "computer vision"
  - "pose estimation"
  - "RTMPose"
  - "validation"
  - "measurement"
  - "sports science"
series: "Biomechanics from Video"
seriesOrder: 4
math: false
---

*The smallest component in this pipeline is a function that returns one of three integers. It
has the largest blast radius of anything I have written. Every other part of the system can be
a bit wrong and still be useful; this one is either right or it inverts the entire clinical
output. I gave it its own line on the scorecard for that reason, and it took me an
embarrassingly long time to work out why the usual defences do not touch it.*

---

## 1. One bit, eight channels

A coach films a squat from the side. To say anything about the knee, the software has to know
whether the athlete is facing left or right in the picture, because "the shank (the lower leg)
folded backwards" is a statement about a direction, and that direction depends on which way
the athlete is pointing. Get it backwards and the software does not report a slightly wrong
knee. It reports the opposite knee: a knee bending under load reads as a knee bent the wrong
way, flexion reads as hyperextension, and a joint that is doing its job reads as a joint about
to be injured.

Precisely: every sagittal angle (a bend seen from the side, the plane a squat or a stride
lives in) in the monocular path (one camera, no depth) is computed as a signed rotation in a
y-up image frame (y counted upward as on a graph, not downward as image rows normally are),
and the sign is set by a single per-frame integer called `facing`, where +1 means the athlete
faces image-right and -1 means image-left. In
`pose-service/src/pose_service/pipeline/angles_from_2d.py`, the hinge joints multiply by it
directly (zero-length segment guard elided):

```python
def _hinge_flexion(proximal, middle, distal, facing,
                   flex_ccw_when_facing_right) -> float:
    seg_prox = _up(middle) - _up(proximal)
    seg_dist = _up(distal) - _up(middle)
    bend = _signed_angle(seg_prox, seg_dist)
    sense = 1.0 if flex_ccw_when_facing_right else -1.0
    return sense * facing * bend
```

and the ball joints multiply by it after the limb-versus-trunk angle is formed:

```python
    elif facing != 0:
        # Knee/elbow travelling toward the facing direction = flexion (+).
        if hip_raw_l is not None:
            hip_flex_l = facing * hip_raw_l
        if sh_raw_l is not None:
            shoulder_flex_l = facing * sh_raw_l
```

That is eight clinical channels riding on one bit: knee flexion left and right, hip flexion
left and right, elbow flexion left and right, shoulder flexion left and right. Ankle
dorsiflexion escapes, because it is built as the unsigned shank-versus-foot angle minus 90
degrees, which is already signed by anatomy and needs no facing at all. Everything else in the
sagittal set is downstream of the bit.

```
  y up, x right. Knee flexion is the signed rotation from thigh to
  shank, multiplied by facing.

      facing = +1                       facing = -1
      (faces image-right)               (faces image-left)

          o hip                                 o hip
          |                                     |
          o knee                           knee o
         /                                       \
        o ankle                                   o ankle

      bend  = -30  (clockwise)          bend  = +30  (anticlockwise)
      sense = -1   (knee folds back)    sense = -1
      out   = -1 * +1 * -30             out   = -1 * -1 * +30
            = +30  FLEXION                    = +30  FLEXION

  Now read the left-hand pose with facing = -1 by mistake:

      out = -1 * -1 * -30 = -30   HYPEREXTENSION
```

The two panels are mirror images and both produce +30 degrees of flexion, which is what a
correct sign convention looks like. The last line is the failure. Nothing about the pixels
changed, no keypoint moved, and the number came out on the other side of zero.

If you want the ladder that gets from pixels to these angles in the first place, [part
2](/posts/2026/02/pixels-to-joint-angles/) walks it, and [part
3](/posts/2026/03/why-2d-beat-3d/) explains why the monocular path computes angles in the
image plane at all rather than lifting to 3D first.

## 2. How facing is actually decided

The plain version: feet point where a person is going. If the software can see a heel and a
big toe, it looks at whether the toe is to the right or the left of the heel. If it cannot see
feet, it falls back on the nose, which in profile sits forward of the line between the
shoulders. If neither signal is clear enough to call, it refuses to answer.

The code, lightly trimmed:

```python
_FACING_MIN_RATIO = 0.10   # as a fraction of trunk length
HINT_CONF_FLOOR = 0.15     # much lower than the 0.35 angle floor
CONF_FLOOR = HINT_CONF_FLOOR   # back-compat alias, used below

def detect_facing(keypoints_xy, confidence, schema) -> int:
    """+1 facing image-right, -1 facing image-left, 0 unknown."""
    trunk_len = trunk_length(keypoints_xy, confidence)

    dx_sum, n = 0.0, 0
    if schema.has_feet:
        pairs = ((schema.l_heel, schema.l_big_toe),
                 (schema.r_heel, schema.r_big_toe))
        for heel, toe in pairs:
            if confidence[heel] > CONF_FLOOR and confidence[toe] > CONF_FLOOR:
                dx_sum += float(keypoints_xy[toe][0] - keypoints_xy[heel][0])
                n += 1
    if n and abs(dx_sum / n) > _FACING_MIN_RATIO * trunk_len:
        return 1 if dx_sum > 0 else -1

    # Fallback: in profile the nose sits forward of the shoulder line.
    if (confidence[NOSE] > CONF_FLOOR
            and confidence[L_SHOULDER] > CONF_FLOOR
            and confidence[R_SHOULDER] > CONF_FLOOR):
        mid_sh_x = 0.5 * float(keypoints_xy[L_SHOULDER][0]
                               + keypoints_xy[R_SHOULDER][0])
        off = float(keypoints_xy[NOSE][0]) - mid_sh_x
        if abs(off) > _FACING_MIN_RATIO * trunk_len:
            return 1 if off > 0 else -1
    return 0
```

Three design choices in there are worth naming, because each of them is a decision about what
to do when the evidence is thin.

**The threshold is relative, not absolute.** `_FACING_MIN_RATIO` is 0.10 of the trunk length
in pixels, where the trunk is the shoulder-to-hip distance and is computed as the larger of
the two sides (in profile one side is occluded and its noisier landmarks would otherwise
shrink the reference). Ten per cent of a trunk is the same amount of evidence on a 480p phone
clip and a 4K broadcast frame, which is the only way one constant can serve both.

**The confidence floor is lower here than anywhere else.** Clinical angles require keypoint
confidence above 0.35 by default (`DEFAULT_ANGLE_CONF_FLOOR`, overridable per deployment as
`angle_confidence_floor`); facing accepts 0.15 and never reads the setting. That looks
backwards until you notice what each number buys. A guessed keypoint used in an angle produces
a fabricated number a physio will act on. A roughly-placed keypoint used for facing costs a
sign or nothing at all, and demanding clinical confidence would leave perfectly usable clips
with no facing on any frame, which turns a strong output into no output.

**Zero is a legitimate answer, not a failure.** When both feet point at the lens and the nose
sits over the shoulder centre, there genuinely is no sagittal direction to sign anything with,
and the function says so. Downstream, `facing == 0` means the frame's sagittal angles are
emitted as exactly 0.0, the aggregator's zero-drop treats that as "not measured", and the loss
shows up as reduced coverage rather than as a wrong reading. An unknown facing degrades to a
gap. That is the whole design.

The cost is that the frontal view had to be routed around this entirely. A frontal camera
correctly gets `facing == 0` on every frame, so requiring a facing would make the frontal view
measure nothing at all. Frontal outputs are therefore unsigned frontal-plane magnitudes: the
same limb-versus-trunk geometry, routed to `hip_abd` and `shoulder_abd` instead of the flexion
fields, by a `view` parameter the operator sets. The knee and the elbow get nothing from that
routing. A hinge's only 2D reading is a signed bend, so both stay facing-gated and a frontal
clip reports no knee or elbow angle at all. The maths cannot tell the planes apart. Only the
camera placement can.

## 3. The score, and the part of it I do not get to claim

On COCO val2017 the facing decision agrees 100 out of 100 times, on 919 comparable
annotations. That figure and its n come from
`validation/reports/report_coco-val2017-detector-angle-error.md` (`facing_agreement: 1.00`,
`facing_comparable_n: 919`, out of `annotations_evaluated: 2000`), on the shipped pose
checkpoint, `rtmpose-l_body8-halpe26_256x192`. Person detection is out of the loop for this
row: the harness crops from the ground-truth bounding box and calls the pose model directly,
so `rtmdet_m`, the detector the product actually ships in front of it, contributes nothing
here.

Now the caveats, because the number is narrower than it looks and I would rather say so than
let somebody quote it as "facing detection is perfect".

**It measures robustness to detector noise, not correctness of the rule.** The harness in
`pose-service/benchmarks/bench_angles_coco.py` pushes the human annotator's keypoints and the
detector's keypoints through the *same* `frame_angles_from_2d`, then compares the two `facing`
values:

```python
        if gt_ctx.facing != 0 and pred_ctx.facing != 0:
            facing_both_known += 1
            if gt_ctx.facing == pred_ctx.facing:
                facing_agree += 1
```

Because the rule is identical on both sides, a rule that is systematically wrong would score
100 out of 100 just as happily. What the run establishes is that the detector's pixel error,
which costs 7.38 degrees of joint angle on the same images, essentially never moves this
particular decision. That is a real and useful result. It is not the same result as "the
heuristic is anatomically correct".

**919, not 2000.** A comparison only counts where both sides resolved a facing, so the 1081
annotations excluded are the ones where the annotation, the detection, or both returned zero.
Those are frontal poses, seated poses, heavy occlusion and crops with no usable nose. The
score describes the annotations where a sign was issued (COCO is stills, not clips), which is
exactly the population it should describe, but it says nothing about how often a sign gets
issued.

**The measurement never exercised the primary signal.** COCO-17 has no heel or toe landmark,
and the harness truncates both sides to the COCO-17 core deliberately, so that the trunk line
is defined identically on both sides. `schema.has_feet` is therefore false throughout, the
foot branch never runs, and all 919 comparisons were decided by the nose fallback. The shipped
path on Halpe-26 footage tries feet first. So the number I have is for the weaker of the two
signals, which is at least the safe direction to be wrong in, but it is not a validation of
the branch that usually fires.

That is three caveats on a perfect score. [Part 1](/posts/2026/01/joint-angle-accuracy/) makes
the general argument for why a percentage without its tolerance and its population is not a
claim. This is that argument applied to my own best-looking row.

## 4. Additive noise and coherent noise are not the same animal

Here is the wider point, and it is the reason this post exists rather than a footnote.

Engineers instinctively rank errors by magnitude. Seven degrees is small, forty degrees is
large, so fix the forty first. That instinct is wrong often enough to be dangerous, because
magnitude is only half the axis. The other half is whether the error is *additive noise*,
which averaging attenuates, or *coherent*, which averaging preserves perfectly.

The detector's error is the first kind. Against human annotations on COCO val2017 (n=2000) the
per-joint numbers are shoulder flexion 5.11 degrees, hip flexion 6.60, knee flexion 7.31,
elbow flexion 10.49, mean 7.38, and the biases are -0.33, -0.25, -0.78 and -0.28 respectively.
Those four are the joint rows of the scorecard in `validation/README.md`, each one the mean of
the left and right channels the report itself lists separately (shoulder 5.12 and 5.09, for
instance, on n=715 and n=696).
Near-zero bias with a non-trivial MAE is the signature of noise the pipeline can fight: it
scatters around the truth, so the 3-frame median and the 95th-percentile peak in
`aggregate.py` claw some of it back, and `MIN_MEASURED_FRAMES = 8` refuses to call a peak from
fewer than eight surviving frames, which is a gate rather than an attenuator. 58 out of 100
readings land within 5 degrees, 83 within 10, 91 within 15.

A mirrored sign is the second kind. It is not scattered around anything; it is a deterministic
reflection applied to every affected channel on every affected frame simultaneously. Averaging
a mirrored series gives you a beautifully stable mirrored average. Every statistical defence
in the aggregator (the stack I walked through in [keypoints to clinical
metrics](/posts/2026/06/keypoints-to-clinical-metrics/)) is built to reject *outliers*, and a
mirror is not an outlier. It is a coordinate change.

```
  per-frame angle series
             │
             ▼
  ┌──────────────────────┐  noise  : drops guessed keypoints
  │ confidence floor .35 │  mirror : passes, a mirrored joint is
  └──────────────────────┘           confidently localised
             │
             ▼
  ┌──────────────────────┐  noise  : nothing to do
  │ drop exact 0.0       │  mirror : passes
  └──────────────────────┘
             │
             ▼
  ┌──────────────────────┐  noise  : kills lone spikes
  │ 3-frame median       │  mirror : passes once it lasts 2 frames
  └──────────────────────┘
             │
             ▼
  ┌──────────────────────┐  noise  : kills the impossible
  │ anatomical band      │  mirror : catches large angles only
  │ knee_flex -20 .. 170 │           (-90 dies, -15 lives)
  └──────────────────────┘
             │
             ▼
  ┌──────────────────────┐  noise  : trims the long tail
  │ P95 peak, min 8 fr.  │  mirror : passes
  └──────────────────────┘
             │
             ▼
       reported peak
```

The one guard with any purchase on a mirror is the anatomical band, and it only catches the
loud cases. The bands live in `aggregate.ANATOMICAL_BOUNDS`, and reading them against a
mirrored reading is instructive:

| Channel | Anatomical band, degrees | Mirror of a 90 deg reading | Mirror of a 15 deg reading |
|---|---|---|---|
| Knee flexion | -20 to 170 | dropped, out of band | survives as 15 of hyperextension |
| Hip flexion | -60 to 160 | dropped, out of band | survives as 15 of extension |
| Elbow flexion | -15 to 170 | dropped, out of band | survives as 15 of hyperextension |
| Shoulder flexion | -90 to 220 | survives, exactly at the edge | survives as 15 of backswing |
| Ankle dorsiflexion | -80 to 45 | not facing-signed | not facing-signed |

So the mirror is caught precisely where it would have been obvious anyway, and passes cleanly
where it is subtle. A deep squat mirrored to 90 degrees of knee hyperextension gets thrown out
by a bound. Early stance, a shallow countermovement, the top of a lunge: all live in the 10 to
20 degree range, where a mirror lands inside the physiological band and reads as mild
hyperextension. That is the reading a clinician would flag. It is also the reading a mirror
fabricates most easily.

### The size of a sign error, measured

I have one clean measurement of what a pure sign convention mismatch costs, and it comes from
the LBMC comparison in `validation/reports/report_lbmc-gait-participant_02-clinical-angles.md`
(gait, participant_02, 9 cameras, n=200 frames). For right knee flexion against the
marker-based reference:

| Quantity | Value |
|---|---|
| Raw MAE | 41.69 deg |
| MAE after removing a constant offset | 29.02 deg |
| Pearson r | -0.99 |
| MAE after removing offset and sign | 2.52 deg |

Read the first and last rows together. The same two waveforms are either 41.69 degrees apart
or 2.52 degrees apart, and the only difference is a convention. An r of -0.99 is a
near-perfect match running backwards: LBMC defines knee extension positive where this system
defines flexion positive. That is a definitional difference between two biomechanical models,
not a bug, and the harness reports the flip rather than applying it, because a harness that
silently flipped signs would look identical to one hiding a real sign bug.

The same pattern shows on shoulder axial rotation: raw 32.09 degrees, r = -0.68, 4.27 after
alignment, on n=115. Two channels out of seven in that report carry a sign difference, and in
both the raw number is roughly an order of magnitude worse than the aligned one.

This is what a sign error costs when the underlying estimator is essentially correct. It is
not an incremental degradation. It is a different answer.

## 5. The crossover instant

Now the case the mechanism has to survive: an athlete who turns through the camera. A bowler
following through, a footballer changing direction, anyone who starts side-on facing right and
ends side-on facing left. Somewhere in the middle they pass through square-on, and at that
instant the evidence for facing is genuinely, physically zero.

Note what the pixel evidence does through the turn. The toe-minus-heel offset shrinks, passes
through zero, and grows again with the opposite sign. Near the crossing, the offset is smaller
than the keypoint jitter that produced it, so its sign is not a measurement of anything: it is
whichever way the detector's 3 to 5 pixels of per-frame jitter happened to fall. That figure
is the one in the comment on the 1-Euro smoother in `pipeline/model.py`, which is the reason
the smoother exists at all.

```
  Schematic, not measured data. The only real number here is 0.10.

  frame               44    45    46    47    48    49    50    51
  |toe-heel| / trunk  .31   .18   .09   .04   .02   .07   .15   .26
  sign of the offset   +     +     +     +     -     -     -     -
  above 0.10 * trunk  yes   yes    no    no    no    no   yes   yes
  facing              +1    +1     0     0     0     0    -1    -1
  knee_flex_r         real  real  0.0   0.0   0.0   0.0   real  real
                                  \______________________/
                        four frames of "not measured", which is
                        four frames the mirror cannot reach
```

The 0.10 deadband is doing the real work. It is not there to reduce error in the returned
value; it is there to convert a region where the sign is unknowable into an explicit refusal.
Inside the band the function returns 0, the frame emits 0.0 for every facing-signed channel,
the aggregator drops those as not measured, and the clip's `facing_coverage` records the loss:

```python
quality["facing_coverage"] = round(
    sum(1 for c in frame_contexts if c.facing != 0) / n_ctx, 3
)
```

A coach looking at a low coverage number and a thin angle trace sees that the system declined
to measure. A coach looking at a full trace with four mirrored frames in the middle sees a
knee that briefly hyperextended. The first is a gap in the record. The second is a clinical
event that never happened, and this is not a medical device, so the only defensible failure is
the gap.

### Why a per-frame decision needs hysteresis, and what mine actually has

Facing is decided independently on every frame. Nothing in the shipped code carries the
previous frame's answer forward. That is worth being explicit about, because a deadband and
hysteresis are not the same thing and I have the first, not the second.

A deadband is spatial: it refuses to answer when the current frame's evidence is weak.
Hysteresis is temporal: it makes the *threshold for changing state* higher than the threshold
for staying in it, so flipping from +1 to -1 needs more evidence than remaining at +1 does.
The standard forms are a wider exit band than entry band, or requiring k consecutive frames of
disagreement before switching. Either would mean that a single noisy frame in the middle of a
clean side-on run cannot invert eight channels for one frame.

The argument for adding it is that the cost is close to zero. During a genuine turn the frames
near the crossing are already being refused by the deadband, so a switch delayed by k frames
delays it into territory the system was not measuring anyway. The only frames hysteresis
changes are the ones where the offset briefly wobbles across the band without the athlete
turning, and those are exactly the frames where an independent per-frame decision is worst.

What partially covers the gap today is the 3-frame median downstream, which replaces a lone
spike with a neighbour and therefore does absorb a single-frame mirror, once, at the cost of
being blind to two consecutive ones. What definitely does not cover it is the 1-Euro filter on
the keypoint streams. That smooths pixel coordinates before the decision, and a discrete
decision taken after a smoother is still discrete: filtering the input to a sign function does
not soften its output, it just moves the crossing.

So: identified, argued, not implemented, and not measured. It belongs on the same list as
monocular limb foreshortening in [part 7](/posts/2026/07/what-it-refuses-to-measure/), which
is where I keep the things the system knows it cannot do yet.

## 6. What multiple cameras change, and what they do not

With a calibrated rig, facing stops being a heuristic. The 3D path constructs an anatomical
frame directly, taking the athlete's forward direction as the cross product of the body's up
and right axes, and sagittal flexion is then a rotation in a plane defined by the
reconstructed body rather than by a foot vector in one image. No deadband, no fallback, no
coverage loss at the crossing. This is one of the underrated reasons multi-view is worth the
setup cost, alongside the accuracy figures in [part
6](/posts/2026/06/triangulation-and-cameras/): on ASPset-510, in the run where both paths had
the athlete marked, the calibrated three-camera path gives 4.49 degrees against 15.54
monocular, a factor of 3.5 (`report_aspset510-trainval-clinical-angles-subject-marked.md`,
n=658 multi-view and n=1986 monocular). The monocular headline elsewhere in my own validation
notes is 19.4 degrees, which is the automatic-subject-selection figure. Setting 4.5 against
19.4 compares two different configurations and flatters the rig, and I have done it.

What multiple cameras do not fix is convention mismatch. The LBMC comparison above used nine
cameras in a genuine 360 degree surround, the best rig geometry anything in this project has
been measured on, and it still produced a 41.69 degree raw disagreement on knee flexion from
nothing but a sign definition. Rig quality buys you a correct reconstruction. It does not buy
you agreement about which direction counts as positive, and that agreement has to be
established and reported explicitly, every time a number crosses a boundary between two
systems.

That last sentence is the one I would put on a wall. A sign convention is an interface, and
interfaces are where systems lie to each other most confidently.

## The short version

- Facing is one integer per frame, +1, -1 or 0, and it sets the sign of eight clinical
  channels at once: knee, hip, elbow and shoulder flexion, both sides. Ankle dorsiflexion is
  built without it and is immune.
- Getting it wrong does not add error, it mirrors the measurement. Flexion becomes
  hyperextension, and a loading knee reads as a knee at risk.
- It is decided from the heel-to-big-toe vector where feet exist, from the nose against the
  shoulder centre otherwise, with a deadband of 0.10 of trunk length and a hint confidence
  floor of 0.15 rather than the 0.35 the angles themselves require.
- It agrees 100 out of 100 on 919 comparable COCO val2017 annotations, out of 2000 evaluated.
  Three honest caveats: both sides run the same rule so this measures robustness to detector
  noise rather than anatomical correctness; 1081 annotations produced no comparison; and
  COCO-17 has no feet, so every one of the 919 was decided by the weaker nose fallback.
- Error magnitude is half an axis. The detector's 7.38 degrees is additive and near-unbiased,
  so the median and the percentile attenuate it and the eight-frame minimum stops a peak being
  called from an anecdote. A mirror is coherent, and every one of those defences passes it
  through untouched.
- The only guard with purchase on a mirror is the anatomical band, and it catches the loud
  cases only. A 90 degree reading mirrored to -90 falls outside the knee's -20 to 170 band and
  is dropped. A 15 degree reading mirrored to -15 lands inside it and reads as mild
  hyperextension, which is the subtle case and the clinically alarming one.
- Measured cost of a pure sign mismatch, on LBMC gait with 9 cameras: 41.69 degrees raw
  against 2.52 aligned, at r = -0.99. Reported, never silently applied, because a harness that
  quietly flips signs is indistinguishable from one hiding a bug.
- The crossover instant is handled by refusing, not guessing: inside the deadband the frame
  emits 0.0, the aggregator drops it, and `facing_coverage` records the loss. Temporal
  hysteresis on top of that is argued for here and is not implemented.

*Part 5 takes the same idea one level up. If the system can refuse a frame whose sign it
cannot establish, it can also grade its own footage: [the camera that grades its own
footage](/posts/2026/05/camera-grades-its-own-footage/) is about a self-assessed
capture-quality signal that turned out to predict this system's error better than the true
geometry does.*
