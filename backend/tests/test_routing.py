import unittest
import sys
import os

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.models import AetherisPacketModel, LocationCoordinates, NodeStateModel
from app.routing.hyperbolic_routing import HyperbolicRouter
from app.routing.aco_scoring import ACOScoringEngine
from app.routing.engine import CoreRoutingEngine

class TestLayer3RoutingIntelligence(unittest.TestCase):
    def setUp(self):
        self.hyperbolic_router = HyperbolicRouter()
        self.aco_engine = ACOScoringEngine(decay_lambda=0.1, penalty_factor=0.1)
        self.core_engine = CoreRoutingEngine()

        self.loc_center = LocationCoordinates(lat=37.7749, lng=-122.4194)
        self.loc_near = LocationCoordinates(lat=37.7752, lng=-122.4190)
        self.loc_far = LocationCoordinates(lat=37.7850, lng=-122.4000)

        self.node_a = NodeStateModel(id="NODE-A", role="BLE_NODE", location=self.loc_center)
        self.node_b = NodeStateModel(id="NODE-B", role="BLE_NODE", location=self.loc_near, battery=90, link_quality=0.9)
        self.node_c = NodeStateModel(id="NODE-C", role="RESCUE_NODE", location=self.loc_far, battery=100, link_quality=0.95)

    def test_hyperbolic_distance_calculation(self):
        dist_near = self.hyperbolic_router.calculate_hyperbolic_distance(self.loc_center, self.loc_near)
        dist_far = self.hyperbolic_router.calculate_hyperbolic_distance(self.loc_center, self.loc_far)
        
        self.assertGreater(dist_far, dist_near)
        self.assertGreater(dist_near, 0.0)

    def test_missing_ack_hard_penalty(self):
        # Initial tau
        tau_init = self.aco_engine.get_edge_pheromone("NODE-A", "NODE-B")
        self.assertEqual(tau_init, 0.5)

        # Trigger hard missing ACK penalty
        penalized = self.aco_engine.apply_missing_ack_penalty("NODE-A", "NODE-B")
        self.assertAlmostEqual(penalized, 0.05, delta=0.01)

    def test_cold_start_routing_decision(self):
        pkt = AetherisPacketModel(
            sender_id="NODE-A",
            location=self.loc_center,
            timestamp="2026-07-27T10:00:00Z",
            priority="critical",
            message="MEDICAL SOS",
            ttl=86400,
            hop_count=0,
            route_trace=["NODE-A"]
        )

        resp = self.core_engine.route_packet(
            packet=pkt,
            destination_node=self.node_c,
            candidates=[self.node_b, self.node_c]
        )

        self.assertIn(resp.routing_mode, ['HYPERBOLIC_COLD_START', 'ACO_LEARNED'])
        self.assertIsNotNone(resp.selected_next_hop)
        self.assertTrue(len(resp.route_trace) > 1)

if __name__ == "__main__":
    unittest.main()
