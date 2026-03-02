import type { IgnTileRepository } from "../repositories/ign_tile_repository";

export interface TileResponsePayload {
  body: ArrayBuffer | string | undefined;
  contentType: string;
  status: number;
  cacheControl?: string;
}

export class IgnTileService {
  private repository: IgnTileRepository;
  private cacheControl: string;
  private readonly shortCacheControl = "public, max-age=300";

  constructor(repository: IgnTileRepository, cacheControl?: string) {
    this.repository = repository;
    this.cacheControl =
      cacheControl ||
      "public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000";
  }

  getTileJson(name: string, host: string): TileResponsePayload {
    return {
      body: JSON.stringify({
        tilejson: "3.0.0",
        name,
        scheme: "xyz",
        tiles: [`https://${host}/${name}/{z}/{x}/{y}.jpg`],
      }),
      contentType: "application/json",
      status: 200,
      cacheControl: "public, max-age=3600",
    };
  }

  async getTile(
    tile: [number, number, number],
    ext: string
  ): Promise<TileResponsePayload> {
    const requestedFormatByExt: Record<string, string> = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      webp: "image/webp",
    };

    const requestedFormat = requestedFormatByExt[ext];
    if (!requestedFormat) {
      return {
        body: `Bad request: requested .${ext} but supported formats are .jpg, .jpeg, .png, .webp`,
        contentType: "text/plain",
        status: 400,
        cacheControl: this.shortCacheControl,
      };
    }

    const upstream = await this.repository.getTile(tile, requestedFormat);
    const contentType = upstream.headers.get("Content-Type") || requestedFormat;

    if (!upstream.ok) {
      return {
        body: await upstream.text(),
        contentType,
        status: upstream.status,
        cacheControl: this.shortCacheControl,
      };
    }

    return {
      body: await upstream.arrayBuffer(),
      contentType,
      status: 200,
      cacheControl: this.cacheControl,
    };
  }
}
