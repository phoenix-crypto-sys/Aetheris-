import { packBinaryPacket, unpackBinaryPacket, hashSender16 } from '../dashboard/src/services/binaryPacket.ts';

const DASHBOARD_URL = process.env.DASHBOARD_URL || 'http://localhost:3000';
const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

async function testE2EFlow() {
  console.log('=== AETHERIS ROOM 222 END-TO-END FLOW VALIDATION ===\n');

  // Step 1: Verify /mobile HTML has honest labeling
  console.log('Step 1: Checking /mobile for honest transport label...');
  const mobileRes = await fetch(`${DASHBOARD_URL}/mobile`);
  if (!mobileRes.ok) throw new Error(`Failed to fetch /mobile: ${mobileRes.status}`);
  const mobileHtml = await mobileRes.text();
  if (!mobileHtml.includes('Transport: Simulated mesh over LAN (WebSocket/HTTP)')) {
    throw new Error('Label "Transport: Simulated mesh over LAN (WebSocket/HTTP)" not found in /mobile HTML');
  }
  console.log('✓ Found "Transport: Simulated mesh over LAN (WebSocket/HTTP)" in /mobile\n');

  // Step 2: Verify / (dashboard) HTML has SIMULATION MODE
  console.log('Step 2: Checking / (dashboard) for SIMULATION MODE badge...');
  const dashRes = await fetch(`${DASHBOARD_URL}/`);
  if (!dashRes.ok) throw new Error(`Failed to fetch /: ${dashRes.status}`);
  const dashHtml = await dashRes.text();
  if (!dashHtml.includes('SIMULATION MODE')) {
    throw new Error('Badge "SIMULATION MODE" not found in dashboard HTML');
  }
  console.log('✓ Found "SIMULATION MODE" badge in dashboard\n');

  // Step 3: Trigger SOS for "Room 222 - Victim (Wall Blocked)"
  console.log('Step 3: Transmitting SOS for "Room 222 - Victim (Wall Blocked)"...');
  const senderName = 'Room 222 - Victim (Wall Blocked)';
  const sHash16 = hashSender16(senderName);
  const routeTrace = [
    'Room 222 - Victim (Wall Blocked)',
    'Room 322 - Mesh Relay (Floor 3)',
    'Room 422 - Command Sink (Floor 4)',
  ];

  const binaryBytes = packBinaryPacket({
    packetId: 222,
    priorityLevel: 3,
    latitude: 37.774929,
    longitude: -122.419416,
    batteryPct: 88,
    senderId: senderName,
    senderHash: sHash16,
    hopCount: 2,
    ttl: 23,
  });

  const decoded = unpackBinaryPacket(binaryBytes);
  const rawHex = decoded.hexDump.replace(/\s+/g, '');
  console.log(`- Generated Packet Hex Dump: ${decoded.hexDump}`);
  console.log(`- Raw Hex: ${rawHex} (${rawHex.length} hex chars = ${rawHex.length / 2} bytes)`);
  console.log(`- Checksum Valid: ${decoded.isValid}`);
  if (rawHex.length !== 36) {
    throw new Error(`Expected 36 raw hex chars (18 bytes), got ${rawHex.length}`);
  }
  if (!decoded.isValid) {
    throw new Error('Checksum invalid on generated packet');
  }

  const sosRes = await fetch(`${DASHBOARD_URL}/api/sos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'SOS',
      packetId: 222,
      senderId: senderName,
      customSenderName: senderName,
      senderHash: sHash16,
      priorityLevel: 3,
      latitude: 37.774929,
      longitude: -122.419416,
      batteryPct: 88,
      hopCount: 2,
      ttl: 23,
      hexDump: decoded.hexDump,
      message: 'EMERGENCY SOS: Wall collapsed in Room 222. Immediate extraction required.',
      route_trace: routeTrace,
      transport: 'LAN-sim',
    }),
  });

  if (!sosRes.ok) throw new Error(`SOS POST failed with status: ${sosRes.status}`);
  const sosData = await sosRes.json();
  console.log(`✓ SOS Ingested: Status=${sosData.status}, ID=${sosData.ticket?.id}`);
  console.log(`  Transport label: ${sosData.ticket?.transport}`);
  console.log(`  Route Trace: ${sosData.ticket?.route_trace?.join(' -> ')}\n`);

  // Step 4: Verify ticket appears in dashboard feed
  console.log('Step 4: Querying dashboard /api/sos feed...');
  const feedRes = await fetch(`${DASHBOARD_URL}/api/sos`);
  const feedData = await feedRes.json();
  const room222Ticket = feedData.tickets?.find((t) => t.senderId.includes('Room 222'));
  if (!room222Ticket) {
    throw new Error('Room 222 ticket not found in live feed');
  }
  console.log(`✓ Ticket confirmed in live feed: ${room222Ticket.senderId}`);
  console.log(`  Priority: ${room222Ticket.priorityLevel} (Label: ${room222Ticket.priorityLabel})`);
  console.log(`  Fletcher-16 Checksum: ${room222Ticket.checksumValid ? 'VALID' : 'INVALID'}`);
  console.log(`  Transport: ${room222Ticket.transport}\n`);

  // Step 5: Test Backend Routing Decision
  console.log('Step 5: Testing FastAPI Hyperbolic & ACO routing decision...');
  const routeDecisionRes = await fetch(`${BACKEND_URL}/api/v1/packets/route`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      packet: {
        sender_id: senderName,
        location: { lat: 37.774929, lng: -122.419416 },
        timestamp: new Date().toISOString(),
        priority: 'critical',
        message: 'EMERGENCY SOS',
        ttl: 23,
        hop_count: 2,
        route_trace: routeTrace,
      },
      destination_node_id: 'Room 422 - Command Sink (Floor 4)',
      available_candidate_nodes: [
        {
          id: 'Room 322 - Mesh Relay (Floor 3)',
          role: 'BLE_NODE',
          location: { lat: 37.774910, lng: -122.419400 },
          battery: 92.0,
          rssi: -58.0,
          link_quality: 0.95,
          status: 'ONLINE',
          is_anchor: false,
        },
        {
          id: 'Room 422 - Command Sink (Floor 4)',
          role: 'RESCUE_NODE',
          location: { lat: 37.774900, lng: -122.419400 },
          battery: 100.0,
          rssi: -45.0,
          link_quality: 0.99,
          status: 'ONLINE',
          is_anchor: true,
        },
      ],
    }),
  });

  if (!routeDecisionRes.ok) throw new Error(`FastAPI routing failed: ${routeDecisionRes.status}`);
  const routingData = await routeDecisionRes.json();
  console.log(`✓ Routing Decision: Mode=${routingData.routing_mode}, Selected Next Hop=${routingData.selected_next_hop}`);
  console.log(`  Candidate Scores:`, routingData.candidate_scores);
  console.log(`  Route Trace:`, routingData.route_trace);
  if (isNaN(routingData.score)) {
    throw new Error('Routing score was NaN!');
  }
  console.log('\n');

  // Step 6: Dispatch & ACK
  console.log('Step 6: Simulating Dispatch & ACK confirmation...');
  const ackRes = await fetch(`${BACKEND_URL}/api/v1/ack`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      packet_id: room222Ticket.id,
      source_id: senderName,
      target_id: 'WEB-COMMAND-SINK',
      success: true,
    }),
  });
  const ackData = await ackRes.json();
  console.log(`✓ ACK Processed: ${ackData.status}\n`);

  // Step 7: Cancel SOS
  console.log('Step 7: Canceling SOS from Room 222...');
  const cancelRes = await fetch(`${DASHBOARD_URL}/api/sos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'CANCEL_SOS',
      senderId: senderName,
    }),
  });
  const cancelData = await cancelRes.json();
  console.log(`✓ Cancel Response: ${cancelData.status} - ${cancelData.message}\n`);

  // Step 8: Verify feed is now cleared (Clean Standby Mode)
  console.log('Step 8: Verifying feed is in Clean Standby Mode...');
  const verifyFeedRes = await fetch(`${DASHBOARD_URL}/api/sos`);
  const verifyFeedData = await verifyFeedRes.json();
  const remaining = verifyFeedData.tickets?.filter((t) => t.senderId.includes('Room 222')) || [];
  if (remaining.length !== 0) {
    throw new Error(`Expected 0 remaining tickets for Room 222, found ${remaining.length}`);
  }
  console.log(`✓ Confirmed Room 222 cleared. Total active tickets: ${verifyFeedData.tickets.length}\n`);

  console.log('======================================================');
  console.log('🎉 ALL ROOM 222 END-TO-END DEMO FLOW CHECKS PASSED! 🎉');
  console.log('======================================================');
}

testE2EFlow().catch((err) => {
  console.error('❌ E2E Flow Failed:', err);
  process.exit(1);
});
