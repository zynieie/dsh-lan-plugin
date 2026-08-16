/**
 * @zynieie/dsh-lan-fix — runtime monkey-patch for AbstractApiClient.mintRpcId.
 *
 * `crypto.randomUUID()` is a Web API that requires a secure context
 * (HTTPS or localhost). When the dsh Web SPA loads over HTTP on a LAN
 * IP (e.g. `http://192.168.x.x:3080`), the page is an insecure context
 * and `crypto.randomUUID` is undefined or throws `TypeError`.
 *
 * `AbstractApiClient.mintRpcId()` is called synchronously inside every
 * host-api call — the very first one is `host.describe({})` from the
 * SPA's startup. With the upstream implementation, that call throws
 * synchronously, the connection layer's catch block calls `ac.abort()`
 * while the WebSocket is still in `CONNECTING`, and the browser fires
 * `WebSocket is closed before connection is established`. Retry
 * backoff (500 ms → 10 s) fires forever — the SPA sits at a blank
 * screen.
 *
 * This plugin replaces `AbstractApiClient.prototype.mintRpcId` with a
 * `crypto.getRandomValues()`-based fallback that produces the same
 * RFC 4122 v4 UUID shape. On HTTPS / localhost the behaviour is
 * byte-identical to upstream (the `crypto.randomUUID` branch is
 * preferred when available).
 *
 * Mirrors the internal pattern already in upstream:
 * `packages/client/connection/src/client/random-uuid.ts` ships the
 * same `getRandomValues` fallback for the same reason. `rpc.ts` calls
 * `randomUuid()`. `AbstractApiClient.mintRpcId` is the one place that
 * missed the switchover — this plugin finishes it from outside.
 */

import type { Context } from '@deepseek-ai/cordis'

/** Stable Cordis plugin name (diagnostics label). */
export const name = '@zynieie/dsh-lan-fix'

/**
 * UUID v4 shape: xxxxxxxx-xxxx-Mxxx-Nxxx-xxxxxxxxxxxx
 *   M = 4 (version)
 *   N = 8/9/a/b (variant)
 * Crypto-strong, time-independent, monotonic counter-free.
 */
function randomUuidV4(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  // version 4
  view.setUint8(6, (view.getUint8(6) & 0x0f) | 0x40)
  // variant 10 (RFC 4122)
  view.setUint8(8, (view.getUint8(8) & 0x3f) | 0x80)
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return (
    hex.slice(0, 8) +
    '-' +
    hex.slice(8, 12) +
    '-' +
    hex.slice(12, 16) +
    '-' +
    hex.slice(16, 20) +
    '-' +
    hex.slice(20)
  )
}

/**
 * Patch `AbstractApiClient.prototype.mintRpcId` in place. Idempotent
 * (replaces the bound function regardless of its current value) so the
 * loader can mount this plugin more than once without stacking layers.
 */
async function install(): Promise<boolean> {
  // Late import: AbstractApiClient is exported from the client entry.
  // The web bundle instantiates the class lazily (first call -> first
  // instance), so as long as the patch lands before that first call,
  // every subclass — WebApiClient, FixtureApiClient, InProcessApiClient —
  // inherits the fallback through the prototype chain.
  const mod: { AbstractApiClient?: { prototype: Record<string, unknown> } } =
    await import('@deepseek-ai/dsh-host-apiproxy/client')
  const Ctor = mod.AbstractApiClient
  if (Ctor === undefined || Ctor.prototype === undefined) {
    console.warn('[dsh-lan-fix] AbstractApiClient not exported — patch skipped')
    return false
  }
  Ctor.prototype.mintRpcId = function (): string {
    const c = globalThis.crypto
    if (c !== undefined && typeof c.randomUUID === 'function') {
      return c.randomUUID()
    }
    return randomUuidV4()
  }
  return true
}

/**
 * Cordis plugin entry. Runs `install()` once on mount. The patch is
 * in-place on the prototype, so unloading does not undo it — the next
 * AbstractApiClient instance constructed in this Node process will see
 * the fallback regardless. (The fallback is a strict superset of the
 * original behaviour, so leaving it in place is safe.)
 */
export async function apply(_ctx: Context): Promise<void> {
  await install()
}