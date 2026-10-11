import type { FeatureCollection, Geometry, MultiLineString, Position } from "geojson";
import { feature, mesh } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
// Both files are Natural Earth 1:10m (public domain), cut to Sweden with mapshaper. Bundled, so no network is needed.
// Border: Sweden's land border and coast, 41 polygons (mainland, Gotland, Öland and the larger islands).
import borderTopology from "./sweden-border.topo.json";
// E-roads in Sweden: E4, E6, E10, E12, E14, E18, E20, E22 and E45. E16 and E65 are missing in Natural Earth.
import roadsTopology from "./sweden-eroads.topo.json";

export type RoadProperties = {
  /** E-road number, for example "E4" */
  ref: string;
};

const border = borderTopology as unknown as Topology<{ sweden: GeometryCollection }>;
const roadLines = roadsTopology as unknown as Topology<{ eroads: GeometryCollection<RoadProperties> }>;

export const swedenBorder: FeatureCollection = feature(border, border.objects.sweden);
export const eRoads: FeatureCollection<Geometry, RoadProperties> = feature(roadLines, roadLines.objects.eroads);
/** Coast and land border as lines, each shared edge once */
export const swedenBorderLines: MultiLineString = mesh(border, border.objects.sweden);

/** Roughly where each E-number label sits [lon, lat]. The label snaps to the nearest point on the road. */
const labelHints: Record<string, [number, number]> = {
  E4: [20.9, 64.7], // Skellefteå
  E6: [12.25, 57.1], // Varberg
  E10: [19.6, 68.2], // Abisko
  E12: [17.1, 65.1], // Storuman
  E14: [16.0, 62.9], // Östersund–Sundsvall
  E18: [14.5, 59.3], // Karlstad–Örebro
  E20: [13.4, 58.3], // Skara
  E22: [16.5, 57.6], // Västervik
  E45: [14.5, 61.8], // Sveg
};

function lineParts(geometry: Geometry): Position[][] {
  if (geometry.type === "LineString") {
    return [geometry.coordinates];
  }
  if (geometry.type === "MultiLineString") {
    return geometry.coordinates;
  }
  return [];
}

function toLonLat(position: Position | undefined): [number, number] | null {
  const [lon, lat] = position ?? [];
  return lon === undefined || lat === undefined ? null : [lon, lat];
}

/** Point on the road closest to its hint, or the middle of the longest part when there is no hint. */
export function roadLabelPosition({ ref, geometry }: { ref: string; geometry: Geometry }): [number, number] | null {
  const parts = lineParts(geometry);
  const hint = labelHints[ref];
  if (hint) {
    let best: [number, number] | null = null;
    let bestDistance = Infinity;
    for (const part of parts) {
      for (const position of part) {
        const point = toLonLat(position);
        if (!point) {
          continue;
        }
        const distance = (point[0] - hint[0]) ** 2 + (point[1] - hint[1]) ** 2;
        if (distance < bestDistance) {
          best = point;
          bestDistance = distance;
        }
      }
    }
    return best;
  }
  const longest = parts.reduce<Position[]>((a, b) => {
    return b.length > a.length ? b : a;
  }, []);
  return toLonLat(longest[Math.floor(longest.length / 2)]);
}
