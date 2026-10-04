import { AetherisPacket, MeshNodeState } from './types';

export interface LoRaConfig {
  frequencyMHz: number; // e.g. 915 or 868
  spreadingFactor: number; // SF7 - SF12
  bandwidthKhz: number; // 125, 250, 500
  txPowerDbm: number; // 20 dBm max
}

/**
 * Layer 1: LoRa Bridge Support Module
 * Provides interface hooks for ESP32 / LoRa long-range hardware bridges.
 */
export class LoRaBridgeManager {
  private isConnected: boolean = false;
  private bridgeNodeId: string;
  private config: LoRaConfig;

  constructor(bridgeNodeId: string = 'ESP32-LORA-BRIDGE-01') {
    this.bridgeNodeId = bridgeNodeId;
    this.config = {
      frequencyMHz: 915.0,
      spreadingFactor: 7,
      bandwidthKhz: 125,
      txPowerDbm: 20,
    };
  }

  public connectHardwareBridge(): Promise<boolean> {
    return new Promise((resolve) => {
      // Simulate serial/UART/USB connection handshake with ESP32 bridge
      setTimeout(() => {
        this.isConnected = true;
        resolve(true);
      }, 300);
    });
  }

  public disconnectBridge(): void {
    this.isConnected = false;
  }

  public getStatus(): { connected: boolean; bridgeNodeId: string; config: LoRaConfig } {
    return {
      connected: this.isConnected,
      bridgeNodeId: this.bridgeNodeId,
      config: { ...this.config },
    };
  }

  /**
   * Transmit a packet over long-range LoRa hardware link
   */
  public transmitLoRaPacket(packet: AetherisPacket): boolean {
    if (!this.isConnected) {
      console.warn('[LoRaBridge] Hardware bridge offline. Falling back to local queue.');
      return false;
    }

    // Append bridge ID to packet route trace if not already present
    if (!packet.route_trace.includes(this.bridgeNodeId)) {
      packet.route_trace.push(this.bridgeNodeId);
      packet.hop_count += 1;
    }

    console.log(`[LoRaBridge] TX Packet ${packet.sender_id} -> LoRa RF Link (SF${this.config.spreadingFactor})`);
    return true;
  }

  /**
   * Get LoRa Bridge node representation
   */
  public getBridgeNodeState(): MeshNodeState {
    return {
      id: this.bridgeNodeId,
      role: 'LORA_BRIDGE',
      location: { lat: 37.7760, lng: -122.4180 },
      battery: 100, // Solar/external power
      rssi: -65,
      linkQuality: 0.95,
      status: this.isConnected ? 'ONLINE' : 'DEGRADED',
      lastSeenTimestamp: Date.now(),
    };
  }
}
