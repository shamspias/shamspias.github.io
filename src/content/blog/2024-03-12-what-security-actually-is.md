---
title: "What Security Actually Is: Trust Boundaries and the Two Master Bugs"
seoTitle: "What Security Actually Is"
description: "Security is not a product you add. It is a property of where you decide to trust, and almost every vulnerability is one of two confusions crossing that line."
date: 2024-03-12
permalink: "/posts/2024/03/what-security-actually-is/"
lang: en
tags:
  - "security"
  - "web security"
  - "threat modelling"
  - "trust boundaries"
series: "Security From the Ground Up"
seriesOrder: 1
math: false
---

*Security has a reputation as a bag of tricks: a list of attacks with funny names you memorise. It is the opposite. Almost every vulnerability you will ever meet is one of two confusions happening at a boundary you drew without noticing. Learn to see the boundary and the two confusions, and the funny names become obvious rather than arcane. This series is that way of seeing, built from the ground up, and always paired with the fix.*

## 1. Security is a property of a boundary

Start with the word "trust", because it is the whole subject. Every system is divided into parts that trust each other and parts that do not. Your database trusts your application server. Your application server does not trust the browser. The browser does not trust the web page it just loaded. Each place where trust changes is a **trust boundary**, and every security bug lives on one.

A bug is not "the attacker did something clever". A bug is "data crossed a trust boundary and was treated as more trustworthy than it was". That single sentence is most of security.

```
   BROWSER            NETWORK           SERVER            DATABASE
   (hostile)                          (yours)           (trusted)
      |                   |               |                  |
   user types  ------->  wire  ------->  code  --------->  query
      |                   |               |                  |
      +-- boundary 1 -----+-- boundary 2 -+-- boundary 3 ----+

   every arrow is a place where you decide how much to believe
   what just arrived. a vulnerability is believing too much.
```

The practical consequence is a rule you will hear for the rest of the series: **all input is hostile until you have made it safe**, and "input" means everything that crossed a boundary from somewhere you do not control. The form field, obviously. But also the URL, the cookie, the HTTP header, the filename in the upload, the JSON body, the value your own JavaScript read from the page. If it came from outside your trust boundary, you do not trust it, no matter how ordinary it looks.

## 2. What you are actually protecting: three properties

When people say a system is "secure" they mean three specific, separable things. The old names are confidentiality, integrity and availability, and the jargon hides how concrete they are.

- **Confidentiality**: only the people who should see the data, see it. A leak breaks this. Your medical records showing up in someone else's account.
- **Integrity**: only the people who should change the data, change it, and only in allowed ways. A tampered bank balance breaks this. So does an attacker editing a review they did not write.
- **Availability**: the system is there when it should be. A denial-of-service breaks this.

These trade against each other and against everything else, which is why "just make it secure" is not an instruction. A system in a concrete box with no network is extremely confidential and useless. Security is always "secure enough against this attacker, for this data, at this cost". That is what a **threat model** is, and skipping it is why so much security effort is spent in the wrong place.

## 3. Threat modelling, in four questions

Before defending anything, answer four questions honestly. This takes ten minutes and saves you from armouring the front door while the back is open.

1. **What are you protecting?** The data and the actions. Name them. "User passwords" and "the ability to transfer money" are different assets with different stakes.
2. **Who is the attacker?** A bored teenager, a competitor, a criminal group, an insider, a state. They differ enormously in patience and budget, and defending against all of them equally is how you defend against none of them well.
3. **What can the attacker do?** Their capabilities. Can they send requests? Read network traffic? Run code on the same machine? Phish an employee? This is the attacker's side of your trust boundaries.
4. **What happens if they win?** The impact. A defaced marketing page and a drained bank account both count as "a breach" and are not remotely the same problem.

The output is not a document. It is a ranked list of "here is what would actually hurt, and here is who could plausibly do it", and it tells you where to spend.

## 4. The first master bug: injection

Here is the first of the two confusions, and it is responsible for a staggering share of real breaches.

**Injection is when data is mistaken for code.**

You build a command, a query, a page, a shell invocation, by gluing together a fixed template and some input. If the input can break out of the "data" slot and be read as part of the "code", the attacker has just written your program for you.

The shape is always the same:

