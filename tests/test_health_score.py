from src.models.health_score import compute_health_score


def test_health_score_uses_ocean_or_water_key():
    with_ocean = compute_health_score(
        {
            "weather": {"current": {"temperature_c": 20, "humidity_pct": 60}},
            "air_quality": {"pm25": 12},
            "ocean": {"water_temp_c": 18},
        }
    )
    with_water = compute_health_score(
        {
            "weather": {"current": {"temperature_c": 20, "humidity_pct": 60}},
            "air_quality": {"pm25": 12},
            "water": {"water_temp_c": 18},
        }
    )
    assert with_ocean["pulse_score"] == with_water["pulse_score"]
    assert "components" in with_ocean


def test_health_score_handles_missing_metrics():
    result = compute_health_score({})
    assert "pulse_score" in result
    assert result["pulse_score"] >= 0
