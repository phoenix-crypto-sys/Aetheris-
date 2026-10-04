import { IngestRateLimiter } from '../src/services/rateLimiter.ts';

function runTests() {
  console.log('Running TypeScript Rate Limiter tests...');

  const limiter = new IngestRateLimiter(5, 2.0);
  const senderA = 0x1234;
  const startTime = 1000000;

  // 1. Within limit
  for (let i = 0; i < 5; i++) {
    const allowed = limiter.isAllowed(senderA, startTime + i * 100);
    if (!allowed) {
      throw new Error(`Packet ${i + 1} within limit was rejected`);
    }
  }
  console.log('✓ 5 packets within limit allowed');

  // 2. Exceeding limit
  const rejected6th = limiter.isAllowed(senderA, startTime + 600);
  if (rejected6th) {
    throw new Error('6th packet was allowed but should have been rejected');
  }
  console.log('✓ 6th packet rejected as flood');

  // 3. Sliding window expiration
  const allowedLater = limiter.isAllowed(senderA, startTime + 2500);
  if (!allowedLater) {
    throw new Error('Packet after sliding window expired was rejected');
  }
  console.log('✓ Packet after sliding window expired accepted');

  // 4. Independent senders
  const senderB = 0x9999;
  for (let i = 0; i < 5; i++) {
    limiter.isAllowed(senderA, startTime + 3000 + i * 100);
  }
  const senderAFlood = limiter.isAllowed(senderA, startTime + 3600);
  if (senderAFlood) {
    throw new Error('Sender A flood should be rejected');
  }
  const senderBAllowed = limiter.isAllowed(senderB, startTime + 3600);
  if (!senderBAllowed) {
    throw new Error('Sender B should be allowed despite Sender A flood');
  }
  console.log('✓ Independent sender isolation confirmed');

  console.log('All TypeScript Rate Limiter tests passed successfully!');
}

runTests();
