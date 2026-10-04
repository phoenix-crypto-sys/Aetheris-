import unittest
import math
import time
from backend.app.models import AetherisPacketModel, LocationCoordinates, NodeStateModel
from backend.app.routing.aco_scoring import ACOScoringEngine
from backend.app.routing.engine import CoreRoutingEngine


class TestACOScoringEngine(unittest.TestCase):
    def setUp(self):
        self.aco = ACOScoringEngine(decay_lambda=0.005, penalty_factor=0.1)
        self.dest_loc = LocationCoordinates(lat=37.7749, lng=-122.4194)

        self.node_a = NodeStateModel(
            id="NODE-A",
            role="BLE_NODE",
            location=LocationCoordinates(lat=37.7750, lng=-122.4190),
            battery=90.0,
            link_quality=0.9,
        )
        self.node_b = NodeStateModel(
            id="NODE-B",
            role="BLE_NODE",
            location=LocationCoordinates(lat=37.7752, lng=-122.4188),
            battery=95.0,
            link_quality=0.95,
        )

    def test_no_division_by_zero_when_dh_zero(self):
        """When candidate is exactly at target location (d_H = 0), score must compute cleanly."""
        at_dest = NodeStateModel(
            id="DEST-NODE",
            role="RESCUE_NODE",
            location=self.dest_loc,
            battery=100.0,
            link_quality=1.0,
        )
        score = self.aco.compute_candidate_score("SOURCE", at_dest, self.dest_loc)
        self.assertGreater(score, 0.0)
        self.assertLessEqual(score, 1.0)
        # When d_H = 0, dist_n = 1 / (1 + 0) = 1.0
        # With default weights 0.3*0.5 + 0.3*1.0 + 0.2*1.0 + 0.2*1.0 = 0.15 + 0.3 + 0.2 + 0.2 = 0.85
        self.assertAlmostEqual(score, 0.85, places=2)

    def test_pheromone_decay_over_time(self):
        """Pheromone decays exponentially with rate lambda = 0.005: tau(t) = tau0 * exp(-lambda * t)."""
        t0 = 1000.0
        self.aco.reinforce_pheromone(["SRC", "DST"], reward=0.4, current_time=t0)
        tau_initial = self.aco.get_edge_pheromone("SRC", "DST", current_time=t0)
        self.assertAlmostEqual(tau_initial, 0.9, places=3) # 0.5 + 0.4 = 0.9

        # After half-life (ln(2) / 0.005 ≈ 138.63 seconds)
        t_half = t0 + (math.log(2) / 0.005)
        tau_half = self.aco.get_edge_pheromone("SRC", "DST", current_time=t_half)
        self.assertAlmostEqual(tau_half, tau_initial / 2.0, places=2)

        # Longer decay
        t_later = t0 + 500.0
        tau_later = self.aco.get_edge_pheromone("SRC", "DST", current_time=t_later)
        self.assertLess(tau_later, tau_half)
        self.assertGreaterEqual(tau_later, 0.01)

    def test_failure_penalty_steers_choice(self):
        """Hard failure penalty on missed ACK must steer next-hop choice to an alternate neighbor."""
        # Initially reinforce NODE-A
        self.aco.reinforce_pheromone(["SOURCE", "NODE-A"], reward=0.4)
        best, scores = self.aco.rank_next_hops("SOURCE", [self.node_a, self.node_b], self.dest_loc)
        self.assertEqual(best.id, "NODE-A")

        # Now NODE-A suffers missed ACK failure penalty
        penalized_tau = self.aco.apply_missing_ack_penalty("SOURCE", "NODE-A")
        self.assertLessEqual(penalized_tau, 0.1)

        # Re-evaluate next hop: traffic must now be steered to NODE-B
        best_after, scores_after = self.aco.rank_next_hops("SOURCE", [self.node_a, self.node_b], self.dest_loc)
        self.assertEqual(best_after.id, "NODE-B")
        self.assertGreater(scores_after["NODE-B"], scores_after["NODE-A"])

    def test_cold_start_to_aco_transition(self):
        """CoreRoutingEngine starts in HYPERBOLIC_COLD_START, transitions to ACO_LEARNED once history exists."""
        core = CoreRoutingEngine()
        packet = AetherisPacketModel(
            sender_id="VICTIM-1",
            location=LocationCoordinates(lat=37.7760, lng=-122.4180),
            timestamp="2026-10-04T12:00:00Z",
            priority="critical",
            message="EMERGENCY EXTRACTION",
            ttl=24,
            hop_count=0,
            route_trace=["VICTIM-1"],
        )
        dest = NodeStateModel(id="EOC-SINK", role="RESCUE_NODE", location=self.dest_loc)

        # Step 1: Cold start (no history)
        resp1 = core.route_packet(packet, dest, [self.node_a, self.node_b])
        self.assertEqual(resp1.routing_mode, "HYPERBOLIC_COLD_START")

        # Step 2: Positive ACK notification reinforces route
        chosen_hop = resp1.selected_next_hop
        core.process_ack(
            source_id="VICTIM-1",
            target_id=chosen_hop,
            success=True,
            route_trace=["VICTIM-1", chosen_hop],
        )

        # Step 3: Next route query must now use ACO_LEARNED
        resp2 = core.route_packet(packet, dest, [self.node_a, self.node_b])
        self.assertEqual(resp2.routing_mode, "ACO_LEARNED")


if __name__ == "__main__":
    unittest.main()
