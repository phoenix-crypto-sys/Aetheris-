from typing import List, Tuple, Dict, Optional
from ..models import AetherisPacketModel, NodeStateModel, RouteDecisionResponse, LocationCoordinates
from .hyperbolic_routing import HyperbolicRouter
from .aco_scoring import ACOScoringEngine

class CoreRoutingEngine:
    """
    Layer 3: Core Routing Intelligence Engine
    Integrates Hyperbolic Routing (zero-history cold start) and ACO Pheromone Scoring.
    """
    def __init__(self):
        self.hyperbolic_router = HyperbolicRouter()
        self.aco_engine = ACOScoringEngine()

    def route_packet(
        self,
        packet: AetherisPacketModel,
        destination_node: NodeStateModel,
        candidates: List[NodeStateModel]
    ) -> RouteDecisionResponse:
        current_node_id = packet.route_trace[-1] if packet.route_trace else packet.sender_id
        target_loc = destination_node.location

        # Check if we have recorded history on any candidate edge
        has_history = any(
            self.aco_engine.has_history(current_node_id, c.id)
            for c in candidates if c.status != 'FAILED'
        )

        if not has_history:
            # Cold Start: Hyperbolic Greedy Routing
            best_candidate, dist_map = self.hyperbolic_router.select_best_hyperbolic_hop(
                current_loc=packet.location,
                target_loc=target_loc,
                candidates=[c for c in candidates if c.status != 'FAILED']
            )
            mode = 'HYPERBOLIC_COLD_START'
            scores = {cid: round(1.0 / (1.0 + d), 4) for cid, d in dist_map.items()}
            best_id = best_candidate.id if best_candidate else None
            top_score = scores.get(best_id, 0.0) if best_id else 0.0
        else:
            # ACO Learned Combined Scoring
            best_candidate, scores = self.aco_engine.rank_next_hops(
                current_node_id=current_node_id,
                candidates=candidates,
                target_loc=target_loc
            )
            mode = 'ACO_LEARNED'
            best_id = best_candidate.id if best_candidate else None
            top_score = scores.get(best_id, 0.0) if best_id else 0.0

        updated_trace = list(packet.route_trace)
        if best_id and (not updated_trace or updated_trace[-1] != best_id):
            updated_trace.append(best_id)

        return RouteDecisionResponse(
            selected_next_hop=best_id,
            score=top_score,
            routing_mode=mode,
            candidate_scores=scores,
            route_trace=updated_trace
        )

    def process_ack(self, source_id: str, target_id: str, success: bool, route_trace: Optional[List[str]] = None) -> None:
        if success:
            if route_trace:
                self.aco_engine.reinforce_pheromone(route_trace, reward=0.25)
        else:
            # Missing ACK triggers hard penalty
            self.aco_engine.apply_missing_ack_penalty(source_id, target_id)
