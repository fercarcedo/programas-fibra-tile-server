import {
  Compression,
  EtagMismatch,
  PMTiles,
  RangeResponse,
  ResolvedValueCache,
  Source,
  TileType,
} from "pmtiles";
import { pmtiles_path, tile_path } from "./pmtiles-tools/index";

interface Env {
  // biome-ignore lint: config name
  ALLOWED_ORIGINS?: string;
  // biome-ignore lint: config name
  BUCKET: R2Bucket;
  // biome-ignore lint: config name
  CACHE_CONTROL?: string;
  // biome-ignore lint: config name
  PMTILES_PATH?: string;
  // biome-ignore lint: config name
  PUBLIC_HOSTNAME?: string;
  // biome-ignore lint: config name
  IGN_CACHE_CONTROL?: string;
  // biome-ignore lint: config name
  IGN_FORMAT?: string;
  // biome-ignore lint: config name
  IGN_LAYER?: string;
  // biome-ignore lint: config name
  IGN_STYLE?: string;
  // biome-ignore lint: config name
  IGN_TILEMATRIXSET?: string;
  // biome-ignore lint: config name
  IGN_TILESET_NAME?: string;
  // biome-ignore lint: config name
  IGN_WMTS_BASE_URL?: string;
}

class KeyNotFoundError extends Error {}

async function nativeDecompress(
  buf: ArrayBuffer,
  compression: Compression
): Promise<ArrayBuffer> {
  if (compression === Compression.None || compression === Compression.Unknown) {
    return buf;
  }
  if (compression === Compression.Gzip) {
    const stream = new Response(buf).body;
    const result = stream?.pipeThrough(new DecompressionStream("gzip"));
    return new Response(result).arrayBuffer();
  }
  throw new Error("Compression method not supported");
}

const CACHE = new ResolvedValueCache(25, undefined, nativeDecompress);

class R2Source implements Source {
  env: Env;
  archiveName: string;

  constructor(env: Env, archiveName: string) {
    this.env = env;
    this.archiveName = archiveName;
  }

  getKey() {
    return this.archiveName;
  }

  async getBytes(
    offset: number,
    length: number,
    signal?: AbortSignal,
    etag?: string
  ): Promise<RangeResponse> {
    const resp = await this.env.BUCKET.get(
      pmtiles_path(this.archiveName, this.env.PMTILES_PATH),
      {
        range: { offset: offset, length: length },
        onlyIf: { etagMatches: etag },
      }
    );
    if (!resp) {
      throw new KeyNotFoundError("Archive not found");
    }

    const o = resp as R2ObjectBody;

    if (!o.body) {
      throw new EtagMismatch();
    }

    const a = await o.arrayBuffer();
    return {
      data: a,
      etag: o.etag,
      cacheControl: o.httpMetadata?.cacheControl,
      expires: o.httpMetadata?.cacheExpiry?.toISOString(),
    };
  }
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    if (request.method.toUpperCase() === "POST")
      return new Response(undefined, { status: 405 });

