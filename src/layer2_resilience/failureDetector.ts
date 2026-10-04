import { EdgePheromoneLink } from '../layer1_radio/types';

export interface PendingAckRecord {
  packetId: string;
  sourceId: string;
  targetId: string;
  sentTimestamp: number;
  timeoutMs: number;
}

/**
 * Layer 2: Failure Detection Module
 * Monitors unacknowledged packet transmissions. Missing ACKs trigger immediate
 * hard pheromone penalties on the failed edge link.
 */
export class FailureDetector {
  private pendingAcks: Map<string, PendingAckRecord> = new Map();
  private hardPenaltyFactor: number = 0.1; // Drops pheromone to 10% on missing ACK

  constructor(hardPenaltyFactor = 0.1) {
    this.hardPenaltyFactor = hardPenaltyFactor;
  }

  /**
   * Track sent packet expecting ACK
   */
  public trackSentPacket(packetId: string, sourceId: string, targetId: string, timeoutMs: number = 5000): void {
    this.pendingAcks.set(packetId, {
      packetId,
      sourceId,
      targetId,
      sentTimestamp: Date.now(),
      timeoutMs,
    });
  }

  /**
   * Register ACK received from recipient
   */
  public registerAck(packetId: string): boolean {
    if (this.pendingAcks.has(packetId)) {
      this.pendingAcks.delete(packetId);
      return true;
    }
    return false;
  }

  /**
   * Check for timed out ACKs and return list of failed edges that require hard pheromone penalties
   */
  public checkAndApplyFailures(edges: Map<string, EdgePheromoneLink>): { failedEdges: string[]; penalizedEdgesCount: number } {
    const now = Date.now();
    const failedEdges: string[] = [];
    let count = 0;

    this.pendingAcks.forEach((record, packetId) => {
      if (now - record.sentTimestamp > record.timeoutMs) {
        const edgeKey = `${record.sourceId}->${record.targetId}`;
        const edge = edges.get(edgeKey);

        if (edge) {
          // Hard Pheromone Penalty calculation
          edge.pheromone = Math.max(0.01, edge.pheromone * this.hardPenaltyFactor);
          edge.failureCount += 1;
          edge.lastUpdated = now;
          failedEdges.push(edgeKey);
          count++;
          console.warn(`[FailureDetector] MISSING ACK on edge '${edgeKey}'! Hard penalty applied: new pheromone = ${edge.pheromone.toFixed(3)}`);
        }

        // Clean up pending ack
        this.pendingAcks.delete(packetId);
      }
    });

    return { failedEdges, penalizedEdgesCount: count };
  }
}
