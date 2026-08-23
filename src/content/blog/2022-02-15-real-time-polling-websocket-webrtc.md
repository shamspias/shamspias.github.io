---
title: "Real-Time: Polling, WebSocket, WebRTC, and What Is on the Wire"
seoTitle: "Real-Time: Polling to WebSocket to WebRTC"
description: "HTTP is a client asking and a server answering. Real-time is the server needing to speak first. Here is the ladder of ways to do that, and what to pick when."
date: 2022-02-15
permalink: "/posts/2022/02/real-time-polling-websocket-webrtc/"
lang: en
tags:
  - "backend"
  - "websocket"
  - "webrtc"
  - "networking"
series: "Building Backends"
seriesOrder: 6
math: false
---

*Ordinary HTTP is a conversation the client always starts: it asks, the server answers, the connection closes. Real-time features, chat, live dashboards, notifications, collaborative editing, video calls, break that shape, because the server needs to speak first, or the two ends need to talk continuously. This post is the ladder of techniques for that, from the crude to the specialised, what each costs, and enough about TCP, UDP, and packets to know why the top of the ladder exists.*

## 1. The problem: HTTP cannot push

In plain HTTP, the server cannot start a message. It can only answer a request. So if something happens on the server, a new chat message arrives, a price changes, that the client should know about, the server has no way to tell it. The client has to find out somehow, and the techniques below are increasingly good answers to "how does the client learn about something the server knows".

```
  normal HTTP:   client ---- request ---->  server
                 client <--- response ----  server
                 (connection closes; server can't speak again)

  the real-time problem: something happened on the server.
  how does the client hear about it, without polling at the right instant?
```

## 2. The ladder, rung by rung

**Polling.** The client asks, over and over, "anything new?" every few seconds. Simple, works everywhere, and wasteful: most requests return "nothing new", and you trade latency (how stale the data can be) against load (how often you ask). Fine for data that changes slowly and where a few seconds of staleness is acceptable, a dashboard that updates every thirty seconds. Bad for chat, where thirty seconds is unusable and one second is a request storm.

**Long polling.** The client asks "anything new?" and the server *holds the request open* until something happens, then answers, and the client immediately asks again. This gets you near-instant delivery over ordinary HTTP, at the cost of a held-open connection per client and some awkwardness. It was how real-time was done before better options, and it is still a reasonable fallback.

**Server-sent events (SSE).** A standard, one-directional stream: the client opens one long-lived HTTP connection, and the server pushes messages down it as they happen, for as long as it stays open. It is simple, it rides on plain HTTP, it reconnects automatically, and it is exactly right when the flow is one-way, server to client: notifications, a live feed, streaming a model's tokens to a UI. If the client does not need to send a stream back, SSE is often the simplest correct choice, and it is underused because people jump straight to WebSocket.

**WebSocket.** A genuine two-way, persistent connection. After an initial HTTP handshake that "upgrades" the connection, both ends can send messages to each other at any time, with low overhead per message. This is the workhorse of real-time: chat, collaborative editing, live multiplayer, anything where both sides talk continuously. It is section 3.

**WebRTC.** Peer-to-peer, built for real-time media (audio and video) and low-latency data, often directly between two browsers without routing through your server. It is a different beast for a different job: video calls and screen sharing. Section 4.

The ladder is roughly "increasing capability, increasing complexity". The engineering skill is stopping at the lowest rung that does the job, because each rung up costs you.

## 3. WebSocket: the two-way workhorse

A WebSocket starts as an HTTP request with an `Upgrade` header. If the server agrees, the same TCP connection is repurposed into a persistent, bidirectional channel, and from then on either end sends messages ("frames") whenever it likes.

```
  client: GET /ws   Upgrade: websocket        (looks like HTTP...)
  server: 101 Switching Protocols             (...then becomes a socket)

  now, over one open connection, for as long as it lives:
  client <===== messages both ways, any time =====> server
```

What WebSocket buys is exactly what polling lacks: instant, low-overhead, two-way communication. What it costs is real, and it is why you should not reach for it reflexively.

- **Persistent connections cost resources.** Each open WebSocket is a connection your server holds for the client's whole session. Ten thousand concurrent users is ten thousand held connections, which shapes how you deploy (you want an async server, [the I/O-bound case from part 2](/posts/2019/10/django-or-fastapi/)) and how you scale.
- **State and scaling get harder.** A WebSocket ties a client to one server instance. To broadcast a message to users spread across many instances, you need something between them, typically a Redis pub/sub or a message broker, so an event on one instance reaches clients on all of them. This is a real piece of architecture, not a detail.
- **You handle reconnection yourself.** Networks drop. A robust WebSocket client reconnects and re-syncs any missed messages, and you have to build that; unlike SSE, it is not automatic.

