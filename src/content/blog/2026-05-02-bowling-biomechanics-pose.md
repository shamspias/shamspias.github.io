---
title: "Angles Don't Lie: Measuring a Cricket Bowler's Action With a Webcam"
seoTitle: "Measuring a Cricket Bowler’s Action With a Webcam"
description: "Joint angles from pose estimation, event detection inside a 100-millisecond delivery swing, and the frame rate that decides what you are allowed to claim."
date: 2026-05-02
permalink: "/posts/2026/05/bowling-biomechanics-pose/"
tags:
  - "biomechanics"
  - "computer vision"
  - "pose estimation"
  - "MediaPipe"
  - "sports science"
  - "cricket"
series: "Vision in the Real World"
seriesOrder: 1
math: true
---

*Elite teams answer two questions about a fast bowler in a motion-capture lab that costs more
than the academy that produced him. This is how far you get with a phone on a tripod and some
trigonometry, and exactly where you have to stop.*

---

## 1. Two questions inside one action

A fast bowler runs in, plants a front foot, whips an arm over, and releases a ball at 140 km/h.
The part that matters, from the moment the upper arm swings through horizontal to the moment the
ball leaves the hand, lasts on the order of 100 milliseconds. Two entirely separate problems
hide inside it.

**Is it legal?** Cricket's law says you may not *straighten* your elbow by more than **15
degrees** during the delivery swing, measured between the instant the upper arm reaches
horizontal and the instant of release. Past that you are throwing rather than bowling, and
throwing is biomechanically more efficient, which is exactly why it is banned. A single 15
degree limit for every bowler has applied since 2005, replacing an older set of tighter limits
that varied by bowler type. This is the rule that suspends careers.

**Is it safe?** Fast bowling is one of the most injurious actions in sport. Lumbar stress
fractures in teenage quicks are so common that academies treat them as a season cost rather than
an accident. The mechanism is well described: shoulders that rotate one way while the hips stay
square (coaches call that a mixed action), plus a hard sideways lean of the trunk at release,
plus a front leg that collapses instead of bracing. Repeat several hundred times a week and
the lower spine loses.

Both questions reduce to the same measurement problem: **what angles is this body making, and at
which instant?**

Traditionally you answer that in a lab. Reflective markers, a dozen synchronised cameras, force
plates, a technician, a six-figure budget. Which means a few hundred bowlers in the world get
measured properly, and every academy player in Dhaka, Lahore or Kandy does not. That gap is
worth closing, and pose estimation closes a useful part of it.

Here is the whole system, with the place each stage goes wrong:

```
  stage                    output                    what breaks here
  ──────────────────────────────────────────────────────────────────────
  capture, 240 FPS      →  N frames + timestamps     blur, rolling shutter
  pose model            →  33 (x, y, vis) per frame  occlusion at the top
  scale and filter      →  smooth pixel tracks       flattened peaks
  event detection       →  contact, horiz, release   wrong window
  trigonometry          →  four angle series         aspect-ratio bug
  thresholds            →  flags + frame numbers     arguable defaults
  ──────────────────────────────────────────────────────────────────────
  everything below the pose model is arithmetic you can read and audit
```

Note how little of that is machine learning. One model does perception; the rest is geometry and
bookkeeping. That is deliberate, and section 4 explains why.

---

## 2. Pose estimation in one paragraph

Feed a frame to a model, get back the pixel coordinates of body landmarks. That is the entire
contract.

**MediaPipe Pose Landmarker** returns 33 landmarks per person per frame (eyes, ears, shoulders,
elbows, wrists, hips, knees, ankles, heels, toes) with a visibility score on each, and runs
comfortably faster than real time on a laptop CPU. No markers, no suit, no calibration rig.

One update since this pipeline was first built: the old `mp.solutions.pose` API is gone. Google
deprecated the legacy "solutions" wrappers and everything now goes through MediaPipe Tasks,
where you download a `.task` model file and pick a running mode. The landmarks are the same 33;
the plumbing is different, and code copied from a pre-2024 tutorial will not import.

```python
import cv2
import mediapipe as mp
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision

options = vision.PoseLandmarkerOptions(
    base_options=mp_python.BaseOptions(
        model_asset_path="pose_landmarker_heavy.task"
    ),
    # VIDEO mode keeps a tracker alive between frames, which is what makes
    # per-landmark trajectories stable enough to differentiate later.
    running_mode=vision.RunningMode.VIDEO,
    min_pose_detection_confidence=0.5,
)

cap = cv2.VideoCapture("delivery.mp4")
fps = cap.get(cv2.CAP_PROP_FPS)   # slow-motion exports are often time-stretched
frames, i = [], 0

with vision.PoseLandmarker.create_from_options(options) as landmarker:
    while True:
        ok, bgr = cap.read()
        if not ok:
            break
        image = mp.Image(
            image_format=mp.ImageFormat.SRGB,
            data=cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB),
        )
        # Timestamps must strictly increase or detect_for_video raises.
        result = landmarker.detect_for_video(image, int(i * 1000 / fps))
        frames.append(result.pose_landmarks[0] if result.pose_landmarks else None)
        i += 1
```

