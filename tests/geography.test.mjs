import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { inside } from "../lib/scene.ts";
const street = JSON.parse(
  readFileSync(new URL("../public/geodata/street.json", import.meta.url)),
);
test("the complete pilot walking route stays outside building footprints", () => {
  for (let x = -185; x <= 215; x += 1) {
    assert.equal(
      street.buildings.some((b) => inside(x, 20, b.points)),
      false,
      `Blocked walking route at ${x}`,
    );
  }
});
test("every displayed building retains an OSM identity and explicit height provenance", () => {
  assert.equal(street.buildings.length, 34);
  for (const b of street.buildings) {
    assert.match(b.sourceUrl, /https:\/\/www.openstreetmap.org\/way\/\d+/);
    assert.ok(b.height > 0 && b.height < 300);
    assert.ok(b.heightSource);
    assert.ok(b.points.length >= 4);
    assert.deepEqual(b.points[0], b.points.at(-1));
  }
});
test("footprint collision distinguishes interior and exterior", () => {
  const square = [
    [0, 0],
    [10, 0],
    [10, 10],
    [0, 10],
    [0, 0],
  ];
  assert.equal(inside(5, 5, square), true);
  assert.equal(inside(12, 5, square), false);
});
