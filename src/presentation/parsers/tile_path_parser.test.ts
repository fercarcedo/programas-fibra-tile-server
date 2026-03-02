import assert from "node:assert";
import { test } from "node:test";
import { parseTilePath } from "./tile_path_parser";

test("parse tile path", () => {
  const result = parseTilePath("/ign-pnoa/14/8200/6200.jpg");
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.name, "ign-pnoa");
  assert.deepStrictEqual(result.tile, [14, 8200, 6200]);
  assert.strictEqual(result.ext, "jpg");
});

test("parse tileset path", () => {
  const result = parseTilePath("/ign-pnoa.json");
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.name, "ign-pnoa");
  assert.strictEqual(result.ext, "json");
});
