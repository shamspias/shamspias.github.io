---
title: "Cross-Site Request Forgery: Making the Victim's Browser Do It"
description: "The attacker never steals the session. They get the victim's own browser to send an authenticated request, using cookies the browser attaches for them."
date: 2024-06-11
permalink: "/posts/2024/06/cross-site-request-forgery/"
lang: en
tags:
  - "security"
  - "web security"
  - "csrf"
  - "cookies"
series: "Security From the Ground Up"
seriesOrder: 4
math: false
---

*Cross-site request forgery is the sneakiest of the common web bugs, because nothing is stolen and nothing is injected. The attacker exploits a helpful thing browsers do: they attach your cookies to every request to a site, including requests that a completely different, malicious site told your browser to make. Understand that one browser behaviour and CSRF, and its fix, both become obvious.*

## 1. The behaviour that makes it possible

When your browser sends a request to `yourbank.com`, it automatically attaches every cookie it holds for `yourbank.com`, including your session cookie. That is what keeps you logged in: you do not re-enter your password on every click, because the cookie rides along on every request.

Here is the catch. The browser attaches those cookies based only on *where the request is going*, not on *where it came from*. So if some other page, an attacker's page, causes your browser to send a request to `yourbank.com`, your browser cheerfully attaches your `yourbank.com` session cookie to it. To the bank's server, that request looks fully authenticated, because it is: it carries your real session.

```
   you are logged in to bank.com (you hold its session cookie)

   you visit evil.com in another tab
        |
        |  evil.com's page tells your browser: send a request to bank.com
        v
   your browser sends it TO bank.com, and attaches your bank.com cookie
        |
        v
   bank.com sees a valid, logged-in request. it cannot tell that
   evil.com, not you, is the one who wanted it made.
```

That is the whole vulnerability. The attacker never sees your cookie, never reads your session, never runs code on the bank's page. They just get your browser to fire a request that the bank will honour as yours.

## 2. What it looks like

Suppose the bank performs a transfer with a simple form post:

```html
<!-- the real form on bank.com -->
<form action="https://bank.com/transfer" method="POST">
  <input name="to" value="...">
  <input name="amount" value="...">
</form>
```

The attacker puts a page on `evil.com` with a hidden form aimed at the bank, and submits it with JavaScript the moment you load the page:

```html
<!-- on evil.com: a hidden, auto-submitting form -->
<form action="https://bank.com/transfer" method="POST" id="f">
  <input type="hidden" name="to" value="attacker-account">
  <input type="hidden" name="amount" value="10000">
</form>
<script>document.getElementById("f").submit();</script>
```

You visit `evil.com`, perhaps from a link in an email. The page silently submits the form to the bank. Your browser attaches your bank session cookie. If the bank has no CSRF defence, the transfer goes through, authenticated as you, and you never clicked anything you understood as a transfer.

For a request the browser can make with an image tag, even a script is not needed. A `GET` that changes state, `/logout`, `/delete?id=5`, `/subscribe`, can be triggered by nothing more than `<img src="https://bank.com/delete?id=5">` on any page you visit. That is one reason the very first rule below matters.

## 3. Rule zero: state-changing actions are never GET

Before any dedicated defence, one design rule removes a whole swathe of CSRF and a swathe of other problems: **a request that changes something must never be a GET.** GET is for reading. Anything that transfers money, deletes data, changes a setting, or logs you out must be a POST, PUT, PATCH or DELETE.

Why this helps: GET requests are the easiest for an attacker to trigger from anywhere, an image, a link, a prefetch, and browsers and proxies treat GET as safe to repeat and preload. If your `/delete` is a GET, a search engine crawler following links can delete your data by accident, never mind an attacker. Restricting state changes to non-GET methods is free and it is not optional.

It is not sufficient on its own, because the auto-submitting form above uses POST. But it is the floor.

## 4. The modern fix: SameSite cookies

The cleanest defence is to fix the browser behaviour that causes the problem, and browsers now let you. Setting the `SameSite` attribute on your session cookie tells the browser when it may attach the cookie to cross-site requests.

```
  Set-Cookie: session=...; HttpOnly; Secure; SameSite=Lax
```

The values:

