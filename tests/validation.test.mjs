import { test } from "node:test";
import assert from "node:assert/strict";
import {
  contributionSchema,
  validateGlb,
  validatePhoto,
} from "../lib/validation.ts";
const note = {
  buildingId: "way-123",
  kind: "note",
  title: "建筑名称更正",
  description: "现场标牌显示了新的建筑名称",
  source: "本人现场观察",
};
test("accepts attributable contribution and rejects absent source", () => {
  assert.equal(contributionSchema.safeParse(note).success, true);
  assert.equal(
    contributionSchema.safeParse({ ...note, source: "" }).success,
    false,
  );
});
test("height requires a finite bounded measurement", () => {
  for (const height of [undefined, 0, 301, "NaN"])
    assert.equal(
      contributionSchema.safeParse({ ...note, kind: "height", height }).success,
      false,
    );
  assert.equal(
    contributionSchema.safeParse({ ...note, kind: "height", height: 42 })
      .success,
    true,
  );
});
function glb(json) {
  const text = new TextEncoder().encode(JSON.stringify(json));
  const n = Math.ceil(text.length / 4) * 4;
  const b = new ArrayBuffer(20 + n);
  const v = new DataView(b);
  [0x46546c67, 2, b.byteLength, n, 0x4e4f534a].forEach((x, i) =>
    v.setUint32(i * 4, x, true),
  );
  new Uint8Array(b, 20).fill(32);
  new Uint8Array(b, 20, text.length).set(text);
  return b;
}
test("GLB rejects external resource requests and invalid headers", () => {
  assert.throws(
    () =>
      validateGlb(
        glb({
          asset: { version: "2.0" },
          images: [{ uri: "https://external.invalid/a.png" }],
        }),
      ),
    /外部/,
  );
  assert.throws(() => validateGlb(new ArrayBuffer(30)), /无效/);
  assert.equal(
    validateGlb(glb({ asset: { version: "2.0" }, scenes: [] })),
    true,
  );
});
test("GLB enforces render complexity budget", () =>
  assert.throws(
    () =>
      validateGlb(
        glb({ asset: { version: "2.0" }, accessors: [{ count: 5000000 }] }),
      ),
    /面数/,
  ));
test("photos cannot upload HTML as an image", () =>
  assert.throws(
    () =>
      validatePhoto(
        new TextEncoder().encode("<html>untrusted</html>").buffer,
        "image/png",
      ),
    /照片/,
  ));
