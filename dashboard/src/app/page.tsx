'use client';

import React, { useState, useEffect } from 'react';
import { MetricsOverview } from '../components/MetricsOverview';
import { LiveSOSScanner } from '../components/LiveSOSScanner';
import { BentoTriageFeed } from '../components/BentoTriageFeed';
import { PoincareMeshCanvas } from '../components/PoincareMeshCanvas';
import { ACOScoringPanel } from '../components/ACOScoringPanel';
import { webBluetoothReceiver, WebSOSTicket, getRealWorldLocation } from '../services/webBluetoothReceiver';
import { packBinaryPacket } from '../services/binaryPacket';
import { Radio, RefreshCw, AlertCircle } from 'lucide-react';

export default function CommandReceiverDashboard() {
  const [tickets, setTickets] = useState<WebSOSTicket[]>([]);
  const [isScanning, setIsScanning] = useState(true);
  const [simSequence, setSimSequence] = useState(1);

  // Poll /api/sos and subscribe to Web Bluetooth Receiver
  useEffect(() => {
    // Acquire Command Center location dynamically (HTML5 + IP Geolocation Fallback)
    getRealWorldLocation().then((loc) => {
      if (loc) {
        webBluetoothReceiver.setCommandCenterLocation(loc.lat, loc.lng);
      }
    });

    const fetchLiveAPISOS = async () => {
      try {
        const res = await fetch('/api/sos');
        if (res.ok) {
          const data = await res.json();
          if (data.tickets && Array.isArray(data.tickets)) {
            webBluetoothReceiver.syncApiTickets(data.tickets);
          } else {
            webBluetoothReceiver.syncApiTickets([]);
          }
        }
      } catch (e) {}
    };

    fetchLiveAPISOS();
    const apiInterval = setInterval(fetchLiveAPISOS, 2500);

    const unsubTickets = webBluetoothReceiver.subscribeTickets((updatedTickets) => {
      setTickets(updatedTickets);
    });

    const unsubScan = webBluetoothReceiver.subscribeScanState((scanning) => {
      setIsScanning(scanning);
    });

    webBluetoothReceiver.startContinuousScan();

    return () => {
      clearInterval(apiInterval);
      unsubTickets();
      unsubScan();
    };
  }, []);

  const handleUpdateStatus = (ticketId: string, status: 'PENDING' | 'DISPATCHED' | 'RESOLVED') => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    webBluetoothReceiver.updateTicketStatus(ticketId, status);

    // Sync status with Next.js API route (and backend proxy)
    fetch('/api/sos', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticketId, status }),
    }).catch(() => {});

    // Sync status with canonical FastAPI backend store if available
    fetch(`${apiUrl}/api/v1/tickets/${encodeURIComponent(ticketId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    }).catch(() => {});

    if (status === 'DISPATCHED' || status === 'RESOLVED') {
      const ticket = tickets.find(t => t.id === ticketId);
      const srcId = ticket ? ticket.senderId : 'MOBILE-VICTIM';
      fetch(`${apiUrl}/api/v1/ack`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packet_id: ticketId,
          source_id: srcId,
          target_id: 'WEB-COMMAND-SINK',
          success: true,
        }),
      }).catch(() => {});
    }
  };

  const handleClearAll = async () => {
    try {
      await fetch('/api/sos', { method: 'DELETE' });
    } catch (e) {}
    webBluetoothReceiver.clearTickets();
  };

  const criticalCount = tickets.filter((t) => t.priorityLevel === 3 && t.status === 'PENDING').length;

  return (
    <div style={{ backgroundColor: '#050810', minHeight: '100vh', color: '#f8fafc', padding: '24px' }}>
      
      {/* Top Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid #1e293b', paddingBottom: '16px', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '12px', backgroundColor: '#00f0ff22', border: '1px solid #00f0ff', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#00f0ff', fontSize: '22px', fontWeight: 'bold' }}>
            ◈
          </div>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: '900', letterSpacing: '2px', fontFamily: 'monospace', margin: 0 }}>
              AETHERIS WEB COMMAND & RECEIVER SYSTEM
            </h1>
            <p style={{ fontSize: '10px', color: '#00f0ff', fontFamily: 'monospace', margin: 0, letterSpacing: '1px' }}>
              CONTINUOUS BLE RECEIVER MONITOR & EMERGENCY OPERATIONS CENTER
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {/* Launch Mobile App Button */}
          <a
            href="/mobile"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#00f0ff18',
              border: '1px solid #00f0ff',
              color: '#00f0ff',
              padding: '6px 12px',
              borderRadius: '8px',
              textDecoration: 'none',
              fontFamily: 'monospace',
              fontSize: '10px',
              fontWeight: 'bold',
              letterSpacing: '1px',
            }}
          >
            📱 OPEN MOBILE HELPER APP
          </a>

          {/* Download Android APK Button */}
          <a
            href="https://expo.dev/artifacts/eas/QNQUzG0PkSl478u0YZvWdtQr0g4HwRXSEEfWdmF0_PM.apk"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#10b98118',
              border: '1px solid #10b981',
              color: '#10b981',
              padding: '6px 12px',
              borderRadius: '8px',
              textDecoration: 'none',
              fontFamily: 'monospace',
              fontSize: '10px',
              fontWeight: 'bold',
              letterSpacing: '1px',
            }}
          >
            🤖 DOWNLOAD ANDROID APK
          </a>

          {/* SIMULATION MODE badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#f59e0b18', border: '1px solid #f59e0b', borderRadius: '8px', padding: '6px 12px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f59e0b', display: 'inline-block' }} />
            <span style={{ fontSize: '10px', fontWeight: 'bold', fontFamily: 'monospace', color: '#fbbf24', letterSpacing: '1px' }}>
              SIMULATION MODE
            </span>
          </div>

          {/* Reset / Clear Feed Button */}
          <button
            onClick={handleClearAll}
            style={{
              backgroundColor: '#0f172a',
              color: '#94a3b8',
              border: '1px solid #334155',
              borderRadius: '8px',
              padding: '6px 14px',
              fontFamily: 'monospace',
              fontSize: '10px',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <RefreshCw size={12} /> RESET / CLEAR FEED
          </button>

          {/* Active Receiver Scanning Indicator */}
          <div style={{ backgroundColor: '#090d16', border: '1px solid #10b981', borderRadius: '8px', padding: '6px 14px', fontFamily: 'monospace', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block' }} />
            <span style={{ color: '#64748b' }}>CONTINUOUS BLE RECEIVER: </span>
            <span style={{ color: '#10b981', fontWeight: 'bold' }}>ACTIVE</span>
          </div>

          {/* Pending Critical Tickets Badge */}
          <div style={{ backgroundColor: criticalCount > 0 ? '#450a0a' : '#090d16', border: `1px solid ${criticalCount > 0 ? '#ef4444' : '#1e293b'}`, borderRadius: '8px', padding: '6px 14px', fontFamily: 'monospace', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <AlertCircle size={14} color={criticalCount > 0 ? '#ef4444' : '#64748b'} />
            <span style={{ color: criticalCount > 0 ? '#fca5a5' : '#64748b' }}>CRITICAL SOS TICKETS: </span>
            <span style={{ color: criticalCount > 0 ? '#ef4444' : '#f8fafc', fontWeight: 'bold' }}>{criticalCount}</span>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <MetricsOverview
        activeNodesCount={tickets.length + 1}
        packetsRoutedCount={tickets.length}
        queueDepth={tickets.filter(t => t.status === 'PENDING').length}
        avgHopCount={1.8}
        decayRate="λ = 0.02"
      />

      {/* 1. Continuous Live SOS Radar Scanner & Geolocation Pinpoint Card */}
      <LiveSOSScanner
        tickets={tickets}
        onDispatchTicket={(ticketId) => handleUpdateStatus(ticketId, 'DISPATCHED')}
      />

      {/* 2. Bento Grid Triage Feed */}
      <BentoTriageFeed
        tickets={tickets}
        onUpdateStatus={handleUpdateStatus}
      />

      {/* 3. Poincaré Hyperbolic Mesh Canvas */}
      <PoincareMeshCanvas
        tickets={tickets}
      />

      {/* 4. ACO Scoring & Routing Engine Panel */}
      <ACOScoringPanel />

    </div>
  );
}
