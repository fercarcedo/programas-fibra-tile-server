import type { DependencyContainer } from "../dependency_container";
import type { Env } from "../types";
import { getTile } from "./handlers/tile";

export async function fetch(
  request: Request,
  _env: Env,
  ctx: ExecutionContext,
  container: DependencyContainer
) {
  if (request.method.toUpperCase() === "POST") {
    return new Response(undefined, { status: 405 });
  }

  const tileService = container.getTileService();
  return await getTile(request, ctx, tileService);
}
