# Data and licenses

The map data is built from public sources by the scripts in `packages/nordic-map/scripts/map-data/` in the repository, and ships with the package.

| Data | Source | License |
| --- | --- | --- |
| `swedenOsmSource` | OpenStreetMap, with Natural Earth land borders for the neighbouring countries | ODbL |
| `loadSwedenCounties`, `loadSwedenMunicipalities` | OpenStreetMap boundaries, with codes from Statistics Sweden as tagged in OpenStreetMap | ODbL |
| `swedenOverviewSource` | Natural Earth 1:10m | Public domain |

## Credit OpenStreetMap

The OpenStreetMap data is © OpenStreetMap contributors, under the [Open Database License](https://www.openstreetmap.org/copyright) (ODbL).
A map that shows it must credit "© OpenStreetMap contributors".

`swedenOsmSource` sets this credit in its `attribution`, and `NordicMap` shows it in the map's bottom right corner.
Keep `attribution` when you build a source on top of it.

The counties and municipalities are drawn over a map that already shows the credit.
If you draw them with a source of your own, add the credit to its `attribution`.

## Natural Earth

The Natural Earth data is in the public domain and needs no credit.
`swedenOverviewSource` sets no `attribution`.
