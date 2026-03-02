import { TileType } from "pmtiles";
import {
  ArchiveNotFoundError,
  type PmtilesRepository,
} from "../repositories/pmtiles_repository";
import type { TileResponsePayload } from "./ign_tile_service";

export class PmtilesTileService {
  private repository: PmtilesRepository;
  private readonly shortCacheControl = "public, max-age=300";

  constructor(repository: PmtilesRepository) {
    this.repository = repository;
  }

  async getTileJson(name: string, host: string): Promise<TileResponsePayload> {
    const tileJson = await this.repository.getTileJson(name, `https://${host}/${name}`);
    return {
      body: JSON.stringify(tileJson),
      contentType: "application/json",
      status: 200,
      cacheControl: "public, max-age=3600",
    };
  }

  async getTile(
    name: string,
    tile: [number, number, number],
    ext: string
  ): Promise<TileResponsePayload> {
    try {
      const header = await this.repository.getHeader(name);

      if (tile[0] < header.minZoom || tile[0] > header.maxZoom) {
        console.warn("Invalid zoom: ", tile[0], header.minZoom, header.maxZoom);
        return {
          body: undefined,
          contentType: "application/octet-stream",
          status: 204,
        };
      }

      for (const pair of [
        [TileType.Mvt, "mvt"],
        [TileType.Png, "png"],
        [TileType.Jpeg, "jpg"],
        [TileType.Webp, "webp"],
        [TileType.Avif, "avif"],
      ]) {
        if (header.tileType === pair[0] && ext !== pair[1]) {
          if (header.tileType === TileType.Mvt && ext === "pbf") {
            continue;
          }
          return {
            body: `Bad request: requested .${ext} but archive has type .${pair[1]}`,
            contentType: "text/plain",
            status: 400,
            cacheControl: this.shortCacheControl,
          };
        }
      }

      const tileData = await this.repository.getTile(name, tile);
      const contentType = this.resolveContentType(header.tileType);
      if (tileData) return { body: tileData, contentType, status: 200 };

      return {
        body: undefined,
        contentType,
        status: 204,
      };
    } catch (error) {
      if (error instanceof ArchiveNotFoundError) {
        console.error("Archive not found");
        return {
          body: "Archive not found",
          contentType: "text/plain",
          status: 404,
          cacheControl: this.shortCacheControl,
        };
      }
      throw error;
    }
  }

  private resolveContentType(tileType: TileType): string {
    switch (tileType) {
      case TileType.Mvt:
        return "application/x-protobuf";
      case TileType.Png:
        return "image/png";
      case TileType.Jpeg:
        return "image/jpeg";
      case TileType.Webp:
        return "image/webp";
      default:
        return "application/octet-stream";
    }
  }
}
