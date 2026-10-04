'use client';

import React, { useRef, useEffect, useState } from 'react';
import { WebSOSTicket } from '../services/webBluetoothReceiver';
import { Radio, Compass } from 'lucide-react';

export interface PoincareNode {
  id: string;
  r: number; // 0.0 to 0.95 (Poincaré radius)
  theta: number; // angle in radians
  lat: number;
  lng: number;
  battery: number;
  rssi: number;
  priority: number;
}

interface PoincareMeshCanvasProps {
  tickets: WebSOSTicket[];
}

export function PoincareMeshCanvas({ tickets }: PoincareMeshCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [selectedNode, setSelectedNode] = useState<PoincareNode | null>(null);

  // Map incoming tickets to Poincaré disk polar coordinates
  const nodes: PoincareNode[] = [
    // Center Anchor Command Receiver Node
    { id: 'WEB-RECEIVER-BRIDGE', r: 0.0, theta: 0, lat: 37.7749, lng: -122.4194, battery: 100, rssi: -30, priority: 0 },
    ...tickets.map((t, idx) => {
      // Map distance (0 to 5 km) into Poincaré disk radius r = dist / (1 + dist) where r < 1
      const dist = Math.max(0.1, t.distanceKm);
      const r = Math.min(0.85, dist / (1.0 + dist));
      const theta = (idx * (2 * Math.PI / Math.max(1, tickets.length))) + 0.4;
      return {
        id: t.senderId,
        r,
        theta,
        lat: t.latitude,
        lng: t.longitude,
        battery: t.batteryPct,
        rssi: -45 - Math.round(t.distanceKm * 10),
        priority: t.priorityLevel,
      };
    }),
  ];

  /**
   * Hyperbolic distance metric in Poincaré Disk model:
   * cosh(d) = cosh(r1)*cosh(r2) - sinh(r1)*sinh(r2)*cos(theta1 - theta2)
   */
  const calculateHyperbolicDistance = (n1: PoincareNode, n2: PoincareNode): number => {
    const coshR1 = Math.cosh(n1.r * 2); // scale for visual dynamics
    const coshR2 = Math.cosh(n2.r * 2);
    const sinhR1 = Math.sinh(n1.r * 2);
    const sinhR2 = Math.sinh(n2.r * 2);
    const cosDiff = Math.cos(n1.theta - n2.theta);

    const coshD = Math.max(1.000001, coshR1 * coshR2 - sinhR1 * sinhR2 * cosDiff);
    return Math.acosh(coshD);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const maxRadius = Math.min(width, height) * 0.42;

    // Clear canvas
    ctx.fillStyle = '#050810';
    ctx.fillRect(0, 0, width, height);

    // Draw Poincaré Disk Boundary Circle (r = 1)
    ctx.beginPath();
    ctx.arc(centerX, centerY, maxRadius, 0, 2 * Math.PI);
    ctx.strokeStyle = '#00f0ff88';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw Concentric Hyperbolic Geodesic Metric Rings
    [0.2, 0.4, 0.6, 0.8].forEach((rRing) => {
      ctx.beginPath();
      ctx.arc(centerX, centerY, maxRadius * rRing, 0, 2 * Math.PI);
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    });

    // Crosshair axes
    ctx.beginPath();
    ctx.moveTo(centerX - maxRadius, centerY);
    ctx.lineTo(centerX + maxRadius, centerY);
    ctx.moveTo(centerX, centerY - maxRadius);
    ctx.lineTo(centerX, centerY + maxRadius);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Draw Relay Mesh Hyperbolic Edges
    nodes.forEach((n1, i) => {
      nodes.forEach((n2, j) => {
        if (i >= j) return;
        const hypDist = calculateHyperbolicDistance(n1, n2);
        if (hypDist < 2.5) {
          const x1 = centerX + n1.r * maxRadius * Math.cos(n1.theta);
          const y1 = centerY + n1.r * maxRadius * Math.sin(n1.theta);
          const x2 = centerX + n2.r * maxRadius * Math.cos(n2.theta);
          const y2 = centerY + n2.r * maxRadius * Math.sin(n2.theta);

          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.strokeStyle = n1.priority === 3 || n2.priority === 3 ? '#ef4444aa' : '#00f0ff44';
          ctx.lineWidth = Math.max(1, 3 - hypDist);
          ctx.stroke();

          // Render Hyperbolic Distance Metric Label on line center
          const midX = (x1 + x2) / 2;
          const midY = (y1 + y2) / 2;
          ctx.fillStyle = '#64748b';
          ctx.font = '9px monospace';
          ctx.fillText(`d_H=${hypDist.toFixed(2)}`, midX, midY);
        }
      });
    });

    // Draw Nodes
    nodes.forEach((node) => {
      const x = centerX + node.r * maxRadius * Math.cos(node.theta);
      const y = centerY + node.r * maxRadius * Math.sin(node.theta);

      // Node Glow Ring
      ctx.beginPath();
      ctx.arc(x, y, node.priority === 3 ? 16 : 12, 0, 2 * Math.PI);
      ctx.fillStyle = node.id === 'WEB-RECEIVER-BRIDGE' 
        ? '#10b98122' 
        : node.priority === 3 
        ? '#ef444433' 
        : '#00f0ff22';
      ctx.fill();

      // Node Circle
      ctx.beginPath();
      ctx.arc(x, y, node.id === 'WEB-RECEIVER-BRIDGE' ? 8 : 6, 0, 2 * Math.PI);
      ctx.fillStyle = node.id === 'WEB-RECEIVER-BRIDGE'
        ? '#10b981'
        : node.priority === 3
        ? '#ef4444'
        : '#00f0ff';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Label
      ctx.fillStyle = '#f8fafc';
      ctx.font = '10px monospace';
      ctx.fillText(node.id, x + 10, y + 3);
    });
  }, [tickets]);


  return (
    <div style={{ backgroundColor: '#090d16', borderRadius: '16px', border: '1px solid #1e293b', padding: '20px', marginBottom: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ padding: '8px', borderRadius: '8px', backgroundColor: '#00f0ff22', border: '1px solid #00f0ff', color: '#00f0ff' }}>
            <Compass size={18} />
          </div>
          <div>
            <h2 style={{ fontSize: '14px', fontWeight: 'bold', fontFamily: 'monospace', color: '#f8fafc', margin: 0, letterSpacing: '1px' }}>
              POINCARÉ HYPERBOLIC MESH TOPOLOGY CANVAS
            </h2>
            <p style={{ fontSize: '10px', color: '#00f0ff', fontFamily: 'monospace', margin: 0 }}>
              METRIC EQUATION: cosh(d) = cosh(r₁)cosh(r₂) - sinh(r₁)sinh(r₂)cos(θ₁ - θ₂)
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', fontSize: '10px', fontFamily: 'monospace' }}>
          <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Radio size={12} /> RECEIVER BRIDGE (r=0)
          </span>
          <span style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '4px' }}>
            ● SOS NODES
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: '#050810', borderRadius: '12px', padding: '12px', border: '1px solid #1e293b' }}>
        <canvas
          ref={canvasRef}
          width={700}
          height={450}
          style={{ maxWidth: '100%', height: 'auto', borderRadius: '8px' }}
        />
      </div>
    </div>
  );
}
