import * as THREE from "three";
import type { Building } from "./types";

import { FUNIAN_IDS } from "./landmarks.ts";

function random(seed: number) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
export function surfaceTexture(kind: "paving" | "asphalt") {
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const x = c.getContext("2d")!,
    r = random(kind === "paving" ? 8 : 13);
  x.fillStyle = kind === "paving" ? "#b9b5a9" : "#50565a";
  x.fillRect(0, 0, 512, 512);
  const data = x.getImageData(0, 0, 512, 512);
  for (let i = 0; i < data.data.length; i += 4) {
    const n = (r() - 0.5) * 22;
    for (let j = 0; j < 3; j++) data.data[i + j] += n;
  }
  x.putImageData(data, 0, 0);
  if (kind === "paving") {
    x.lineWidth = 2;
    x.strokeStyle = "#8b8b82";
    for (let y = 0; y <= 512; y += 64) {
      x.beginPath();
      x.moveTo(0, y);
      x.lineTo(512, y);
      x.stroke();
      for (let a = ((y / 64) % 2) * 64; a <= 512; a += 128) {
        x.beginPath();
        x.moveTo(a, y);
        x.lineTo(a, y + 64);
        x.stroke();
      }
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.repeat.set(
    kind === "paving" ? 0.14 : 0.07,
    kind === "paving" ? 0.14 : 0.07,
  );
  return t;
}

export function reflectionEnvironment(renderer: THREE.WebGLRenderer) {
  const canvas = document.createElement("canvas");
  canvas.width = 2048;
  canvas.height = 1024;
  const c = canvas.getContext("2d")!,
    r = random(19);
  const sky = c.createLinearGradient(0, 0, 0, 1024);
  sky.addColorStop(0, "#758f9f");
  sky.addColorStop(0.36, "#c3d3db");
  sky.addColorStop(0.52, "#e2dfd2");
  sky.addColorStop(0.55, "#6d797b");
  sky.addColorStop(1, "#606660");
  c.fillStyle = sky;
  c.fillRect(0, 0, 2048, 1024);
  for (let i = 0; i < 80; i++) {
    const x = r() * 2048,
      w = 12 + r() * 95,
      h = 25 + r() * 180;
    c.fillStyle = `rgb(${75 + r() * 25},${90 + r() * 30},${99 + r() * 30})`;
    c.fillRect(x, 550 - h, w, h);
    c.fillStyle = "rgba(216,228,232,.28)";
    for (let y = 554 - h; y < 542; y += 8) c.fillRect(x + 2, y, w - 4, 1);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  const generator = new THREE.PMREMGenerator(renderer),
    target = generator.fromEquirectangular(texture);
  texture.dispose();
  generator.dispose();
  return target;
}

export function createFunianDetail(b: Building) {
  const root = new THREE.Group();
  root.userData.buildingId = b.id;
  const xs = b.points.map((p) => p[0]),
    zs = b.points.map((p) => p[1]);
  const minX = Math.min(...xs),
    maxX = Math.max(...xs),
    minZ = Math.min(...zs),
    maxZ = Math.max(...zs);
  const width = maxX - minX,
    depth = maxZ - minZ,
    cx = (minX + maxX) / 2,
    cz = (minZ + maxZ) / 2;
  const tower = FUNIAN_IDS.slice(0, 2).includes(b.id),
    apartment = b.id === FUNIAN_IDS[2];
  const frameMat = new THREE.MeshStandardMaterial({
    color: "#202b30",
    roughness: 0.48,
    metalness: 0.72,
  });
  const stoneMat = new THREE.MeshStandardMaterial({
    color: "#424b4c",
    roughness: 0.9,
  });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: "#9caeb6",
    metalness: 0.83,
    roughness: 0.19,
    clearcoat: 1,
    clearcoatRoughness: 0.14,
    envMapIntensity: 1.3,
  });
  const shop = document.createElement("canvas");
  shop.width = shop.height = 256;
  const sc = shop.getContext("2d")!,
    sg = sc.createLinearGradient(0, 0, 256, 256);
  sg.addColorStop(0, "#677975");
  sg.addColorStop(0.45, "#35474b");
  sg.addColorStop(1, "#8e8d78");
  sc.fillStyle = sg;
  sc.fillRect(0, 0, 256, 256);
  sc.fillStyle = "#adb09b";
  sc.fillRect(20, 35, 213, 7);
  sc.fillStyle = "#283c40";
  sc.fillRect(24, 110, 76, 108);
  sc.fillRect(143, 82, 60, 136);
  sc.fillStyle = "rgba(188,177,139,.7)";
  sc.fillRect(28, 59, 70, 48);
  sc.fillRect(147, 39, 53, 38);
  sc.fillStyle = "#202e31";
  sc.fillRect(0, 0, 256, 13);
  sc.fillRect(122, 0, 8, 256);
  sc.fillRect(0, 225, 256, 9);
  sc.fillStyle = "#b5b5a6";
  sc.fillRect(113, 149, 3, 38);
  sc.fillRect(136, 149, 3, 38);
  const shopMap = new THREE.CanvasTexture(shop);
  shopMap.colorSpace = THREE.SRGBColorSpace;
  const shopMat = new THREE.MeshStandardMaterial({
    map: shopMap,
    color: "#a4b9b6",
    metalness: 0.35,
    roughness: 0.32,
    emissive: "#c1a56e",
    emissiveMap: shopMap,
    emissiveIntensity: 0.18,
    side: THREE.DoubleSide,
  });
  const frameParts: { p: number[]; s: number[]; ry: number }[] = [];
  function box(p: number[], s: number[], mat: THREE.Material, ry = 0) {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(...(s as [number, number, number])),
      mat,
    );
    m.position.set(...(p as [number, number, number]));
    m.rotation.y = ry;
    m.castShadow = true;
    m.receiveShadow = true;
    root.add(m);
    return m;
  }
  function beam(p: number[], s: number[], ry = 0) {
    frameParts.push({ p, s, ry });
  }
  // Each actual footprint edge has its own facade UVs. Long walls retain the
  // asymmetric large rectangles seen in the reference, over fine glass grids.
  for (let side = 1; side < b.points.length; side++) {
    const a = b.points[side - 1],
      d = b.points[side],
      dx = d[0] - a[0],
      dz = d[1] - a[1],
      length = Math.hypot(dx, dz);
    if (length < 4) continue;
    const angle = Math.atan2(-dz, dx),
      start = 3.6,
      height = b.height - start;
    const facade = document.createElement("canvas");
    facade.width = 512;
    facade.height = tower ? 2048 : 1024;
    const c = facade.getContext("2d")!,
      rand = random(side * 93 + Math.round(b.height));
    const cols = Math.max(3, Math.round(length / 1.65)),
      rows = Math.max(2, Math.round(height / (tower ? 2.7 : 3.2)));
    const cw = facade.width / cols,
      ch = facade.height / rows;
    c.fillStyle = "#718690";
    c.fillRect(0, 0, facade.width, facade.height);
    for (let row = 0; row < rows; row++)
      for (let col = 0; col < cols; col++) {
        const shade = 120 + rand() * 40 + ((rows - row) / rows) * 40;
        c.fillStyle = `rgb(${shade * 0.83},${shade * 0.95},${shade})`;
        c.fillRect(col * cw + 1, row * ch + 1, cw - 2, ch - 2);
        if (rand() > 0.86) {
          c.fillStyle = "rgba(21,32,38,.7)";
          c.fillRect(
            col * cw + cw * 0.3,
            row * ch + ch * 0.54,
            cw * 0.64,
            ch * 0.4,
          );
        }
        if (rand() > 0.78) {
          c.fillStyle = "rgba(226,219,196,.26)";
          c.fillRect(col * cw + 2, row * ch + 2, cw - 4, ch * 0.3);
        }
      }
    const tex = new THREE.CanvasTexture(facade);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    const material = glassMat.clone();
    material.map = tex;
    const wall = new THREE.Mesh(
      new THREE.PlaneGeometry(length, height),
      material,
    );
    wall.position.set((a[0] + d[0]) / 2, start + height / 2, (a[1] + d[1]) / 2);
    const nx = dz / length,
      nz = -dx / length;
    const outward =
      (wall.position.x - cx) * nx + (wall.position.z - cz) * nz > 0 ? 1 : -1;
    wall.position.x += nx * outward * 0.09;
    wall.position.z += nz * outward * 0.09;
    wall.rotation.y = angle;
    material.side = THREE.DoubleSide;
    wall.receiveShadow = true;
    root.add(wall);
    function frame(u: number, y: number, w: number, h: number) {
      beam([a[0] + dx * u, y, a[1] + dz * u], [w, h, 0.38], angle);
    }
    // Raised black rectangular borders, varied by bay and height.
    if (tower) {
      let y = 12;
      let band = 0;
      while (y < b.height - 1) {
        const h = Math.min([16.2, 21.6, 10.8, 18.9][band % 4], b.height - y);
        frame(0.5, y, length + 0.25, 0.36);
        let u = 0;
        const ratios = band % 2 ? [0.21, 0.39, 0.24, 0.16] : [0.36, 0.22, 0.42];
        for (const ratio of ratios) {
          frame(u, y + h / 2, 0.38, h);
          u += ratio;
        }
        frame(1, y + h / 2, 0.38, h);
        y += h;
        band++;
      }
      frame(0.5, b.height, length + 0.35, 0.65);
    } else if (apartment) {
      for (let y = 4; y < b.height; y += 3.2) frame(0.5, y, length, 0.3);
      for (let u = 0; u <= 1; u += 4 / length)
        frame(u, b.height / 2, 0.24, b.height);
    } else {
      for (let y = 3; y < b.height; y += 3.4) frame(0.5, y, length, 0.3);
    }
    // Ground-floor double-height glazed storefronts and heavy columns.
    frame(0.5, 3.7, length, 0.45);
    for (let u = 0; u < 1; u += 5 / length) {
      frame(u, 1.9, 0.34, 3.8);
      const door = new THREE.Mesh(
        new THREE.PlaneGeometry(Math.min(4.6, length), 3.2),
        shopMat,
      );
      door.position.set(
        a[0] + dx * Math.min(u + 2.5 / length, 1),
        1.95,
        a[1] + dz * Math.min(u + 2.5 / length, 1),
      );
      door.position.x += nx * outward * 0.12;
      door.position.z += nz * outward * 0.12;
      door.rotation.y = angle;
      root.add(door);
    }
  }
  if (tower || apartment) {
    // Recessed mechanical penthouse and perimeter parapets.
    box([cx, b.height + 0.65, cz], [width * 0.9, 1.3, depth * 0.9], stoneMat);
    box([cx, b.height + 2.5, cz], [width * 0.34, 3.2, depth * 0.36], stoneMat);
    for (let n = -1; n <= 1; n++)
      box([cx + n * 5, b.height + 4.3, cz], [3.2, 0.6, 3.2], frameMat);
  }
  if (b.id === FUNIAN_IDS[0]) {
    box([cx, 4.4, maxZ + 2.4], [width * 0.82, 0.5, 5.2], frameMat);
    // Sign is descriptive wayfinding, not a copied texture from a photograph.
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 128;
    const c = canvas.getContext("2d")!;
    c.fillStyle = "#202c30";
    c.fillRect(0, 0, 1024, 128);
    c.fillStyle = "#e8e1cc";
    c.font = "500 56px sans-serif";
    c.textAlign = "center";
    c.fillText("花样年 · 福年广场", 512, 80);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(25, 3.125),
      new THREE.MeshStandardMaterial({
        map: tex,
        roughness: 0.6,
        emissive: "#d6b67a",
        emissiveMap: tex,
        emissiveIntensity: 0.2,
      }),
    );
    sign.position.set(cx, 7, maxZ + 0.25);
    root.add(sign);
    for (const dx of [-width * 0.35, width * 0.35])
      box([cx + dx, 2.15, maxZ + 4], [0.48, 4.3, 0.48], stoneMat);
  }
  const beams = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      frameMat,
      frameParts.length,
    ),
    dummy = new THREE.Object3D();
  frameParts.forEach((v, i) => {
    dummy.position.set(...(v.p as [number, number, number]));
    dummy.scale.set(...(v.s as [number, number, number]));
    dummy.rotation.y = v.ry;
    dummy.updateMatrix();
    beams.setMatrixAt(i, dummy.matrix);
  });
  beams.castShadow = true;
  beams.receiveShadow = true;
  root.add(beams);
  root.traverse((o) => {
    o.userData.buildingId = b.id;
  });
  return root;
}

