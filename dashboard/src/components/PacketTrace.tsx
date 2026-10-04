import React from 'react';

export interface PacketTraceItem {
  sender_id: string;
  location: { lat: number; lng: number };
  timestamp: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  ttl: number;
  hop_count: number;
  route_trace: string[];
}

interface PacketTraceProps {
  packets: PacketTraceItem[];
  onClear?: () => void;
}

export const PacketTraceView: React.FC<PacketTraceProps> = ({ packets, onClear }) => {
  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: '#00f0ff', fontWeight: 'bold' }}>◈</span>
          <span style={titleStyle}>LIVE PACKET TRACE STREAM</span>
        </div>
        {onClear && (
          <button onClick={onClear} style={btnStyle}>
            CLEAR STREAM
          </button>
        )}
      </div>

      <div style={scrollAreaStyle}>
        {packets.length === 0 ? (
          <div style={emptyStyle}>No packets in trace feed...</div>
        ) : (
          // Display in chronological order with latest at top or bottom
          packets.slice().reverse().map((pkt, idx) => {
            let priorityBg = '#0f172a';
            let priorityColor = '#38bdf8';
            if (pkt.priority === 'critical') {
              priorityBg = '#7f1d1d';
              priorityColor = '#f87171';
            } else if (pkt.priority === 'high') {
              priorityBg = '#78350f';
              priorityColor = '#fbbf24';
            }

            return (
              <div key={`${pkt.sender_id}-${pkt.timestamp}-${idx}`} style={rowStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ ...priorityBadgeStyle, backgroundColor: priorityBg, color: priorityColor }}>
                      {pkt.priority.toUpperCase()}
                    </span>
                    <span style={{ color: '#f8fafc', fontWeight: 'bold' }}>{pkt.sender_id}</span>
                    <span style={{ color: '#64748b' }}>Hops: {pkt.hop_count}</span>
                  </div>
                  <span style={{ color: '#475569', fontSize: '10px' }}>
                    {new Date(pkt.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <div style={{ color: '#cbd5e1', fontSize: '11px', marginBottom: '4px' }}>"{pkt.message}"</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '9px', color: '#00f0ff' }}>
                  <span>ROUTE TRACE:</span>
                  <span>{pkt.route_trace.join(' ➔ ')}</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

const containerStyle: React.CSSProperties = {
  backgroundColor: '#090d16',
  borderRadius: '12px',
  padding: '14px',
  border: '1px solid #1e293b',
  fontFamily: 'monospace',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '12px',
};

const titleStyle: React.CSSProperties = {
  color: '#38bdf8',
  fontSize: '11px',
  fontWeight: 'bold',
  letterSpacing: '1px',
};

const btnStyle: React.CSSProperties = {
  backgroundColor: '#1e293b',
  color: '#94a3b8',
  border: 'none',
  borderRadius: '6px',
  padding: '4px 8px',
  fontSize: '9px',
  cursor: 'pointer',
  fontFamily: 'monospace',
};

const scrollAreaStyle: React.CSSProperties = {
  maxHeight: '260px',
  overflowY: 'auto',
  backgroundColor: '#050810',
  borderRadius: '8px',
  padding: '10px',
  border: '1px solid #1e293b',
};

const emptyStyle: React.CSSProperties = {
  color: '#475569',
  fontStyle: 'italic',
  fontSize: '11px',
  textAlign: 'center',
  padding: '16px 0',
};

const rowStyle: React.CSSProperties = {
  padding: '8px 0',
  borderBottom: '1px solid #0f172a',
};

const priorityBadgeStyle: React.CSSProperties = {
  padding: '2px 6px',
  borderRadius: '4px',
  fontSize: '8px',
  fontWeight: 'bold',
};
