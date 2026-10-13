import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

// Human-scale, illustrative street furniture. Kept separate from source map data.
export function detailedFurniture() {
  const root = new THREE.Group();
  const stone = new THREE.MeshStandardMaterial({
    color: "#92948b",
    roughness: 0.88,
  });
  const metal = new THREE.MeshStandardMaterial({
    color: "#343b39",
    roughness: 0.5,
    metalness: 0.65,
  });
  const wood = new THREE.MeshStandardMaterial({
    color: "#8d6e4d",
    roughness: 0.82,
  });
  const soil = new THREE.MeshStandardMaterial({
    color: "#343c29",
    roughness: 1,
  });
  const parts = new Map<
    THREE.Material,
    { p: number[]; s: number[]; ry: number }[]
  >();
  function box(p: number[], s: number[], m: THREE.Material, ry = 0) {
    if (!parts.has(m)) parts.set(m, []);
    parts.get(m)!.push({ p, s, ry });
  }
  function plaque(
    text: string,
    width: number,
    height: number,
    position: number[],
    ry = 0,
  ) {
    const c = document.createElement("canvas");
    c.width = 1024;
    c.height = 512;
    const x = c.getContext("2d")!;
    x.fillStyle = "#35413e";
    x.fillRect(0, 0, 1024, 512);
    x.fillStyle = "#e7e3d8";
    x.font = "500 66px sans-serif";
    x.textAlign = "center";
    text.split("\n").forEach((line, i) => x.fillText(line, 512, 135 + i * 95));
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height),
      new THREE.MeshStandardMaterial({ map: t, roughness: 0.65 }),
    );
    m.position.set(...(position as [number, number, number]));
    m.rotation.y = ry;
    root.add(m);
  }
  // Low coping stones, inset soil and slatted seating replace solid green boxes.
  for (const [x, z] of [
    [-187, -88],
    [-122, -105],
    [-188, -102],
    [-98, -65],
    [-96, -48],
    [-188, -23],
    [-111, -24],
  ]) {
    for (const dz of [-1.9, 1.9])
      box([x, 0.43, z + dz], [4.1, 0.66, 0.22], stone);
    for (const dx of [-1.9, 1.9])
      box([x + dx, 0.43, z], [0.22, 0.66, 3.6], stone);
    box([x, 0.16, z], [3.7, 0.12, 3.7], soil);
    for (const dz of [-1.91, 1.91])
      box([x, 0.8, z + dz], [4.2, 0.1, 0.32], stone);
    for (let j = 0; j < 7; j++)
      box([x + 3, 0.58, z - 0.42 + j * 0.14], [2.8, 0.055, 0.105], wood);
    for (const dx of [2, 4]) {
      box([x + dx, 0.3, z], [0.08, 0.56, 0.8], metal);
      box([x + dx, 0.89, z + 0.5], [0.06, 0.66, 0.06], metal);
    }
    for (let j = 0; j < 3; j++)
      box([x + 3, 0.8 + j * 0.14, z + 0.53], [2.8, 0.1, 0.055], wood);
    // Small planted tufts around the tree, rather than a solid green slab.
    for (let i = 0; i < 44; i++) {
      const a = i * 2.399,
        r = 0.7 + (i % 7) * 0.15;
      box(
        [x + Math.cos(a) * r, 0.34 + (i % 3) * 0.035, z + Math.sin(a) * r],
        [0.025, 0.34 + (i % 5) * 0.04, 0.07],
        soil,
        a,
      );
    }
  }
  // Drainage channels and flush grates, away from the central walking corridor.
  const grate = new THREE.MeshStandardMaterial({
    color: "#424946",
    roughness: 0.9,
    metalness: 0.45,
  });
  for (const z of [-78, -109]) {
    box([-149, 0.245, z], [72, 0.015, 0.28], grate);
    for (let x = -184; x < -113; x += 0.24)
      box([x, 0.26, z], [0.045, 0.015, 0.26], stone);
  }
  for (const [x, z] of [
    [-181, -83],
    [-125, -111],
    [-182, -28],
  ]) {
    const bin = new THREE.Mesh(
      new RoundedBoxGeometry(0.65, 0.95, 0.52, 2, 0.035),
      metal,
    );
    bin.position.set(x, 0.6, z);
    bin.castShadow = true;
    root.add(bin);
    box([x, 0.92, z + 0.27], [0.45, 0.2, 0.012], soil);
    plaque("可回收物", 0.45, 0.18, [x, 0.66, z + 0.278]);
  }
  box([-192, 1.2, -77], [0.13, 2.4, 1.3], metal);
  plaque(
    "福年广场\n步行内院  →\nCOURTYARD",
    1.2,
    1.85,
    [-192.075, 1.37, -77],
    -Math.PI / 2,
  );
  // Courtyard cafe seating: illustrative furniture, not a claimed current tenant.
  for (const [x, z] of [
    [-126, -95],
    [-131, -103],
    [-135, -101],
  ]) {
    const table = new THREE.Mesh(
      new THREE.CylinderGeometry(0.52, 0.52, 0.045, 24),
      wood,
    );
    table.position.set(x, 0.92, z);
    table.castShadow = true;
    root.add(table);
    box([x, 0.52, z], [0.08, 0.78, 0.08], metal);
    box([x, 0.16, z], [0.65, 0.05, 0.65], metal);
    for (const side of [-1, 1]) {
      box([x + side * 0.92, 0.53, z], [0.43, 0.065, 0.44], wood);
      for (const a of [-0.17, 0.17])
        for (const b of [-0.17, 0.17])
          box([x + side * 0.92 + a, 0.31, z + b], [0.035, 0.43, 0.035], metal);
      box([x + side * 1.12, 0.76, z], [0.04, 0.48, 0.43], wood);
    }
  }
  for (const [mat, items] of parts) {
    const inst = new THREE.InstancedMesh(
        new RoundedBoxGeometry(1, 1, 1, 1, 0.035),
        mat,
        items.length,
      ),
      d = new THREE.Object3D();
    items.forEach((v, i) => {
      d.position.set(...(v.p as [number, number, number]));
      d.scale.set(...(v.s as [number, number, number]));
      d.rotation.y = v.ry;
      d.updateMatrix();
      inst.setMatrixAt(i, d.matrix);
    });
    inst.castShadow = true;
    inst.receiveShadow = true;
    root.add(inst);
  }
  return root;
}

