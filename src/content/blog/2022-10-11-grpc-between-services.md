---
title: "gRPC: How Services Talk When the Client Is Another Server"
seoTitle: "gRPC Between Services, Explained"
description: "REST is built for the browser. When both ends are your own servers, a typed binary contract with generated code is often faster and safer. That is gRPC."
date: 2022-10-11
permalink: "/posts/2022/10/grpc-between-services/"
lang: en
tags:
  - "backend"
  - "grpc"
  - "microservices"
  - "protobuf"
series: "Building Backends"
seriesOrder: 7
math: false
---

*A [REST API](/posts/2021/06/rest-api-that-ages-well/) is built for a world where the client is a browser or an app you do not control: human-readable, text-based, forgiving. When both ends of the conversation are your own servers, that forgiveness costs you speed and safety you do not need to give up. gRPC is the alternative built for service-to-service communication: a strict, typed contract, a compact binary format, and generated code on both sides. This post is what it is, when it beats REST, and the real reasons not to use it.*

## 1. The problem: internal calls do not need to be human-readable

Picture a system split into services: an orders service calls an inventory service, which calls a pricing service. These are your own servers, talking to each other thousands of times a second, in machine-to-machine calls that no human ever reads.

Using REST with JSON for those internal calls works, and it leaves value on the table. JSON is text, so it is larger on the wire and slower to parse than it needs to be. And REST's contract is a document you hope both sides honour; nothing stops the orders service from sending a field the inventory service does not expect, and you find out at runtime. For high-volume internal traffic, you would like the messages smaller, the parsing faster, and the contract enforced. That is what gRPC provides.

## 2. What gRPC is, in three parts

gRPC is three ideas working together.

**A contract in Protocol Buffers (protobuf).** You write the service and its messages in a `.proto` file, a strict schema. This is the contract, and it is the source of truth for both sides:

```protobuf
service Inventory {
  rpc CheckStock (StockRequest) returns (StockReply);
}

message StockRequest {
  string sku = 1;
  int32 quantity = 2;
}

message StockReply {
  bool available = 1;
  int32 in_stock = 2;
}
```

**Generated code on both sides.** From that `.proto`, a code generator produces client and server code in whatever languages you use, Python, Go, Java, so calling `CheckStock` on a remote service looks like calling a local, typed function. You do not hand-write request serialisation or URL building; the generated stub does it, and the types are checked at compile time. If you change the contract, the code that uses it stops compiling until you update it, which is exactly the early warning REST does not give you.

**A compact binary format over HTTP/2.** The messages travel as binary protobuf, which is much smaller and faster to parse than JSON, over HTTP/2, which multiplexes many calls over one connection and supports streaming. The result is genuinely lower latency and higher throughput than JSON-over-HTTP for the same traffic.

```
  REST/JSON:   {"sku":"ABC-1","quantity":2}   text, parsed as text
  gRPC/proto:  <compact binary>               smaller, parsed by field
```

## 3. The feature REST cannot easily match: streaming

Because gRPC is built on HTTP/2, it supports streaming natively, in four shapes, and this is a real capability beyond what plain REST offers:

- **Unary**: one request, one response. The ordinary call, like REST.
- **Server streaming**: one request, a stream of responses. The client asks once and the server sends many messages, a live feed of results.
- **Client streaming**: a stream of requests, one response. The client sends many messages and the server replies once, uploading a series of readings.
- **Bidirectional streaming**: both stream at once, a continuous two-way conversation, similar in spirit to a [WebSocket](/posts/2022/02/real-time-polling-websocket-webrtc/) but typed and between services.

For service-to-service patterns like "subscribe to a stream of events" or "send a batch and get incremental results", this is cleaner than bolting streaming onto REST.

## 4. gRPC or REST: the honest split

They are not competitors so much as tools for different audiences. The dividing line is who is on the other end.

**Use REST when** the client is a browser, a mobile app, a third party, or the public. REST is human-readable, works natively everywhere, is trivial to debug with `curl`, and does not require your consumers to adopt your tooling. A public API should almost always be REST (or GraphQL), never gRPC, because you cannot ask the whole internet to speak protobuf.

**Use gRPC when** both ends are internal services you control, the traffic is high-volume, you want a strictly enforced typed contract, you have many languages that need to share definitions, or you need streaming. This is the microservices interior: your own services talking to your own services.

```
  browser / mobile / public / third party   ->  REST (or GraphQL)
  your service  <-->  your service, internal  ->  gRPC
```

A very common and healthy architecture is exactly this split: REST at the edge, where the outside world and browsers connect, and gRPC in the interior, between your services. The edge speaks the universal language; the interior speaks the fast, typed one.

## 5. The real costs, so you choose with open eyes

gRPC is not free, and the downsides are the reason it is a specialised choice, not a default.

- **Not natively browser-friendly.** Browsers cannot speak raw gRPC directly, so serving a browser needs a translation layer (gRPC-Web plus a proxy). This alone rules it out for most public and front-end use.
- **Harder to debug and inspect.** The binary format means you cannot just read the traffic or poke it with `curl`; you need gRPC-aware tools. The typed contract is a benefit, the opacity of the wire is a cost.
- **More upfront machinery.** The `.proto` files, the code generation step in your build, the tooling, are real setup. For a small service or a simple internal call, plain JSON over HTTP may be the pragmatic choice despite being slower, because it is less to stand up and maintain.
- **Contract versioning still needs discipline.** protobuf is designed for safe evolution, adding a new field is compatible, and field numbers must never be reused, but you still have to follow the rules, the same additive-is-safe discipline as [REST versioning](/posts/2021/06/rest-api-that-ages-well/).

## 6. The decision, and the middle ground

The one-line guidance: **gRPC for high-volume, typed, internal service-to-service traffic; REST for the browser, the public, and anything that must be easy to consume and debug.** If both ends are yours and speed and a strict contract matter, gRPC earns its complexity. If either end is not yours, or simplicity matters more than raw throughput, REST wins.

And a note on the middle ground, since it comes up: GraphQL sits in a different spot again, giving clients (often front-ends) precise control over which fields they fetch, which solves the "REST endpoint returns too much or too little" problem, at the cost of its own complexity on the server. It is neither a gRPC replacement nor a REST replacement, but a third option for the specific case of a rich front-end that wants to shape its own queries. The three are not a ladder; they are tools for three different relationships between client and server.

## The short version

- REST with JSON is built for browsers and the public: human-readable, universal, forgiving. For high-volume internal calls between your own servers, that forgiveness costs speed and a contract nothing enforces.
- gRPC is three ideas: a strict contract in a `.proto` file, generated typed client and server code so a remote call looks local and breaks at compile time when the contract changes, and a compact binary format over HTTP/2 that is smaller and faster than JSON.
- Because it rides on HTTP/2, gRPC does streaming natively in four shapes (unary, server, client, bidirectional), which is cleaner than bolting streaming onto REST.
- The split is by audience: REST (or GraphQL) for browsers, mobile, third parties, and the public; gRPC for internal, high-volume, typed, multi-language service-to-service traffic. A healthy pattern is REST at the edge, gRPC in the interior.
- The costs are real: not browser-native (needs a proxy), hard to inspect without gRPC-aware tools, more build machinery, and versioning discipline you still have to keep. For a small internal call, plain JSON may be the pragmatic choice.
- GraphQL is a third tool for a rich front-end that wants to shape its own queries, not a replacement for either. The three fit three different client-server relationships.

Next: the best practices and small tricks that keep a backend boring, which is the highest compliment a backend can earn.
