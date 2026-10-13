import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { Street, SceneOptions, SceneApi, Building } from "./types";
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
  scene.background = new THREE.Color("#e9eeeb");
  scene.fog = new THREE.Fog("#e9eeeb", 800, 1700);
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
  renderer.toneMappingExposure = 1.25;
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
  const ambient = new THREE.HemisphereLight("#f4f8ff", "#aaa990", 2.4);
  scene.add(ambient);
  const sun = new THREE.DirectionalLight("#fff5db", 3);
  sun.position.set(-220, 470, 180);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -500;
  sun.shadow.camera.right = 500;
  sun.shadow.camera.top = 500;
  sun.shadow.camera.bottom = -500;
  sun.shadow.camera.far = 1200;
  sun.shadow.normalBias = 1;
  scene.add(sun);
  const meshes: THREE.Mesh[] = [];
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
  const roadMaterial = new THREE.MeshStandardMaterial({
    color: "#737e80",
    roughness: 1,
  });
  const sidewalkMaterial = new THREE.MeshStandardMaterial({
    color: "#e3dfd5",
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
      segment(a, b, r.width, 0.22 + ri * 0.0005, roadMaterial);
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
      color: i % 4 === 0 ? "#c9d1d0" : "#d3dcde",
      map: facadeMap,
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
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(geometry, 30),
      new THREE.LineBasicMaterial({
        color: "#74868a",
        transparent: true,
        opacity: 0.24,
      }),
    );
    edges.position.y = 0.3;
    buildingGroup.add(edges);
    if (b.name && !b.name.startsWith("未命名")) {
      const canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = 92;
      const c = canvas.getContext("2d")!;
      c.fillStyle = "rgba(250,252,249,.94)";
      c.beginPath();
      c.roundRect(0, 0, 512, 92, 18);
      c.fill();
      c.fillStyle = "#314a45";
      c.font = "500 36px sans-serif";
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillText(
        b.name.length > 12 ? b.name.slice(0, 12) + "…" : b.name,
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
  const treePositions: number[][] = [];
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
  const leaves = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(3.5, 1),
    new THREE.MeshStandardMaterial({ color: "#719579", roughness: 1 }),
    treePositions.length,
  );
  const trunks = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.25, 0.4, 4.5, 6),
    new THREE.MeshStandardMaterial({ color: "#857d68" }),
    treePositions.length,
  );
  const dummy = new THREE.Object3D();
  treePositions.forEach(([x, z], i) => {
    dummy.position.set(x, 6.8, z);
    dummy.scale.set(1, 1.25, 1);
    dummy.updateMatrix();
    leaves.setMatrixAt(i, dummy.matrix);
    dummy.position.y = 2.3;
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    trunks.setMatrixAt(i, dummy.matrix);
  });
  leaves.castShadow = true;
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
  let previewId: string | null = null;
  let modelSequence = 0;
  const homePosition = new THREE.Vector3(410, 370, 460),
    homeTarget = new THREE.Vector3(0, 8, 0);
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
    meshes.forEach((m) => (m.visible = true));
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
      meshes.find((m) => m.userData.buildingId === b.id)!.visible =
        !options.community;
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
          b.center[0] - center.x,
          -box.min.y * scale + 0.3,
          b.center[1] - center.z,
        );
        model.scene.traverse((o) => {
          if (o instanceof THREE.Mesh) {
            o.castShadow = true;
            o.receiveShadow = true;
          }
        });
        previewGroup.add(model.scene);
        meshes.find((m) => m.userData.buildingId === b.id)!.visible =
          !options.community;
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
    scene.background = new THREE.Color(next.night ? "#162932" : "#e9eeeb");
    scene.fog = new THREE.Fog(next.night ? "#162932" : "#e9eeeb", 800, 1700);
    ambient.intensity = next.night ? 1.1 : 2.4;
    sun.intensity = next.night ? 0.25 : 3;
    renderer.toneMappingExposure = next.night ? 0.8 : 1.25;
    route.visible = next.mode === "walk";
    marker.visible = next.mode === "overview";
    if (old.mode !== next.mode) {
      keys.clear();
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
        (m.visible = !(
          next.community &&
          previewGroup.children.length > 0 &&
          next.preview?.buildingId === m.userData.buildingId
        )),
    );
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
      const hit = raycaster.intersectObjects(
        meshes.filter((m) => m.visible && buildingGroup.visible),
      )[0];
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
    focus: (id) => {
      const b = street.buildings.find((b) => b.id === id);
      if (!b) return;
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
      facadeMap.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