    const url = new URL(request.url);
    let path = url.pathname;
    const ignTilesetName = env.IGN_TILESET_NAME || "ign-pnoa";
    const defaultIgnExtByFormat: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
    };
    const ignDefaultExt =
      defaultIgnExtByFormat[(env.IGN_FORMAT || "image/jpeg").toLowerCase()] ||
      "jpg";
    const firstPathSegment = path.replace(/^\/+/, "").split("/")[0] || "";
    const lastPart = path.split("/").pop();
    if (lastPart && !lastPart.includes(".")) {
      const defaultExt =
        firstPathSegment === ignTilesetName ? ignDefaultExt : "mvt";
      path = `${path}.${defaultExt}`;
    }

    const { ok, name, tile, ext } = tile_path(path);
    if (!ok) {
      console.error("Invalid URL: ", url);
      return new Response("Invalid URL", { status: 404 });
    }

    const cache = caches.default;

    let allowedOrigin = "";
    if (typeof env.ALLOWED_ORIGINS !== "undefined") {
      for (const o of env.ALLOWED_ORIGINS.split(",")) {
        if (o === request.headers.get("Origin") || o === "*") {
          allowedOrigin = o;
        }
      }
    }

    const cached = await cache.match(request.url);
    if (cached) {
      const respHeaders = new Headers(cached.headers);
      if (allowedOrigin)
        respHeaders.set("Access-Control-Allow-Origin", allowedOrigin);
      respHeaders.set("Vary", "Origin");

      return new Response(cached.body, {
        headers: respHeaders,
        status: cached.status,
      });
    }

    const cacheableResponse = (
      body: ArrayBuffer | string | undefined,
      cacheableHeaders: Headers,
      status: number,
      cacheOverride: string | undefined = undefined
    ) => {
      cacheableHeaders.set(
        "Cache-Control",
        cacheOverride || env.CACHE_CONTROL || "public, max-age=86400"
      );

      const cacheable = new Response(body, {
        headers: cacheableHeaders,
        status: status,
      });

      ctx.waitUntil(cache.put(request.url, cacheable));

      const respHeaders = new Headers(cacheableHeaders);
      if (allowedOrigin)
        respHeaders.set("Access-Control-Allow-Origin", allowedOrigin);
      respHeaders.set("Vary", "Origin");
      return new Response(body, { headers: respHeaders, status: status });
    };

    const cacheableHeaders = new Headers();
    if (name === ignTilesetName) {
      if (!tile) {
        cacheableHeaders.set("Content-Type", "application/json");
        const host = env.PUBLIC_HOSTNAME || url.hostname;
        const tileJson = {
          tilejson: "3.0.0",
          name: ignTilesetName,
          scheme: "xyz",
          tiles: [`https://${host}/${ignTilesetName}/{z}/{x}/{y}.jpg`],
        };
        return cacheableResponse(
          JSON.stringify(tileJson),
          cacheableHeaders,
          200,
          "public, max-age=3600"
        );
      }

      const [z, x, y] = tile;
      const requestedFormatByExt: Record<string, string> = {
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        png: "image/png",
        webp: "image/webp",
      };
      const requestedFormat = requestedFormatByExt[ext];
      if (!requestedFormat) {
        return cacheableResponse(
          `Bad request: requested .${ext} but supported formats are .jpg, .jpeg, .png, .webp`,
          cacheableHeaders,
          400
        );
      }

      const wmtsUrl = new URL(
        env.IGN_WMTS_BASE_URL || "https://www.ign.es/wmts/pnoa-ma"
      );
      wmtsUrl.searchParams.set("layer", env.IGN_LAYER || "OI.OrthoimageCoverage");
      wmtsUrl.searchParams.set("style", env.IGN_STYLE || "default");
      wmtsUrl.searchParams.set(
        "tilematrixset",
        env.IGN_TILEMATRIXSET || "GoogleMapsCompatible"
      );
      wmtsUrl.searchParams.set("Service", "WMTS");
      wmtsUrl.searchParams.set("Request", "GetTile");
      wmtsUrl.searchParams.set("Version", "1.0.0");
      wmtsUrl.searchParams.set("Format", requestedFormat);
      wmtsUrl.searchParams.set("TileMatrix", `${z}`);
      wmtsUrl.searchParams.set("TileCol", `${x}`);
      wmtsUrl.searchParams.set("TileRow", `${y}`);

      const upstream = await fetch(wmtsUrl.toString());
      cacheableHeaders.set(
        "Content-Type",
        upstream.headers.get("Content-Type") || requestedFormat
      );

      if (!upstream.ok) {
        const errorBody = await upstream.text();
        return cacheableResponse(errorBody, cacheableHeaders, upstream.status, "public, max-age=300");
      }

      const body = await upstream.arrayBuffer();
      return cacheableResponse(
        body,
        cacheableHeaders,
        200,
        env.IGN_CACHE_CONTROL ||
          "public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000"
      );
    }

    const source = new R2Source(env, name);
    const p = new PMTiles(source, CACHE, nativeDecompress);
    try {
      const pHeader = await p.getHeader();

      if (!tile) {
        cacheableHeaders.set("Content-Type", "application/json");
        const t = await p.getTileJson(
          `https://${env.PUBLIC_HOSTNAME || url.hostname}/${name}`
        );
        return cacheableResponse(JSON.stringify(t), cacheableHeaders, 200, "public, max-age=3600");
      }

      if (tile[0] < pHeader.minZoom || tile[0] > pHeader.maxZoom) {
        console.warn("Invalid zoom: ", tile[0], pHeader.minZoom, pHeader.maxZoom);
        return cacheableResponse(undefined, cacheableHeaders, 204);
      }

      for (const pair of [
        [TileType.Mvt, "mvt"],
        [TileType.Png, "png"],
        [TileType.Jpeg, "jpg"],
        [TileType.Webp, "webp"],
        [TileType.Avif, "avif"],
      ]) {
        if (pHeader.tileType === pair[0] && ext !== pair[1]) {
          if (pHeader.tileType === TileType.Mvt && ext === "pbf") {
            // allow this for now. Eventually we will delete this in favor of .mvt
            continue;
          }
          return cacheableResponse(
            `Bad request: requested .${ext} but archive has type .${pair[1]}`,
            cacheableHeaders,
            400
          );
        }
      }

      const tiledata = await p.getZxy(tile[0], tile[1], tile[2]);

      switch (pHeader.tileType) {
        case TileType.Mvt:
          cacheableHeaders.set("Content-Type", "application/x-protobuf");
          break;
        case TileType.Png:
          cacheableHeaders.set("Content-Type", "image/png");
          break;
        case TileType.Jpeg:
          cacheableHeaders.set("Content-Type", "image/jpeg");
          break;
        case TileType.Webp:
          cacheableHeaders.set("Content-Type", "image/webp");
          break;
      }

      if (tiledata) {
        return cacheableResponse(tiledata.data, cacheableHeaders, 200);
      }
      return cacheableResponse(undefined, cacheableHeaders, 204);
    } catch (e) {
      if (e instanceof KeyNotFoundError) {
        console.error("Archive not found");
        return cacheableResponse("Archive not found", cacheableHeaders, 404);
      }
      throw e;
    }
  },
};
