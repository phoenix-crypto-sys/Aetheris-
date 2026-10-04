import unittest
from backend.app.dedup import PacketDeduplicator, is_newer_packet_id

class TestPacketDeduplication(unittest.TestCase):
    def setUp(self):
        # 60s TTL
        self.dedup = PacketDeduplicator(cache_ttl_sec=60.0)

    def test_serial_number_arithmetic(self):
        # Normal sequential numbers
        self.assertTrue(is_newer_packet_id(2, 1))
        self.assertTrue(is_newer_packet_id(100, 50))
        self.assertFalse(is_newer_packet_id(1, 2))
        self.assertFalse(is_newer_packet_id(5, 5))

        # Wraparound across 65535 -> 0
        self.assertTrue(is_newer_packet_id(0, 65535))
        self.assertTrue(is_newer_packet_id(1, 65535))
        self.assertTrue(is_newer_packet_id(10, 65530))

        # Stale packets across wraparound boundary
        self.assertFalse(is_newer_packet_id(65535, 0))
        self.assertFalse(is_newer_packet_id(65530, 10))

        # Halfway point (32768)
        self.assertFalse(is_newer_packet_id(32768, 0))
        self.assertTrue(is_newer_packet_id(32767, 0))

    def test_duplicate_rejection(self):
        sender = 0x1234
        t0 = 1000.0

        # First packet: accepted
        accepted, reason = self.dedup.process_packet(sender, packet_id=1, ttl=10, current_time=t0)
        self.assertTrue(accepted)
        self.assertEqual(reason, "ACCEPTED")

        # Duplicate packet with same ID: rejected
        accepted, reason = self.dedup.process_packet(sender, packet_id=1, ttl=10, current_time=t0 + 5.0)
        self.assertFalse(accepted)
        self.assertEqual(reason, "DUPLICATE")

        # After 60s TTL expires: cache purged, but checked against latest sequence ID
        # Newer packet 2 is accepted
        accepted, reason = self.dedup.process_packet(sender, packet_id=2, ttl=10, current_time=t0 + 65.0)
        self.assertTrue(accepted)
        self.assertEqual(reason, "ACCEPTED")

    def test_wraparound_acceptance(self):
        sender = 0xABCD
        t0 = 1000.0

        # High sequence number
        accepted, reason = self.dedup.process_packet(sender, packet_id=65535, ttl=10, current_time=t0)
        self.assertTrue(accepted)

        # Wraps around to 0
        accepted, reason = self.dedup.process_packet(sender, packet_id=0, ttl=10, current_time=t0 + 1.0)
        self.assertTrue(accepted)
        self.assertEqual(reason, "ACCEPTED")

        # Wraps to 1
        accepted, reason = self.dedup.process_packet(sender, packet_id=1, ttl=10, current_time=t0 + 2.0)
        self.assertTrue(accepted)

        # Stale packet 65534 arrives out of order: rejected
        accepted, reason = self.dedup.process_packet(sender, packet_id=65534, ttl=10, current_time=t0 + 3.0)
        self.assertFalse(accepted)
        self.assertEqual(reason, "STALE_SEQUENCE")

    def test_expired_ttl_dropped(self):
        sender = 0x5678
        # TTL == 0 must be dropped immediately
        accepted, reason = self.dedup.process_packet(sender, packet_id=10, ttl=0)
        self.assertFalse(accepted)
        self.assertEqual(reason, "TTL_EXPIRED")

        # Negative TTL must be dropped
        accepted, reason = self.dedup.process_packet(sender, packet_id=11, ttl=-1)
        self.assertFalse(accepted)
        self.assertEqual(reason, "TTL_EXPIRED")

    def test_configurable_ttl(self):
        custom_dedup = PacketDeduplicator(cache_ttl_sec=15.0)
        self.assertEqual(custom_dedup.cache_ttl, 15.0)

if __name__ == "__main__":
    unittest.main()
