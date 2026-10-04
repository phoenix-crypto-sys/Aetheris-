"""
Layer 2: Packet Deduplication & Serial-Number Wraparound Tracking
"""

import os
import time
from typing import Dict, Tuple, Optional


def is_newer_packet_id(a: int, b: int) -> bool:
    """
    Serial number arithmetic comparison for 16-bit sequence numbers.
    a is newer than b if (a - b) mod 65536 < 32768 (and a != b).
    """
    if a == b:
        return False
    diff = (a - b) % 65536
    return diff < 32768


class PacketDeduplicator:
    """
    Deduplication cache with configurable TTL (default 60s) and
    16-bit serial-number arithmetic wraparound tracking.
    """
    def __init__(self, cache_ttl_sec: Optional[float] = None):
        if cache_ttl_sec is not None:
            self.cache_ttl = float(cache_ttl_sec)
        else:
            self.cache_ttl = float(os.getenv("AETHERIS_DEDUP_TTL", "60.0"))

        # Cache mapping: (sender_hash, packet_id) -> expiry_timestamp
        self.cache: Dict[Tuple[int, int], float] = {}
        # Tracks latest packet ID seen per sender_hash: sender_hash -> latest_packet_id
        self.latest_packet_ids: Dict[int, int] = {}

    def purge_expired(self, current_time: Optional[float] = None) -> int:
        now = time.time() if current_time is None else current_time
        expired_keys = [k for k, exp in self.cache.items() if exp <= now]
        for k in expired_keys:
            del self.cache[k]
        return len(expired_keys)

    def process_packet(
        self,
        sender_hash: int,
        packet_id: int,
        ttl: int,
        current_time: Optional[float] = None,
    ) -> Tuple[bool, str]:
        """
        Processes an incoming packet:
        1. Drops packets with TTL <= 0.
        2. Drops duplicate packets present in the deduplication cache.
        3. Validates sequence number against last seen using serial-number arithmetic.
        4. Ingests valid packets and stores them in the dedup cache.

        Returns: (accepted: bool, reason: str)
        """
        now = time.time() if current_time is None else current_time
        self.purge_expired(now)

        # 1. Drop packets with TTL <= 0
        if ttl <= 0:
            return False, "TTL_EXPIRED"

        s_hash = sender_hash & 0xFFFF
        p_id = packet_id & 0xFFFF
        cache_key = (s_hash, p_id)

        # 2. Duplicate check
        if cache_key in self.cache:
            if self.cache[cache_key] > now:
                return False, "DUPLICATE"

        # 3. Check against latest seen sequence number for this sender
        if s_hash in self.latest_packet_ids:
            last_id = self.latest_packet_ids[s_hash]
            if not is_newer_packet_id(p_id, last_id):
                # Stale / out-of-order sequence ID
                return False, "STALE_SEQUENCE"

        # 4. Accept packet and record in dedup cache
        self.cache[cache_key] = now + self.cache_ttl
        self.latest_packet_ids[s_hash] = p_id
        return True, "ACCEPTED"

    def clear(self) -> None:
        self.cache.clear()
        self.latest_packet_ids.clear()


# Default singleton instance
packet_deduplicator = PacketDeduplicator()
