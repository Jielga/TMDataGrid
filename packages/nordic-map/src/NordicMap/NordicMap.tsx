import { ActionIcon, Loader, Paper, Text } from "@mantine/core";
import { IconMinus, IconPlus, IconZoomReset } from "@tabler/icons-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import { panBy, pinchCamera, toScreen, zoomAround } from "./camera.ts";
import type { Camera, Frame, MapBounds, Point, Size } from "./camera.ts";
import { buildScene } from "./mapScene.ts";
import { layerOpacity } from "./layerVisibility.ts";
import type { LayerVisibility } from "./layerVisibility.ts";
import { createMapProjection } from "./mapProjection.ts";
import type { MapSource } from "./mapSource.ts";
import classes from "./NordicMap.module.css";
import { renderMap } from "./renderMap.ts";
import { useCamera } from "./useCamera.ts";
import { useDetailCells, useOverviewCells } from "./useMapCells.ts";
import type { PreparedCell } from "./useMapCells.ts";

export type NordicMapPin = {
  id: string;
  lat: number;
  lon: number;
  /** Shown as a tooltip on hover */
  label?: string;
  /** Pin color when not selected. Overrides `pinColor` for this pin. */
  color?: string;
};

export type NordicMapProps = {
  /** Where the map data comes from, for example `swedenOverviewSource`. Keep it stable, such as a module constant. */
  source: MapSource;
  pins?: NordicMapPin[];
  /** Selected pin ids. Leave out to let the map keep its own selection. */
  selected?: string[];
  /** Selection at the start, when `selected` is left out */
  defaultSelected?: string[];
  /** Called after a drag-select, a pin click or a clear. The ids are in `pins` order. */
  onSelectionChange?: (ids: string[]) => void;
  onPinClick?: (pin: NordicMapPin) => void;
  /** Space in pixels around the map at zoom 1 @default 16 */
  padding?: number;
  /** @default 5 */
  pinRadius?: number;
  /** Color of unselected pins, and of the ring around selected pins @default "#ffffff" */
  pinColor?: string;
  /** Outline around each pin, so pins stand out from what is behind them @default "#0b1f3a" */
  pinStrokeColor?: string;
  /** Sea color @default "#06111f" */
  background?: string;
  /** Fill of the map's own land, for example Sweden @default "#12284a" */
  landFill?: string;
  /** Fill of the background land around it, for example the neighbouring countries @default "#0c1c33" */
  contextLandFill?: string;
  /** Coasts and borders of the background land @default "#2a4365" */
  contextBorderColor?: string;
  /** Lake fill. Leave out to use the sea color, so lakes and sea look the same. */
  waterFill?: string;
  /** Lake outline @default "none" */
  waterBorderColor?: string;
  /** Coastline and border color @default "#fecc02" */
  borderColor?: string;
  /** When the coastline and border show: `true`, `false`, or a zoom range such as `{ minZoom: 8 }` @default true */
  showBorder?: LayerVisibility;
  /**
   * Coastline and border width in screen pixels, the same at every zoom. Below 1 the line is drawn fainter
   * on normal screens, and stays crisp on high resolution screens. @default 1
   */
  borderWidth?: number;
  /** @default "#fecc02" */
  selectedColor?: string;
  /** When the roads show: `true`, `false`, or a zoom range such as `{ minZoom: 3, maxZoom: 30 }` @default true */
  showRoads?: LayerVisibility;
  /** When the road number signs show. They only show where the roads show too. @default true */
  showRoadLabels?: LayerVisibility;
  /** @default "#7fa7d9" */
  roadColor?: string;
  /** Line width of E-roads in pixels. Smaller roads are thinner. @default 1.2 */
  roadWidth?: number;
  /** Largest zoom factor, where 1 shows the whole map @default 50 */
  maxZoom?: number;
  /** Called with the zoom factor when it changes. During a zoom it is called on every animation frame. */
  onZoomChange?: (zoom: number) => void;
  /** Zoom in, zoom out and reset buttons in the top right corner @default true */
  showZoomControls?: boolean;
  /** Accessible name of the map @default "Map" */
  label?: string;
  /** Shown when the map data could not be loaded @default "Could not load the map." */
  loadErrorText?: string;
};

