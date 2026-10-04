from pydantic import BaseModel, Field
from typing import List, Optional, Literal, Dict

class LocationCoordinates(BaseModel):
    lat: float
    lng: float

class AetherisPacketModel(BaseModel):
    sender_id: str
    location: LocationCoordinates
    timestamp: str
    priority: Literal['critical', 'high', 'medium', 'low']
    message: str
    ttl: int = 3600
    hop_count: int = 0
    route_trace: List[str] = Field(default_factory=list)
    sender_hash: Optional[int] = None

class NodeStateModel(BaseModel):
    id: str
    role: Literal['BLE_NODE', 'LORA_BRIDGE', 'RESCUE_NODE']
    location: LocationCoordinates
    battery: float = 100.0
    rssi: float = -60.0
    link_quality: float = 0.9
    status: Literal['ONLINE', 'DEGRADED', 'FAILED'] = 'ONLINE'
    is_anchor: bool = False

class RouteDecisionRequest(BaseModel):
    packet: AetherisPacketModel
    destination_node_id: str
    available_candidate_nodes: List[NodeStateModel]

class RouteDecisionResponse(BaseModel):
    selected_next_hop: Optional[str]
    score: float
    routing_mode: Literal['HYPERBOLIC_COLD_START', 'ACO_LEARNED']
    candidate_scores: Dict[str, float]
    route_trace: List[str]

class AckNotification(BaseModel):
    packet_id: str
    source_id: str
    target_id: str
    success: bool
