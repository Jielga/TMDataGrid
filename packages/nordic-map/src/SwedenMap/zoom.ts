/** Zoom and pan of the map, in view (viewBox) coordinates: a map point p is drawn at `p * k + (x, y)`. */
export type MapView = {
  k: number;
  x: number;
  y: number;
};

export type ViewSize = {
  width: number;
  height: number;
};

export type Point = [number, number];

export const identityView: MapView = { k: 1, x: 0, y: 0 };

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Keeps the zoom between 1 and `maxZoom`, and the map covering the whole view so it can't be dragged away. */
export function clampView({ view, size, maxZoom }: { view: MapView; size: ViewSize; maxZoom: number }): MapView {
  const k = clamp(view.k, 1, maxZoom);
  return {
    k,
    x: clamp(view.x, size.width * (1 - k), 0),
    y: clamp(view.y, size.height * (1 - k), 0),
  };
}

/** Zooms to `k` and keeps the map point that was under `anchor` under it. */
export function zoomAt({
  view,
  anchor,
  k,
  size,
  maxZoom,
}: {
  view: MapView;
  anchor: Point;
  k: number;
  size: ViewSize;
  maxZoom: number;
}): MapView {
  const nextK = clamp(k, 1, maxZoom);
  const mapX = (anchor[0] - view.x) / view.k;
  const mapY = (anchor[1] - view.y) / view.k;
  return clampView({
    view: { k: nextK, x: anchor[0] - mapX * nextK, y: anchor[1] - mapY * nextK },
    size,
    maxZoom,
  });
}

/**
 * Two-finger gesture: the map point under the fingers' midpoint at the start follows the midpoint,
 * and the zoom changes with the distance between the fingers.
 */
export function pinchView({
  start,
  startMid,
  startDistance,
  mid,
  distance,
  size,
  maxZoom,
}: {
  start: MapView;
  startMid: Point;
  startDistance: number;
  mid: Point;
  distance: number;
  size: ViewSize;
  maxZoom: number;
}): MapView {
  const k = clamp(start.k * (distance / Math.max(startDistance, 1)), 1, maxZoom);
  const mapX = (startMid[0] - start.x) / start.k;
  const mapY = (startMid[1] - start.y) / start.k;
  return clampView({ view: { k, x: mid[0] - mapX * k, y: mid[1] - mapY * k }, size, maxZoom });
}

/** Map coordinates to view coordinates. */
export function toView(view: MapView, point: Point): Point {
  return [point[0] * view.k + view.x, point[1] * view.k + view.y];
}
