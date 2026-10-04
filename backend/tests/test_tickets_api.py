import unittest
from fastapi.testclient import TestClient
from backend.app.main import app, live_sos_tickets
from backend.app.rate_limiter import ingest_rate_limiter
from backend.app.dedup import packet_deduplicator


class TestTicketsAPI(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        # Clear state before each test
        self.client.delete("/api/v1/tickets")
        ingest_rate_limiter.reset()
        packet_deduplicator.clear()

    def test_get_empty_tickets(self):
        res = self.client.get("/api/v1/tickets")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "ACTIVE")
        self.assertEqual(data["packetCount"], 0)
        self.assertEqual(data["tickets"], [])

    def test_ingest_sos_ticket(self):
        payload = {
            "action": "SOS",
            "packetId": 101,
            "senderId": "Room 222 - Victim (Wall Blocked)",
            "priorityLevel": 3,
            "latitude": 37.774929,
            "longitude": -122.419416,
            "batteryPct": 92,
            "hopCount": 2,
            "ttl": 24,
            "transport": "LAN-sim"
        }
        res = self.client.post("/api/v1/tickets", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "SUCCESS")
        self.assertIn("ticket", data)
        ticket = data["ticket"]
        self.assertEqual(ticket["senderId"], "Room 222 - Victim (Wall Blocked)")
        self.assertEqual(ticket["priorityLevel"], 3)
        self.assertEqual(ticket["transport"], "LAN-sim")
        self.assertTrue(ticket["checksumValid"])
        # Check raw hex length is 36 chars (18 bytes)
        raw_hex = ticket["hexDump"].replace(" ", "")
        self.assertEqual(len(raw_hex), 36)

    def test_duplicate_packet_dropped(self):
        payload = {
            "action": "SOS",
            "packetId": 200,
            "senderId": "Victim Node 1",
            "priorityLevel": 2,
            "ttl": 20
        }
        res1 = self.client.post("/api/v1/tickets", json=payload)
        self.assertEqual(res1.status_code, 200)
        self.assertEqual(res1.json()["status"], "SUCCESS")

        # Send same packet again
        res2 = self.client.post("/api/v1/tickets", json=payload)
        self.assertEqual(res2.status_code, 200)
        self.assertEqual(res2.json()["status"], "DUPLICATE")

    def test_expired_ttl_dropped(self):
        payload = {
            "action": "SOS",
            "packetId": 300,
            "senderId": "Victim Node 2",
            "priorityLevel": 2,
            "ttl": 0  # expired
        }
        res = self.client.post("/api/v1/tickets", json=payload)
        self.assertEqual(res.status_code, 400)
        self.assertIn("TTL expired", res.json()["detail"])

    def test_cancel_sos(self):
        # First ingest
        self.client.post("/api/v1/tickets", json={
            "action": "SOS",
            "packetId": 401,
            "senderId": "Room 222 - Victim (Wall Blocked)",
            "priorityLevel": 3
        })
        # Check exists
        get_res = self.client.get("/api/v1/tickets")
        self.assertEqual(get_res.json()["packetCount"], 1)

        # Now cancel
        cancel_res = self.client.post("/api/v1/tickets", json={
            "action": "CANCEL_SOS",
            "senderId": "Room 222 - Victim (Wall Blocked)"
        })
        self.assertEqual(cancel_res.status_code, 200)
        self.assertEqual(cancel_res.json()["status"], "RESOLVED")

        # Check cleared
        get_after = self.client.get("/api/v1/tickets")
        self.assertEqual(get_after.json()["packetCount"], 0)

    def test_update_ticket_status(self):
        ingest_res = self.client.post("/api/v1/tickets", json={
            "action": "SOS",
            "packetId": 501,
            "senderId": "Room 322",
            "priorityLevel": 3
        })
        ticket_id = ingest_res.json()["ticket"]["id"]

        patch_res = self.client.patch(f"/api/v1/tickets/{ticket_id}", json={"status": "DISPATCHED"})
        self.assertEqual(patch_res.status_code, 200)
        self.assertEqual(patch_res.json()["ticket"]["status"], "DISPATCHED")

    def test_delete_clear_all_tickets(self):
        self.client.post("/api/v1/tickets", json={
            "action": "SOS",
            "packetId": 601,
            "senderId": "Victim A",
            "priorityLevel": 3
        })
        del_res = self.client.delete("/api/v1/tickets")
        self.assertEqual(del_res.status_code, 200)
        self.assertEqual(del_res.json()["status"], "CLEARED")

        get_res = self.client.get("/api/v1/tickets")
        self.assertEqual(get_res.json()["packetCount"], 0)


if __name__ == '__main__':
    unittest.main()
