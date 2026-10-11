import type { MapSource } from "../../NordicMap/mapSource.ts";

/**
 * Sweden from Natural Earth 1:10m: coast, land border and E-roads, as one overview level.
 * The data is a separate chunk that loads when the first map using this source is shown.
 */
export const swedenOverviewSource: MapSource = {
  extent: { west: 10.9, south: 55.3, east: 24.2, north: 69.1 },
  // Close to SWEREF 99 TM, so the map looks like other Swedish maps
  centralMeridian: 15,
  levels: [{ minZoom: 1, cellSize: 360 }],
  loadCell: async () => {
    const { swedenOverviewLayers } = await import("./swedenOverviewLayers.ts");
    return swedenOverviewLayers;
  },
};
