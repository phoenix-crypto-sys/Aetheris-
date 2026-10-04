import os
from typing import Dict, Any, List

# Supabase Client Wrapper with safe mock fallback
class SupabaseBackendService:
    def __init__(self):
        self.supabase_url = os.getenv("EXPO_PUBLIC_SUPABASE_URL", "https://aetheris-mesh-demo.supabase.co")
        self.supabase_key = os.getenv("EXPO_PUBLIC_SUPABASE_ANON_KEY", "mock-key-aetheris")
        self.in_memory_packets: List[Dict[str, Any]] = []
        self.in_memory_nodes: List[Dict[str, Any]] = []

    def store_packet(self, packet_data: Dict[str, Any]) -> bool:
        # STRICT Timeline Append Rule: [...prev, item]
        self.in_memory_packets.append(packet_data)
        return True

    def get_recent_packets(self, limit: int = 50) -> List[Dict[str, Any]]:
        return self.in_memory_packets[-limit:]

    def update_node(self, node_data: Dict[str, Any]) -> None:
        for idx, existing in enumerate(self.in_memory_nodes):
            if existing["id"] == node_data["id"]:
                self.in_memory_nodes[idx] = node_data
                return
        self.in_memory_nodes.append(node_data)

    def get_nodes(self) -> List[Dict[str, Any]]:
        return self.in_memory_nodes

supabase_service = SupabaseBackendService()
