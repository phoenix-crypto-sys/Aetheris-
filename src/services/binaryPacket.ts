/**
 * Aetheris 18-Byte Compact Binary Struct & BLE Manufacturer Data Packing Library
 * 
 * 18-Byte Big-Endian Wire Layout:
 * [0..1]   PacketID (uint16 big-endian)
 * [2]      PriorityLevel (uint8: 0=Heartbeat, 1=Low, 2=Med, 3=Critical SOS)
 * [3..6]   Latitude (int32 big-endian, scaled by 1e6)
 * [7..10]  Longitude (int32 big-endian, scaled by 1e6)
 * [11]     BatteryPct (uint8: 0-100)
 * [12]     HopCount (uint8: 0-255, incremented at each relay hop)
 * [13..14] SenderHash (uint16 big-endian, 32-bit FNV-1a truncated to 16 bits)
 * [15]     TTL (uint8: 0-255, decremented at each relay hop)
 * [16..17] Fletcher-16 Checksum (uint16 big-endian, calculated over bytes 0..15;
 *          recomputed at each relay hop when HopCount and TTL change)
 */

export interface DecodedPacketData {
  packetId: number;
  priorityLevel: number;
  priorityLabel: 'critical' | 'high' | 'medium' | 'low';
  latitude: number;
  longitude: number;
  batteryPct: number;
  hopCount: number;
  senderIdHash: number;
  senderIdHash32: number;
  customSenderName?: string;
  ttl: number;
  checksum: number;
  isValid: boolean;
  hexDump: string;
}

/**
 * Fletcher-16 Checksum calculation over `length` bytes.
 * Returns big-endian uint16: (sum2 << 8) | sum1
 */
export function computeFletcher16(data: Uint8Array, length: number): number {
  let sum1 = 0;
  let sum2 = 0;
  for (let i = 0; i < length; i++) {
    sum1 = (sum1 + data[i]) % 255;
    sum2 = (sum2 + sum1) % 255;
  }
  return (sum2 << 8) | sum1;
}

export function hashStringUint16(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash = hash & 0xFFFF;
  }
  return hash;
}

/**
 * 32-bit FNV-1a hash converter for sender identity string
 */
export function hashStringUint32(str: string): number {
  let hash = 0x811c9dc5; // FNV 32-bit offset basis (2166136261)
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193); // FNV 32-bit prime (16777619)
  }
  return hash >>> 0; // Return unsigned 32-bit integer
}

/**
 * Sender hash: 32-bit FNV-1a truncated to 16 bits for the wire payload.
 */
export function hashSender16(str: string): number {
  return hashStringUint32(str) & 0xFFFF;
}

/**
 * Embeds up to 10 characters of custom sender name string into fixed BLE manufacturer-specific data payload (14 bytes)
 * Layout: [0..3] 32-bit FNV-1a Hash (uint32) + [4..13] 10-Byte ASCII String
 */
export function encodeCustomSenderNameBytes(customName: string): Uint8Array {
  const payload = new Uint8Array(14);
  const view = new DataView(payload.buffer);
  
  // 1. 32-bit FNV-1a Hash
  const hash32 = hashStringUint32(customName);
  view.setUint32(0, hash32, false); // Big-endian

  // 2. Embed first 10 characters as ASCII bytes
  const trimmed = customName.trim().slice(0, 10);
  for (let i = 0; i < 10; i++) {
    payload[4 + i] = i < trimmed.length ? trimmed.charCodeAt(i) : 32; // Space pad
  }

  return payload;
}

export function decodeCustomSenderNameBytes(payload: Uint8Array): { hash32: number; customSenderName: string } {
  if (payload.length < 14) {
    return { hash32: 0, customSenderName: 'Rescue Unit 1' };
  }
  const view = new DataView(payload.buffer, payload.byteOffset, 14);
  const hash32 = view.getUint32(0, false);
  
  let asciiStr = '';
  for (let i = 4; i < 14; i++) {
    const charCode = payload[i];
    if (charCode > 31 && charCode < 127) {
      asciiStr += String.fromCharCode(charCode);
    }
  }

  return {
    hash32,
    customSenderName: asciiStr.trim() || 'Rescue Unit 1',
  };
}

