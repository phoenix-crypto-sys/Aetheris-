import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, SafeAreaView, StatusBar, Platform, Animated, Alert, ScrollView, TextInput } from 'react-native';
import { packBinaryPacket, unpackBinaryPacket, hashStringUint32, encodeCustomSenderNameBytes } from './src/services/binaryPacket';
import { bleNativeDriver, AETHERIS_SERVICE_UUID } from './src/services/bleNativeDriver';
import { networkBridge } from './src/services/networkBridge';

interface DeviceProfile {
  id: string;
  ownerName: string;
  deviceName: string;
  role: 'VICTIM' | 'RELAY' | 'BRIDGE';
  batteryPct: number;
  location: { lat: number; lng: number };
  defaultMessage: string;
}

const DEVICE_PROFILES: DeviceProfile[] = [
  {
    id: "Rescue Unit 1",
    ownerName: "Rescue Unit 1",
    deviceName: "Rescue Unit 1",
    role: 'VICTIM',
    batteryPct: 95,
    location: { lat: 37.774900, lng: -122.419400 },
    defaultMessage: 'CRITICAL: Trapped under debris, need medical & extraction team',
  },
  {
    id: "John Doe - Victim",
    ownerName: "John Doe - Victim",
    deviceName: "John Doe - Victim",
    role: 'VICTIM',
    batteryPct: 88,
    location: { lat: 37.778500, lng: -122.415200 },
    defaultMessage: 'HIGH ALERT: Injured leg, need medical evacuation team',
  },
  {
    id: "Nayan - Field Relay",
    ownerName: "Nayan",
    deviceName: "Nayan - Field Relay",
    role: 'RELAY',
    batteryPct: 98,
    location: { lat: 37.772100, lng: -122.422000 },
    defaultMessage: 'FIELD HELPER: First Responder Command Relay Sink Active',
  },
];

