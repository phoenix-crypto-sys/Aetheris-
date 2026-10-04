import { AetherisAirwavesChannel } from './supabase';
import { AetherisPacket, PacketPriority, MeshNodeState, EdgePheromoneLink } from '../layer1_radio/types';
import { BLEClusterManager } from '../layer1_radio/bleCluster';
import { LoRaBridgeManager } from '../layer1_radio/loraBridge';
import { RescueNodeManager } from '../layer1_radio/rescueNode';
import { FailureDetector } from '../layer2_resilience/failureDetector';
import { PheromoneDecayEngine } from '../layer2_resilience/pheromoneDecay';
import { StoreAndForwardQueue } from '../layer2_resilience/storeAndForward';

class AirwavesService {
  private primaryDeviceId: string;
  private airwavesChannel: AetherisAirwavesChannel;
  private broadcastTimer: any = null;
  private isBroadcastingActive = false;

  // Layer 1 Modules
  public bleCluster: BLEClusterManager;
  public loraBridge: LoRaBridgeManager;
  public rescueNode: RescueNodeManager;

  // Layer 2 Resilience Modules
  public failureDetector: FailureDetector;
  public pheromoneDecay: PheromoneDecayEngine;
  public storeAndForward: StoreAndForwardQueue;

  // Link Pheromone Graph
  private edgeLinks: Map<string, EdgePheromoneLink> = new Map();

  constructor() {
    this.primaryDeviceId = 'AETHERIS-MOBILE-01';
    this.airwavesChannel = new AetherisAirwavesChannel('aetheris_mesh');

    // Instantiate Layer 1
    this.bleCluster = new BLEClusterManager(this.primaryDeviceId);
    this.loraBridge = new LoRaBridgeManager('ESP32-LORA-BRIDGE-01');
    this.rescueNode = new RescueNodeManager('RESCUE-COMMAND-SINK-01');

    // Connect LoRa hardware bridge
    this.loraBridge.connectHardwareBridge();

    // Instantiate Layer 2
    this.failureDetector = new FailureDetector(0.1); // Hard -90% penalty on missing ACK
    this.pheromoneDecay = new PheromoneDecayEngine(0.02);
    this.storeAndForward = new StoreAndForwardQueue();

    // Initialize baseline links
    this.edgeLinks.set(`${this.primaryDeviceId}->ESP32-LORA-BRIDGE-01`, {
      sourceId: this.primaryDeviceId,
      targetId: 'ESP32-LORA-BRIDGE-01',
      pheromone: 0.9,
      hyperbolicDistance: 0.15,
      lastUpdated: Date.now(),
      failureCount: 0,
    });

    this.edgeLinks.set(`ESP32-LORA-BRIDGE-01->RESCUE-COMMAND-SINK-01`, {
      sourceId: 'ESP32-LORA-BRIDGE-01',
      targetId: 'RESCUE-COMMAND-SINK-01',
      pheromone: 0.95,
      hyperbolicDistance: 0.25,
      lastUpdated: Date.now(),
      failureCount: 0,
    });
  }

  public getPrimaryDeviceId(): string {
    return this.primaryDeviceId;
  }

  public getAirwavesChannel(): AetherisAirwavesChannel {
    return this.airwavesChannel;
  }

  public isBroadcasting(): boolean {
    return this.isBroadcastingActive;
  }

  /**
   * Broadcast continuous telemetry packets conforming strictly to AetherisPacket schema
   */
  public startBroadcasting(intervalMs = 3000): void {
    if (this.broadcastTimer) {
      clearInterval(this.broadcastTimer);
    }

    this.isBroadcastingActive = true;
    this.broadcastCurrentPacket('medium', 'Beacon Heartbeat');

    this.broadcastTimer = setInterval(() => {
      this.broadcastCurrentPacket('medium', 'Beacon Heartbeat');
    }, intervalMs);
  }

  public stopBroadcasting(): void {
    if (this.broadcastTimer) {
      clearInterval(this.broadcastTimer);
      this.broadcastTimer = null;
    }
    this.isBroadcastingActive = false;
  }

  /**
   * Send a high-priority packet (e.g. Critical Medical SOS or Alert)
   */
  public sendPriorityPacket(priority: PacketPriority, message: string): AetherisPacket {
    const pkt = this.bleCluster.createPacket(message, priority);
    
    // Store in Store-and-Forward queue enforcing chronological order [...prev, item]
    this.storeAndForward.enqueue(pkt);

    // Broadcast over channel
    this.airwavesChannel.broadcast(pkt);

    // If LoRa bridge connected, transmit over long range link
    this.loraBridge.transmitLoRaPacket(pkt);

    // If packet priority is critical, ingest directly into Rescue Node sink
    if (priority === 'critical') {
      this.rescueNode.receivePacket(pkt);
    }

    return pkt;
  }

  /**
   * Simulate missing ACK event triggering hard pheromone penalty
   */
  public simulateMissingAck(targetId: string = 'ESP32-LORA-BRIDGE-01'): void {
    const edgeKey = `${this.primaryDeviceId}->${targetId}`;
    this.failureDetector.trackSentPacket('pkt-sim-001', this.primaryDeviceId, targetId, 100);
    
    // Force timeout check
    setTimeout(() => {
      this.failureDetector.checkAndApplyFailures(this.edgeLinks);
    }, 150);
  }

  private broadcastCurrentPacket(priority: PacketPriority, message: string): void {
    const packet = this.bleCluster.createPacket(message, priority);

    // Update passive decay across links
    this.pheromoneDecay.applyDecayToAllEdges(this.edgeLinks);

    this.airwavesChannel.broadcast(packet);
  }

  public getEdgeLinks(): Map<string, EdgePheromoneLink> {
    return this.edgeLinks;
  }
}

export const airwavesService = new AirwavesService();