For bowling we need twelve of the thirty-three: shoulders, elbows, wrists, hips, knees and
ankles, left and right.

MediaPipe is not the most accurate pose model available in 2026. RTMPose, ViTPose and their
descendants beat it on keypoint error, and part two of this series switches to one of them.
MediaPipe wins on a different axis: it runs on the laptop a coach already owns, offline, beside
a ground with no mains power. For a triage tool that is the constraint that decides the project.

The result also carries `pose_world_landmarks`, an estimate in metres relative to the hip
centre. It is tempting, and it is a single-camera guess at depth wearing metric units. I would
not build a claim on it.

---

## 3. The one piece of maths you need

An angle at a joint is the angle between two bones. Three points: the joint $B$, and the two
endpoints $A$ and $C$.

$$
\theta = \arccos\!\left(
  \frac{\vec{BA} \cdot \vec{BC}}
       {\lVert \vec{BA}\rVert \, \lVert \vec{BC}\rVert}
\right)
$$

A dot product, two magnitudes, one arccos.

```python
import numpy as np

def joint_angle(A, B, C):
    """Angle at B, in degrees, between segments BA and BC."""
    BA, BC = np.asarray(A) - np.asarray(B), np.asarray(C) - np.asarray(B)
    cosine = np.dot(BA, BC) / (np.linalg.norm(BA) * np.linalg.norm(BC))
    return np.degrees(np.arccos(np.clip(cosine, -1.0, 1.0)))
```

The `np.clip` is not decoration. Floating-point error pushes that cosine to 1.0000000002 often
enough, `arccos` of it is `nan`, and one `nan` propagates silently through an entire report. I
have shipped that bug and only found it because a coach asked why one column was blank.

There is a second trap that costs more and hides better. MediaPipe returns `x` normalised by
image width and `y` normalised by image height. On a 16:9 frame those are different divisors, so
raw `(x, y)` pairs live in a horizontally squashed space, and an angle computed there is simply
the wrong angle. On 1920x1080 footage the vertical axis is stretched by 1920/1080, so a segment
truly at 45 degrees to the horizontal reads as about 61. Multiply back into pixels before you
touch any trigonometry.

```python
def to_pixels(lm, width, height):
    """Undo MediaPipe's per-axis normalisation; angles need a square space."""
    return np.array([lm.x * width, lm.y * height])
```

After that, every measurement is a naming exercise:

```python
elbow      = joint_angle(shoulder, elbow_pt, wrist)   # 180 deg = fully straight
front_knee = joint_angle(hip, knee, ankle)            # 180 deg = locked out
```

---

## 4. The four numbers that matter

| Measurement | Read at | Working default | Why it matters |
|---|---|---|---|
| Front knee angle | front-foot contact, and the 50 ms after | 150 to 180 deg, and under 20 deg of collapse | a knee that folds passes load up into the lower back |
| Elbow extension | change between arm horizontal and release | 15 deg, the legal limit | above it the action is a throw |
| Lateral trunk flexion | around ball release | flag above roughly 30 deg | the lean most often linked to lumbar stress injury |
| Shoulder counter-rotation | back-foot contact to front-foot contact | flag above roughly 30 deg | the classic marker of a mixed action |

![A bowler at front-foot contact with the four measured angles marked: front knee, elbow extension, trunk lean and shoulder rotation](/figures/bowling-angles.svg "The four angles, and the instant they are measured at. Every one of them is an arccos of a normalised dot product between two limb segments.")

Two honesty notes. The elbow row is a *change*, not a pose: an absolute elbow angle at one
instant tells you nothing about legality, and my first version of this tool got that wrong. The
other three numbers are defaults I chose after reading the fast-bowling literature, not
constants handed down by a governing body: different studies draw the line in different places,
and a fourteen-year-old is not a professional. They mark the point where a human should watch
the video, not a diagnosis.

The decision layer itself stays deliberately dull:

```python
def assess(name, value, lo, hi):
    verdict = "pass" if lo <= value <= hi else "fail"
    return f"{name:<28} {value:6.1f} deg   {verdict}   (range {lo}-{hi})"
```

```
delivery 2026-04-18-nets-07   238 FPS   24 frames in swing window

front_knee_at_contact         166.2 deg   pass   (range 150-180)
knee_collapse_after            12.4 deg   pass   (range 0-20)
elbow_extension                 9.8 deg   pass   (range 0-15)
lateral_trunk_flexion          31.6 deg   fail   (range 0-30)
shoulder_counter_rotation      18.9 deg   pass   (range 0-30)

one flag: see frames 812-819
```

