import assert from "node:assert/strict";
const origin = process.env.TEST_ORIGIN || "http://localhost:5189";
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin))
  throw new Error("Runtime fixture tests are local-only");
const login = await fetch(origin + "/signin-with-chatgpt?return_to=/", {
  redirect: "manual",
});
const cookie = login.headers
  .getSetCookie()
  .map((v) => v.split(";")[0])
  .join("; ");
assert.ok(cookie, "local mock sign-in must set a cookie");
const headers = { Cookie: cookie, Origin: origin };
function form(kind = "note") {
  const f = new FormData();
  for (const [k, v] of Object.entries({
    buildingId: "way-659519927",
    kind,
    title: "建筑贡献功能验收",
    description: "本地功能验收内容，不代表实地情况。验证后自动撤回。",
    source: "本地自动验收",
    rights: "yes",
  }))
    f.append(k, v);
  return f;
}
const unauthorized = await fetch(origin + "/api/contributions", {
  method: "POST",
  body: form(),
});
assert.equal(unauthorized.status, 401);
const csrf = await fetch(origin + "/api/contributions", {
  method: "POST",
  headers: { ...headers, Origin: "https://untrusted.invalid" },
  body: form(),
});
assert.equal(csrf.status, 403);
const unknown = form();
unknown.set("buildingId", "way-9999999999");
assert.equal(
  (
    await fetch(origin + "/api/contributions", {
      method: "POST",
      headers,
      body: unknown,
    })
  ).status,
  400,
);
const height = form("height");
height.append("height", "999");
assert.equal(
  (
    await fetch(origin + "/api/contributions", {
      method: "POST",
      headers,
      body: height,
    })
  ).status,
  400,
);
const aiAnon = await fetch(origin + "/api/photo-analysis", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: "{}",
});
assert.equal(aiAnon.status, 401);
const aiCross = await fetch(origin + "/api/photo-analysis", {
  method: "POST",
  headers: {
    ...headers,
    Origin: "https://untrusted.invalid",
    "Content-Type": "application/json",
  },
  body: "{}",
});
assert.equal(aiCross.status, 403);
const aiStatus = await (await fetch(origin + "/api/photo-analysis")).json();
assert.equal(typeof aiStatus.configured, "boolean");
assert.equal("key" in aiStatus, false);
if (!aiStatus.configured) {
  const unavailable = await fetch(origin + "/api/photo-analysis", {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: "{}",
  });
  assert.equal(unavailable.status, 503);
}
const positions = new Float32Array([
  -1, -1, -1, 1, -1, -1, 1, 1, -1, -1, 1, -1, -1, -1, 1, 1, -1, 1, 1, 1, 1, -1,
  1, 1,
]);
const indices = new Uint16Array([
  0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 2, 3, 7, 2, 7, 6, 1, 2,
  6, 1, 6, 5, 3, 0, 4, 3, 4, 7,
]);
const bin = new Uint8Array(positions.byteLength + indices.byteLength);
bin.set(new Uint8Array(positions.buffer));
bin.set(new Uint8Array(indices.buffer), positions.byteLength);
const json = {
  asset: { version: "2.0" },
  scene: 0,
  scenes: [{ nodes: [0] }],
  nodes: [{ mesh: 0 }],
  meshes: [
    { primitives: [{ attributes: { POSITION: 0 }, indices: 1, material: 0 }] },
  ],
  materials: [
    {
      pbrMetallicRoughness: {
        baseColorFactor: [0.15, 0.65, 0.4, 1],
        metallicFactor: 0,
        roughnessFactor: 1,
      },
    },
  ],
  buffers: [{ byteLength: bin.byteLength }],
  bufferViews: [
    {
      buffer: 0,
      byteOffset: 0,
      byteLength: positions.byteLength,
      target: 34962,
    },
    {
      buffer: 0,
      byteOffset: positions.byteLength,
      byteLength: indices.byteLength,
      target: 34963,
    },
  ],
  accessors: [
    {
      bufferView: 0,
      componentType: 5126,
      count: 8,
      type: "VEC3",
      min: [-1, -1, -1],
      max: [1, 1, 1],
    },
    { bufferView: 1, componentType: 5123, count: 36, type: "SCALAR" },
  ],
};
const text = new TextEncoder().encode(JSON.stringify(json));
const n = Math.ceil(text.length / 4) * 4;
const buffer = new ArrayBuffer(12 + 8 + n + 8 + bin.byteLength);
const view = new DataView(buffer);
[0x46546c67, 2, buffer.byteLength, n, 0x4e4f534a].forEach((x, i) =>
  view.setUint32(i * 4, x, true),
);
new Uint8Array(buffer, 20, n).fill(32);
new Uint8Array(buffer, 20, text.length).set(text);
view.setUint32(20 + n, bin.byteLength, true);
view.setUint32(24 + n, 0x004e4942, true);
new Uint8Array(buffer, 28 + n).set(bin);
const model = form("model");
model.append(
  "file",
  new File([buffer], "building-fixture.glb", { type: "model/gltf-binary" }),
);
const upload = await fetch(origin + "/api/contributions", {
  method: "POST",
  headers,
  body: model,
});
const response = await upload.json();
assert.equal(upload.status, 201, JSON.stringify(response));
const id = response.id;
const asset = await fetch(origin + "/api/assets?id=" + id, { headers });
assert.equal(asset.status, 200);
assert.equal((await asset.arrayBuffer()).byteLength, buffer.byteLength);
const list = await fetch(origin + "/api/contributions", { headers }).then((r) =>
  r.json(),
);
assert.ok(list.contributions.some((c) => c.id === id && c.isMine));
if (!process.env.KEEP_PREVIEW) {
  const deletion = await fetch(origin + "/api/contributions?id=" + id, {
    method: "DELETE",
    headers,
  });
  assert.equal(deletion.status, 200);
  assert.equal(
    (await fetch(origin + "/api/assets?id=" + id, { headers })).status,
    404,
  );
}
const old = await fetch(origin + "/api/contributions", { headers }).then((r) =>
  r.json(),
);
for (const c of old.contributions) {
  if (c.isMine && c.source === "本地功能验收，提交后撤回")
    await fetch(origin + "/api/contributions?id=" + c.id, {
      method: "DELETE",
      headers,
    });
}
console.log(
  JSON.stringify({
    auth: 401,
    csrf: 403,
    unknownBuilding: 400,
    invalidHeight: 400,
    modelUpload: 201,
    modelDownload: 200,
    persisted: true,
    modelId: id,
    keptForPreview: !!process.env.KEEP_PREVIEW,
  }),
);
