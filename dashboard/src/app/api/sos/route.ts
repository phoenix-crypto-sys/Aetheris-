import { NextResponse } from 'next/server';

/**
 * Next.js API Proxy Route:
 * Proxies ticket queries, SOS ingestion, rate limiting, and cancellations to the
 * FastAPI backend routing engine (Single Source of Truth).
 */

const getBackendUrl = (): string => {
  return (
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.BACKEND_API_URL ||
    'http://localhost:8000'
  );
};

export async function GET() {
  const backendUrl = getBackendUrl();
  try {
    const res = await fetch(`${backendUrl}/api/v1/tickets`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error: any) {
    return NextResponse.json(
      {
        status: 'OFFLINE_FALLBACK',
        scannerMode: 'CONTINUOUS_BLE_NETWORK_SCAN',
        packetCount: 0,
        tickets: [],
        error: error.message,
      },
      { status: 502 }
    );
  }
}

export async function POST(request: Request) {
  const backendUrl = getBackendUrl();
  try {
    const body = await request.json();
    const res = await fetch(`${backendUrl}/api/v1/tickets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error: any) {
    return NextResponse.json(
      { status: 'ERROR', message: error.message || 'FastAPI backend connection error' },
      { status: 502 }
    );
  }
}

export async function DELETE() {
  const backendUrl = getBackendUrl();
  try {
    const res = await fetch(`${backendUrl}/api/v1/tickets`, {
      method: 'DELETE',
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error: any) {
    return NextResponse.json(
      { status: 'ERROR', message: error.message },
      { status: 502 }
    );
  }
}
