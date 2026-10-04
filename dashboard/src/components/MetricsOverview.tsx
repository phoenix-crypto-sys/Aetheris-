import React from 'react';

interface MetricsProps {
  activeNodesCount: number;
  packetsRoutedCount: number;
  queueDepth: number;
  avgHopCount: number;
  decayRate: string;
}

export const MetricsOverview: React.FC<MetricsProps> = ({
  activeNodesCount,
  packetsRoutedCount,
  queueDepth,
  avgHopCount,
  decayRate,
}) => {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '20px' }}>
      <div style={cardStyle}>
        <div style={labelStyle}>ACTIVE MESH NODES</div>
        <div style={{ ...valueStyle, color: '#00f0ff' }}>{activeNodesCount}</div>
        <div style={subtextStyle}>BLE / LoRa / Rescue</div>
      </div>
      <div style={cardStyle}>
        <div style={labelStyle}>PACKETS ROUTED</div>
        <div style={valueStyle}>{packetsRoutedCount}</div>
        <div style={subtextStyle}>Hyperbolic + ACO</div>
      </div>
      <div style={cardStyle}>
        <div style={labelStyle}>STORE & FORWARD QUEUE</div>
        <div style={{ ...valueStyle, color: queueDepth > 0 ? '#f59e0b' : '#10b981' }}>{queueDepth}</div>
        <div style={subtextStyle}>Priority-Scaled TTL</div>
      </div>
      <div style={cardStyle}>
        <div style={labelStyle}>AVG HOP COUNT</div>
        <div style={valueStyle}>{avgHopCount.toFixed(1)}</div>
        <div style={subtextStyle}>Hops to Sink</div>
      </div>
      <div style={cardStyle}>
        <div style={labelStyle}>PHEROMONE DECAY (λ)</div>
        <div style={{ ...valueStyle, color: '#38bdf8' }}>{decayRate}</div>
        <div style={subtextStyle}>τ = τ₀ · e^(-λt)</div>
      </div>
    </div>
  );
};

const cardStyle: React.CSSProperties = {
  backgroundColor: '#090d16',
  borderRadius: '12px',
  padding: '14px 16px',
  border: '1px solid #1e293b',
  fontFamily: 'monospace',
};

const labelStyle: React.CSSProperties = {
  color: '#64748b',
  fontSize: '10px',
  fontWeight: 'bold',
  letterSpacing: '1px',
  marginBottom: '6px',
};

const valueStyle: React.CSSProperties = {
  color: '#f8fafc',
  fontSize: '22px',
  fontWeight: '900',
};

const subtextStyle: React.CSSProperties = {
  color: '#475569',
  fontSize: '9px',
  marginTop: '4px',
};
