import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { airwavesService } from '../services/airwavesService';
import { AetherisPacket } from '../layer1_radio/types';
import { NodeMapItem } from './NodeMap';

interface TelemetryPanelProps {
  selectedNode?: NodeMapItem | null;
}

export const TelemetryPanel: React.FC<TelemetryPanelProps> = ({ selectedNode }) => {
  // CRITICAL CONSTRAINT: Appends new incoming telemetry packets strictly to end of history array [...prev, item]
  const [packetLogs, setPacketLogs] = useState<AetherisPacket[]>([]);
  const [totalPackets, setTotalPackets] = useState<number>(0);
  const [packetRate, setPacketRate] = useState<number>(0);
  const [queueCount, setQueueCount] = useState<number>(0);

  useEffect(() => {
    const channel = airwavesService.getAirwavesChannel();
    let packetCountInWindow = 0;

    const rateInterval = setInterval(() => {
      setPacketRate(packetCountInWindow / 2);
      packetCountInWindow = 0;
      setQueueCount(airwavesService.storeAndForward.getQueueLength());
    }, 2000);

    const unsubscribe = channel.subscribe((packet: AetherisPacket) => {
      packetCountInWindow += 1;
      setTotalPackets((prev) => prev + 1);

      // STRICT TIMELINE RULE: Appends strictly to end of log queue [...prevLogs, packet]
      setPacketLogs((prevLogs) => {
        const updated = [...prevLogs, packet];
        if (updated.length > 50) {
          return updated.slice(updated.length - 50);
        }
        return updated;
      });
    });

    return () => {
      clearInterval(rateInterval);
      unsubscribe();
    };
  }, []);

  const handleClearLogs = () => {
    setPacketLogs([]);
  };

  return (
    <View style={styles.container}>
      {/* Panel Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>REALTIME TELEMETRY FEED (4-LAYER)</Text>
        <TouchableOpacity onPress={handleClearLogs} style={styles.clearBtn}>
          <Text style={styles.clearBtnText}>CLEAR FEED</Text>
        </TouchableOpacity>
      </View>

      {/* Metrics Bar */}
      <View style={styles.metricsContainer}>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>PACKET RATE</Text>
          <Text style={styles.metricValue}>{packetRate.toFixed(1)} <Text style={styles.unitText}>pkt/s</Text></Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>TOTAL PACKETS</Text>
          <Text style={styles.metricValue}>{totalPackets}</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>STORE & FORWARD</Text>
          <Text style={[styles.metricValue, { color: queueCount > 0 ? '#f59e0b' : '#10b981' }]}>{queueCount} <Text style={styles.unitText}>queued</Text></Text>
        </View>
      </View>

      {/* Selected Node Details Card */}
      {selectedNode && (
        <View style={styles.nodeInspectCard}>
          <View style={styles.inspectHeader}>
            <Text style={styles.inspectTitle}>INSPECTING NODE: {selectedNode.deviceId}</Text>
            <View style={[styles.statusBadge, { backgroundColor: selectedNode.status === 'ONLINE' ? '#10b98122' : '#ef444422' }]}>
              <Text style={[styles.statusText, { color: selectedNode.status === 'ONLINE' ? '#10b981' : '#ef4444' }]}>
                {selectedNode.status}
              </Text>
            </View>
          </View>
          <View style={styles.inspectGrid}>
            <Text style={styles.inspectText}>ROLE: {selectedNode.role}</Text>
            <Text style={styles.inspectText}>LAT: {selectedNode.latitude.toFixed(6)}</Text>
            <Text style={styles.inspectText}>LNG: {selectedNode.longitude.toFixed(6)}</Text>
            <Text style={styles.inspectText}>BATTERY: {selectedNode.battery}%</Text>
          </View>
        </View>
      )}

      {/* Realtime Packet Log Feed */}
      <Text style={styles.feedSubheader}>LIVE PACKET STREAM (STRICT APPEND QUEUE [...prev, item])</Text>
      <ScrollView style={styles.logScrollView} nestedScrollEnabled={true}>
        {packetLogs.length === 0 ? (
          <Text style={styles.emptyText}>Waiting for mesh broadcasts...</Text>
        ) : (
          packetLogs.slice().reverse().map((pkt, idx) => {
            let priorityBg = '#0f172a';
            let priorityColor = '#00f0ff';
            if (pkt.priority === 'critical') {
              priorityBg = '#7f1d1d';
              priorityColor = '#ef4444';
            } else if (pkt.priority === 'high') {
              priorityBg = '#78350f';
              priorityColor = '#f59e0b';
            }

            const timeStr = new Date(pkt.timestamp).toLocaleTimeString();

            return (
              <View key={`${pkt.sender_id}-${pkt.timestamp}-${idx}`} style={styles.logRow}>
                <View style={styles.logLeft}>
                  <View style={[styles.priorityTag, { backgroundColor: priorityBg }]}>
                    <Text style={[styles.priorityText, { color: priorityColor }]}>
                      {pkt.priority.toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.deviceIdText}>{pkt.sender_id}</Text>
                </View>
                <View style={styles.logRight}>
                  <Text style={styles.msgText} numberOfLines={1}>{pkt.message}</Text>
                  <Text style={styles.timeText}>{timeStr}</Text>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
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
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerTitle: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    fontFamily: 'monospace',
  },
  clearBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#1e293b',
    borderRadius: 6,
  },
  clearBtnText: {
    color: '#94a3b8',
    fontSize: 9,
    fontFamily: 'monospace',
  },
  metricsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#0f172a',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  metricLabel: {
    color: '#64748b',
    fontSize: 9,
    fontFamily: 'monospace',
    marginBottom: 4,
  },
  metricValue: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  unitText: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: 'normal',
  },
  nodeInspectCard: {
    backgroundColor: '#0f1d38',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#00f0ff44',
    marginBottom: 12,
  },
  inspectHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  inspectTitle: {
    color: '#00f0ff',
    fontSize: 10,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 9,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  inspectGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  inspectText: {
    color: '#cbd5e1',
    fontSize: 10,
    fontFamily: 'monospace',
  },
  feedSubheader: {
    color: '#64748b',
    fontSize: 10,
    fontFamily: 'monospace',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  logScrollView: {
    maxHeight: 180,
    backgroundColor: '#050810',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  emptyText: {
    color: '#475569',
    fontSize: 11,
    fontStyle: 'italic',
    textAlign: 'center',
    marginVertical: 12,
    fontFamily: 'monospace',
  },
  logRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#0f172a',
  },
  logLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  priorityTag: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  priorityText: {
    fontSize: 8,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  deviceIdText: {
    color: '#e2e8f0',
    fontSize: 10,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  logRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    justifyContent: 'flex-end',
  },
  msgText: {
    color: '#94a3b8',
    fontSize: 9,
    fontFamily: 'monospace',
    maxWidth: 140,
  },
  timeText: {
    color: '#475569',
    fontSize: 8,
    fontFamily: 'monospace',
  },
});
