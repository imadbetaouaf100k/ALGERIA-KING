import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export interface Collider {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  climb?: boolean;
  base?: number;
  disabled?: boolean;
}

export interface World {
  root: THREE.Group;
  colliders: Collider[];
  water: THREE.Mesh;
  flags: THREE.Mesh[];
  lamps: THREE.MeshStandardMaterial;
}

export function seededRandom(seed: number) {
  return () => {
    seed |= 0;
    seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export function texture(kind: 'plaster' | 'paving' | 'wood') {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const random = seededRandom(81);
  ctx.fillStyle = kind === 'plaster' ? '#c9c2b1' : kind === 'paving' ? '#a59a84' : '#8c7756';
  ctx.fillRect(0, 0, 256, 256);
  if (kind === 'paving') {
    for (let y = 0; y < 256; y += 32) {
      for (let x = -32; x < 256; x += 64) {
        const offset = y % 64 ? 32 : 0;
        const shade = 125 + random() * 43;
        ctx.fillStyle = `rgb(${shade + 14},${shade + 6},${shade - 12})`;
        ctx.fillRect(x + offset + 1, y + 1, 61, 29);
        ctx.strokeStyle = 'rgba(50,45,35,0.2)';
        ctx.strokeRect(x + offset + 2, y + 2, 60, 28);
      }
    }
  }
  for (let i = 0; i < 11500; i++) {
    const shade = random() > 0.5 ? 255 : 20;
    ctx.fillStyle = `rgba(${shade},${shade},${shade},${random() * (kind === 'plaster' ? 0.1 : 0.07)})`;
    ctx.fillRect(random() * 256, random() * 256, kind === 'wood' ? 1 : 2, kind === 'wood' ? random() * 28 : 2);
  }
  const result = new THREE.CanvasTexture(canvas);
  result.colorSpace = THREE.SRGBColorSpace;
  result.wrapS = result.wrapT = THREE.RepeatWrapping;
  result.repeat.set(kind === 'paving' ? 26 : 2, kind === 'paving' ? 28 : 2);
  result.anisotropy = 4;
  return result;
}

export function createWorld(): World {
  const root = new THREE.Group();
  const staticRoot = new THREE.Group();
  root.add(staticRoot);
  const colliders: Collider[] = [];
  const random = seededRandom(134);
  const plaster = texture('plaster');
  const paving = texture('paving');
  const wood = texture('wood');
  const material = (color: number, map?: THREE.Texture) => new THREE.MeshStandardMaterial({ color, roughness: 0.92, map });
  const mats = {
    walls: [material(0xf0e6cd, plaster), material(0xe8d5b5, plaster), material(0xd9c9aa, plaster), material(0xf0eee0, plaster)],
    trim: material(0xd5c3a0, plaster), stone: material(0xa99577), road: material(0xe0cda7, paving),
    blue: material(0x32636b), teal: material(0x567b77), dark: material(0x263b3c), wood: material(0xbbaa83, wood),
    metal: material(0x343b36), terracotta: material(0xa5674a), green: material(0x4f6242), leaf: material(0x627653),
    paleLeaf: material(0x84906a), red: material(0xa7684d), fabric: material(0xd6c59d), gold: material(0xb39a59),
    fruit: material(0xc59c3d), orange: material(0xba6f37), white: material(0xe8e0c5),
  };
  const cube = new THREE.BoxGeometry(1, 1, 1);
  const sphere = new THREE.IcosahedronGeometry(1, 1);
  const cyl = new THREE.CylinderGeometry(1, 1, 1, 10);
  const mesh = (geometry: THREE.BufferGeometry, mat: THREE.Material, parent: THREE.Object3D, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1) => {
    const item = new THREE.Mesh(geometry, mat);
    item.position.set(x, y, z);
    item.scale.set(sx, sy, sz);
    item.castShadow = true;
    item.receiveShadow = true;
    parent.add(item);
    return item;
  };
  const box = (parent: THREE.Object3D, x: number, y: number, z: number, w: number, h: number, d: number, mat: THREE.Material) => mesh(cube, mat, parent, x, y, z, w, h, d);

  // The pool is cut out of the paving rather than painted on top of it.
  const groundShape = new THREE.Shape();
  groundShape.moveTo(-42, -40); groundShape.lineTo(42, -40); groundShape.lineTo(42, 46); groundShape.lineTo(-42, 46); groundShape.closePath();
  const hole = new THREE.Path();
  hole.moveTo(-10, -14); hole.lineTo(-4, -14); hole.lineTo(-4, -20); hole.lineTo(-10, -20); hole.closePath();
  groundShape.holes.push(hole);
  const groundGeo = new THREE.ShapeGeometry(groundShape);
  const uv = groundGeo.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 84, uv.getY(i) / 86);
  const ground = new THREE.Mesh(groundGeo, mats.road);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  staticRoot.add(ground);
  box(staticRoot, -7, -1.25, 17, 6, 0.1, 6, mats.blue);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(5.98, 5.98, 12, 12), new THREE.MeshStandardMaterial({ color: 0x488b89, transparent: true, opacity: 0.76, metalness: 0.4, roughness: 0.22 }));
  water.rotation.x = -Math.PI / 2;
  water.position.set(-7, -0.08, 17);
  root.add(water);
  for (const [x, z, w, d] of [[-10.15, 17, 0.3, 6.6], [-3.85, 17, 0.3, 6.6], [-7, 13.85, 6, 0.3], [-7, 20.15, 6, 0.3]]) {
    box(staticRoot, x, 0.11, z, w, 0.22, d, mats.trim);
  }
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(700, 650), new THREE.MeshStandardMaterial({ color: 0x487e82, roughness: 0.32, metalness: 0.3 }));
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(260, -2, -100);
  root.add(sea);

  const arch = (parent: THREE.Group, x: number, y: number, z: number, width: number, height: number, mat: THREE.Material) => {
    const shape = new THREE.Shape();
    shape.moveTo(-width / 2, 0);
    shape.lineTo(width / 2, 0);
    shape.lineTo(width / 2, height - width / 2);
    shape.absarc(0, height - width / 2, width / 2, 0, Math.PI, false);
    shape.lineTo(-width / 2, 0);
    const geo = new THREE.ShapeGeometry(shape, 10);
    const a = new THREE.Mesh(geo, mat);
    a.position.set(x, y, z);
    parent.add(a);
  };

  const building = (x: number, z: number, width: number, depth: number, height: number, rotation: number, index: number, solid = true) => {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = rotation;
    staticRoot.add(group);
    const wall = mats.walls[index % mats.walls.length];
    box(group, 0, height / 2, 0, width, height, depth, wall);
    box(group, 0, 0.25, 0, width + 0.18, 0.5, depth + 0.18, mats.trim);
    box(group, 0, height - 0.2, 0, width + 0.45, 0.24, depth + 0.45, mats.trim);
    box(group, 0, height + 0.15, -depth / 2, width, 0.48, 0.24, wall);
    box(group, 0, height + 0.15, depth / 2, width, 0.48, 0.24, wall);
    box(group, -width / 2, height + 0.15, 0, 0.24, 0.48, depth, wall);
    box(group, width / 2, height + 0.15, 0, 0.24, 0.48, depth, wall);
    const front = depth / 2 + 0.02;
    arch(group, 0, 0.04, front, 2.15, 3.35, mats.trim);
    arch(group, 0, 0.06, front + 0.015, 1.8, 3.12, mats.blue);
    box(group, 0, 1.3, front + 0.04, 0.05, 2.5, 0.03, mats.gold);
    for (const side of [-1, 1]) mesh(sphere, mats.gold, group, side * 0.16, 1.42, front + 0.075, 0.065, 0.065, 0.05);
    const cols = Math.floor(width / 2.8);
    const floors = Math.floor(height / 3.2);
    for (let floor = 0; floor < floors; floor++) {
      for (let c = 0; c < cols; c++) {
        const wx = (c - (cols - 1) / 2) * 2.7;
        const wy = 1.45 + floor * 3.1;
        if (floor === 0 && Math.abs(wx) < 1.4) continue;
        box(group, wx, wy + 0.6, front + 0.045, 1.4, 1.83, 0.14, mats.trim);
        box(group, wx, wy + 0.6, front + 0.13, 1.1, 1.55, 0.035, mats.dark);
        for (const side of [-1, 1]) {
          box(group, wx + side * 0.43, wy + 0.6, front + 0.16, 0.35, 1.55, 0.07, index % 2 ? mats.teal : mats.blue);
          for (let slat = 0; slat < 6; slat++) box(group, wx + side * 0.43, wy + slat * 0.24, front + 0.205, 0.32, 0.055, 0.03, mats.dark);
        }
        box(group, wx, wy + 0.6, front + 0.18, 0.055, 1.5, 0.06, mats.white);
        box(group, wx, wy - 0.25, front + 0.15, 1.53, 0.15, 0.4, mats.trim);
        if (floor === 1 && c % 2 === 0) {
          box(group, wx, wy - 0.25, front + 0.6, 1.7, 0.13, 1.15, mats.trim);
          box(group, wx, wy + 0.5, front + 1.1, 1.7, 0.07, 0.06, mats.metal);
          for (let bar = -3; bar <= 3; bar++) box(group, wx + bar * 0.25, wy + 0.13, front + 1.1, 0.035, 0.8, 0.04, mats.metal);
        }
      }
    }
    for (let side = -1; side <= 1; side += 2) {
      for (let floor = 1; floor < floors; floor++) {
        for (let n = -1; n <= 1; n++) box(group, side * (width / 2 + 0.02), 2 + floor * 3, n * 2.6, 0.05, 1.3, 0.9, mats.blue);
      }
    }
    box(group, width * 0.23, height + 0.65, -depth * 0.15, 2, 1.25, 2, wall);
    const dish = mesh(new THREE.SphereGeometry(0.6, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), mats.white, group, -width * 0.22, height + 0.8, -depth * 0.2, 1, 0.18, 1);
    dish.rotation.x = 0.6;
    box(group, -width * 0.22, height + 0.35, -depth * 0.2, 0.08, 0.9, 0.08, mats.metal);
    if (solid) {
      const rotated = Math.abs(Math.sin(rotation)) > 0.5;
      colliders.push({ x, z, w: rotated ? depth : width, d: rotated ? width : depth, h: height });
    }
  };

  for (let i = 0; i < 4; i++) {
    building(-18.3, 15 - i * 14, 10.7, 9.5, 8.5 + (i % 3) * 2.8, Math.PI / 2, i);
    building(18.3, 15 - i * 14, 10.7, 9.5, 10 + ((i + 1) % 3) * 2.5, -Math.PI / 2, i + 2);
  }
  building(-5.5, -40, 12, 8, 10, 0, 1);
  building(8, -40, 11, 8, 14, 0, 0);
  for (let i = 0; i < 17; i++) {
    const x = -50 + (i % 6) * 17;
    const z = -62 - Math.floor(i / 6) * 15;
    building(x, z, 12 + random() * 3, 10, 9 + random() * 16, 0, i, false);
  }

  // A square minaret, green roof tiles, and cornices give the skyline a local silhouette.
  const tower = new THREE.Group();
  tower.position.set(-28, 0, -47);
  staticRoot.add(tower);
  box(tower, 0, 12, 0, 4.4, 24, 4.4, mats.walls[0]);
  for (let h = 4; h <= 24; h += 5) box(tower, 0, h, 0, 4.65, 0.24, 4.65, mats.trim);
  box(tower, 0, 25.1, 0, 5.2, 1.25, 5.2, mats.walls[1]);
  box(tower, 0, 27.4, 0, 2.4, 3.8, 2.4, mats.walls[0]);
  const cap = mesh(new THREE.ConeGeometry(2.3, 3.2, 4), mats.green, tower, 0, 30.4, 0);
  cap.rotation.y = Math.PI / 4;
  mesh(cyl, mats.gold, tower, 0, 32.5, 0, 0.045, 2, 0.045);
  for (let i = -1; i <= 1; i++) arch(tower, i * 1.1, 20, 2.21, 0.6, 2.4, mats.blue);

  for (let i = 0; i < 15; i++) {
    const mountain = new THREE.Mesh(new THREE.ConeGeometry(23 + random() * 16, 30 + random() * 34, 7), material(i % 2 ? 0x7c8772 : 0x86917e));
    mountain.position.set(-155 + i * 21, 9, -145 - random() * 35);
    mountain.scale.z = 0.7;
    staticRoot.add(mountain);
  }

  const tree = (x: number, z: number, scale = 1, pot = false) => {
    const treeRoot = new THREE.Group();
    treeRoot.position.set(x, 0, z);
    treeRoot.scale.setScalar(scale);
    staticRoot.add(treeRoot);
    if (pot) mesh(new THREE.CylinderGeometry(0.5, 0.34, 0.65, 10), mats.terracotta, treeRoot, 0, 0.33, 0);
    const trunk = mesh(cyl, mats.wood, treeRoot, 0, 1.5, 0, 0.14, 3, 0.14);
    trunk.rotation.z = 0.09;
    for (let b = 0; b < 4; b++) {
      const angle = b * Math.PI / 2;
      const branch = mesh(cyl, mats.wood, treeRoot, Math.cos(angle) * 0.5, 2.3, Math.sin(angle) * 0.5, 0.065, 1.6, 0.065);
      branch.rotation.z = Math.cos(angle) * -0.75;
      branch.rotation.x = Math.sin(angle) * 0.75;
      const leaf = mesh(sphere, b % 2 ? mats.leaf : mats.paleLeaf, treeRoot, Math.cos(angle) * 0.82, 3 + random() * 0.35, Math.sin(angle) * 0.82, 1.15, 0.78, 1.05);
      leaf.rotation.y = random() * 3;
    }
  };
  [[-11, 7], [11, 7], [-11, -9], [11, -24], [-11, -30], [10, 20]].forEach(([x, z]) => tree(x, z, 0.9, true));

  const crate = (x: number, z: number, size = 1.1, h = 1.15) => {
    box(staticRoot, x, h / 2, z, size, h, size, mats.wood);
    for (const y of [0.1, h - 0.1]) box(staticRoot, x, y, z, size + 0.05, 0.12, size + 0.05, mats.trim);
    for (const side of [-1, 1]) box(staticRoot, x + side * size * 0.39, h / 2, z + size / 2 + 0.025, 0.1, h, 0.045, mats.trim);
    colliders.push({ x, z, w: size, d: size, h, climb: true });
  };
  [[-5, -3], [6, -9], [-5, -17], [4, -27], [10, 4], [-9, -23]].forEach(([x, z], i) => crate(x, z, i % 2 ? 1.25 : 1.65, i % 2 ? 1.1 : 1.45));
  crate(7.4, -8.6, 0.9, 0.65);
  box(staticRoot, 10, 0.75, -9, 3, 1.5, 4.5, mats.walls[1]);
  colliders.push({ x: 10, z: -9, w: 3, d: 4.5, h: 1.5, climb: true });
  for (let i = 0; i < 5; i++) box(staticRoot, 10, 0.15 * (i + 1), -5.7 - i * 0.4, 2.2, 0.3 * (i + 1), 0.42, mats.trim);

  const market = (x: number, z: number, color: THREE.Material) => {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    staticRoot.add(group);
    box(group, 0, 0.55, 0, 2.7, 1.1, 1.25, mats.wood);
    for (const side of [-1, 1]) box(group, side * 1.25, 1.55, -0.4, 0.08, 3.1, 0.08, mats.wood);
    for (let stripe = 0; stripe < 7; stripe++) {
      const awning = box(group, -1.35 + stripe * 0.45, 2.9, 0.1, 0.46, 0.045, 2.2, stripe % 2 ? mats.fabric : color);
      awning.rotation.x = 0.13;
      box(group, -1.35 + stripe * 0.45, 2.65, 1.18, 0.46, 0.3, 0.045, stripe % 2 ? mats.fabric : color);
    }
    for (let n = 0; n < 18; n++) mesh(sphere, n % 3 ? mats.fruit : mats.orange, group, (random() - 0.5) * 2.3, 1.18, (random() - 0.5) * 0.9, 0.13, 0.12, 0.12);
    colliders.push({ x, z, w: 2.7, d: 1.25, h: 1.1, climb: true });
  };
  market(-9, -14, mats.red);
  market(9.6, -16, mats.teal);
  market(-10, -3, mats.green);

  const lampMat = new THREE.MeshStandardMaterial({ color: 0xf4cf83, emissive: 0xf6ae47, emissiveIntensity: 0.3 });
  for (const [x, z] of [[-11.8, 18], [11.8, 11], [-11.8, -6], [11.8, -12], [-11.8, -24], [11.8, -31]]) {
    mesh(cyl, mats.metal, staticRoot, x, 2, z, 0.06, 4, 0.06);
    mesh(cyl, mats.metal, staticRoot, x, 0.15, z, 0.18, 0.3, 0.18);
    box(staticRoot, x, 4.12, z, 0.38, 0.55, 0.38, lampMat);
    mesh(new THREE.ConeGeometry(0.35, 0.3, 4), mats.metal, staticRoot, x, 4.56, z);
  }

  const flags: THREE.Mesh[] = [];
  for (let i = 0; i < 3; i++) {
    const z = 8 - i * 15;
    box(staticRoot, 0, 7.5, z, 27, 0.035, 0.035, mats.metal);
    for (let j = 0; j < 7; j++) {
      const cloth = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 1.45, 3, 3), new THREE.MeshStandardMaterial({ color: [0xc9b896, 0x6e8680, 0xb18b6c, 0xd7d1bb][j % 4], side: THREE.DoubleSide, roughness: 1 }));
      cloth.position.set(-8 + j * 2.6, 6.8, z);
      root.add(cloth);
      flags.push(cloth);
    }
  }

  // Merge static architecture by material: detail without hundreds of draw calls.
  staticRoot.updateMatrixWorld(true);
  const batches = new Map<string, { material: THREE.Material; geometries: THREE.BufferGeometry[] }>();
  const originals = new Set<THREE.BufferGeometry>();
  staticRoot.traverse((object) => {
    if (!(object instanceof THREE.Mesh) || Array.isArray(object.material)) return;
    const key = object.material.uuid;
    if (!batches.has(key)) batches.set(key, { material: object.material, geometries: [] });
    const geometry = object.geometry.clone().applyMatrix4(object.matrixWorld);
    if (!geometry.index) {
      const indices = Array.from({ length: geometry.attributes.position.count }, (_, i) => i);
      geometry.setIndex(indices);
    }
    batches.get(key)!.geometries.push(geometry);
    originals.add(object.geometry);
  });
  root.remove(staticRoot);
  for (const batch of batches.values()) {
    const geometry = mergeGeometries(batch.geometries);
    if (geometry) {
      const merged = new THREE.Mesh(geometry, batch.material);
      merged.castShadow = true;
      merged.receiveShadow = true;
      root.add(merged);
    }
    batch.geometries.forEach(g => g.dispose());
  }
  originals.forEach(g => g.dispose());
  return { root, colliders, water, flags, lamps: lampMat };
}