export function packBinaryPacket(params: {
  packetId: number;
  priorityLevel: number; // 0..3
  latitude: number;
  longitude: number;
  batteryPct: number;
  hopCount?: number;
  senderId?: string;
  senderHash?: number;
  customSenderName?: string;
  ttl?: number;
}): Uint8Array {
  const buffer = new ArrayBuffer(18);
  const view = new DataView(buffer);
  const uint8 = new Uint8Array(buffer);

  // 1. Packet ID (2 bytes, big-endian)
  view.setUint16(0, params.packetId & 0xFFFF, false);

  // 2. Priority Level (1 byte)
  view.setUint8(2, Math.min(3, Math.max(0, params.priorityLevel)));

  // 3. Latitude scaled by 1e6 (4 bytes signed int, big-endian)
  const scaledLat = Math.round(params.latitude * 1e6);
  view.setInt32(3, scaledLat, false);

  // 4. Longitude scaled by 1e6 (4 bytes signed int, big-endian)
  const scaledLng = Math.round(params.longitude * 1e6);
  view.setInt32(7, scaledLng, false);

  // 5. Battery Pct (1 byte)
  view.setUint8(11, Math.min(100, Math.max(0, Math.round(params.batteryPct))));

  // 6. Hop count (1 byte)
  view.setUint8(12, Math.min(255, params.hopCount ?? 0));

  // 7. Sender ID Hash (2 bytes uint16: 32-bit FNV-1a truncated to 16 bits)
  const effectiveName = params.customSenderName || params.senderId || '';
  const sHash = params.senderHash !== undefined ? (params.senderHash & 0xFFFF) : hashSender16(effectiveName);
  view.setUint16(13, sHash, false);

  // 8. TTL (1 byte)
  view.setUint8(15, Math.min(255, params.ttl ?? 24));

  // 9. Calculate Fletcher-16 Checksum over bytes 0..15 (big-endian)
  const checksum = computeFletcher16(uint8, 16);
  view.setUint16(16, checksum, false);

  return uint8;
}

export function unpackBinaryPacket(buffer: Uint8Array | ArrayBuffer): DecodedPacketData {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (bytes.length < 18) {
    throw new Error(`Invalid packet length: ${bytes.length} bytes (expected 18 bytes)`);
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, 18);

  const packetId = view.getUint16(0, false);
  const priorityLevel = view.getUint8(2);
  const scaledLat = view.getInt32(3, false);
  const scaledLng = view.getInt32(7, false);
  const batteryPct = view.getUint8(11);
  const hopCount = view.getUint8(12);
  const senderIdHash = view.getUint16(13, false);
  const ttl = view.getUint8(15);
  const checksum = view.getUint16(16, false);

  // Verify checksum: recomputed over bytes 0..15
  const computedCheck = computeFletcher16(bytes, 16);
  const isValid = checksum === computedCheck;

  const priorityLabels: ('low' | 'medium' | 'high' | 'critical')[] = ['low', 'medium', 'high', 'critical'];
  const priorityLabel = priorityLabels[Math.min(3, Math.max(0, priorityLevel))] || 'low';

  const hexDump = Array.from(bytes.slice(0, 18))
    .map(b => b.toString(16).padStart(2, '0').toUpperCase())
    .join(' ');

  return {
    packetId,
    priorityLevel,
    priorityLabel,
    latitude: Math.round(scaledLat) / 1e6,
    longitude: Math.round(scaledLng) / 1e6,
    batteryPct,
    hopCount,
    senderIdHash,
    senderIdHash32: senderIdHash,
    ttl,
    checksum,
    isValid,
    hexDump,
  };
}

/**
 * Relays an 18-byte binary packet across an intermediate mesh node:
 * - Verifies Fletcher-16 checksum
 * - Drops packet if TTL <= 1
 * - Increments HopCount (capped at 255)
 * - Decrements TTL
 * - Recomputes Fletcher-16 checksum over bytes 0..15
 */
export function relayBinaryPacket(packetBytes: Uint8Array): Uint8Array {
  const bytes = new Uint8Array(packetBytes.slice(0, 18));
  if (bytes.length < 18) {
    throw new Error(`Packet too short to relay: ${bytes.length} bytes (expected 18)`);
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, 18);
  const incomingChecksum = view.getUint16(16, false);
  const expectedChecksum = computeFletcher16(bytes, 16);
  if (incomingChecksum !== expectedChecksum) {
    throw new Error('Cannot relay corrupted packet: Fletcher-16 checksum mismatch');
  }

  const currentTtl = view.getUint8(15);
  if (currentTtl <= 1) {
    throw new Error(`Packet TTL expired (TTL=${currentTtl})`);
  }

  const currentHops = view.getUint8(12);
  view.setUint8(12, Math.min(255, currentHops + 1));
  view.setUint8(15, currentTtl - 1);

  // Recompute Fletcher-16 checksum over updated 16-byte payload
  const newChecksum = computeFletcher16(bytes, 16);
  view.setUint16(16, newChecksum, false);

  return bytes;
}
