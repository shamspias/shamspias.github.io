---
title: "Cross-Site Scripting: Running Your Code in Someone Else's Browser"
description: "The same bug as SQL injection, moved to the browser. How attacker text becomes attacker script in your users' sessions, the three flavours, and the layered fix."
date: 2024-05-14
permalink: "/posts/2024/05/cross-site-scripting/"
lang: en
tags:
  - "security"
  - "web security"
  - "xss"
  - "browsers"
series: "Security From the Ground Up"
seriesOrder: 3
math: false
---

*Cross-site scripting is [SQL injection's](/posts/2024/04/sql-injection/) twin: the same confusion of data and code, moved from the database to the browser. Instead of the attacker writing your query, they write JavaScript that runs in your users' browsers, inside their sessions, with all their privileges. It is consistently one of the most common web vulnerabilities, and the fix is the same shape as injection's: keep the data out of the code channel.*

## 1. The bug: text that becomes script

A web page is code. HTML is code, and it can contain JavaScript, which is very much code. When you build a page by pasting user input into HTML, the user can write part of the page, including the script part. That is cross-site scripting, XSS, and it is exactly the master bug from [part 1](/posts/2024/03/what-security-actually-is/) again.

A comment box. You store what the user typed and show it back to everyone who reads the page:

```html
<!-- the template: a comment, with the user's text pasted in -->
<div class="comment">Hello, this is a normal comment.</div>
```

Now a user submits, as their comment, this:

```html
<script>/* attacker code runs for every reader */</script>
```

If you paste that into the page as-is, the browser does not see text. It sees a `<script>` tag, and it runs it, in the browser of every person who loads the page. The attacker's text became the page's code.

```
  you meant the comment to be:   [        data, shown as text        ]
  the browser received:          <script> ...attacker's code... </script>
                                 ^^^^^^^^
                          data broke out into code, and the browser ran it
```

## 2. Why a script in the page is so dangerous

The injected script runs with the full authority of the page it runs in. That is the key fact, and it comes from the browser's **same-origin policy**: code on your page can do anything your page's own JavaScript could do, because as far as the browser is concerned, it *is* your page's JavaScript. So the attacker's script can:

- **Read the session.** Anything the page can read, it can read: the logged-in user's data on screen, tokens in the page, and, unless you have prevented it, the session cookie.
- **Act as the user.** It can make requests to your server that look exactly like the real user made them, because they come from the real user's browser with the real user's cookies. Change the email on the account, transfer money, post as them.
- **Steal credentials.** It can draw a fake login prompt over the real page, or log keystrokes.
- **Spread.** A stored XSS in a social feature can make every viewer's browser post the same payload, and now it is a worm.

The reason XSS is graver than it first looks: the attacker is not attacking your server directly. They are turning your own trusted page into a weapon against your own users, and the users have no way to tell, because the malicious script is served from your domain, under your padlock, on your page.

## 3. The three flavours

XSS comes in three forms by how the payload reaches the victim. The defence is broadly the same, but knowing them helps you find them.

**Stored (persistent) XSS.** The payload is saved on the server, a comment, a profile name, a review, and served to everyone who views it later. This is the worst kind, because it hits every viewer automatically and can worm.

**Reflected XSS.** The payload is in the request, usually the URL, and the server reflects it straight back into the response. A search page that shows "no results for `<your query>`" and pastes the query in unescaped is the classic. The attacker has to get the victim to click a crafted link, so it is one victim at a time, but a convincing link in an email reaches many.

```
  https://example.com/search?q=<script>...</script>
                                ^
             the server echoes q into the results page unescaped
```

**DOM-based XSS.** No server involvement at all. The page's own JavaScript reads something attacker-controlled, the URL fragment, say, and writes it into the page in a dangerous way:

```js
// dangerous: takes text from the URL and parses it as HTML
document.getElementById("out").innerHTML = location.hash.slice(1);
```

`innerHTML` parses its input as HTML, so a fragment of `#<img src=x onerror=...>` becomes live markup. This one is invisible to server-side defences, because the injection happens entirely in the browser.

## 4. The fix: context-aware output encoding

The cure is the injection cure, phrased for HTML: **when you put untrusted data into a page, encode it for the exact place it is going, so it is treated as text and never as markup.**

In HTML body context, that means turning the characters that have meaning in HTML into their harmless entity forms:

```
  <   becomes   &lt;
  >   becomes   &gt;
  &   becomes   &amp;
  "   becomes   &quot;
  '   becomes   &#x27;
```

Now the attacker's `<script>` arrives at the browser as `&lt;script&gt;`, which renders as the literal visible text `<script>` and runs nothing. The data is shown as data.

The critical word is **context**. The right encoding depends on where the data lands, and getting the context wrong reintroduces the bug even though you "escaped":

- Inside HTML body text: HTML-entity encode.
- Inside an HTML attribute: attribute-encode, and always quote your attributes.
- Inside a URL, as a query value: URL-encode.
- Inside a `<script>` block or an event handler: this is genuinely dangerous, and the answer is almost always **do not put untrusted data there at all.** There is no safe way to drop arbitrary user text into a JavaScript string without deep care.
- Inside CSS: also dangerous, also best avoided.

You should not be doing this by hand character by character. You should be letting a library do it, which is the next point.

## 5. Use a framework that auto-escapes, and respect it

Modern front-end frameworks encode by default. React's `{value}`, Vue's `{{ value }}`, and any server template with auto-escaping on, all HTML-encode interpolated values automatically. This is a real and large reason they are safer than string-built HTML, and it is why "just use the framework's normal interpolation" is most of your XSS defence.

The danger is the escape hatch. Every framework has a way to say "trust me, insert this as raw HTML", and it is always named to make you stop:

- React: `dangerouslySetInnerHTML`
- Vue: `v-html`
- Raw DOM: `element.innerHTML = ...`
- Angular: bypassing the sanitiser

Every one of these turns auto-escaping off for that value. The rule: **you may only pass HTML you constructed yourself, never anything that came from a user, into a raw-HTML sink.** If you genuinely must render user-supplied HTML, a rich-text comment, say, you cannot just insert it. You must run it through a dedicated, well-maintained HTML sanitiser (such as DOMPurify) that parses the HTML and strips everything dangerous, and you must keep that library updated, because bypasses are found and fixed regularly.

For DOM-based XSS specifically, prefer the safe sinks: `textContent` instead of `innerHTML`, `setAttribute` with care, and never build DOM by concatenating strings of HTML.

## 6. The layers behind the encoding

Encoding is the wall. Three more layers limit the damage if a hole appears, and together they are what "defence in depth" means for XSS.

**HttpOnly cookies.** Mark your session cookie `HttpOnly` and JavaScript cannot read it at all. Now even a successful XSS cannot steal the session cookie directly, which removes the single most valuable prize. This is one attribute and there is no reason not to set it.

**Content Security Policy.** A CSP is an HTTP header that tells the browser which scripts are allowed to run, by source. A strict policy that only permits scripts from your own domain and forbids inline scripts means that even if an attacker injects `<script>...</script>`, the browser refuses to run it, because inline script is not on the allowlist.

```
  Content-Security-Policy: default-src 'self'; script-src 'self'
```

CSP is powerful and fiddly to deploy without breaking your own site, and it is a second line, not a first: it turns a working XSS into a blocked one, but you should still encode. Think of it as the airbag, not the brakes.

**Encode on output, not input.** A subtle but important discipline: escape data at the moment you put it into a page, not when you receive it. The same string might be shown in HTML, in a URL, and in a JSON API, each needing different encoding, and you cannot know at input time where it will end up. Store the raw text; encode per context at output. Encoding at input corrupts your data and still gets the context wrong somewhere.

## 7. The habit

XSS review is a specific reading of your templates: find every place a value from outside is put into a page, and for each one ask, "is this auto-escaped for this exact context, and if it is in a raw-HTML sink, did this value come from a user?" That question, run over every interpolation, finds XSS the way the "worst input" question from [part 1](/posts/2024/03/what-security-actually-is/) finds everything else.

## The short version

- XSS is data becoming code in the browser: user input pasted into a page is parsed as HTML and script, so the attacker's text runs as JavaScript in your users' sessions.
- The injected script has your page's full authority under the same-origin policy: it can read on-screen data and the session cookie, act as the user, phish, and, when stored, worm.
- Three flavours: stored (saved and served to everyone, the worst), reflected (echoed from the request, needs a click), and DOM-based (the page's own JavaScript writes attacker input into a dangerous sink).
- The fix is context-aware output encoding: turn HTML-meaningful characters into entities so data renders as text. The context, body versus attribute versus URL versus script, decides the encoding, and getting it wrong reintroduces the bug.
- Let a framework auto-escape, and treat every raw-HTML escape hatch (`dangerouslySetInnerHTML`, `v-html`, `innerHTML`) as off-limits for user data. If you must render user HTML, run it through a maintained sanitiser.
- Layers behind the wall: HttpOnly cookies so script cannot steal the session, a Content Security Policy so injected inline script will not run, and encoding at output time, per context, not at input.

Next: cross-site request forgery, where the attacker does not steal the session at all, and instead makes the victim's browser use it for them.
