---
title: "Network Security: Who Are You Actually Talking To?"
description: "On a network the confusion is not data and code but identity. What HTTPS really guarantees, what it does not, and why a padlock is about the pipe, not the site."
date: 2024-10-15
permalink: "/posts/2024/10/network-security-and-tls/"
lang: en
tags:
  - "security"
  - "network security"
  - "tls"
  - "cryptography"
series: "Security From the Ground Up"
seriesOrder: 7
math: false
---

*The bugs in the rest of this series were confusions about data and code. On the network the confusion is different: you send a request into a wire you do not own, and something at the other end answers, and the whole question is whether that something is who you think it is, and whether anyone in between read or changed what you sent. This post is what TLS, the technology behind HTTPS, actually promises, what it does not, and the mistakes made at its edges.*

## 1. The threat: the wire is not yours

When your browser talks to a server, the request passes through equipment you do not control: your router, your internet provider, the cafe's wifi, a dozen routers across the internet, the server's provider. Anyone sitting on that path is a potential **man in the middle**, and without protection they can do three things:

- **Read** everything you send and receive. Passwords, messages, cookies, in the clear.
- **Change** it in flight. Alter the amount on a transfer, swap a download for malware, inject a script into a page.
- **Impersonate** either end. Pretend to be the server to you, and you to the server, relaying between the two while reading and editing everything.

```
   you  ------->  [ attacker on the path ]  ------->  server
        <-------  reads, changes,          <-------
                  or impersonates either end

   plain HTTP gives the attacker all three. this is not exotic;
   open wifi and a compromised router are enough.
```

Plain HTTP offers no defence against any of this. Every byte is readable and forgeable. That is why the entire web moved to HTTPS, and why "just HTTP for the parts that are not sensitive" is a mistake: the attacker who can read your non-sensitive traffic can also inject a script into it.

## 2. What TLS guarantees, precisely

HTTPS is HTTP carried inside **TLS** (Transport Layer Security, the successor to SSL). TLS provides three distinct guarantees, and it is worth separating them because people conflate them:

- **Confidentiality.** Everything is encrypted, so the man in the middle sees only ciphertext. Read is defeated.
- **Integrity.** Every message carries a cryptographic tag that changes if a single bit is altered, so tampering is detected and the connection drops. Change is defeated.
- **Authentication of the server.** You get cryptographic proof that you are talking to the real owner of the domain, not an impersonator. This is the guarantee people understand least and it is the one that makes the other two meaningful.

That third one is the crux. Encryption alone is worthless if you encrypted your secrets *to the attacker*. Authentication is what ensures the party you set up encryption with is actually the server you meant, and not a middle-man who would happily encrypt with you and then read everything.

## 3. How the server proves who it is: certificates

The server proves its identity with a **certificate**: a document that says "the public key below belongs to example.com", signed by a **certificate authority** (CA) that your browser already trusts. The chain of trust works like this:

1. Your browser ships with a built-in list of trusted certificate authorities.
2. The server presents a certificate for its domain, signed by one of those authorities.
3. Your browser checks the signature is valid, the certificate is for the domain you asked for, and it has not expired or been revoked.
4. Using public-key cryptography, the server proves it holds the private key matching the certificate's public key, which an impersonator who merely copied the certificate could not do.

Only if all of that passes does the encrypted session proceed. The man in the middle cannot get a valid certificate for `example.com` from a trusted authority, because the authority verifies domain ownership before issuing one. So they cannot impersonate the server, and their attack collapses to, at most, seeing that you connected to the site, not what you said.

```
  browser trusts:  [ CA ]
                      | signs
                      v
  server shows:   [ cert: example.com + public key ] + proof of key
                      |
  browser checks: signature ok? domain matches? not expired?
                      |
                   all yes -> encrypted, authenticated session
```

## 4. What the padlock does and does not mean

The most important and most misunderstood point. The padlock in the address bar means: **the connection to this domain is encrypted and the domain is who it says it is.** That is all. It says nothing about whether the site is honest, safe, or the one you meant to visit.

