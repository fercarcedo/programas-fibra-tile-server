import { parseTilePath } from "../../presentation/parsers/tile_path_parser";
import type { Env } from "../../types";
import { IgnTileService, type TileResponsePayload } from "./ign_tile_service";
import { PmtilesTileService } from "./pmtiles_tile_service";

type CacheableResponseFactory = (
  body: ArrayBuffer | string | undefined,
  headers: Headers,
  status: number,
  cacheOverride?: string
) => Response;

export class TileService {
  private env: Env;
  private ignTileService: IgnTileService;
  private pmtilesTileService: PmtilesTileService;

  constructor(
    env: Env,
    ignTileService: IgnTileService,
    pmtilesTileService: PmtilesTileService
  ) {
    this.env = env;
    this.ignTileService = ignTileService;
    this.pmtilesTileService = pmtilesTileService;
  }

  async fetch(request: Request, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = this.resolvePath(url.pathname);
    const { ok, name, tile, ext } = parseTilePath(path);

    if (!ok) {
      console.error("Invalid URL: ", url);
      return new Response("Invalid URL", { status: 404 });
    }

    const cache = caches.default;
    const allowedOrigin = this.resolveAllowedOrigin(request);

    const cached = await cache.match(request.url);
    if (cached) {
      return this.withCorsFromCached(cached, allowedOrigin);
    }

    const cacheableResponse = this.buildCacheableResponse(
      request,
      ctx,
      cache,
      allowedOrigin
    );

    if (name === (this.env.IGN_TILESET_NAME || "ign-pnoa")) {
      if (!tile) {
        const tileJson = this.ignTileService.getTileJson(
          name,
          this.env.PUBLIC_HOSTNAME || url.hostname
        );
        return this.respond(cacheableResponse, tileJson);
      }

      return this.respond(cacheableResponse, await this.ignTileService.getTile(tile, ext));
    }

    if (!tile) {
      const tileJson = await this.pmtilesTileService.getTileJson(
        name,
        this.env.PUBLIC_HOSTNAME || url.hostname
      );
      return this.respond(cacheableResponse, tileJson);
    }

    return this.respond(
      cacheableResponse,
      await this.pmtilesTileService.getTile(name, tile, ext)
    );
  }

  private resolvePath(rawPath: string): string {
    const ignTilesetName = this.env.IGN_TILESET_NAME || "ign-pnoa";
    const defaultIgnExtByFormat: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
    };
    const ignDefaultExt =
      defaultIgnExtByFormat[(this.env.IGN_FORMAT || "image/jpeg").toLowerCase()] ||
      "jpg";
    const firstPathSegment = rawPath.replace(/^\/+/, "").split("/")[0] || "";
    const lastPart = rawPath.split("/").pop();

    if (!lastPart || lastPart.includes(".")) return rawPath;

    const defaultExt = firstPathSegment === ignTilesetName ? ignDefaultExt : "mvt";
    return `${rawPath}.${defaultExt}`;
  }

  private resolveAllowedOrigin(request: Request): string {
    if (typeof this.env.ALLOWED_ORIGINS === "undefined") return "";

    for (const origin of this.env.ALLOWED_ORIGINS.split(",")) {
      if (origin === request.headers.get("Origin") || origin === "*") {
        return origin;
      }
    }
    return "";
  }

  private withCorsFromCached(cached: Response, allowedOrigin: string): Response {
    const responseHeaders = new Headers(cached.headers);
    if (allowedOrigin) responseHeaders.set("Access-Control-Allow-Origin", allowedOrigin);
    responseHeaders.set("Vary", "Origin");

    return new Response(cached.body, {
      headers: responseHeaders,
      status: cached.status,
    });
  }

  private buildCacheableResponse(
    request: Request,
    ctx: ExecutionContext,
    cache: Cache,
    allowedOrigin: string
  ): CacheableResponseFactory {
    return (
      body: ArrayBuffer | string | undefined,
      headers: Headers,
      status: number,
      cacheOverride?: string
    ) => {
      headers.set(
        "Cache-Control",
        cacheOverride || this.env.CACHE_CONTROL || "public, max-age=86400"
      );

      const cacheable = new Response(body, { headers, status });
      ctx.waitUntil(cache.put(request.url, cacheable));

      const responseHeaders = new Headers(headers);
      if (allowedOrigin) responseHeaders.set("Access-Control-Allow-Origin", allowedOrigin);
      responseHeaders.set("Vary", "Origin");

      return new Response(body, { headers: responseHeaders, status });
    };
  }

  private respond(
    cacheableResponse: CacheableResponseFactory,
    payload: TileResponsePayload
  ): Response {
    const headers = new Headers();
    headers.set("Content-Type", payload.contentType);
    return cacheableResponse(
      payload.body,
      headers,
      payload.status,
      payload.cacheControl
    );
  }
}
