import unittest
from backend.app.rate_limiter import IngestRateLimiter


class TestIngestRateLimiter(unittest.TestCase):
    def setUp(self):
        self.limiter = IngestRateLimiter(max_packets=5, window_seconds=2.0)

    def test_within_limit_allowed(self):
        sender_a = 0x1234
        start_time = 1000.0

        for i in range(5):
            allowed = self.limiter.is_allowed(sender_a, current_time=start_time + i * 0.1)
            self.assertTrue(allowed, f"Packet {i+1} within limit should be allowed")

    def test_exceeding_limit_rejected(self):
        sender_a = 0x1234
        start_time = 1000.0

        for i in range(5):
            self.limiter.is_allowed(sender_a, current_time=start_time + i * 0.1)

        # 6th packet within 2-second window should be rejected
        allowed_6th = self.limiter.is_allowed(sender_a, current_time=start_time + 0.6)
        self.assertFalse(allowed_6th, "6th packet within window should be rejected")

        # 7th packet should also be rejected
        allowed_7th = self.limiter.is_allowed(sender_a, current_time=start_time + 0.7)
        self.assertFalse(allowed_7th, "7th packet within window should be rejected")

    def test_sliding_window_expiration(self):
        sender_a = 0x1234
        start_time = 1000.0

        for i in range(5):
            self.limiter.is_allowed(sender_a, current_time=start_time + i * 0.1)

        # Window expires at start_time + 2.0. At start_time + 2.5, old packets should have slid out
        allowed_later = self.limiter.is_allowed(sender_a, current_time=start_time + 2.5)
        self.assertTrue(allowed_later, "Packet after window slides should be allowed")

    def test_independent_senders(self):
        sender_a = 0xAAAA
        sender_b = 0xBBBB
        start_time = 1000.0

        # Exhaust sender_a
        for i in range(5):
            self.limiter.is_allowed(sender_a, current_time=start_time + i * 0.1)
        self.assertFalse(self.limiter.is_allowed(sender_a, current_time=start_time + 0.6))

        # sender_b should still be allowed
        self.assertTrue(
            self.limiter.is_allowed(sender_b, current_time=start_time + 0.6),
            "Sender B should not be affected by Sender A's flood"
        )


if __name__ == '__main__':
    unittest.main()
