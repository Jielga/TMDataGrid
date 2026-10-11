import { ActionIcon } from "@mantine/core";
import { IconMinus, IconPlus, IconZoomReset } from "@tabler/icons-react";
import { geoPath, geoTransverseMercator } from "d3-geo";
import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { eRoads, roadLabelPosition, swedenBorder } from "../data/swedenNaturalEarth/mapData.ts";
import classes from "./SwedenMap.module.css";
import { clampView, identityView, pinchView, toView, zoomAt } from "./zoom.ts";
import type { MapView, Point, ViewSize } from "./zoom.ts";

export type SwedenMapPin = {
  id: string;
  lat: number;
  lon: number;
  /** Shown as a tooltip on hover */
  label?: string;
  /** Pin color when not selected. Overrides `pinColor` for this pin. */
  color?: string;
};

export type SwedenMapProps = {
  pins?: SwedenMapPin[];
  /** Selected pin ids. Leave out to let the map keep its own selection. */
  selected?: string[];
  /** Selection at the start, when `selected` is left out */
  defaultSelected?: string[];
  /** Called after a drag-select, a pin click or a clear. The ids are in `pins` order. */
  onSelectionChange?: (ids: string[]) => void;
  onPinClick?: (pin: SwedenMapPin) => void;
  /** Drawing size in viewBox units. The map scales to its container and keeps this ratio. @default 400 */
  width?: number;
  /** @default 800 */
  height?: number;
  padding?: number;
  pinRadius?: number;
  /** Color of unselected pins, and of the ring around selected pins @default "#ffffff" */
  pinColor?: string;
  /** Outline around each pin, so pins stand out from what is behind them @default "#0b1f3a" */
  pinStrokeColor?: string;
  background?: string;
  landFill?: string;
  borderColor?: string;
  borderWidth?: number;
  selectedColor?: string;
  showRoads?: boolean;
  showRoadLabels?: boolean;
  roadColor?: string;
  roadWidth?: number;
  /** Largest zoom factor @default 10 */
  maxZoom?: number;
  /** Zoom in, zoom out and reset buttons in the top right corner @default true */
  showZoomControls?: boolean;
  /** Accessible name of the map @default "Map of Sweden" */
  label?: string;
};

type DragRect = { from: Point; to: Point };

type Gesture =
  | { kind: "select"; startClient: Point; additive: boolean }
  | { kind: "pan"; startClient: Point; start: MapView }
  | { kind: "pinch"; start: MapView; startMid: Point; startDistance: number }
  // A pinch has ended but a finger is still down. Wait until all fingers are up.
  | { kind: "settling" };

/** Zoom factor of one click on the zoom buttons */
const ZOOM_STEP = 1.5;

