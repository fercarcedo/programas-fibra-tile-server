import { WorkerEntrypoint } from "cloudflare:workers";
import { DependencyContainer } from "./dependency_container";
import { fetch as routerFetch } from "./presentation/router";
import type { Env } from "./types";

export default class extends WorkerEntrypoint<Env> {
  private container = new DependencyContainer(this.env);

  async fetch(request: Request) {
    return await routerFetch(request, this.env, this.ctx, this.container);
  }
}
