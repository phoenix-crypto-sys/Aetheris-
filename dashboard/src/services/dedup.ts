/**
 * Layer 2: Packet Deduplication & Serial-Number Wraparound Tracking (Dashboard Service Copy)
 */

export function isNewerPacketId(a: number, b: number): boolean {
  if (a === b) return false;
  const diff = (a - b) % 65536;
  const normalizedDiff = diff < 0 ? diff + 65536 : diff;
  return normalizedDiff < 32768;
}

export class PacketDeduplicator {
  public cacheTtlMs: number;
  private cache: Map<string, number> = new Map();
  private latestPacketIds: Map<number, number> = new Map();

  constructor(cacheTtlSeconds = 60) {
    this.cacheTtlMs = cacheTtlSeconds * 1000;
  }

  public purgeExpired(currentTimeMs?: number): number {
    const now = currentTimeMs ?? Date.now();
    let purged = 0;
    this.cache.forEach((exp, key) => {
      if (exp <= now) {
        this.cache.delete(key);
        purged++;
      }
    });
    return purged;
  }

  public processPacket(
    senderHash: number,
    packetId: number,
    ttl: number,
    currentTimeMs?: number
  ): { accepted: boolean; reason: 'ACCEPTED' | 'TTL_EXPIRED' | 'DUPLICATE' | 'STALE_SEQUENCE' } {
    const now = currentTimeMs ?? Date.now();
    this.purgeExpired(now);

    // 1. Drop packets with TTL <= 0
    if (ttl <= 0) {
      return { accepted: false, reason: 'TTL_EXPIRED' };
    }

    const sHash = senderHash & 0xFFFF;
    const pId = packetId & 0xFFFF;
    const cacheKey = `${sHash}:${pId}`;

    // 2. Duplicate check
    const existingExpiry = this.cache.get(cacheKey);
    if (existingExpiry && existingExpiry > now) {
      return { accepted: false, reason: 'DUPLICATE' };
    }

    // 3. Serial-number sequence comparison
    if (this.latestPacketIds.has(sHash)) {
      const lastId = this.latestPacketIds.get(sHash)!;
      if (!isNewerPacketId(pId, lastId)) {
        return { accepted: false, reason: 'STALE_SEQUENCE' };
      }
    }

    // 4. Accept & record
    this.cache.set(cacheKey, now + this.cacheTtlMs);
    this.latestPacketIds.set(sHash, pId);
    return { accepted: true, reason: 'ACCEPTED' };
  }

  public clear(): void {
    this.cache.clear();
    this.latestPacketIds.clear();
  }
}

export const packetDeduplicator = new PacketDeduplicator();