```
  you meant:        SELECT * FROM users WHERE name = '<data>'
  attacker sends:   data = '  OR  1=1  --
  you now run:      SELECT * FROM users WHERE name = ''  OR  1=1  --'
                                                        ^^^^^^^^^^
                                          the data became a condition
```

SQL injection is this with a database query. Cross-site scripting is this with an HTML page. Command injection is this with a shell. Server-side template injection, LDAP injection, XML injection: all the same bug wearing different clothes. The reason it is so common is that string concatenation is the most natural way to build anything, and it is exactly the wrong way.

The fix is also always the same in shape: **keep the data out of the code channel entirely.** Do not build the query as a string with the value in it. Hand the query and the value to the database as two separate things, so the value can never be parsed as query. That is what a parameterised query, an auto-escaping template, and an argument array instead of a shell string all do. The series spends a post each on the important cases, but the cure is one idea: separate the instructions from the data.

## 5. The second master bug: broken access control

The other confusion is subtler and, in modern web applications, even more common.

**Broken access control is when the server trusts the client to enforce the rules.**

The browser is not your program. It is the attacker's program. Every check that lives only in the front end, a disabled button, a hidden menu, a form that only appears for admins, is advisory. The attacker does not use your front end. They send the raw request.

```
  your UI shows the "delete" button only to admins.
  the attacker never sees your UI. they send:

      POST /api/posts/8842/delete

  if the server deletes the post without checking that THIS user
  is allowed to delete THIS post, the button was security theatre.
```

The canonical version is the insecure direct object reference: the URL contains `/invoice/1001`, you change it to `/invoice/1002`, and you see someone else's invoice, because the server checked that you were logged in but not that invoice 1002 was yours. Authentication asks "who are you"; authorisation asks "are you allowed to do this, to this specific thing". Confusing the two, or doing the first and forgetting the second, is broken access control, and it is at or near the top of every real-world vulnerability ranking.

The fix: **every request re-checks, on the server, that this authenticated user is allowed to perform this action on this object.** Every time. Not in the UI, not once at login, but at the point of the action, on the trusted side of the boundary.

## 6. Why these two, and why the mindset matters more than the list

Nearly everything in the rest of the series is a special case of one of those two, plus a third theme that is really about trust in transit (the network, cryptography, sessions). Injection is "data became code". Broken access control is "the server believed the client". Hold those two and you can often predict a class of bug before you have a name for it.

The deeper habit is a shift in how you read your own code. A normal developer reads a line and asks "does this do what I want on the inputs I expect?". A developer thinking about security reads the same line and asks a second question: **"what is the worst input that reaches this line, and what does the line do then?"** Not the input you expect. The input an adversary would choose, having read your code and wanting it to break.

That question, asked at every trust boundary, finds most bugs before they ship. It is not paranoia, it is just remembering that the input is chosen by someone who does not have your interests at heart.

## 7. A note on responsibility, since this is a security series

Everything here is written to make you the person who does not ship the vulnerability. Understanding how an attack works is the only way to defend against it, which is why security is taught by showing the attack. But there is a bright line between understanding a class of bug in order to prevent it, and using it against a system you do not own and do not have permission to test. The first is engineering. The second is, in most places, a crime, regardless of intent. Test your own systems, systems you are paid to test with written scope, and deliberately vulnerable practice targets built for it. Nothing in this series is a licence to point it at someone else's machine.

## The short version

- Security is a property of trust boundaries: every place data crosses from something you do not control into something you do. A vulnerability is trusting what crossed more than you should have.
- All input is hostile until you have made it safe, and input means everything from across a boundary: fields, URLs, cookies, headers, filenames, JSON, values your own code read back.
- You protect three separable things: confidentiality, integrity, availability. "Secure" always means "against this attacker, for this data, at this cost", which is what a threat model decides.
- Threat model in four questions: what are you protecting, who is the attacker, what can they do, what happens if they win. It tells you where to spend.
- The first master bug is injection: data mistaken for code. The fix is always to separate the instructions from the data so input can never be parsed as command.
- The second master bug is broken access control: the server trusting the client. The fix is to re-check, on the server, that this user may do this action to this object, every time.
- The habit that matters more than any list: read each line and ask what the worst input an adversary would choose does when it reaches that line.

Next: SQL injection, the clearest example of data becoming code, and why one library feature ends it forever.
