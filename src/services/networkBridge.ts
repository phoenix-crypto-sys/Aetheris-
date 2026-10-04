/**
 * Mobile-to-Web Network Bridge & SOS Packet Relayer
 * Automatically bridges Phone BLE advertising to Web Command Center API & FastAPI Mesh Backend
 */

import { Platform, NativeModules } from 'react-native';
import { packBinaryPacket } from './binaryPacket';

function getDynamicHostIP(): string {
  if (typeof window !== 'undefined' && window.location && window.location.hostname) {
    return window.location.hostname;
  }

  try {
    const scriptURL = NativeModules?.SourceCode?.scriptURL;
    if (scriptURL) {
      const parts = scriptURL.split('://');
      if (parts.length > 1) {
        const hostPort = parts[1].split('/')[0];
        const host = hostPort.split(':')[0];
        if (host && host !== 'localhost' && host !== '127.0.0.1') {
          return host;
        }
      }
    }
  } catch (e) {}

  return '127.0.0.1';
}

export interface MobileSOSTelemetry {
  packetId: number;
  senderId: string;
  customSenderName?: string;
  senderHash32?: number;
  priorityLevel: number;
  latitude: number;
  longitude: number;
  batteryPct: number;
  hopCount?: number;
  hexDump?: string;
  message?: string;
  route_trace?: string[];
  action?: 'CANCEL_SOS' | 'RESOLVE';
}

export interface BackendRouteResponse {
  selected_next_hop: string | null;
  score: number;
  routing_mode: 'HYPERBOLIC_COLD_START' | 'ACO_LEARNED';
  candidate_scores: Record<string, number>;
  route_trace: string[];
}

class NetworkBridgeService {
  private webServerUrl = '/api/sos';
  private backendApiUrl =
    (typeof process !== 'undefined' && (process.env?.EXPO_PUBLIC_API_URL || process.env?.NEXT_PUBLIC_API_URL))
      ? `${(process.env.EXPO_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_URL).replace(/\/$/, '')}/api/v1/packets/route`
      : 'http://localhost:8000/api/v1/packets/route';
  private isConnected = false;
  private lastTransmittedPacket: MobileSOSTelemetry | null = null;
  private lastRouteDecision: BackendRouteResponse | null = null;

  constructor() {
    this.checkConnection();
  }

  private customServerUrl: string | null = null;

  public setCustomServerUrl(url: string) {
    if (url) {
      const clean = url.trim().replace(/\/$/, '');
      this.customServerUrl = clean.endsWith('/api/sos') ? clean : `${clean}/api/sos`;
      this.webServerUrl = this.customServerUrl;
      this.checkConnection();
    }
  }

  public getCandidateUrls(): string[] {
    const urls: string[] = [];

    if (this.customServerUrl) {
      urls.push(this.customServerUrl);
    }

    const envDashboard = typeof process !== 'undefined'
      ? (process.env?.EXPO_PUBLIC_DASHBOARD_URL || process.env?.EXPO_PUBLIC_API_URL || process.env?.NEXT_PUBLIC_API_URL)
      : undefined;

    if (envDashboard) {
      const clean = envDashboard.trim().replace(/\/$/, '');
      urls.push(clean.endsWith('/api/sos') ? clean : `${clean}/api/sos`);
    }

    if (typeof window !== 'undefined' && window.location && window.location.origin) {
      urls.push(`${window.location.origin}/api/sos`);
    }

    const dynamicHost = getDynamicHostIP();
    if (dynamicHost && dynamicHost !== '127.0.0.1' && dynamicHost !== 'localhost') {
      urls.push(`http://${dynamicHost}:3000/api/sos`);
    }

    // Live Cloud Vercel Operations Center Endpoints
    urls.push('https://aetheris-sepia.vercel.app/api/sos');
    urls.push('https://aetheris-3e1rh3d2v-parth-works.vercel.app/api/sos');

    // Common local development and Wi-Fi endpoints
    urls.push('http://192.168.0.179:3000/api/sos');
    urls.push('http://localhost:3000/api/sos');
    urls.push('http://10.0.2.2:3000/api/sos'); // Android emulator loopback

    return [...new Set(urls)].filter(u => u.startsWith('http://') || u.startsWith('https://'));
  }

