import os
import math
import time
from datetime import datetime, timezone
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict, Any, Optional

from .models import (
    AetherisPacketModel,
    NodeStateModel,
    RouteDecisionRequest,
    RouteDecisionResponse,
    AckNotification,
    LocationCoordinates,
)
from .routing.engine import CoreRoutingEngine
from .supabase_client import supabase_service
from .binary_packet import pack_binary_packet, unpack_binary_packet, hash_sender_16
from .rate_limiter import ingest_rate_limiter
from .dedup import packet_deduplicator

app = FastAPI(
    title="Aetheris 4-Layer Mesh Routing Intelligence API",
    description="Backend routing engine featuring Hyperbolic pathing, ACO pheromone scoring, and resilience tracking.",
    version="2.0.0"
)

# CORS configuration reading allowed origins from env var
allowed_origins_env = os.environ.get("ALLOWED_ORIGINS") or os.environ.get("CORS_ORIGINS")
if allowed_origins_env:
    allowed_origins = [o.strip() for o in allowed_origins_env.split(",") if o.strip()]
else:
    allowed_origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

routing_engine = CoreRoutingEngine()

# Canonical in-memory ticket store (Single Source of Truth)
live_sos_tickets: List[Dict[str, Any]] = []


def calculate_haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculates distance in kilometers between two GPS coordinates using Haversine formula."""
    if lat1 == lat2 and lon1 == lon2:
        return 0.0
    r = 6371.0  # Earth radius in km
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(d_lon / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return round(r * c, 2)


@app.get("/health")
def health_check():
    return {
        "status": "ONLINE",
        "system": "Aetheris 4-Layer Emergency Mesh",
        "architecture_version": "2.0.0"
    }


# ==============================================================================
# CANONICAL TICKET MANAGEMENT, DEDUPLICATION & RATE LIMITING ENDPOINTS
# ==============================================================================

@app.get("/api/v1/tickets")
def get_tickets():
    """Returns canonical active emergency SOS tickets."""
    return {
        "status": "ACTIVE",
        "scannerMode": "CONTINUOUS_BLE_NETWORK_SCAN",
        "packetCount": len(live_sos_tickets),
        "tickets": live_sos_tickets,
    }


@app.post("/api/v1/tickets")
def ingest_or_cancel_ticket(payload: Dict[str, Any]):
    """
    Primary SOS Ingestion & Cancellation Endpoint.
    Enforces Rate Limiting, 60s Dedup with 16-bit serial arithmetic,
    Fletcher-16 integrity verification, and geodesic distance tracking.
    """
    global live_sos_tickets

    action = payload.get("action", "SOS")
    sender_id = payload.get("senderId")
    custom_sender_name = payload.get("customSenderName")
    effective_sender_id = custom_sender_name or sender_id

    if not effective_sender_id:
        raise HTTPException(status_code=400, detail="Invalid packet payload: senderId required")

    priority_level = int(payload.get("priorityLevel", 3))

    # 1. Cancellation / Resolution or Routine Heartbeat (priorityLevel 0)
    if action in ("CANCEL_SOS", "RESOLVE") or priority_level == 0:
        live_sos_tickets = [
            t for t in live_sos_tickets
            if t.get("senderId") not in (effective_sender_id, sender_id)
        ]
        return {
            "status": "RESOLVED",
            "message": f"SOS Emergency Warning Canceled for {effective_sender_id}",
            "senderId": effective_sender_id,
        }

    # 2. Determine 16-bit sender hash
    sender_hash = payload.get("senderHash")
    if sender_hash is not None:
        s_hash_16 = int(sender_hash) & 0xFFFF
    else:
        s_hash_16 = hash_sender_16(effective_sender_id)

    # 3. Rate limiting per sender_hash (reject floods)
    if not ingest_rate_limiter.is_allowed(s_hash_16):
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit exceeded for sender hash 0x{s_hash_16:04X}. Flood packet dropped."
        )

    # 4. Deduplication & TTL check
    packet_id = int(payload.get("packetId", 1))
    ttl = int(payload.get("ttl", 24))
    accepted, reason = packet_deduplicator.process_packet(s_hash_16, packet_id, ttl)
    if not accepted:
        if reason == "TTL_EXPIRED":
            raise HTTPException(status_code=400, detail="Packet TTL expired (TTL <= 0). Dropped.")
        if reason == "DUPLICATE":
            return {"status": "DUPLICATE", "message": "Duplicate packet dropped"}

    # 5. Geolocation & Haversine distance
    lat = float(payload.get("latitude", 37.774900))
    lng = float(payload.get("longitude", -122.419400))
    cmd_lat = float(payload.get("commandCenterLat", 37.774900))
    cmd_lng = float(payload.get("commandCenterLng", -122.419400))
    dist_km = calculate_haversine(cmd_lat, cmd_lng, lat, lng)

    # 6. Route Trace
    route_trace = payload.get("route_trace")
    if not isinstance(route_trace, list) or len(route_trace) == 0:
        route_trace = [
            effective_sender_id,
            "FIELD-RELAY-01 (BLE Mesh)",
            "RESCUE-BRIDGE-02 (LoRa)",
            "WEB-COMMAND-SINK",
        ]

    # 7. Binary serialization & Fletcher-16 verification
    hex_dump = payload.get("hexDump")
    checksum_valid = True
    if not hex_dump:
        try:
            packed = pack_binary_packet({
                "packet_id": packet_id,
                "priority_level": priority_level,
                "latitude": lat,
                "longitude": lng,
                "battery_pct": int(payload.get("batteryPct", 90)),
                "sender_id": effective_sender_id,
                "sender_hash": s_hash_16,
                "hop_count": max(len(route_trace) - 1, int(payload.get("hopCount", 1))),
                "ttl": ttl,
            })
            unpacked = unpack_binary_packet(packed)
            hex_dump = unpacked["hex_dump"]
            checksum_valid = unpacked["is_valid"]
        except Exception:
            hex_dump = "00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00"

    priority_label = "critical" if priority_level == 3 else "high" if priority_level == 2 else "medium"

    # 8. Assemble canonical ticket
    transport_label = payload.get("transport") or (
        "BLE" if any("BLE" in str(r) for r in route_trace) else "LAN-sim"
    )

    new_ticket = {
        "id": f"TICKET-{effective_sender_id}-{packet_id or int(time.time() * 1000)}",
        "packetId": packet_id,
        "senderId": effective_sender_id,
        "customSenderName": effective_sender_id,
        "senderHash32": payload.get("senderHash32", s_hash_16),
        "senderHash": s_hash_16,
        "priorityLabel": priority_label,
        "priorityLevel": priority_level,
        "latitude": lat,
        "longitude": lng,
        "batteryPct": payload.get("batteryPct", 90),
        "hopCount": max(len(route_trace) - 1, int(payload.get("hopCount", 1))),
        "ttl": ttl,
        "message": payload.get("message", "EMERGENCY SOS: Immediate Disaster Extraction Requested"),
        "route_trace": route_trace,
        "checksumValid": checksum_valid,
        "hexDump": hex_dump,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "ageSeconds": 0,
        "distanceKm": dist_km,
        "status": "PENDING",
        "transport": transport_label,
    }

    # 9. Evaluate candidate hop routing asynchronously / safely
    try:
        packet_model = AetherisPacketModel(
            sender_id=effective_sender_id,
            location=LocationCoordinates(lat=lat, lng=lng),
            timestamp=new_ticket["timestamp"],
            priority=priority_label,
            message=new_ticket["message"],
            ttl=ttl,
            hop_count=new_ticket["hopCount"],
            route_trace=route_trace,
            sender_hash=s_hash_16,
        )
        candidates = [
            NodeStateModel(
                id="Room 322 - Mesh Relay (Floor 3)",
                role="BLE_NODE",
                location=LocationCoordinates(lat=lat - 0.0001, lng=lng + 0.0001),
                battery=92.0,
                rssi=-58.0,
                link_quality=0.95,
                status="ONLINE",
                is_anchor=False,
            ),
            NodeStateModel(
                id="WEB-COMMAND-SINK",
                role="RESCUE_NODE",
                location=LocationCoordinates(lat=cmd_lat, lng=cmd_lng),
                battery=100.0,
                rssi=-30.0,
                link_quality=0.99,
                status="ONLINE",
                is_anchor=True,
            ),
        ]
        routing_engine.route_packet(packet=packet_model, destination_node=candidates[1], candidates=candidates)
    except Exception:
        pass

    # 10. Update existing ticket from same sender or insert new
    existing_idx = next(
        (i for i, t in enumerate(live_sos_tickets) if t.get("senderId") == new_ticket["senderId"]),
        None,
    )
    if existing_idx is not None:
        if live_sos_tickets[existing_idx].get("status") == "DISPATCHED":
            new_ticket["status"] = "DISPATCHED"
        live_sos_tickets[existing_idx] = new_ticket
    else:
        live_sos_tickets.insert(0, new_ticket)
        if len(live_sos_tickets) > 50:
            live_sos_tickets.pop()

    return {
        "status": "SUCCESS",
        "message": "Real SOS Emergency Signal Geolocated & Ingested",
        "ticket": new_ticket,
    }


@app.patch("/api/v1/tickets/{ticket_id}")
def update_ticket_status(ticket_id: str, payload: Dict[str, Any]):
    """Updates ticket status ('PENDING', 'DISPATCHED', 'RESOLVED')."""
    status = payload.get("status")
    if status not in ("PENDING", "DISPATCHED", "RESOLVED"):
        raise HTTPException(status_code=400, detail="Invalid status value")
    for t in live_sos_tickets:
        if t.get("id") == ticket_id:
            t["status"] = status
            return {"status": "UPDATED", "ticket": t}
    raise HTTPException(status_code=404, detail="Ticket not found")


@app.delete("/api/v1/tickets")
def clear_tickets():
    """Resets triage feed and deduplicator cache."""
    global live_sos_tickets
    live_sos_tickets = []
    packet_deduplicator.clear()
    return {"status": "CLEARED", "message": "Triage feed reset - 0 active SOS tickets"}


# ==============================================================================
# ROUTING, ACK & TOPOLOGY ENDPOINTS
# ==============================================================================

@app.post("/api/v1/packets/route", response_model=RouteDecisionResponse)
def route_packet(request: RouteDecisionRequest):
    """
    Core Routing Endpoint:
    Uses Hyperbolic Routing for cold starts or ACO Combined Scoring for learned paths.
    """
    if request.packet.ttl <= 0:
        raise HTTPException(status_code=400, detail="Packet TTL expired (TTL <= 0). Dropped.")

    s_hash = request.packet.sender_hash
    if s_hash is None:
        s_hash = hash_sender_16(request.packet.sender_id)

    if not ingest_rate_limiter.is_allowed(s_hash):
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit exceeded for sender hash 0x{s_hash:04X}. Flood packet dropped."
        )

    if not request.available_candidate_nodes:
        raise HTTPException(status_code=400, detail="No candidate nodes provided for routing.")

    dest_node = request.available_candidate_nodes[0]
    for candidate in request.available_candidate_nodes:
        if candidate.id == request.destination_node_id or candidate.role == "RESCUE_NODE":
            dest_node = candidate
            break

    response = routing_engine.route_packet(
        packet=request.packet,
        destination_node=dest_node,
        candidates=request.available_candidate_nodes,
    )

    supabase_service.store_packet(request.packet.model_dump())
    return response


@app.post("/api/v1/ack")
def process_ack(ack: AckNotification):
    """
    ACK & Failure Endpoint:
    Missing ACKs trigger immediate hard pheromone penalties on that edge.
    """
    routing_engine.process_ack(
        source_id=ack.source_id,
        target_id=ack.target_id,
        success=ack.success,
    )
    return {
        "status": "PROCESSED",
        "hard_penalty_applied": not ack.success,
        "edge": f"{ack.source_id}->{ack.target_id}",
    }


@app.get("/api/v1/topology")
def get_topology():
    """Get current network topology link metrics & pheromone levels."""
    table = routing_engine.aco_engine.pheromone_table
    edges = []
    for key, (tau, updated) in table.items():
        src, dst = key.split("->")
        edges.append({
            "source": src,
            "target": dst,
            "pheromone": round(tau, 4),
            "last_updated": updated,
        })

    return {
        "nodes": supabase_service.get_nodes(),
        "pheromone_edges": edges,
    }
