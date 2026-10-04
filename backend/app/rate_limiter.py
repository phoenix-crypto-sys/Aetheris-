import os
import time
from collections import defaultdict, deque
from typing import Dict, Deque, Optional


class IngestRateLimiter:
    """
    Sliding-window rate limiter per sender_hash to prevent packet flood attacks.
    Tunable via constructor arguments or environment variables:
      - AETHERIS_RATE_LIMIT_MAX_PACKETS (default: 10)
      - AETHERIS_RATE_LIMIT_WINDOW_SECS (default: 5.0)
    """

    def __init__(
        self,
        max_packets: Optional[int] = None,
        window_seconds: Optional[float] = None
    ):
        if max_packets is None:
            max_packets = int(os.environ.get("AETHERIS_RATE_LIMIT_MAX_PACKETS", "10"))
        if window_seconds is None:
            window_seconds = float(os.environ.get("AETHERIS_RATE_LIMIT_WINDOW_SECS", "5.0"))

        self.max_packets = max_packets
        self.window_seconds = window_seconds
        self._history: Dict[int, Deque[float]] = defaultdict(deque)

    def is_allowed(self, sender_hash: int, current_time: Optional[float] = None) -> bool:
        """
        Checks if the packet from sender_hash is allowed within the rate limit.
        If allowed, records the arrival time and returns True.
        If limit exceeded, returns False.
        """
        now = current_time if current_time is not None else time.time()
        window_start = now - self.window_seconds

        queue = self._history[sender_hash]
        # Evict timestamps outside sliding window
        while queue and queue[0] < window_start:
            queue.popleft()

        if len(queue) >= self.max_packets:
            return False

        queue.append(now)
        return True

    def reset(self):
        """Clears all rate limit tracking history (useful for testing)."""
        self._history.clear()


# Global default instance
ingest_rate_limiter = IngestRateLimiter()