  public async checkConnection(): Promise<boolean> {
    const candidateUrls = this.getCandidateUrls();

    for (const url of candidateUrls) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        const response = await fetch(url, { method: 'GET', signal: controller.signal });
        clearTimeout(timeoutId);
        if (response.ok) {
          this.webServerUrl = url;
          this.backendApiUrl = url.includes(':3000') 
            ? url.replace(':3000/api/sos', ':8000/api/v1/packets/route')
            : 'http://localhost:8000/api/v1/packets/route';
          this.isConnected = true;
          return true;
        }
      } catch (e) {}
    }

    this.isConnected = false;
    return false;
  }

  public async relaySOSToWebCommand(telemetry: MobileSOSTelemetry): Promise<boolean> {
    this.lastTransmittedPacket = telemetry;

    const raw18Bytes = packBinaryPacket({
      packetId: telemetry.packetId,
      priorityLevel: telemetry.priorityLevel,
      latitude: telemetry.latitude,
      longitude: telemetry.longitude,
      batteryPct: telemetry.batteryPct,
      hopCount: telemetry.hopCount ?? 1,
      senderId: telemetry.senderId,
    });

    const hexDump = Array.from(raw18Bytes)
      .map(b => b.toString(16).padStart(2, '0').toUpperCase())
      .join(' ');

    const payload = {
      action: telemetry.action,
      packetId: telemetry.packetId,
      senderId: telemetry.senderId,
      customSenderName: telemetry.customSenderName || telemetry.senderId,
      senderHash32: telemetry.senderHash32,
      priorityLevel: telemetry.priorityLevel,
      latitude: telemetry.latitude,
      longitude: telemetry.longitude,
      batteryPct: telemetry.batteryPct,
      hopCount: telemetry.hopCount ?? 1,
      hexDump: telemetry.hexDump || hexDump,
      message: telemetry.message || 'EMERGENCY SOS: Immediate Response Requested',
      route_trace: telemetry.route_trace || [telemetry.senderId, 'HELPER-RELAY-01', 'WEB-COMMAND-SINK'],
    };

    const candidateUrls = this.getCandidateUrls();
    let success = false;

    for (const url of candidateUrls) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (response.ok) {
          this.webServerUrl = url;
          this.backendApiUrl = url.includes(':3000')
            ? url.replace(':3000/api/sos', ':8000/api/v1/packets/route')
            : 'http://localhost:8000/api/v1/packets/route';
          this.isConnected = true;
          success = true;
          break;
        }
      } catch (error) {}
    }

    // Also trigger FastAPI Hyperbolic & ACO route evaluation
    this.evaluateFastAPIRoute(telemetry).catch(() => {});

    this.isConnected = success;
    return success;
  }

  public async evaluateFastAPIRoute(telemetry: MobileSOSTelemetry): Promise<BackendRouteResponse | null> {
    const priorityLabels: ('critical' | 'high' | 'medium' | 'low')[] = ['low', 'medium', 'high', 'critical'];
    const pLabel = priorityLabels[Math.min(3, Math.max(0, telemetry.priorityLevel))] || 'critical';

    const fastapiPayload = {
      packet: {
        sender_id: telemetry.senderId,
        location: { lat: telemetry.latitude, lng: telemetry.longitude },
        timestamp: new Date().toISOString(),
        priority: pLabel,
        message: telemetry.message || 'EMERGENCY SOS',
        ttl: 3600,
        hop_count: telemetry.hopCount ?? 1,
        route_trace: telemetry.route_trace || [telemetry.senderId],
      },
      destination_node_id: 'WEB-COMMAND-SINK',
      available_candidate_nodes: [
        {
          id: "Nayan's Galaxy S24 (Field Relay)",
          role: 'BLE_NODE',
          location: { lat: telemetry.latitude - 0.002, lng: telemetry.longitude + 0.001 },
          battery: 95.0,
          rssi: -45.0,
          link_quality: 0.92,
          status: 'ONLINE',
          is_anchor: false,
        },
        {
          id: "Aarav's Pixel 8 Pro (Rescue Bridge)",
          role: 'LORA_BRIDGE',
          location: { lat: telemetry.latitude - 0.004, lng: telemetry.longitude + 0.003 },
          battery: 88.0,
          rssi: -55.0,
          link_quality: 0.85,
          status: 'ONLINE',
          is_anchor: false,
        },
        {
          id: 'WEB-COMMAND-SINK',
          role: 'RESCUE_NODE',
          location: { lat: 37.774900, lng: -122.419400 },
          battery: 100.0,
          rssi: -30.0,
          link_quality: 0.99,
          status: 'ONLINE',
          is_anchor: true,
        },
      ],
    };

    const dynamicHost = getDynamicHostIP();
    const envApiBase = typeof process !== 'undefined' ? (process.env?.EXPO_PUBLIC_API_URL || process.env?.NEXT_PUBLIC_API_URL) : undefined;
    const fastapiUrls = [
      this.backendApiUrl,
      ...(envApiBase ? [`${envApiBase.replace(/\/$/, '')}/api/v1/packets/route`] : []),
      `http://${dynamicHost}:8000/api/v1/packets/route`,
      'http://localhost:8000/api/v1/packets/route',
    ];

    for (const url of fastapiUrls) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(fastapiPayload),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data: BackendRouteResponse = await res.json();
          this.lastRouteDecision = data;
          return data;
        }
      } catch (e) {}
    }
    return null;
  }

  public getStatus() {
    return {
      webServerUrl: this.webServerUrl,
      backendApiUrl: this.backendApiUrl,
      isConnected: this.isConnected,
      lastTransmittedPacket: this.lastTransmittedPacket,
      lastRouteDecision: this.lastRouteDecision,
    };
  }
}

export const networkBridge = new NetworkBridgeService();
