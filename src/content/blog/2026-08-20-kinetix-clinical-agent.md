---
title: "Kinetix: An Agent Harness Inside a Clinical System"
description: "Sixty tools, twenty-nine of them mutating, inside a system that holds injury records. The Go that enforces one rule: the agent can only do what this user could already do."
date: 2026-08-20
permalink: "/posts/2026/08/kinetix-clinical-agent/"
tags:
  - "agent harness"
  - "Go"
  - "clinical software"
  - "biomechanics"
  - "validation"
  - "measurement"
series: "Biomechanics from Video"
seriesOrder: 8
math: false
---

*Seven parts about a measurement system that knows when to keep quiet. This last one is about
the software that lets a language model drive it, inside a database that holds real injury
records. The interesting thing about Kinetix is not the sixty things it can do. It is the
shape of the things it structurally cannot.*

---

## 1. One sentence, and everything else is a consequence

Kinetix is the assistant in the corner of every page of Athlete Intelligence. You type "how is
Jane's ankle rehab going", and it looks things up. You type "log yesterday's session for the
under-19 squad", and it asks you to approve the change before making it. In the codebase that
is 60 registered tools, 29 of which mutate something, all of them wired to the same Go
services the REST handlers call: `list_athletes`, `get_pose_metrics`, `get_workload_acwr`,
`create_injury`, `deactivate_athlete`, `rotate_device_key`, `submit_wellness`,
`generate_report`, `open_page`. Nothing about the assistant reaches the database by a route
the application does not already have.

That is the whole design, and it is worth stating as a single rule before any code:

> The agent can only ever do what this user could already do, in this session, with this role.

Everything below is the machinery that makes that rule true rather than aspirational. The
[first post in the harness series](/posts/2025/08/what-is-an-agent-harness/) argued that a
harness is the part of an agent that is not the model; the
[third](/posts/2025/12/safe-by-default-agents/) argued that safety belongs in the harness
because a prompt is a request and not a boundary. This post is what those arguments look like
when the rows in the table are somebody's medical history, and when getting it wrong is not a
bad answer but a wrong entry in a clinical record.

I should say the obvious thing early. Athlete Intelligence is **not a medical device**: the
repository's own README puts it as "supports performance and clinical decision-making; it does
not diagnose or treat. Clinical judgment stays with qualified professionals." An in-app agent
does not get to quietly relax that. If anything it raises the bar, because a chat box is much
better at sounding authoritative than a table of numbers is.

---

## 2. A tool is a struct, and two of its fields are the security model

Here is the type every one of those 60 tools is an instance of, from
`backend/internal/service/kinetix_tools.go`, comments trimmed:

```go
type Tool struct {
	Name        string
	Title       string // human label shown in the confirm dialog
	Description string
	Parameters  map[string]any
	// Permission gates the tool: it is offered, and may run, only if the
	// user's role HasPermission(Permission).
	Permission domain.Permission
	// Mutating tools require explicit user confirmation before they execute.
	Mutating bool
	Handler  ToolHandler
}
```

That shape is the argument of
[verbs, not tables](/posts/2025/10/verbs-not-tables/) made concrete: the agent gets verbs the
application already has, not a query interface onto its rows.

In plain terms: `Permission` decides whether the model is ever told the tool exists, and
`Mutating` decides whether the run stops and asks a human before running it. Those two fields
carry the entire safety argument. `Name`, `Description` and `Parameters` are the model's
interface; `Handler` is the work; `Title` is what a person reads at the moment they decide.

The filtering happens in two steps, and the direction matters. `Available(role)` returns the
tools whose `Permission` the caller's role grants (an empty `Permission` means every Kinetix
user). `AvailableEnabled` then removes any tool a super-admin has switched off in settings.
The comment in the source is explicit about why that ordering is safe: "A disabled tool can
only remove capability, never add it." A settings page that could only ever narrow the set
needs no security review of its own.

The result is snapshotted onto the run at start:

