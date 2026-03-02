import {
  Compression,
  EtagMismatch,
  PMTiles,
  type RangeResponse,
  ResolvedValueCache,
  type Source,
} from "pmtiles";
import {
  ArchiveNotFoundError,
  type PmtilesHeader,
  type PmtilesRepository,
} from "../../application/repositories/pmtiles_repository";
import { resolvePmtilesArchivePath } from "../mapper/pmtiles_path_mapper";
import type { Env } from "../../types";

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

const PMTILES_CACHE = new ResolvedValueCache(25, undefined, nativeDecompress);

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
      resolvePmtilesArchivePath(this.archiveName, this.env.PMTILES_PATH),
      {
        range: { offset: offset, length: length },
        onlyIf: { etagMatches: etag },
      }
    );

    if (!resp) throw new ArchiveNotFoundError("Archive not found");

    const objectBody = resp as R2ObjectBody;
    if (!objectBody.body) throw new EtagMismatch();

    return {
      data: await objectBody.arrayBuffer(),
      etag: objectBody.etag,
      cacheControl: objectBody.httpMetadata?.cacheControl,
      expires: objectBody.httpMetadata?.cacheExpiry?.toISOString(),
    };
  }
}

export class R2PmtilesRepository implements PmtilesRepository {
  private env: Env;

  constructor(env: Env) {
    this.env = env;
  }

  private buildPmtiles(name: string): PMTiles {
    const source = new R2Source(this.env, name);
    return new PMTiles(source, PMTILES_CACHE, nativeDecompress);
  }

  async getHeader(name: string): Promise<PmtilesHeader> {
    const header = await this.buildPmtiles(name).getHeader();
    return {
      minZoom: header.minZoom,
      maxZoom: header.maxZoom,
      tileType: header.tileType,
    };
  }

  async getTileJson(name: string, publicUrl: string): Promise<unknown> {
    return await this.buildPmtiles(name).getTileJson(publicUrl);
  }

  async getTile(
    name: string,
    tile: [number, number, number]
  ): Promise<ArrayBuffer | undefined> {
    const tileData = await this.buildPmtiles(name).getZxy(tile[0], tile[1], tile[2]);
    return tileData?.data;
  }
}
