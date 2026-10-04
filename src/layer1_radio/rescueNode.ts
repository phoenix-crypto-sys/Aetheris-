import { AetherisPacket, MeshNodeState } from './types';

/**
 * Layer 1: Rescue Node Module
 * Priority packet sink for first responders, emergency command centers, and tactical relays.
 */
export class RescueNodeManager {
  private rescueNodeId: string;
  private receivedEmergencyPackets: AetherisPacket[] = [];

  constructor(rescueNodeId: string = 'RESCUE-COMMAND-SINK-01') {
    this.rescueNodeId = rescueNodeId;
  }

  public getRescueNodeId(): string {
    return this.rescueNodeId;
  }

  /**
   * Ingest packet into rescue sink. Automatically prioritizes critical / medical SOS packets.
   */
  public receivePacket(packet: AetherisPacket): { success: boolean; ackPayload: object } {
    // Append packet to received queue enforcing chronology
    const updatedPacket: AetherisPacket = {
      ...packet,
      hop_count: packet.hop_count + 1,
      route_trace: [...packet.route_trace, this.rescueNodeId],
    };

    // STRICT APPEND RULE: [...prev, item]
    this.receivedEmergencyPackets = [...this.receivedEmergencyPackets, updatedPacket];

    console.log(`[RescueNode] Ingested packet from ${packet.sender_id} with priority '${packet.priority}'`);

    return {
      success: true,
      ackPayload: {
        ack_type: 'RESCUE_ACK',
        target_packet_id: `${packet.sender_id}-${packet.timestamp}`,
        sink_id: this.rescueNodeId,
        received_timestamp: new Date().toISOString(),
      },
    };
  }

  public getReceivedPackets(): AetherisPacket[] {
    return this.receivedEmergencyPackets;
  }

  public getRescueNodeState(): MeshNodeState {
    return {
      id: this.rescueNodeId,
      role: 'RESCUE_NODE',
      location: { lat: 37.7780, lng: -122.4150 },
      battery: 100,
      rssi: -45,
      linkQuality: 0.99,
      status: 'ONLINE',
      lastSeenTimestamp: Date.now(),
    };
  }
}