export function createTarget(): THREE.Group {
  const group = new THREE.Group();
  const dark = new THREE.MeshStandardMaterial({ color: 0x675a42, roughness: 0.9 });
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.7, 8), dark);
  post.position.y = 0.85;
  post.castShadow = true;
  group.add(post);
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.6, 0.16, 8), dark);
  foot.position.y = 0.08;
  group.add(foot);
  const disc = new THREE.Group();
  disc.position.y = 1.6;
  for (let i = 0; i < 4; i++) {
    const radius = 0.65 - i * 0.15;
    const mat = new THREE.MeshStandardMaterial({ color: i % 2 === 0 ? 0xcbb16d : 0x425651, emissive: i === 2 ? 0x89631a : 0x000000, emissiveIntensity: 0.45 });
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 0.07, 28), mat);
    ring.rotation.x = Math.PI / 2;
    ring.position.z = 0.06 + i * 0.03;
    ring.castShadow = true;
    disc.add(ring);
  }
  group.add(disc);
  group.userData.disc = disc;
  return group;
}

export function createDrone(): THREE.Group {
  const root = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x343f3e, roughness: 0.5, metalness: 0.55 });
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.42, 0), mat);
  core.scale.set(1.2, 0.7, 1);
  root.add(core);
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), new THREE.MeshStandardMaterial({ color: 0xdd7750, emissive: 0xe96431, emissiveIntensity: 2 }));
  eye.position.set(0, 0, 0.34);
  root.add(eye);
  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.065, 0.08), mat);
    arm.position.x = side * 0.53;
    root.add(arm);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.045, 6, 16), mat);
    ring.rotation.x = Math.PI / 2;
    ring.position.x = side * 0.77;
    root.add(ring);
    const rotor = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.025, 0.07), new THREE.MeshStandardMaterial({ color: 0xb2b9a5, transparent: true, opacity: 0.6 }));
    rotor.position.set(side * 0.77, 0.03, 0);
    rotor.name = 'rotor';
    root.add(rotor);
  }
  root.traverse(o => { if (o instanceof THREE.Mesh) o.castShadow = true; });
  return root;
}

export function createBeacon(color: number): THREE.Group {
  const group = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.65, 0.025, 6, 32), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.75 }));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.08;
  group.add(ring);
  const diamond = new THREE.Mesh(new THREE.OctahedronGeometry(0.19), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.8, roughness: 0.25, metalness: 0.5 }));
  diamond.position.y = 1.6;
  diamond.name = 'diamond';
  group.add(diamond);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.48, 4, 16, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.055, depthWrite: false, side: THREE.DoubleSide }));
  beam.position.y = 2;
  group.add(beam);
  return group;
}