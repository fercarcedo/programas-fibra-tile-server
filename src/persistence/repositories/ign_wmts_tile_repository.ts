import type { IgnTileRepository } from "../../application/repositories/ign_tile_repository";
import type { Env } from "../../types";

export class IgnWmtsTileRepository implements IgnTileRepository {
  private env: Env;

  constructor(env: Env) {
    this.env = env;
  }

  async getTile(
    tile: [number, number, number],
    format: string
  ): Promise<Response> {
    const [z, x, y] = tile;
    const wmtsUrl = new URL(
      this.env.IGN_WMTS_BASE_URL || "https://www.ign.es/wmts/pnoa-ma"
    );
    wmtsUrl.searchParams.set("layer", this.env.IGN_LAYER || "OI.OrthoimageCoverage");
    wmtsUrl.searchParams.set("style", this.env.IGN_STYLE || "default");
    wmtsUrl.searchParams.set(
      "tilematrixset",
      this.env.IGN_TILEMATRIXSET || "GoogleMapsCompatible"
    );
    wmtsUrl.searchParams.set("Service", "WMTS");
    wmtsUrl.searchParams.set("Request", "GetTile");
    wmtsUrl.searchParams.set("Version", "1.0.0");
    wmtsUrl.searchParams.set("Format", format);
    wmtsUrl.searchParams.set("TileMatrix", `${z}`);
    wmtsUrl.searchParams.set("TileCol", `${x}`);
    wmtsUrl.searchParams.set("TileRow", `${y}`);

    return await fetch(wmtsUrl.toString());
  }
}
