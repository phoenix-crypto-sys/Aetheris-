"""
Aetheris 18-Byte Compact Binary Struct Packing & Fletcher-16 Library (Python Mirror)

18-Byte Big-Endian Wire Layout:
[0..1]   PacketID (uint16 big-endian)
[2]      PriorityLevel (uint8: 0=Heartbeat, 1=Low, 2=Medium, 3=Critical SOS)
[3..6]   Latitude (int32 big-endian, scaled by 1e6)
[7..10]  Longitude (int32 big-endian, scaled by 1e6)
[11]     BatteryPct (uint8: 0-100)
[12]     HopCount (uint8: 0-255, incremented at each relay hop)
[13..14] SenderHash (uint16 big-endian, 32-bit FNV-1a truncated to 16 bits)
[15]     TTL (uint8: 0-255, decremented at each relay hop)
[16..17] Fletcher-16 Checksum (uint16 big-endian, calculated over bytes 0..15;
         recomputed at each relay hop when HopCount and TTL change)
"""

import struct
from typing import Dict, Any, Optional

FNV_OFFSET_BASIS_32 = 0x811C9DC5
FNV_PRIME_32 = 0x01000193


def fnv1a_32(text: str) -> int:
    """Computes 32-bit FNV-1a hash of a UTF-8 string."""
    h = FNV_OFFSET_BASIS_32
    for b in text.encode("utf-8"):
        h ^= b
        h = (h * FNV_PRIME_32) & 0xFFFFFFFF
    return h


def hash_sender_16(text: str) -> int:
    """Sender hash: 32-bit FNV-1a truncated to 16 bits for the wire."""
    return fnv1a_32(text) & 0xFFFF


def compute_fletcher16(data: bytes, length: int) -> int:
    """
    Computes Fletcher-16 checksum over `length` bytes.
    Returns uint16 in big-endian representation: (sum2 << 8) | sum1.
    """
    sum1 = 0
    sum2 = 0
    for i in range(length):
        sum1 = (sum1 + data[i]) % 255
        sum2 = (sum2 + sum1) % 255
    return (sum2 << 8) | sum1


def pack_binary_packet(
    packet_id: int,
    priority_level: int,
    latitude: float,
    longitude: float,
    battery_pct: int,
    sender_id: str = "",
    sender_hash: Optional[int] = None,
    hop_count: int = 0,
    ttl: int = 24,
) -> bytes:
    """
    Packs telemetry into an 18-byte big-endian binary frame.
    Calculates Fletcher-16 checksum over bytes 0..15.
    """
    p_id = packet_id & 0xFFFF
    p_level = max(0, min(3, priority_level))
    scaled_lat = int(round(latitude * 1e6))
    scaled_lng = int(round(longitude * 1e6))
    battery = max(0, min(100, int(round(battery_pct))))
    hops = max(0, min(255, hop_count))
    s_hash = (sender_hash if sender_hash is not None else hash_sender_16(sender_id)) & 0xFFFF
    time_to_live = max(0, min(255, ttl))

    # Pack 16 bytes payload (without checksum)
    payload = struct.pack(
        ">H B i i B B H B",
        p_id,
        p_level,
        scaled_lat,
        scaled_lng,
        battery,
        hops,
        s_hash,
        time_to_live,
    )

    # Compute Fletcher-16 checksum over bytes 0..15
    checksum = compute_fletcher16(payload, 16)

    # Return full 18-byte packet
    return payload + struct.pack(">H", checksum)


def unpack_binary_packet(data: bytes) -> Dict[str, Any]:
    """
    Unpacks an 18-byte binary frame and validates the Fletcher-16 checksum.
    """
    if len(data) < 18:
        raise ValueError(f"Invalid packet length: {len(data)} bytes (expected 18)")

    packet_slice = data[:18]
    p_id, p_level, scaled_lat, scaled_lng, battery, hops, s_hash, ttl, checksum = struct.unpack(
        ">H B i i B B H B H",
        packet_slice,
    )

    computed_checksum = compute_fletcher16(packet_slice, 16)
    is_valid = checksum == computed_checksum

    labels = ["low", "medium", "high", "critical"]
    priority_label = labels[min(3, max(0, p_level))]

    hex_dump = " ".join(f"{b:02X}" for b in packet_slice)

    return {
        "packet_id": p_id,
        "priority_level": p_level,
        "priority_label": priority_label,
        "latitude": round(scaled_lat / 1e6, 6),
        "longitude": round(scaled_lng / 1e6, 6),
        "battery_pct": battery,
        "hop_count": hops,
        "sender_hash": s_hash,
        "ttl": ttl,
        "checksum": checksum,
        "is_valid": is_valid,
        "hex_dump": hex_dump,
    }


def relay_binary_packet(packet_bytes: bytes) -> bytes:
    """
    Relays a packet:
    - Verifies incoming checksum
    - Checks TTL > 1 (drops expired packets)
    - Increments HopCount (capped at 255)
    - Decrements TTL
    - Recomputes Fletcher-16 checksum over bytes 0..15
    """
    if len(packet_bytes) < 18:
        raise ValueError(f"Packet too short to relay: {len(packet_bytes)} bytes")

    pkt = bytearray(packet_bytes[:18])
    incoming_checksum = struct.unpack(">H", pkt[16:18])[0]
    expected_checksum = compute_fletcher16(bytes(pkt), 16)

    if incoming_checksum != expected_checksum:
        raise ValueError("Cannot relay corrupted packet: Fletcher-16 checksum mismatch")

    current_ttl = pkt[15]
    if current_ttl <= 1:
        raise ValueError(f"Packet TTL expired (TTL={current_ttl})")

    # Increment hop count
    current_hops = pkt[12]
    pkt[12] = min(255, current_hops + 1)

    # Decrement TTL
    pkt[15] = current_ttl - 1

    # Recompute Fletcher-16 checksum over updated 16 bytes
    new_checksum = compute_fletcher16(bytes(pkt), 16)
    pkt[16:18] = struct.pack(">H", new_checksum)

    return bytes(pkt)
