'use client';

import React, { useState } from 'react';
import { WebSOSTicket } from '../services/webBluetoothReceiver';
import { AlertTriangle, Battery, MapPin, Clock, ShieldCheck, ShieldAlert, Navigation, CheckCircle2, GitCommit, Activity } from 'lucide-react';

interface BentoTriageFeedProps {
  tickets: WebSOSTicket[];
  onUpdateStatus: (ticketId: string, status: 'PENDING' | 'DISPATCHED' | 'RESOLVED') => void;
}

export function BentoTriageFeed({ tickets, onUpdateStatus }: BentoTriageFeedProps) {
  const [sortBy, setSortBy] = useState<'criticality' | 'age' | 'battery' | 'distance'>('criticality');

  const sortedTickets = [...tickets].sort((a, b) => {
    if (sortBy === 'criticality') {
      return b.priorityLevel - a.priorityLevel;
    } else if (sortBy === 'age') {
      return a.ageSeconds - b.ageSeconds;
    } else if (sortBy === 'battery') {
      return a.batteryPct - b.batteryPct;
    } else if (sortBy === 'distance') {
      return a.distanceKm - b.distanceKm;
    }
    return 0;
  });

  const getPriorityColor = (level: number) => {
    switch (level) {
      case 3: return { bg: '#450a0a', border: '#ef4444', text: '#fca5a5', badge: '🚨 CRITICAL SOS WARNING', isEmergency: true };
      case 2: return { bg: '#451a03', border: '#f59e0b', text: '#fde68a', badge: '⚠️ HIGH SOS ALERT', isEmergency: true };
      case 1: return { bg: '#172554', border: '#3b82f6', text: '#bfdbfe', badge: 'ℹ️ MEDIUM ALERT', isEmergency: false };
      default: return { bg: '#022c22', border: '#10b981', text: '#a7f3d0', badge: '🟢 ROUTINE MESH HEARTBEAT', isEmergency: false };
    }
  };

  return (
    <div style={{ backgroundColor: '#090d16', borderRadius: '16px', border: '1px solid #1e293b', padding: '20px', marginBottom: '24px' }}>
      
      {/* Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ padding: '8px', borderRadius: '8px', backgroundColor: '#38bdf822', border: '1px solid #38bdf8', color: '#38bdf8' }}>
            <Activity size={18} />
          </div>
          <div>
            <h2 style={{ fontSize: '14px', fontWeight: 'bold', fontFamily: 'monospace', color: '#f8fafc', margin: 0, letterSpacing: '1px' }}>
              BENTO GRID EMERGENCY & ROUTINE MESH FEED
            </h2>
            <p style={{ fontSize: '10px', color: '#64748b', fontFamily: 'monospace', margin: 0 }}>
              WARNING ALERTS TRIGGERED STRICTLY ON EMERGENCY SOS
            </p>
          </div>
        </div>

        {/* Sort Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'monospace', fontSize: '10px' }}>
          <span style={{ color: '#64748b' }}>SORT BY:</span>
          {(['criticality', 'age', 'battery', 'distance'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setSortBy(mode)}
              style={{
                backgroundColor: sortBy === mode ? '#1e293b' : '#0f172a',
                color: sortBy === mode ? '#00f0ff' : '#64748b',
                border: sortBy === mode ? '1px solid #00f0ff' : '1px solid #1e293b',
                borderRadius: '6px',
                padding: '4px 10px',
                cursor: 'pointer',
                textTransform: 'uppercase',
                fontSize: '10px',
                fontWeight: 'bold',
              }}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* Bento Cards Grid */}
      {sortedTickets.length === 0 ? (
        <div style={{ padding: '36px', textAlign: 'center', backgroundColor: '#030712', borderRadius: '12px', border: '1px dashed #1e293b' }}>
          <p style={{ color: '#64748b', fontFamily: 'monospace', fontSize: '12px', margin: 0 }}>
            📡 Continuous Receiver Scanning Active. Waiting for mobile telemetry... Nearby devices with Aetheris open work normally until an emergency SOS is triggered.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
          {sortedTickets.map((t) => {
            const styleTheme = getPriorityColor(t.priorityLevel);
            return (
              <div
                key={t.id}
                style={{
                  backgroundColor: styleTheme.bg,
                  borderRadius: '12px',
                  border: `1px solid ${styleTheme.border}`,
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: styleTheme.isEmergency ? '0 4px 20px rgba(239,68,68,0.3)' : '0 4px 14px rgba(0,0,0,0.2)',
                }}
              >
                <div>
                  {/* Priority Badge */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 'bold', fontFamily: 'monospace', backgroundColor: '#00000066', color: styleTheme.text, border: `1px solid ${styleTheme.border}`, borderRadius: '4px', padding: '2px 8px' }}>
                      {styleTheme.badge}
                    </span>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          fontSize: '9px',
                          fontWeight: 'bold',
                          fontFamily: 'monospace',
                          backgroundColor: '#0f172a',
                          border: `1px solid ${t.transport === 'BLE' ? '#10b981' : '#38bdf8'}`,
                          color: t.transport === 'BLE' ? '#34d399' : '#38bdf8',
                          borderRadius: '4px',
                          padding: '1px 6px',
                        }}
                      >
                        Transport: {t.transport || (t.route_trace && t.route_trace.some(r => r.includes('BLE')) ? 'BLE' : 'LAN-sim')}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', fontFamily: 'monospace', color: t.checksumValid ? '#10b981' : '#ef4444' }}>
                        {t.checksumValid ? <ShieldCheck size={12} /> : <ShieldAlert size={12} />}
                        <span>{t.checksumValid ? 'CRC16 OK' : 'CRC ERROR'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Sender ID */}
                  <h3 style={{ fontSize: '15px', fontWeight: '900', fontFamily: 'monospace', color: '#f8fafc', margin: '0 0 6px 0' }}>
                    {t.senderId}
                  </h3>

                  {/* Message Content */}
                  <div style={{ backgroundColor: '#00000066', borderRadius: '8px', padding: '10px', border: '1px solid #ffffff18', marginBottom: '10px' }}>
                    <div style={{ color: '#64748b', fontSize: '8px', fontFamily: 'monospace', marginBottom: '2px' }}>
                      {styleTheme.isEmergency ? 'EMERGENCY SOS MESSAGE' : 'ROUTINE MESH BEACON STATUS'}
                    </div>
                    <div style={{ color: '#f8fafc', fontSize: '12px', fontWeight: 'bold', fontFamily: 'monospace' }}>
                      "{t.message || (styleTheme.isEmergency ? 'EMERGENCY SOS: Immediate Response Requested' : 'Routine heartbeat sync - Node operating normally')}"
                    </div>
                  </div>

                  {/* Route Trace */}
                  {t.route_trace && t.route_trace.length > 0 && (
                    <div style={{ backgroundColor: '#00000044', borderRadius: '6px', padding: '6px 8px', border: '1px solid #1e293b', marginBottom: '10px' }}>
                      <div style={{ color: '#64748b', fontSize: '8px', fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <GitCommit size={10} /> MULTI-HOP BLE ROUTE TRACE ({t.hopCount || t.route_trace.length} Hops)
                      </div>
                      <div style={{ color: styleTheme.isEmergency ? '#ef4444' : '#00f0ff', fontSize: '9px', fontWeight: 'bold', fontFamily: 'monospace', marginTop: '2px' }}>
                        {t.route_trace.join(' → ')}
                      </div>
                    </div>
                  )}

                  {/* Location & Battery */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                    <div style={{ backgroundColor: '#00000044', borderRadius: '6px', padding: '8px', border: '1px solid #ffffff11' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#64748b', fontSize: '9px', fontFamily: 'monospace' }}>
                        <MapPin size={10} /> GPS LOCATION
                      </div>
                      <div style={{ color: '#f8fafc', fontSize: '11px', fontWeight: 'bold', fontFamily: 'monospace', marginTop: '2px' }}>
                        {Math.abs(t.latitude).toFixed(5)}° {t.latitude >= 0 ? 'N' : 'S'}, {Math.abs(t.longitude).toFixed(5)}° {t.longitude >= 0 ? 'E' : 'W'}
                      </div>
                    </div>

                    <div style={{ backgroundColor: '#00000044', borderRadius: '6px', padding: '8px', border: '1px solid #ffffff11' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#64748b', fontSize: '9px', fontFamily: 'monospace' }}>
                        <Battery size={10} /> BATTERY & DIST
                      </div>
                      <div style={{ color: t.batteryPct < 20 ? '#ef4444' : '#10b981', fontSize: '11px', fontWeight: 'bold', fontFamily: 'monospace', marginTop: '2px' }}>
                        ⚡ {t.batteryPct}% ({t.distanceKm} km)
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer Action Bar */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '10px', borderTop: '1px solid #ffffff11' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#64748b', fontSize: '9px', fontFamily: 'monospace' }}>
                    <Clock size={10} /> {new Date(t.timestamp).toLocaleTimeString()}
                  </div>

                  <div style={{ display: 'flex', gap: '6px' }}>
                    {styleTheme.isEmergency ? (
                      t.status === 'PENDING' ? (
                        <button
                          onClick={() => onUpdateStatus(t.id, 'DISPATCHED')}
                          style={{
                            backgroundColor: '#ef4444',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '6px 12px',
                            fontSize: '10px',
                            fontWeight: 'bold',
                            fontFamily: 'monospace',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <Navigation size={10} /> DISPATCH RESCUE
                        </button>
                      ) : (
                        <span style={{ color: '#10b981', fontSize: '10px', fontWeight: 'bold', fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <CheckCircle2 size={12} /> DISPATCHED
                        </span>
                      )
                    ) : (
                      <span style={{ color: '#10b981', fontSize: '10px', fontWeight: 'bold', fontFamily: 'monospace' }}>
                        🟢 ROUTINE SYNC
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