No neural network anywhere in the judgement. Pose estimation for perception, trigonometry for
measurement, published-literature thresholds for the call. Each stage inspectable, each
threshold arguable on its merits, every flag attached to a frame number you can open.

That last property is worth more than a point of accuracy here. When you tell a
nineteen-year-old that their action is putting their back at risk, they ask why. "Thirty-two
degrees of trunk lean, and here is the frame" is an answer. "The model scored it 0.83" is not,
and they will correctly ignore it.

---

## 5. The part nobody tells you: which frame?

Everything above assumes you already know *when* to measure. That turns out to be the hard
problem.

A delivery is a sequence, and the interesting quantities live at specific instants:

```
  run-up    back-foot     front-foot         arm        ball   follow
             contact       contact        horizontal  release  through
  ──────────────●──────────────●──────────────●───────────●─────────────►
                └───────┬──────┘              └─────┬─────┘
                        │                           │
                        counter-rotation            elbow extension
                        (mixed action)              (the legality test)
```

The front knee is read at the middle marker, front-foot contact. The two bracketed windows are
the ones that need a start frame and an end frame, and a single frame cannot give you either.

Practical detection heuristics, all of them cheap:

**Front-foot contact.** The frame where the front ankle stops descending. Image coordinates run
downwards, so a falling foot has *increasing* $y$, and landing is where that velocity crosses
back through zero. Get the sign wrong here and you detect the top of the stride instead.

```python
ankle_y = np.array([f["ankle"][1] for f in frames])   # pixels, y grows downwards
v = np.gradient(ankle_y)
candidates = np.where((v[:-1] > 0) & (v[1:] <= 0))[0]
```

That returns several candidates per delivery, because the run-up bounces. Take the last one
before peak wrist speed and require the ankle to stay within a few pixels for 30 ms afterwards,
which rules out the stride steps.

**Arm horizontal.** The frame where the shoulder-to-elbow vector is closest to horizontal in the
image plane, restricted to the frames after front-foot contact so the run-up arm swing cannot
win.

**Release.** Close to maximum wrist speed, since the ball leaves at the top of the whip. If you
have a ball detector, use it; wrist speed is within a frame or two at 240 FPS and within nothing
useful at 30.

Then take the range of elbow angle *between* those two events:

```python
window = frames[arm_horizontal_idx : release_idx + 1]
angles = [joint_angle(f["shoulder"], f["elbow"], f["wrist"]) for f in window]
extension = max(angles) - min(angles)
```

That subtraction is a maximum minus a minimum, which means it collects noise from both ends:
every degree of jitter inflates it. A clean action with two degrees of landmark noise can read
as four degrees of extension that is not there. It biases towards accusing people, which is the
wrong direction to be wrong in.

---

## 6. Frame rate decides what you may claim

At 30 FPS, a 100 millisecond swing window is three or four frames. Four samples to characterise
a curve whose range decides someone's career.

```
  elbow angle, arm horizontal to release, one delivery

  180 ┤                                       ●●●●●
      │                              ●●●●●●●●●
  170 ┤                     ●●●●●●●●●
      │           ●●●●●●●●●●
  160 ┤●●●●●●●●●●●
      └───────────────────────────────────────────────
       arm horizontal                        release

  240 FPS  ● ● ● ● ● ● ● ● ● ● ● ● ● ● ● ● ● ● ● ● ●  sees both ends
   30 FPS  ●          ●          ●          ●         misses both ends
```

The 30 FPS row is not a noisier version of the same answer. It is a biased one, low, because
four samples are unlikely to land on either extreme of the curve, and averaging more deliveries
does not fix it. The information is not in the video.

So, the rules I hold to:

- **120 to 240 FPS for any elbow claim.** Ordinary phone slow-motion modes clear this easily,
  which is the good news, and has been true of mid-range handsets for years now.
- **30 FPS is fine for coaching feedback** on knee, trunk and shoulder, which change slowly
  enough to survive coarse sampling.
- **Never make a legality call from 30 FPS.** Emit "insufficient frame rate" and stop. Refusing
  to answer is a valid output, and building that refusal into the tool is the whole difference
  between an instrument and a liability.

Two things bite once you switch to slow motion. **Shutter speed is not frame rate:** at 240 FPS
with automatic exposure the camera may hold the shutter open for most of each 4 millisecond
slot, and a wrist moving at 20 m/s travels 8 cm inside one exposure, which is tens of pixels of
smear at any framing that shows the whole action. Lock it near 1/1000 s, which means daylight or
proper floodlights. **Rolling shutter skews fast limbs:** most phone sensors read the frame out
line by line, so the top and bottom of a single frame are not sampled at the same instant, and
the wrist high in the image carries a different timestamp from the hips low in it. Shoot
landscape rather than portrait, so the body spans less of the frame height and that spread of
timestamps stays small.