export function storefrontBay(width: number, variant: number) {
  const root = new THREE.Group();
  const frame = new THREE.MeshStandardMaterial({
    color: "#394341",
    metalness: 0.75,
    roughness: 0.32,
  });
  const plaster = new THREE.MeshStandardMaterial({
    color: variant % 2 ? "#9c9584" : "#b4aa92",
    roughness: 0.94,
  });
  const timber = new THREE.MeshStandardMaterial({
    color: "#745840",
    roughness: 0.82,
  });
  const glass = new THREE.MeshPhysicalMaterial({
    color: "#c4d2cf",
    metalness: 0.2,
    roughness: 0.08,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const brass = new THREE.MeshStandardMaterial({
    color: "#b7ae90",
    metalness: 0.85,
    roughness: 0.25,
  });
  function box(
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    mat: THREE.Material,
  ) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    root.add(m);
    return m;
  }
  // +z is outside. A shallow real alcove allows actual parallax behind glazing.
  box(0, 1.7, 0.02, width, 3.4, 0.05, plaster);
  box(0, 0.29, 0.65, width, 0.1, 1.3, plaster);
  box(0, 3.45, 0.65, width, 0.16, 1.3, frame);
  for (const x of [-width / 2, width / 2])
    box(x, 1.85, 0.66, 0.13, 3.2, 1.3, frame);
  for (let x = -width / 2; x <= width / 2 + 0.01; x += width / 4)
    box(x, 1.86, 1.3, 0.045, 3.1, 0.07, frame);
  box(0, 3.14, 1.3, width, 0.05, 0.07, frame);
  box(0, 0.42, 1.3, width, 0.05, 0.07, frame);
  box(0, 1.95, 1.34, width - 0.15, 2.95, 0.025, glass);
  // Real pull handles and brackets are visible when standing at the door.
  for (const x of [-0.12, 0.12]) {
    const h = new THREE.Mesh(
      new THREE.CylinderGeometry(0.016, 0.016, 0.58, 8),
      brass,
    );
    h.position.set(x, 1.42, 1.42);
    root.add(h);
    for (const y of [1.18, 1.66]) box(x, y, 1.37, 0.025, 0.025, 0.13, brass);
  }
  // Window-side counter, fine shelves and warm ceiling strips.
  box(-width * 0.25, 0.91, 0.53, width * 0.35, 0.12, 0.55, timber);
  for (let y = 1.15; y < 2.5; y += 0.42) {
    box(width * 0.27, y, 0.22, width * 0.31, 0.045, 0.32, timber);
    for (let j = 0; j < 4; j++)
      box(
        width * 0.14 + j * 0.17,
        y + 0.12,
        0.21,
        0.11,
        0.18,
        0.12,
        variant % 2 ? plaster : timber,
      );
  }
  const glow = new THREE.MeshStandardMaterial({
    color: "#fff2d5",
    emissive: "#ffddaa",
    emissiveIntensity: 0.7,
  });
  box(0, 3.33, 0.6, width * 0.78, 0.025, 0.065, glow);
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 64;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = variant % 2 ? "#544b41" : "#3f4946";
  ctx.fillRect(0, 0, 512, 64);
  ctx.font = "24px sans-serif";
  ctx.textAlign = "center";
  ctx.fillStyle = "#d4d0bf";
  ctx.fillText(
    ["内 院 入 口", "休 憩 空 间", "步 行 连 廊", "商 业 空 间"][variant % 4],
    256,
    41,
  );
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.userData.batchKey = "shop-sign-" + (variant % 4);
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(width - 0.2, 0.43),
    new THREE.MeshStandardMaterial({ map: t, roughness: 0.7 }),
  );
  sign.position.set(0, 3.78, 1.31);
  root.add(sign);
  return root;
}