The rule: reach for WebSocket when you genuinely need *two-way*, continuous, low-latency communication. If the flow is one-way, SSE is simpler. If updates are infrequent, polling is simpler. WebSocket is the right tool for chat and collaboration and the wrong, heavier tool for a dashboard that updates every minute.

## 4. TCP, UDP, and why WebRTC is different

To understand WebRTC you need one layer down: how bytes actually move, which is packets over either TCP or UDP. This is the "socket" and "packet" layer.

Data crosses the network in **packets**, small chunks. Two protocols govern them, and they make opposite trade-offs:

- **TCP** is reliable and ordered. It guarantees every packet arrives, and in order, by acknowledging each and re-sending losses. HTTP and WebSocket ride on TCP. The cost is latency: a lost packet stalls everything behind it while it is re-sent (head-of-line blocking), because order is guaranteed.
- **UDP** is fast and unreliable. It fires packets and does not guarantee arrival or order. The cost is you may lose data; the benefit is no waiting, a late packet is simply skipped rather than blocking the rest.

```
  TCP: every packet arrives, in order, even if it means waiting.
       right for a file, a message, a web page. wrong for live video.

  UDP: packets may drop or arrive out of order, but never wait.
       right for live audio/video: a stale frame is useless anyway.
```

This is the key insight for media: **for live audio and video, a packet that arrives late is worthless.** You would rather drop a frame and stay live than pause the call to re-fetch a frame from a tenth of a second ago. So real-time media wants UDP's "fast and lossy", not TCP's "reliable and slow". WebSocket, being on TCP, is the wrong transport for a video call.

**WebRTC** is the answer: it is built on UDP, designed for peer-to-peer low-latency media, and it can connect two browsers *directly*, so the video does not route through your server at all (which saves you enormous bandwidth). It handles the hard parts of peer-to-peer, punching through firewalls and network address translation using helper servers (STUN to discover your address, TURN to relay when a direct connection is impossible), and encrypts the media.

The catch is that WebRTC is complex, and the part that is *not* peer-to-peer is the introduction: two peers cannot find each other without a **signalling** channel, a normal server (often a WebSocket) that passes the initial connection details between them before they connect directly. So a WebRTC app still needs a small server for signalling; the media then flows peer to peer. Reach for WebRTC when you need real-time audio, video, or the lowest-latency data channel, especially between users. Do not reach for it for anything a WebSocket handles, because its complexity is only worth it for media.

## 5. Choosing, in one table

| You need | Reach for |
|---|---|
| Slow-changing data, a little staleness is fine | Polling |
| Server-to-client stream, one direction | Server-sent events |
| Two-way, continuous, low latency (chat, collaboration) | WebSocket |
| Near-instant over plain HTTP, no WebSocket available | Long polling |
| Live audio, video, or lowest-latency peer data | WebRTC (with a signalling server) |
| Broadcast to clients across many server instances | WebSocket plus Redis pub/sub or a broker |

The meta-rule holds: **pick the lowest rung that meets the need.** A dashboard does not need WebSocket; a chat does not need WebRTC; a video call cannot use WebSocket for the media. Matching the tool to the actual communication shape, one-way or two, reliable or low-latency, is the whole decision.

## The short version

- Plain HTTP is client-asks, server-answers; the server cannot speak first. Real-time features need the server to push, or both ends to talk continuously, and the techniques are a ladder of answers.
- Polling asks repeatedly and trades staleness against load; fine for slow data, a request storm for chat. Long polling holds the request open for instant delivery over plain HTTP.
- Server-sent events are a simple one-way server-to-client stream over HTTP, with automatic reconnect. Underused: if the flow is one direction, SSE beats WebSocket.
- WebSocket is a persistent two-way connection after an HTTP upgrade, the workhorse for chat and collaboration. It costs held connections (want an async server), needs Redis pub/sub or a broker to broadcast across instances, and you build reconnection yourself.
- One layer down: TCP is reliable and ordered but stalls on loss; UDP is fast and lossy. For live media a late packet is worthless, so media wants UDP, which is why WebSocket (on TCP) is wrong for video.
- WebRTC is UDP-based peer-to-peer media, connecting browsers directly to save bandwidth, using STUN/TURN to traverse firewalls and a signalling server (often a WebSocket) for the introduction. Use it for audio, video, and lowest-latency data, and nothing a WebSocket already handles.
- Pick the lowest rung that meets the need: match the tool to the communication shape, one-way or two, reliable or low-latency.

Next: gRPC, and how services talk to each other when the client is another server, not a browser.
