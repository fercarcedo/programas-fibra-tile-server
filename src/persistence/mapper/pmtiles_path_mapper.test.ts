import assert from "node:assert";
import { test } from "node:test";
import { resolvePmtilesArchivePath } from "./pmtiles_path_mapper";

test("pmtiles path default", () => {
  const result = resolvePmtilesArchivePath("foo", undefined);
  assert.strictEqual(result, "foo.pmtiles");
});

test("pmtiles path templated", () => {
  const result = resolvePmtilesArchivePath("foo", "folder/{name}/file.pmtiles");
  assert.strictEqual(result, "folder/foo/file.pmtiles");
});

test("pmtiles path with slash", () => {
  const result = resolvePmtilesArchivePath(
    "foo/bar",
    "folder/{name}/file.pmtiles"
  );
  assert.strictEqual(result, "folder/foo/bar/file.pmtiles");
});

test("pmtiles path with multiple names", () => {
  let result = resolvePmtilesArchivePath("slug", "folder/{name}/{name}.pmtiles");
  assert.strictEqual(result, "folder/slug/slug.pmtiles");
  result = resolvePmtilesArchivePath("foo/bar", "folder/{name}/{name}.pmtiles");
  assert.strictEqual(result, "folder/foo/bar/foo/bar.pmtiles");
});
