---
name: getting-started
description: >
  Set up @jielga/nordic-map: the NordicMap canvas map and the SwedenMap SVG map,
  the bundled map sources (swedenOsmSource, swedenOverviewSource), GPS pins with
  drag selection (pins, selected, defaultSelected, onSelectionChange,
  onPinClick), layer visibility by zoom (showBorder, showRoads, showRoadLabels),
  colors and the MapSource type for custom data. Load when rendering an offline
  map of Sweden or the Nordic countries, when the map is blank, stays on its
  loader, reloads on every render, or its cells 404 after a build.
metadata:
  type: core
  library: '@jielga/nordic-map'
  library_version: '0.1.0'
sources:
  - 'Jielga/react:packages/nordic-map/README.md'
  - 'Jielga/react:packages/nordic-map/src/index.ts'
  - 'Jielga/react:packages/nordic-map/src/NordicMap/NordicMap.tsx'
  - 'Jielga/react:packages/nordic-map/src/NordicMap/mapSource.ts'
  - 'Jielga/react:packages/nordic-map/src/SwedenMap/SwedenMap.tsx'
---

# nordic-map - Getting started

`NordicMap` draws a `MapSource` on a canvas, loading each data cell when it
comes into view, and zooms up to 50 times. `SwedenMap` draws Sweden's border
and E-roads as SVG from bundled Natural Earth data. Both take GPS pins and
share the same selection model.

## Setup

```tsx
import "@mantine/core/styles.css";
import "@jielga/nordic-map/styles.css";
import { NordicMap, swedenOsmSource, type NordicMapPin } from "@jielga/nordic-map";
import { useState } from "react";

const pins: NordicMapPin[] = [
  { id: "sto", lat: 59.33, lon: 18.07, label: "Stockholm" },
];

export function Offices() {
  const [selected, setSelected] = useState<string[]>([]);
  return (
    <div style={{ height: 600 }}>
      <NordicMap
        source={swedenOsmSource}
        label="Offices"
        pins={pins}
        selected={selected}
        onSelectionChange={setSelected}
      />
    </div>
  );
}
```

Peer dependencies: `react`, `react-dom` (19.1+), `@mantine/core`,
`@tabler/icons-react`. Render inside a `MantineProvider`.

## Sources

- `swedenOsmSource` - OpenStreetMap, three detail levels, neighbouring
  countries as background. Its cells are JSON files in `dist/cells/`, named
  with `new URL(..., import.meta.url)`; Vite and webpack 5 copy them.
- `swedenOverviewSource` - Natural Earth 1:10m, one level.
- A custom `MapSource` gives `extent`, `levels` (the first starts at
  `minZoom: 1`), optional `attribution` and `loadCell(cell)` returning
  `MapLayers`.

## Selection

- Drag a box to select pins; Shift, Ctrl or Cmd + drag adds.
- Click a pin to toggle it; click the empty map to clear.
- Leave out `selected` to let the map keep its own selection, seeded by
  `defaultSelected`.

## Layers

`showBorder`, `showRoads` and `showRoadLabels` take `true`, `false` or a zoom
range: `showRoadLabels={{ minZoom: 3 }}`.

## Common mistakes

### CRITICAL: a source created during render

```tsx
// Wrong: a new object every render reloads every cell
<NordicMap source={{ ...swedenOsmSource }} />
// Right: a module constant
<NordicMap source={swedenOsmSource} />
```

### HIGH: a container without a height

`NordicMap` fills its container. A container with no height renders a map
0 px tall.

### HIGH: the stylesheet is missing

Import `@jielga/nordic-map/styles.css` after Mantine's stylesheet; without it
the canvas and its input overlay are not laid out, and the map does not fill
its container.

### MEDIUM: the attribution is removed

The OpenStreetMap data is under the ODbL, and a map that shows it must
credit "© OpenStreetMap contributors". `swedenOsmSource` sets
`attribution`, and `NordicMap` shows it; keep it when wrapping the source.

### MEDIUM: a bundler that does not handle `new URL(..., import.meta.url)`

The cells of `swedenOsmSource` are found through `new URL` asset references.
A bundler without support for them leaves the files out and every cell
request fails. Use Vite or webpack 5, or a custom `MapSource` whose
`loadCell` fetches from your own server.