A phishing site at `paypa1-login.com` (with a digit one) can have a perfect padlock. It got a valid certificate for *its own* domain, which is free and automatic. TLS correctly confirms you have a secure, authenticated connection to `paypa1-login.com`. It cannot tell you that you meant `paypal.com`. The padlock is about the *pipe*, not about *who is on the other end being trustworthy*.

So: HTTPS protects what you send from the network. It does not protect you from having sent it to the wrong place. Checking the actual domain name remains the user's job, and helping users see the real domain remains the designer's.

## 5. The mistakes made at the edges

TLS itself is solid; the failures are almost always in how it is deployed or checked. The common ones:

**Not validating the certificate in your own code.** When a browser talks TLS, it checks the certificate rigorously. When *your program* makes an HTTPS request, it should too, and the certificate check is sometimes disabled by developers fighting an error. Turning off certificate verification (`verify=False`, `InsecureSkipVerify`, trusting all certificates) does not "fix the TLS error", it removes the authentication guarantee entirely and re-opens the machine-in-the-middle attack. It is one of the most common and most serious mistakes in application code. Never ship it.

**Mixed content.** An HTTPS page that loads a script over plain HTTP has a hole exactly the width of that script: the man in the middle can tamper with the HTTP script and thereby control the secure page. Load every resource over HTTPS. Browsers now block active mixed content for this reason.

**Downgrade attacks.** An attacker who can interfere with the first connection tries to force it back to plain HTTP, or to an old, broken TLS version. The defences are HSTS (a header that tells the browser "only ever reach me over HTTPS, remember it") and disabling old protocol versions (SSL and early TLS are broken; TLS 1.2 and 1.3 only).

**Weak or expired configuration.** Old cipher suites, expired certificates, misconfigured chains. These are operational hygiene, and free scanners will grade your server's TLS configuration and tell you exactly what to turn off.

**Trusting the network inside the perimeter.** The old model assumed everything inside the corporate network was safe, so internal traffic went unencrypted. One compromised machine then reads everything. The modern stance, "zero trust", is to authenticate and encrypt even internal connections, because "inside the network" is not a trust boundary you should rely on.

## 6. Where cryptography fits, and the one rule about it

TLS is the visible face of cryptography in most systems, and cryptography shows up elsewhere too: hashing passwords, signing tokens, encrypting data at rest. There is a great deal to know, but for an application developer there is one rule that prevents most disasters:

> **Do not implement cryptographic primitives yourself.** Use a vetted, current library, at the highest level it offers, with its defaults.

Cryptography is a field where code that looks correct and passes every test can be completely broken in ways only a specialist would see: timing side channels, reused nonces, weak randomness, padding oracles. The primitives, AES, RSA, the hash functions, are not the hard part; using them correctly is, and the libraries encode decades of learning about the correct way. Reach for the high-level interface ("encrypt this and authenticate it", "hash this password") rather than assembling the pieces, and never invent your own scheme. The one universal beginner mistake here is a home-grown encryption or token scheme, and it is always broken.

## The short version

- On a network the confusion is identity: the wire is not yours, and a man in the middle can read, change, or impersonate. Open wifi and a compromised router are enough; plain HTTP defends against none of it.
- TLS, the technology behind HTTPS, gives three guarantees: confidentiality (encrypted), integrity (tampering is detected), and authentication of the server (proof you are talking to the real domain).
- Authentication is the crux: encryption is worthless if you set it up with the attacker. Certificates, signed by authorities your browser trusts, are how the server proves it is the real owner of the domain, and an impostor cannot get one.
- The padlock means the connection is encrypted and the domain is who it says it is. It does not mean the site is honest or the one you meant. A phishing domain can have a perfect padlock.
- The failures are at the edges: disabling certificate verification in your own code (never do this), mixed HTTP content on an HTTPS page, downgrade attacks (use HSTS and modern TLS only), and trusting unencrypted traffic inside a network.
- For cryptography generally, one rule prevents most disasters: use a vetted library at its highest level with its defaults, and never implement the primitives or invent a scheme yourself.

This series has walked one idea in seven costumes: a system is only as safe as its trust boundaries, and a boundary is only as safe as the check that guards it. Injection, XSS, CSRF, broken access control, memory corruption, and the network are all one question asked in different places: did you trust what crossed the line more than you should have?
