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

test("Funian reconstruction preserves source data and keeps every viewpoint walkable", async () => {
  const { applyFunianOverlay, FUNIAN_IDS, FUNIAN_VIEWS } =
    await import("../lib/landmarks.ts");
  const before = JSON.stringify(street);
  const detailed = applyFunianOverlay(street);
  assert.equal(
    JSON.stringify(street),
    before,
    "source snapshot must not be rewritten",
  );
  assert.equal(detailed.buildings.filter((b) => b.landmark).length, 5);
  for (const id of FUNIAN_IDS) {
    const original = street.buildings.find((b) => b.id === id);
    const rebuilt = detailed.buildings.find((b) => b.id === id);
    assert.deepEqual(rebuilt.points, original.points);
    assert.deepEqual(rebuilt.tags, original.tags);
    assert.ok(rebuilt.referenceUrl);
  }
  for (const v of Object.values(FUNIAN_VIEWS)) {
    assert.equal(
      detailed.buildings.some((b) =>
        inside(v.position[0], v.position[2], b.points),
      ),
      false,
    );
  }
  for (let x = -205; x <= -125; x++) {
    assert.equal(
      detailed.buildings.some((b) => inside(x, -92, b.points)),
      false,
      `Courtyard path blocked at ${x}`,
    );
  }
});