And a boundary, stated plainly: this measures, it does not adjudicate. Official assessment of a
suspect action happens at accredited testing centres with marker-based systems. If a bowler's
numbers look bad, the output of this tool is a referral, not a verdict.

---

## 7. Other honest limits

**Two dimensions are two dimensions.** One camera gives image-plane angles. If the arm swings
partly towards the lens, foreshortening shrinks the angle and nothing in the frame tells you by
how much.

*Mitigation:* fix the camera. Perpendicular to the crease, at hip height, on a tripod whose
feet are taped to the ground so every session repeats. **Consistency beats absolute accuracy**,
because the question a coach actually asks is "is this better than last month?" and a steady
bias cancels in a difference. True three-dimensional angles need a second calibrated camera,
which is where part two of this series starts. Work like [OpenCap](https://www.opencap.ai/) has
shown that two consumer phones plus musculoskeletal modelling get respectably close to lab
kinematics, so that middle rung of the ladder now exists.

**Occlusion.** At the top of the action the bowling arm crosses the head and the front arm
crosses the trunk. Landmarks get hidden and the model invents plausible ones. Use the visibility
score and drop frames rather than smoothing over them, and refuse the delivery if the drop lands
inside a measurement window:

```python
MIN_VIS = 0.6
usable = [f for f in frames if all(f["vis"][j] > MIN_VIS for j in REQUIRED)]
```

**Jitter.** A few pixels of frame-to-frame noise becomes several degrees on a short segment such
as the forearm. A Savitzky-Golay filter over the trajectory helps a lot, but filter the
*landmarks*, not the computed angles: an angle is a nonlinear function of the coordinates, so
smoothing it afterwards shifts the peaks you are trying to measure. Keep the window short,
around 7 frames at 240 FPS, or you will flatten the extremes and under-report extension.

```python
from scipy.signal import savgol_filter

wrist_xy = savgol_filter(wrist_xy, window_length=7, polyorder=2, axis=0)
```

**Kit, light and ground.** Loose sleeves, evening floodlights, dust, a dark sightscreen behind a
dark shirt. Accuracy in a nets session at six in the evening is not accuracy in a lit lab, and
your validation set should come from where the tool will actually be used, not from YouTube
footage of internationals.

**People, not just data.** Most of the bowlers this is pointed at are minors, and video of a
child's body stored beside their name and an injury-risk score is a duty rather than a dataset.
Written consent from the guardian, footage on the academy's own machine, and a way for the
family to delete it. That is not a legal footnote; it decides whether a coach lets you back in.

---

## 8. Why bother, given all that?

Because the alternative is not a motion-capture lab. The alternative is nothing.

A district academy in Bangladesh is not buying a marker-based system this decade. Its fast
bowlers are assessed by a coach's eye, and a coach's eye, however good, cannot see eight degrees
of extra trunk lean and cannot remember last month's value to the degree.

What a camera and a laptop realistically deliver:

- **Longitudinal tracking.** Same tripod, same tape marks, every month. Trends show up even when
  absolute values are imperfect.
- **Triage.** Flag the three bowlers whose numbers moved the wrong way, and spend the expensive
  assessment on them instead of spreading it thin.
- **Feedback in minutes,** with the frame attached, while the athlete still remembers what that
  delivery felt like.
- **A record.** One report per player per session, so the conversation two years later, after
  the stress fracture, has data behind it rather than recollection.

That is the design goal for the tooling I build at AlgolyzerLab: not to replace the lab, but to
give the bowlers who will never see one something rather than nothing, and to be loud about
which of its numbers they may trust.

---

## 9. The short version

- One action, two independent problems: legality (15 degrees of elbow extension) and injury risk
  (trunk lean, counter-rotation, front-knee collapse).
- MediaPipe gives 33 landmarks per frame on CPU and you need twelve, but use the Tasks API; the
  old `mp.solutions.pose` code no longer runs.
- Every joint angle is one `arccos` of a normalised dot product. Clip the cosine, and convert
  normalised coordinates back to pixels first or your angles are quietly wrong.
- Keep the judgement layer simple and inspectable. Athletes ask why, and thresholds you can
  point at are an answer.
- Event detection is the hard part. The elbow rule is a *change* between arm horizontal and
  release, so you need the trajectory, not a frame.
- 30 FPS gives three or four frames of swing, and a max-minus-min over four samples is biased
  low. Fine for coaching, useless for a verdict. Build the refusal in.
- Lock the shutter as well as the frame rate, filter the landmarks rather than the angles, and
  tape the tripod's feet to the ground.

---

*Next: [from 26 keypoints to clinical metrics](/posts/2026/06/keypoints-to-clinical-metrics/),
and what changes when you move from a laptop demo to a system a clinician will put in a medical
record.*
