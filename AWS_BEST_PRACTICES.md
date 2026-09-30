# AWS Best Practices for OpenAPI MCP Server

[← Back to main README](README.md)

This document outlines architectural and security best practices implemented in OpenAPI MCP Server.

## 1. Network Security & SSRF Protection

- **DNS Pinning**: All remote URLs are resolved prior to request execution. Outbound socket connections connect strictly to pinned IP addresses with the original `Host` header sent to prevent DNS rebinding attacks.
- **Private Network Blocking**: IP ranges belonging to RFC 1918 (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), loopback (`127.0.0.0/8`, `::1`), link-local (`169.254.0.0/16`), and AWS IMDS (`169.254.169.254`) are blocked by default.
- **Explicit Insecure HTTP Opt-in**: Plain HTTP is rejected unless `--allow-insecure-http` is explicitly declared.

## 2. HTTP Connection Pooling & Keep-Alive

- **Persistent Connection Management**: Uses reusable `http.Agent` and `https.Agent` connection pools.
- **Configurable Concurrency**:
  - `HTTP_MAX_CONNECTIONS` (default: 100): Maximum active concurrent sockets.
  - `HTTP_MAX_KEEPALIVE` (default: 20): Maximum idle sockets kept alive.
- **Timeouts**: All requests have strict 30s timeouts preventing hanging connections.

## 3. Resilience & Exponential Backoff

- **Tenacity / Jittered Exponential Backoff**: Transient errors (5xx server errors, 429 rate limits, socket timeouts) are automatically retried with randomized jitter to prevent thundering herds.
- **Fail-Fast Boundaries**: 4xx client errors (400, 401, 403, 404, 422) fail fast without redundant retry overhead.

## 4. Caching & Memory Protection

- **Spec Response Caching**: In-memory LRU caching with bounded entries and TTL expiration prevents duplicate downstream fetches.
- **Payload Size Capping**: Spec files and API responses exceeding 10 MiB are rejected immediately to protect against Denial of Service (DoS) memory exhaustion.
