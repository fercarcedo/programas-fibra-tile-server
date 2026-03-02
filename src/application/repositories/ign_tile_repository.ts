export interface IgnTileRepository {
  getTile(
    tile: [number, number, number],
    format: string
  ): Promise<Response>;
}