```go
available := s.toolset.AvailableEnabled(run.ctx, run.cu.Role)
run.enabledTools = make(map[string]bool, len(available))
for _, t := range available {
	run.enabledTools[t.Name] = true
}
```

and `runToolCall` refuses anything outside the snapshot. That matters because a model will
occasionally invent a plausible tool name, or repeat one it saw earlier in a long thread. The
snapshot means a fabricated call fails as an unknown tool rather than as an unauthorised
action.

Two honest costs. First, `AvailableEnabled` fails open to the role-only set when the database
read for the disabled list errors, so a transient glitch never silently strips the assistant
of every tool mid-conversation. The consequence is that a tool a super-admin switched off
could briefly come back during a database hiccup. It can never bring back a tool the role does
not grant, because that filter is a pure function of the role, but the disable switch is
convenience rather than a boundary and should be described as such.

Second, `Mutating` is a boolean, so it cannot express blast radius. `submit_wellness`, which
records that an athlete slept badly, and `delete_videos`, which permanently removes a set of
clips and their pose analyses, get exactly the same pause. The design compensates for that not
by grading the pause but by not shipping the dangerous tools at all, which is section 8.

`Title` deserves a sentence of its own because it is the string a busy physio actually reads.
`deactivate_athlete` has `Title: "Delete (deactivate) athlete"`. That parenthesis is doing
clinical work: the user asked to delete somebody, the platform is going to soft-delete them,
and the dialog says both. A `Title` that reads more reassuringly than the handler behaves is a
trap with a nice label on it.

---

## 3. Authority is inherited, never granted

The run does not happen inside the HTTP request. The handler returns a run id immediately and
the loop continues in a goroutine, so a turn that calls six tools and waits on a confirmation
does not hold a request open. That raises the question every background job raises: who is the
job running as?

The answer is one line:

```go
runCtx, cancel := context.WithCancel(auth.WithUser(context.Background(), cu))
```

`cu` is the `auth.CurrentUser` the middleware built from the caller's session: `UserID`,
`OrganizationID`, `Email`, `Role`, `LinkedAthleteID`. The run carries a copy of it and nothing
else. There is no service account, no elevated token, no agent principal in the users table.
Every tool handler pulls the same user back out with `auth.MustFromContext(ctx)` and hits the
same checks the REST route would have hit.

```
 ┌──────────────────────────────────────────────────────────────────┐
 │ HTTP request     session cookie -> CurrentUser{UserID,           │
 │                  OrganizationID, Role, LinkedAthleteID}          │
 └───────────────────────────────┬──────────────────────────────────┘
                                 │ copied, then the request returns
                                 v
 ┌──────────────────────────────────────────────────────────────────┐
 │ the run          ctx := auth.WithUser(context.Background(), cu)  │
 │ (a goroutine)    no request, no elevation, nothing added         │
 └───────────────────────────────┬──────────────────────────────────┘
                                 │ the same ctx, unchanged
                                 v
 ┌──────────────────────────────────────────────────────────────────┐
 │ tool.Handler     AthleteService.List(ctx, params)                │
 │                  RTPService.Update(ctx, input)                   │
 └───────────────────────────────┬──────────────────────────────────┘
                                 │ auth.MustFromContext(ctx)
                                 v
 ┌──────────────────────────────────────────────────────────────────┐
 │ tenant scope     org_id = cu.OrganizationID on every query       │
 │ self scope       cu.IsAthleteSelf(id) or domain.ErrForbidden     │
 │ sign-off gate    HasPermission(cu.Role, PermRTPSignoffDoc)       │
 └──────────────────────────────────────────────────────────────────┘
```

Three scoping rules ride along for free, and they are worth spelling out because they are the
ones a coach would actually worry about.

![Five stacked layers from the HTTP request down to the audit log: CurrentUser, the permission gate over 60 tools, the confirm gate over 29 mutating tools, the real service, and an append-only audit trail](/figures/kinetix-authority.svg "The same chain with the counts on it. Nothing in the picture grants the agent anything. It carries the caller's own authority into the run, and every one of the 29 mutating tools stops for a human before it writes.")

