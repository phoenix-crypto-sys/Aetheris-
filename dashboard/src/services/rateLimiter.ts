/**
 * Sliding-window rate limiter per sender_hash to mitigate packet flood attacks.
 * Configurable via constructor arguments or environment variables.
 */

export class IngestRateLimiter {
  private maxPackets: number;
  private windowMs: number;
  private history: Map<number, number[]> = new Map();

  constructor(maxPackets: number = 10, windowSeconds: number = 5.0) {
    const envMax = typeof process !== 'undefined' && process.env?.AETHERIS_RATE_LIMIT_MAX_PACKETS;
    const envWin = typeof process !== 'undefined' && process.env?.AETHERIS_RATE_LIMIT_WINDOW_SECS;

    this.maxPackets = envMax ? parseInt(envMax, 10) : maxPackets;
    this.windowMs = (envWin ? parseFloat(envWin) : windowSeconds) * 1000;
  }

  isAllowed(senderHash: number, currentTimeMs?: number): boolean {
    const now = currentTimeMs !== undefined ? currentTimeMs : Date.now();
    const windowStart = now - this.windowMs;

    let timestamps = this.history.get(senderHash) || [];
    // Filter timestamps within sliding window
    timestamps = timestamps.filter(t => t >= windowStart);

    if (timestamps.length >= this.maxPackets) {
      this.history.set(senderHash, timestamps);
      return false;
    }

    timestamps.push(now);
    this.history.set(senderHash, timestamps);
    return true;
  }

  reset(): void {
    this.history.clear();
  }
}

export const ingestRateLimiter = new IngestRateLimiter();
