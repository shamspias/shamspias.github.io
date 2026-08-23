---
title: "Green Padlock, Zero Headache: Let’s Encrypt SSL for Self-Hosted Dify"
seoTitle: "Let’s Encrypt SSL for Self-Hosted Dify"
description: "Let's Encrypt certificates on a self-hosted Dify behind Nginx: the ACME flow, the nginx reload everyone forgets, and how to test without burning rate limits."
date: 2025-05-08
permalink: "/posts/2025/05/dify-ssl-zero-to-green/"
tags:
  - "dify"
  - "SSL"
  - "Let's Encrypt"
  - "Docker"
  - "DevOps"
  - "self-hosting"
  - "beginner"
math: false
---

*Getting the padlock is fifteen minutes of work. Keeping it is the part that quietly bites you
eight weeks later, which is why half this post is about renewal rather than issuance.*

---

## 1. What the padlock actually is

A TLS certificate is a laminated ID card for a domain name. It says "the machine answering for
`dify.example.com` holds this particular private key", and it is signed by an organisation that
browsers already trust. The signing organisation is a Certificate Authority. Let's Encrypt is a
free, fully automated one, and it now signs a large fraction of the public web.

Before it signs anything, the CA has to check you really control the address on the card. The
check I use here is called HTTP-01, and the analogy is exact: the CA gives you a random number,
tells you to put it on a sign outside the building at that address, then drives past and reads
the sign. If the number matches, you evidently control the address.

Precisely: Certbot asks Let's Encrypt for a certificate, gets back a token, writes that token to
a file under `/.well-known/acme-challenge/` on a shared volume, and nginx serves that file over
plain HTTP on port 80. The CA fetches it, sees the right bytes, and issues.

```
   certbot            nginx           Let's Encrypt CA
      │                 │                    │
  1.  ├─────────────────┼───────────────────>│  cert for
      │<────────────────┼────────────────────┤  dify.example.com?
      │                 │                    │  prove it: token X
  2.  ├──> writes X into the shared webroot volume
      │                 │                    │
  3.  │                 │<───────────────────┤  GET /.well-known/
      │                 │                    │  acme-challenge/X
      │                 ├───────────────────>│  the token, over :80
      │                 │                    │
  4.  │<────────────────┼────────────────────┤  signed certificate
      ├──> writes fullchain.pem + privkey.pem into the conf volume
      │                 │
  5.  │                 └─ reload, read the pem files, serve :443
```

Two consequences fall straight out of that picture. Port 80 must be reachable from the public
internet, not just from your laptop. And nginx has to be running *before* you ask for the
certificate, which is why the order of operations below looks slightly backwards.

The cost side, plainly: this gets you encryption in transit and a browser that stops shouting.
It does not authenticate your users, rate-limit your API, or stop anyone who has your workspace
password. TLS is the outer envelope. What is inside still needs its own controls, which is a
different post: [safe by default](/posts/2025/12/safe-by-default-agents/).

---

## 2. Before you start

You need four things.

* A domain with an `A` record (or `AAAA` for IPv6) pointing at the server.
* Ports 80 and 443 open, both in the host firewall and in the cloud security group.
* Docker Engine 24 or newer with Compose v2. Check with `docker compose version`.
* The Dify repo: `git clone https://github.com/langgenius/dify.git && cd dify/docker`.

Verify the first two before you touch Certbot, because a failed validation costs you a slot
against Let's Encrypt's rate limits and gives you a useless error message.

```bash
dig +short dify.example.com A          # should print your server's public IP

# From somewhere that is NOT the server, e.g. your laptop:
curl -sS -o /dev/null -w '%{http_code} %{time_total}s\n' \
  http://dify.example.com/.well-known/acme-challenge/ping
```

Run `dig` now. Run the `curl` once something is actually listening on port 80, which on a fresh
install means after section 4; if this machine is already serving Dify over plain HTTP, do both
here.

The three answers point at three different faults, so read them precisely. A `404` is the pass
condition: something on port 80 accepted the connection and told you the file does not exist,
which is exactly what nginx should say about a token that was never written. `curl: (7)
Connection refused` almost always means the packets reached the host and nothing was listening,
so DNS and the firewall are fine and your stack is simply down. A hang or a timeout is the bad
one: a firewall or a security group is dropping the packets in silence, and Certbot will fail
the same way, only more slowly.

---

## 3. The two files nginx wants

Dify's nginx container reads its TLS config from environment variables in `docker/.env`. All you
are really doing is telling it two filenames and a switch.

