"""Default location must stay Wilmington, Delaware."""

from src.config.location import (
    DEFAULT_LATITUDE,
    DEFAULT_LONGITUDE,
    DEFAULT_LOCATION,
    DEFAULT_NOAA_STATION_ID,
    location_dict,
)
from src.ingest.openmeteo import DEFAULT_LATITUDE as OM_LAT, DEFAULT_LONGITUDE as OM_LON
from src.transform.binsleuth import DEFAULT_LOCATION as BIN_LOCATION
from src.utils import db


def test_canonical_coords_are_wilmington_de():
    assert DEFAULT_LATITUDE == 39.7391
    assert DEFAULT_LONGITUDE == -75.5398
    assert DEFAULT_LOCATION["state"] == "Delaware"
    assert DEFAULT_LOCATION["city"] == "Wilmington"


def test_openmeteo_defaults_match_canonical():
    assert OM_LAT == DEFAULT_LATITUDE
    assert OM_LON == DEFAULT_LONGITUDE


def test_binsleuth_defaults_match_canonical():
    assert BIN_LOCATION["lat"] == DEFAULT_LATITUDE
    assert BIN_LOCATION["lon"] == DEFAULT_LONGITUDE
    assert BIN_LOCATION["state"] == "Delaware"


def test_db_defaults_match_canonical():
    assert db.DEFAULT_LOCATION["lat"] == DEFAULT_LATITUDE
    assert db.DEFAULT_LOCATION["lon"] == DEFAULT_LONGITUDE


def test_noaa_station_is_delaware_city():
    assert DEFAULT_NOAA_STATION_ID == "8557380"


def test_location_dict_overrides():
    payload = location_dict(lat=40.0, lon=-75.0, city="Test")
    assert payload["lat"] == 40.0
    assert payload["lon"] == -75.0
    assert payload["city"] == "Test"
    assert payload["state"] == "Delaware"
