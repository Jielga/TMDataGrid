import type { Geometry, LineString, MultiLineString, MultiPolygon, Polygon } from "geojson";
import type { MapLayers } from "../../NordicMap/mapSource.ts";
import { eRoads, roadLabelPosition, swedenBorder, swedenBorderLines } from "./mapData.ts";

function isArea(geometry: Geometry): geometry is Polygon | MultiPolygon {
  return geometry.type === "Polygon" || geometry.type === "MultiPolygon";
}

function isLine(geometry: Geometry): geometry is LineString | MultiLineString {
  return geometry.type === "LineString" || geometry.type === "MultiLineString";
}

/** Natural Earth 1:10m data for Sweden as one cell: land, coast and border, and E-roads with their labels. */
export const swedenOverviewLayers: MapLayers = {
  land: swedenBorder.features.flatMap((country) => {
    return isArea(country.geometry) ? [country.geometry] : [];
  }),
  water: [],
  borders: [swedenBorderLines],
  roads: eRoads.features.flatMap((road) => {
    return isLine(road.geometry) ? [{ geometry: road.geometry, roadClass: "european" as const, ref: road.properties.ref }] : [];
  }),
  labels: eRoads.features.flatMap((road) => {
    const at = roadLabelPosition({ ref: road.properties.ref, geometry: road.geometry });
    return at ? [{ text: road.properties.ref, at }] : [];
  }),
};