```bash
# Filenames nginx looks for inside the certbot conf volume
NGINX_SSL_CERT_FILENAME=fullchain.pem
NGINX_SSL_CERT_KEY_FILENAME=privkey.pem

# Serve /.well-known/acme-challenge/ over plain HTTP so the CA can read tokens
NGINX_ENABLE_CERTBOT_CHALLENGE=true

# Passed straight through to certbot inside its container
CERTBOT_DOMAIN=dify.example.com
CERTBOT_EMAIL=ops@example.com

# Off for now. There is no certificate yet, and nginx will refuse to start without one.
NGINX_HTTPS_ENABLED=false
```

`fullchain.pem` is your certificate plus the intermediate that links it to Let's Encrypt's root.
Serve the chain, not just `cert.pem`, or some clients will reject you while your browser looks
fine. `privkey.pem` is the private key: it never leaves the server and never goes in git.

Use a mailbox you actually read for `CERTBOT_EMAIL`. It is worth saying plainly that this
address is no longer an expiry alarm. Let's Encrypt stopped sending certificate expiration
warning emails in June 2025, on the reasonable grounds that anyone relying on them had not
automated properly. Your monitoring is now genuinely your problem. Section 7 covers it.

### The URL variables, and the infinite spinner

Dify's front-end is a separate process from its API, and it needs to know which absolute URLs to
call. Those live in the same `.env`:

```bash
CONSOLE_API_URL=
CONSOLE_WEB_URL=
SERVICE_API_URL=
APP_API_URL=
APP_WEB_URL=
FILES_URL=
```

Leave every one of them blank and Dify derives them from the incoming request, which is correct
under HTTPS and is what I now do. The failure mode is the half-migrated state: some set to
`http://…` from an earlier run, some blank. The browser then loads the page over HTTPS and the
page tries to call an `http://` API, the mixed-content rule kills the request, and you get a
console that spins forever with nothing useful in the server logs. Either blank them all, or set
all six to `https://dify.example.com`. Do not mix. `FILES_URL` is the one people miss, and the
symptom is narrow: everything works except image previews and file downloads.

---

## 4. Bring the stack up with the certbot profile

The Certbot container is behind a Compose profile, so it does not run unless you ask for it.

```bash
docker compose --profile certbot up -d --force-recreate
```

`--profile certbot` starts the certbot side-car alongside nginx. `--force-recreate` rebuilds the
containers so nginx picks up the new environment and mounts the Let's Encrypt volumes. `-d` runs
detached.

The original version of this post told you to run `docker network prune` first. I would not any
more. It is a blunt instrument that deletes every unused network on the host, including ones
belonging to other people's stacks. If you have a stale network from an older Dify, scope the
fix to this project:

```bash
docker compose --profile certbot down --remove-orphans
docker compose --profile certbot up -d --force-recreate
```

Here is what the two containers share once they are up. Nothing else in the stack touches these
volumes, and both directions of the arrow matter.

```
  ┌──────────────┐                          ┌──────────────┐
  │    nginx     │                          │   certbot    │
  │  :80  :443   │                          │  renew loop  │
  └──────┬───────┘                          └──────┬───────┘
         │ reads                            writes │
         │        ┌──────────────────────┐         │
         ├───────>│ certbot/conf/live/…  │<────────┤
         │        │   fullchain.pem      │         │
         │        │   privkey.pem        │         │
         │        └──────────────────────┘         │
         │ serves                           writes │
         │        ┌──────────────────────┐         │
         └───────>│ certbot/www/         │<────────┘
                  │   .well-known/…      │
                  └──────────────────────┘
```

---

## 5. Get the certificate, staging first

Let's Encrypt enforces rate limits, and the two that catch beginners are five failed
validations per hostname per hour and five duplicate certificates per week. They punish
different mistakes. Mistype the domain and you fail validation, which costs you an hour. Get
the same certificate issued five times in a week while you fiddle with the config and you are
locked out of that exact set of names for seven days, by which point the thing you cannot
reissue is a working certificate. There is a staging CA with far looser limits and an untrusted
root, and it exists precisely so you can rehearse.

```bash
# In docker/.env, for the rehearsal only:
CERTBOT_OPTIONS=--test-cert
```

Recreate the certbot container so it sees the change, then run Dify's helper script:

```bash
docker compose --profile certbot up -d --force-recreate certbot
docker compose exec certbot /bin/sh /update-cert.sh
```

