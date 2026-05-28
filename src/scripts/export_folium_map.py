"""Generate a folium map from the latest stored Dheghom snapshot."""

from __future__ import annotations

import sqlite3
from datetime import datetime
from pathlib import Path

import folium
from folium.plugins import HeatMap
import pandas as pd

DB_PATH = Path("data/db/dheghom.db")
MAP_OUTPUT_PATH = Path("map.html")
WILMINGTON = [39.7391, -75.5398]
NASA_GIBS_TRUE_COLOR = (
    "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/"
    "MODIS_Terra_CorrectedReflectance_TrueColor/default/{date}/"
    "GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg"
)


def _load_observations() -> pd.DataFrame:
    with sqlite3.connect(DB_PATH) as conn:
        frame = pd.read_sql(
            "SELECT * FROM observations WHERE lat IS NOT NULL AND lon IS NOT NULL ORDER BY id ASC",
            conn,
        )

    if frame.empty:
        raise RuntimeError(f"No observations found in {DB_PATH}. Run the ingest pipeline first.")

    return frame


def _latest_imagery_date(observations: pd.DataFrame) -> str:
    observed_at = pd.to_datetime(observations["observed_at"], errors="coerce", utc=True)
    latest = observed_at.max()

    if pd.isna(latest):
        return datetime.utcnow().strftime("%Y-%m-%d")

    return latest.date().isoformat()


def _build_map(observations: pd.DataFrame) -> folium.Map:
    observations = observations.copy()
    observations["value"] = pd.to_numeric(observations["value"], errors="coerce")
    observations["weight"] = observations["value"].fillna(0).abs()
    max_weight = observations["weight"].max() or 1.0
    observations["weight"] = observations["weight"] / max_weight
    imagery_date = _latest_imagery_date(observations)

    map_view = folium.Map(location=WILMINGTON, zoom_start=10, tiles=None, control_scale=True)

    folium.TileLayer(
        tiles=NASA_GIBS_TRUE_COLOR.format(date=imagery_date),
        attr="NASA GIBS",
        name=f"True Color {imagery_date}",
        overlay=False,
        control=True,
        max_zoom=9,
        min_zoom=0,
    ).add_to(map_view)

    folium.Marker(
        WILMINGTON,
        popup="Dheghom base — Wilmington",
        tooltip="Dheghom base",
        icon=folium.Icon(color="red", icon="home"),
    ).add_to(map_view)

    heat_points = observations.tail(50)

    for _, row in heat_points.iterrows():
        folium.CircleMarker(
            location=[row["lat"], row["lon"]],
            radius=10,
            popup=f"{row['variable']}: {row['value']} {row['unit'] or ''}".strip(),
            tooltip=f"{row['source']} - {row['variable']}",
            color="#06b6d4",
            fill=True,
            fill_color="#67e8f9",
            fill_opacity=max(0.15, min(0.95, float(row["weight"]))),
        ).add_to(map_view)

    HeatMap(
        heat_points[["lat", "lon", "weight"]].values.tolist(),
        name="Atmospheric Heat",
        radius=30,
        blur=18,
        min_opacity=0.35,
    ).add_to(map_view)

    folium.LayerControl().add_to(map_view)
    return map_view


def main() -> None:
    observations = _load_observations()
    map_view = _build_map(observations)
    map_view.save(MAP_OUTPUT_PATH)
    print(f"Open {MAP_OUTPUT_PATH} in your browser")


if __name__ == "__main__":
    main()