**Tenant scoping.** Every repository call takes `cu.OrganizationID`. One club cannot read
another's athletes through the assistant for the same reason it cannot through the API: the
organisation id is not a parameter the model can supply.

**Athlete self-scoping.** An athlete-role user gets a login too, and the widget appears for
them as well. Their role map holds four permissions, and nothing else:

```go
RoleAthlete: {
	PermAthleteRead:   true,
	PermWellnessWrite: true,
	PermVitalsRead:    true,
	PermDeviceManage:  true,
},
```

So when an athlete asks Kinetix about a teammate's hamstring, there is no injury tool in the
list to call, because `PermInjuryRead` is absent. And when they ask to "list athletes", the
service itself narrows the query:

```go
if cu.Role == domain.RoleAthlete {
	if cu.LinkedAthleteID == nil {
		return nil, 0, domain.ErrForbidden
	}
	id := *cu.LinkedAthleteID
	p.AthleteID = &id
}
```

The comment above that block names the agent explicitly: "so 'list athletes' via the API or
Kinetix never exposes peers' profiles to an athlete". An unlinked athlete account is refused
rather than defaulted to something.

**Clinical sign-off gating.** Return-to-play entries carry three separate signatures, each
with its own permission: `rtp.signoff_physio`, `rtp.signoff_doctor`, `rtp.signoff_coach`. The
service gates each field independently, on create and on update:

```go
if in.DoctorSignoff && !domain.HasPermission(cu.Role, domain.PermRTPSignoffDoc) {
	return nil, fmt.Errorf("%w: doctor sign-off requires doctor authority",
		domain.ErrForbidden)
}
```

A physio's chat window cannot produce a doctor's clearance, because the physio's own account
cannot. That is not a rule in the prompt. It is a comparison against a role map, three
functions below the agent.

This inheritance is also why the widget is offered to everybody. The permission that unlocks
Kinetix is granted to every role in an `init()` function rather than written into each role
map, and the source explains the reasoning: the agent "can never act beyond the user's other
permissions: each tool re-checks the underlying module permission via `HasPermission`, and
athlete-role users remain self-scoped at the service layer. Granting it here, rather than
editing all ten role maps, guarantees any future role gets it too." A capability that adds no
authority is safe to give to everyone, including roles that do not exist yet.

The cost, stated plainly: the run holds a snapshot. If an administrator changes somebody's
role or deactivates them while a run is in flight, that run finishes with the authority it
started with. The iteration cap and the timeouts in the next section bound how long that
window can stay open, and the honest version of the bound is the worst case rather than the
typical one: twelve iterations, each spending up to 90 seconds on the provider and up to ten
minutes waiting on a confirmation the user approves at the last moment, is a little over two
hours. Most turns are seconds. A longer-lived agent would have to re-read the principal per
tool call rather than trust a snapshot at all.

---

## 4. The pause is the enforcement point

Before any mutating tool runs, the loop persists a row, streams a `confirm_required` frame to
the browser over server-sent events (a one-way stream that keeps the timeline live), and
blocks on a channel.

```
 the model asks for update_rtp
             │
             v
 ┌─ registry lookup ───────────────────────────────────────────┐
 │ unknown name            -> error to the model, nothing ran  │
 │ not in run.enabledTools -> error to the model, nothing ran  │
 └────────────────────────────┬────────────────────────────────┘
                              v
 ┌─ persist the row, status = proposed ────────────────────────┐
 │ Args    = redactSensitiveArgs(raw)   secrets masked         │
 │ Summary = tool.Title                 "Update RTP entry"     │
 └────────────────────────────┬────────────────────────────────┘
                              v
 ┌─ confirm_required over SSE, the run blocks here ────────────┐
 │ the user approves    -> confirmed                           │
 │ the user declines    -> rejected, "do not retry it"         │
 │ ten minutes pass     -> skipped, and the run is cancelled   │
 │ the user hits Stop   -> skipped                             │
 └────────────────────────────┬────────────────────────────────┘
                              v  confirmed only
 ┌─ defence in depth ──────────────────────────────────────────┐
 │ HasPermission(cu.Role, tool.Permission) again, or failed    │
 └────────────────────────────┬────────────────────────────────┘
                              v
        tool.Handler(ctx, rawArgs)  ->  executed | failed
```