If that succeeds, you will get a certificate signed by something like "(STAGING) Let's Encrypt".
Your browser will refuse it, which is correct. Now delete the staging certificate, clear
`CERTBOT_OPTIONS`, recreate, and run it once more for the real thing:

```bash
rm -rf volumes/certbot/conf/live/dify.example.com \
       volumes/certbot/conf/archive/dify.example.com \
       volumes/certbot/conf/renewal/dify.example.com.conf

# CERTBOT_OPTIONS= (empty) in .env
docker compose --profile certbot up -d --force-recreate certbot
docker compose exec certbot /bin/sh /update-cert.sh
```

The output you are looking for:

```
Successfully received certificate.
Certificate is saved at:
  /etc/letsencrypt/live/dify.example.com/fullchain.pem
Key is saved at:
  /etc/letsencrypt/live/dify.example.com/privkey.pem
```

That path is inside the container. On the host the same files sit in
`volumes/certbot/conf/live/dify.example.com/`, in the volume nginx reads from.

---

## 6. Turn HTTPS on

Now, and only now, flip the switch:

```bash
# docker/.env
NGINX_HTTPS_ENABLED=true
NGINX_SSL_PROTOCOLS=TLSv1.2 TLSv1.3
```

TLS 1.2 and 1.3 only. TLS 1.0 and 1.1 have been deprecated for years and there is no client left
in 2026 that needs them and deserves to reach your Dify.

Recreate nginx alone. `--no-deps` stops Compose from restarting the API, worker, database and
vector store just because you touched the proxy:

```bash
docker compose --profile certbot up -d --no-deps --force-recreate nginx
```

If nginx exits immediately, read its logs first: `docker compose logs --tail=50 nginx`. Nine
times out of ten it is a missing pem file, which means step 5 did not actually succeed.

---

## 7. Check it properly

The green padlock in your own browser proves very little. It may be cached, and it says nothing
about the chain other clients will see. Ask openssl instead.

```bash
echo | openssl s_client -connect dify.example.com:443 \
       -servername dify.example.com 2>/dev/null \
  | openssl x509 -noout -subject -issuer -dates
```

You want `issuer` to name Let's Encrypt (with no "STAGING" in it), `notAfter` to be about ninety
days out, and `subject` to be your domain. Then confirm the redirect works:

```bash
curl -sSI http://dify.example.com | head -3
```

A `301` or `308` to the `https://` URL is the pass condition.

For ongoing monitoring, since the CA will not email you, the cheapest useful check is a cron job
or an uptime probe that alerts when the certificate has fewer than fifteen days left:

```bash
# exits 1 when the cert expires within 15 days
echo | openssl s_client -connect dify.example.com:443 \
       -servername dify.example.com 2>/dev/null \
  | openssl x509 -noout -checkend 1296000
```

Most uptime services do this for you now. Turn it on, whichever you use.

---

## 8. Renewal, and the reload everyone forgets

This is the section that matters, and it is the one the original version of this post got wrong.

Dify's certbot container runs a loop: sleep twelve hours, run `certbot renew`, repeat. Modern
Certbot does not blindly wait for the last thirty days either. It asks the CA when to renew,
using ACME Renewal Information (ARI), and falls back to the thirty-day rule if the CA does not
answer. So renewal itself is genuinely automatic. Good.

Nginx is the problem. It reads the certificate files once, at startup, and holds the parsed
certificate in memory. Certbot writing a fresh `fullchain.pem` to the volume changes nothing
that nginx can see. Something has to tell nginx to re-read the files.

```
  on disk   ──┬─ old cert ───────────┬─ new cert ────────────────────
              │                      │
              │            certbot renew, around day 60
              │                      │
  in nginx  ──┴─ old cert ───────────┴──────────────┬─ new cert ─────
                                                    │
                                            nginx -s reload
                                      ^^^^^^^^^^^^^^
                                      thirty days of serving a certificate
                                      that has already been replaced, then
                                      a hard outage the moment it expires
```

You will not notice this gap. Everything looks fine right up to the day the old certificate
expires, at which point every browser and every API client hits a hard TLS error at once. Reload
is cheap and safe: nginx starts new workers with the new config and lets the old ones drain, so
in-flight requests are not dropped. Run it daily and stop thinking about it.

```bash
# crontab -e on the host. -T because cron has no TTY.
17 3 * * * cd /opt/dify/docker && docker compose exec -T nginx nginx -s reload
```

