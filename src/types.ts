export interface Env {
  // biome-ignore lint: config name
  ALLOWED_ORIGINS?: string;
  // biome-ignore lint: config name
  BUCKET: R2Bucket;
  // biome-ignore lint: config name
  CACHE_CONTROL?: string;
  // biome-ignore lint: config name
  PMTILES_PATH?: string;
  // biome-ignore lint: config name
  PUBLIC_HOSTNAME?: string;
  // biome-ignore lint: config name
  IGN_CACHE_CONTROL?: string;
  // biome-ignore lint: config name
  IGN_FORMAT?: string;
  // biome-ignore lint: config name
  IGN_LAYER?: string;
  // biome-ignore lint: config name
  IGN_STYLE?: string;
  // biome-ignore lint: config name
  IGN_TILEMATRIXSET?: string;
  // biome-ignore lint: config name
  IGN_TILESET_NAME?: string;
  // biome-ignore lint: config name
  IGN_WMTS_BASE_URL?: string;
}
