"""Simple z-score based anomaly pulse score."""

from math import sqrt


def _z(value: float | None, mean: float, std_dev: float) -> float:
    if value is None or std_dev == 0:
        return 0.0
    try:
        numeric_value = float(value)
    except (TypeError, ValueError):
        return 0.0
    return (numeric_value - mean) / std_dev


def compute_health_score(snapshot: dict) -> dict:
    """Compute a basic anomaly pulse score from latest metrics."""
    weather = snapshot.get("weather", {})
    weather_current = weather.get("current", weather)
    air = snapshot.get("air_quality", {})
    water = snapshot.get("water", {})

    z_temp = _z(weather_current.get("temperature_c"), 20.0, 8.0)
    z_humidity = _z(weather_current.get("humidity_pct"), 60.0, 20.0)
    z_pm25 = _z(air.get("pm25"), 12.0, 8.0)
    z_water = _z(water.get("water_temp_c"), 18.0, 6.0)

    anomaly_magnitude = sqrt(z_temp**2 + z_humidity**2 + z_pm25**2 + z_water**2)
    pulse = max(0.0, 100.0 - (anomaly_magnitude * 15.0))

    return {
        "pulse_score": round(pulse, 2),
        "anomaly_magnitude": round(anomaly_magnitude, 3),
    }