/** Screen coordinates to view (viewBox) coordinates. Handles CSS scaling and letterboxing. */
function clientToView({ svg, client, size }: { svg: SVGSVGElement; client: Point; size: ViewSize }): Point {
  const matrix = svg.getScreenCTM?.();
  if (matrix && typeof DOMPoint !== "undefined") {
    const point = new DOMPoint(client[0], client[1]).matrixTransform(matrix.inverse());
    return [point.x, point.y];
  }
  const rect = svg.getBoundingClientRect();
  return [((client[0] - rect.left) / rect.width) * size.width, ((client[1] - rect.top) / rect.height) * size.height];
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

function midpoint(a: Point, b: Point): Point {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

/**
 * Map of Sweden with E-roads and GPS pins, drawn as SVG from bundled data, so it works offline.
 *
 * - Drag a box to select the pins in it. Shift, Ctrl or Cmd + drag adds to the selection.
 * - Click a pin to toggle it. Click the empty map to clear the selection.
 * - Mouse wheel or pinch to zoom. Right or middle mouse drag, or two fingers, to pan.
 */
export function SwedenMap({
  pins = [],
  selected,
  defaultSelected = [],
  onSelectionChange,
  onPinClick,
  width = 400,
  height = 800,
  padding = 16,
  pinRadius = 5,
  pinColor = "#ffffff",
  pinStrokeColor = "#0b1f3a",
  background = "#0b1f3a",
  landFill = "none",
  borderColor = "#fecc02",
  borderWidth = 1.5,
  selectedColor = "#fecc02",
  showRoads = true,
  showRoadLabels = true,
  roadColor = "#7fa7d9",
  roadWidth = 1.2,
  maxZoom = 10,
  showZoomControls = true,
  label = "Map of Sweden",
}: SwedenMapProps) {
  const size: ViewSize = { width, height };

  const { borderPath, roads, project } = useMemo(() => {
    // Transverse Mercator on 15°E, close to SWEREF 99 TM, so Sweden isn't squashed
    const projection = geoTransverseMercator()
      .rotate([-15, 0])
      .fitExtent(
        [
          [padding, padding],
          [width - padding, height - padding],
        ],
        swedenBorder,
      );
    const toPath = geoPath(projection);
    return {
      borderPath: toPath(swedenBorder) ?? "",
      roads: eRoads.features.map((road) => {
        const labelAt = roadLabelPosition({ ref: road.properties.ref, geometry: road.geometry });
        return {
          ref: road.properties.ref,
          d: toPath(road) ?? "",
          labelAt: labelAt ? projection(labelAt) : null,
        };
      }),
      project: (lon: number, lat: number) => {
        return projection([lon, lat]);
      },
    };
  }, [width, height, padding]);

  // Pins in map coordinates (before zoom)
  const placed = useMemo(() => {
    return pins.flatMap((pin) => {
      const point = project(pin.lon, pin.lat);
      return point ? [{ pin, point }] : [];
    });
  }, [pins, project]);

  const [view, setView] = useState<MapView>(identityView);

  // Pins in view coordinates (after zoom), used for drawing and hit testing
  const viewPins = useMemo(() => {
    return placed.map(({ pin, point }) => {
      const [x, y] = toView(view, point);
      return { pin, x, y };
    });
  }, [placed, view]);

  const [innerSelected, setInnerSelected] = useState<string[]>(defaultSelected);
  const currentSelection = selected ?? innerSelected;
  const selectedSet = useMemo(() => {
    return new Set(currentSelection);
  }, [currentSelection]);

  function commitSelection(ids: Set<string>) {
    const ordered = placed
      .filter(({ pin }) => {
        return ids.has(pin.id);
      })
      .map(({ pin }) => {
        return pin.id;
      });
    if (selected === undefined) {
      setInnerSelected(ordered);
    }
    onSelectionChange?.(ordered);
  }

  const svgRef = useRef<SVGSVGElement>(null);
  // Pointers that are down, in screen coordinates
  const pointers = useRef(new Map<number, Point>());
  const gesture = useRef<Gesture | null>(null);
  const [drag, setDrag] = useState<DragRect | null>(null);

  function viewPoint(client: Point): Point {
    const svg = svgRef.current;
    return svg ? clientToView({ svg, client, size }) : client;
  }

  function twoFingers(): [Point, Point] | null {
    const [a, b] = Array.from(pointers.current.values());
    return a && b ? [viewPoint(a), viewPoint(b)] : null;
  }

  // React's onWheel is passive, so it can't stop the page from scrolling. Listen natively instead.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) {
      return;
    }
    const viewSize = { width, height };
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const anchor = clientToView({ svg, client: [event.clientX, event.clientY], size: viewSize });
      // deltaMode 1 is lines (Firefox), 0 is pixels
      const pixels = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY;
      setView((current) => {
        return zoomAt({ view: current, anchor, k: current.k * Math.exp(-pixels * 0.002), size: viewSize, maxZoom });
      });
    };
    svg.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      svg.removeEventListener("wheel", handleWheel);
    };
  }, [width, height, maxZoom]);

  function handlePointerDown(event: ReactPointerEvent<SVGSVGElement>) {
    const isMouse = event.pointerType === "mouse";
    if (isMouse && event.button > 2) {
      return;
    }
    event.currentTarget.setPointerCapture?.(event.pointerId);
    pointers.current.set(event.pointerId, [event.clientX, event.clientY]);

    if (pointers.current.size === 2) {
      const fingers = twoFingers();
      if (fingers) {
        gesture.current = {
          kind: "pinch",
          start: view,
          startMid: midpoint(fingers[0], fingers[1]),
          startDistance: distance(fingers[0], fingers[1]),
        };
      }
      setDrag(null);
      return;
    }
    if (pointers.current.size > 2) {
      return;
    }

    if (isMouse && event.button !== 0) {
      // Right or middle button pans. preventDefault stops the middle button's autoscroll.
      event.preventDefault();
      gesture.current = { kind: "pan", startClient: [event.clientX, event.clientY], start: view };
      return;
    }

    gesture.current = {
      kind: "select",
      startClient: [event.clientX, event.clientY],
      additive: event.shiftKey || event.ctrlKey || event.metaKey,
    };
    const point = viewPoint([event.clientX, event.clientY]);
    setDrag({ from: point, to: point });
  }

  function handlePointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    if (!pointers.current.has(event.pointerId)) {
      return;
    }
    pointers.current.set(event.pointerId, [event.clientX, event.clientY]);
    const current = gesture.current;

    if (current?.kind === "pinch") {
      const fingers = twoFingers();
      if (fingers) {
        setView(
          pinchView({
            start: current.start,
            startMid: current.startMid,
            startDistance: current.startDistance,
            mid: midpoint(fingers[0], fingers[1]),
            distance: distance(fingers[0], fingers[1]),
            size,
            maxZoom,
          }),
        );
      }
    } else if (current?.kind === "pan") {
      const from = viewPoint(current.startClient);
      const to = viewPoint([event.clientX, event.clientY]);
      setView(
        clampView({
          view: { k: current.start.k, x: current.start.x + to[0] - from[0], y: current.start.y + to[1] - from[1] },
          size,
          maxZoom,
        }),
      );
    } else if (current?.kind === "select") {
      const point = viewPoint([event.clientX, event.clientY]);
      setDrag((rect) => {
        return rect ? { ...rect, to: point } : rect;
      });
    }
  }

  function handlePointerUp(event: ReactPointerEvent<SVGSVGElement>) {
    if (!pointers.current.delete(event.pointerId)) {
      return;
    }
    const current = gesture.current;
    if (!current) {
      return;
    }
    if (current.kind === "pinch" || current.kind === "settling") {
      gesture.current = pointers.current.size === 0 ? null : { kind: "settling" };
      return;
    }
    gesture.current = null;
    if (current.kind === "pan") {
      return;
    }

    setDrag(null);
    const isTouch = event.pointerType === "touch";
    const end = viewPoint([event.clientX, event.clientY]);
    const moved = distance([event.clientX, event.clientY], current.startClient);

    if (moved < (isTouch ? 10 : 4)) {
      // A click: toggle the nearest pin under the pointer, or clear the selection on the empty map
      const hitRadius = pinRadius + (isTouch ? 10 : 4);
      let hit: (typeof viewPins)[number] | null = null;
      let hitDistance = Infinity;
      for (const candidate of viewPins) {
        const d = distance([candidate.x, candidate.y], end);
        if (d <= hitRadius && d < hitDistance) {
          hit = candidate;
          hitDistance = d;
        }
      }
      if (hit) {
        const next = new Set(selectedSet);
        if (next.has(hit.pin.id)) {
          next.delete(hit.pin.id);
        } else {
          next.add(hit.pin.id);
        }
        commitSelection(next);
        onPinClick?.(hit.pin);
      } else if (!current.additive && selectedSet.size > 0) {
        commitSelection(new Set());
      }
      return;
    }

    // A drag: select the pins inside the box
    const start = viewPoint(current.startClient);
    const minX = Math.min(start[0], end[0]);
    const maxX = Math.max(start[0], end[0]);
    const minY = Math.min(start[1], end[1]);
    const maxY = Math.max(start[1], end[1]);
    const next = current.additive ? new Set(selectedSet) : new Set<string>();
    for (const { pin, x, y } of viewPins) {
      if (x >= minX && x <= maxX && y >= minY && y <= maxY) {
        next.add(pin.id);
      }
    }
    commitSelection(next);
  }

  function handlePointerCancel(event: ReactPointerEvent<SVGSVGElement>) {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size === 0) {
      gesture.current = null;
    }
    setDrag(null);
  }

  function zoomBy(factor: number) {
    setView((current) => {
      return zoomAt({ view: current, anchor: [width / 2, height / 2], k: current.k * factor, size, maxZoom });
    });
  }

  return (
    <div className={classes.root} style={{ aspectRatio: `${width} / ${height}` }}>
      <svg
        ref={svgRef}
        className={classes.map}
        viewBox={`0 0 ${width} ${height}`}
        style={{ background }}
        role="img"
        aria-label={label}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onContextMenu={(event) => {
          // The right mouse button pans
          event.preventDefault();
        }}
      >
        <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
          <path
            d={borderPath}
            fill={landFill}
            stroke={borderColor}
            strokeWidth={borderWidth}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
          {showRoads && (
            <g fill="none" stroke={roadColor} strokeWidth={roadWidth} strokeLinejoin="round" strokeLinecap="round">
              {roads.map((road) => {
                return (
                  <path key={road.ref} d={road.d} vectorEffect="non-scaling-stroke">
                    <title>{road.ref}</title>
                  </path>
                );
              })}
            </g>
          )}
        </g>

        {/* Labels, pins and the selection box are drawn after the zoom, so they keep their size */}
        {showRoads &&
          showRoadLabels &&
          roads.map((road) => {
            if (!road.labelAt) {
              return null;
            }
            const [x, y] = toView(view, road.labelAt);
            const labelWidth = 7 + road.ref.length * 5.5;
            return (
              // Green shield with white text, like Swedish E-road signs
              <g key={`label-${road.ref}`} transform={`translate(${x} ${y})`} pointerEvents="none">
                <rect
                  x={-labelWidth / 2}
                  y={-6.5}
                  width={labelWidth}
                  height={13}
                  rx={2.5}
                  fill="#1b7f3b"
                  stroke="#ffffff"
                  strokeWidth={0.75}
                />
                <text
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={8.5}
                  fontWeight={700}
                  fontFamily="system-ui, sans-serif"
                  fill="#ffffff"
                >
                  {road.ref}
                </text>
              </g>
            );
          })}

        {viewPins.map(({ pin, x, y }) => {
          const isSelected = selectedSet.has(pin.id);
          return (
            <g key={pin.id} transform={`translate(${x} ${y})`}>
              {isSelected && <circle r={pinRadius + 3} fill="none" stroke={pinColor} strokeWidth={1.5} />}
              <circle
                r={pinRadius}
                fill={isSelected ? selectedColor : (pin.color ?? pinColor)}
                stroke={pinStrokeColor}
                strokeWidth={1.5}
              />
              {pin.label && <title>{pin.label}</title>}
            </g>
          );
        })}

        {drag && (
          <rect
            x={Math.min(drag.from[0], drag.to[0])}
            y={Math.min(drag.from[1], drag.to[1])}
            width={Math.abs(drag.to[0] - drag.from[0])}
            height={Math.abs(drag.to[1] - drag.from[1])}
            fill={selectedColor}
            fillOpacity={0.12}
            stroke={selectedColor}
            strokeWidth={1}
            strokeDasharray="4 3"
            pointerEvents="none"
          />
        )}
      </svg>

      {showZoomControls && (
        <ActionIcon.Group orientation="vertical" className={classes.controls}>
          <ActionIcon
            variant="default"
            size="lg"
            aria-label="Zoom in"
            disabled={view.k >= maxZoom}
            onClick={() => {
              zoomBy(ZOOM_STEP);
            }}
          >
            <IconPlus size={18} />
          </ActionIcon>
          <ActionIcon
            variant="default"
            size="lg"
            aria-label="Zoom out"
            disabled={view.k <= 1}
            onClick={() => {
              zoomBy(1 / ZOOM_STEP);
            }}
          >
            <IconMinus size={18} />
          </ActionIcon>
          <ActionIcon
            variant="default"
            size="lg"
            aria-label="Reset zoom"
            disabled={view.k <= 1}
            onClick={() => {
              setView(identityView);
            }}
          >
            <IconZoomReset size={18} />
          </ActionIcon>
        </ActionIcon.Group>
      )}
    </div>
  );
}
