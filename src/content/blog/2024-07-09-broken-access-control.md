---
title: "Broken Access Control: Logged In Is Not the Same as Allowed"
description: "The most common serious web bug is also the most boring: the server checks who you are, then forgets to check whether you may touch this particular thing."
date: 2024-07-09
permalink: "/posts/2024/07/broken-access-control/"
lang: en
tags:
  - "security"
  - "web security"
  - "access control"
  - "authorization"
series: "Security From the Ground Up"
seriesOrder: 5
math: false
---

*This is the second master bug from [part 1](/posts/2024/03/what-security-actually-is/): the server trusting the client. It is consistently at or near the top of every real-world vulnerability ranking, and it is the least glamorous bug there is. No clever payload, no injection. Just a missing check. This post is that missing check, the shapes it takes, and the discipline that closes all of them at once.*

## 1. Authentication is not authorisation

Two words that sound alike and are completely different, and confusing them is the whole bug.

- **Authentication** answers "who are you?". Logging in. Proving identity.
- **Authorisation** answers "are you allowed to do this, to this specific thing?". Permission.

A huge amount of code does the first and forgets the second. It checks that you are logged in, and then serves whatever you asked for, without checking that the thing you asked for is yours to see or change. That gap is broken access control.

```
  authentication:  "you are user #7, logged in"     -> checked
  authorisation:   "may #7 read invoice #1002?"     -> NOT checked
                                                       ^^^^^^^^^^^
                                            the breach is right here
```

## 2. The canonical shape: the direct object reference

The clearest example. Your invoice page has a URL:

```
  GET /invoice/1001
```

You are user #7, invoice 1001 is yours, the page checks you are logged in, and shows it. Fine. Now you change the number:

```
  GET /invoice/1002
```

If the server fetches invoice 1002 and shows it because you are logged in, without checking that 1002 belongs to you, you are now reading a stranger's invoice. This is the insecure direct object reference, IDOR, and it is everywhere: sequential ids in URLs, in form fields, in API paths, in the body of a request.

The fix is one line of logic at the point of access, and it must be there on every object fetch:

```pseudo
  invoice = db.getInvoice(id);
  if (invoice.ownerId != currentUser.id)      // the check that closes IDOR
      return forbidden();
```

Note what does not fix it. Making the ids random and hard to guess (a UUID instead of 1002) is not a fix, it is a delay: it is security through obscurity, and the id leaks through shared links, referrer headers, logs, and browser history. Unguessable ids are fine as defence in depth, but the ownership check is the actual control, and it must exist even when the id is a random string.

## 3. The other shapes, same bug

Broken access control wears several costumes. All of them are "a check that should exist does not".

**Missing function-level checks.** The admin panel is at `/admin`. A regular user visits `/admin` directly. If the server renders it because the user is logged in, and only the navigation menu hid the link, the admin panel was protected by the menu, which is to say not protected. Every admin action needs a server-side role check, not a hidden button.

**Trusting a client-supplied role.** A request that includes `role=user`, and an attacker changes it to `role=admin`. If the server believes it, that is the whole exploit. The user's role must come from the server's own record of who they are, never from anything the client sent.

**Mass assignment.** A form updates a user's profile by binding request fields straight onto the database record. The form shows `name` and `bio`, but the attacker adds `isAdmin=true` to the request, and if the code blindly assigns every submitted field, they just promoted themselves. Bind only the fields you meant to expose, by an explicit allowlist, never "everything in the request".

**Path traversal.** A download endpoint takes a filename: `/download?file=report.pdf`. The attacker sends `file=../../../../etc/passwd`, walking out of your intended directory into the filesystem. This is access control over files, and the fix is to resolve the final path and confirm it is still inside the directory you intended, plus refusing `..` outright.

**Server-side request forgery (SSRF).** Your server fetches a URL the user supplied, to grab an image or a webhook. The attacker gives an internal URL, `http://169.254.169.254/` (a cloud metadata service) or `http://localhost:6379/` (an internal database). Your server, which is inside the trusted network, fetches it and hands back the result. The server's own access, its position inside the boundary, is the thing being abused. The fix is an allowlist of destinations and blocking internal address ranges.

Different names, one lesson: something crossed a trust boundary and was granted access it should have had to prove.

## 4. Why it is so common: the check is in the wrong place, or nowhere

Access control bugs proliferate because the correct check is easy to forget and its absence is invisible in testing. The feature works perfectly for the developer, who only ever accesses their own data. It fails only when someone deliberately asks for data that is not theirs, which no functional test does.

The structural fixes:

**Deny by default.** The default answer to "may this request proceed?" should be no, and access should be granted only by an explicit rule. A system where forgetting to add a check means the action is *allowed* will leak; a system where forgetting means it is *denied* will merely break visibly, which you will notice and fix. Build the second kind.

**Check at a chokepoint, not scattered.** If every endpoint re-implements its own ownership check, some will be wrong or missing. Centralise it: a middleware, a policy layer, a query that is scoped to the current user by construction so it is impossible to fetch another user's row. In [the harness work I write about elsewhere](/posts/2025/12/safe-by-default-agents/), the whole point was that the permission check lived in one place that every path had to pass through, rather than being re-derived at each call site.

**Scope queries to the user.** The strongest version of the fix is to make the wrong data unfetchable. Instead of "fetch invoice 1002, then check it is user 7's", write "fetch invoice 1002 *belonging to user 7*", so a mismatch returns nothing:

```pseudo
  SELECT * FROM invoices WHERE id = ? AND owner_id = ?     -- id and current user
```

Now there is no window between fetch and check, and no way to forget the check, because it is part of the query. This is the single most reliable pattern for access control, and I reach for it first.

## 5. A word on authentication, since it sits next door

Access control assumes you know who the user is, which is authentication's job, and authentication has its own well-trodden failures worth naming, though each deserves its own treatment:

- **Store passwords hashed with a slow, salted algorithm** (bcrypt, scrypt, argon2), never plain, never with a fast hash like a single SHA-256. The slowness is the point: it makes cracking a stolen database expensive.
- **Rate-limit and lock out** login attempts, so an attacker cannot try millions of passwords.
- **Use multi-factor authentication** for anything that matters, so a stolen password alone is not enough.
- **Manage sessions properly**: regenerate the session id on login (to prevent fixation), expire idle sessions, and give the user a real logout that invalidates the session server-side.
- **Do not roll your own** password reset, token generation, or crypto. Use the framework's, which has had the edge cases beaten out of it.

These are the front door. Access control is what happens after someone is through it, and both have to hold.

## The short version

- Authentication is "who are you", authorisation is "may you do this to this thing". Doing the first and forgetting the second is broken access control, the most common serious web bug.
- The canonical shape is IDOR: change `/invoice/1001` to `/invoice/1002` and read a stranger's data, because the server checked you were logged in but not that the invoice was yours.
- Unguessable ids are a delay, not a fix. The ownership check is the control, and it must exist even when the id is random.
- Same bug, many costumes: missing admin checks, trusting a client-sent role, mass assignment that lets an attacker set `isAdmin`, path traversal out of a directory, and SSRF abusing the server's position inside the network.
- It is common because the check is easy to forget and invisible in testing: the feature works for the developer, who only ever touches their own data.
- Close it structurally: deny by default, check at one chokepoint rather than scattered, and above all scope every query to the current user so the wrong data is unfetchable and the check cannot be forgotten.
- Next door, authentication has its own rules: slow salted password hashing, rate limiting, multi-factor, proper session handling, and never rolling your own crypto.

Next: binary exploitation, where the confusion between data and code goes all the way down to the memory the program runs in.
