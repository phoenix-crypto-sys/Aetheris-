import { AetherisPacket } from '../layer1_radio/types';

export interface StoredPacketItem {
  packet: AetherisPacket;
  storedTimestamp: number;
  expiryTimestamp: number;
}

/**
 * Layer 2: Store-and-Forward Queue
 * Persistent offline fallback queue with priority-scaled TTL.
 * CRITICAL CONSTRAINT: NEW elements MUST ALWAYS be appended to the END of arrays ([...prev, item])
 * to preserve strict chronological timeline.
 */
export class StoreAndForwardQueue {
  private queue: StoredPacketItem[] = [];

  constructor(initialQueue: StoredPacketItem[] = []) {
    this.queue = initialQueue;
  }

  /**
   * Get priority-scaled TTL in milliseconds
   */
  private getPriorityTtlMs(packet: AetherisPacket): number {
    if (packet.ttl && packet.ttl > 0) {
      return packet.ttl * 1000;
    }
    switch (packet.priority) {
      case 'critical':
        return 86400 * 1000; // 24 hours
      case 'high':
        return 43200 * 1000; // 12 hours
      case 'medium':
        return 14400 * 1000; // 4 hours
      case 'low':
      default:
        return 3600 * 1000; // 1 hour
    }
  }

  /**
   * Enqueue a new packet.
   * STRICT ORDERING RULE: Always append NEW elements to the END of array [...prev, item]
   */
  public enqueue(packet: AetherisPacket): void {
    const now = Date.now();
    const ttlMs = this.getPriorityTtlMs(packet);

    const newItem: StoredPacketItem = {
      packet,
      storedTimestamp: now,
      expiryTimestamp: now + ttlMs,
    };

    // STRICT APPEND RULE: [...prev, item]
    this.queue = [...this.queue, newItem];
    console.log(`[StoreAndForward] Enqueued packet '${packet.sender_id}' (${packet.priority}). Total stored: ${this.queue.length}`);
  }

  /**
   * Purge expired packets based on priority-scaled TTL
   */
  public purgeExpired(): number {
    const now = Date.now();
    const initialCount = this.queue.length;

    // Filter valid items while preserving relative chronological order
    this.queue = this.queue.filter((item) => item.expiryTimestamp > now);

    const purged = initialCount - this.queue.length;
    if (purged > 0) {
      console.log(`[StoreAndForward] Purged ${purged} expired packets from fallback queue.`);
    }
    return purged;
  }

  /**
   * Peek next packet to dispatch (oldest chronological valid packet)
   */
  public peekNext(): AetherisPacket | null {
    this.purgeExpired();
    if (this.queue.length === 0) return null;
    return this.queue[0].packet;
  }

  /**
   * Dequeue next packet for re-transmission when network connection recovers
   */
  public dequeue(): AetherisPacket | null {
    this.purgeExpired();
    if (this.queue.length === 0) return null;

    const [first, ...rest] = this.queue;
    this.queue = rest;
    return first.packet;
  }

  /**
   * Get all current stored items in chronological timeline order
   */
  public getChronologicalQueue(): StoredPacketItem[] {
    this.purgeExpired();
    return [...this.queue];
  }

  public getQueueLength(): number {
    this.purgeExpired();
    return this.queue.length;
  }
}
