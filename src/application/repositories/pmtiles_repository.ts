import { TileType } from "pmtiles";

export class ArchiveNotFoundError extends Error {}

export interface PmtilesHeader {
  minZoom: number;
  maxZoom: number;
  tileType: TileType;
}

export interface PmtilesRepository {
  getHeader(name: string): Promise<PmtilesHeader>;
  getTileJson(name: string, publicUrl: string): Promise<unknown>;
  getTile(
    name: string,
    tile: [number, number, number]
  ): Promise<ArrayBuffer | undefined>;
}
