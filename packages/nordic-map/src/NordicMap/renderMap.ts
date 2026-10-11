import { scaleOf, toScreen } from "./camera.ts";
import type { Camera, Frame } from "./camera.ts";
import type { RoadClass } from "./mapSource.ts";
import type { MapScene } from "./mapScene.ts";

export type MapStyle = {
  background: string;
  landFill: string;
  contextLandFill: string;
  contextBorderColor: string;
  waterFill: string;
  waterBorderColor: string;
  borderColor: string;
  borderWidth: number;
  /** Opacity of the border layer, 0 hides it */
  borderOpacity: number;
  /** Opacity of the road layer, 0 hides it */
  roadOpacity: number;
  /** Opacity of the road number labels, 0 hides them */
  roadLabelOpacity: number;
  roadColor: string;
  roadWidth: number;
};

/** Line width of each road class, relative to `roadWidth`, and its opacity */
const roadClassStyle: Record<RoadClass, { width: number; opacity: number }> = {
  european: { width: 1, opacity: 1 },
  national: { width: 0.8, opacity: 0.9 },
  regional: { width: 0.6, opacity: 0.55 },
};

function isVisibleColor(color: string): boolean {
  return color !== "none" && color !== "transparent";
}

type Box = { left: number; top: number; right: number; bottom: number };

const SHIELD_HEIGHT = 15;
/** Free space kept around each label, in pixels */
const LABEL_GAP = 4;
/** Two labels with the same text are not drawn closer than this, in pixels */
const SAME_LABEL_DISTANCE = 160;

function shieldWidth(text: string): number {
  return 8 + text.length * 6.5;
}

function overlaps(a: Box, b: Box): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

/** Green shield with white text, like Swedish E-road signs */
function drawShield({ context, text, x, y }: { context: CanvasRenderingContext2D; text: string; x: number; y: number }) {
  const width = shieldWidth(text);
  const height = SHIELD_HEIGHT;
  context.beginPath();
  context.roundRect(x - width / 2, y - height / 2, width, height, 3);
  context.fillStyle = "#1b7f3b";
  context.fill();
  context.lineWidth = 1;
  context.strokeStyle = "#ffffff";
  context.stroke();
  context.fillStyle = "#ffffff";
  context.fillText(text, x, y + 0.5);
}

/**
 * Draws the scene onto the canvas. Geometry is drawn in map units under one transform, so a frame costs
 * one fill or stroke per layer. Line widths and labels keep their size in pixels at every zoom.
 */
export function renderMap({
  canvas,
  scene,
  camera,
  frame,
  style,
}: {
  canvas: HTMLCanvasElement;
  scene: MapScene;
  camera: Camera;
  frame: Frame;
  style: MapStyle;
}) {
  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }
  const { width, height } = frame.size;
  const ratio = canvas.width / Math.max(width, 1);

  // The canvas keeps its state between frames. Start each frame from a known state, so nothing leaks from the last one.
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.globalAlpha = 1;
  context.globalCompositeOperation = "source-over";
  context.clearRect(0, 0, canvas.width, canvas.height);
  if (isVisibleColor(style.background)) {
    context.fillStyle = style.background;
    context.fillRect(0, 0, canvas.width, canvas.height);
  }

  const scale = scaleOf({ camera, frame });
  const [originX, originY] = toScreen({ camera, frame, point: [0, 0] });
  context.setTransform(ratio * scale, 0, 0, ratio * scale, ratio * originX, ratio * originY);
  context.lineJoin = "round";
  context.lineCap = "round";

  const fill = (path: Path2D | null, color: string) => {
    if (path && isVisibleColor(color)) {
      context.fillStyle = color;
      context.fill(path);
    }
  };
  const stroke = (path: Path2D | null, color: string, lineWidth: number) => {
    if (path && isVisibleColor(color)) {
      context.strokeStyle = color;
      context.lineWidth = lineWidth / scale;
      context.stroke(path);
    }
  };

  fill(scene.contextLand, style.contextLandFill);
  stroke(scene.contextLand, style.contextBorderColor, 0.75);
  stroke(scene.contextBorders, style.contextBorderColor, 0.75);
  fill(scene.land, style.landFill);
  fill(scene.water, style.waterFill);
  stroke(scene.water, style.waterBorderColor, 0.75);
  if (style.borderOpacity > 0) {
    context.globalAlpha = style.borderOpacity;
    stroke(scene.borders, style.borderColor, style.borderWidth);
    context.globalAlpha = 1;
  }

  if (style.roadOpacity > 0) {
    for (const road of scene.roads) {
      const { width: roadWidth, opacity } = roadClassStyle[road.roadClass];
      context.globalAlpha = opacity * style.roadOpacity;
      stroke(road.path, style.roadColor, style.roadWidth * roadWidth);
    }
    context.globalAlpha = 1;
  }

  if (style.roadLabelOpacity > 0) {
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.globalAlpha = style.roadLabelOpacity;
    context.font = "700 10px system-ui, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    // A label is skipped when it would cover one already drawn, or repeat the same road number close by
    const placed: { box: Box; text: string; x: number; y: number }[] = [];
    for (const label of scene.labels) {
      const [x, y] = toScreen({ camera, frame, point: label.at });
      if (x < -40 || x > width + 40 || y < -20 || y > height + 20) {
        continue;
      }
      const halfWidth = shieldWidth(label.text) / 2 + LABEL_GAP;
      const halfHeight = SHIELD_HEIGHT / 2 + LABEL_GAP;
      const box = { left: x - halfWidth, top: y - halfHeight, right: x + halfWidth, bottom: y + halfHeight };
      const blocked = placed.some((other) => {
        return (
          overlaps(box, other.box) ||
          (other.text === label.text && Math.hypot(other.x - x, other.y - y) < SAME_LABEL_DISTANCE)
        );
      });
      if (!blocked) {
        placed.push({ box, text: label.text, x, y });
        drawShield({ context, text: label.text, x, y });
      }
    }
    context.globalAlpha = 1;
  }
}
