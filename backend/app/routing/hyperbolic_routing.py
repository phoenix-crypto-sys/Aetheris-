"""
Layer 3: Hyperbolic Routing Engine (Poincaré Disk Metric)
"""

import math
import os
from typing import Tuple, List, Dict, Optional
from ..models import LocationCoordinates, NodeStateModel


class HyperbolicRouter:
    """
    Layer 3: Hyperbolic Routing Engine
    Provides greedy geometric pathing in hyperbolic space relative to command center
    for zero-history cold starts.
    """
    def __init__(
        self,
        anchor_lat: float = 37.7749,
        anchor_lng: float = -122.4194,
        disk_radius_r: Optional[float] = None,
    ):
        self.anchor_lat = anchor_lat
        self.anchor_lng = anchor_lng
        # Configurable Poincaré disk characteristic radius R (default: 200m)
        if disk_radius_r is not None:
            self.disk_radius_r = float(disk_radius_r)
        else:
            self.disk_radius_r = float(os.getenv("AETHERIS_POINCARE_R", "200.0"))

    def project_to_hyperbolic_disk(self, loc: LocationCoordinates) -> Tuple[float, float]:
        """
        Converts GPS lat/lng to local meters relative to command center anchor:
          x = (lng - lng0) * 111320 * cos(radians(lat0))
          y = (lat - lat0) * 110540
        Maps to the Poincaré disk:
          rho = dist_m / R
          r_disk = tanh(rho / 2)
          bearing = atan2(y, x)
        Clamps r_disk <= 0.999.
        """
        lat0_rad = math.radians(self.anchor_lat)
        x = (loc.lng - self.anchor_lng) * 111320.0 * math.cos(lat0_rad)
        y = (loc.lat - self.anchor_lat) * 110540.0

        dist_m = math.hypot(x, y)
        if dist_m <= 1e-9:
            return (0.0, 0.0)

        rho = dist_m / max(1.0, self.disk_radius_r)
        r_disk = min(0.999, max(0.0, math.tanh(rho / 2.0)))
        bearing = math.atan2(y, x)

        u = r_disk * math.cos(bearing)
        v = r_disk * math.sin(bearing)
        norm = math.hypot(u, v)
        if norm > 0.999:
            scale = 0.999 / norm
            u *= scale
            v *= scale
        return (u, v)

    def calculate_hyperbolic_distance_points(
        self,
        u1: float,
        v1: float,
        u2: float,
        v2: float,
    ) -> float:
        """
        Computes the hyperbolic distance between two points in the Poincaré disk:
          d_H = arcosh(1 + 2 * ||u - v||^2 / ((1 - ||u||^2) * (1 - ||v||^2)))
        Guarded against division by zero and values < 1 inside arcosh.
        """
        if u1 == u2 and v1 == v2:
            return 0.0

        norm_u_sq = min(0.999 * 0.999, u1**2 + v1**2)
        norm_v_sq = min(0.999 * 0.999, u2**2 + v2**2)
        diff_sq = (u1 - u2)**2 + (v1 - v2)**2

        denom = (1.0 - norm_u_sq) * (1.0 - norm_v_sq)
        if denom <= 1e-12:
            denom = 1e-12

        arg = 1.0 + (2.0 * diff_sq) / denom
        if arg < 1.0:
            arg = 1.0

        return math.acosh(arg)

    def calculate_hyperbolic_distance(
        self,
        loc1: LocationCoordinates,
        loc2: LocationCoordinates,
    ) -> float:
        """
        Computes hyperbolic distance between two GPS coordinates.
        """
        u1, v1 = self.project_to_hyperbolic_disk(loc1)
        u2, v2 = self.project_to_hyperbolic_disk(loc2)
        return self.calculate_hyperbolic_distance_points(u1, v1, u2, v2)

    def select_best_hyperbolic_hop(
        self,
        current_loc: LocationCoordinates,
        target_loc: LocationCoordinates,
        candidates: List[NodeStateModel],
    ) -> Tuple[Optional[NodeStateModel], Dict[str, float]]:
        """
        Greedy hyperbolic distance path selection (minimizes hyperbolic distance to target destination).
        """
        best_candidate = None
        min_dist = float("inf")
        distances: Dict[str, float] = {}

        for candidate in candidates:
            dist = self.calculate_hyperbolic_distance(candidate.location, target_loc)
            distances[candidate.id] = round(dist, 6)
            if dist < min_dist:
                min_dist = dist
                best_candidate = candidate

        return best_candidate, distances
