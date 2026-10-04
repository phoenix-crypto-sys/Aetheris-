import { AetherisPacket, LocationCoordinates, MeshNodeState, PacketPriority } from './types';

/**
 * Layer 1: BLE Cluster Module
 * Manages local short-range BLE device discovery, peer handshakes, and packet creation.
 */
export class BLEClusterManager {
  private localNodeId: string;
  private localLocation: LocationCoordinates;
  private discoveredPeers: Map<string, MeshNodeState> = new Map();

  constructor(localNodeId: string, initialLoc: LocationCoordinates = { lat: 37.7749, lng: -122.4194 }) {
    this.localNodeId = localNodeId;
    this.localLocation = initialLoc;
  }

  public getLocalNodeId(): string {
    return this.localNodeId;
  }

  public updateLocalLocation(loc: LocationCoordinates): void {
    this.localLocation = loc;
  }

  /**
   * Create a standardized mesh packet adhering to specification
   */
  public createPacket(message: string, priority: PacketPriority = 'medium', ttlSeconds?: number): AetherisPacket {
    // Default priority-scaled TTL if not explicitly set
    let ttl = ttlSeconds;
    if (!ttl) {
      switch (priority) {
        case 'critical':
          ttl = 86400; // 24 hours
          break;
        case 'high':
          ttl = 43200; // 12 hours
          break;
        case 'medium':
          ttl = 14400; // 4 hours
          break;
        case 'low':
        default:
          ttl = 3600; // 1 hour
          break;
      }
    }

    return {
      sender_id: this.localNodeId,
      location: { ...this.localLocation },
      timestamp: new Date().toISOString(), // Strict ISO8601
      priority,
      message,
      ttl,
      hop_count: 0,
      route_trace: [this.localNodeId],
    };
  }

  /**
   * Register or update a discovered BLE peer in the cluster
   */
  public registerDiscoveredPeer(peer: MeshNodeState): void {
    this.discoveredPeers.set(peer.id, {
      ...peer,
      role: 'BLE_NODE',
      lastSeenTimestamp: Date.now(),
    });
  }

  /**
   * Get all active discovered BLE peers
   */
  public getDiscoveredPeers(): MeshNodeState[] {
    const now = Date.now();
    const active: MeshNodeState[] = [];
    this.discoveredPeers.forEach((peer) => {
      // 15s timeout for active BLE cluster peers
      if (now - peer.lastSeenTimestamp < 15000) {
        active.push(peer);
      }
    });
    return active;
  }
}
