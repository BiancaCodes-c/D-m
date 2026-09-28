from fastapi.testclient import TestClient

from src.api import server
from src.config.location import DEFAULT_LATITUDE, DEFAULT_LONGITUDE


def test_health_endpoint():
    client = TestClient(server.app)
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["api"] == "ok"
    assert "cache_ttl_seconds" in data


def test_latest_endpoint():
    client = TestClient(server.app)
    response = client.get("/latest")
    assert response.status_code == 200


def test_map_layers_endpoint_shape():
    client = TestClient(server.app)
    response = client.get("/map-layers")
    assert response.status_code == 200
    data = response.json()
    assert "heat_signatures" in data
    assert "location" in data
    assert data["location"]["state"] == "Delaware"
    assert abs(float(data["location"]["lat"]) - DEFAULT_LATITUDE) < 0.001
    assert abs(float(data["location"]["lon"]) - DEFAULT_LONGITUDE) < 0.001


def test_map_view_climate_mode():
    client = TestClient(server.app)
    response = client.get("/map-view", params={"mode": "Climate"})
    assert response.status_code == 200
    data = response.json()
    assert data["active_mode"] == "Climate"
    assert data["location"]["state"] == "Delaware"
