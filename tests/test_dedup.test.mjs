import test from 'node:test';
import assert from 'node:assert/strict';
import { PacketDeduplicator, isNewerPacketId } from '../src/services/dedup.ts';

test('TypeScript serial-number arithmetic handles normal and wraparound cases', () => {
  // Normal
  assert.equal(isNewerPacketId(2, 1), true);
  assert.equal(isNewerPacketId(100, 50), true);
  assert.equal(isNewerPacketId(1, 2), false);
  assert.equal(isNewerPacketId(5, 5), false);

  // Wraparound across 65535 -> 0
  assert.equal(isNewerPacketId(0, 65535), true);
  assert.equal(isNewerPacketId(1, 65535), true);
  assert.equal(isNewerPacketId(10, 65530), true);

  // Stale across wraparound boundary
  assert.equal(isNewerPacketId(65535, 0), false);
  assert.equal(isNewerPacketId(65530, 10), false);

  // Halfway boundary (32768)
  assert.equal(isNewerPacketId(32768, 0), false);
  assert.equal(isNewerPacketId(32767, 0), true);
});

test('TypeScript deduplicator rejects duplicates and stale packets', () => {
  const dedup = new PacketDeduplicator(60);
  const sender = 0x1234;
  const t0 = 1000000;

  // First packet accepted
  const res1 = dedup.processPacket(sender, 1, 10, t0);
  assert.equal(res1.accepted, true);
  assert.equal(res1.reason, 'ACCEPTED');

  // Duplicate rejected
  const res2 = dedup.processPacket(sender, 1, 10, t0 + 2000);
  assert.equal(res2.accepted, false);
  assert.equal(res2.reason, 'DUPLICATE');

  // Stale sequence rejected
  const resStale = dedup.processPacket(sender, 0, 10, t0 + 3000);
  assert.equal(resStale.accepted, false);
  assert.equal(resStale.reason, 'STALE_SEQUENCE');

  // Newer packet accepted
  const res3 = dedup.processPacket(sender, 2, 10, t0 + 4000);
  assert.equal(res3.accepted, true);
  assert.equal(res3.reason, 'ACCEPTED');
});

test('TypeScript deduplicator drops TTL <= 0 packets', () => {
  const dedup = new PacketDeduplicator(60);
  const sender = 0x9999;

  const res0 = dedup.processPacket(sender, 5, 0);
  assert.equal(res0.accepted, false);
  assert.equal(res0.reason, 'TTL_EXPIRED');

  const resNeg = dedup.processPacket(sender, 6, -5);
  assert.equal(resNeg.accepted, false);
  assert.equal(resNeg.reason, 'TTL_EXPIRED');
});
