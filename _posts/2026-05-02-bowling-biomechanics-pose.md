---
title: "Angles Don't Lie: Measuring a Cricket Bowler's Action With a Webcam 🏏"
date: 2026-05-02
permalink: /posts/2026/05/bowling-biomechanics-pose/
tags:
  - biomechanics
  - computer vision
  - pose estimation
  - MediaPipe
  - sports science
  - cricket
math: true
---

*Elite cricket teams answer two questions with expensive motion-capture labs: is this bowler's
action legal, and is it going to break their back? Here's how far you get with a phone camera and
some trigonometry.*

---

## 1. Two questions, one action 🎯

A fast bowler runs in, plants a foot, whips an arm over, and releases a ball at 140 km/h. That
takes about 120 milliseconds, and inside it two entirely separate problems hide.

**Is it legal?** Cricket's law says you may not *straighten* your elbow by more than **15
degrees** during the delivery swing. Beyond that you're throwing, not bowling, and throwing is
biomechanically far more efficient, which is exactly why it's banned. This is the rule that gets
careers suspended.

**Is it safe?** Fast bowling is one of the most injurious actions in sport. Lumbar stress
fractures are so common in young fast bowlers that they're almost expected. The mechanism is
known: **side-on shoulders with front-on hips**, forcing the lower spine to twist under load,
several hundred times a week.

Both questions reduce to the same measurement problem: **what angles is this body making, and
when?**

Traditionally you answer that in a lab: reflective markers, a dozen synchronised cameras, force
plates, a technician, a six-figure budget. Which means roughly a few hundred bowlers in the world
get measured, and every academy player in Dhaka, Lahore, or Kandy does not.

That gap is worth closing, and pose estimation closes a useful part of it.

---

## 2. Pose estimation in one paragraph 🦴

Feed a frame to a model; get back the pixel coordinates of body landmarks.

**MediaPipe Pose** gives 33 landmarks per frame (eyes, ears, shoulders, elbows, wrists, hips,
knees, ankles, heels, feet) plus a visibility score for each. It runs at 30+ FPS on a laptop
CPU. No markers, no suit, no calibration rig.

```python
import cv2, mediapipe as mp

pose = mp.solutions.pose.Pose(model_complexity=2, min_detection_confidence=0.5)

frame = cv2.imread("delivery.jpg")
res = pose.process(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))

for i, lm in enumerate(res.pose_landmarks.landmark):
    print(f"{i:2d}  x={lm.x:.3f}  y={lm.y:.3f}  z={lm.z:.3f}  vis={lm.visibility:.2f}")
```

For bowling analysis we need twelve of the thirty-three: shoulders, elbows, wrists, hips, knees,
ankles, left and right.

That's the whole input. Everything after this is geometry.

---

## 3. The one piece of maths you need 📐

An angle at a joint is the angle between two bones. Three points: the joint $B$, and the two
endpoints $A$ and $C$.

$$
\theta = \arccos\!\left(\frac{\vec{BA} \cdot \vec{BC}}{\lVert \vec{BA}\rVert \, \lVert \vec{BC}\rVert}\right)
$$

Dot product, two magnitudes, an arccos. That's it.

```python
import numpy as np

def joint_angle(A, B, C):
    """Angle at B, in degrees, between segments BA and BC."""
    BA, BC = np.array(A) - np.array(B), np.array(C) - np.array(B)
    cosine = np.dot(BA, BC) / (np.linalg.norm(BA) * np.linalg.norm(BC))
    return np.degrees(np.arccos(np.clip(cosine, -1.0, 1.0)))
```

The `np.clip` is not decoration. Floating-point error pushes the cosine to 1.0000000002 often
enough, and `arccos` of that is `nan`, and a `nan` propagates silently through your whole report.
I have shipped that bug.

Now every measurement is a naming exercise:

```python
elbow      = joint_angle(shoulder, elbow_pt, wrist)     # 180° = fully straight
front_knee = joint_angle(hip, knee, ankle)              # 180° = locked straight
```

---

## 4. The four angles that matter 📊

| Angle | Safe range | What it means | If it's wrong |
|---|---|---|---|
| **Front knee** | 150°–180° | how much the front leg collapses at landing | a collapsing knee transfers load to the lower back |
| **Elbow extension** | 160°–180° | how straight the arm stays through the swing | > 15° of straightening is an illegal action |
| **Trunk side-bend** | 0°–30° | lateral lean away from the delivery side | excessive lean is *the* lumbar stress-fracture mechanism |
| **Shoulder rotation** | 20°–50° | shoulder alignment relative to hips | shoulder–hip separation twists the spine under load |

Then the checks are boringly simple, and that's a feature:

```python
def assess(name, value, lo, hi):
    if value < lo:  return f"⚠️  {name}: {value:.1f}° too low"
    if value > hi:  return f"⚠️  {name}: {value:.1f}° too high"
    return f"✅ {name}: {value:.1f}° good"
```

```
==================================================
ANALYSIS RESULTS
==================================================
✅ FRONT_KNEE       : 165.3° - Good!
⚠️  ELBOW            : 145.2° - Bent elbow! Potential illegal action.
✅ TRUNK_SIDE_BEND   : 15.7° - Good!
✅ SHOULDER_ROTATION : 35.2° - Good!
--------------------------------------------------
⚠️  OVERALL: Issues detected - see above
==================================================
```

No neural network in the decision layer. Pose estimation for perception, trigonometry for
measurement, thresholds from published sports-science literature for judgement. Each stage
inspectable, each threshold arguable on its merits.

That last property is worth more than accuracy in this domain. When you tell a nineteen-year-old
that their action is putting them at risk, they will ask *why*. "165 degrees of front knee, and
here is the frame" is an answer. "The model gave it 0.83" is not.

