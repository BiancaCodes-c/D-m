from fastapi.testclient import TestClient
from src.api import server


def test_latest_endpoint():
    client = TestClient(server.app)
    r = client.get("/latest")
    assert r.status_code in (200, 404)


def test_map_layers_endpoint():
    client = TestClient(server.app)
    r = client.get("/map-layers")
    assert r.status_code == 200
    data = r.json()
    assert "heat_signatures" in data