The Go is unremarkable, which is the point:

```go
var approved bool
timer := time.NewTimer(confirmTimeout)
select {
case approved = <-ch:
	timer.Stop()
case <-timer.C:
	rec.Status = domain.KinetixToolSkipped
	_ = s.repo.UpdateToolCall(run.ctx, rec)
	s.emit(run, KinetixEvent{Type: KEventToolResult, ToolCall: rec})
	run.cancel()
	return jsonStatus("timed_out",
		"The user did not confirm in time. The action did not run.")
case <-run.ctx.Done():
	timer.Stop()
	rec.Status = domain.KinetixToolSkipped
	_ = s.repo.UpdateToolCall(run.ctx, rec)
	return jsonStatus("cancelled",
		"The run was cancelled before this action ran.")
}
```

Four details are worth pulling out.

The confirm channel is registered in a map keyed by the tool-call id and deleted in a `defer`
on every exit path, so a late `Confirm()` cannot resolve against a receiver that is long gone.
And `Confirm` itself checks that the caller's `UserID` and `OrganizationID` match the run's
before it writes to the channel, so a leaked run id from another session is not an approval.

The rejection string is written for the model, not the log: "The user declined this action. Do
not retry it; ask how they would like to proceed." That is a prompt-level nudge, and prompts
are not boundaries, so the boundary is elsewhere: a retried call is a fresh mutating tool
call, which means a fresh row, a fresh dialog, and another human decision. The nudge saves the
user from being asked twice; the architecture is what stops the second attempt from succeeding
silently.

Secrets are masked in the copy that is persisted and displayed, never in the copy the handler
receives:

```go
var sensitiveArgKeys = []string{"password", "admin_password", "api_key"}
```

So `create_user` with an explicit password shows `"password": "•••"` in the audit row and in
the confirm card, while the handler still gets the real value. The limitation is that the
masking walks top-level keys only, so a secret nested inside an object argument would land in
the trail in the clear. No current tool has one, which is a fact about today's schema rather
than a guarantee, and it is the sort of thing that quietly becomes false when somebody adds a
tool.

And the deliberately redundant check: after confirmation, `runToolCall` re-tests
`HasPermission(cu.Role, tool.Permission)` even though `AvailableEnabled` already filtered the
list. It is labelled "defence in depth" in the source, and it costs a map lookup. Worth it,
because the two checks read from different places at different times, and the whole promise of
the design is that the second one can never disagree with the first.

---

## 5. Four limits that look like one limit

New engineers reliably collapse these into "the agent has a timeout". They are four separate
mechanisms guarding four separate resources, and getting any of them wrong produces a distinct
failure.

```
 one turn (a "run")
 ├─ budget gate       before any paid call, cap reached -> refuse the run
 │
 ├─ iteration 0   provider call  [<= 90 s]   tools: list_athletes
 │                tool round     (no clock of its own)
 │
 ├─ mid-run check     runCost >= budgetRemaining -> halt, persist cost
 │
 ├─ iteration 1   provider call  [<= 90 s]   tools: create_injury
 │                confirm wait   [<= 10 min]
 │
 └─ iteration 11  hard stop at KINETIX_MAX_TOOL_ITERATIONS (default 12)
```

**The concurrent-run cap** guards the server. `KINETIX_MAX_CONCURRENT_RUNS_PER_USER` defaults
to 3, is incremented before the goroutine is spawned and released in the run's `defer`, and a
fourth attempt returns `ErrTooManyRuns` rather than queueing.

