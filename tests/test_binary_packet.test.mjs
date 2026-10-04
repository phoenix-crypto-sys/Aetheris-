import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  packBinaryPacket,
  unpackBinaryPacket,
  relayBinaryPacket,
  hashSender16,
  hashStringUint32,
  computeFletcher16,
} from '../src/services/binaryPacket.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const vectorPath = path.join(__dirname, 'test_vectors.json');
const vectors = JSON.parse(fs.readFileSync(vectorPath, 'utf-8'));

test('TypeScript loads shared test vectors and matches expected hex bytes', () => {
  for (const v of vectors) {
    const packed = packBinaryPacket({
      packetId: v.packet_id,
      priorityLevel: v.priority_level,
      latitude: v.latitude,
      longitude: v.longitude,
      batteryPct: v.battery_pct,
      senderId: v.sender_id,
      hopCount: v.hop_count,
      ttl: v.ttl,
    });

    assert.equal(packed.length, 18, `Length must be 18 for ${v.description}`);

    const hexString = Buffer.from(packed).toString('hex').toLowerCase();
    assert.equal(hexString, v.hex_string.toLowerCase(), `Hex string mismatch for ${v.description}`);

    const expectedHash = hashSender16(v.sender_id);
    assert.equal(expectedHash, v.sender_hash, `Sender hash mismatch for ${v.sender_id}`);

    const unpacked = unpackBinaryPacket(packed);
    assert.equal(unpacked.isValid, true);
    assert.equal(unpacked.packetId, v.packet_id);
    assert.equal(unpacked.priorityLevel, v.priority_level);
    assert.ok(Math.abs(unpacked.latitude - v.latitude) < 0.00001);
    assert.ok(Math.abs(unpacked.longitude - v.longitude) < 0.00001);
    assert.equal(unpacked.batteryPct, v.battery_pct);
    assert.equal(unpacked.hopCount, v.hop_count);
    assert.equal(unpacked.senderIdHash, v.sender_hash);
    assert.equal(unpacked.ttl, v.ttl);
  }
});

test('TypeScript verifies Fletcher-16 recomputed at every relay when HopCount and TTL change', () => {
  const initial = packBinaryPacket({
    packetId: 100,
    priorityLevel: 3,
    latitude: 37.7749,
    longitude: -122.4194,
    batteryPct: 90,
    senderId: 'Room 222 - Victim',
    hopCount: 0,
    ttl: 10,
  });

  const origDecoded = unpackBinaryPacket(initial);
  assert.equal(origDecoded.isValid, true);
  assert.equal(origDecoded.hopCount, 0);
  assert.equal(origDecoded.ttl, 10);

  // Relay 1
  const hop1 = relayBinaryPacket(initial);
  const hop1Decoded = unpackBinaryPacket(hop1);
  assert.equal(hop1Decoded.isValid, true);
  assert.equal(hop1Decoded.hopCount, 1);
  assert.equal(hop1Decoded.ttl, 9);
  assert.notEqual(origDecoded.checksum, hop1Decoded.checksum);

  // Relay 2
  const hop2 = relayBinaryPacket(hop1);
  const hop2Decoded = unpackBinaryPacket(hop2);
  assert.equal(hop2Decoded.isValid, true);
  assert.equal(hop2Decoded.hopCount, 2);
  assert.equal(hop2Decoded.ttl, 8);
});

test('TypeScript throws error on corrupted packet or expired TTL relay', () => {
  const normal = packBinaryPacket({
    packetId: 5,
    priorityLevel: 1,
    latitude: 10.0,
    longitude: 20.0,
    batteryPct: 50,
    senderId: 'Node-1',
    ttl: 1,
  });

  // TTL <= 1 must fail
  assert.throws(() => relayBinaryPacket(normal), /TTL expired/);

  // Checksum corruption must fail
  const corrupted = new Uint8Array(normal);
  corrupted[5] ^= 0xff;
  assert.throws(() => relayBinaryPacket(corrupted), /checksum mismatch/);
});
