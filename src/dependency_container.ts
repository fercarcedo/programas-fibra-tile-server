import { IgnTileService } from "./application/services/ign_tile_service";
import { PmtilesTileService } from "./application/services/pmtiles_tile_service";
import { TileService } from "./application/services/tile_service";
import { IgnWmtsTileRepository } from "./persistence/repositories/ign_wmts_tile_repository";
import { R2PmtilesRepository } from "./persistence/repositories/r2_pmtiles_repository";
import type { Env } from "./types";

export class DependencyContainer {
  private tileService: TileService;

  constructor(env: Env) {
    const ignRepository = new IgnWmtsTileRepository(env);
    const pmtilesRepository = new R2PmtilesRepository(env);
    const ignTileService = new IgnTileService(ignRepository, env.IGN_CACHE_CONTROL);
    const pmtilesTileService = new PmtilesTileService(pmtilesRepository);

    this.tileService = new TileService(env, ignTileService, pmtilesTileService);
  }

  getTileService(): TileService {
    return this.tileService;
  }
}
