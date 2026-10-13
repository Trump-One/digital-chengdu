import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { Street, SceneOptions, SceneApi, Building } from "./types";
import {
  createFunianDetail,
  createStreetscape,
  surfaceTexture,
  reflectionEnvironment,
  skyTexture,
  foliageTexture,
} from "./funian.ts";
import { createPhotoModel } from "./photo-model.ts";
import { PHOTO_BUILDING_IDS, referenceRecipe } from "./photo-recipe.ts";
import { FUNIAN_TERRACE, FUNIAN_VIEWS } from "./landmarks.ts";
export function inside(x: number, z: number, points: number[][]) {
  let yes = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, zi] = points[i],
      [xj, zj] = points[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi)
      yes = !yes;
  }
  return yes;
}
export function createScene(
  host: HTMLElement,
  street: Street,
  onSelect: (id: string) => void,
  onStatus: (message: string) => void,
): SceneApi {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#c6d5dc");
  scene.fog = new THREE.Fog("#c6d5dc", 600, 1800);
  const camera = new THREE.PerspectiveCamera(43, 1, 0.2, 2500);
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const environment = reflectionEnvironment(renderer);
  scene.environment = environment.texture;
  const daySky = skyTexture(),
    duskSky = skyTexture(true);
  scene.background = daySky;
  host.appendChild(renderer.domElement);
  renderer.domElement.setAttribute(
    "aria-label",
    "天府三街三维场景，拖动旋转，滚轮缩放；步行模式可使用方向键移动",
  );
  renderer.domElement.tabIndex = 0;
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.075;
  controls.maxPolarAngle = Math.PI * 0.48;
  controls.minDistance = 35;
  controls.maxDistance = 1100;
  controls.target.set(0, 12, 0);
  const ambient = new THREE.HemisphereLight("#f4f8ff", "#8a877a", 1.7);
  scene.add(ambient);
  const sun = new THREE.DirectionalLight("#fff1d9", 2.7);
  sun.position.set(-310, 490, 310);
  sun.castShadow = true;
  const shadowSize = window.matchMedia("(max-width: 600px)").matches
    ? 2048
    : 4096;
  sun.shadow.mapSize.set(shadowSize, shadowSize);
  sun.target.position.set(-145, 0, -90);
  scene.add(sun.target);
  sun.shadow.camera.left = -180;
  sun.shadow.camera.right = 180;
  sun.shadow.camera.top = 180;
  sun.shadow.camera.bottom = -180;
  sun.shadow.camera.far = 1200;
  sun.shadow.normalBias = 0.035;
  sun.shadow.bias = -0.000025;
  scene.add(sun);
  const meshes: THREE.Mesh[] = [];
  const detailGroups = new Map<string, THREE.Group>();
  const streetscape = createStreetscape();
  scene.add(streetscape);
  const buildingGroup = new THREE.Group(),
    treeGroup = new THREE.Group(),
    labelGroup = new THREE.Group(),
    previewGroup = new THREE.Group();
  scene.add(buildingGroup, treeGroup, labelGroup, previewGroup);
  const ground = new THREE.Mesh(
    new THREE.BoxGeometry(1500, 5, 1250),
    new THREE.MeshStandardMaterial({ color: "#dce1d8", roughness: 1 }),
  );
  ground.position.y = -2.6;
  ground.receiveShadow = true;
  scene.add(ground);
  const bound = new THREE.Mesh(
    new THREE.BoxGeometry(650, 0.14, 520),
    new THREE.MeshStandardMaterial({ color: "#eeeae0", roughness: 1 }),
  );
  bound.receiveShadow = true;
  scene.add(bound);
  function polygon(points: number[][], color: string, y: number) {
    const shape = new THREE.Shape(
      points.map((p) => new THREE.Vector2(p[0], -p[1])),
    );
    const mesh = new THREE.Mesh(
      new THREE.ShapeGeometry(shape),
      new THREE.MeshStandardMaterial({
        color,
        roughness: 1,
        side: THREE.DoubleSide,
      }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = y;
    mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh;
  }
  street.greens.forEach((g) => polygon(g.points, "#c2d0b3", 0.1));
  const asphalt = surfaceTexture("asphalt"),
    paving = surfaceTexture("paving");
  const roadMaterial = new THREE.MeshStandardMaterial({
    color: "#92999b",
    map: asphalt,
    bumpMap: asphalt,
    bumpScale: 0.06,
    roughness: 1,
  });
  const sidewalkMaterial = new THREE.MeshStandardMaterial({
    color: "#eeeade",
    map: paving,
    bumpMap: paving,
    bumpScale: 0.045,
    roughness: 1,
  });
  const stripeMaterial = new THREE.MeshBasicMaterial({ color: "#d4d5c5" });
  function segment(
    a: number[],
    b: number[],
    width: number,
    y: number,
    material: THREE.Material,
  ) {
    const dx = b[0] - a[0],
      dz = b[1] - a[1],
      length = Math.hypot(dx, dz);
    if (length < 0.1) return;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(width, 0.08, length),
      material,
    );
    mesh.position.set((a[0] + b[0]) / 2, y, (a[1] + b[1]) / 2);
    const uv = mesh.geometry.getAttribute("uv");
    for (let i = 0; i < uv.count; i++)
      uv.setXY(i, uv.getX(i) * width, uv.getY(i) * length);
    mesh.rotation.y = Math.atan2(dx, dz);
    mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh;
  }
  street.roads.forEach((r) => {
    for (let i = 1; i < r.points.length; i++) {
      const a = r.points[i - 1],
        b = r.points[i];
      segment(a, b, r.width + 5, 0.15, sidewalkMaterial);
    }
  });
  street.roads.forEach((r, ri) => {
    for (let i = 1; i < r.points.length; i++) {
      const a = r.points[i - 1],
        b = r.points[i];
      segment(
        a,
        b,
        r.width,
        0.22 + ri * 0.0005,
        r.width <= 2.5 ? sidewalkMaterial : roadMaterial,
      );
      if (r.width > 5) {
        const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
        for (let t = 5; t < length - 4; t += 11) {
          const p = [
              a[0] + ((b[0] - a[0]) * t) / length,
              a[1] + ((b[1] - a[1]) * t) / length,
            ],
            q = [
              a[0] + ((b[0] - a[0]) * (t + 4)) / length,
              a[1] + ((b[1] - a[1]) * (t + 4)) / length,
            ];
          segment(p, q, 0.15, 0.29, stripeMaterial);
        }
      }
    }
  });
  const facade = document.createElement("canvas");
  facade.width = 128;
  facade.height = 128;
  const ctx = facade.getContext("2d")!;
  ctx.fillStyle = "#b9c6ca";
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = "#768f9c";
  ctx.fillRect(7, 8, 49, 106);
  ctx.fillStyle = "#91a6b0";
  ctx.fillRect(68, 8, 49, 106);
  ctx.fillStyle = "#d5dddd";
  ctx.fillRect(0, 117, 128, 11);
  ctx.fillRect(0, 0, 5, 128);
  const facadeMap = new THREE.CanvasTexture(facade);
  facadeMap.wrapS = facadeMap.wrapT = THREE.RepeatWrapping;
  facadeMap.repeat.set(0.18, 0.24);
  facadeMap.colorSpace = THREE.SRGBColorSpace;
  facadeMap.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const roof = new THREE.MeshStandardMaterial({
    color: "#dde1df",
    roughness: 0.85,
  });
  street.buildings.forEach((b, i) => {
    const shape = new THREE.Shape(
      b.points.map((p) => new THREE.Vector2(p[0], -p[1])),
    );
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: b.height,
      bevelEnabled: false,
      steps: 1,
    });
    geometry.rotateX(-Math.PI / 2);
    const wall = new THREE.MeshStandardMaterial({
      color: b.landmark ? "#586a73" : i % 4 === 0 ? "#aeb9bb" : "#c1c8c7",
      map: b.landmark ? null : facadeMap,
      roughness: 0.68,
      metalness: 0.18,
    });
    const mesh = new THREE.Mesh(geometry, [roof, wall]);
    mesh.position.y = 0.28;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.buildingId = b.id;
    buildingGroup.add(mesh);
    meshes.push(mesh);
    if (PHOTO_BUILDING_IDS.includes(b.id)) {
      const detailed = createPhotoModel(b, referenceRecipe(b.id));
      detailed.position.set(
        (Math.min(...b.points.map((p) => p[0])) +
          Math.max(...b.points.map((p) => p[0]))) /
          2,
        0.28,
        (Math.min(...b.points.map((p) => p[1])) +
          Math.max(...b.points.map((p) => p[1]))) /
          2,
      );
      mesh.visible = false;
      mesh.userData.photoBase = true;
      buildingGroup.add(detailed);
      detailGroups.set(b.id, detailed);
    }
    if (b.landmark) {
      const detail = createFunianDetail(b);
      buildingGroup.add(detail);
      detailGroups.set(b.id, detail);
    }
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(geometry, 30),
      new THREE.LineBasicMaterial({
        color: "#74868a",
        transparent: true,
        opacity: 0.24,
      }),
    );
    edges.position.y = 0.3;
    if (!b.landmark) buildingGroup.add(edges);
    else {
      edges.geometry.dispose();
      edges.material.dispose();
    }
    if (b.name && !b.name.startsWith("未命名") && b.height > 20) {
      const canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = 92;
      const c = canvas.getContext("2d")!;
      c.fillStyle = "rgba(250,252,249,.94)";
      c.beginPath();
      c.roundRect(0, 0, 512, 92, 18);
      c.fill();
      c.fillStyle = "#314a45";
      c.font = "500 32px sans-serif";
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillText(
        b.landmark
          ? b.name.replace("花样年福年广场 · ", "福年广场 · ")
          : b.name.length > 12
            ? b.name.slice(0, 12) + "…"
            : b.name,
        256,
        46,
      );
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: tex,
          depthTest: false,
          transparent: true,
          sizeAttenuation: false,
        }),
      );
      sprite.position.set(b.center[0], b.height + 14, b.center[1]);
      sprite.scale.set(0.17, 0.0306, 1);
      labelGroup.add(sprite);
    }
  });
  const treePositions: number[][] = [
    [-187, -88],
    [-122, -105],
    [-188, -102],
    [-98, -65],
    [-96, -48],
    [-188, -23],
    [-111, -24],
  ];
  street.roads
    .filter((r) => r.name === "天府三街")
    .forEach((r) => {
      for (let i = 1; i < r.points.length; i++) {
        const a = r.points[i - 1],
          b = r.points[i];
        const dx = b[0] - a[0],
          dz = b[1] - a[1],
          length = Math.hypot(dx, dz);
        for (let t = 9; t < length; t += 24) {
          for (const side of [-1, 1]) {
            const x =
                a[0] +
                (dx * t) / length -
                (dz / length) * (r.width / 2 + 4) * side,
              z =
                a[1] +
                (dz * t) / length +
                (dx / length) * (r.width / 2 + 4) * side;
            if (
              Math.abs(x) < 310 &&
              Math.abs(z) < 240 &&
              !street.buildings.some((v) => inside(x, z, v.points)) &&
              !treePositions.some((p) => Math.hypot(p[0] - x, p[1] - z) < 9)
            )
              treePositions.push([x, z]);
          }
        }
      }
    });
  const crownCount = 48;
  const foliage = foliageTexture();
  const leaves = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(2.4, 2.4),
    new THREE.MeshStandardMaterial({
      map: foliage,
      alphaTest: 0.4,
      side: THREE.DoubleSide,
      roughness: 1,
      color: "#b1bc9c",
    }),
    treePositions.length * crownCount,
  );
  const trunks = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.12, 0.26, 5, 12),
    new THREE.MeshStandardMaterial({ color: "#6c6453", roughness: 1 }),
    treePositions.length,
  );
  const dummy = new THREE.Object3D();
  treePositions.forEach(([x, z], i) => {
    for (let n = 0; n < crownCount; n++) {
      const a = n * 2.39996 + i,
        vertical = 1 - (2 * (n + 0.5)) / crownCount,
        radius =
          Math.sqrt(1 - vertical * vertical) *
          (2.3 + Math.sin(n * 3 + i) * 0.4);
      dummy.position.set(
        x + Math.cos(a) * radius,
        6.1 + vertical * (2.1 + (i % 3) * 0.18) + Math.sin(n * 7 + i) * 0.27,
        z + Math.sin(a) * radius,
      );
      dummy.scale.setScalar(0.9 + (n % 4) * 0.13);
      dummy.rotation.set(n * 0.37, n * 0.7, n * 0.21);
      dummy.updateMatrix();
      leaves.setMatrixAt(i * crownCount + n, dummy.matrix);
      leaves.setColorAt(
        i * crownCount + n,
        new THREE.Color().setHSL(
          0.17 + (n % 3) * 0.015,
          0.12,
          0.63 + (i % 4) * 0.07,
        ),
      );
    }
    dummy.position.set(x, 2.5, z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    trunks.setMatrixAt(i, dummy.matrix);
  });
  const branches = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.055, 0.12, 3, 6),
    new THREE.MeshStandardMaterial({ color: "#706857", roughness: 1 }),
    treePositions.length * 4,
  );
  treePositions.forEach(([x, z], i) => {
    for (let n = 0; n < 4; n++) {
      const a = (n * Math.PI) / 2 + i;
      dummy.position.set(x + Math.cos(a) * 0.6, 4.3, z + Math.sin(a) * 0.6);
      dummy.scale.set(1, 1, 1);
      dummy.rotation.set(Math.sin(a) * 0.5, 0, Math.cos(a) * 0.5);
      dummy.updateMatrix();
      branches.setMatrixAt(i * 4 + n, dummy.matrix);
    }
  });
  branches.castShadow = true;
  treeGroup.add(branches);
  leaves.castShadow = true;
  leaves.receiveShadow = true;
  trunks.castShadow = true;
  treeGroup.add(leaves, trunks);
  const routeMaterial = new THREE.LineDashedMaterial({
    color: "#2e9277",
    dashSize: 4,
    gapSize: 3,
    linewidth: 2,
  });
  const route = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(
      street.route.map((p) => new THREE.Vector3(p[0], 0.42, p[1])),
    ),
    routeMaterial,
  );
  route.computeLineDistances();
  scene.add(route);
  const marker = new THREE.Mesh(
    new THREE.RingGeometry(3, 4, 40),
    new THREE.MeshBasicMaterial({ color: "#2b8267", side: THREE.DoubleSide }),
  );
  marker.rotation.x = -Math.PI / 2;
  marker.position.set(street.route[0][0], 0.5, street.route[0][1]);
  scene.add(marker);
  const selection = new THREE.Box3Helper(
    new THREE.Box3(),
    new THREE.Color("#246b59"),
  );
  selection.visible = false;
  scene.add(selection);
  let options: SceneOptions = {
    mode: "overview",
    trees: true,
    labels: true,
    buildings: true,
    night: false,
    community: true,
    selected: null,
    preview: null,
  };
  let yaw = Math.PI / 2,
    pitch = 0;
  let disposed = false,
    animation = 0,
    prev = performance.now();
  const keys = new Set<string>();
  let drag: { x: number; y: number; startX: number; startY: number } | null =
    null;
  let fly: {
    from: THREE.Vector3;
    to: THREE.Vector3;
    targetFrom: THREE.Vector3;
    targetTo: THREE.Vector3;
    start: number;
  } | null = null;
  let scannedSky: THREE.DataTexture | null = null;
  let scannedEnvironment: THREE.WebGLRenderTarget | null = null;
  new HDRLoader().load(
    "/materials/overcast-sky.hdr",
    (texture) => {
      if (disposed) {
        texture.dispose();
        return;
      }
      texture.mapping = THREE.EquirectangularReflectionMapping;
      const pmrem = new THREE.PMREMGenerator(renderer);
      scannedEnvironment = pmrem.fromEquirectangular(texture);
      pmrem.dispose();
      scannedSky = texture;
      scene.environment = scannedEnvironment.texture;
      scene.environmentIntensity = options.night ? 0.32 : 1.05;
      if (!options.night) scene.background = scannedSky;
    },
    undefined,
    () => onStatus("天空光照素材暂未载入，已使用备用光照"),
  );
  let previewId: string | null = null;
  let modelSequence = 0;
  const homePosition = new THREE.Vector3(-360, 205, 125),
    homeTarget = new THREE.Vector3(-143, 57, -90);
  camera.position.copy(homePosition);
  controls.target.copy(homeTarget);
  controls.update();
  function travel(to: THREE.Vector3, target: THREE.Vector3) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      camera.position.copy(to);
      controls.target.copy(target);
      controls.update();
      return;
    }
    fly = {
      from: camera.position.clone(),
      to,
      targetFrom: controls.target.clone(),
      targetTo: target,
      start: performance.now(),
    };
  }
  function clearPreview() {
    modelSequence++;
    previewGroup.children.slice().forEach((child) => {
      previewGroup.remove(child);
      child.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          for (const m of Array.isArray(o.material)
            ? o.material
            : [o.material]) {
            for (const value of Object.values(m))
              if (value instanceof THREE.Texture) value.dispose();
            m.dispose();
          }
        }
      });
    });
    meshes.forEach((m) => (m.visible = !m.userData.photoBase));
    detailGroups.forEach((g) => (g.visible = true));
  }
  async function showPreview() {
    const p = options.preview;
    if (p?.id === previewId) return;
    previewId = p?.id || null;
    clearPreview();
    if (!p) return;
    const b = street.buildings.find((v) => v.id === p.buildingId);
    if (!b) return;
    if (p.kind === "height" && p.height) {
      const shape = new THREE.Shape(
        b.points.map((v) => new THREE.Vector2(v[0], -v[1])),
      );
      const g = new THREE.ExtrudeGeometry(shape, {
        depth: p.height,
        bevelEnabled: false,
      });
      g.rotateX(-Math.PI / 2);
      const m = new THREE.Mesh(
        g,
        new THREE.MeshStandardMaterial({
          color: "#3d9f87",
          transparent: true,
          opacity: 0.72,
        }),
      );
      previewGroup.add(m);
      const base = meshes.find((m) => m.userData.buildingId === b.id)!;
      base.visible = !options.community && !base.userData.photoBase;
    }
    if (p.kind === "height" && options.community) {
      const detail = detailGroups.get(b.id);
      if (detail) detail.visible = false;
    }
    if (p.kind === "model" && p.assetUrl) {
      const seq = modelSequence;
      try {
        const model = await new GLTFLoader().loadAsync(p.assetUrl);
        if (disposed || seq !== modelSequence) return;
        const box = new THREE.Box3().setFromObject(model.scene);
        const size = box.getSize(new THREE.Vector3());
        if (!Number.isFinite(size.length()) || size.length() === 0)
          throw new Error("模型没有可显示的几何体");
        const xs = b.points.map((p) => p[0]),
          zs = b.points.map((p) => p[1]);
        const scale = Math.min(
          (Math.max(...xs) - Math.min(...xs)) / Math.max(size.x, 0.1),
          (Math.max(...zs) - Math.min(...zs)) / Math.max(size.z, 0.1),
          b.height / Math.max(size.y, 0.1),
        );
        model.scene.scale.setScalar(scale);
        const center = box.getCenter(new THREE.Vector3()).multiplyScalar(scale);
        model.scene.position.set(
          (Math.max(...xs) + Math.min(...xs)) / 2 - center.x,
          -box.min.y * scale + 0.3,
          (Math.max(...zs) + Math.min(...zs)) / 2 - center.z,
        );
        model.scene.traverse((o) => {
          if (o instanceof THREE.Mesh) {
            o.castShadow = true;
            o.receiveShadow = true;
          }
        });
        previewGroup.add(model.scene);
        const detail = detailGroups.get(b.id);
        if (detail) detail.visible = !options.community;
        const base = meshes.find((m) => m.userData.buildingId === b.id)!;
        base.visible = !options.community && !base.userData.photoBase;
      } catch (e) {
        onStatus(e instanceof Error ? e.message : "模型加载失败");
      }
    }
  }
  function select() {
    const b = street.buildings.find((v) => v.id === options.selected);
    if (b) {
      const box = new THREE.Box3().setFromPoints(
        b.points.map((p) => new THREE.Vector3(p[0], 0, p[1])),
      );
      box.max.y = b.height + 1;
      selection.box.copy(box);
      selection.visible = options.buildings;
    } else selection.visible = false;
  }
  function setOptions(next: SceneOptions) {
    const old = options;
    options = next;
    treeGroup.visible = next.trees;
    labelGroup.visible = next.labels && next.mode === "overview";
    buildingGroup.visible = next.buildings;
    previewGroup.visible = next.community;
    scene.background = next.night ? duskSky : scannedSky || daySky;
    scene.environmentIntensity = next.night ? 0.32 : 1.05;
    scene.fog = new THREE.Fog(next.night ? "#233540" : "#c6d5dc", 600, 1800);
    ambient.intensity = next.night ? 0.45 : 0.72;
    sun.intensity = next.night ? 0.3 : 2.1;
    renderer.toneMappingExposure = next.night ? 0.8 : 1.05;
    route.visible = next.mode === "walk";
    marker.visible = next.mode === "overview";
    if (old.mode !== next.mode) {
      keys.clear();
      camera.fov = next.mode === "walk" ? 65 : 43;
      camera.updateProjectionMatrix();
      fly = null;
      controls.enabled = next.mode === "overview";
      if (next.mode === "walk") {
        const start = street.route[0];
        camera.position.set(start[0], 1.75, start[1]);
        yaw = -Math.PI / 2;
        pitch = 0;
        camera.rotation.order = "YXZ";
        camera.rotation.set(pitch, yaw, 0);
        renderer.domElement.focus();
      } else {
        travel(homePosition.clone(), homeTarget.clone());
      }
    }
    meshes.forEach(
      (m) =>
        (m.visible =
          !m.userData.photoBase &&
          !(
            next.community &&
            previewGroup.children.length > 0 &&
            next.preview?.buildingId === m.userData.buildingId
          )),
    );
    detailGroups.forEach((g, id) => {
      g.visible = !(
        next.community &&
        previewGroup.children.length > 0 &&
        next.preview?.buildingId === id
      );
    });
    select();
    void showPreview();
  }
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  function down(e: PointerEvent) {
    if (e.button !== 0) return;
    drag = { x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY };
    if (options.mode === "walk")
      renderer.domElement.setPointerCapture(e.pointerId);
  }
  function move(e: PointerEvent) {
    if (drag && options.mode === "walk") {
      yaw -= (e.clientX - drag.x) * 0.004;
      pitch = Math.max(
        -1.3,
        Math.min(1.3, pitch - (e.clientY - drag.y) * 0.003),
      );
      drag.x = e.clientX;
      drag.y = e.clientY;
    }
  }
  function up(e: PointerEvent) {
    if (
      drag &&
      Math.hypot(drag.startX - e.clientX, drag.startY - e.clientY) < 5
    ) {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        (-(e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects([
        ...meshes.filter((m) => m.visible && buildingGroup.visible),
        ...Array.from(detailGroups.values()).filter(
          (g) => g.visible && buildingGroup.visible,
        ),
      ])[0];
      if (hit) onSelect(hit.object.userData.buildingId);
    }
    drag = null;
  }
  function key(e: KeyboardEvent) {
    const tag = (e.target as HTMLElement)?.tagName;
    if (["INPUT", "TEXTAREA", "SELECT"].includes(tag)) return;
    const k = e.key.toLowerCase();
    if (
      options.mode === "walk" &&
      [
        "w",
        "a",
        "s",
        "d",
        "arrowup",
        "arrowdown",
        "arrowleft",
        "arrowright",
        "shift",
      ].includes(k)
    ) {
      e.preventDefault();
      if (e.type === "keydown") keys.add(k);
      else keys.delete(k);
    }
  }
  function clearKeys() {
    keys.clear();
    drag = null;
  }
  renderer.domElement.addEventListener("pointerdown", down);
  renderer.domElement.addEventListener("pointermove", move);
  renderer.domElement.addEventListener("pointerup", up);
  renderer.domElement.addEventListener("pointercancel", clearKeys);
  window.addEventListener("keydown", key);
  window.addEventListener("keyup", key);
  window.addEventListener("blur", clearKeys);
  const resize = new ResizeObserver(() => {
    const width = host.clientWidth,
      height = host.clientHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  });
  resize.observe(host);
  function animate(now: number) {
    if (disposed) return;
    animation = requestAnimationFrame(animate);
    const dt = Math.min((now - prev) / 1000, 0.05);
    prev = now;
    if (document.hidden) return;
    if (options.mode === "walk") {
      let f =
          Number(keys.has("w") || keys.has("arrowup")) -
          Number(keys.has("s") || keys.has("arrowdown")),
        r =
          Number(keys.has("d") || keys.has("arrowright")) -
          Number(keys.has("a") || keys.has("arrowleft"));
      const len = Math.hypot(f, r);
      if (len) {
        f /= len;
        r /= len;
        const speed = (keys.has("shift") ? 15 : 5.5) * dt;
        const nx =
            camera.position.x +
            (-Math.sin(yaw) * f + Math.cos(yaw) * r) * speed,
          nz =
            camera.position.z +
            (-Math.cos(yaw) * f - Math.sin(yaw) * r) * speed;
        const blocked = (x: number, z: number) =>
          Math.abs(x) > 310 ||
          Math.abs(z) > 240 ||
          street.buildings.some((b) => inside(x, z, b.points));
        if (!blocked(nx, camera.position.z)) camera.position.x = nx;
        if (!blocked(camera.position.x, nz)) camera.position.z = nz;
      }
      camera.rotation.set(pitch, yaw, 0, "YXZ");
    } else {
      if (fly) {
        const t = Math.min(1, (now - fly.start) / 1000),
          s = 1 - Math.pow(1 - t, 4);
        camera.position.lerpVectors(fly.from, fly.to, s);
        controls.target.lerpVectors(fly.targetFrom, fly.targetTo, s);
        if (t === 1) fly = null;
      }
      controls.update();
    }
    renderer.render(scene, camera);
  }
  animation = requestAnimationFrame(animate);
  return {
    setOptions,
    visit: (view) => {
      if (options.mode !== "walk") return;
      fly = null;
      const v = FUNIAN_VIEWS[view];
      camera.position.set(v.position[0], v.position[1], v.position[2]);
      const dx = v.target[0] - v.position[0],
        dy = v.target[1] - v.position[1],
        dz = v.target[2] - v.position[2];
      yaw = Math.atan2(-dx, -dz);
      pitch = Math.atan2(dy, Math.hypot(dx, dz));
      camera.rotation.set(pitch, yaw, 0, "YXZ");
      renderer.domElement.focus();
    },
    inspectTerrace: () => {
      if (options.mode !== "overview") return;
      const v = FUNIAN_TERRACE.view;
      travel(new THREE.Vector3(...v.position), new THREE.Vector3(...v.target));
    },
    focus: (id) => {
      const b = street.buildings.find((b) => b.id === id);
      if (!b) return;
      if (options.mode === "overview" && PHOTO_BUILDING_IDS.includes(b.id)) {
        travel(
          new THREE.Vector3(
            b.center[0] - 65,
            b.height * 0.45 + 12,
            b.center[1] - 95,
          ),
          new THREE.Vector3(b.center[0], b.height * 0.22, b.center[1]),
        );
        return;
      }
      if (options.mode === "overview")
        travel(
          new THREE.Vector3(
            b.center[0] + 110,
            b.height + 100,
            b.center[1] + 130,
          ),
          new THREE.Vector3(b.center[0], b.height * 0.35, b.center[1]),
        );
    },
    reset: () => {
      if (options.mode === "overview")
        travel(homePosition.clone(), homeTarget.clone());
      else {
        camera.position.set(street.route[0][0], 1.75, street.route[0][1]);
        yaw = -Math.PI / 2;
        pitch = 0;
      }
    },
    zoom: (direction) => {
      if (options.mode === "overview") {
        const offset = camera.position
          .clone()
          .sub(controls.target)
          .multiplyScalar(direction > 0 ? 0.8 : 1.25);
        offset.clampLength(35, 1100);
        camera.position.copy(controls.target).add(offset);
      }
    },
    move: (k, pressed) => {
      if (pressed) keys.add(k);
      else keys.delete(k);
    },
    position: () => ({ x: camera.position.x, z: camera.position.z, y: yaw }),
    dispose: () => {
      disposed = true;
      modelSequence++;
      cancelAnimationFrame(animation);
      resize.disconnect();
      controls.dispose();
      window.removeEventListener("keydown", key);
      window.removeEventListener("keyup", key);
      window.removeEventListener("blur", clearKeys);
      renderer.domElement.removeEventListener("pointerdown", down);
      renderer.domElement.removeEventListener("pointermove", move);
      renderer.domElement.removeEventListener("pointerup", up);
      renderer.domElement.removeEventListener("pointercancel", clearKeys);
      scene.traverse((o) => {
        if (
          o instanceof THREE.Mesh ||
          o instanceof THREE.Line ||
          o instanceof THREE.Sprite
        ) {
          if ("geometry" in o) o.geometry.dispose();
          for (const m of Array.isArray(o.material) ? o.material : [o.material])
            m.dispose();
        }
      });
      const textures = new Set<THREE.Texture>();
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh || o instanceof THREE.Sprite)
          for (const m of Array.isArray(o.material) ? o.material : [o.material])
            for (const v of Object.values(m))
              if (v instanceof THREE.Texture) textures.add(v);
      });
      textures.forEach((t) => t.dispose());
      asphalt.dispose();
      paving.dispose();
      environment.dispose();
      scannedEnvironment?.dispose();
      scannedSky?.dispose();
      daySky.dispose();
      duskSky.dispose();
      facadeMap.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