- **`SameSite=Strict`**: the cookie is never sent on any cross-site request. Maximum safety, but it means following a link from another site to yours arrives logged out, which is often too aggressive.
- **`SameSite=Lax`**: the cookie is sent on top-level navigations (you clicking a link to the site) but not on cross-site sub-requests like a form post or an image load from another origin. This blocks the CSRF above while keeping normal link-following logged in. It is the right default, and modern browsers apply `Lax` even when you do not set it.
- **`SameSite=None`**: the cookie is sent on all cross-site requests, which reopens CSRF. Only for cookies that genuinely must work cross-site, and then only with other defences.

`SameSite=Lax` on your session cookie stops the classic CSRF attack outright, because the attacker's cross-site POST no longer carries the cookie. This is a large part of why CSRF is less prevalent than it was. But treat it as one layer, not the only one: older browsers, certain request shapes, and misconfigured `SameSite=None` cookies all leave gaps, and defence in depth means not relying on a single control.

## 5. The classic fix: the anti-CSRF token

The older, explicit defence still worth using, especially in combination, is the synchroniser token. The idea: require every state-changing request to include a secret value that the attacker's site cannot know.

1. When the server renders a form, it embeds a random, per-session (or per-request) token in a hidden field.
2. When the form is submitted, the server checks that the token in the request matches the one it issued.

```html
<form action="/transfer" method="POST">
  <input type="hidden" name="csrf_token" value="a-long-random-value">
  <!-- ... -->
</form>
```

The attacker's page on `evil.com` cannot read that token, because the same-origin policy stops `evil.com` from reading the contents of a `bank.com` page. So the attacker can make your browser send a request, but cannot make it include the correct token, and the server rejects the request that lacks it.

The token must be: unpredictable (a cryptographically random value), tied to the user's session so one user's token does not validate another's, and checked on every state-changing request, server-side. Most web frameworks ship this and turn it on by default; the failure mode is a developer disabling it to "make an API work" without replacing it with something equivalent.

A common variant for APIs is the double-submit cookie: send the token both as a cookie and as a header, and check they match. It avoids server-side token storage, with some caveats around subdomains.

## 6. Checking where the request came from

A supporting check, useful for APIs: browsers attach an `Origin` header (and often a `Referer`) to requests, saying which site the request came from. The server can require that state-changing requests originate from its own site:

```
  Origin: https://evil.com     -> reject
  Origin: https://bank.com     -> allow
```

This is a reasonable secondary control. It is not a sole defence, because `Origin` is absent on some request types and `Referer` can be stripped by privacy tools, so a policy of "reject if it is present and wrong, but do not depend on it being present" is the honest way to use it.

## 7. Where CSRF does not apply, and a caution

CSRF specifically exploits cookies that ride along automatically. If your API does not authenticate with cookies at all, if it uses a token that the client must explicitly attach as an `Authorization` header, then classic CSRF does not apply, because the attacker's cross-site request cannot attach a header it does not know. This is one reason bearer-token APIs are structurally resistant to CSRF.

The caution: this does not make you safe, it moves the risk. A token stored where JavaScript can read it (like local storage) is now exposed to [XSS](/posts/2024/05/cross-site-scripting/) instead, and XSS can read the token and use it. There is no free lunch. Cookies with `SameSite` and `HttpOnly` trade XSS-theft resistance for CSRF exposure that you then close with tokens; header tokens trade CSRF resistance for XSS exposure. Pick deliberately, and defend the flank you exposed.

## The short version

- CSRF exploits one browser behaviour: cookies are attached to a request based on where it is going, not where it came from. So a malicious site can make your browser send an authenticated request to a site you are logged in to.
- Nothing is stolen or injected. The attacker cannot read your session; they get your browser to spend it, with a hidden auto-submitting form or even an image tag.
- Rule zero: state-changing actions are never GET. GET is triggerable from anywhere and preloadable, so money moves and deletions must be POST, PUT, PATCH or DELETE.
- The modern fix is `SameSite=Lax` (or `Strict`) on the session cookie, so the browser does not attach it to cross-site sub-requests. Modern browsers default to `Lax`, but do not rely on the default alone.
- The classic fix is an anti-CSRF token: a random, session-bound secret embedded in the form and checked server-side. The attacker's site cannot read it, so it cannot forge it. Frameworks ship this; do not disable it.
- Checking the `Origin` header is a useful secondary control, rejecting present-and-wrong origins, but not depending on it being present.
- Cookie auth trades CSRF exposure (closed with tokens) for XSS-theft resistance; header-token auth trades the reverse. There is no free lunch, so defend whichever flank you opened.

Next: broken access control, the bug where the server does the authentication and then forgets to check whether this user is allowed to touch this particular thing.
