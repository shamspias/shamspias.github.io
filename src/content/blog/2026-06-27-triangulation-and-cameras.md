---
title: "Triangulation, and How Many Cameras You Actually Need"
description: "The multi-view path: DLT in enough detail to implement, how many cameras earn their place, and three lessons about evaluating a solver whose truth you cannot see."
date: 2026-06-27
permalink: "/posts/2026/06/triangulation-and-cameras/"
tags:
  - "biomechanics"
  - "computer vision"
  - "pose estimation"
  - "multi-view"
  - "triangulation"
  - "calibration"
  - "validation"
series: "Biomechanics from Video"
seriesOrder: 6
math: true
---

*Adding a second camera removes the depth ambiguity that limits everything in the single-camera
(monocular) path. It also creates three new problems, and two of them are problems of
evaluation rather than of geometry. This post is the multi-view path in the system I build, and
the three lessons that cost me the most to learn.*

---

## 1. What the second camera actually buys

One camera measures a joint angle in the image plane. If the limb has any component pointing
toward the lens, the measured angle is wrong by an amount the image cannot tell you, which is
the argument of [part 3](/posts/2026/03/why-2d-beat-3d/). Two cameras remove the ambiguity:
each casts a ray through the pixel where it thinks the elbow is, and the elbow is where the
rays come closest to meeting.

Here is the size of that gain, measured on ASPset-510 (amateur athletes doing sports actions
outdoors, three calibrated cameras, mocap 3D joints per frame) against that dataset's own 3D
ground truth. Every row runs the same detector (the model that finds body landmarks in each
frame) and the same angle code, so the only thing changing down the table is the geometry
(`validation/README.md`, sections 1 and 4). Calibrated means the system knows where each camera
actually stands; athlete marked means an operator tapped the right person once in each view
before the clip ran. The scorecard these rows come from, and why they must never be averaged
into one number, is [part 1](/posts/2026/01/joint-angle-accuracy/):

| Configuration | Mean angle error | Within 10 degrees |
|---|---|---|
| Monocular, single camera | 19.4 deg | 52 / 100 |
| Multi-view, three cameras, dataset calibration | 8.9 deg | 83 / 100 |
| Multi-view, calibrated, athlete marked | 4.5 deg | 92 / 100 |
| Multi-view, canonical rig, no calibration | 19.1 deg | 58 / 100 |

Calibrated multi-view with the athlete marked reads 4.5 degrees against 15.5 for one camera
given the same tap, roughly 3.5 times better, and 4.3 times better than the 19.4 degrees in the
first row, which is one camera with nobody marked. Read the last row before getting excited:
three cameras whose positions the system only assumes, rather than measures, scored 19.1 degrees
automatically, which is monocular performance for three times the setup effort. Marking the
athlete brings that to 11.7 degrees. Calibration is not a detail of the multi-view path, it is
most of the multi-view path.

What it costs: three synchronised video files instead of one, a decision in every view about
which detected person is the athlete, and a geometry the service either measures or assumes.
Each of those is a way for the result to be confidently wrong rather than merely noisy.

## 2. DLT, in enough detail to implement it

The step from keypoints to angles is [part 2](/posts/2026/02/pixels-to-joint-angles/); this is
the step before it, from pixels in several images to one point in space. An earlier and lighter
pass over the same ground is in
[From 26 Keypoints to Clinical Metrics](/posts/2026/06/keypoints-to-clinical-metrics/).

Each camera has a $3 \times 4$ projection matrix $P = K [R \mid t]$ that maps a world point to
a pixel up to scale:

$$
\lambda \begin{bmatrix} u \\ v \\ 1 \end{bmatrix}
= P \begin{bmatrix} X \\ Y \\ Z \\ 1 \end{bmatrix}
$$

Write $P_1, P_2, P_3$ for the rows of $P$ and $\mathbf{X}$ for the homogeneous world point.
The unknown scale $\lambda$ equals $P_3 \cdot \mathbf{X}$, so substituting it into the first two
components and rearranging kills the scale and leaves two linear equations per view:

$$
u\,(P_3 \cdot \mathbf{X}) - (P_1 \cdot \mathbf{X}) = 0, \qquad
v\,(P_3 \cdot \mathbf{X}) - (P_2 \cdot \mathbf{X}) = 0
$$

One camera gives two equations for three unknowns, which is the ambiguity. Three cameras give
six for three, an overdetermined homogeneous system $A\mathbf{h} = 0$, and the least-squares
solution subject to $\|\mathbf{h}\| = 1$ is the right singular vector of $A$ with the smallest
singular value: the last row of $V^{T}$ from an SVD. Divide by the fourth component and you have
metres. That is the whole direct linear transform, and it is about ten lines
(`pose-service/src/pose_service/pipeline/triangulate.py`, with the numerical guards elided):

```python
def _dlt_once(points_2d, projections, row_weights):
    """One weighted homogeneous DLT solve. Returns homogeneous h, shape (4,)."""
    rows = []
    for (x, y), P, w in zip(points_2d, projections, row_weights, strict=True):
        rows.append(w * (x * P[2, :] - P[0, :]))
        rows.append(w * (y * P[2, :] - P[1, :]))
    A = np.stack(rows, axis=0)
    _, _, vt = np.linalg.svd(A, full_matrices=False)
    return vt[-1, :]
```

Two details that are not optional. Undistort the pixel coordinates before they enter that
function, using each camera's own distortion coefficients, or lens distortion goes straight into
your millimetres. And use the N-view form above rather than the two-view helper in OpenCV,
because the moment you have three cameras you want all three in one solve.

The part that turns a solver into a measurement is what happens next. The solve always returns
something, including when one view's detector put the knee on a spectator. So the point is
reprojected into every contributing view and the worst pixel error decides its fate.

```
  three views, one joint
       │
       ▼
  ┌──────────────────────────────────────────────────────────┐
  │ 1. drop any view whose 2D confidence is below 0.3        │
  └──────────────────────────────────────────────────────────┘
       │
       ├─ fewer than 2 views left ──► conf = 0, joint reported
       │                              as missing, never guessed
       ▼
  ┌──────────────────────────────────────────────────────────┐
  │ 2. two rows per view, stack, SVD, divide by h[3]         │
  └──────────────────────────────────────────────────────────┘
       │
       ▼
  ┌──────────────────────────────────────────────────────────┐
  │ 3. reproject into every contributing view, take the      │
  │    worst pixel error                                     │
  └──────────────────────────────────────────────────────────┘
       │
       ├─ worst ≤ 12 px ──► keep it, report the mean error
       └─ worst > 12 px ──► drop that view, return to step 2
```

The constants, straight from `pose-service/src/pose_service/pipeline/triangulate.py`:

```python
KEYPOINT_CONF_THRESHOLD = 0.3
DEFAULT_REPROJECTION_THRESHOLD_PX = 12.0  # about 1 deg at 3 m on 1080p
MIN_VIEWS_FOR_DLT = 2

# Row weighting for the DLT solve. Both off, because measurement said so
# (section 6). The parameters stay on triangulate_dlt so the ablation
# remains reproducible rather than becoming folklore.
DLT_REWEIGHT_ITERATIONS = 0
DLT_USE_CONFIDENCE_WEIGHTS = False
MIN_ROW_WEIGHT = 1e-3  # a view that cleared the gate keeps a vote
```

Three cameras degrading to two and then to a refusal is the whole design. Note what that does
to the error budget, because it matters for section 4: the gate converts geometric error into
missing data rather than into wrong data.

## 3. How many cameras

CMU Panoptic gives 21 real calibrated views of one sequence, so you can answer this by
subtraction. The sweep draws six random camera subsets at each count with a fixed seed, because
taking views in sort order confounds "how many cameras" with "which cameras", and the
confound is large enough to change the shape of the answer
(`validation/reports/report_panoptic-171204_pose1_sample-camera-count`, 51 samples, stride 2).
MAE is mean absolute error, the average gap in degrees between the measured angle and the
reference, and sagittal is the side-on plane that flexion and extension live in. PA-MPJPE is the
same comparison in millimetres of joint position after the two skeletons have been aligned, and
the range column is simply the best and the worst random subset at that count:

| Cameras | Sagittal MAE | Range across subsets | Axial MAE | PA-MPJPE |
|---|---|---|---|---|
| 2 | 6.31 ± 4.28 deg | 3.55 to 15.76 deg | 14.92 ± 14.49 deg | 28.2 mm |
| 3 | 6.79 ± 3.20 deg | 3.50 to 12.53 deg | 10.03 ± 4.60 deg | 28.0 mm |
| 4 | 5.06 ± 2.02 deg | 3.39 to 9.46 deg | 8.19 ± 2.26 deg | 28.3 mm |
| 5 | 5.11 ± 0.49 deg | 4.19 to 5.75 deg | 10.61 ± 3.03 deg | 26.2 mm |
| 6 | 4.52 ± 1.46 deg | 2.72 to 7.48 deg | 8.76 ± 2.19 deg | 23.4 mm |
| 7 | 5.09 ± 0.86 deg | 3.88 to 6.04 deg | 8.70 ± 1.07 deg | 22.5 mm |
| 8 | 7.67 ± 4.26 deg | 4.23 to 16.77 deg | 9.63 ± 3.02 deg | 34.3 mm |
| 21 | 5.74 deg | single subset | 6.90 deg | 19.2 mm |

The mean barely moves from two cameras to twenty-one. What collapses is the spread: plus or
minus 4.28 degrees at two cameras, plus or minus 0.49 at five. Two cameras can match six if
they happen to be well placed, and the extra cameras are what remove the "if". Position error
in millimetres does improve steadily, 28 mm to 19 mm, and every subset kept 100% of frames, so
none of this is a survival artefact.

