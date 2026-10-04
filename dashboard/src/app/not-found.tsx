import React from 'react';

export default function NotFound() {
  return (
    <div style={{ padding: '32px', backgroundColor: '#050810', color: '#f8fafc', minHeight: '100vh', fontFamily: 'monospace', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <h1 style={{ color: '#00f0ff', fontSize: '36px' }}>404 - ENDPOINT NOT FOUND</h1>
      <p style={{ color: '#94a3b8' }}>The requested Aetheris mesh telemetry node route does not exist.</p>
      <a
        href="/"
        style={{
          marginTop: '16px',
          padding: '10px 20px',
          backgroundColor: '#00f0ff22',
          border: '1px solid #00f0ff',
          color: '#00f0ff',
          borderRadius: '8px',
          textDecoration: 'none',
          fontFamily: 'monospace',
          fontWeight: 'bold',
        }}
      >
        ⬅ RETURN TO COMMAND CENTER
      </a>
    </div>
  );
}
