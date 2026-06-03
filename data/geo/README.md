# Vendored geodata (build-time inputs only)

These TopoJSON files are committed so the site build is fully offline and
reproducible. They are **build-time inputs only** — they are read by
`scripts/build.js` and projected to inline static SVG via `d3-geo` /
`topojson-client`. None of these files ship to the browser.

## Files

### `countries-50m.json`
- **Source:** Natural Earth (1:50m cultural countries), packaged by
  [topojson/world-atlas](https://github.com/topojson/world-atlas)
  (`world-atlas` npm package, `countries-50m.json`).
- **Coordinate space:** geographic (lon/lat). Must be projected at build
  (e.g. `geoMercator`). Mexico is country id `"484"`.
- **License:** underlying Natural Earth data is **public domain**
  (no attribution required); world-atlas redistribution is **ISC**.

### `us-states-10m.json`
- **Source:** US Census Bureau cartographic boundaries, packaged by
  [topojson/us-atlas](https://github.com/topojson/us-atlas)
  (`us-atlas` npm package — this is the `states-albers-10m.json` variant).
- **Coordinate space:** **already projected** to a planar `d3.geoAlbersUsa`
  space fitted to a `975 x 610` viewBox. Render with `geoPath()` using **no
  projection** (`geoPath(null)`); do **not** reproject. State name is in
  `properties.name`.
- **License:** underlying US Census TIGER/cartographic boundary data is
  **US Government public domain**; us-atlas redistribution is **ISC**.

## Provenance note
`us-atlas` ships two state files: `states-10m.json` (geographic lon/lat) and
`states-albers-10m.json` (pre-projected to the 975x610 AlbersUsa plane).
The **pre-projected Albers** variant is the one vendored here as
`us-states-10m.json`, because the diaspora map renders it with no projection.
