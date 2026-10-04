'use client';

import React, { useState, useEffect } from 'react';
import { Radio, MapPin, AlertTriangle, ShieldCheck, Navigation, Volume2, VolumeX, Activity, CheckCircle2 } from 'lucide-react';
import { WebSOSTicket } from '../services/webBluetoothReceiver';

interface LiveSOSScannerProps {
  tickets: WebSOSTicket[];
  onDispatchTicket?: (ticketId: string) => void;
}

export function LiveSOSScanner({ tickets, onDispatchTicket }: LiveSOSScannerProps) {
  const [isScanning, setIsScanning] = useState(true);
  const [soundAlert, setSoundAlert] = useState(true);


  // CRITICAL RULE: Filter ONLY actual emergency SOS tickets (priorityLevel >= 2: High/Critical SOS)
  const activeCriticalSOSTickets = tickets.filter((t) => t.priorityLevel >= 2 && t.status === 'PENDING');
  const latestEmergencySOS = activeCriticalSOSTickets[0] || null;

  // Routine Heartbeats / Normal Nearby Aetheris Nodes (priorityLevel < 2)
  const normalMeshNodes = tickets.filter((t) => t.priorityLevel < 2);

  return (
    <div
      style={{
        backgroundColor: latestEmergencySOS ? '#180404' : '#090d16',
        borderRadius: '16px',
        border: `1px solid ${latestEmergencySOS ? '#ef4444' : '#1e293b'}`,
        padding: '20px',
        marginBottom: '24px',
        boxShadow: latestEmergencySOS ? '0 8px 32px rgba(239,68,68,0.25)' : '0 8px 32px rgba(0,0,0,0.4)',
        transition: 'all 0.3s ease',
      }}
    >
      {/* Scanner Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              padding: '8px',
              borderRadius: '8px',
              backgroundColor: latestEmergencySOS ? '#ef444422' : '#10b98122',
              border: `1px solid ${latestEmergencySOS ? '#ef4444' : '#10b981'}`,
              color: latestEmergencySOS ? '#ef4444' : '#10b981',
            }}
          >
            <Radio size={20} className={isScanning ? 'animate-pulse' : ''} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: '14px', fontWeight: 'bold', fontFamily: 'monospace', color: '#f8fafc', margin: 0, letterSpacing: '1px' }}>
                CONTINUOUS BLE & NETWORK MESH SCANNER
              </h2>
              <span
                style={{
                  fontSize: '9px',
                  fontWeight: 'bold',
                  fontFamily: 'monospace',
                  backgroundColor: '#f59e0b1f',
                  border: '1px solid #f59e0b',
                  color: '#fbbf24',
                  borderRadius: '4px',
                  padding: '1px 6px',
                  letterSpacing: '0.5px',
                }}
              >
                SIMULATION MODE (LAN / Web Transport)
              </span>
            </div>
            <p style={{ fontSize: '10px', color: latestEmergencySOS ? '#ef4444' : '#10b981', fontFamily: 'monospace', margin: 0, fontWeight: 'bold' }}>
              {latestEmergencySOS 
                ? '🚨 EMERGENCY SOS RECEIVED VIA BLUETOOTH / LAN - WARNING ACTIVE' 
                : '🟢 SYSTEM OPERATIONAL - ROUTINE BEACON MONITORING'}
            </p>
          </div>
        </div>

        {/* Scanner Controls */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            onClick={() => setSoundAlert(!soundAlert)}
            style={{
              backgroundColor: soundAlert ? '#172554' : '#0f172a',
              color: soundAlert ? '#38bdf8' : '#64748b',
              border: `1px solid ${soundAlert ? '#38bdf8' : '#1e293b'}`,
              borderRadius: '6px',
              padding: '6px 12px',
              fontSize: '10px',
              fontWeight: 'bold',
              fontFamily: 'monospace',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            {soundAlert ? <Volume2 size={14} /> : <VolumeX size={14} />}
            ALARM {soundAlert ? 'ON' : 'MUTED'}
          </button>

          <button
            onClick={() => setIsScanning(!isScanning)}
            style={{
              backgroundColor: isScanning ? '#064e3b' : '#1e1b4b',
              color: isScanning ? '#10b981' : '#a5b4fc',
              border: `1px solid ${isScanning ? '#10b981' : '#6366f1'}`,
              borderRadius: '6px',
              padding: '6px 14px',
              fontSize: '10px',
              fontWeight: 'bold',
              fontFamily: 'monospace',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Activity size={14} />
            {isScanning ? 'SCANNER ACTIVE' : 'RESUME SCAN'}
          </button>
        </div>
      </div>

      {/* Main Scanner Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        
        {/* 1. Radar View Canvas */}
        <div style={{ backgroundColor: '#030712', borderRadius: '12px', padding: '16px', border: '1px solid #1e293b', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden', minHeight: '220px' }}>
          
          {/* Radar Circle */}
          <div style={{ width: '180px', height: '180px', borderRadius: '50%', border: `1px solid ${latestEmergencySOS ? '#ef444466' : '#00f0ff44'}`, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#050810' }}>
            
            <div style={{ width: '110px', height: '110px', borderRadius: '50%', border: '1px dashed #00f0ff22' }} />
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#10b981', boxShadow: '0 0 10px #10b981', position: 'absolute' }} />

            {/* CSS GPU-Accelerated Radar Animation */}
            <style>{`
              @keyframes radarSweep {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
              }
            `}</style>
            <div
              style={{
                position: 'absolute',
                width: '90px',
                height: '2px',
                backgroundColor: latestEmergencySOS ? '#ef4444' : '#00f0ff',
                top: '90px',
                left: '90px',
                transformOrigin: '0% 50%',
                animation: isScanning ? 'radarSweep 3s linear infinite' : 'none',
                boxShadow: latestEmergencySOS ? '0 0 8px #ef4444' : '0 0 8px #00f0ff',
              }}
            />


            {/* Render Nodes on Radar */}
            {tickets.map((t, i) => {
              const isEmergency = t.priorityLevel >= 2;
              const angle = (i * 70 + 45) * (Math.PI / 180);
              const r = 40 + (i * 20);
              const x = 90 + r * Math.cos(angle);
              const y = 90 + r * Math.sin(angle);
              return (
                <div
                  key={t.id}
                  style={{
                    position: 'absolute',
                    left: `${x}px`,
                    top: `${y}px`,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    transform: 'translate(-50%, -50%)',
                    zIndex: 10,
                  }}
                >
                  <div
                    style={{
                      width: isEmergency ? '12px' : '8px',
                      height: isEmergency ? '12px' : '8px',
                      borderRadius: '50%',
                      backgroundColor: isEmergency ? '#ef4444' : '#10b981',
                      boxShadow: isEmergency ? '0 0 12px #ef4444' : '0 0 6px #10b981',
                    }}
                  />
                  <span
                    style={{
                      fontSize: '8px',
                      fontFamily: 'monospace',
                      color: isEmergency ? '#fca5a5' : '#a7f3d0',
                      backgroundColor: '#000000bb',
                      padding: '1px 4px',
                      borderRadius: '3px',
                      whiteSpace: 'nowrap',
                      marginTop: '2px',
                      border: `1px solid ${isEmergency ? '#ef4444' : '#10b981'}`,
                    }}
                  >
                    {t.senderId}
                  </span>
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', gap: '16px', marginTop: '12px', fontFamily: 'monospace', fontSize: '10px', color: '#64748b' }}>
            <span>NEARBY NODES: <strong style={{ color: '#10b981' }}>{tickets.length} ACTIVE</strong></span>
            <span>CRITICAL ALERTS: <strong style={{ color: latestEmergencySOS ? '#ef4444' : '#64748b' }}>{activeCriticalSOSTickets.length}</strong></span>
          </div>
        </div>

        {/* 2. Geolocation / Warning Display Card */}
        {latestEmergencySOS ? (
          /* RED WARNING CARD - TRIGGERED ONLY ON ACTUAL EMERGENCY SOS */
          <div style={{ backgroundColor: '#450a0a', borderRadius: '12px', border: '1px solid #ef4444', padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxShadow: '0 4px 20px rgba(239,68,68,0.4)' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontSize: '10px', fontWeight: 'bold', fontFamily: 'monospace', backgroundColor: '#dc2626', color: '#ffffff', borderRadius: '4px', padding: '3px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <AlertTriangle size={12} /> 🚨 EMERGENCY SOS WARNING RECEIVED
                </span>

                <span style={{ fontSize: '10px', fontFamily: 'monospace', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <ShieldCheck size={12} /> FLETCHER-16 VALID
                </span>
              </div>

              <h3 style={{ fontSize: '16px', fontWeight: '900', fontFamily: 'monospace', color: '#ffffff', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>PERSON / SENDER: {latestEmergencySOS.senderId}</span>
                <span style={{ fontSize: '11px', color: '#ef4444' }}>⚡ PRIORITY {latestEmergencySOS.priorityLevel}</span>
              </h3>

              {/* Multi-Victim Selector Tabs if multiple devices are sending SOS */}
              {activeCriticalSOSTickets.length > 1 && (
                <div style={{ display: 'flex', gap: '6px', marginBottom: '10px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '9px', fontFamily: 'monospace', color: '#fca5a5', width: '100%' }}>ACTIVE EMERGENCY VICTIMS ({activeCriticalSOSTickets.length}):</span>
                  {activeCriticalSOSTickets.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setSoundAlert(true)}
                      style={{
                        backgroundColor: t.id === latestEmergencySOS.id ? '#dc2626' : '#7f1d1d',
                        color: '#ffffff',
                        border: `1px solid ${t.id === latestEmergencySOS.id ? '#ffffff' : '#ef4444'}`,
                        borderRadius: '4px',
                        padding: '4px 8px',
                        fontSize: '9px',
                        fontFamily: 'monospace',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                      }}
                    >
                      🚨 {t.senderId}
                    </button>
                  ))}
                </div>
              )}

              {/* Custom Message */}
              <div style={{ backgroundColor: '#000000aa', borderRadius: '8px', padding: '10px', border: '1px solid #ef444488', marginBottom: '10px' }}>
                <div style={{ color: '#fca5a5', fontSize: '8px', fontFamily: 'monospace', marginBottom: '2px' }}>
                  EMERGENCY SOS MESSAGE
                </div>
                <div style={{ color: '#ffffff', fontSize: '13px', fontWeight: 'bold', fontFamily: 'monospace' }}>
                  "{latestEmergencySOS.message || 'CRITICAL MEDICAL SOS: Immediate Assistance Required'}"
                </div>
              </div>

              {/* Multi-Hop BLE Owner Relay Trace */}
              {latestEmergencySOS.route_trace && latestEmergencySOS.route_trace.length > 0 && (
                <div style={{ backgroundColor: '#00000088', borderRadius: '8px', padding: '8px 10px', border: '1px solid #00f0ff44', marginBottom: '10px' }}>
                  <div style={{ color: '#00f0ff', fontSize: '9px', fontWeight: 'bold', fontFamily: 'monospace', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Navigation size={10} /> MULTI-HOP BLE RELAY PATH (BLUETOOTH OWNER HOP TRACE)
                  </div>
                  <div style={{ color: '#ffffff', fontSize: '11px', fontWeight: 'bold', fontFamily: 'monospace', letterSpacing: '0.5px' }}>
                    {latestEmergencySOS.route_trace.join(' ➔ ')}
                  </div>
                </div>
              )}

              {/* Exact GPS Location */}
              <div style={{ backgroundColor: '#00000055', borderRadius: '8px', padding: '10px', border: '1px solid #ffffff11' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#38bdf8', fontSize: '10px', fontWeight: 'bold', fontFamily: 'monospace', marginBottom: '4px' }}>
                  <MapPin size={12} /> GEOLOCATED TARGET COORDINATES
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontFamily: 'monospace' }}>
                  <div>
                    <div style={{ color: '#64748b', fontSize: '8px' }}>LATITUDE</div>
                    <div style={{ color: '#ffffff', fontSize: '12px', fontWeight: 'bold' }}>
                      {Math.abs(latestEmergencySOS.latitude).toFixed(6)}° {latestEmergencySOS.latitude >= 0 ? 'N' : 'S'}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: '#64748b', fontSize: '9px' }}>LONGITUDE</div>
                    <div style={{ color: '#ffffff', fontSize: '12px', fontWeight: 'bold' }}>
                      {Math.abs(latestEmergencySOS.longitude).toFixed(6)}° {latestEmergencySOS.longitude >= 0 ? 'E' : 'W'}
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: '6px', paddingTop: '4px', borderTop: '1px dashed #ffffff22', display: 'flex', justifyContent: 'space-between', fontFamily: 'monospace', fontSize: '9px' }}>
                  <span style={{ color: '#94a3b8' }}>DISTANCE: <strong style={{ color: '#00f0ff' }}>{latestEmergencySOS.distanceKm} km ({Math.round(latestEmergencySOS.distanceKm * 1000)}m)</strong></span>
                  <span style={{ color: '#94a3b8' }}>BATTERY: <strong style={{ color: '#10b981' }}>{latestEmergencySOS.batteryPct}%</strong></span>
                </div>
              </div>
            </div>

            <button
              onClick={() => onDispatchTicket && onDispatchTicket(latestEmergencySOS.id)}
              style={{
                backgroundColor: '#dc2626',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '10px',
                marginTop: '12px',
                fontSize: '11px',
                fontWeight: '900',
                fontFamily: 'monospace',
                letterSpacing: '1px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 14px rgba(220, 38, 38, 0.5)',
              }}
            >
              <Navigation size={14} /> DISPATCH RESCUE TEAM TO GPS TARGET
            </button>
          </div>
        ) : (
          /* GREEN NORMAL OPERATIONAL CARD - WHEN NEARBY AETHERIS PHONES ARE WORKING NORMALLY */
          <div style={{ backgroundColor: '#022c22', borderRadius: '12px', border: '1px solid #10b981', padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <CheckCircle2 size={18} color="#10b981" />
                <span style={{ fontSize: '11px', fontWeight: 'bold', fontFamily: 'monospace', color: '#10b981', letterSpacing: '1px' }}>
                  ALL NEARBY MESH NODES OPERATING NORMALLY
                </span>
              </div>

              <p style={{ color: '#a7f3d0', fontFamily: 'monospace', fontSize: '11px', lineHeight: '1.5', margin: '0 0 14px 0' }}>
                Nearby devices with Aetheris open are currently exchanging routine BLE heartbeat telemetry. System is operating normally with 0 active warnings.
              </p>

              {normalMeshNodes.length > 0 && (
                <div style={{ backgroundColor: '#00000044', borderRadius: '8px', padding: '10px', border: '1px solid #10b98144' }}>
                  <div style={{ color: '#64748b', fontSize: '9px', fontFamily: 'monospace', marginBottom: '4px' }}>
                    ACTIVE ROUTINE BEACON NODES IN RANGE ({normalMeshNodes.length}):
                  </div>
                  {normalMeshNodes.map((n) => (
                    <div key={n.id} style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'monospace', fontSize: '10px', color: '#38bdf8', paddingTop: '2px', paddingBottom: '2px' }}>
                      <span>● {n.senderId}</span>
                      <span style={{ color: '#10b981' }}>⚡ {n.batteryPct}% | GPS LOCKED</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ padding: '8px', backgroundColor: '#064e3b44', borderRadius: '6px', border: '1px solid #059669', textAlign: 'center', color: '#10b981', fontFamily: 'monospace', fontSize: '10px', marginTop: '12px' }}>
              🛡️ EMERGENCY WARNING SYSTEM READY - STANDBY MODE
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
