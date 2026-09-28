"""Canonical default location for Dheghom.

All ingest defaults, map layers, and snapshot geo tags should import from here
so Wilmington, Delaware stays consistent (not Wilmington, NC).
"""

from __future__ import annotations

import os
from typing import Any

# Wilmington, Delaware
DEFAULT_LATITUDE = float(os.getenv("DEFAULT_LATITUDE", "39.7391"))
DEFAULT_LONGITUDE = float(os.getenv("DEFAULT_LONGITUDE", "-75.5398"))
DEFAULT_CITY = os.getenv("DEFAULT_LOCATION_NAME", "Wilmington")
DEFAULT_STATE = os.getenv("DEFAULT_STATE", "Delaware")
DEFAULT_COUNTRY = os.getenv("DEFAULT_COUNTRY", "USA")

# NOAA CO-OPS station near Wilmington / Delaware City, DE
DEFAULT_NOAA_STATION_ID = os.getenv("NOAA_STATION_ID", "8557380")

# OpenAQ location id (override via env when you have a better regional station)
DEFAULT_OPENAQ_LOCATION_ID = int(os.getenv("OPENAQ_LOCATION_ID", "2178"))

DEFAULT_LOCATION: dict[str, Any] = {
    "city": DEFAULT_CITY,
    "state": DEFAULT_STATE,
    "country": DEFAULT_COUNTRY,
    "lat": DEFAULT_LATITUDE,
    "lon": DEFAULT_LONGITUDE,
}


def location_dict(
    lat: float | None = None,
    lon: float | None = None,
    **overrides: Any,
) -> dict[str, Any]:
    """Return a location payload, optionally overriding lat/lon."""
    payload = {**DEFAULT_LOCATION, **overrides}
    if lat is not None:
        payload["lat"] = float(lat)
    if lon is not None:
        payload["lon"] = float(lon)
    return payload
