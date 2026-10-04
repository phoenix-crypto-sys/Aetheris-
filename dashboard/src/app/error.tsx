'use client';

import React, { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Aetheris App Error:', error);
  }, [error]);

  return (
    <div style={{ padding: '32px', backgroundColor: '#050810', color: '#f8fafc', minHeight: '100vh', fontFamily: 'monospace' }}>
      <h2 style={{ color: '#ef4444' }}>◈ AETHERIS SYSTEM ERROR DETECTED</h2>
      <p style={{ color: '#94a3b8' }}>{error.message || 'An unexpected error occurred in the Command Operations Center.'}</p>
      <button
        onClick={() => reset()}
        style={{
          marginTop: '16px',
          padding: '10px 20px',
          backgroundColor: '#00f0ff22',
          border: '1px solid #00f0ff',
          color: '#00f0ff',
          borderRadius: '8px',
          cursor: 'pointer',
          fontFamily: 'monospace',
          fontWeight: 'bold',
        }}
      >
        🔄 RESTART DASHBOARD ENGINE
      </button>
    </div>
  );
}