export function createStreetscape() {
  const group = new THREE.Group();
  const stone = new THREE.MeshStandardMaterial({
    color: "#747871",
    roughness: 0.96,
  });
  const metal = new THREE.MeshStandardMaterial({
    color: "#344044",
    metalness: 0.65,
    roughness: 0.42,
  });
  const timber = new THREE.MeshStandardMaterial({
    color: "#87755c",
    roughness: 0.9,
  });
  function box(
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    m: THREE.Material,
  ) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    b.position.set(x, y, z);
    b.castShadow = true;
    b.receiveShadow = true;
    group.add(b);
    return b;
  }
  // A clear walking corridor remains between both towers; all furniture is
  // illustrative. The hardscape occupies the mapped complex, not other roads.
  const paving = surfaceTexture("paving");
  paving.repeat.set(15, 19);
  box(
    -143,
    0.12,
    -91,
    117,
    0.18,
    133,
    new THREE.MeshStandardMaterial({
      map: paving,
      color: "#d0cfc6",
      roughness: 0.95,
    }),
  );
  const seam = new THREE.MeshStandardMaterial({
    color: "#777c78",
    roughness: 1,
  });
  for (let x = -196; x < -85; x += 12) box(x, 0.23, -92, 0.16, 0.03, 128, seam);
  for (let z = -154; z < -24; z += 12)
    box(-143, 0.235, z, 114, 0.03, 0.16, seam);
  for (const [x, z] of [
    [-187, -88],
    [-122, -105],
    [-188, -102],
    [-98, -65],
    [-96, -48],
    [-188, -23],
    [-111, -24],
  ]) {
    box(x, 0.5, z, 4, 1, 4, stone);
    box(
      x,
      1.05,
      z,
      3.5,
      0.15,
      3.5,
      new THREE.MeshStandardMaterial({ color: "#405847", roughness: 1 }),
    );
    box(x + 3, 0.55, z, 2.7, 0.16, 0.8, timber);
    box(x + 2, 0.28, z, 0.2, 0.55, 0.65, metal);
    box(x + 4, 0.28, z, 0.2, 0.55, 0.65, metal);
  }
  // Bollards protect the frontage. No fixtures lie in the entrance viewpoint.
  for (let x = -176; x < -94; x += 4) {
    const m = new THREE.Mesh(
      new THREE.CylinderGeometry(0.13, 0.16, 0.85, 8),
      metal,
    );
    m.position.set(x, 0.62, -22);
    m.castShadow = true;
    group.add(m);
  }
  const lampMat = new THREE.MeshStandardMaterial({
    color: "#fff0c9",
    emissive: "#ffe1a0",
    emissiveIntensity: 1.3,
  });
  for (const x of [-225, -180, -80, 20, 120, 220])
    for (const z of [-18, 17]) {
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.16, 8.8, 8),
        metal,
      );
      pole.position.set(x, 4.4, z);
      pole.castShadow = true;
      group.add(pole);
      box(x + 1.2, 8.7, z, 2.6, 0.16, 0.18, metal);
      box(x + 2.1, 8.56, z, 1.1, 0.1, 0.4, lampMat);
    }
  // Crossings on Tianfu Third Street; traffic is illustrative, not a live feed.
  const stripe = new THREE.MeshStandardMaterial({
    color: "#deddd0",
    roughness: 1,
  });
  for (const x of [-202, 65])
    for (let z = -10; z < 12; z += 2.5) box(x, 0.32, z, 5, 0.03, 1.15, stripe);
  const cars = new THREE.Group();
  group.add(cars);
  for (const [i, x] of [-265, -210, -40, 44, 177, 270].entries()) {
    const car = new THREE.Group(),
      paint = new THREE.MeshStandardMaterial({
        color: ["#e4e3da", "#45596a", "#666863", "#d9d4c9"][i % 4],
        metalness: 0.55,
        roughness: 0.3,
      });
    const body = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.75, 1.85), paint);
    body.position.y = 0.65;
    body.castShadow = true;
    car.add(body);
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(2.35, 0.65, 1.6),
      new THREE.MeshStandardMaterial({
        color: "#243c48",
        metalness: 0.75,
        roughness: 0.16,
      }),
    );
    cabin.position.set(-0.1, 1.32, 0);
    car.add(cabin);
    for (const a of [-1.4, 1.4])
      for (const z of [-0.9, 0.9]) {
        const tire = new THREE.Mesh(
          new THREE.CylinderGeometry(0.34, 0.34, 0.2, 12),
          new THREE.MeshStandardMaterial({ color: "#222627", roughness: 0.9 }),
        );
        tire.rotation.x = Math.PI / 2;
        tire.position.set(a, 0.43, z);
        car.add(tire);
      }
    car.position.set(x, 0.05, i % 2 ? -4 : 7);
    cars.add(car);
  }
  return group;
}

