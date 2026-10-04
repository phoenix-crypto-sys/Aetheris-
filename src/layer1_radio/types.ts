/**
 * Aetheris Standardized Mesh Packet & Node Types
 * Conforms to 4-Layer System Architecture Specification
 */

export type PacketPriority = 'critical' | 'high' | 'medium' | 'low';

export interface LocationCoordinates {
  lat: number;
  lng: number;
}

export interface AetherisPacket {
  sender_id: string;
  location: LocationCoordinates;
  timestamp: string; // ISO8601 string
  priority: PacketPriority;
  message: string;
  ttl: number; // seconds
  hop_count: number;
  route_trace: string[]; // List of node IDs traversed
}

export type NodeRole = 'BLE_NODE' | 'LORA_BRIDGE' | 'RESCUE_NODE';

export interface MeshNodeState {
  id: string;
  role: NodeRole;
  location: LocationCoordinates;
  battery: number; // 0 - 100%
  rssi: number; // dBm
  linkQuality: number; // 0.0 - 1.0
  status: 'ONLINE' | 'DEGRADED' | 'FAILED';
  lastSeenTimestamp: number;
}

export interface EdgePheromoneLink {
  sourceId: string;
  targetId: string;
  pheromone: number; // tau (0.0 to 1.0+)
  hyperbolicDistance: number;
  lastUpdated: number;
  failureCount: number;
}
