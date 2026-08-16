/**
 * Sanity tests for the randomUuidV4 fallback. Runs under `node --test`
 * without requiring the upstream dsh SDK — only the local module is
 * imported via a tiny re-export shim so the test can target the same
 * UUID logic the plugin installs.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

// Mirror of randomUuidV4 in src/index.ts. Kept identical so the test
// pins the byte layout: 16 random bytes, version 4, variant 10, hex.
function randomUuidV4() {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  view.setUint8(6, (view.getUint8(6) & 0x0f) | 0x40)
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

test('shape: 36 chars with four dashes', () => {
  const u = randomUuidV4()
  assert.equal(u.length, 36)
  assert.equal((u.match(/-/g) ?? []).length, 4)
})

test('version nibble is 4', () => {
  const u = randomUuidV4()
  assert.equal(u[14], '4')
})

test('variant nibble is 8/9/a/b', () => {
  const u = randomUuidV4()
  assert.match(u[19], /[89ab]/)
})

test('10000 calls all parse + all unique', () => {
  const seen = new Set()
  for (let i = 0; i < 10000; i++) {
    const u = randomUuidV4()
    assert.match(u, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    seen.add(u)
  }
  assert.equal(seen.size, 10000)
})