Within this dataset neither the count nor the angular spread (the widest angle between any two
cameras' optical axes in a subset, so a proxy for how much the rig surrounds the athlete)
predicts accuracy at all: Pearson r of -0.08 for count against PA-MPJPE and +0.18 for angular
spread, over 43 subsets. Every Panoptic camera is well placed around a well-lit centre, so
detector error dominates and it is common to all subsets. That is a statement about the studio,
not about camera counts in general.

The same shape appears on a completely different rig. LBMC Lyon has nine cameras in a genuine
360 degree surround with reference angles from marker-based mocap, and ten random subsets per
count. Aligned MAE, gait, participant_02, n = 200 frames
(`validation/reports/report_lbmc-gait-participant_02-clinical-angles`):

| Cameras | Knee | Ankle | Hip flexion | Elbow | Shoulder rotation |
|---|---|---|---|---|---|
| 3 | 2.80 deg | 4.41 deg | 3.11 deg | 3.13 deg | 7.27 deg |
| 4 | 2.40 deg | 3.52 deg | 3.01 deg | 2.16 deg | 5.07 deg |
| 5 | 2.33 deg | 3.36 deg | 3.03 deg | 1.71 deg | 7.16 deg |
| 6 | 2.29 deg | 3.45 deg | 2.95 deg | 1.66 deg | 6.72 deg |

Aligned matters in that caption. The alignment removes a constant offset between the two
biomechanical models' joint definitions, and where the two waveforms correlate strongly negative
it removes the sign as well: LBMC calls knee extension positive where this system calls flexion
positive, so on all nine cameras knee flexion correlates at r = -0.989 and its raw MAE of 41.69
degrees becomes 2.52 aligned. The flip is reported and never silently applied, because a harness
that quietly flipped a sign would look identical to one hiding a real sign bug. Read every
number in that table as the waveform's agreement after a fixed offset has been taken out, not as
an absolute reading.

The gain lands between three and four cameras and then flattens, on a second dataset with a
different rig and an independent reference. The between-subset spread narrows in the same way
it did on Panoptic: knee flexion has a standard deviation across subsets of 0.99 degrees at
three cameras and 0.41 at six.

So the practical answer for a coach is three cameras for sagittal work and four if anything
transverse-plane matters, with the fourth bought for consistency rather than for a better mean.
The honest caveat is that the Panoptic sweep is one subject and one sequence, and the LBMC sweep
is one participant, one trial and one task, so this is a shape reproduced twice rather than a
law.

## 4. How accurately must the cameras be placed

Asking a coach to calibrate a checkerboard rig on the side of a pitch is not realistic, so the
service offers a second path: the operator says which of six canonical slots each phone
occupies, and the geometry is constructed from the label
(`pose-service/src/pose_service/pipeline/calibration.py`).

```python
PLACEMENTS = {          # metres, world origin at the athlete
    "front":    (0.0, +3.0, 1.5),   # where the athlete faces
    "back":     (0.0, -3.0, 1.5),
    "left":     (-3.0, 0.0, 1.5),
    "right":    (+3.0, 0.0, 1.5),
    "up_left":  (-2.5, +2.5, 3.5),  # elevated three-quarter view
    "up_right": (+2.5, +2.5, 3.5),
}
# look_at is the origin for all six and world +Z is up, so the slot
# label alone determines the rotation matrix.

def synth_intrinsics(width, height):
    # Horizontal field of view fixed at 60 deg. An iPhone main lens is
    # 52 to 65 deg; a GoPro in linear mode is about 73 and warped.
    fx = fy = width / (2 * math.tan(math.radians(30.0)))
    ...
```

The question that decides whether this path is usable is how much placement error it tolerates.
The rig-sensitivity harness answers it with noise-free projections, so every degree of error is
attributable to calibration alone, and it displaces the calibration used for triangulation
rather than the one that produced the pixels, which is precisely the production failure mode
(`validation/reports/report_aspset510-test-rig-sensitivity`, ASPset-510 test split, 489 samples,
20 clips, three repeats):

| Placement error | MAE | Frames kept | MAE refined | Frames kept |
|---|---|---|---|---|
| none | 0.00 deg | 100% | 0.00 deg | 100% |
| 5 cm and 2 deg | 0.78 deg | 30% | 0.00 deg | 100% |
| 10 cm and 5 deg | 2.11 deg | 14% | 0.85 deg | 100% |
| 20 cm and 10 deg | 5.37 deg | 6% | 1.05 deg | 100% |
| 40 cm and 15 deg | 6.46 deg | 3% | 0.05 deg | 100% |

![Two lines against the same set of calibration errors: joint-angle error rising from 0 to 6.46 degrees while the share of frames surviving the quality gate falls from 100 per cent to 3 per cent](/figures/calibration-sensitivity.svg "The two lines have to be read together. At 40 cm of placement error the mean error looks survivable at 6.46 degrees only because the gate has already thrown away 97 per cent of the frames.")

The refined column is not monotonic, 0.85 then 1.05 then 0.05 at the largest displacement, and
on three repeats of a random draw at each magnitude I would not read an ordering into it. What
it says is that after refinement every row lands inside about a degree.

### Lesson one: read frame survival beside the MAE

The unrefined column looks survivable. A 40 cm placement error costing 6.46 degrees would be
disappointing but liveable, and if you read only that column you would conclude that this path
degrades gracefully. It does not. At 40 cm it kept 3% of frames.

This is the reprojection gate from section 2 doing exactly what it was built to do. Calibration
error makes the rays fail to meet, the worst view exceeds 12 pixels, views get dropped, joints
get abandoned. The result is missing data rather than wrong data, which is the failure behaviour
you want. But it makes the MAE column biased in a specific direction: at large displacement the
surviving frames are the ones the error happened not to spoil, so the average is computed over
the easy remainder. A low MAE at low survival is not accuracy. It is a small, flattering sample.

I now refuse to read an MAE from this project without the denominator next to it, and every
benchmark harness prints the two together for that reason.

The refined columns are the same sweep with bundle adjustment applied, starting from the
displaced rig. The athlete's own detected keypoints are the calibration pattern: with
synchronised multi-view 2D already in hand, refining six parameters per camera (a Rodrigues
rotation vector and a translation) against reprojection error is a small nonlinear
least-squares problem with no checkerboard and no user action. The 3D points are not carried as
parameters; they are re-triangulated in closed form each iteration, which keeps the parameter
vector at six times the camera count. Soft priors pull each camera toward its declared slot,
which pins the similarity gauge and keeps the metric scale the canonical rig provides.
Intrinsics stay fixed, because with three to six cameras and one centred subject a free focal
length trades off against depth and can absorb rig error into a wrong-but-consistent solution.

Read the survival column of that half of the table and it becomes clear that refinement is not
an optimisation. Without it, a 5 cm placement error already costs 70% of frames, and 5 cm is
better than anyone places a tripod by eye. On ASPset the canonical rig without calibration
scores 19.1 degrees automatically and 11.7 with the athlete marked, against 19.2 and 15.5 for
one camera on the same comparison (`validation/README.md`, section 4), so refinement is what
moved "use three cameras without calibrating" from advice that made results worse to advice
that makes them better.

One more sensitivity worth knowing, since the service synthesises intrinsics on every
uncalibrated job from an assumed 60 degree field of view, and real phone cameras run roughly 50
to 70 degrees: a 20% focal error costs 0.87 degrees of joint angle when the assumed focal length
is too long and 1.69 degrees when it is too short, on the same noise-free protocol. That is what
justifies synthesising intrinsics at all.

## 5. Lesson two: reprojection error is an objective, not a validation

Reprojection error is the quantity the refinement minimises. It is also, tempting as it is, the
only quality number available without ground truth, which is why it ends up in dashboards. Those
two facts are in direct conflict, and I have now been caught by that conflict twice.

Consider what "the geometry that best explains the pixels" leaves free.

```
  Configuration A                    Configuration B
  cameras where declared             cameras 2.5x further out
  athlete 1.8 m tall                 athlete 4.5 m tall

    o           o                  o                   o

         ┌─┐                                ┌─┐
         │ │ 1.8 m                          │ │ 4.5 m
         └─┘                                └─┘

    o           o                  o                   o

  pixels rendered .............. identical
  reprojection error ........... identical
  joint angles ................. identical, they are scale-invariant
  millimetres .................. B is wrong by a factor of 2.5
```

Overall rig size is a gauge freedom in this solver, because the 3D points are re-triangulated
from the cameras on each iteration, so a rig 2.5 times larger around a subject 2.5 times larger
renders pixel-identical images. That is why the priors that pin the gauge cannot be removed: a
scale-free prior was implemented on the reasoning that real rigs are not 3 m and were being
penalised for being right, and it was reverted when a synthetic rig that started already correct
drifted 2.2 m under it.

The useful corollary is that a correct rig of the wrong size does not move far, so large camera
displacement already means the layout disagrees. Displacement is therefore the trust signal, not
reprojection error. In the pose service, a refined camera that has moved more than half the
canonical rig radius marks the whole job untrustworthy:

```python
# How far a refined camera may move from the canonical placement the
# operator declared before the refined rig stops being trustworthy.
# Measured on ASPset-510: refinements that moved cameras 1.5 to 2 m
# reprojected at 3.4 px while joint angles were still about 23 deg from
# ground truth, and PA-MPJPE grew even as reprojection shrank. The rig
# fits the observations; it just is not the right rig.
RIG_SHIFT_TRUST_LIMIT_M = 1.5

rig_quality = {
    "trustworthy": trustworthy,
    "max_camera_shift_m": round(max_shift, 3),
    "rig_scale": round(refined.rig_scale, 3),
    "estimated_radius_m": round(refined.rig_scale * 3.0, 2),
    "shape_off_fraction": round(shape_off, 3),
    "mean_reproj_before_px": round(refined.mean_reproj_before, 2),
    "mean_reproj_after_px": round(refined.mean_reproj_after, 2),
}
```

Four multi-camera sets were then run end to end as single 3D video entries: three ASPset sprints
and one Panoptic dome. Reprojection error fell by 89% to 99.9% in every case, 2410 pixels to
1.4 pixels on one of them, and the refined layout still sat 53%, 70%, 111% and 282% of the rig
radius away from the slots that had been declared. All four are flagged not trustworthy, and the
knee-flexion numbers they produced are reported as behaviour checks rather than as accuracy. One
of them reads 165.7 and 168.3 degrees of peak knee flexion, close enough to the anatomical
ceiling to be exactly the kind of reading a bad rig produces.

A 1.4 pixel reprojection error next to a wrong answer is the most persuasive bad number in this
whole project. Anything tuned against reprojection has to be checked against 3D truth before it
is believed. The monocular path has the same shape of problem and the same shape of answer: a
quality signal computed from the same detections it is judging, reported and never enforced,
which is [part 5](/posts/2026/05/camera-grades-its-own-footage/).

## 6. Lesson three: the change I rejected

Weighting each view's DLT rows by that view's keypoint confidence is standard practice, and the
argument for it is clean: a view the detector was unsure about should pull the solution less.
The implementation is one line, visible in `_dlt_once` above as `row_weights`. Depth reweighting
is the other textbook refinement, converting the DLT's algebraic objective into the geometric
one by dividing each row pair by the current estimate's projective depth.

Both were implemented and both are shipped disabled. Scored on ASPset-510 with real detections,
the dataset's true calibration and three cameras, paired so that a frame counts only if all four
variants solved it (`validation/README.md`, section 4b):

| Variant | Sagittal MAE | PA-MPJPE | Mean reprojection |
|---|---|---|---|
| Plain DLT, shipped | 8.73 deg | 40.5 mm | 3.21 px |
| Confidence only | 8.72 deg | 49.8 mm | 2.97 px |
| Depth reweighting only | 8.70 deg | 40.8 mm | 3.18 px |
| Confidence and depth | 9.63 deg | 60.3 mm | 2.97 px |

![Two lines moving in opposite directions across four triangulation variants: reprojection error falling from 3.21 to 2.97 pixels while reconstruction error rises from 40.5 to 60.3 millimetres](/figures/dlt-weighting-ablation.svg "Confidence weighting improves the residual the solver can see and moves the reconstruction further from the truth. The pixels are what the optimiser is scoring. The millimetres are where the athlete is.")

Confidence weighting made the reconstruction 23% worse in millimetres while making its own
reprojection error look better. The reason is a property of the confidence number rather than of
the weighting scheme: RTMPose's confidence reports how peaked the heatmap was, not how close
the peak is to the joint. A keypoint that is confidently in the wrong place gets more say, and
the solver obediently moves the 3D point toward the pixel it is most sure of. The published
version of this trick (Iskakov and colleagues, ICCV 2019) uses a *learned* confidence, which is
a different quantity, and that is probably the whole difference.

Now look at the two error columns together, because this is the part I would have missed.

The angle column separates the first three variants by 0.03 degrees, which any reasonable
person would call a tie. The millimetre column separates them by 9.3 mm, which is 23% of the
plain solver's own error. Joint angles are invariant to scale and to translation, so a
distortion that moves the whole skeleton coherently, further away and slightly stretched,
largely cancels in the angles while showing up in full in the positions. An evaluation that
reports angles alone can watch a solver get much worse in space and see nothing. Angles are
what the product ships, and they are not sufficient to evaluate the thing that produces them.

The two flags stay in the signature so the ablation stays reproducible, with a comment recording
the table. Turning either on requires beating it on the same protocol.

## 7. Why axial rotation reads 41.3 degrees here and 4.3 degrees there

Shoulder axial rotation, measured with the same code and the same detector on three datasets:
41.3 degrees mean error on ASPset-510, 6.9 on CMU Panoptic with all 21 views and 8.2 to 10.6
degrees at four to eight views, and 4.27 aligned on LBMC's 360 degree rig against a
marker-based reference, on the 115 of that trial's 200 frames where the channel is defined. That
is not a range, it is nearly an order of magnitude, and no estimator changed between those runs.

The difference is rig geometry.

```
  Plan view. Dot counts are indicative, not literal.

  ASPset-510: three cameras, shallow arc, roughly 10 m out
                                            sagittal MAE   8.9 deg
        o  o  o                             axial MAE     41.3 deg
          \ | /
            A         the transverse plane is barely constrained:
                      every camera sees the athlete's rotation as
                      almost the same small change in the image

  CMU Panoptic: 21 cameras in a 5 m dome
        o   o   o                           sagittal MAE   5.7 deg
      o           o                         axial MAE      6.9 deg
      o     A     o
      o           o
        o   o   o

  LBMC Lyon: nine cameras, true 360, largest gap 62.8 deg
        o   o                               knee MAE       2.5 deg
      o       o                             axial MAE      4.3 deg
      o   A   o
      o       o
        o   o
```

Rotation about the long axis of a limb moves surface landmarks very little, and what movement
there is projects almost identically into three cameras clustered in one arc. Surround the
subject and some camera sees the rotation side-on. ASPset's 41.3 degrees is a worst case set by
one dataset's rig, not an intrinsic limit of triangulation, and the argument that it was a rig
artefact was made before the LBMC measurement existed and then held when the measurement
arrived, which is the only kind of confirmation worth having.

The product's canonical rig surrounds the athlete, front, back, left, right and two elevated
three-quarter positions, so it resembles Panoptic and LBMC far more than ASPset. That is a
reason to expect the better number and not a licence to quote it. Both are reported, neither is
quoted alone, hip axial rotation and shoulder range of motion stay screening-only metrics, and
their asymmetry flags stay gated. The general form of that decision is
[part 7](/posts/2026/07/what-it-refuses-to-measure/).

## 8. What none of this settles

Every figure above is agreement with a public dataset's own reconstruction, not with a
goniometer on a real athlete. Panoptic's 3D is itself reconstructed from its own camera array
rather than measured by markers, and LBMC's reference is a model-based estimate over surface
markers, carrying soft-tissue artefact of its own that is worst in exactly the axial channel
section 7 is about.

Worse for the calibration-free path specifically: no public dataset pairs a rig like the
canonical six-slot layout with the thing that makes that path calibration-free, which is that
nobody measured the cameras. LBMC's nine-camera surround is the closest geometry available and
it arrives fully calibrated, so it tests the layout and not the guess. The best available bound
therefore comes from mapping ASPset's shallow arc onto canonical slot names, which is a mismatch
the trust flag would itself reject.

Test-retest reliability and minimum detectable change are unmeasured, so "did this athlete
improve?" still has no defensible threshold. The outstanding study is 15 to 20 athletes, a
guided protocol per metric, reference goniometry by two raters, reporting MAE, bias,
Bland-Altman limits of agreement and test-retest MDC per metric per side. Until that exists,
this is a system that supports clinical decisions and does not make them, and it is not a
medical device.

## The short version

- Two cameras remove the depth ambiguity: 19.4 degrees monocular against 8.9 calibrated
  multi-view and 4.5 with the athlete marked, same detector, same angle code, ASPset-510.
- DLT is ten lines: two linear rows per view, stack, SVD, take the last right singular vector,
  divide by the fourth component. The engineering is the reprojection gate around it, which
  drops the worst view at 12 pixels and abandons the joint below two views.
- Extra cameras buy consistency rather than accuracy. On Panoptic the mean is flat from two to
  twenty-one views while the spread across random subsets collapses from plus or minus 4.28
  degrees to plus or minus 0.49. The gain lands between three and four cameras on both datasets.
- Read frame survival beside every MAE. A 5 cm placement error costs 70% of frames, so rig
  refinement is a requirement and not an optimisation, and a low MAE on 3% of frames is a
  flattering sample rather than an accuracy.
- Reprojection error is the objective, so it cannot be the validation. A refined rig can reach
  1.4 pixels while its layout sits 282% of the rig radius away from the truth.
- Confidence-weighted DLT is standard practice and it made the reconstruction 23% worse in
  millimetres while improving its own reprojection error, because a sharp heatmap peak is not a
  correct one.
- Joint angles are scale- and translation-invariant, so they partly cancel a coherent
  distortion. Angles alone separated those solvers by 0.03 degrees while millimetres separated
  them by 9 mm.
- When the same code scores 41.3 degrees on one dataset and 4.3 on another, suspect the rig
  before the estimator.

*Part 7 is about the other half of the work: the readings this system refuses to emit, what
each refusal costs in coverage, and why a refusal is not an accuracy gain.*
