"""Data join placeholders for Dheghom pipeline."""


def join_sources(weather: dict, air: dict, water: dict) -> dict:
    """Combine source payloads into one record."""
    return {"weather": weather, "air_quality": air, "water": water}
