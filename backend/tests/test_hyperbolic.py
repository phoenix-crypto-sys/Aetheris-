import unittest
import math
import random
from backend.app.models import LocationCoordinates
from backend.app.routing.hyperbolic_routing import HyperbolicRouter

class TestHyperbolicGeometry(unittest.TestCase):
    def setUp(self):
        self.router = HyperbolicRouter(anchor_lat=37.7749, anchor_lng=-122.4194, disk_radius_r=200.0)

    def test_identity_zero_distance(self):
        """d_H(u, u) must be exactly 0.0"""
        loc1 = LocationCoordinates(lat=37.7749, lng=-122.4194)
        dist = self.router.calculate_hyperbolic_distance(loc1, loc1)
        self.assertEqual(dist, 0.0)

        # Off-center point
        loc2 = LocationCoordinates(lat=37.7760, lng=-122.4180)
        dist2 = self.router.calculate_hyperbolic_distance(loc2, loc2)
        self.assertEqual(dist2, 0.0)

    def test_symmetry(self):
        """d_H(u, v) == d_H(v, u) for all pairs"""
        locA = LocationCoordinates(lat=37.7750, lng=-122.4190)
        locB = LocationCoordinates(lat=37.7770, lng=-122.4150)

        d_ab = self.router.calculate_hyperbolic_distance(locA, locB)
        d_ba = self.router.calculate_hyperbolic_distance(locB, locA)
        self.assertAlmostEqual(d_ab, d_ba, places=7)

    def test_monotonic_increase_with_distance(self):
        """Hyperbolic distance strictly increases with physical distance along a ray."""
        center = LocationCoordinates(lat=37.7749, lng=-122.4194)
        prev_dist = 0.0

        for delta_lat in [0.0001, 0.0005, 0.0010, 0.0020, 0.0050]:
            target = LocationCoordinates(lat=37.7749 + delta_lat, lng=-122.4194)
            d = self.router.calculate_hyperbolic_distance(center, target)
            self.assertGreater(d, prev_dist)
            prev_dist = d

    def test_triangle_inequality_random_points(self):
        """Triangle inequality: d_H(u, w) <= d_H(u, v) + d_H(v, w) + epsilon on random points"""
        random.seed(42)
        for _ in range(50):
            # Generate random points inside ~500m of anchor
            lat1 = 37.7749 + (random.random() - 0.5) * 0.004
            lng1 = -122.4194 + (random.random() - 0.5) * 0.004
            lat2 = 37.7749 + (random.random() - 0.5) * 0.004
            lng2 = -122.4194 + (random.random() - 0.5) * 0.004
            lat3 = 37.7749 + (random.random() - 0.5) * 0.004
            lng3 = -122.4194 + (random.random() - 0.5) * 0.004

            p1 = LocationCoordinates(lat=lat1, lng=lng1)
            p2 = LocationCoordinates(lat=lat2, lng=lng2)
            p3 = LocationCoordinates(lat=lat3, lng=lng3)

            d12 = self.router.calculate_hyperbolic_distance(p1, p2)
            d23 = self.router.calculate_hyperbolic_distance(p2, p3)
            d13 = self.router.calculate_hyperbolic_distance(p1, p3)

            # d(u, w) <= d(u, v) + d(v, w) + numerical epsilon
            self.assertLessEqual(d13, d12 + d23 + 1e-9)

    def test_poincare_disk_boundary_clamping(self):
        """Points very far away must have r_disk <= 0.999."""
        far_loc = LocationCoordinates(lat=40.0, lng=-120.0) # hundreds of km away
        u, v = self.router.project_to_hyperbolic_disk(far_loc)
        norm = math.hypot(u, v)
        self.assertLessEqual(norm, 0.999)

    def test_configurable_radius(self):
        custom_router = HyperbolicRouter(disk_radius_r=500.0)
        self.assertEqual(custom_router.disk_radius_r, 500.0)

if __name__ == "__main__":
    unittest.main()
