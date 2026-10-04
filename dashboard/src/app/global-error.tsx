'use client';

import React from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ padding: '32px', backgroundColor: '#050810', color: '#f8fafc', minHeight: '100vh', fontFamily: 'monospace' }}>
        <h2 style={{ color: '#ef4444' }}>◈ CRITICAL SYSTEM FAULT</h2>
        <p style={{ color: '#94a3b8' }}>{error.message || 'System-wide error encountered.'}</p>
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
          🔄 REINITIALIZE AETHERIS CORE
        </button>
      </body>
    </html>
  );
}
