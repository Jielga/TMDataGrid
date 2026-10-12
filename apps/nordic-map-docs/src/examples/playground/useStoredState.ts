import { useState } from "react";
import type { SelectionMode } from "@jielga/nordic-map";
import type { LayerSetting } from "./layerSetting.ts";
import { colorFields } from "./mapColors.ts";
import type { MapColors } from "./mapColors.ts";

const PREFIX = "nordic-map-playground:";

/**
 * State kept in local storage under `key`, so a reload keeps it. A stored value that `isValid` rejects, for
 * example one from an older playground, falls back to `initial`.
 */
export function useStoredState<T>({
  key,
  initial,
  isValid,
}: {
  key: string;
  initial: T;
  isValid: (value: unknown) => value is T;
}): [T, (next: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = window.localStorage.getItem(PREFIX + key);
      if (stored !== null) {
        const parsed: unknown = JSON.parse(stored);
        if (isValid(parsed)) {
          return parsed;
        }
      }
    } catch {
      // Unreadable or blocked storage: start from the default
    }
    return initial;
  });
  const update = (next: T) => {
    setValue(next);
    try {
      window.localStorage.setItem(PREFIX + key, JSON.stringify(next));
    } catch {
      // Storage may be full or blocked. The setting still applies until the page reloads.
    }
  };
  return [value, update];
}

export function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

export function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function isSelectionMode(value: unknown): value is SelectionMode {
  return value === "multiple" || value === "single" || value === "none";
}

export function isLayerSetting(value: unknown): value is LayerSetting {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const { enabled, range } = value as { enabled?: unknown; range?: unknown };
  return isBoolean(enabled) && Array.isArray(range) && range.length === 2 && range.every(isNumber);
}

/** Picked colors, or null for the colors of the site's color scheme */
export function isPickedColors(value: unknown): value is MapColors | null {
  if (value === null) {
    return true;
  }
  if (typeof value !== "object") {
    return false;
  }
  const colors = value as Record<string, unknown>;
  return colorFields.every(({ key }) => {
    return typeof colors[key] === "string";
  });
}