export function skyTexture(night = false) {
  const canvas = document.createElement("canvas");
  canvas.width = 2048;
  canvas.height = 1024;
  const c = canvas.getContext("2d")!,
    r = random(58),
    g = c.createLinearGradient(0, 0, 0, 1024);
  g.addColorStop(0, night ? "#152a40" : "#789cae");
  g.addColorStop(0.46, night ? "#7b858c" : "#d2dfe2");
  g.addColorStop(0.58, night ? "#4e5861" : "#d9dfdb");
  g.addColorStop(1, night ? "#303e45" : "#d9dfdb");
  c.fillStyle = g;
  c.fillRect(0, 0, 2048, 1024);
  for (let i = 0; i < 110; i++) {
    const x = r() * 2048,
      y = 160 + r() * 295,
      rad = 30 + r() * 110;
    const cloud = c.createRadialGradient(x, y, 0, x, y, rad);
    cloud.addColorStop(
      0,
      night ? "rgba(223,195,175,.07)" : "rgba(250,249,238,.16)",
    );
    cloud.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = cloud;
    c.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  const t = new THREE.CanvasTexture(canvas);
  t.mapping = THREE.EquirectangularReflectionMapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function foliageTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const c = canvas.getContext("2d")!,
    r = random(778);
  // Alpha-cut leaf clusters give a porous crown instead of opaque green balls.
  for (let i = 0; i < 130; i++) {
    const a = r() * Math.PI * 2,
      rad = Math.sqrt(r()) * 106,
      x = 128 + Math.cos(a) * rad,
      y = 128 + Math.sin(a) * rad;
    c.save();
    c.translate(x, y);
    c.rotate(a);
    c.fillStyle = ["#8b9d73", "#6d8456", "#9da982", "#577549"][i % 4];
    c.beginPath();
    c.ellipse(0, 0, 5 + r() * 5, 3 + r() * 3, 0, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
