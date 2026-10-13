import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as THREE from "three";
import { analyzeBuildingPhoto } from "../lib/photo-analysis.ts";
import { facadeRecipeSchema, referenceRecipe } from "../lib/photo-recipe.ts";
import {
  createPhotoModel,
  disposePhotoModel,
  photoModelGlb,
} from "../lib/photo-model.ts";
import { validateGlb } from "../lib/validation.ts";
const recipe = referenceRecipe("way-659519928");
const completed = (r) =>
  new Response(
    JSON.stringify({
      status: "completed",
      output: [{ content: [{ type: "output_text", text: JSON.stringify(r) }] }],
    }),
  );
test("vision request uses a fixed endpoint, structured output, nonstored images and bounded context", async () => {
  let request;
  const result = await analyzeBuildingPhoto(
    "test-secret",
    "gpt-4.1-mini",
    "data:image/jpeg;base64,/9j/",
    "x".repeat(2000),
    async (url, init) => {
      assert.equal(url, "https://api.openai.com/v1/responses");
      request = JSON.parse(init.body);
      return completed(recipe);
    },
  );
  assert.deepEqual(result, recipe);
  assert.equal(request.store, false);
  assert.equal(request.text.format.strict, true);
  assert.equal(request.input[0].content[0].text.length, 1000);
  assert.ok(request.max_output_tokens <= 2200);
});
test("refusal, incomplete output and invalid geometry are rejected rather than rendered", async () => {
  for (const response of [
    new Response(
      JSON.stringify({
        status: "completed",
        output: [{ content: [{ type: "refusal" }] }],
      }),
    ),
    new Response(JSON.stringify({ status: "incomplete" })),
    completed({ ...recipe, setback: 999 }),
    completed({ ...recipe, buildingVisible: false }),
    completed({ ...recipe, glassColor: "javascript:alert(1)" }),
  ]) {
    await assert.rejects(
      () =>
        analyzeBuildingPhoto(
          "test-secret",
          "model",
          "image",
          "",
          async () => response,
        ),
      (e) => e.status === 422,
    );
  }
  assert.equal(
    facadeRecipeSchema.safeParse({ ...recipe, execute: "anything" }).success,
    false,
  );
});
test("provider credential and billing errors produce sanitized messages", async () => {
  for (const [upstream, expected] of [
    [401, 503],
    [429, 429],
    [500, 502],
  ])
    await assert.rejects(
      () =>
        analyzeBuildingPhoto(
          "test-secret",
          "model",
          "image",
          "",
          async () =>
            new Response("upstream secret details", { status: upstream }),
        ),
      (e) => e.status === expected && !e.message.includes("secret"),
    );
});
const street = JSON.parse(
  readFileSync(new URL("../public/geodata/street.json", import.meta.url)),
);
test("photo models retain mapped dimensions and remain within geometry budgets", () => {
  for (const id of ["way-659519928", "way-659519927", "way-666608905"]) {
    const b = street.buildings.find((b) => b.id === id),
      before = JSON.stringify(b),
      root = createPhotoModel(b, referenceRecipe(id));
    const box = new THREE.Box3().setFromObject(root),
      size = box.getSize(new THREE.Vector3());
    assert.ok(Math.abs(size.y - b.height) < 0.6);
    assert.ok(size.x < 100 && size.z < 100);
    assert.equal(JSON.stringify(b), before);
    let count = 0;
    root.traverse((o) => {
      if (o instanceof THREE.Mesh)
        count += o.geometry.attributes.position.count;
    });
    assert.ok(count < 500000);
    disposePhotoModel(root);
  }
});
test("generated photo draft exports a GLB accepted by the real upload validator", async () => {
  globalThis.FileReader = class {
    readAsArrayBuffer(blob) {
      blob.arrayBuffer().then((v) => {
        this.result = v;
        this.onloadend?.();
      });
    }
  };
  const b = street.buildings.find((b) => b.id === "way-659519928");
  const blob = await photoModelGlb(b, recipe);
  assert.ok(blob.size > 1000);
  assert.equal(validateGlb(await blob.arrayBuffer()), true);
});