type DragRect = { from: Point; to: Point };

type PanSample = { time: number; point: Point };

type Gesture =
  | { kind: "select"; start: Point; additive: boolean }
  | { kind: "pan"; last: Point; samples: PanSample[] }
  | { kind: "pinch"; start: Camera; startMid: Point; startDistance: number }
  // A pinch has ended but a finger is still down. Wait until all fingers are up.
  | { kind: "settling" };

/** Zoom factor of one click on the zoom buttons or one + or - key press */
const ZOOM_STEP = 1.6;
/** Pixels an arrow key pans */
const KEY_PAN = 80;
/** Pan movement older than this, in milliseconds, does not count toward the fling speed */
const FLING_WINDOW_MS = 100;

const noCells: PreparedCell[] = [];

function distance(a: Point, b: Point): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

function midpoint(a: Point, b: Point): Point {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

function unionBounds(list: (MapBounds | null)[]): MapBounds | null {
  let result: MapBounds | null = null;
  for (const bounds of list) {
    if (!bounds) {
      continue;
    }
    result = result
      ? {
          minX: Math.min(result.minX, bounds.minX),
          minY: Math.min(result.minY, bounds.minY),
          maxX: Math.max(result.maxX, bounds.maxX),
          maxY: Math.max(result.maxY, bounds.maxY),
        }
      : bounds;
  }
  return result;
}

/**
 * Map drawn on canvas from a tiled data source, with GPS pins on top. Works offline when the source is bundled.
 *
 * - Drag a box to select the pins in it. Shift, Ctrl or Cmd + drag adds to the selection.
 * - Click a pin to toggle it. Click the empty map to clear the selection.
 * - Mouse wheel, trackpad pinch or two fingers to zoom.
 * - Right or middle mouse drag, Space + drag, or two fingers to pan. A quick pan keeps gliding.
 * - Keyboard: + and - zoom, arrow keys pan, 0 shows the whole map.
 */
export function NordicMap({
  source,
  pins = [],
  selected,
  defaultSelected = [],
  onSelectionChange,
  onPinClick,
  padding = 16,
  pinRadius = 5,
  pinColor = "#ffffff",
  pinStrokeColor = "#0b1f3a",
  background = "#06111f",
  landFill = "#12284a",
  contextLandFill = "#0c1c33",
  contextBorderColor = "#2a4365",
  waterFill,
  waterBorderColor = "none",
  borderColor = "#fecc02",
  showBorder = true,
  borderWidth = 1,
  selectedColor = "#fecc02",
  showRoads = true,
  showRoadLabels = true,
  roadColor = "#7fa7d9",
  roadWidth = 1.2,
  maxZoom = 50,
  onZoomChange,
  showZoomControls = true,
  label = "Map",
  loadErrorText = "Could not load the map.",
}: NordicMapProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<SVGSVGElement>(null);

  const [size, setSize] = useState<Size | null>(null);
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) {
      return;
    }
    const measure = () => {
      const { width, height } = root.getBoundingClientRect();
      setSize((current) => {
        return current?.width === width && current.height === height ? current : { width, height };
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    return () => {
      observer.disconnect();
    };
  }, []);

  const projection = useMemo(() => {
    return createMapProjection(source);
  }, [source]);

  // The overview gives the map its extent, and the extent with the view size gives the frame
  const overview = useOverviewCells({ source, projection });
  const bounds = useMemo(() => {
    return overview
      ? unionBounds(
          overview.map((cell) => {
            return cell.bounds;
          }),
        )
      : null;
  }, [overview]);
  // Every overview cell has settled, but none gave any land or border to fit the map to
  const failed = overview !== null && bounds === null;
  const frame = useMemo<Frame | null>(() => {
    return size && size.width > 0 && size.height > 0 && bounds ? { size, bounds, padding, maxZoom } : null;
  }, [size, bounds, padding, maxZoom]);

  const cameraControls = useCamera(frame);
  const { camera } = cameraControls;
  const cells = useDetailCells({ source, projection, camera, frame, overview: overview ?? noCells });
  const scene = useMemo(() => {
    return buildScene({ cells, contextCells: overview ?? noCells });
  }, [cells, overview]);

  // Draw the map whenever the camera, the cells or the style change
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !frame || !camera) {
      return;
    }
    const ratio = window.devicePixelRatio || 1;
    const pixelWidth = Math.round(frame.size.width * ratio);
    const pixelHeight = Math.round(frame.size.height * ratio);
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }
    renderMap({
      canvas,
      scene,
      camera,
      frame,
      style: {
        background,
        landFill,
        contextLandFill,
        contextBorderColor,
        waterFill: waterFill ?? background,
        waterBorderColor,
        borderColor,
        borderWidth,
        borderOpacity: layerOpacity({ visibility: showBorder, zoom: camera.k }),
        roadOpacity: layerOpacity({ visibility: showRoads, zoom: camera.k }),
        // A sign without its road makes no sense, so the signs never show more than the roads
        roadLabelOpacity: Math.min(
          layerOpacity({ visibility: showRoads, zoom: camera.k }),
          layerOpacity({ visibility: showRoadLabels, zoom: camera.k }),
        ),
        roadColor,
        roadWidth,
      },
    });
  });

  // Pins in map units, then on screen
  const placed = useMemo(() => {
    return pins.flatMap((pin) => {
      const point = projection.project([pin.lon, pin.lat]);
      return point ? [{ pin, point }] : [];
    });
  }, [pins, projection]);
  const screenPins =
    camera && frame
      ? placed.map(({ pin, point }) => {
          const [x, y] = toScreen({ camera, frame, point });
          return { pin, x, y };
        })
      : [];

  const [innerSelected, setInnerSelected] = useState<string[]>(defaultSelected);
  const currentSelection = selected ?? innerSelected;
  const selectedSet = new Set(currentSelection);

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

  // Pointers that are down, in pixels from the map's top left corner
  const pointers = useRef(new Map<number, Point>());
  const gesture = useRef<Gesture | null>(null);
  const spaceDown = useRef(false);
  const [drag, setDrag] = useState<DragRect | null>(null);
  const [panning, setPanning] = useState(false);

  function localPoint(clientX: number, clientY: number): Point {
    const rect = overlayRef.current?.getBoundingClientRect();
    return rect ? [clientX - rect.left, clientY - rect.top] : [clientX, clientY];
  }

  function twoFingers(): [Point, Point] | null {
    const [a, b] = Array.from(pointers.current.values());
    return a && b ? [a, b] : null;
  }

  // React's onWheel is passive, so it can't stop the page from scrolling. Listen natively, and read the newest
  // handler through a ref so the listener is added once.
  const handleWheel = (event: WheelEvent) => {
    event.preventDefault();
    const anchor = localPoint(event.clientX, event.clientY);
    if (event.ctrlKey) {
      // Trackpad pinch arrives as a wheel event with Ctrl. Its steps are small and frequent, so apply them directly.
      cameraControls.update((current, currentFrame) => {
        return zoomAround({ camera: current, frame: currentFrame, anchor, k: current.k * Math.exp(-event.deltaY * 0.01) });
      });
      return;
    }
    // deltaMode 1 is lines (Firefox), 2 is pages, 0 is pixels
    const pixels = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaMode === 2 ? event.deltaY * 400 : event.deltaY;
    cameraControls.zoomSmooth({ anchor, factor: Math.exp(-pixels * 0.0025) });
  };
  const wheelHandler = useRef(handleWheel);
  useLayoutEffect(() => {
    wheelHandler.current = handleWheel;
  });
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) {
      return;
    }
    const listener = (event: WheelEvent) => {
      wheelHandler.current(event);
    };
    overlay.addEventListener("wheel", listener, { passive: false });
    return () => {
      overlay.removeEventListener("wheel", listener);
    };
  }, []);

  function startPan({ point, time }: PanSample) {
    gesture.current = { kind: "pan", last: point, samples: [{ time, point }] };
    setPanning(true);
  }

  function handlePointerDown(event: ReactPointerEvent<SVGSVGElement>) {
    const isMouse = event.pointerType === "mouse";
    if (isMouse && event.button > 2) {
      return;
    }
    // Grabbing the map stops a glide or a zoom that is still running
    cameraControls.stop();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const point = localPoint(event.clientX, event.clientY);
    pointers.current.set(event.pointerId, point);

    if (pointers.current.size === 2) {
      const fingers = twoFingers();
      if (fingers && camera) {
        gesture.current = {
          kind: "pinch",
          start: camera,
          startMid: midpoint(fingers[0], fingers[1]),
          startDistance: distance(fingers[0], fingers[1]),
        };
      }
      setDrag(null);
      setPanning(false);
      return;
    }
    if (pointers.current.size > 2) {
      return;
    }

    if ((isMouse && event.button !== 0) || spaceDown.current) {
      // Right or middle button, or Space, pans. preventDefault stops the middle button's autoscroll.
      event.preventDefault();
      startPan({ point, time: event.timeStamp });
      return;
    }

    gesture.current = { kind: "select", start: point, additive: event.shiftKey || event.ctrlKey || event.metaKey };
    setDrag({ from: point, to: point });
  }

  function handlePointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    if (!pointers.current.has(event.pointerId)) {
      return;
    }
    const point = localPoint(event.clientX, event.clientY);
    pointers.current.set(event.pointerId, point);
    const current = gesture.current;

    if (current?.kind === "pinch") {
      const fingers = twoFingers();
      if (fingers) {
        cameraControls.update((_camera, currentFrame) => {
          return pinchCamera({
            start: current.start,
            frame: currentFrame,
            startMid: current.startMid,
            startDistance: current.startDistance,
            mid: midpoint(fingers[0], fingers[1]),
            distance: distance(fingers[0], fingers[1]),
          });
        });
      }
    } else if (current?.kind === "pan") {
      const delta: Point = [point[0] - current.last[0], point[1] - current.last[1]];
      current.last = point;
      const now = event.timeStamp;
      current.samples = [
        ...current.samples.filter((sample) => {
          return now - sample.time <= FLING_WINDOW_MS;
        }),
        { time: now, point },
      ];
      cameraControls.update((currentCamera, currentFrame) => {
        return panBy({ camera: currentCamera, frame: currentFrame, delta });
      });
    } else if (current?.kind === "select") {
      setDrag((rect) => {
        return rect ? { ...rect, to: point } : rect;
      });
    }
  }

  function endPan({ current, now }: { current: Extract<Gesture, { kind: "pan" }>; now: number }) {
    setPanning(false);
    const recent = current.samples.filter((sample) => {
      return now - sample.time <= FLING_WINDOW_MS;
    });
    const first = recent[0];
    const last = recent.at(-1);
    if (first && last && last.time > first.time) {
      const elapsed = last.time - first.time;
      // The map moves with the pointer, so the glide continues the pointer's direction
      cameraControls.fling([(last.point[0] - first.point[0]) / elapsed, (last.point[1] - first.point[1]) / elapsed]);
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
      endPan({ current, now: event.timeStamp });
      return;
    }

    setDrag(null);
    const isTouch = event.pointerType === "touch";
    const end = localPoint(event.clientX, event.clientY);

    if (distance(end, current.start) < (isTouch ? 10 : 4)) {
      // A click: toggle the nearest pin under the pointer, or clear the selection on the empty map
      const hitRadius = pinRadius + (isTouch ? 10 : 4);
      let hit: (typeof screenPins)[number] | null = null;
      let hitDistance = Infinity;
      for (const candidate of screenPins) {
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
    const minX = Math.min(current.start[0], end[0]);
    const maxX = Math.max(current.start[0], end[0]);
    const minY = Math.min(current.start[1], end[1]);
    const maxY = Math.max(current.start[1], end[1]);
    const next = current.additive ? new Set(selectedSet) : new Set<string>();
    for (const { pin, x, y } of screenPins) {
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
    setPanning(false);
  }

  function zoomCenter(factor: number) {
    if (frame) {
      cameraControls.zoomSmooth({ anchor: [frame.size.width / 2, frame.size.height / 2], factor });
    }
  }

  function handleKeyDown(event: ReactKeyboardEvent<SVGSVGElement>) {
    if (event.key === " ") {
      event.preventDefault();
      spaceDown.current = true;
      return;
    }
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }
    const pan: Record<string, Point> = {
      ArrowLeft: [KEY_PAN, 0],
      ArrowRight: [-KEY_PAN, 0],
      ArrowUp: [0, KEY_PAN],
      ArrowDown: [0, -KEY_PAN],
    };
    const delta = pan[event.key];
    if (delta) {
      event.preventDefault();
      cameraControls.update((current, currentFrame) => {
        return panBy({ camera: current, frame: currentFrame, delta });
      });
    } else if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      zoomCenter(ZOOM_STEP);
    } else if (event.key === "-") {
      event.preventDefault();
      zoomCenter(1 / ZOOM_STEP);
    } else if (event.key === "0") {
      event.preventDefault();
      cameraControls.reset();
    }
  }

  function handleKeyUp(event: ReactKeyboardEvent<SVGSVGElement>) {
    if (event.key === " ") {
      spaceDown.current = false;
    }
  }

  const k = camera?.k ?? 1;
  const zoom = camera?.k;
  useEffect(() => {
    if (zoom !== undefined) {
      onZoomChange?.(zoom);
    }
  }, [zoom, onZoomChange]);

  return (
    // The background is also set here, so the map area has its color while the data loads
    <div ref={rootRef} className={classes.root} style={{ background }}>
      <canvas ref={canvasRef} className={classes.canvas} aria-hidden />
      <svg
        ref={overlayRef}
        className={classes.overlay}
        data-panning={panning || undefined}
        role="application"
        aria-roledescription="map"
        aria-label={label}
        tabIndex={0}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        onBlur={() => {
          spaceDown.current = false;
        }}
        onContextMenu={(event) => {
          // The right mouse button pans
          event.preventDefault();
        }}
      >
        {screenPins.map(({ pin, x, y }) => {
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

      {!camera && (
        <div className={classes.status}>
          {failed ? (
            <Paper withBorder shadow="xs" px="sm" py={6}>
              <Text size="sm" role="alert">
                {loadErrorText}
              </Text>
            </Paper>
          ) : (
            <Loader size="sm" aria-label="Loading map" />
          )}
        </div>
      )}

      {source.attribution && (
        <div className={classes.attribution}>
          {source.attribution.url ? (
            <a href={source.attribution.url} target="_blank" rel="noreferrer">
              {source.attribution.text}
            </a>
          ) : (
            source.attribution.text
          )}
        </div>
      )}

      {showZoomControls && (
        <ActionIcon.Group orientation="vertical" className={classes.controls}>
          <ActionIcon
            variant="default"
            size="lg"
            aria-label="Zoom in"
            disabled={!camera || k >= maxZoom}
            onClick={() => {
              zoomCenter(ZOOM_STEP);
            }}
          >
            <IconPlus size={18} />
          </ActionIcon>
          <ActionIcon
            variant="default"
            size="lg"
            aria-label="Zoom out"
            disabled={!camera || k <= 1}
            onClick={() => {
              zoomCenter(1 / ZOOM_STEP);
            }}
          >
            <IconMinus size={18} />
          </ActionIcon>
          <ActionIcon
            variant="default"
            size="lg"
            aria-label="Show whole map"
            disabled={!camera || k <= 1}
            onClick={() => {
              cameraControls.reset();
            }}
          >
            <IconZoomReset size={18} />
          </ActionIcon>
        </ActionIcon.Group>
      )}
    </div>
  );
}
