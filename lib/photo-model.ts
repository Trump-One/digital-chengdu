import * as THREE from "three";
import type { Building } from "./types";
import { facadeRecipeSchema, type FacadeRecipe } from "./photo-recipe.ts";
import { batchStaticDetail } from "./urban-detail.ts";

// Bounded procedural interpretation. OSM footprint and total height stay fixed.
export function createPhotoModel(b: Building, input: FacadeRecipe) {
  const r = facadeRecipeSchema.parse(input),
    root = new THREE.Group();
  if (!r.buildingVisible) throw new Error("照片中未识别到可建模的建筑");
  const xs = b.points.map((p) => p[0]),
    zs = b.points.map((p) => p[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2,
    cz = (Math.min(...zs) + Math.max(...zs)) / 2;
  const w = Math.max(...xs) - Math.min(...xs),
    d = Math.max(...zs) - Math.min(...zs);
  const inset = Math.min(r.setback, w * 0.14, d * 0.14),
    podium = Math.min(r.podiumHeight, b.height * 0.35);
  const lower = b.points.map((p) => [p[0] - cx, p[1] - cz]);
  const upper = lower.map((p) => [
    p[0] * (1 - (2 * inset) / w),
    p[1] * (1 - (2 * inset) / d),
  ]);
  const glass = new THREE.MeshStandardMaterial({
    color: r.glassColor,
    metalness: 0.62,
    roughness: 0.2,
  });
  const stone = new THREE.MeshStandardMaterial({
    color: r.stoneColor,
    roughness: 0.9,
  });
  const trim = new THREE.MeshStandardMaterial({
    color: r.trimColor,
    roughness: 0.45,
    metalness: 0.6,
  });
  const window = new THREE.MeshStandardMaterial({
    color: "#8bafb9",
    metalness: 0.7,
    roughness: 0.16,
  });
  const dark = new THREE.MeshStandardMaterial({
    color: "#283437",
    roughness: 0.5,
  });
  function box(
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    mat: THREE.Material,
    angle = 0,
  ) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
    m.position.set(x, y, z);
    m.rotation.y = angle;
    root.add(m);
  }
  function section(
    points: number[][],
    bottom: number,
    height: number,
    mat: THREE.Material,
  ) {
    if (height <= 0) return;
    const shape = new THREE.Shape(
        points.map((p) => new THREE.Vector2(p[0], -p[1])),
      ),
      g = new THREE.ExtrudeGeometry(shape, {
        depth: height,
        bevelEnabled: false,
      });
    g.rotateX(-Math.PI / 2);
    const body = new THREE.Mesh(g, [stone, mat]);
    body.position.y = bottom;
    body.castShadow = true;
    body.receiveShadow = true;
    root.add(body);
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1],
        b = points[i],
        dx = b[0] - a[0],
        dz = b[1] - a[1],
        len = Math.hypot(dx, dz);
      if (len < 0.6) continue;
      const angle = Math.atan2(-dz, dx),
        mx = (a[0] + b[0]) / 2,
        mz = (a[1] + b[1]) / 2;
      let nx = dz / len,
        nz = -dx / len;
      if (nx * mx + nz * mz < 0) {
        nx *= -1;
        nz *= -1;
      }
      const rows = Math.max(1, Math.round(height / r.floorHeight)),
        cols = Math.max(1, Math.round(len / r.windowWidth));
      const fh = height / rows;
      for (let row = 0; row <= rows; row++) {
        const y = bottom + row * fh;
        box(
          mx + nx * 0.07,
          y,
          mz + nz * 0.07,
          len,
          r.style === "banded" ? 0.28 : 0.075,
          0.16,
          trim,
          angle,
        );
        if (r.style === "banded" && row < rows)
          for (const offset of [0.12, 0.22])
            box(
              mx + nx * 0.1,
              y + offset,
              mz + nz * 0.1,
              len,
              0.035,
              0.2,
              trim,
              angle,
            );
      }
      for (let col = 0; col <= cols; col++) {
        const u = col / cols;
        box(
          a[0] + dx * u + nx * 0.05,
          bottom + height / 2,
          a[1] + dz * u + nz * 0.05,
          0.045,
          height,
          0.1,
          trim,
          angle,
        );
      }
      for (let row = 0; row < rows; row++)
        for (let col = 0; col < cols; col++) {
          const u = (col + 0.5) / cols,
            x = a[0] + dx * u + nx * 0.1,
            z = a[1] + dz * u + nz * 0.1;
          if (bottom === 0 && row === 0) {
            box(
              x,
              bottom + fh * 0.43,
              z,
              (len / cols) * 0.86,
              fh * 0.8,
              0.09,
              dark,
              angle,
            );
            continue;
          }
          const n = (i * 13 + row * 7 + col * 11) % 19;
          if (n < 3)
            box(
              x,
              bottom + (row + 0.64) * fh,
              z,
              (len / cols) * 0.72,
              fh * 0.38,
              0.12,
              window,
              angle,
            );
          if (bottom === 0 && row > 0)
            box(
              x,
              bottom + (row + 0.5) * fh,
              z,
              (len / cols) * 0.82,
              fh * 0.68,
              0.09,
              glass,
              angle,
            );
        }
      if (bottom === 0 && podium > 0)
        box(
          mx + nx * 0.1,
          podium - 0.12,
          mz + nz * 0.1,
          len,
          0.3,
          0.3,
          stone,
          angle,
        );
    }
  }
  if (podium > 0) section(lower, 0, podium, stone);
  section(upper, podium, b.height - podium, glass);
  if (inset > 0.1 && podium > 0) {
    for (let i = 1; i < lower.length; i++) {
      const a = lower[i - 1],
        b = lower[i],
        dx = b[0] - a[0],
        dz = b[1] - a[1],
        len = Math.hypot(dx, dz);
      if (len < 1) continue;
      const angle = Math.atan2(-dz, dx);
      box(
        (a[0] + b[0]) / 2,
        podium + 1.05,
        (a[1] + b[1]) / 2,
        len,
        0.06,
        0.06,
        trim,
        angle,
      );
      for (let t = 0; t <= len; t += 2)
        box(
          a[0] + (dx * t) / len,
          podium + 0.5,
          a[1] + (dz * t) / len,
          0.055,
          1,
          0.055,
          trim,
        );
    }
  }
  batchStaticDetail(root);
  root.userData = { buildingId: b.id, photoRecipe: r, approximate: true };
  root.traverse((o) => {
    o.userData.buildingId = b.id;
  });
  return root;
}
export function disposePhotoModel(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>(),
    materials = new Set<THREE.Material>();
  root.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      geometries.add(o.geometry);
      for (const m of Array.isArray(o.material) ? o.material : [o.material])
        materials.add(m);
    }
  });
  geometries.forEach((g) => g.dispose());
  materials.forEach((m) => m.dispose());
}
export async function photoModelGlb(b: Building, recipe: FacadeRecipe) {
  const { GLTFExporter } =
    await import("three/addons/exporters/GLTFExporter.js");
  const root = createPhotoModel(b, recipe);
  try {
    const output = await new GLTFExporter().parseAsync(root, { binary: true });
    return new Blob([output as ArrayBuffer], { type: "model/gltf-binary" });
  } finally {
    disposePhotoModel(root);
  }
}
