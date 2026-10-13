import * as THREE from "three";
import { FUNIAN_TERRACE } from "./landmarks.ts";

// The user located this fourth-floor terrace on the existing eastern podium.
// Extents and floor elevation remain approximate; no invented tenant fit-out.
export function createFunianTerrace() {
  const root = new THREE.Group();
  const y = FUNIAN_TERRACE.floorHeight;
  const points = FUNIAN_TERRACE.points;
  const metal = new THREE.MeshStandardMaterial({
    color: "#394749",
    metalness: 0.7,
    roughness: 0.35,
  });
  const stone = new THREE.MeshStandardMaterial({
    color: "#aaa89b",
    roughness: 0.85,
  });
  const glass = new THREE.MeshPhysicalMaterial({
    color: "#b7d2ce",
    transparent: true,
    opacity: 0.34,
    roughness: 0.15,
    metalness: 0.2,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  function box(
    x: number,
    h: number,
    z: number,
    w: number,
    d: number,
    l: number,
    mat: THREE.Material,
    angle = 0,
  ) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, d, l), mat);
    mesh.position.set(x, h, z);
    mesh.rotation.y = angle;
    mesh.castShadow = !mat.transparent;
    mesh.receiveShadow = true;
    root.add(mesh);
    return mesh;
  }
  const shape = new THREE.Shape(
    points.map((p) => new THREE.Vector2(p[0], -p[1])),
  );
  const slab = new THREE.ExtrudeGeometry(shape, {
    depth: 0.22,
    bevelEnabled: false,
  });
  slab.rotateX(-Math.PI / 2);
  const deck = new THREE.Mesh(slab, stone);
  deck.position.y = y - 0.22;
  deck.receiveShadow = true;
  root.add(deck);
  // A visible roof-edge fascia distinguishes the terrace from a plain flat roof.
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i],
      b = points[i + 1],
      dx = b[0] - a[0],
      dz = b[1] - a[1],
      len = Math.hypot(dx, dz),
      angle = Math.atan2(-dz, dx);
    // The final edge abuts the tower: leave the access side open.
    if (i === points.length - 2) continue;
    const cx = (a[0] + b[0]) / 2,
      cz = (a[1] + b[1]) / 2;
    box(cx, y - 0.18, cz, len, 0.44, 0.3, stone, angle);
    box(cx, y + 0.1, cz, len, 0.2, 0.24, metal, angle);
    box(cx, y + 1.12, cz, len, 0.065, 0.075, metal, angle);
    const bays = Math.ceil(len / 1.8);
    for (let j = 0; j <= bays; j++) {
      const u = j / bays;
      box(a[0] + dx * u, y + 0.6, a[1] + dz * u, 0.065, 1.12, 0.065, metal);
      if (j < bays) {
        const t = (j + 0.5) / bays;
        box(
          a[0] + dx * t,
          y + 0.63,
          a[1] + dz * t,
          len / bays - 0.1,
          0.91,
          0.024,
          glass,
          angle,
        );
      }
    }
  }
  // Restrained paving joints; no furniture or vegetation claimed without evidence.
  const joint = new THREE.MeshStandardMaterial({
    color: "#83867e",
    roughness: 1,
  });
  for (let x = -118; x < -90; x += 1.2)
    box(x, y + 0.006, -51.8, 0.014, 0.012, 32.6, joint);
  for (let z = -67.8; z < -35.4; z += 1.2)
    box(-104.2, y + 0.009, z, 27.6, 0.014, 0.014, joint);
  // Schematic access door against the T1 east facade, level with the deck.
  box(-119.05, y + 1.25, -51.8, 0.25, 2.5, 2.3, metal);
  box(-118.9, y + 1.26, -51.8, 0.04, 2.2, 2.04, glass);
  box(-118.86, y + 1.25, -51.8, 0.07, 2.4, 0.055, metal);
  for (const z of [-51.64, -51.96])
    box(-118.79, y + 1.08, z, 0.08, 0.48, 0.045, metal);
  return root;
}
