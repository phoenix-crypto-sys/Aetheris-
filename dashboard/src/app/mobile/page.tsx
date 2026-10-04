'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { getRealWorldLocation } from '../../services/webBluetoothReceiver';
import {
  packBinaryPacket,
  unpackBinaryPacket,
  hashSender16,
  hashStringUint32,
} from '../../services/binaryPacket';

export default function MobileAppPage() {
  const [senderName, setSenderName] = useState('Room 222 - Victim (Wall Blocked)');
  const [customMessage, setCustomMessage] = useState('CRITICAL: Trapped in Room 222 behind concrete walls, need extraction');
  const [priorityLevel, setPriorityLevel] = useState<number>(3); // 3=Critical, 2=High
  const [sosActive, setSosActive] = useState(false);
  const [packetCount, setPacketCount] = useState(0);
  const [batteryPct, setBatteryPct] = useState(88);
  const [lat, setLat] = useState(37.778500);
  const [lng, setLng] = useState(-122.415200);

  const hash32 = hashStringUint32(senderName);
  const hash32Hex = '0x' + hash32.toString(16).toUpperCase().padStart(8, '0');
  const senderHash16 = hashSender16(senderName);
  const senderHash16Hex = '0x' + senderHash16.toString(16).toUpperCase().padStart(4, '0');

  const currentTrace = useMemo(() => {
    return senderName.includes('222')
      ? [senderName, 'Room 322 (Intermediate Mesh Relay)', 'Room 422 (Web Command EOC Sink)']
      : senderName.includes('322')
      ? [senderName, 'Room 422 (Web Command EOC Sink)']
      : [senderName, 'Nayan\'s Field Relay (BLE Mesh)', 'Aarav\'s Rescue Bridge (LoRa)', 'WEB-COMMAND-SINK'];
  }, [senderName]);

  // Compute live 18-byte binary packet using real packBinaryPacket
  const livePacketBytes = useMemo(() => {
    return packBinaryPacket({
      packetId: packetCount > 0 ? packetCount : 1,
      priorityLevel,
      latitude: lat,
      longitude: lng,
      batteryPct,
      senderId: senderName,
      customSenderName: senderName,
      senderHash: senderHash16,
      hopCount: currentTrace.length - 1,
      ttl: 24,
    });
  }, [packetCount, priorityLevel, lat, lng, batteryPct, senderName, senderHash16, currentTrace.length]);

  const liveDecoded = useMemo(() => {
    return unpackBinaryPacket(livePacketBytes);
  }, [livePacketBytes]);

  const syncRealLocationAndBattery = async () => {
    if (typeof navigator !== 'undefined' && 'getBattery' in navigator) {
      try {
        const batt = await (navigator as any).getBattery();
        if (batt && typeof batt.level === 'number') {
          setBatteryPct(Math.round(batt.level * 100));
        }
      } catch (e) {}
    }

    const loc = await getRealWorldLocation();
    if (loc) {
      setLat(loc.lat);
      setLng(loc.lng);
    }
  };

  useEffect(() => {
    syncRealLocationAndBattery();
  }, []);

  useEffect(() => {
    let interval: any;
    if (sosActive) {
      interval = setInterval(async () => {
        const nextSeq = (packetCount + 1) & 0xFFFF;
        setPacketCount(nextSeq);
        setLat(prev => Number((prev + (Math.random() * 0.00002 - 0.00001)).toFixed(6)));
        setLng(prev => Number((prev + (Math.random() * 0.00002 - 0.00001)).toFixed(6)));

        try {
          await fetch('/api/sos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'SOS',
              packetId: nextSeq,
              senderId: senderName,
              customSenderName: senderName,
              senderHash32: hash32,
              senderHash: senderHash16,
              priorityLevel,
              latitude: lat,
              longitude: lng,
              batteryPct,
              hopCount: currentTrace.length - 1,
              ttl: liveDecoded.ttl,
              hexDump: liveDecoded.hexDump,
              message: customMessage,
              route_trace: currentTrace,
            }),
          });
        } catch (e) {}
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [sosActive, senderName, priorityLevel, customMessage, lat, lng, batteryPct, packetCount, currentTrace, hash32, senderHash16, liveDecoded]);

  const handleToggleSOS = async () => {
    const newState = !sosActive;
    setSosActive(newState);

    if (typeof window !== 'undefined' && 'navigator' in window && 'vibrate' in navigator) {
      try {
        navigator.vibrate([0, 500, 200, 500]);
      } catch (e) {}
    }

    if (newState) {
      const nextSeq = (packetCount + 1) & 0xFFFF;
      setPacketCount(nextSeq);
      try {
        await fetch('/api/sos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'SOS',
            packetId: nextSeq,
            senderId: senderName,
            customSenderName: senderName,
            senderHash32: hash32,
            senderHash: senderHash16,
            priorityLevel,
            latitude: lat,
            longitude: lng,
            batteryPct,
            hopCount: currentTrace.length - 1,
            ttl: liveDecoded.ttl,
            hexDump: liveDecoded.hexDump,
            message: customMessage,
            route_trace: currentTrace,
            transport: 'LAN-sim',
          }),
        });
      } catch (e) {}
    } else {
      try {
        await fetch('/api/sos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'CANCEL_SOS',
            senderId: senderName,
          }),
        });
      } catch (e) {}
    }
  };

  return (
    <div style={{ backgroundColor: sosActive ? '#180404' : '#050810', minHeight: '100vh', color: '#f8fafc', padding: '16px', fontFamily: 'monospace', maxWidth: '480px', margin: '0 auto' }}>
      
      {/* Top Mobile Header */}
      <div style={{ textAlign: 'center', padding: '12px 0', borderBottom: '1px solid #1e293b', marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: sosActive ? '#ef4444' : '#10b981', display: 'inline-block' }} />
          <h1 style={{ fontSize: '15px', fontWeight: '900', letterSpacing: '1px', margin: 0 }}>AETHERIS MOBILE HELPER</h1>
        </div>
        <p style={{ fontSize: '10px', color: '#00f0ff', margin: 0, letterSpacing: '1px' }}>
          {sosActive ? '🚨 CRITICAL SOS BROADCAST ACTIVE' : 'PHONE-TO-PHONE BLE MESH ONLINE'}
        </p>
        <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ backgroundColor: '#0f172a', border: '1px solid #38bdf8', color: '#38bdf8', fontSize: '9px', fontWeight: 'bold', padding: '3px 8px', borderRadius: '6px' }}>
            Transport: Simulated mesh over LAN (WebSocket/HTTP)
          </span>
          <a
            href="/"
            style={{ backgroundColor: '#00f0ff18', border: '1px solid #00f0ff', color: '#00f0ff', fontSize: '9px', fontWeight: 'bold', padding: '3px 8px', borderRadius: '6px', textDecoration: 'none' }}
          >
            🖥️ EOC DASHBOARD
          </a>
        </div>
      </div>

      {/* Identity & Custom Sender Input */}
      <div style={{ backgroundColor: '#0b1329', borderRadius: '14px', padding: '14px', marginBottom: '14px', border: '1px solid #00f0ff55' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{ color: '#00f0ff', fontSize: '11px', fontWeight: 'bold' }}>🆔 SENDER IDENTITY & ROOM PRESETS</span>
          <span style={{ color: '#10b981', fontSize: '8px', border: '1px solid #10b981', borderRadius: '4px', padding: '2px 6px', fontWeight: 'bold' }}>32-BIT FNV-1a TRUNCATED TO 16 BITS</span>
        </div>

        <input
          type="text"
          value={senderName}
          onChange={(e) => setSenderName(e.target.value)}
          placeholder="Type custom identity..."
          style={{ width: '100%', backgroundColor: '#050810', border: '1px solid #00f0ff88', borderRadius: '8px', padding: '10px', color: '#ffffff', fontSize: '13px', fontWeight: 'bold', fontFamily: 'monospace', marginBottom: '10px', boxSizing: 'border-box' }}
        />

        <div style={{ fontSize: '9px', color: '#64748b', marginBottom: '6px' }}>QUICK PRESETS:</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
          {['Room 222 - Victim (Wall Blocked)', 'Room 322 - Mesh Relay', 'Rescue Unit 1', 'John Doe - Victim'].map((preset) => (
            <button
              key={preset}
              onClick={() => setSenderName(preset)}
              style={{
                backgroundColor: senderName === preset ? '#00f0ff22' : '#0f172a',
                color: senderName === preset ? '#00f0ff' : '#94a3b8',
                border: `1px solid ${senderName === preset ? '#00f0ff' : '#334155'}`,
                borderRadius: '6px',
                padding: '4px 8px',
                fontSize: '9px',
                fontWeight: 'bold',
                cursor: 'pointer',
                fontFamily: 'monospace',
              }}
            >
              {preset}
            </button>
          ))}
        </div>

        <div style={{ backgroundColor: '#050810', borderRadius: '8px', padding: '8px', border: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', fontSize: '9px' }}>
          <div>
            <span style={{ color: '#64748b', display: 'block' }}>32-BIT FNV-1a</span>
            <span style={{ color: '#10b981', fontWeight: 'bold' }}>{hash32Hex}</span>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ color: '#64748b', display: 'block' }}>WIRE HASH (16-BIT)</span>
            <span style={{ color: '#38bdf8', fontWeight: 'bold' }}>{senderHash16Hex} ({senderHash16})</span>
          </div>
        </div>
      </div>

      {/* Emergency Message Details */}
      <div style={{ backgroundColor: '#090d16', borderRadius: '14px', padding: '14px', marginBottom: '14px', border: '1px solid #1e293b' }}>
        <span style={{ color: '#64748b', fontSize: '10px', fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>EMERGENCY DETAILS & CUSTOM MESSAGE</span>

        <textarea
          value={customMessage}
          onChange={(e) => setCustomMessage(e.target.value)}
          placeholder="Type emergency extraction message..."
          style={{ width: '100%', minHeight: '54px', backgroundColor: '#050810', border: '1px solid #334155', borderRadius: '8px', padding: '8px', color: '#f8fafc', fontSize: '11px', fontFamily: 'monospace', boxSizing: 'border-box', marginBottom: '10px' }}
        />

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setPriorityLevel(3)}
            style={{
              flex: 1,
              backgroundColor: priorityLevel === 3 ? '#450a0a' : '#0f172a',
              color: priorityLevel === 3 ? '#fca5a5' : '#64748b',
              border: `1px solid ${priorityLevel === 3 ? '#ef4444' : '#334155'}`,
              borderRadius: '6px',
              padding: '8px',
              fontSize: '10px',
              fontWeight: 'bold',
              cursor: 'pointer',
              fontFamily: 'monospace',
            }}
          >
            🚨 CRITICAL SOS
          </button>
          <button
            onClick={() => setPriorityLevel(2)}
            style={{
              flex: 1,
              backgroundColor: priorityLevel === 2 ? '#451a03' : '#0f172a',
              color: priorityLevel === 2 ? '#fde68a' : '#64748b',
              border: `1px solid ${priorityLevel === 2 ? '#f59e0b' : '#334155'}`,
              borderRadius: '6px',
              padding: '8px',
              fontSize: '10px',
              fontWeight: 'bold',
              cursor: 'pointer',
              fontFamily: 'monospace',
            }}
          >
            ⚠️ HIGH ALERT
          </button>
        </div>
      </div>

      {/* 1-Tap SOS Button */}
      <div style={{ textAlign: 'center', margin: '20px 0' }}>
        <button
          onClick={handleToggleSOS}
          style={{
            width: '180px',
            height: '180px',
            borderRadius: '50%',
            backgroundColor: sosActive ? '#dc2626' : '#0284c7',
            color: '#ffffff',
            border: `4px solid ${sosActive ? '#fca5a5' : '#38bdf8'}`,
            display: 'inline-flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: sosActive ? '0 0 30px rgba(239,68,68,0.6)' : '0 0 20px rgba(2,132,199,0.4)',
            transition: 'all 0.3s ease',
          }}
        >
          <span style={{ fontSize: '38px', marginBottom: '4px' }}>🚨</span>
          <span style={{ fontSize: '16px', fontWeight: '900', letterSpacing: '1px' }}>{sosActive ? 'CANCEL SOS' : 'TRANSMIT SOS'}</span>
          <span style={{ fontSize: '8px', fontWeight: 'bold', opacity: 0.8, marginTop: '2px' }}>AUTOMATIC BLE MESH BEACON</span>
        </button>
      </div>

      {/* Telemetry Card */}
      <div style={{ backgroundColor: '#090d16', borderRadius: '14px', padding: '14px', border: '1px solid #1e293b' }}>
        <span style={{ color: '#64748b', fontSize: '10px', fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>GPS LOCK & MESH TELEMETRY</span>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px', fontSize: '10px' }}>
          <div style={{ backgroundColor: '#0f172a', borderRadius: '6px', padding: '8px', border: '1px solid #1e293b' }}>
            <span style={{ color: '#64748b', display: 'block', fontSize: '8px' }}>LATITUDE</span>
            <strong style={{ color: '#f8fafc' }}>{Math.abs(lat).toFixed(6)}° {lat >= 0 ? 'N' : 'S'}</strong>
          </div>
          <div style={{ backgroundColor: '#0f172a', borderRadius: '6px', padding: '8px', border: '1px solid #1e293b' }}>
            <span style={{ color: '#64748b', display: 'block', fontSize: '8px' }}>LONGITUDE</span>
            <strong style={{ color: '#f8fafc' }}>{Math.abs(lng).toFixed(6)}° {lng >= 0 ? 'E' : 'W'}</strong>
          </div>
          <div style={{ backgroundColor: '#0f172a', borderRadius: '6px', padding: '8px', border: '1px solid #1e293b' }}>
            <span style={{ color: '#64748b', display: 'block', fontSize: '8px' }}>BATTERY</span>
            <strong style={{ color: '#10b981' }}>⚡ {batteryPct}%</strong>
          </div>
          <div style={{ backgroundColor: '#0f172a', borderRadius: '6px', padding: '8px', border: '1px solid #1e293b' }}>
            <span style={{ color: '#64748b', display: 'block', fontSize: '8px' }}>PACKETS</span>
            <strong style={{ color: '#38bdf8' }}>{packetCount} TX</strong>
          </div>
        </div>

        <div style={{ backgroundColor: '#030712', borderRadius: '8px', padding: '8px', border: '1px solid #1e293b', marginBottom: '8px' }}>
          <span style={{ color: '#64748b', fontSize: '8px', display: 'block', marginBottom: '2px' }}>MULTI-HOP BLE ROOM HOP PATH</span>
          <span style={{ color: '#00f0ff', fontSize: '10px', fontWeight: 'bold' }}>{currentTrace.join(' ➔ ')}</span>
        </div>

        {/* 18-Byte Binary Struct Dump Card (Real packBinaryPacket output) */}
        <div style={{ backgroundColor: '#030712', borderRadius: '8px', padding: '10px', border: '1px solid #1e293b', marginBottom: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <span style={{ color: '#64748b', fontSize: '8px', fontWeight: 'bold' }}>18-BYTE BINARY STRUCT DUMP</span>
            <span style={{ color: liveDecoded.isValid ? '#10b981' : '#ef4444', fontSize: '8px', fontWeight: 'bold' }}>
              {liveDecoded.isValid ? 'FLETCHER-16 CRC VALID' : 'CHECKSUM ERROR'}
            </span>
          </div>
          <div style={{ color: '#38bdf8', fontSize: '10px', fontWeight: 'bold', wordBreak: 'break-all', letterSpacing: '1px' }}>
            {liveDecoded.hexDump}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '8px', marginTop: '4px' }}>
            <span>CRC: 0x{liveDecoded.checksum.toString(16).toUpperCase().padStart(4, '0')}</span>
            <span>TTL: {liveDecoded.ttl} Hops</span>
            <span>Wire Hash: 0x{liveDecoded.senderIdHash.toString(16).toUpperCase().padStart(4, '0')}</span>
          </div>
        </div>

        {/* Interactive Location & Battery Controls */}
        <div style={{ backgroundColor: '#050810', borderRadius: '8px', padding: '10px', border: '1px solid #1e293b', marginBottom: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ color: '#00f0ff', fontSize: '9px', fontWeight: 'bold' }}>📍 TELEMETRY & GPS CONTROLS</span>
            <button
              onClick={syncRealLocationAndBattery}
              style={{ backgroundColor: '#00f0ff22', color: '#00f0ff', border: '1px solid #00f0ff', borderRadius: '4px', padding: '2px 6px', fontSize: '8px', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'monospace' }}
            >
              📍 GET REAL GPS & BATTERY
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '6px' }}>
            <div>
              <span style={{ color: '#64748b', fontSize: '8px', display: 'block' }}>LATITUDE:</span>
              <input
                type="number"
                step="0.0001"
                value={lat}
                onChange={(e) => setLat(parseFloat(e.target.value) || 0)}
                style={{ width: '100%', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '4px', padding: '4px', color: '#ffffff', fontSize: '10px', fontFamily: 'monospace', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <span style={{ color: '#64748b', fontSize: '8px', display: 'block' }}>LONGITUDE:</span>
              <input
                type="number"
                step="0.0001"
                value={lng}
                onChange={(e) => setLng(parseFloat(e.target.value) || 0)}
                style={{ width: '100%', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '4px', padding: '4px', color: '#ffffff', fontSize: '10px', fontFamily: 'monospace', boxSizing: 'border-box' }}
              />
            </div>
          </div>

          <div>
            <span style={{ color: '#64748b', fontSize: '8px', display: 'block', marginBottom: '4px' }}>BATTERY LEVEL:</span>
            <div style={{ display: 'flex', gap: '4px' }}>
              {[100, 85, 50, 20].map((b) => (
                <button
                  key={b}
                  onClick={() => setBatteryPct(b)}
                  style={{
                    flex: 1,
                    backgroundColor: batteryPct === b ? '#10b98122' : '#0f172a',
                    color: batteryPct === b ? '#10b981' : '#94a3b8',
                    border: `1px solid ${batteryPct === b ? '#10b981' : '#334155'}`,
                    borderRadius: '4px',
                    padding: '3px 0',
                    fontSize: '9px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    fontFamily: 'monospace',
                  }}
                >
                  {b}%
                </button>
              ))}
            </div>
          </div>
        </div>

        <div style={{ backgroundColor: sosActive ? '#450a0a' : '#0369a122', borderRadius: '6px', padding: '8px', border: `1px solid ${sosActive ? '#ef4444' : '#0284c7'}`, fontSize: '9px', textAlign: 'center' }}>
          <span style={{ color: sosActive ? '#fca5a5' : '#38bdf8', fontWeight: 'bold' }}>
            {sosActive ? '🚨 SOS TRANSMITTING TO WEB COMMAND CENTER' : '📶 ADAPTIVE MESH STANDBY: MAX TX POWER (+4dBm)'}
          </span>
        </div>
      </div>

    </div>
  );
}
