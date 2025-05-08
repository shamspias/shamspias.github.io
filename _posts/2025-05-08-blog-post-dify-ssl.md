---
title: "Green Padlock, Zero Headache: Let’s Encrypt SSL for Self-Hosted Dify"
date: 2025-05-08
permalink: /posts/2025/05/dify-ssl-zero-to-green/
tags:
  - dify
  - SSL
  - Let's Encrypt
  - Docker
  - DevOps
  - self-hosting
  - beginner
math: false
---

*“Your app isn’t **production** until the padlock turns green.”*  
This guide merges the **one-liner speed** of the quick-start and the **step-by-step clarity** of the original long-form post.  
Follow along and you’ll mint fresh Let’s Encrypt certificates, wire them into Dify’s Nginx, and set-and-forget auto-renewal—all in **~15 minutes**.

---

## 0 Why bother?

| ✅ Win | 🚀 Why it matters |
|-------|-------------------|
| **End-to-end encryption** | Keep chat sessions & API calls private. |
| **Browser trust** | No more red “Not secure” labels. |
| **Free & automated** | Let’s Encrypt renews every 60–90 days without a credit-card or cron anxiety. |

---

## 1 Prerequisites

* **Domain** – `A`/`AAAA` record → your server  
* **Ports** – 80 & 443 open on firewall/cloud SG  
* **Docker** – v24 + Compose v2 (`docker compose version`)  
* **Dify repo** – `git clone https://github.com/langgenius/dify.git && cd dify/docker`

---

## 2 Patch `.env` (tell Dify who it is)

```bash
# --- SSL filenames Nginx expects
NGINX_SSL_CERT_FILENAME=fullchain.pem
NGINX_SSL_CERT_KEY_FILENAME=privkey.pem

# --- Let Certbot answer ACME challenges
NGINX_ENABLE_CERTBOT_CHALLENGE=true

# --- Your domain + a real e-mail
CERTBOT_DOMAIN=dify.example.com
CERTBOT_EMAIL=ops@example.com

# --- Leave this OFF until the cert exists
NGINX_HTTPS_ENABLED=false
````

> **Got multiple sub-domains?**
> Add `APP_WEB_URL`, `APP_API_URL`, `CONSOLE_WEB_URL`, and `CONSOLE_API_URL`, each with `https://…` so Dify’s front-end matches its back-end once HTTPS is live.

---

## 3 (Tidy-up) Prune stray Docker networks

Old bridges sometimes clash with the Certbot profile.

```bash
docker network prune        # hit y when asked
```

---

## 4 Launch the stack **with** the Certbot profile

```bash
docker compose --profile certbot up --force-recreate -d
```

| Flag                | Why we need it                                       |
| ------------------- | ---------------------------------------------------- |
| `--profile certbot` | Starts *nginx* + *certbot* side-cars.                |
| `--force-recreate`  | Rebuild nginx so it mounts the Let’s Encrypt volume. |
| `-d`                | Runs in the background (detached).                   |

---

## 5 Run Certbot inside its container

```bash
docker compose exec -it certbot /bin/sh /update-cert.sh
```

What just happened?

1. Certbot spins a micro webroot on **:80**.
2. Let’s Encrypt validates `dify.example.com`.
3. Keys drop into `volumes/certbot/conf/live/dify.example.com/`.

Expect the triumphant:

```
Congratulations! Your certificate and chain have been saved at:
  /etc/letsencrypt/live/dify.example.com/fullchain.pem
```

---

## 6 Flip the HTTPS switch

```bash
# in docker/.env
NGINX_HTTPS_ENABLED=true
```

---

## 7 Recreate **only** nginx (fast restart)

```bash
docker compose --profile certbot up -d --no-deps --force-recreate nginx
```

Nginx boots, finds `fullchain.pem` & `privkey.pem`, and starts serving **443**.

---

## 8 Verify the green padlock

```
https://dify.example.com
```

You should see:

* 🔒 Green padlock
* Auto-redirect from `http://` → `https://`

---

## 9 Renewal in two commands (bookmark this)

Let’s Encrypt certs last 90 days. Certbot’s built-in cron renews them, but here’s the manual drill:

```bash
# 1. Force renew (safe to run anytime)
docker compose exec -it certbot /bin/sh /update-cert.sh

# 2. Hot-reload nginx to pick up the new files
docker compose exec nginx nginx -s reload
```

---

## 10 Troubleshooting cheat-sheet

| 🛠️ Symptom                                    | 💡 Fix                                                                              |
| ---------------------------------------------- | ----------------------------------------------------------------------------------- |
| **`timeout during connect (likely firewall)`** | Port 80 closed or DNS not propagated.                                               |
| **`Permission denied` on `/update-cert.sh`**   | Script lost its +x bit—`chmod +x /update-cert.sh` inside the image or rebuild.      |
| **Infinite “Loading…” UI**                     | All five `*_WEB_URL` / `*_API_URL` env vars **must** match the new `https://…` URL. |
| **`bind: address already in use: 0.0.0.0:80`** | Another web server running—stop Apache/old Nginx or change Compose ports.           |

---

## 11 Recap (copy-paste edition)

```bash
# 0  clone repo & cd dify/docker
# 1  edit .env  → domain, e-mail, filenames
# 2  docker network prune
# 3  docker compose --profile certbot up --force-recreate -d
# 4  docker compose exec -it certbot /bin/sh /update-cert.sh
# 5  set NGINX_HTTPS_ENABLED=true in .env
# 6  docker compose --profile certbot up -d --no-deps --force-recreate nginx
```

Fifteen minutes, one free cert, **zero recurring fees**—your Dify instance is officially production-grade.

Happy shipping!
