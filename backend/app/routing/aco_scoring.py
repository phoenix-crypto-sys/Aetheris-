"""
Layer 3: Ant Colony Optimization (ACO) & Combined Multi-Objective Scoring Engine
"""

import os
import time
import math
from typing import Dict, List, Tuple, Optional
from ..models import NodeStateModel, LocationCoordinates
from .hyperbolic_routing import HyperbolicRouter


class ACOScoringEngine:
    """
    Layer 3: Ant Colony Optimization (ACO) & Combined Scoring Engine

    Multi-Objective Combined Scoring Formula:
      next_hop_score = α * tau_n + β * dist_n + γ * batt_n + δ * link_n
      where:
        tau_n  = min(1.0, max(0.0, pheromone / tau_max))
        dist_n = 1.0 / (1.0 + d_H)
        batt_n = min(1.0, max(0.0, battery / 100.0))
        link_n = min(1.0, max(0.0, link_quality))
    """

    def __init__(
        self,
        alpha: Optional[float] = None,
        beta: Optional[float] = None,
        gamma: Optional[float] = None,
        delta: Optional[float] = None,
        decay_lambda: Optional[float] = None,
        tau_max: Optional[float] = None,
        penalty_factor: float = 0.1,
        initial_tau: float = 0.5,
    ):
        # Configurable term weights (default: 0.3, 0.3, 0.2, 0.2)
        self.alpha = float(alpha) if alpha is not None else float(os.getenv("AETHERIS_ACO_ALPHA", "0.3"))
        self.beta = float(beta) if beta is not None else float(os.getenv("AETHERIS_ACO_BETA", "0.3"))
        self.gamma = float(gamma) if gamma is not None else float(os.getenv("AETHERIS_ACO_GAMMA", "0.2"))
        self.delta = float(delta) if delta is not None else float(os.getenv("AETHERIS_ACO_DELTA", "0.2"))

        # Pheromone decay rate lambda (default: 0.005 s^-1)
        # Note on half-life: t_1/2 = ln(2) / lambda. For lambda = 0.005, t_1/2 = 0.69315 / 0.005 ≈ 138.63 seconds.
        self.decay_lambda = (
            float(decay_lambda) if decay_lambda is not None else float(os.getenv("AETHERIS_ACO_LAMBDA", "0.005"))
        )

        self.tau_max = float(tau_max) if tau_max is not None else float(os.getenv("AETHERIS_ACO_TAU_MAX", "1.0"))
        self.penalty_factor = penalty_factor
        self.initial_tau = initial_tau

        # Pheromone storage: key = "source_id->target_id", value = (tau, last_updated_time)
        self.pheromone_table: Dict[str, Tuple[float, float]] = {}
        self.hyperbolic_router = HyperbolicRouter()

    def has_history(self, source_id: str, target_id: str) -> bool:
        """Returns True if the edge has a recorded pheromone history entry."""
        edge_key = f"{source_id}->{target_id}"
        return edge_key in self.pheromone_table

    def get_edge_pheromone(self, source_id: str, target_id: str, current_time: Optional[float] = None) -> float:
        """
        Retrieves edge pheromone level, applying passive exponential decay:
          tau(t) = tau_0 * exp(-lambda * elapsed_seconds)
        """
        edge_key = f"{source_id}->{target_id}"
        now = time.time() if current_time is None else current_time

        if edge_key not in self.pheromone_table:
            return self.initial_tau

        tau0, last_updated = self.pheromone_table[edge_key]
        elapsed_sec = max(0.0, now - last_updated)

        # Passive Exponential Decay: tau = tau0 * exp(-lambda * t)
        decayed_tau = tau0 * math.exp(-self.decay_lambda * elapsed_sec)
        decayed_tau = max(0.01, min(self.tau_max, decayed_tau))

        # Update cached decayed value
        self.pheromone_table[edge_key] = (decayed_tau, now)
        return decayed_tau

    def reinforce_pheromone(
        self,
        route_trace: List[str],
        reward: float = 0.25,
        current_time: Optional[float] = None,
    ) -> None:
        """
        Reinforces successful delivery route trace edges.
        """
        now = time.time() if current_time is None else current_time
        for i in range(len(route_trace) - 1):
            source_id = route_trace[i]
            target_id = route_trace[i + 1]
            edge_key = f"{source_id}->{target_id}"

            current_tau = self.get_edge_pheromone(source_id, target_id, now)
            new_tau = min(self.tau_max, current_tau + reward)
            self.pheromone_table[edge_key] = (new_tau, now)

    def apply_missing_ack_penalty(
        self,
        source_id: str,
        target_id: str,
        current_time: Optional[float] = None,
    ) -> float:
        """
        Hard Failure Penalty: On missed ACK, tau = max(0.01, tau * 0.1).
        Steers subsequent traffic away from unreachable or dead neighbors.
        """
        now = time.time() if current_time is None else current_time
        edge_key = f"{source_id}->{target_id}"
        current_tau = self.get_edge_pheromone(source_id, target_id, now)
        penalized_tau = max(0.01, current_tau * self.penalty_factor)
        self.pheromone_table[edge_key] = (penalized_tau, now)
        return penalized_tau

    def compute_candidate_score(
        self,
        current_node_id: str,
        candidate: NodeStateModel,
        target_loc: LocationCoordinates,
        current_time: Optional[float] = None,
    ) -> float:
        """
        Multi-Objective Normalized Scoring:
          Score = α * tau_n + β * dist_n + γ * batt_n + δ * link_n
        Every term is strictly in [0, 1]. No division by zero.
        """
        # 1. Normalized Pheromone [0, 1]
        raw_pheromone = self.get_edge_pheromone(current_node_id, candidate.id, current_time)
        tau_n = min(1.0, max(0.0, raw_pheromone / max(0.001, self.tau_max)))

        # 2. Normalized Hyperbolic Distance: 1 / (1 + d_H) in (0, 1]
        hyp_dist = self.hyperbolic_router.calculate_hyperbolic_distance(candidate.location, target_loc)
        dist_n = 1.0 / (1.0 + hyp_dist)

        # 3. Normalized Battery [0, 1]
        batt_n = min(1.0, max(0.0, candidate.battery / 100.0))

        # 4. Normalized Link Quality [0, 1]
        link_n = min(1.0, max(0.0, candidate.link_quality))

        # Combined multi-objective score
        score = (
            self.alpha * tau_n +
            self.beta * dist_n +
            self.gamma * batt_n +
            self.delta * link_n
        )
        return round(score, 4)

    def rank_next_hops(
        self,
        current_node_id: str,
        candidates: List[NodeStateModel],
        target_loc: LocationCoordinates,
        current_time: Optional[float] = None,
    ) -> Tuple[Optional[NodeStateModel], Dict[str, float]]:
        scores: Dict[str, float] = {}
        best_candidate: Optional[NodeStateModel] = None
        max_score = -1.0

        for candidate in candidates:
            # Skip failed nodes
            if candidate.status == "FAILED":
                scores[candidate.id] = 0.0
                continue

            score = self.compute_candidate_score(current_node_id, candidate, target_loc, current_time)
            scores[candidate.id] = score
            if score > max_score:
                max_score = score
                best_candidate = candidate

        return best_candidate, scores
