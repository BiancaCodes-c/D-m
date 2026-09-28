from src.ingest import openaq


def test_openaq_without_key_returns_auth_required(monkeypatch):
    monkeypatch.delenv("OPENAQ_API_KEY", raising=False)
    result = openaq.fetch_air_quality()
    assert result["status"] == "auth_required"
    assert result["has_api_key"] is False
    assert result["pm25"] is None
    assert "error" in result


def test_openaq_empty_payload_shape():
    payload = openaq._empty_payload(2178, status="empty")
    assert payload["location_id"] == 2178
    assert payload["status"] == "empty"
    assert "observed_at" in payload