**The confirmation timeout** exists because of that cap. `confirmTimeout` is 10 minutes, and
the comment says exactly why: an abandoned confirmation must not "pin a concurrency slot open
forever". Someone opens a confirm dialog, gets called onto the pitch, and closes the laptop;
ten minutes later the tool call is recorded as `skipped` and the run cancels itself. The cost
of that choice is that a user who steps away for a quarter of an hour loses the turn's work
and starts again, and I would rather explain that than explain why the assistant stopped
answering for everyone.

**The provider timeout** is 90 seconds and it is per call, not per run. That distinction is
the whole reason it works. A wrong base URL, or an upstream that accepts the socket and never
streams, would otherwise block on the HTTP client's own timeout with the browser showing an
endless "thinking". Ninety seconds bounds one round trip; a legitimate turn that calls five
tools gets five fresh 90-second budgets, so a genuinely long piece of work is not punished for
being long. A per-run deadline would have had to be either too short for real work or too long
to catch a hung provider.

**The budget** is two gates rather than one, and they are different questions.
`EnforceBudget(ctx, orgID, userID)` runs before any paid call and returns both a refusal
reason and the remaining headroom in dollars: the smallest `cap - month-to-date spend` across
the organisation-wide cap and this user's personal cap, or positive infinity when neither is
set. Caps are settable both ways and the settings page shows month-to-date spend against them.
A database error there is logged and the run is allowed, on the grounds that a glitch in the
billing table should not lock a physio out of their records.

The second gate is inside the loop. After each model response that asks for more tools, and
therefore implies at least one more paid round trip:

```go
if runCost >= budgetRemaining {
	msg := "I stopped partway through because this turn reached the remaining " +
		"Kinetix budget for the month. A super-admin can raise the cap under " +
		"Settings → Kinetix."
	m := s.persistAssistant(run, msg, "", resolved.Model.ModelName, runUsage, runCost)
	s.emit(run, KinetixEvent{Type: KEventMessage, Message: m})
	s.emit(run, KinetixEvent{Type: KEventDone, Status: "failed"})
	return
}
```

Without it, one long tool loop could sail past a monthly cap and only be caught by the next
run's start gate. Note where the check sits: it halts before further paid work and never
suppresses an answer that is already complete, because a run that has produced its answer has
already spent the money and withholding the output would waste it twice.

Spend is persisted even when the user hits Stop. `recordCancelledSpend` writes a cost-only row
with empty content, through `context.WithoutCancel(run.ctx)` and a 5-second deadline, because
the run's own context is already cancelled by then and the write would fail silently. That bug
is worth naming: the first version persisted through `run.ctx`, the insert came back
`context.Canceled`, and start-then-stop runs counted as zero against both the budget and the
usage report. The failed write was logged. It was the accounting that was silent, which is the
harder kind of bug to notice.

---

## 6. Remembering without replaying

Long threads are where agent harnesses get expensive and then get stupid. The replay is capped
at `maxHistoryMessages = 40` user and assistant turns, trimmed so the list begins on a user
message because providers expect that, and tool rounds are not replayed at all.

Dropping the tool rounds is the aggressive part, and on its own it breaks the thing people
actually do. You spend three turns finding the right athlete, the assistant knows their id,
and twenty turns later it has forgotten who "she" is and looks her up again, or worse,
guesses.

So `buildConversationMemory` distils the conversation's successful tool calls into a compact
recap that goes into the system prompt: the most recent 12 executed calls, each result
truncated to 280 characters, the whole digest capped at 3500 characters, reversed back into
chronological order, and introduced as "Facts already established earlier in THIS conversation
(results you and the user have already seen, reuse these ids/values instead of looking them up
again)". Ids and names survive the trimming; the tool protocol does not.

The privacy argument is the parenthesis. Every line in the digest is a result the user already
saw rendered in the thread, so the digest exposes nothing new to anybody. It only stops the
agent forgetting a fact that is still on screen.

