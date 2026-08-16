# LAN Access for `dsh web` (plugin version)

This doc is the long-form write-up for the LAN-access plugin published as [`@zynieie/dsh-lan-fix`](../packages/dsh-lan-fix/README.md). For the package install + verify steps, see that README.

> **TL;DR — what's different from upstream `dsh web`**
>
> | Change | File | Why |
> |---|---|---|
> | `AbstractApiClient.mintRpcId()` falls back when `crypto.randomUUID` is unavailable | `packages/dsh-lan-fix/src/index.ts` | Fixes silent WebSocket abort storm when the SPA loads over HTTP (insecure context) instead of HTTPS / localhost |
> | Same fallback inline in `mintRpcId` | (same file) | Keeps the contract identical to `crypto.randomUUID` — v4 UUIDs either way |

The diff is intentionally minimal: **one method, monkey-patched from a Cordis plugin**. No CLI flags, no new dependencies, no behavioral changes on `127.0.0.1`.

---

## What problem this solves

`dsh web` binds to `127.0.0.1:3080` by default. Even when you launch it with `--host 0.0.0.0`, the SPA loads `AbstractApiClient.mintRpcId()` from `@deepseek-ai/dsh-host-apiproxy/client`. That helper calls `crypto.randomUUID()` directly. In a browser:

- On **HTTPS** or **localhost**: `crypto.randomUUID` is available — fine.
- On **HTTP over a LAN IP** (e.g. `http://192.168.x.x:3080`): the page is an **insecure context**. `crypto.randomUUID` is `undefined` in some browsers and throws `TypeError: crypto.randomUUID is not a function` in others.

When the SPA starts, it calls `host.describe({})` (the very first RPC). `mintRpcId()` throws synchronously inside that call. The catch block in the connection layer calls `ac.abort()`. The WebSocket was still in `CONNECTING`, so the browser fires `WebSocket is closed before connection is established`. Retry backoff kicks in (500 ms → 10 s) and the page sits at a blank screen forever.

This plugin adds a one-line fallback: if `crypto.randomUUID` is missing, use `crypto.getRandomValues` to mint a v4 UUID. Both routes produce statistically indistinguishable RFC 4122 v4 UUIDs, so RPC id validation is unaffected.

---

## What it looks like

A phone on the same WiFi opening `http://<lan-ip>:3080/` shows the same Web UI as the PC browser — full session list, full chat history, full tool palette. No app to install.

![Phone accessing dsh web on the LAN](images/lan-phone-screenshot.jpg)

*Real capture: phone browser at `http://<lan-ip>:3080/`, same dsh web session visible on the PC's `http://127.0.0.1:3080/`.*

---

## Verifying the fix

Three layers, outside-in. Pick any one; you only need ONE positive result.

### Layer 1 — HTTP path (cheapest)

```sh
curl --noproxy '*' http://127.0.0.1:3080/ | sha256sum
curl --noproxy '*' http://<lan-ip>:3080/   | sha256sum
# Both SHA256 sums MUST match — same HTML bytes, regardless of source.
```

### Layer 2 — RPC path (the real proof)

```sh
curl --noproxy '*' -X POST http://<lan-ip>:3080/api/host.describe \
  -H 'Content-Type: application/json' \
  -d '{"type":"client-request","rpcId":"verify-1","method":"host.describe","payload":{}}'
```

Expect a 200 with `result.value` containing `version`, `cwd`, `provider`, `model`. If `mintRpcId` is broken, this fetch never reaches `doFetch` — you'll see 0 successful POSTs in 30 seconds, not 1.

### Layer 3 — WebSocket long-lived

In the dsh stderr log, look for `[WSLOG]` / `[UPGRADE_CB]` (if you enabled those in your build). On a working plugin:

- `events.mux` upgraded → `readyState=1` → no `[UPGRADE_CLOSE]` for minutes
- `events.host` upgraded → same

The "stuck in retry storm" symptom is `[UPGRADE_CB]` immediately followed by `[UPGRADE_CLOSE] code=1006 reason=` every 500 ms.

---

## Security considerations

`trustedHosts=["*"]` (the configuration that lets LAN clients through) is **equivalent to disabling the trust fence**. Anyone on the LAN with the URL can:

- Spawn shells via the bash tool
- Read files under the dsh working directory
- Call any host-side API exposed via the proxy

**Mitigations for LAN deployment:**

| Environment | Recommendation |
|---|---|
| Home WiFi | Acceptable. The Web UI has no auth, but you trust your household. |
| Coffee shop / co-working | Use a VPN (Tailscale, WireGuard). Don't bind `0.0.0.0` on untrusted networks. |
| Public WiFi | Never. Use `127.0.0.1` only, or put a reverse proxy with auth in front. |
| Server (homelab / VPS) | Bind `127.0.0.1` and front with nginx + TLS + basic auth. Do not use the LAN mode here. |

The minimal upstream check (host header matches `127.0.0.1` or `0.0.0.0`) is still active with this plugin. The fallback is purely client-side.

---

## Why the upstream change is minimal

The deepseek-ai monorepo already contains `packages/client/connection/src/client/random-uuid.ts` with a `getRandomValues`-based fallback. `rpc.ts` calls `randomUuid()`. The mismatch is that `AbstractApiClient.mintRpcId()` was never switched over. This plugin finishes that internal consistency **from outside**, by patching the prototype at plugin-load time.

**One file (`src/index.ts`), one monkey-patch.** No new packages. No API changes. No migrations. No `dsh` source edits.

---

## Reverting

Uninstall the plugin (remove the symlink / `pnpm remove @zynieie/dsh-lan-fix`). Behavior returns to "works on 127.0.0.1 only, breaks on LAN HTTP". The plugin does not touch persistent state.

---

## Compatibility

- **dsh version**: tracks `0.1.0-rc.5+` (the npm rc line that introduced `AbstractApiClient.mintRpcId` in this shape).
- **Node**: ≥ 22.19 or ≥ 24 (per upstream `engines`).
- **Browsers**: any browser that supports `crypto.getRandomValues` — every browser shipped since 2014.

The fallback is invisible to secure-context callers (`crypto.randomUUID` is preferred when available). HTTPS / localhost behavior is byte-identical to upstream.