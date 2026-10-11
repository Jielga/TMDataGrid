import { geoTransverseMercator } from "d3-geo";
import type { GeoProjection } from "d3-geo";
import type { MultiPoint } from "geojson";
import type { Point } from "./camera.ts";
import type { LonLat, LonLatBox, MapSource } from "./mapSource.ts";

/** Size of the projected map, in map units. Only the ratio matters, the camera scales it to the view. */
const MAP_SIZE = 1000;

export type MapProjection = {
  projection: GeoProjection;
  project: (lonLat: LonLat) => Point | null;
  invert: (point: Point) => LonLat | null;
};

/** Points along the edge of the box. Its edges curve in the projection, so the corners alone are not enough. */
function boxOutline(box: LonLatBox): MultiPoint {
  const coordinates: LonLat[] = [];
  const steps = 16;
  for (let step = 0; step <= steps; step += 1) {
    const t = step / steps;
    const lon = box.west + (box.east - box.west) * t;
    const lat = box.south + (box.north - box.south) * t;
    coordinates.push([lon, box.south], [lon, box.north], [box.west, lat], [box.east, lat]);
  }
  return { type: "MultiPoint", coordinates };
}

/**
 * Transverse Mercator around the source's central meridian. On 15°E it is close to SWEREF 99 TM,
 * so Sweden is not squashed, and it also suits Norway, Finland and Denmark.
 */
export function createMapProjection(source: MapSource): MapProjection {
  const { extent } = source;
  const meridian = source.centralMeridian ?? (extent.west + extent.east) / 2;
  const projection = geoTransverseMercator()
    .rotate([-meridian, 0])
    .fitSize([MAP_SIZE, MAP_SIZE], boxOutline(extent));
  return {
    projection,
    project: (lonLat) => {
      const point = projection(lonLat);
      return point ? [point[0], point[1]] : null;
    },
    invert: (point) => {
      const lonLat = projection.invert?.(point);
      return lonLat ? [lonLat[0], lonLat[1]] : null;
    },
  };
}
