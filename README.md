# Tile Server for [programas-fibra](https://github.com/fercarcedo/programas-fibra)

This repository contains a Cloudflare Worker that serves tiles from a PMTiles file stored in R2.

Cloned and adapted from ![PMTiles](https://github.com/protomaps/PMTiles)

## IGN imagery proxy

The worker also proxies IGN WMTS tiles so frontend clients do not call IGN directly.

Route format:

- `/ign-pnoa/{z}/{x}/{y}`
- `/ign-pnoa/{z}/{x}/{y}.jpg`
- `/ign-pnoa/{z}/{x}/{y}.png`

`ign-pnoa` is configurable via `IGN_TILESET_NAME` so this keeps the same `/{tileset}/z/x/y` pattern as PMTiles routes.
When no extension is provided, the default is inferred from `IGN_FORMAT` (default `image/jpeg` => `.jpg`).

This route fetches from `https://www.ign.es/wmts/pnoa-ma` (configurable via `IGN_*` vars) and applies Cloudflare cache headers from `IGN_CACHE_CONTROL`.