---

## 5. The part nobody tells you: which frame? 🎬

Everything above assumes you know *when* to measure. That turns out to be the hard problem.

A delivery is a sequence, and the interesting quantities live at specific instants:

```
   run-up      back-foot    front-foot    ARM         release   follow
               contact      contact       HORIZONTAL            through
   ─────────────●────────────●─────────────●───────────●──────────────►
                             ▲             ▲           ▲
                       measure front   elbow angle   elbow angle
                       knee here       starts here   ends here
```

The 15-degree rule is about the *change* in elbow angle between **upper-arm-horizontal** and
**release**. A single frame cannot tell you that. You need the whole trajectory and you need to
locate two events in it.

Practical detection heuristics:

**Front-foot contact.** The frame where the front ankle's vertical velocity crosses zero and its
$y$ stops decreasing. The foot has landed.

```python
ankle_y = np.array([f["ankle"][1] for f in frames])
v = np.gradient(ankle_y)
ffc = np.where((v[:-1] < 0) & (v[1:] >= 0))[0]      # candidate landings
```

**Arm horizontal.** The frame where the shoulder-to-elbow vector is closest to horizontal.

**Release.** Roughly maximum wrist velocity, since the ball leaves at the top of the whip.

Then take the minimum and maximum elbow angle *between* arm-horizontal and release, and the
difference is your extension:

```python
window = frames[arm_horizontal_idx : release_idx + 1]
angles = [joint_angle(f["shoulder"], f["elbow"], f["wrist"]) for f in window]
extension = max(angles) - min(angles)
legal = extension <= 15.0
```

**And here is where I have to be honest about the limits.** At 30 FPS, a 120-millisecond
delivery swing is **about four frames**. Four samples to characterise the curve whose range
decides someone's career. That is not enough, and no amount of clever code fixes it. The
information isn't in the video.

So:

- **120–240 FPS** for any elbow-legality claim. Phone slow-motion modes are genuinely adequate
  here, which is the good news.
- **30 FPS is fine** for coaching feedback on knee, trunk, and shoulder, which change slowly
  enough.
- **Never make a legality call from 30 FPS.** Report "insufficient frame rate" instead. Refusing
  to answer is a valid output, and building that refusal into the tool is the difference between
  a useful instrument and a liability.

---

## 6. Other honest limitations 🚧

**2-D is 2-D.** A single camera gives you image-plane angles. If the bowler's arm swings partly
toward the camera, foreshortening makes the angle wrong, and nothing in the frame tells you by
how much. MediaPipe's $z$ coordinate is a rough relative-depth estimate, not a metric
measurement.

*Mitigation:* fix the camera position. Perpendicular to the crease, at hip height, marked on the
ground with tape so every session matches. **Consistency matters more than absolute
accuracy**, because the real question a coach asks is "is this better than last month?"

**Occlusion.** At the top of the action the bowling arm passes across the body and the front arm
crosses the trunk. Landmarks get hidden and predictions get noisy. Use the `visibility` score and
drop low-confidence frames rather than smoothing over them:

```python
MIN_VIS = 0.6
usable = [f for f in frames if all(f["vis"][j] > MIN_VIS for j in REQUIRED_JOINTS)]
```

**Landmark jitter.** Frame-to-frame noise of a few pixels becomes several degrees of angle noise
on a short segment. A Savitzky–Golay filter across the trajectory helps a great deal, but filter
the *landmarks*, not the computed angles, or you smooth a nonlinear function of noise and get
subtly wrong peaks.

**Clothing and lighting.** Loose kit, long sleeves, evening floodlights, dusty grounds. Accuracy
in a nets session at 6 p.m. is not accuracy in a well-lit lab, and your validation should reflect
where the tool will actually be used.

---

## 7. Why bother, given all that? 💡

Because the alternative isn't a motion-capture lab. **The alternative is nothing.**

A district-level academy in Bangladesh is not buying a marker-based system. Their fast bowlers
are currently assessed by a coach's eye, and a coach's eye, however good, cannot see 8 degrees
of extra trunk lean, and cannot remember last month's value to the degree.

What a webcam-based system realistically delivers:

- **Longitudinal tracking.** Same setup, every month. Trends are visible even when absolute
  values are imperfect.
- **Triage.** Flag the bowlers whose numbers look concerning, and spend the expensive assessment
  on them.
- **Coaching feedback within minutes,** with the frame attached, while the athlete still
  remembers what they felt.
- **A written record.** A PDF report per session, per player, with player profile and bowler
  category, so the injury conversation two years later has data behind it.

That's the design goal for the tooling I build at AlgolyzerLab: not to replace the lab, but to
give the ninety-nine percent of bowlers who will never see one *something* rather than nothing.

---

## 8. The short version 📝

- Two independent problems in one action: **legality** (15° elbow extension) and **injury risk**
  (trunk side-bend, shoulder–hip separation, front-knee collapse).
- MediaPipe gives 33 landmarks per frame on CPU; you need twelve of them.
- Every joint angle is one `arccos` of a normalised dot product. **Clip the cosine** or you'll
  ship `nan`s.
- Keep the decision layer **simple and inspectable**: literature thresholds, not a black box.
  Athletes ask *why*.
- **Event detection is the hard part.** The elbow rule is about *change* between arm-horizontal
  and release, so you need the trajectory, not a frame.
- **30 FPS gives ~4 frames of delivery swing.** Enough for coaching, not for a legality verdict.
  Build the refusal into the tool.
- Fixed camera placement beats clever maths: consistency over absolute accuracy.

---

*Next: [from 26 keypoints to clinical metrics](/posts/2026/06/keypoints-to-clinical-metrics/),
and what changes when you move from a laptop demo to a system clinicians are willing to put in a
medical record.*
