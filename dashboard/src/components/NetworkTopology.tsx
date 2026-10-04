import React, { useState, useEffect } from 'react';

export interface TopologyNode {
  id: string;
  role: 'BLE_NODE' | 'LORA_BRIDGE' | 'RESCUE_NODE';
  x: number;
  y: number;
  status: 'ONLINE' | 'DEGRADED' | 'FAILED';
  battery: number;
}

export interface TopologyEdge {
  source: string;
  target: string;
  pheromone: number;
  decayed: boolean;
}

interface TopologyProps {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  onTriggerFailAck?: (sourceId: string, targetId: string) => void;
}

export const NetworkTopologyView: React.FC<TopologyProps> = ({ nodes, edges, onTriggerFailAck }) => {
  const [selectedEdge, setSelectedEdge] = useState<TopologyEdge | null>(null);

  const getNodeColor = (role: string, status: string) => {
    if (status === 'FAILED') return '#ef4444';
    if (role === 'RESCUE_NODE') return '#10b981'; // Green First Responder Sink
    if (role === 'LORA_BRIDGE') return '#f59e0b'; // Amber Long Range Bridge
    return '#00f0ff'; // Cyan BLE Mobile Node
  };

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: '#10b981', fontWeight: 'bold' }}>◈</span>
          <span style={titleStyle}>4-LAYER TOPOLOGY & PHEROMONE MATRIX</span>
        </div>
        <div style={{ fontSize: '10px', color: '#64748b' }}>
          Green = Rescue Sink | Amber = LoRa Bridge | Cyan = BLE Node
        </div>
      </div>

      <div style={canvasWrapperStyle}>
        <svg width="100%" height="320" viewBox="0 0 600 320" style={{ backgroundColor: '#050810', borderRadius: '8px' }}>
          {/* Edge links rendering with pheromone intensity line weight */}
          {edges.map((edge, i) => {
            const srcNode = nodes.find((n) => n.id === edge.source);
            const dstNode = nodes.find((n) => n.id === edge.target);

            if (!srcNode || !dstNode) return null;

            const strokeWidth = Math.max(1, edge.pheromone * 5);
            const opacity = Math.max(0.15, Math.min(1.0, edge.pheromone));
            const color = edge.pheromone < 0.2 ? '#ef4444' : '#00f0ff';

            return (
              <g key={`edge-${i}`} onClick={() => setSelectedEdge(edge)} style={{ cursor: 'pointer' }}>
                <line
                  x1={srcNode.x}
                  y1={srcNode.y}
                  x2={dstNode.x}
                  y2={dstNode.y}
                  stroke={color}
                  strokeWidth={strokeWidth}
                  strokeOpacity={opacity}
                  strokeDasharray={edge.pheromone < 0.2 ? '4 4' : 'none'}
                />
                <text
                  x={(srcNode.x + dstNode.x) / 2}
                  y={(srcNode.y + dstNode.y) / 2 - 4}
                  fill="#94a3b8"
                  fontSize="8"
                  fontFamily="monospace"
                  textAnchor="middle"
                >
                  τ={edge.pheromone.toFixed(2)}
                </text>
              </g>
            );
          })}

          {/* Node circles */}
          {nodes.map((node) => {
            const nodeColor = getNodeColor(node.role, node.status);
            return (
              <g key={node.id} transform={`translate(${node.x}, ${node.y})`}>
                <circle r="14" fill="#090d16" stroke={nodeColor} strokeWidth="2" />
                <circle r="6" fill={nodeColor} />
                <text x="0" y="24" fill="#f8fafc" fontSize="9" fontWeight="bold" fontFamily="monospace" textAnchor="middle">
                  {node.id}
                </text>
                <text x="0" y="34" fill="#64748b" fontSize="7" fontFamily="monospace" textAnchor="middle">
                  {node.role} | {node.battery}%
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Edge Action Panel */}
      {selectedEdge && (
        <div style={actionBoxStyle}>
          <div style={{ color: '#00f0ff', fontSize: '10px', fontWeight: 'bold' }}>
            SELECTED EDGE: {selectedEdge.source} ➔ {selectedEdge.target} (Pheromone τ = {selectedEdge.pheromone.toFixed(3)})
          </div>
          <button
            onClick={() => {
              onTriggerFailAck?.(selectedEdge.source, selectedEdge.target);
              setSelectedEdge(null);
            }}
            style={failBtnStyle}
          >
            ⚡ TRIGGER MISSING ACK HARD PENALTY (-90%)
          </button>
        </div>
      )}
    </div>
  );
};

const containerStyle: React.CSSProperties = {
  backgroundColor: '#090d16',
  borderRadius: '12px',
  padding: '14px',
  border: '1px solid #1e293b',
  fontFamily: 'monospace',
  marginBottom: '20px',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '10px',
};

const titleStyle: React.CSSProperties = {
  color: '#10b981',
  fontSize: '11px',
  fontWeight: 'bold',
  letterSpacing: '1px',
};

const canvasWrapperStyle: React.CSSProperties = {
  border: '1px solid #1e293b',
  borderRadius: '8px',
  overflow: 'hidden',
};

const actionBoxStyle: React.CSSProperties = {
  marginTop: '10px',
  padding: '10px',
  backgroundColor: '#0f172a',
  borderRadius: '8px',
  border: '1px solid #1e293b',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};

const failBtnStyle: React.CSSProperties = {
  backgroundColor: '#7f1d1d',
  color: '#f87171',
  border: '1px solid #ef4444',
  borderRadius: '6px',
  padding: '6px 12px',
  fontSize: '10px',
  fontWeight: 'bold',
  cursor: 'pointer',
  fontFamily: 'monospace',
};