The textbook answer is a `--deploy-hook` on `certbot renew`, so the reload fires only when a
certificate actually changed. It does not work here. The hook runs inside the certbot
container, which has no docker CLI and cannot signal a process in the nginx container. You can
mount the docker socket into certbot to get around that, but giving a renewal side-car
root-equivalent control of the host daemon is a worse trade than one unconditional reload a
day.

Rehearse the whole renewal without spending a rate-limit slot:

```bash
docker compose exec certbot certbot renew --dry-run
docker compose exec certbot certbot certificates   # what is on disk, and expiry
```

### Why this is getting stricter, not looser

Certificate lifetimes are shrinking across the whole industry. The CA/Browser Forum has agreed a
schedule that steps the maximum public certificate lifetime down over the next few years, and
Let's Encrypt has been rolling out an optional profile for very short certificates measured in
days rather than months. The direction of travel is one way.

The practical reading for you: a renewal process that depends on a human remembering is already
obsolete and will simply stop working. If the loop plus the daily reload above is running,
shorter lifetimes cost you nothing. If you renew by hand, every reduction makes your life worse.
Automate it now while ninety days still gives you room to fix mistakes.

---

## 9. When port 80 is not an option

HTTP-01 needs inbound port 80. Some networks will not give you that, and it cannot prove
control of a wildcard like `*.example.com`. The alternative is DNS-01: instead of serving a
file, Certbot writes a `TXT` record into your DNS zone and the CA looks it up.

```
  HTTP-01                          DNS-01
  ───────                          ──────
  needs inbound :80                needs a DNS provider API token
  no wildcards                     wildcards work
  no extra credentials             token can edit your zone, so scope it
  works with any DNS host          needs a supported provider plugin
```

That trade is real: a DNS API token that can edit your zone is a more dangerous secret than an
open port 80. Use a provider that supports scoped tokens, and scope it to the one zone.

The other honest answer, and the one I reach for on anything with more than one service on the
box: do not terminate TLS in Dify's nginx at all. Put Caddy, Traefik, or a managed load balancer
in front, let it own certificates for everything, and point it at Dify over the internal network
with `NGINX_HTTPS_ENABLED=false`. One certificate story for the whole host beats one per stack.
The setup in this post is the right choice when Dify is the only thing on the machine.

---

## 10. What goes wrong

| Symptom | Cause and fix |
| --- | --- |
| `timeout during connect (likely firewall)` | Port 80 is not open to the internet, or DNS has not propagated. Re-run the preflight in section 2. |
| `too many failed authorizations` | You burned the rate limit retrying a broken config. Wait an hour, fix the cause, rehearse with `--test-cert`. |
| `Permission denied` on `/update-cert.sh` | The script lost its execute bit. Invoking it as `/bin/sh /update-cert.sh`, as above, sidesteps this. |
| Console spins forever, no server errors | The six URL variables disagree. Blank them all, or set all six to `https://`. See section 3. |
| Everything works except file previews | `FILES_URL` still points at `http://`. |
| `bind: address already in use: 0.0.0.0:80` | Apache or an old nginx owns port 80. `sudo ss -lptn 'sport = :80'` names the culprit. |
| nginx exits on start after enabling HTTPS | No pem files in the volume. The certificate was never issued. Check `docker compose logs certbot`. |
| Padlock fine in Chrome, errors in a curl or a mobile app | You are serving `cert.pem` instead of `fullchain.pem`, so the intermediate is missing. |

---

## The short version

* A certificate is an ID card for a domain. HTTP-01 proves you own the address by having the CA
  read a token that nginx serves over port 80.
* Verify DNS and port 80 from outside the server before you run Certbot. A `404` on the
  challenge path is the pass condition.
* Set the filenames and the domain in `docker/.env`, but leave `NGINX_HTTPS_ENABLED=false` until
  the certificate actually exists, or nginx will not start.
* Rehearse with `CERTBOT_OPTIONS=--test-cert`. Five failed validations cost you an hour, five
  re-issues of the same names cost you a week.
* Certbot renews on its own. Nginx does not notice. Add a daily `nginx -s reload` or you get a
  clean-looking system that fails hard on expiry day.
* Let's Encrypt stopped emailing expiry warnings in 2025, so add your own expiry check.
* If the six `*_URL` variables disagree about `http` and `https`, the console spins forever and
  the logs stay quiet.
* One service on the box: terminate TLS here. Several services: put Caddy or Traefik in front
  and give the whole host one certificate story.
