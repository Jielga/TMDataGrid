# @jielga/nordic-map

React components that render offline maps of the Nordic countries, with GPS pins and drag selection.
The map data ships with the package, so no tile server or API key is needed.

- Documentation and live demos: <https://jielga.github.io/react/nordic-map/>
- Source: <https://github.com/Jielga/react/tree/main/packages/nordic-map>

## Installation

```sh
npm install @jielga/nordic-map
```

Peer dependencies: `react` and `react-dom` (19.1 or later), `@mantine/core` and `@tabler/icons-react`.

Import the stylesheet once, after Mantine's:

```ts
import "@mantine/core/styles.css";
import "@jielga/nordic-map/styles.css";
```

Render the maps inside a Mantine `MantineProvider`.

## Usage

`NordicMap` fills its container, so give the container a height:

```tsx
import { NordicMap, swedenOsmSource, type NordicMapPin } from "@jielga/nordic-map";
import { useState } from "react";

const pins: NordicMapPin[] = [
  { id: "sto", lat: 59.33, lon: 18.07, label: "Stockholm" },
  { id: "got", lat: 57.71, lon: 11.97, label: "Göteborg" },
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

Define `source` outside the component; a new object on every render reloads every map cell.

## Components

- `NordicMap` - a canvas map that zooms up to 50 times and draws any `MapSource`.
  Cells of the source load when they come into view.
- `SwedenMap` - an SVG map of Sweden's border and E-roads, drawn from bundled Natural Earth data.

Both maps share the same pin selection:

- Drag a box to select the pins in it. Shift, Ctrl or Cmd + drag adds to the selection.
- Click a pin to toggle it. Click the empty map to clear the selection.
- Scroll or pinch to zoom. Drag with the right or middle mouse button, or with two fingers, to pan.

`NordicMap` also takes the keyboard: `+` and `-` zoom, the arrow keys pan, and `0` shows the whole map.

## Map sources

`NordicMap` draws a `MapSource`: an extent, a list of detail levels and a `loadCell` function that returns the layers of one cell.

- `swedenOsmSource` - Sweden from OpenStreetMap in three detail levels, with the neighbouring countries as a plain background
- `swedenOverviewSource` - Sweden from Natural Earth 1:10m in one level, the data `SwedenMap` draws

The cells of `swedenOsmSource` are separate JSON files in `dist/cells/`.
The bundle names each with `new URL(..., import.meta.url)`, so Vite and webpack 5 copy them into your build.

The border, the roads and the road number signs can each be turned off, or shown only in a zoom range, with `showBorder`, `showRoads` and `showRoadLabels`:

```tsx
<NordicMap source={swedenOsmSource} showRoadLabels={{ minZoom: 3 }} />
```

## Data licenses

The OpenStreetMap data is © OpenStreetMap contributors, under the Open Database License (ODbL).
A map that shows it must credit "© OpenStreetMap contributors"; `swedenOsmSource` sets this credit, and `NordicMap` shows it in the corner.
The Natural Earth data is in the public domain.

## Development

The data in `src/data/` is built by the scripts in [`scripts/map-data/`](scripts/map-data/README.md), which also lists the sources and how to rebuild.
The output is committed, so the scripts only need to run when the data changes.

The documentation site is [`apps/nordic-map-docs/`](../../apps/nordic-map-docs) in this repository:

```sh
bun run --cwd apps/nordic-map-docs dev
```