export default function App() {
  const [activeProfile, setActiveProfile] = useState<DeviceProfile>(DEVICE_PROFILES[0]);
  const [sosActive, setSosActive] = useState(false);
  const [pulseAnim] = useState(new Animated.Value(1));

  // Custom Sender Identity State (Startup Settings Variable)
  const [customSenderName, setCustomSenderName] = useState<string>("Rescue Unit 1");
  const [customMessage, setCustomMessage] = useState<string>(DEVICE_PROFILES[0].defaultMessage);
  const [priorityLevel, setPriorityLevel] = useState<number>(3); // 3=Critical, 2=High, 1=Medium

  // Active Node Identity & Field Peer Devices
  const [activeDeviceId, setActiveDeviceId] = useState<string>("Rescue Unit 1");
  const [routeTrace, setRouteTrace] = useState<string[]>([
    "Rescue Unit 1 (Victim)",
    "Nayan - Field Relay",
    "Web Command Center (Rescue EOC)"
  ]);

  const [meshPeers, setMeshPeers] = useState<Array<{ id: string; owner: string; rssi: number; hops: number; status: string; distMeters: number }>>([
    { id: "Nayan's Galaxy S24", owner: 'Nayan', rssi: -42, hops: 1, status: 'CONNECTED (GATT MESH)', distMeters: 6 },
    { id: "Aarav's Pixel 8 Pro", owner: 'Aarav', rssi: -58, hops: 2, status: 'CONNECTED (RESCUE BRIDGE)', distMeters: 14 },
  ]);

  // Locked Telemetry Data
  const [location, setLocation] = useState<{ lat: number; lng: number }>(DEVICE_PROFILES[0].location);
  const [batteryPct, setBatteryPct] = useState(92);
  const [packetCount, setPacketCount] = useState(0);
  const [lastHexDump, setLastHexDump] = useState<string>('');
  const [checksumStatus, setChecksumStatus] = useState<string>('FLETCHER-16 VALID');
  const [webBridgeConnected, setWebBridgeConnected] = useState(false);

  // Incoming peer emergency alert state
  const [peerAlert, setPeerAlert] = useState<{ senderId: string; message: string; priorityLevel: number } | null>(null);

  // Pulsating animation for SOS button
  useEffect(() => {
    let animation: Animated.CompositeAnimation;
    if (sosActive) {
      animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.16, duration: 650, useNativeDriver: Platform.OS !== 'web' }),
          Animated.timing(pulseAnim, { toValue: 1.0, duration: 650, useNativeDriver: Platform.OS !== 'web' }),
        ])
      );
      animation.start();
    } else {
      pulseAnim.setValue(1);
    }
    return () => {
      if (animation) animation.stop();
    };
  }, [sosActive]);

  const syncRealLocationAndBatteryApp = async () => {
    if (typeof navigator !== 'undefined' && 'getBattery' in navigator) {
      try {
        const batt = await (navigator as any).getBattery();
        if (batt && typeof batt.level === 'number') {
          setBatteryPct(Math.round(batt.level * 100));
        }
      } catch (e) {}
    }

    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (pos && pos.coords) {
            setLocation({
              lat: Number(pos.coords.latitude.toFixed(6)),
              lng: Number(pos.coords.longitude.toFixed(6)),
            });
          }
        },
        async () => {
          try {
            const res = await fetch('https://ipwho.is/');
            if (res.ok) {
              const data = await res.json();
              if (data && data.success !== false && typeof data.latitude === 'number') {
                setLocation({
                  lat: Number(data.latitude.toFixed(6)),
                  lng: Number(data.longitude.toFixed(6)),
                });
              }
            }
          } catch (e) {}
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    } else {
      try {
        const res = await fetch('https://ipwho.is/');
        if (res.ok) {
          const data = await res.json();
          if (data && data.success !== false && typeof data.latitude === 'number') {
            setLocation({
              lat: Number(data.latitude.toFixed(6)),
              lng: Number(data.longitude.toFixed(6)),
            });
          }
        }
      } catch (e) {}
    }
  };

  useEffect(() => {
    syncRealLocationAndBatteryApp();
  }, []);

  // Check connection to Web Command Center API
  useEffect(() => {
    const checkBridge = async () => {
      const connected = await networkBridge.checkConnection();
      setWebBridgeConnected(connected);
    };
    checkBridge();
    const timer = setInterval(checkBridge, 3000);
    return () => clearInterval(timer);
  }, []);

  // Listen to peer BLE Mesh SOS signals (Multi-Device Bluetooth Sync)
  useEffect(() => {
    const unsubSOS = bleNativeDriver.subscribeMeshSOS((payload) => {
      if (payload.senderId !== activeDeviceId) {
        // Trigger 1.5s vibration on receiving peer SOS signal
        bleNativeDriver.triggerVibration(1500);

        setPeerAlert({
          senderId: payload.senderId,
          message: payload.message,
          priorityLevel: payload.priorityLevel,
        });

        // Update mesh peers list to reflect active peer emergency
        setMeshPeers(prev => {
          const exists = prev.find(p => p.id === payload.senderId);
          if (exists) {
            return prev.map(p => p.id === payload.senderId ? { ...p, status: '🚨 CRITICAL SOS BROADCASTING', rssi: -32 } : p);
          }
          return [{ id: payload.senderId, owner: payload.senderId.split("'")[0] || 'Peer Owner', rssi: -35, hops: 1, status: '🚨 CRITICAL SOS BROADCASTING', distMeters: 4 }, ...prev];
        });

        // Construct multi-hop owner relay path
        const hopTrace = [payload.senderId, activeDeviceId, 'Web Command Center'];

        // Relay peer SOS to Web Command Center via multi-hop bridge
        networkBridge.relaySOSToWebCommand({
          packetId: Math.floor(Math.random() * 1000) + 1,
          senderId: payload.senderId,
          priorityLevel: payload.priorityLevel,
          latitude: payload.latitude,
          longitude: payload.longitude,
          batteryPct: payload.batteryPct,
          hopCount: 2,
          message: payload.message,
          route_trace: hopTrace,
        });
      }
    });

    const unsubCancel = bleNativeDriver.subscribeMeshSOSCancel((canceledSenderId) => {
      setPeerAlert(prev => prev && prev.senderId === canceledSenderId ? null : prev);
      setMeshPeers(prev => prev.map(p => p.id === canceledSenderId ? { ...p, status: 'CONNECTED (GATT MESH)' } : p));
    });

    return () => {
      unsubSOS();
      unsubCancel();
    };
  }, [activeDeviceId]);

  // Periodic BLE Advertising & Multi-Node SOS Relaying
  useEffect(() => {
    const intervalMs = sosActive ? 2500 : 8000;
    const interval = setInterval(async () => {
      const p = sosActive ? priorityLevel : 0;
      const nextSeq = packetCount + 1;

      // 1. Native BLE Peripheral Advertising
      const rawBytes = await bleNativeDriver.startAdvertisingSOS({
        latitude: location.lat,
        longitude: location.lng,
        batteryPct: batteryPct,
        priorityLevel: p,
        senderId: activeDeviceId,
        message: customMessage,
      });

      // 2. Decode & verify binary struct
      const decoded = unpackBinaryPacket(rawBytes);
      setLastHexDump(decoded.hexDump);
      setChecksumStatus(decoded.isValid ? 'FLETCHER-16 CRC VALID' : 'CHECKSUM ERROR');
      setPacketCount(nextSeq);

      // 3. Update route trace to reflect current device path
      const currentTrace = activeDeviceId.includes('222')
        ? [`${activeDeviceId} (Concrete Blocked)`, 'Room 322 (Intermediate Mesh Relay)', 'Room 422 (Web Command EOC Sink)']
        : activeDeviceId.includes('322')
        ? [`${activeDeviceId} (Mesh Relay)`, 'Room 422 (Web Command EOC Sink)']
        : activeDeviceId.includes('Nayan')
        ? [`${activeDeviceId} (Field Relay)`, "Aarav's Pixel 8 Pro (Rescue Bridge)", 'Web Command Center (Rescue EOC)']
        : activeDeviceId.includes('Aarav')
        ? [`${activeDeviceId} (Rescue Bridge)`, 'Web Command Center (Rescue EOC)']
        : [`${activeDeviceId} (Victim Beacon)`, "Nayan's Galaxy S24 (Field Relay)", "Aarav's Pixel 8 Pro (Rescue Bridge)", 'Web Command Center (Rescue EOC)'];
      setRouteTrace(currentTrace);

      // 4. Relay custom message + telemetry across mesh network to Web Command Center
      if (sosActive) {
        await networkBridge.relaySOSToWebCommand({
          packetId: nextSeq,
          senderId: activeDeviceId,
          priorityLevel: p,
          latitude: location.lat,
          longitude: location.lng,
          batteryPct: batteryPct,
          hopCount: currentTrace.length - 1,
          hexDump: decoded.hexDump,
          message: customMessage,
          route_trace: currentTrace,
        });

        // Jitter GPS slightly for realistic location movement only when active SOS
        setLocation(prev => ({
          lat: Number((prev.lat + (Math.random() * 0.00002 - 0.00001)).toFixed(6)),
          lng: Number((prev.lng + (Math.random() * 0.00002 - 0.00001)).toFixed(6)),
        }));
      }
    }, intervalMs);

    return () => {
      clearInterval(interval);
      bleNativeDriver.stopAdvertising();
    };
  }, [sosActive, activeDeviceId, priorityLevel, customMessage, location.lat, location.lng, batteryPct, packetCount]);

  const handleToggleSOS = async () => {
    const newState = !sosActive;
    setSosActive(newState);

    if (newState) {
      // 1. Trigger 1.5 seconds phone vibration
      bleNativeDriver.triggerVibration(1500);

      // Construct owner trace
      const currentTrace = activeDeviceId.includes('222')
        ? [`${activeDeviceId} (Concrete Blocked)`, 'Room 322 (Intermediate Mesh Relay)', 'Room 422 (Web Command EOC Sink)']
        : activeDeviceId.includes('322')
        ? [`${activeDeviceId} (Mesh Relay)`, 'Room 422 (Web Command EOC Sink)']
        : activeDeviceId.includes('Nayan')
        ? [`${activeDeviceId} (Field Relay)`, "Aarav's Pixel 8 Pro (Rescue Bridge)", 'Web Command Center (Rescue EOC)']
        : activeDeviceId.includes('Aarav')
        ? [`${activeDeviceId} (Rescue Bridge)`, 'Web Command Center (Rescue EOC)']
        : [`${activeDeviceId} (Victim Beacon)`, "Nayan's Galaxy S24 (Field Relay)", "Aarav's Pixel 8 Pro (Rescue Bridge)", 'Web Command Center (Rescue EOC)'];

      // 2. Broadcast via Bluetooth Mesh Channel to all nearby devices
      bleNativeDriver.broadcastMeshSOS({
        senderId: activeDeviceId,
        priorityLevel: priorityLevel,
        message: customMessage,
        latitude: location.lat,
        longitude: location.lng,
        batteryPct: batteryPct,
        timestamp: Date.now(),
        routeTrace: currentTrace,
      });

      // 3. Instantly transmit custom message & full trace to Web Command Center
      await networkBridge.relaySOSToWebCommand({
        packetId: packetCount + 1,
        senderId: activeDeviceId,
        priorityLevel: priorityLevel,
        latitude: location.lat,
        longitude: location.lng,
        batteryPct: batteryPct,
        hopCount: currentTrace.length - 1,
        message: customMessage,
        route_trace: currentTrace,
      });

      const latStr = `${Math.abs(location.lat).toFixed(6)}° ${location.lat >= 0 ? 'N' : 'S'}`;
      const lngStr = `${Math.abs(location.lng).toFixed(6)}° ${location.lng >= 0 ? 'E' : 'W'}`;

      Alert.alert(
        '🚨 AUTOMATIC BLE SOS CONNECTED & TRANSMITTED',
        `Device Owner: ${customSenderName}\nDevice Model: ${activeDeviceId}\nMessage: "${customMessage}"\n\nGPS Target: ${latStr}, ${lngStr}.\n\nBluetooth Hop Path:\n${currentTrace.join(' ➔ ')}`,
        [{ text: 'ACKNOWLEDGE & TRANSMIT' }]
      );
    } else {
      // 1. Broadcast BLE Mesh Cancel to peer devices
      bleNativeDriver.broadcastMeshSOSCancel(activeDeviceId);

      // 2. Send CANCEL_SOS signal to Web Command Center API
      await networkBridge.relaySOSToWebCommand({
        packetId: packetCount + 1,
        senderId: activeDeviceId,
        priorityLevel: 0,
        latitude: location.lat,
        longitude: location.lng,
        batteryPct: batteryPct,
        action: 'CANCEL_SOS',
      });
      setPeerAlert(null);
    }
  };

  const handleSwitchDevice = (profile: DeviceProfile) => {
    setActiveProfile(profile);
    setActiveDeviceId(profile.deviceName);
    setCustomSenderName(profile.ownerName);
    setLocation(profile.location);
    setCustomMessage(profile.defaultMessage);
    setBatteryPct(profile.batteryPct);

    // Update peer list based on active device
    if (profile.deviceName.includes('Nayan')) {
      setMeshPeers([
        { id: "Parth's iPhone 15 Pro", owner: 'Parth', rssi: -38, hops: 1, status: 'CONNECTED (VICTIM BEACON)', distMeters: 5 },
        { id: "Aarav's Pixel 8 Pro", owner: 'Aarav', rssi: -49, hops: 1, status: 'CONNECTED (RESCUE BRIDGE)', distMeters: 9 },
      ]);
    } else if (profile.deviceName.includes('Aarav')) {
      setMeshPeers([
        { id: "Nayan's Galaxy S24", owner: 'Nayan', rssi: -45, hops: 1, status: 'CONNECTED (FIELD RELAY)', distMeters: 8 },
        { id: "Parth's iPhone 15 Pro", owner: 'Parth', rssi: -62, hops: 2, status: 'CONNECTED (VICTIM BEACON)', distMeters: 18 },
      ]);
    } else {
      setMeshPeers([
        { id: "Nayan's Galaxy S24", owner: 'Nayan', rssi: -42, hops: 1, status: 'CONNECTED (GATT MESH)', distMeters: 6 },
        { id: "Aarav's Pixel 8 Pro", owner: 'Aarav', rssi: -58, hops: 2, status: 'CONNECTED (RESCUE BRIDGE)', distMeters: 14 },
      ]);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={sosActive ? '#450a0a' : '#050810'} />
      <ScrollView style={[styles.container, sosActive && styles.containerSOS]} contentContainerStyle={{ paddingBottom: 32 }}>
        
        {/* Top Header */}
        <View style={styles.header}>
          <View style={styles.badgeRow}>
            <View style={[styles.statusDot, sosActive ? styles.dotSOS : styles.dotNormal]} />
            <Text style={styles.headerTitle}>AETHERIS MOBILE HELPER</Text>
          </View>
          <Text style={styles.headerSubtitle}>
            {sosActive ? 'CRITICAL SOS BROADCAST ACTIVE' : 'PHONE-TO-PHONE BLE MESH ONLINE'}
          </Text>
        </View>

        {/* Incoming Peer SOS Sync Alert Banner */}
        {peerAlert && (
          <View style={{ backgroundColor: '#450a0a', borderColor: '#ef4444', borderWidth: 1, borderRadius: 12, padding: 10, marginTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#ef4444', fontWeight: 'bold', fontSize: 10, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }}>
                🚨 PEER SOS SIGNAL RECEIVED FROM {peerAlert.senderId}
              </Text>
              <Text style={{ color: '#f8fafc', fontSize: 11, fontWeight: 'bold', marginTop: 2, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }}>
                "{peerAlert.message}"
              </Text>
            </View>
            <TouchableOpacity onPress={() => setPeerAlert(null)} style={{ backgroundColor: '#ef4444', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, marginLeft: 8 }}>
              <Text style={{ color: '#ffffff', fontSize: 10, fontWeight: 'bold' }}>DISMISS</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Startup Custom Sender Identity & Settings Screen Card */}
        <View style={{ backgroundColor: '#0b1329', borderRadius: 14, padding: 14, marginTop: 10, borderWidth: 1, borderColor: '#00f0ff55' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ fontSize: 14 }}>🆔</Text>
              <Text style={{ color: '#00f0ff', fontSize: 11, fontWeight: 'bold', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', letterSpacing: 1 }}>
                CUSTOM SENDER IDENTITY & BLE SETTINGS
              </Text>
            </View>
            <View style={{ backgroundColor: '#10b98122', borderColor: '#10b981', borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 }}>
              <Text style={{ color: '#10b981', fontSize: 8, fontWeight: 'bold', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }}>
                32-BIT FNV-1a TRUNCATED TO 16 BITS
              </Text>
            </View>
          </View>

          <Text style={{ color: '#94a3b8', fontSize: 9, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', marginBottom: 6 }}>
            ENTER CUSTOM SENDER NAME (TRANSMITTED OVER BLE & COMMAND CENTER):
          </Text>
          
          <TextInput
            style={{
              backgroundColor: '#050810',
              borderColor: '#00f0ff88',
              borderWidth: 1,
              borderRadius: 8,
              padding: 10,
              color: '#ffffff',
              fontSize: 13,
              fontWeight: 'bold',
              fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
              marginBottom: 10,
            }}
            value={customSenderName}
            onChangeText={(text) => {
              setCustomSenderName(text);
              setActiveDeviceId(text || "Rescue Unit 1");
            }}
            placeholder="Type custom sender identity (e.g. Rescue Unit 1, John Doe - Victim)..."
            placeholderTextColor="#64748b"
          />

          {/* Quick Preset Identity Chips */}
          <Text style={{ color: '#64748b', fontSize: 8, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', marginBottom: 6 }}>
            QUICK PRESET IDENTITIES:
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
            {['Room 222 - Victim (Wall Blocked)', 'Room 322 - Mesh Relay', 'Rescue Unit 1', 'John Doe - Victim'].map((preset) => (
              <TouchableOpacity
                key={preset}
                onPress={() => {
                  setCustomSenderName(preset);
                  setActiveDeviceId(preset);
                }}
                style={{
                  backgroundColor: customSenderName === preset ? '#00f0ff22' : '#0f172a',
                  borderColor: customSenderName === preset ? '#00f0ff' : '#334155',
                  borderWidth: 1,
                  borderRadius: 6,
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                }}
              >
                <Text style={{ color: customSenderName === preset ? '#00f0ff' : '#94a3b8', fontSize: 9, fontWeight: 'bold', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }}>
                  {preset}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Real-Time Hash & Manufacturer Payload Display */}
          <View style={{ backgroundColor: '#050810', borderRadius: 8, padding: 8, borderWidth: 1, borderColor: '#1e293b', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Text style={{ color: '#64748b', fontSize: 8, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }}>
                WIRE HASH (32-BIT FNV-1a TRUNCATED TO 16 BITS)
              </Text>
              <Text style={{ color: '#10b981', fontSize: 11, fontWeight: 'bold', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }}>
                0x{(hashStringUint32(customSenderName || activeDeviceId) & 0xFFFF).toString(16).toUpperCase().padStart(4, '0')} (32-bit: 0x{hashStringUint32(customSenderName || activeDeviceId).toString(16).toUpperCase().padStart(8, '0')})
              </Text>
            </View>

            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ color: '#64748b', fontSize: 8, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }}>
                BLE MANUFACTURER DATA
              </Text>
              <Text style={{ color: '#38bdf8', fontSize: 9, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }}>
                0x00E0 {hashStringUint32(customSenderName || activeDeviceId).toString(16).toUpperCase().padStart(8, '0').slice(0, 4)} "{customSenderName.slice(0, 8)}"
              </Text>
            </View>
          </View>
        </View>

        {/* Custom Emergency Message Input Box */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>EMERGENCY DETAILS & CUSTOM MESSAGE</Text>
          
          <TextInput
            style={styles.messageInput}
            value={customMessage}
            onChangeText={setCustomMessage}
            placeholder="Type custom emergency details..."
            placeholderTextColor="#64748b"
            multiline
          />

          {/* Priority Level Buttons */}
          <View style={styles.priorityRow}>
            <TouchableOpacity
              style={[styles.priorityBtn, priorityLevel === 3 && styles.prioCritical]}
              onPress={() => setPriorityLevel(3)}
            >
              <Text style={styles.prioText}>🚨 CRITICAL SOS</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.priorityBtn, priorityLevel === 2 && styles.prioHigh]}
              onPress={() => setPriorityLevel(2)}
            >
              <Text style={styles.prioText}>⚠️ HIGH ALERT</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Big 1-Tap Emergency SOS Button */}
        <View style={styles.sosContainer}>
          <Animated.View style={[styles.pulseCircle, { transform: [{ scale: pulseAnim }] }, sosActive && styles.pulseCircleSOS]}>
            <TouchableOpacity
              activeOpacity={0.8}
              style={[styles.sosButton, sosActive ? styles.sosButtonActive : styles.sosButtonInactive]}
              onPress={handleToggleSOS}
            >
              <Text style={styles.sosSymbol}>🚨</Text>
              <Text style={styles.sosText}>{sosActive ? 'CANCEL SOS' : 'TRANSMIT SOS'}</Text>
              <Text style={styles.sosSubtext}>AUTOMATIC BLUETOOTH BEACON</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>

        {/* Locked Location & Status Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>GPS LOCK & MESH TELEMETRY</Text>
          
          <View style={styles.infoGrid}>
            <View style={styles.infoBox}>
              <Text style={styles.infoLabel}>LOCKED LATITUDE</Text>
              <Text style={styles.infoValue}>{Math.abs(location.lat).toFixed(6)}° {location.lat >= 0 ? 'N' : 'S'}</Text>
            </View>

            <View style={styles.infoBox}>
              <Text style={styles.infoLabel}>LOCKED LONGITUDE</Text>
              <Text style={styles.infoValue}>{Math.abs(location.lng).toFixed(6)}° {location.lng >= 0 ? 'E' : 'W'}</Text>
            </View>

            <View style={styles.infoBox}>
              <Text style={styles.infoLabel}>BATTERY</Text>
              <Text style={[styles.infoValue, { color: batteryPct < 20 ? '#ef4444' : '#10b981' }]}>
                ⚡ {batteryPct}%
              </Text>
            </View>

            <View style={styles.infoBox}>
              <Text style={styles.infoLabel}>BLE PACKETS</Text>
              <Text style={styles.infoValue}>{packetCount} TX</Text>
            </View>
          </View>

          {/* Multi-Hop Route Trace Display */}
          <View style={styles.traceBox}>
            <Text style={styles.traceTitle}>MULTI-HOP BLUETOOTH OWNER HOP PATH</Text>
            <Text style={styles.traceContent}>{routeTrace.join(' ➔ ')}</Text>
            <Text style={{ color: '#64748b', fontSize: 8, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', marginTop: 4 }}>
              ⚡ Auto-connects via BLE Peripheral & GATT Central Mesh Server
            </Text>
          </View>

          {/* 18-Byte Binary Packet Hex Dump Display */}
          <View style={styles.hexDumpBox}>
            <View style={styles.hexHeader}>
              <Text style={styles.hexTitle}>18-BYTE BINARY STRUCT DUMP</Text>
              <Text style={[styles.hexStatus, { color: checksumStatus.includes('VALID') ? '#10b981' : '#ef4444' }]}>
                {checksumStatus}
              </Text>
            </View>
            <Text style={styles.hexContent}>{lastHexDump || '00 01 03 02 40 4E CC ...'}</Text>
          </View>

          {/* Active Mesh Peers List */}
          <View style={styles.meshPeersBox}>
            <Text style={styles.peersTitle}>NEARBY BLUETOOTH PEERS IN RANGE ({meshPeers.length})</Text>
            {meshPeers.map((peer) => (
              <View key={peer.id} style={styles.peerRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.peerId}>● {peer.id} ({peer.owner})</Text>
                  <Text style={styles.peerDetails}>{peer.status} | ~{peer.distMeters}m away</Text>
                </View>
                <Text style={{ color: '#38bdf8', fontSize: 9, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontWeight: 'bold' }}>
                  {peer.rssi} dBm
                </Text>
              </View>
            ))}
          </View>

          {/* Web Command Center Link Banner */}
          <View style={[styles.backgroundBanner, webBridgeConnected && styles.bannerConnected]}>
            <Text style={[styles.bgBannerText, { color: webBridgeConnected ? '#10b981' : '#f59e0b' }]}>
              🌐 {webBridgeConnected ? 'WEB COMMAND CENTER RELAY CONNECTED' : 'LOCAL BLE MESH ADVERTISING ACTIVE'}
            </Text>
            <Text style={styles.bgServiceUUID}>UUID: {AETHERIS_SERVICE_UUID.substring(0, 18)}...</Text>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#050810',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  container: {
    flex: 1,
    backgroundColor: '#050810',
    paddingHorizontal: 16,
  },
  containerSOS: {
    backgroundColor: '#0f0505',
  },
  header: {
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dotNormal: {
    backgroundColor: '#10b981',
  },
  dotSOS: {
    backgroundColor: '#ef4444',
  },
  headerTitle: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 2,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  headerSubtitle: {
    color: '#00f0ff',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: 4,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  nodeSelectorCard: {
    backgroundColor: '#090d16',
    borderRadius: 12,
    padding: 10,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  selectorTitle: {
    color: '#64748b',
    fontSize: 9,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: 'bold',
    marginBottom: 6,
  },
  nodeButtonRow: {
    flexDirection: 'row',
    gap: 6,
  },
  nodeBtn: {
    flex: 1,
    paddingVertical: 6,
    backgroundColor: '#0f172a',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#1e293b',
    alignItems: 'center',
  },
  nodeBtnActive: {
    backgroundColor: '#0369a1',
    borderColor: '#00f0ff',
  },
  nodeBtnText: {
    color: '#64748b',
    fontSize: 9,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: 'bold',
  },
  nodeBtnTextActive: {
    color: '#ffffff',
  },
  card: {
    backgroundColor: '#090d16',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginTop: 12,
  },
  cardTitle: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginBottom: 8,
  },
  messageInput: {
    backgroundColor: '#030712',
    color: '#f8fafc',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#1e293b',
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    minHeight: 54,
    textAlignVertical: 'top',
    marginBottom: 10,
  },
  priorityRow: {
    flexDirection: 'row',
    gap: 8,
  },
  priorityBtn: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 6,
    paddingVertical: 8,
    alignItems: 'center',
  },
  prioCritical: {
    backgroundColor: '#450a0a',
    borderColor: '#ef4444',
  },
  prioHigh: {
    backgroundColor: '#451a03',
    borderColor: '#f59e0b',
  },
  prioText: {
    color: '#f8fafc',
    fontSize: 10,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  sosContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 16,
  },
  pulseCircle: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#0369a122',
    borderWidth: 2,
    borderColor: '#0284c7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseCircleSOS: {
    backgroundColor: '#991b1b44',
    borderColor: '#ef4444',
  },
  sosButton: {
    width: 160,
    height: 160,
    borderRadius: 80,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
  },
  sosButtonInactive: {
    backgroundColor: '#0284c7',
  },
  sosButtonActive: {
    backgroundColor: '#dc2626',
  },
  sosSymbol: {
    fontSize: 38,
    marginBottom: 2,
  },
  sosText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1,
  },
  sosSubtext: {
    color: '#e0f2fe',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  infoBox: {
    width: '48%',
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  infoLabel: {
    color: '#64748b',
    fontSize: 8,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  infoValue: {
    color: '#f8fafc',
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginTop: 2,
  },
  traceBox: {
    backgroundColor: '#030712',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 10,
  },
  traceTitle: {
    color: '#64748b',
    fontSize: 8,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginBottom: 2,
  },
  traceContent: {
    color: '#00f0ff',
    fontSize: 11,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  hexDumpBox: {
    backgroundColor: '#030712',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 10,
  },
  hexHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  hexTitle: {
    color: '#64748b',
    fontSize: 8,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  hexStatus: {
    fontSize: 8,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  hexContent: {
    color: '#38bdf8',
    fontSize: 10,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    letterSpacing: 1,
  },
  meshPeersBox: {
    backgroundColor: '#030712',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 10,
  },
  peersTitle: {
    color: '#64748b',
    fontSize: 8,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: 'bold',
    marginBottom: 4,
  },
  peerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  peerId: {
    color: '#10b981',
    fontSize: 9,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: 'bold',
  },
  peerDetails: {
    color: '#64748b',
    fontSize: 8,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  backgroundBanner: {
    backgroundColor: '#451a0322',
    borderWidth: 1,
    borderColor: '#f59e0b',
    borderRadius: 8,
    padding: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bannerConnected: {
    backgroundColor: '#064e3b22',
    borderColor: '#059669',
  },
  bgBannerText: {
    fontSize: 9,
    fontWeight: 'bold',
  },
  bgServiceUUID: {
    color: '#64748b',
    fontSize: 8,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
});
