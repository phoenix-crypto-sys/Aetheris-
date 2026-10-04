import json
import os
import unittest
from backend.app.binary_packet import (
    pack_binary_packet,
    unpack_binary_packet,
    relay_binary_packet,
    compute_fletcher16,
    hash_sender_16,
    fnv1a_32,
)

class TestBinaryPacketFormat(unittest.TestCase):
    def setUp(self):
        root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
        self.vector_path = os.path.join(root_dir, "tests", "test_vectors.json")
        with open(self.vector_path, "r", encoding="utf-8") as f:
            self.vectors = json.load(f)

    def test_shared_test_vectors(self):
        """Assert identical output for all test vectors including negative coordinates and packetId 65535."""
        for v in self.vectors:
            with self.subTest(msg=v["description"]):
                packed = pack_binary_packet(
                    packet_id=v["packet_id"],
                    priority_level=v["priority_level"],
                    latitude=v["latitude"],
                    longitude=v["longitude"],
                    battery_pct=v["battery_pct"],
                    sender_id=v["sender_id"],
                    hop_count=v["hop_count"],
                    ttl=v["ttl"],
                )

                # Assert byte length is 18
                self.assertEqual(len(packed), 18)

                # Assert hex matches shared canonical vector
                self.assertEqual(packed.hex().lower(), v["hex_string"].lower())

                # Assert sender hash matches 32-bit FNV-1a truncated to 16 bits
                self.assertEqual(hash_sender_16(v["sender_id"]), v["sender_hash"])

                # Unpack and verify
                unpacked = unpack_binary_packet(packed)
                self.assertTrue(unpacked["is_valid"])
                self.assertEqual(unpacked["packet_id"], v["packet_id"])
                self.assertEqual(unpacked["priority_level"], v["priority_level"])
                self.assertAlmostEqual(unpacked["latitude"], v["latitude"], places=5)
                self.assertAlmostEqual(unpacked["longitude"], v["longitude"], places=5)
                self.assertEqual(unpacked["battery_pct"], v["battery_pct"])
                self.assertEqual(unpacked["hop_count"], v["hop_count"])
                self.assertEqual(unpacked["sender_hash"], v["sender_hash"])
                self.assertEqual(unpacked["ttl"], v["ttl"])

    def test_fletcher16_relay_recomputation(self):
        """
        Fletcher-16 is recomputed at every relay when HopCount and TTL change.
        Relayed packets must still pass verification.
        """
        initial_packet = pack_binary_packet(
            packet_id=100,
            priority_level=3,
            latitude=37.7749,
            longitude=-122.4194,
            battery_pct=90,
            sender_id="Room 222 - Victim",
            hop_count=0,
            ttl=10,
        )

        unpacked_orig = unpack_binary_packet(initial_packet)
        self.assertTrue(unpacked_orig["is_valid"])
        self.assertEqual(unpacked_orig["hop_count"], 0)
        self.assertEqual(unpacked_orig["ttl"], 10)

        # First Relay Hop
        hop1 = relay_binary_packet(initial_packet)
        unpacked_hop1 = unpack_binary_packet(hop1)
        self.assertTrue(unpacked_hop1["is_valid"])
        self.assertEqual(unpacked_hop1["hop_count"], 1)
        self.assertEqual(unpacked_hop1["ttl"], 9)
        self.assertNotEqual(unpacked_orig["checksum"], unpacked_hop1["checksum"])

        # Second Relay Hop
        hop2 = relay_binary_packet(hop1)
        unpacked_hop2 = unpack_binary_packet(hop2)
        self.assertTrue(unpacked_hop2["is_valid"])
        self.assertEqual(unpacked_hop2["hop_count"], 2)
        self.assertEqual(unpacked_hop2["ttl"], 8)

    def test_corrupted_packet_rejected_on_relay(self):
        """A corrupted packet must fail relay verification."""
        initial_packet = bytearray(
            pack_binary_packet(
                packet_id=5,
                priority_level=1,
                latitude=10.0,
                longitude=20.0,
                battery_pct=50,
                sender_id="Node-1",
            )
        )
        # Corrupt one payload byte
        initial_packet[4] ^= 0xFF
        with self.assertRaises(ValueError):
            relay_binary_packet(bytes(initial_packet))

    def test_expired_ttl_rejected_on_relay(self):
        """Packets with TTL <= 1 cannot be relayed further."""
        expired_packet = pack_binary_packet(
            packet_id=5,
            priority_level=1,
            latitude=10.0,
            longitude=20.0,
            battery_pct=50,
            sender_id="Node-1",
            ttl=1,
        )
        with self.assertRaises(ValueError):
            relay_binary_packet(expired_packet)

if __name__ == "__main__":
    unittest.main()
