import type { TileService } from "../../application/services/tile_service";

export async function getTile(
  request: Request,
  ctx: ExecutionContext,
  tileService: TileService
) {
  return await tileService.fetch(request, ctx);
}