The cost is real. A digest is a lossy summary that the model treats as established fact, and
an id can outlive the record it pointed at: an athlete deactivated in turn nine is still named
in the digest at turn thirty. The mitigation is the hard rule in the system prompt that every
stated fact must come from a tool result in this conversation, and I want to be clear that
this is a prompt rule and therefore not a guarantee. The guarantee is downstream: a stale id
passed to a tool hits a service that scopes by organisation and returns `ErrNotFound`. The
digest can make the agent say something out of date. It cannot make it write somewhere it
should not.

---

## 7. The audit trail is a table, and the stream is only a view

Every tool call becomes a `domain.KinetixToolCall` row, written **before** the tool runs, with
`RunID`, `ConversationID`, `OrganizationID`, `UserID`, `ToolName`, masked `Args`,
`RequiresConfirm`, and `Summary` set to the tool's `Title`. It then moves through a small set
of statuses: `proposed`, `confirmed`, `executed`, `rejected`, `skipped`, `failed`, with the
result JSON or the error message attached at the end.

Writing the row first is deliberate. If the process dies mid-tool, the trail records that the
action was proposed and confirmed and does not claim it completed. A trail written afterwards
would be missing exactly the events you most want to reconstruct.

The same events go to the browser over server-sent events, nine frame types in all: `status`,
`thinking`, `token`, `tool_call`, `confirm_required`, `tool_result`, `message`, `done`,
`error`. They travel over `AgentBus`, an in-process pub/sub with one buffered channel of 256
events per subscriber and a non-blocking publish. Read that last part carefully, because it
decides how much you are allowed to trust the stream:

```go
select {
case sub.ch <- ev:
default:
	// slow consumer, drop
}
```

A slow browser tab loses frames rather than stalling the agent loop, which is the right trade
for a UI and the wrong one for an audit record. So the persisted rows are the record and the
stream is a live view of it. Anything that needs to be true later reads the table. The bus
even exposes `SubscriberCount` purely for diagnostics, because a run whose first event is
published with zero subscribers looks stuck in the browser while having worked perfectly on
the server, and that is the sort of bug you only find twice if you instrument it once.

---

## 8. What an agent must never be allowed to do here

Everything so far is general. This section is the part that is specific to a system holding
medical history, and it is the real point of the post.

### There is no hard delete for a clinical record, because there is no tool

Look at the 29 mutating tools and notice what is missing. There is no `delete_injury`, no
`delete_screening`, no `delete_rtp`, no `delete_athlete`. Asking to delete an athlete reaches
this, with the tail of the description and the parameter schema trimmed:

```go
Name: "deactivate_athlete", Title: "Delete (deactivate) athlete", Mutating: true,
Description: "Delete or remove an athlete (player). The platform deletes athletes by " +
	"soft-deleting them: their historical data is preserved for audit, but they are " +
	"removed from active squads and lists.",
Permission: domain.PermAthleteWrite,
Handler: func(ctx context.Context, args json.RawMessage) (any, error) {
	id, err := argUUID(args, "id")
	if err != nil {
		return nil, err
	}
	if err := ts.athletes.SoftDelete(ctx, id); err != nil {
		return nil, err
	}
	return map[string]any{"deactivated": id}, nil
},
```

