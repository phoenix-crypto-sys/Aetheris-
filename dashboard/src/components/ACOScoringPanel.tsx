'use client';

import React, { useState } from 'react';
import { Cpu, Zap, Activity, Flame } from 'lucide-react';

interface ACOScoringPanelProps {
  onTriggerMissingAckPenalty?: () => void;
}

export function ACOScoringPanel({ onTriggerMissingAckPenalty }: ACOScoringPanelProps) {
  const [alpha, setAlpha] = useState(0.35); // Pheromone weight
  const [beta, setBeta] = useState(0.30);  // 1/hyp_dist weight
  const [gamma, setGamma] = useState(0.20); // Battery weight
  const [delta, setDelta] = useState(0.15); // Link quality weight

  const [decayLambda, setDecayLambda] = useState(0.02);
  const [simulatedPheromone, setSimulatedPheromone] = useState(0.85);

  // Calculate live score sample for a candidate node (e.g. hyp_dist=0.45, battery=90%, link_quality=0.8)
  const hypDist = 0.45;
  const invHypDist = 1.0 / Math.max(0.01, hypDist);
  const batteryNorm = 0.90;
  const linkQualNorm = 0.80;

  const liveScore = Math.round(
    (alpha * simulatedPheromone + beta * invHypDist + gamma * batteryNorm + delta * linkQualNorm) * 1000
  ) / 1000;

  const handleApplyPenalty = () => {
    setSimulatedPheromone((prev) => Math.max(0.01, Math.round(prev * 0.1 * 100) / 100)); // Hard -90% penalty
    if (onTriggerMissingAckPenalty) onTriggerMissingAckPenalty();
  };

  const handleReinforce = () => {
    setSimulatedPheromone((prev) => Math.min(1.0, Math.round((prev + 0.2) * 100) / 100));
  };

  return (
    <div style={{ backgroundColor: '#090d16', borderRadius: '16px', border: '1px solid #1e293b', padding: '20px', marginBottom: '24px' }}>
      {/* Panel Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ padding: '8px', borderRadius: '8px', backgroundColor: '#38bdf822', border: '1px solid #38bdf8', color: '#38bdf8' }}>
            <Cpu size={18} />
          </div>
          <div>
            <h2 style={{ fontSize: '14px', fontWeight: 'bold', fontFamily: 'monospace', color: '#f8fafc', margin: 0, letterSpacing: '1px' }}>
              MULTI-OBJECTIVE SCORING & ACO ROUTING ENGINE
            </h2>
            <p style={{ fontSize: '10px', color: '#38bdf8', fontFamily: 'monospace', margin: 0 }}>
              FORMULA: Score(n) = α·pheromone + β·(1/hyp_dist) + γ·battery + δ·link_quality
            </p>
          </div>
        </div>

        <div style={{ backgroundColor: '#0f172a', border: '1px solid #00f0ff88', borderRadius: '8px', padding: '6px 14px', fontFamily: 'monospace', fontSize: '11px' }}>
          <span style={{ color: '#64748b' }}>EVALUATED ROUTE SCORE: </span>
          <span style={{ color: '#00f0ff', fontWeight: 'bold', fontSize: '14px' }}>{liveScore}</span>
        </div>
      </div>

      {/* Sliders Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '20px' }}>
        {/* Alpha Slider */}
        <div style={{ backgroundColor: '#0f172a', borderRadius: '10px', padding: '12px', border: '1px solid #1e293b' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontFamily: 'monospace', color: '#64748b', marginBottom: '6px' }}>
            <span>α (PHEROMONE τ)</span>
            <span style={{ color: '#00f0ff', fontWeight: 'bold' }}>{alpha.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={alpha}
            onChange={(e) => setAlpha(parseFloat(e.target.value))}
            style={{ width: '100%', accentColor: '#00f0ff' }}
          />
        </div>

        {/* Beta Slider */}
        <div style={{ backgroundColor: '#0f172a', borderRadius: '10px', padding: '12px', border: '1px solid #1e293b' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontFamily: 'monospace', color: '#64748b', marginBottom: '6px' }}>
            <span>β (1 / HYPERBOLIC DIST)</span>
            <span style={{ color: '#10b981', fontWeight: 'bold' }}>{beta.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={beta}
            onChange={(e) => setBeta(parseFloat(e.target.value))}
            style={{ width: '100%', accentColor: '#10b981' }}
          />
        </div>

        {/* Gamma Slider */}
        <div style={{ backgroundColor: '#0f172a', borderRadius: '10px', padding: '12px', border: '1px solid #1e293b' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontFamily: 'monospace', color: '#64748b', marginBottom: '6px' }}>
            <span>γ (BATTERY LEVEL)</span>
            <span style={{ color: '#f59e0b', fontWeight: 'bold' }}>{gamma.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={gamma}
            onChange={(e) => setGamma(parseFloat(e.target.value))}
            style={{ width: '100%', accentColor: '#f59e0b' }}
          />
        </div>

        {/* Delta Slider */}
        <div style={{ backgroundColor: '#0f172a', borderRadius: '10px', padding: '12px', border: '1px solid #1e293b' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontFamily: 'monospace', color: '#64748b', marginBottom: '6px' }}>
            <span>δ (LINK QUALITY RSSI)</span>
            <span style={{ color: '#a855f7', fontWeight: 'bold' }}>{delta.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={delta}
            onChange={(e) => setDelta(parseFloat(e.target.value))}
            style={{ width: '100%', accentColor: '#a855f7' }}
          />
        </div>
      </div>

      {/* Pheromone Decay & Missing ACK Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#030712', borderRadius: '10px', padding: '12px', border: '1px solid #1e293b', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontFamily: 'monospace', fontSize: '11px' }}>
          <span style={{ color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Activity size={14} /> EXPONENTIAL DECAY (λ = {decayLambda}):
          </span>
          <span style={{ color: '#00f0ff', fontWeight: 'bold' }}>τ = {simulatedPheromone.toFixed(2)}</span>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={handleReinforce}
            style={{
              backgroundColor: '#064e3b',
              color: '#10b981',
              border: '1px solid #10b981',
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
            <Flame size={12} /> REINFORCE EDGE (+0.20 τ)
          </button>

          <button
            onClick={handleApplyPenalty}
            style={{
              backgroundColor: '#450a0a',
              color: '#ef4444',
              border: '1px solid #ef4444',
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
            <Zap size={12} /> MISSING ACK HARD PENALTY (-90% τ)
          </button>
        </div>
      </div>
    </div>
  );
}
