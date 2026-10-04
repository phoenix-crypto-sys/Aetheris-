import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import Svg, { Circle, Line, Rect, G, Text as SvgText } from 'react-native-svg';
import { airwavesService } from '../services/airwavesService';
import { AetherisPacket, NodeRole } from '../layer1_radio/types';

export interface NodeMapItem {
  deviceId: string;
  role: NodeRole;
  latitude: number;
  longitude: number;
  battery: number;
  status: 'ONLINE' | 'DEGRADED' | 'FAILED';
  lastSeenTimestamp: number;
  opacity: number;
}

interface NodeMapProps {
  onNodeSelect?: (node: NodeMapItem) => void;
  selectedNodeId?: string | null;
}

export const NodeMap: React.FC<NodeMapProps> = ({ onNodeSelect, selectedNodeId }) => {
  const [nodesMap, setNodesMap] = useState<Map<string, NodeMapItem>>(new Map());
  const [nodesList, setNodesList] = useState<NodeMapItem[]>([]);
  const [radarAngle, setRadarAngle] = useState(0);

  const CENTER_LAT = 37.7749;
  const CENTER_LNG = -122.4194;
  const MAP_SCALE = 22000;

  const MAP_SIZE = Math.min(Dimensions.get('window').width - 32, 420);
  const HALF_SIZE = MAP_SIZE / 2;

  // Initial setup: populate BLE mobile node, LoRa bridge, and Rescue Node sink
  useEffect(() => {
    const initialMap = new Map<string, NodeMapItem>();

    initialMap.set('AETHERIS-MOBILE-01', {
      deviceId: 'AETHERIS-MOBILE-01',
      role: 'BLE_NODE',
      latitude: CENTER_LAT,
      longitude: CENTER_LNG,
      battery: 98,
      status: 'ONLINE',
      lastSeenTimestamp: Date.now(),
      opacity: 1.0,
    });

    initialMap.set('ESP32-LORA-BRIDGE-01', {
      deviceId: 'ESP32-LORA-BRIDGE-01',
      role: 'LORA_BRIDGE',
      latitude: CENTER_LAT + 0.003,
      longitude: CENTER_LNG + 0.003,
      battery: 100,
      status: 'ONLINE',
      lastSeenTimestamp: Date.now(),
      opacity: 1.0,
    });

    initialMap.set('RESCUE-COMMAND-SINK-01', {
      deviceId: 'RESCUE-COMMAND-SINK-01',
      role: 'RESCUE_NODE',
      latitude: CENTER_LAT + 0.006,
      longitude: CENTER_LNG + 0.006,
      battery: 100,
      status: 'ONLINE',
      lastSeenTimestamp: Date.now(),
      opacity: 1.0,
    });

    setNodesMap(initialMap);
  }, []);

  // Radar sweep animation
  useEffect(() => {
    const sweepInterval = setInterval(() => {
      setRadarAngle((prev) => (prev + 4) % 360);
    }, 40);
    return () => clearInterval(sweepInterval);
  }, []);

  // Realtime channel packet listener
  useEffect(() => {
    const channel = airwavesService.getAirwavesChannel();
    
    const unsubscribe = channel.subscribe((packet: AetherisPacket) => {
      setNodesMap((prevMap) => {
        const nextMap = new Map(prevMap);
        const existing = nextMap.get(packet.sender_id);
        
        const updatedItem: NodeMapItem = {
          deviceId: packet.sender_id,
          role: existing ? existing.role : 'BLE_NODE',
          latitude: packet.location.lat,
          longitude: packet.location.lng,
          battery: existing ? existing.battery : 95,
          status: 'ONLINE',
          lastSeenTimestamp: Date.now(),
          opacity: 1.0,
        };

        nextMap.set(packet.sender_id, updatedItem);
        return nextMap;
      });
    });

    return () => unsubscribe();
  }, []);

  // Derived nodes array maintaining strict chronological timeline order
  useEffect(() => {
    const activeNodes: NodeMapItem[] = [];
    nodesMap.forEach((node) => {
      if (node.opacity > 0.05) {
        activeNodes.push(node);
      }
    });

    // STRICT APPEND PATTERN
    setNodesList([...activeNodes]);
  }, [nodesMap]);

  const projectCoords = (lat: number, lng: number) => {
    const dx = (lng - CENTER_LNG) * MAP_SCALE;
    const dy = (CENTER_LAT - lat) * MAP_SCALE;
    return {
      x: HALF_SIZE + dx,
      y: HALF_SIZE + dy,
    };
  };

  const radarRad = (radarAngle * Math.PI) / 180;
  const sweepX = HALF_SIZE + (HALF_SIZE - 20) * Math.cos(radarRad);
  const sweepY = HALF_SIZE + (HALF_SIZE - 20) * Math.sin(radarRad);

  return (
    <View style={styles.container}>
      {/* Header Bar */}
      <View style={styles.mapHeader}>
        <View style={styles.statusBadge}>
          <View style={styles.pulseDot} />
          <Text style={styles.statusText}>TACTICAL MESH NETWORK</Text>
        </View>
        <Text style={styles.nodeCounter}>
          ACTIVE NODES: <Text style={styles.counterHighlight}>{nodesList.length}</Text>
        </Text>
      </View>

      {/* SVG Tactical Radar Map */}
      <View style={[styles.svgWrapper, { width: MAP_SIZE, height: MAP_SIZE }]}>
        <Svg width={MAP_SIZE} height={MAP_SIZE} viewBox={`0 0 ${MAP_SIZE} ${MAP_SIZE}`}>
          <Rect x="0" y="0" width={MAP_SIZE} height={MAP_SIZE} fill="#090d16" rx={16} />

          {/* Radar Circles */}
          <Circle cx={HALF_SIZE} cy={HALF_SIZE} r={HALF_SIZE * 0.85} stroke="#1e293b" strokeWidth="1.5" fill="none" />
          <Circle cx={HALF_SIZE} cy={HALF_SIZE} r={HALF_SIZE * 0.6} stroke="#131e32" strokeWidth="1" strokeDasharray="4 4" fill="none" />
          <Circle cx={HALF_SIZE} cy={HALF_SIZE} r={HALF_SIZE * 0.35} stroke="#131e32" strokeWidth="1" fill="none" />

          {/* Crosshairs */}
          <Line x1={15} y1={HALF_SIZE} x2={MAP_SIZE - 15} y2={HALF_SIZE} stroke="#1e293b" strokeWidth="1" />
          <Line x1={HALF_SIZE} y1={15} x2={HALF_SIZE} y2={MAP_SIZE - 15} stroke="#1e293b" strokeWidth="1" />

          {/* Radar Sweep Line */}
          <Line x1={HALF_SIZE} y1={HALF_SIZE} x2={sweepX} y2={sweepY} stroke="rgba(0, 240, 255, 0.45)" strokeWidth="2" />

          {/* Nodes */}
          {nodesList.map((node) => {
            const pos = projectCoords(node.latitude, node.longitude);
            const isSelected = node.deviceId === selectedNodeId;

            let nodeColor = '#00f0ff'; // Cyan BLE Node
            if (node.role === 'LORA_BRIDGE') nodeColor = '#f59e0b'; // Amber Bridge
            if (node.role === 'RESCUE_NODE') nodeColor = '#10b981'; // Green First Responder Sink

            return (
              <G key={node.deviceId} opacity={node.opacity}>
                <Circle cx={pos.x} cy={pos.y} r={isSelected ? 18 : 12} stroke={nodeColor} strokeWidth="1" strokeOpacity="0.4" fill="none" />
                <Circle cx={pos.x} cy={pos.y} r={isSelected ? 6 : 4} fill={nodeColor} />
                
                <SvgText
                  x={pos.x + 10}
                  y={pos.y - 4}
                  fill="#f8fafc"
                  fontSize="9"
                  fontWeight="bold"
                  fontFamily="monospace"
                >
                  {node.deviceId}
                </SvgText>

                <SvgText
                  x={pos.x + 10}
                  y={pos.y + 6}
                  fill="#64748b"
                  fontSize="7"
                  fontFamily="monospace"
                >
                  {node.role}
                </SvgText>
              </G>
            );
          })}
        </Svg>

        {/* Touch Targets */}
        {nodesList.map((node) => {
          const pos = projectCoords(node.latitude, node.longitude);
          return (
            <TouchableOpacity
              key={`touch-${node.deviceId}`}
              style={{
                position: 'absolute',
                left: pos.x - 20,
                top: pos.y - 20,
                width: 40,
                height: 40,
                borderRadius: 20,
              }}
              onPress={() => onNodeSelect?.(node)}
            />
          );
        })}
      </View>

      {/* Footer Legend */}
      <View style={styles.mapFooter}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#00f0ff' }]} />
          <Text style={styles.legendText}>BLE NODE</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#f59e0b' }]} />
          <Text style={styles.legendText}>LORA BRIDGE</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#10b981' }]} />
          <Text style={styles.legendText}>RESCUE SINK</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#090d16',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1e293b',
    alignItems: 'center',
    marginBottom: 16,
  },
  mapHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00f0ff',
  },
  statusText: {
    color: '#00f0ff',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    fontFamily: 'monospace',
  },
  nodeCounter: {
    color: '#64748b',
    fontSize: 11,
    fontFamily: 'monospace',
  },
  counterHighlight: {
    color: '#38bdf8',
    fontWeight: 'bold',
  },
  svgWrapper: {
    position: 'relative',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  mapFooter: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginTop: 10,
    paddingHorizontal: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  legendText: {
    color: '#64748b',
    fontSize: 9,
    fontFamily: 'monospace',
  },
});