The only tools in the whole set that permanently destroy anything in a real workspace are
`delete_video` and `delete_videos`, and both descriptions say so outright ("it cannot be
undone"). The one other destructive verb, `refresh_demo`, rebuilds the demo tenant and is
gated on `system.admin`. A video file is a thing you can decide to lose. An injury record is
not.

This is why soft-delete-first matters more than any prompt, and the reason is mechanical
rather than moral. A prompt instruction is a request to a probabilistic system, and
adversarial or merely confused input finds its way around requests. A missing function is an
absence. You cannot talk a model into calling something that does not exist, you cannot
jailbreak your way to a tool that was never registered, and you do not need to test the case
where it tries. Every safety property I would rather not have to verify by experiment, I get
instead from the shape of the registry.

The same reasoning explains why the confirm dialog is not the primary defence for destructive
work. Confirmation protects against the agent misunderstanding you. It does not protect
against a tired human clicking Approve on a dialog whose `Title` sounded routine. For anything
irreversible in a clinical record, the answer is not a better dialog. It is not shipping the
verb.

### A sign-off is authority, and authority is not delegable to a chat box

The clinical decisions in the system are the sign-offs: physio, doctor, coach, each its own
permission, each gated per field in `RTPService.Create` and `.Update`. The agent can draft a
return-to-play entry all day. It cannot stamp a signature the human it is acting for could not
stamp, and it cannot stamp one they could without them approving that exact tool call in a
dialog that names it.

That is the correct place for the line. A clearance to return to play after an injury is a
professional taking responsibility. An agent can gather the evidence, lay out the screening
results, point out that the workload ratio is climbing. The signature is a person's, and the
code should make it impossible for it to be anything else.

### The agent inherits the measurement layer's refusals, and must not launder them

Kinetix reads pose results through `get_pose_metrics`, and what comes back is the far end of
[the clinical pipeline](/posts/2026/06/keypoints-to-clinical-metrics/): the output of
everything in
[the camera grading its own footage](/posts/2026/05/camera-grades-its-own-footage/),
[triangulation and camera count](/posts/2026/06/triangulation-and-cameras/) and
[what it refuses to measure](/posts/2026/07/what-it-refuses-to-measure/):
`view_obliquity_deg` with its band label and `view_matches_declared`, coverage fractions,
`trustworthy: false` on a rig whose refined layout has drifted from its declared one, and the
flexion observability gate that simply omits an angle whose limb is too foreshortened to
measure. That gate refuses readings below a sagittal-projection ratio of 0.45, which costs
2.1% of readings and moves the shoulder-flexion mean absolute error (MAE, the average size of
the disagreement) from 6.21 degrees to 5.10 (`validation/README.md` section 4b). The
bench-press clip in the cross-sport checks reports 14% coverage and near-zero angles rather
than inventing numbers, which is the behaviour that makes the other numbers worth anything.

An agent that summarises those metrics into fluent prose is in a position to undo all of it,
and that is the single most likely way this system says something false. Three things it must
never do:

**It must never average configurations into one number.** With three calibrated cameras and
one tap to mark the athlete, 92 out of 100 joint-angle readings land within 10 degrees of 3D
ground truth on ASPset-510; with one camera on free sport action, 52 out of 100. Against a
human annotator on COCO val2017 (n=2000), 91 out of 100 readings land within 15 degrees. The
validation page's own instruction is "do not average these into one number", because the
configuration is the measurement. A single confident "the system is accurate to X degrees" is
the exact sentence a language model is most tempted to produce.

**It must never answer "has this athlete improved?" with a threshold.** Test-retest
reliability and minimum detectable change are unmeasured (`validation/README.md` section 9).
Ankle dorsiflexion has one accuracy figure, 3.50 degrees aligned MAE against marker-based
motion capture on the LBMC gait trial, and gait is not sport. Until the in-vivo study reports
limits of agreement and MDC per metric per side, no threshold for change exists, so the honest
answer to a change-over-time question is a description of two measurements and their
conditions, not a verdict.

**It must never present a caveat it was handed as a caveat it has resolved.** If the job says
the rig is not trustworthy, the summary says so first, not in a closing clause.

None of those three is enforceable in Go. They live in the system prompt's hard rules, which
say "NEVER fabricate data", "every fact you state about a record must come from a tool result
in this conversation", and, on missing data, "say so plainly in one sentence and suggest a
next step where useful. Never fabricate or estimate missing values." I am not going to pretend
that is a guarantee. What makes it survivable is that the tools return the refusals as
structured fields rather than as prose the model has to notice, so the raw material for an
honest answer is always present and the user can see the same tool result in the timeline. The
stream showing every tool call is not decoration; it is how a clinician catches a summary that
has drifted from its source.

---

## 9. Why "nothing new" is the only defensible model

There were three other designs available, and it is worth saying why each fails in this
setting.

**Prompt-only guardrails.** Write the rules into the system prompt, give the agent the tools,
and trust it. This fails on a definitional point rather than an empirical one: the enforcement
and the thing being enforced live in the same untrusted channel. Every part of the harness
series has said this, and a clinical database is where the argument stops being theoretical.

**A dedicated agent principal.** Give Kinetix its own account with its own permissions. This
is worse than it looks, because it doubles the permission model. Every question of the form
"can this be seen by that person" now has two answers, and the interesting bugs live in the
gap. It also creates the thing I most want not to exist: a principal that can act with
nobody's authority in particular, whose actions in the audit trail belong to a robot rather
than a person. The [agent-as-data](/posts/2026/08/an-agent-is-data-not-code/) argument holds
here too: what varies between agents belongs in rows, and what enforces authority should not
vary at all.

**A read-only agent.** Genuinely defensible, and it was tempting. It fails on utility: the
tasks worth automating in this system are logging a session, opening an injury record,
drafting an RTP entry. Take those away and you have a search box with a personality.

What is left is inheritance, and its real virtue is what it does to the review. Because the
agent introduces no new principal, no new query path and no new permission, a security review
of Kinetix reduces to a security review of the application. There is no separate agent threat
model, because there is no separate authority to threaten. When someone asks "what can the
assistant see", the answer is "open the role map", and that is the same document the answer
came from before the assistant existed.

The audit story lands in the same place. A record changed through Kinetix is indistinguishable
in the domain tables from the same user changing it by hand, which is correct, because the
same person authorised the same change. What differs is the extra evidence: a
`kinetix_tool_calls` row naming the tool, the masked arguments, the run, the user, and the
fact that a human approved it before it ran.

The cost of this model is that it forecloses a class of feature. Kinetix can never be the
thing that does a job nobody is allowed to do: no nightly sweep, no unattended reconciliation,
no "tidy up last season" over a whole organisation. Those need a real service principal,
reviewed on its own terms, with its own audit posture. That may be worth building one day. It
would not be this, and it would not be reached by loosening this.

---

## The short version

- The rule is one sentence: the agent can only do what this user could already do. Everything
  else in Kinetix is machinery for making that true rather than aspirational.
- Two fields on a struct carry the safety argument. `Permission` decides whether the model
  ever hears about a tool, `Mutating` decides whether the run stops and asks a human. 60
  tools, 29 of them mutating.
- Authority is inherited, not granted. The run is a detached goroutine holding
  `auth.WithUser(context.Background(), cu)`, so tenant scoping, athlete self-scoping and the
  three return-to-play sign-off permissions apply without the agent knowing they exist.
- Four limits, four different resources: a concurrent-run cap of 3, a 10-minute confirm
  timeout so an abandoned dialog cannot pin a slot, a 90-second provider timeout that is per
  call and not per run, and a budget checked both before the first paid call and again before
  every further one.
- Trim history, keep facts. 40 replayed turns, no tool rounds, and a digest of the last 12
  executed calls so ids survive the trimming. The digest can make the agent stale; it cannot
  make it write anywhere it should not.
- The persisted tool-call rows are the audit trail and the SSE stream is only a view of them,
  since a full subscriber buffer drops frames rather than stalling the run.
- In a clinical system the important safety properties are absences. There is no hard delete
  for any clinical record because the tool does not exist, and a signature stays a person's
  because three permissions say so. You cannot talk a model into calling a function that was
  never registered.
- The reward for adding no new authority is that reviewing the agent means reviewing the app.
  The price is that the agent can never be the thing that does what nobody is allowed to do.

---

*That is the series. It began by asking what "accurate" means for a joint angle and ended in
the code that lets an assistant read those angles out loud, and the same idea carried the
whole way: put the conditions next to the number, and make the system able to say what it
cannot do. If you landed here first, start with
[what "accurate" has to mean](/posts/2026/01/joint-angle-accuracy/) and read forward, or take
the software thread from
[what an agent harness actually is](/posts/2025/08/what-is-an-agent-harness/).*