// Merge repeated facade fixtures into material batches, keeping close-up detail
// without thousands of individual draw calls on phones.
export function batchStaticDetail(root: THREE.Group) {
  root.updateMatrixWorld(true);
  const batches = new Map<
    string,
    { material: THREE.Material; geometry: THREE.BufferGeometry[] }
  >();
  const original: THREE.Mesh[] = [];
  root.traverse((o) => {
    if (
      !(o instanceof THREE.Mesh) ||
      o instanceof THREE.InstancedMesh ||
      Array.isArray(o.material)
    )
      return;
    const m = o.material as THREE.MeshStandardMaterial;
    const key = JSON.stringify([
      m.type,
      m.color?.getHex(),
      m.roughness,
      m.metalness,
      m.transparent,
      m.opacity,
      m.side,
      m.emissive?.getHex(),
      m.emissiveIntensity,
      m.map?.userData.batchKey ?? m.map?.uuid,
      m.normalMap?.uuid,
    ]);
    if (!batches.has(key)) batches.set(key, { material: m, geometry: [] });
    const g = o.geometry.clone().applyMatrix4(o.matrixWorld);
    batches.get(key)!.geometry.push(g.index ? g.toNonIndexed() : g);
    if (g.index) g.dispose();
    original.push(o);
  });
  original.forEach((o) => {
    o.removeFromParent();
    o.geometry.dispose();
  });
  for (const { material, geometry } of batches.values()) {
    const merged = mergeGeometries(geometry, false);
    geometry.forEach((g) => g.dispose());
    if (!merged) throw new Error("无法合并建筑细节");
    const mesh = new THREE.Mesh(merged, material);
    mesh.castShadow = !material.transparent;
    mesh.receiveShadow = true;
    root.add(mesh);
  }
  const retained = new Set([...batches.values()].map((x) => x.material));
  original.forEach((o) => {
    if (!retained.has(o.material as THREE.Material))
      (o.material as THREE.Material).dispose();
  });
}
