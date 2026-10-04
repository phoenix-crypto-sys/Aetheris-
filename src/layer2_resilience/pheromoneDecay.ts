import { EdgePheromoneLink } from '../layer1_radio/types';

/**
 * Layer 2: Passive Decay Module
 * Implements exponential decay equation for link pheromone scores:
 *   τ(t) = τ₀ · e^(-λt)
 * where λ (lambda) is the decay rate constant.
 */
export class PheromoneDecayEngine {
  private lambda: number; // Decay constant, e.g. 0.05 per minute or second

  constructor(lambda: number = 0.02) {
    this.lambda = lambda;
  }

  /**
   * Calculate decayed pheromone level given initial tau0 and elapsed time delta (in seconds)
   */
  public calculateDecay(tau0: number, deltaTimeSeconds: number): number {
    if (deltaTimeSeconds <= 0) return tau0;
    const decayed = tau0 * Math.exp(-this.lambda * deltaTimeSeconds);
    return Math.max(0.001, Number(decayed.toFixed(6)));
  }

  /**
   * Apply exponential decay across all network link edges
   */
  public applyDecayToAllEdges(edges: Map<string, EdgePheromoneLink>): void {
    const now = Date.now();
    edges.forEach((edge) => {
      const elapsedSeconds = (now - edge.lastUpdated) / 1000;
      if (elapsedSeconds > 1) {
        edge.pheromone = this.calculateDecay(edge.pheromone, elapsedSeconds);
        edge.lastUpdated = now;
      }
    });
  }
}
