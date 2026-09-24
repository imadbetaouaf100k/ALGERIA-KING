import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { seededRandom, texture, type Collider } from './world';
import type { Biome, Point, RegionDefinition } from './campaign';

export interface RegionWorld {
  root: THREE.Group;
  colliders: Collider[];
  flags: THREE.Mesh[];
  water: THREE.Mesh;
  lamps: THREE.MeshStandardMaterial;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  heightAt: (x: number, z: number) => number;
  waterAt: (x: number, z: number) => boolean;
  sky: THREE.Color;
  updateProgress: (completed: string[]) => void;
}

export interface BuildingFootprint { x: number; z: number; w: number; d: number; h: number; rotation: number }

export const REGION_PALETTES: Record<Biome, { ground: number; walls: number; trim: number; roof: number; foliage: number; sky: number }> = {
  village: { ground: 0xa79b70, walls: 0xd8c8a5, trim: 0xb59973, roof: 0x955e46, foliage: 0x597245, sky: 0xc7d2b7 },
  mountain: { ground: 0x7e8970, walls: 0xa69a7f, trim: 0x746e58, roof: 0x6b755b, foliage: 0x3b634c, sky: 0xaac2c0 },
  plateau: { ground: 0xb7a779, walls: 0xcdbb92, trim: 0x9e8660, roof: 0x787a60, foliage: 0x858b4f, sky: 0xc6cbb0 },
  desert: { ground: 0xdbbc80, walls: 0xcaa16a, trim: 0xa67b4e, roof: 0xbc9e6b, foliage: 0x536b42, sky: 0xdac7a1 },
  oasis: { ground: 0xc7a973, walls: 0xc59968, trim: 0x9b7351, roof: 0xab8659, foliage: 0x466b46, sky: 0xb7c8bb },
  border: { ground: 0xcaba91, walls: 0xddcead, trim: 0x758675, roof: 0x697664, foliage: 0x6d8154, sky: 0xcad0b8 },
  city: { ground: 0xc5bda0, walls: 0xf1e8d1, trim: 0xc2af8b, roof: 0x487a75, foliage: 0x4b7655, sky: 0xb3cac6 },
  medina: { ground: 0xbca686, walls: 0xd4b48c, trim: 0xa48761, roof: 0x8e6550, foliage: 0x507451, sky: 0xd4ccb4 },
  port: { ground: 0x929c97, walls: 0xb18e77, trim: 0xa7aea0, roof: 0x465961, foliage: 0x4c6a59, sky: 0x9cb7bd },
  highland: { ground: 0x859c79, walls: 0xe0ccb0, trim: 0x9a6150, roof: 0x376e5b, foliage: 0x346e58, sky: 0xb5cdc7 },
  river: { ground: 0x78906b, walls: 0xb59d71, trim: 0x547c70, roof: 0x7a6c47, foliage: 0x2e704e, sky: 0x9bbfb6 },
  allies: { ground: 0xbcb99c, walls: 0xebe4cb, trim: 0xc8b48b, roof: 0x588173, foliage: 0x4f7c52, sky: 0xb9cec1 },
  citadel: { ground: 0x8b9893, walls: 0xa6afa5, trim: 0x65756e, roof: 0x536a67, foliage: 0x405e51, sky: 0xa5bac2 },
};

export function buildingLayout(region: RegionDefinition): BuildingFootprint[] {
  const random = seededRandom(region.biome === 'village' ? 31 : 31 + region.chapter * 3 + (region.part?.length ?? 0));
  if (['mountain', 'desert', 'citadel'].includes(region.biome)) return [];
  if (region.biome === 'border') return [{ x: -16, z: 7, w: 9, d: 10, h: 4.3, rotation: Math.PI / 2 }, { x: 17, z: -19, w: 10, d: 12, h: 4.8, rotation: -Math.PI / 2 }, { x: -17, z: -43, w: 7, d: 9, h: 5, rotation: Math.PI / 2 }];
  const result: BuildingFootprint[] = [];
  const village = region.biome === 'village';
  const city = ['city', 'medina', 'port', 'allies'].includes(region.biome);
  const count = village ? 4 : region.biome === 'plateau' ? 3 : 5;
  for (let i = 0; i < count; i++) {
    for (const side of [-1, 1]) {
      const x = side * (city ? 18.6 : region.biome === 'plateau' ? 22 : 20);
      const z = 13 - i * (region.biome === 'plateau' ? 39 : village ? 20 : 17.5);
      if (region.biome === 'highland' && z < -13 && z > -31) continue;
      result.push({ x, z, w: 7 + random() * 3, d: 7 + random() * 2, h: city ? 6.4 + random() * 6 : 3.5 + random() * 2.2, rotation: side < 0 ? Math.PI / 2 : -Math.PI / 2 });
    }
  }
  return result;
}

export function relicLocations(region: RegionDefinition): Point[] {
  if (region.biome === 'mountain') return [[-10, 8], [10, -48], [0, -76]];
  return [[-10, 8], [10, -region.span * 0.34], [-9, -region.span * 0.63]];
}

function mergeStatic(source: THREE.Group, destination: THREE.Group) {
  source.updateMatrixWorld(true);
  const batches = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const originals = new Set<THREE.BufferGeometry>();
  source.traverse(object => {
    if (!(object instanceof THREE.Mesh) || Array.isArray(object.material)) return;
    let geometry = object.geometry.clone().applyMatrix4(object.matrixWorld);
    if (geometry.index) { const unindexed = geometry.toNonIndexed(); geometry.dispose(); geometry = unindexed; }
    for (const name of Object.keys(geometry.attributes)) if (!['position', 'normal', 'uv'].includes(name)) geometry.deleteAttribute(name);
    if (!geometry.attributes.uv) geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(geometry.attributes.position.count * 2), 2));
    const list = batches.get(object.material) ?? [];
    list.push(geometry);
    batches.set(object.material, list);
    originals.add(object.geometry);
  });
  for (const [material, geometries] of batches) {
    const geometry = mergeGeometries(geometries);
    if (geometry) {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = mesh.receiveShadow = true;
      destination.add(mesh);
    }
    geometries.forEach(g => g.dispose());
  }
  originals.forEach(g => g.dispose());
}

export function createRegionWorld(region: RegionDefinition): RegionWorld {
  const root = new THREE.Group();
  const statics = new THREE.Group();
  const colliders: Collider[] = [];
  const flags: THREE.Mesh[] = [];
  const palette = REGION_PALETTES[region.biome];
  const random = seededRandom(region.biome === 'village' ? 31 : 91 + region.chapter * 43);
  const cube = new THREE.BoxGeometry(1, 1, 1);
  const sphere = new THREE.IcosahedronGeometry(1, 1);
  const cylinder = new THREE.CylinderGeometry(1, 1, 1, 10);
  const plaster = texture('plaster');
  const woodTexture = texture('wood');
  const groundTexture = texture(['city', 'medina', 'allies', 'citadel', 'port'].includes(region.biome) ? 'paving' : 'plaster');
  groundTexture.repeat.set(40, 55);
  const mat = (color: number, map?: THREE.Texture) => new THREE.MeshStandardMaterial({ color, map, roughness: 0.91 });
  const mats = {
    wall: mat(palette.walls, plaster), trim: mat(palette.trim, plaster), roof: mat(palette.roof),
    ground: mat(palette.ground, groundTexture), path: mat(region.biome === 'desert' ? 0xc4a572 : 0xb9a47a),
    wood: mat(0x92744f, woodTexture), bark: mat(0x756449), dark: mat(0x2f4845), door: mat(['city', 'allies', 'oasis'].includes(region.biome) ? 0x438781 : 0x6c7e6a),
    leaf: mat(palette.foliage), paleLeaf: mat(new THREE.Color(palette.foliage).lerp(new THREE.Color(0xc2c68b), 0.32).getHex()),
    metal: mat(0x394b45), cloth: mat(0xcebc94), red: mat(0x995e4c), gold: mat(0xb9a06b),
    white: mat(0xe8e0c4), rock: mat(region.biome === 'desert' ? 0xb89060 : 0x92968b), crop: mat(region.returning ? 0x89a862 : 0xb0ad62),
  };
  const lamps = new THREE.MeshStandardMaterial({ color: 0xf6d39a, emissive: 0xf0b257, emissiveIntensity: 1 });
  const add = (geometry: THREE.BufferGeometry, material: THREE.Material, parent: THREE.Object3D, x: number, y: number, z: number, w = 1, h = 1, d = 1) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.scale.set(w, h, d);
    mesh.castShadow = mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const box = (parent: THREE.Object3D, x: number, y: number, z: number, w: number, h: number, d: number, material: THREE.Material) => add(cube, material, parent, x, y, z, w, h, d);
  const mountain = region.biome === 'mountain' || region.biome === 'highland';
  const bridgeStart = region.biome === 'mountain' ? -18 : -15;
  const bridgeEnd = region.biome === 'mountain' ? -40 : -28;
  const waterCenter: Point = region.biome === 'river' ? [-7, -23] : region.biome === 'oasis' ? [-7, -24] : [-9, 2];
  const hasPool = region.biome === 'river' || region.biome === 'oasis';
  const onBoardwalk = (x: number, z: number) => region.biome === 'river' && Math.abs(x) >= 11.5 && Math.abs(x) <= 22.5 && [11, -8, -43].some(bridge => Math.abs(z - bridge) <= 0.9);
  const waterAt = (x: number, z: number) => !onBoardwalk(x, z) && ((hasPool && Math.abs(x - waterCenter[0]) < 3.6 && Math.abs(z - waterCenter[1]) < 5)
    || (region.biome === 'river' && Math.abs(x) > 14 && Math.abs(x) < 26 && z < 18 && z > 30 - region.span));
  const baseHeight = (_x: number, z: number) => mountain ? Math.max(0, Math.min(2, (16 - z) * 0.06)) + Math.max(0, -40 - z) * 0.035 : region.biome === 'citadel' ? Math.max(0, -z) * 0.023 : 0;
  const heightAt = (x: number, z: number) => onBoardwalk(x, z) ? 0.25 : waterAt(x, z) ? -0.8 : baseHeight(x, z);
  const terrainHeight = (x: number, z: number) => {
    if (waterAt(x, z)) return -1.5;
    if (mountain && z < bridgeStart && z > bridgeEnd) return -4.5 + Math.sin(x * 0.25) * 0.3;
    const away = Math.max(0, Math.abs(x) - (width + 4)) / 25;
    const waves = Math.sin(x * 0.075 + z * 0.025) * Math.cos(z * 0.06 - x * 0.014);
    return baseHeight(x, z) + away * (region.biome === 'desert' ? 8 + waves * 7 : mountain ? 12 + waves * 9 : 2 + waves * 4);
  };
  const width = region.biome === 'village' ? 46 : region.biome === 'desert' ? 43 : region.biome === 'plateau' ? 34 : 28;
  const bounds = { minX: -width, maxX: width, minZ: 26 - region.span, maxZ: 27 };

  const terrain = new THREE.PlaneGeometry(270, region.span + 220, 70, 110);
  terrain.rotateX(-Math.PI / 2);
  terrain.translate(0, 0, -region.span / 2 + 22);
  const positions = terrain.getAttribute('position');
  for (let i = 0; i < positions.count; i++) positions.setY(i, terrainHeight(positions.getX(i), positions.getZ(i)));
  terrain.computeVertexNormals();
  const terrainMesh = new THREE.Mesh(terrain, mats.ground);
  terrainMesh.receiveShadow = true;
  root.add(terrainMesh);

  if (!['city', 'medina', 'allies', 'port', 'citadel'].includes(region.biome)) {
    for (let z = 27; z > bounds.minZ - 5; z -= 2) {
      if (mountain && z < bridgeStart && z > bridgeEnd) continue;
      const pathWidth = region.biome === 'desert' || region.biome === 'plateau' ? 5 : mountain ? 3.6 : 5.7;
      box(statics, 0, baseHeight(0, z) + 0.016, z, pathWidth, 0.026, 2.1, mats.path);
      if (region.biome === 'plateau') for (const side of [-1, 1]) box(statics, side * 2.7, 0.035, z, 0.12, 0.02, 0.7, mats.white);
    }
  }
  const water = new THREE.Mesh(new THREE.PlaneGeometry(7.3, 10.1, 12, 12), new THREE.MeshStandardMaterial({ color: 0x377f7c, transparent: true, opacity: 0.82, roughness: 0.24, metalness: 0.3 }));
  water.rotation.x = -Math.PI / 2;
  water.position.set(...[waterCenter[0], -0.11, waterCenter[1]] as [number, number, number]);
  water.visible = hasPool;
  root.add(water);

  const arch = (parent: THREE.Object3D, x: number, y: number, z: number, w: number, h: number, material: THREE.Material) => {
    const shape = new THREE.Shape();
    shape.moveTo(-w / 2, 0); shape.lineTo(w / 2, 0); shape.lineTo(w / 2, h - w / 2);
    shape.absarc(0, h - w / 2, w / 2, 0, Math.PI); shape.lineTo(-w / 2, 0);
    const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape, 12), material);
    mesh.position.set(x, y, z); parent.add(mesh);
  };
  const sign = (word: string, x: number, y: number, z: number, w = 3.2) => {
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 128;
    const c = canvas.getContext('2d')!;
    c.fillStyle = '#263f37'; c.fillRect(0, 0, 512, 128);
    c.strokeStyle = '#baa777'; c.lineWidth = 4; c.strokeRect(8, 8, 496, 112);
    c.font = '500 37px sans-serif'; c.fillStyle = '#e5d4a2'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(word, 256, 66, 465);
    const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, w / 4), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8, side: THREE.DoubleSide }));
    mesh.position.set(x, y, z); statics.add(mesh);
  };

  for (const [i, b] of buildingLayout(region).entries()) {
    const group = new THREE.Group();
    const base = baseHeight(b.x, b.z);
    group.position.set(b.x, base, b.z); group.rotation.y = b.rotation; statics.add(group);
    const river = region.biome === 'river';
    const lift = river ? 1.6 : 0;
    if (river) for (const dx of [-b.w / 2 + 0.5, b.w / 2 - 0.5]) for (const dz of [-b.d / 2 + 0.5, b.d / 2 - 0.5]) box(group, dx, 0.95, dz, 0.3, 1.9, 0.3, mats.wood);
    box(group, 0, b.h / 2 + lift, 0, b.w, b.h, b.d, mats.wall);
    box(group, 0, lift + 0.23, 0, b.w + 0.18, 0.45, b.d + 0.18, mats.trim);
    box(group, 0, b.h + lift, 0, b.w + 0.4, 0.28, b.d + 0.4, mats.trim);
    const front = b.d / 2 + 0.04;
    arch(group, 0, lift, front, 2.05, 3.03, mats.trim);
    arch(group, 0, lift + 0.06, front + 0.02, 1.64, 2.78, mats.door);
    box(group, 0, lift + 1.2, front + 0.035, 0.05, 2.3, 0.05, mats.gold);
    for (const side of [-1, 1]) add(sphere, mats.gold, group, side * 0.18, lift + 1.3, front + 0.12, 0.06, 0.06, 0.04);
    for (let f = 0; f < Math.floor(b.h / 3); f++) {
      for (const side of [-1, 1]) {
        const x = side * 2.4; const y = lift + 2 + f * 3;
        box(group, x, y, front, 1.42, 1.8, 0.2, mats.trim);
        box(group, x, y, front + 0.12, 1.14, 1.52, 0.04, mats.dark);
        for (const s of [-1, 1]) {
          box(group, x + s * 0.44, y, front + 0.16, 0.28, 1.5, 0.1, mats.door);
          for (let j = -2; j <= 2; j++) box(group, x + s * 0.44, y + j * 0.25, front + 0.22, 0.25, 0.045, 0.03, mats.trim);
        }
        box(group, x, y, front + 0.18, 0.05, 1.48, 0.05, mats.white);
        box(group, x, y - 0.85, front + 0.26, 1.55, 0.13, 0.45, mats.trim);
        if (f === 1) {
          box(group, x, y - 0.83, front + 0.5, 1.8, 0.15, 1, mats.trim);
          box(group, x, y, front + 0.98, 1.8, 0.05, 0.06, mats.metal);
          for (let j = -3; j <= 3; j++) box(group, x + j * 0.25, y - 0.37, front + 0.98, 0.035, 0.76, 0.04, mats.metal);
        }
      }
    }
    const pitched = ['village', 'port', 'highland', 'river'].includes(region.biome);
    if (pitched) {
      const roof = add(new THREE.ConeGeometry(1, 1, 4), mats.roof, group, 0, b.h + lift + 1.35, 0, b.w * 0.77, 2.6, b.d * 0.77);
      roof.rotation.y = Math.PI / 4;
      if (region.biome === 'highland') {
        const lower = add(new THREE.ConeGeometry(1, 1, 4), mats.roof, group, 0, b.h + lift - 0.12, 0, b.w * 0.9, 1.5, b.d * 0.9); lower.rotation.y = Math.PI / 4;
        for (const side of [-1, 1]) box(group, side * (b.w / 2 - 0.22), b.h / 2, front + 0.14, 0.28, b.h, 0.2, mats.red);
      }
      if (region.biome === 'port') box(group, b.w * 0.28, b.h + 1.7, -b.d * 0.2, 0.8, 3.4, 0.8, mats.trim);
    } else {
      for (const side of [-1, 1]) {
        box(group, side * b.w / 2, b.h + 0.45, 0, 0.25, 0.8, b.d, mats.wall);
        box(group, 0, b.h + 0.45, side * b.d / 2, b.w, 0.8, 0.25, mats.wall);
      }
      if (i % 3 === 0 && region.biome !== 'border') add(new THREE.SphereGeometry(1, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), mats.roof, group, 0, b.h + 0.1, -0.4, 2.2, 2.1, 2.2);
    }
    if (region.returning) for (const dx of [-1, 1]) {
      add(new THREE.CylinderGeometry(0.33, 0.24, 0.5, 8), mats.red, group, dx * 1.45, 0.25, front + 0.5);
      add(sphere, mats.paleLeaf, group, dx * 1.45, 0.72, front + 0.5, 0.5, 0.45, 0.5);
    }
    const rotated = Math.abs(Math.sin(b.rotation)) > 0.5;
    colliders.push({ x: b.x, z: b.z, w: rotated ? b.d : b.w, d: rotated ? b.w : b.d, h: base + b.h + lift, base });
  }

  const tree = (x: number, z: number, scale: number, type: 'olive' | 'cedar' | 'palm' | 'broad') => {
    const g = new THREE.Group(); g.position.set(x, baseHeight(x, z), z); g.scale.setScalar(scale); statics.add(g);
    const trunk = add(cylinder, mats.bark, g, 0, type === 'palm' ? 2.7 : 1.6, 0, 0.17, type === 'palm' ? 5.4 : 3.2, 0.17);
    trunk.rotation.z = 0.04;
    if (type === 'cedar') {
      for (let j = 0; j < 4; j++) add(new THREE.ConeGeometry(1, 1, 8), j % 2 ? mats.leaf : mats.paleLeaf, g, 0, 2.1 + j * 0.88, 0, 1.95 - j * 0.34, 1.8, 1.95 - j * 0.34);
    } else if (type === 'palm') {
      for (let j = 0; j < 8; j++) {
        const angle = j * Math.PI / 4;
        const leaf = add(sphere, j % 2 ? mats.leaf : mats.paleLeaf, g, Math.cos(angle) * 1.35, 5.3, Math.sin(angle) * 1.35, 1.7, 0.14, 0.43);
        leaf.rotation.y = -angle; leaf.rotation.z = 0.24;
      }
      add(sphere, mats.gold, g, 0.2, 4.8, 0, 0.35, 0.6, 0.35);
    } else {
      for (let j = 0; j < 5; j++) {
        const angle = j * 1.256;
        const branch = add(cylinder, mats.bark, g, Math.sin(angle) * 0.5, 2.6, Math.cos(angle) * 0.5, 0.07, 1.8, 0.07);
        branch.rotation.z = Math.sin(angle) * -0.6; branch.rotation.x = Math.cos(angle) * 0.6;
        add(sphere, j % 2 ? mats.leaf : mats.paleLeaf, g, Math.sin(angle) * 0.85, 3.5 + random() * 0.6, Math.cos(angle) * 0.85, type === 'broad' ? 1.65 : 1.1, type === 'broad' ? 1.25 : 0.7, type === 'broad' ? 1.5 : 1.15);
      }
    }
  };
  const treeType = ['oasis', 'desert', 'city', 'border'].includes(region.biome) ? 'palm' : mountain || region.biome === 'citadel' || region.biome === 'port' ? 'cedar' : region.biome === 'river' ? 'broad' : 'olive';
  const treeCount = region.biome === 'desert' ? 8 : region.biome === 'border' ? 8 : 26;
  for (let i = 0; i < treeCount; i++) {
    const side = i % 2 ? 1 : -1;
    const x = side * (i % 3 ? 30 + random() * 20 : 11 + random() * 1.3);
    const z = 25 - random() * region.span;
    if (mountain && z < bridgeStart + 4 && z > bridgeEnd - 4) continue;
    if (Math.abs(x) < 15 && [...region.objectives.map(o => o.at), ...region.npcs.map(n => n.at)].some(at => Math.hypot(at[0] - x, at[1] - z) < 2.2)) continue;
    tree(x, z, 0.85 + random() * 0.5, treeType);
  }

  if (region.biome === 'village') {
    for (let row = 0; row < 4; row++) {
      box(statics, 9 + row * 1.1, 0.06, -10, 0.65, 0.12, 9, mats.trim);
      for (let c = 0; c < 7; c++) add(new THREE.ConeGeometry(0.19, 0.65, 5), mats.crop, statics, 9 + row * 1.1, 0.36, -6.5 - c * 1.05);
    }
    for (const side of [-1, 1]) {
      for (let row = 0; row < 8; row++) {
        box(statics, side * (35 + row * 1.5), 0.1, -12, 0.9, 0.2, 45, mats.trim);
        for (let c = 0; c < 18; c++) {
          const plant = add(new THREE.ConeGeometry(0.3, 0.8, 5), mats.crop, statics, side * (35 + row * 1.5), 0.48, 8 - c * 2.4);
          plant.rotation.z = random() * 0.2;
        }
      }
      for (let z = 12; z > -40; z -= 5) {
        box(statics, side * 28, 0.8, z, 0.12, 1.6, 0.12, mats.wood);
        box(statics, side * 28, 1, z - 2.5, 0.1, 0.08, 5, mats.wood);
      }
    }
    const well = add(new THREE.CylinderGeometry(1.2, 1.4, 0.7, 16, 1, true), mats.trim, statics, -8, 0.35, -5);
    well.material.side = THREE.DoubleSide;
    for (const dx of [-1.1, 1.1]) box(statics, -8 + dx, 1.5, -5, 0.15, 3, 0.15, mats.wood);
    box(statics, -8, 2.9, -5, 2.8, 0.2, 0.2, mats.wood);
    if (region.returning) {
      const channel = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 50), new THREE.MeshStandardMaterial({ color: 0x5e9690, metalness: 0.3, roughness: 0.2 }));
      channel.rotation.x = -Math.PI / 2; channel.position.set(12.8, 0.04, -13); root.add(channel);
      sign('THE WATER BELONGS TO EVERYONE', 0, 4.3, -6, 7);
    }
  }

  if (mountain) {
    const mid = (bridgeStart + bridgeEnd) / 2; const length = bridgeStart - bridgeEnd;
    for (let z = bridgeEnd; z <= bridgeStart + 0.5; z += 0.55) box(statics, 0, 1.89, z, 5.4, 0.22, 0.49, mats.wood);
    for (const side of [-1, 1]) {
      for (let z = bridgeEnd; z <= bridgeStart; z += 3.5) box(statics, side * 2.55, 2.5, z, 0.13, 1.1, 0.13, mats.wood);
      box(statics, side * 2.6, 2.95, mid, 0.075, 0.09, length, mats.wood);
      colliders.push({ x: side * (width / 2 + 1.275), z: mid, w: width - 2.55, d: length - 0.2, h: 30 });
    }
    for (let i = 0; i < 18; i++) {
      const side = i % 2 ? 1 : -1;
      const x = side * (width + 12 + random() * 20); const z = 20 - random() * region.span;
      add(sphere, mats.rock, statics, x, baseHeight(x, z) + 2, z, 4 + random() * 5, 4 + random() * 5, 4 + random() * 6);
    }
    if (region.biome === 'mountain') {
      for (const side of [-1, 1]) {
        add(sphere, mats.rock, statics, side * 8.5, baseHeight(0, -63) + 3.5, -63, 3.8, 5.5, 10);
        colliders.push({ x: side * 8.5, z: -63, w: 5, d: 16, base: 2.5, h: 9 });
      }
      add(sphere, mats.rock, statics, 0, 10, -63, 11.2, 2.3, 9);
    }
  }

  if (region.biome === 'desert') {
    for (let i = 0; i < 17; i++) {
      const x = (i % 2 ? 1 : -1) * (width + 39 + random() * 48); const z = 12 - random() * (region.span + 50);
      const dune = add(new THREE.SphereGeometry(1, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), mats.ground, statics, x, 0, z, 22 + random() * 14, 6 + random() * 10, 29 + random() * 19);
      dune.rotation.y = random() * 2;
    }
    for (let z = 3; z > -144; z -= 13) for (const side of [-1, 1]) add(sphere, mats.rock, statics, side * 3.6, 0.35, z, 0.42, 0.5, 0.37);
    tree(12, -106, 1.3, 'palm'); tree(17, -100, 1.1, 'palm');
  }

  if (region.biome === 'port' || region.biome === 'river' || region.biome === 'city' || region.biome === 'allies') {
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(250, 400), new THREE.MeshStandardMaterial({ color: region.biome === 'river' ? 0x367b6e : 0x477a81, roughness: 0.3, metalness: 0.28 }));
    sea.rotation.x = -Math.PI / 2; sea.position.set(173, -0.6, -65); root.add(sea);
    if (region.biome === 'river') for (const side of [-1, 1]) {
      const canalLength = region.span - 12;
      const canal = new THREE.Mesh(new THREE.PlaneGeometry(12, canalLength), new THREE.MeshStandardMaterial({ color: 0x3e867c, roughness: 0.24, metalness: 0.32 }));
      canal.rotation.x = -Math.PI / 2; canal.position.set(side * 20, -0.1, 18 - canalLength / 2); root.add(canal);
      for (const z of [11, -8, -43]) box(statics, side * 17, 0.15, z, 11, 0.2, 1.8, mats.wood);
    }
    for (let i = 0; i < 3; i++) {
      box(statics, 46 + i * 6, 0.04, -12 - i * 19, 20, 0.3, 4.1, mats.wood);
      for (let p = 0; p < 5; p++) box(statics, 37 + i * 6 + p * 4, -0.8, -12 - i * 19, 0.28, 2, 0.28, mats.wood);
    }
    if (region.biome === 'port') {
      add(new THREE.CylinderGeometry(2, 3.2, 17, 12), mats.white, statics, 42, 8.5, -75);
      add(cylinder, lamps, statics, 42, 17.5, -75, 2.4, 1.8, 2.4);
      add(new THREE.ConeGeometry(3, 2.4, 12), mats.roof, statics, 42, 19.5, -75);
      box(statics, 64, 0.6, -26, 5, 2.3, 17, mats.door);
      box(statics, 64, 2.4, -27, 4.1, 1.4, 8, mats.white);
      box(statics, 64, 4.2, -28, 3.5, 1.9, 4.5, mats.white);
      box(statics, 64, 4.3, -25.72, 2.6, 0.55, 0.05, mats.dark);
    }
  }

  if (['city', 'medina', 'oasis', 'allies'].includes(region.biome)) {
    for (const [i, x] of [-10, 10].entries()) {
      const z = -17 - i * 19;
      for (const side of [-1, 1]) box(statics, x + side * 1.4, 1.55, z - 0.5, 0.08, 3.1, 0.08, mats.wood);
      box(statics, x, 0.5, z, 2.9, 1, 1.3, mats.wood);
      for (let k = 0; k < 7; k++) {
        const awning = box(statics, x - 1.5 + k * 0.5, 2.9, z, 0.51, 0.04, 2.4, k % 2 ? mats.cloth : i % 2 ? mats.door : mats.red); awning.rotation.x = 0.1;
      }
      for (let k = 0; k < 10; k++) add(sphere, mats.gold, statics, x + (random() - 0.5) * 2.4, 1.12, z + (random() - 0.5) * 0.8, 0.15, 0.14, 0.14);
      colliders.push({ x, z, w: 2.9, d: 1.3, h: 1, climb: true });
    }
  }

  for (const [i, z] of [5, -23, -51, -76].entries()) {
    for (const side of [-1, 1]) {
      if (mountain && z < bridgeStart && z > bridgeEnd) continue;
      const x = side * 12.4; const y = baseHeight(x, z);
      add(cylinder, mats.metal, statics, x, y + 1.8, z, 0.055, 3.6, 0.055);
      box(statics, x, y + 3.7, z, 0.32, 0.5, 0.32, lamps);
      add(new THREE.ConeGeometry(0.28, 0.25, 4), mats.metal, statics, x, y + 4.05, z);
      if (region.night && i % 2 === 0) {
        const glow = new THREE.PointLight(0xf4c879, 11, 11, 1.7); glow.position.set(x, y + 3.6, z); root.add(glow);
      }
    }
  }

  if (['village', 'city', 'medina', 'allies', 'border', 'oasis'].includes(region.biome)) {
    for (let row = 0; row < (region.returning ? 4 : 2); row++) {
      const z = 2 - row * 21;
      box(statics, 0, 6.5, z, 31, 0.035, 0.035, mats.metal);
      for (let i = 0; i < 9; i++) {
        const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.95, region.returning ? 1.35 : 0.9, 2, 2), new THREE.MeshStandardMaterial({ color: [palette.roof, 0xd1bc91, palette.trim, 0x749b88][i % 4], side: THREE.DoubleSide, roughness: 1 }));
        flag.position.set(-12 + i * 3, 6, z); root.add(flag); flags.push(flag);
      }
    }
  }

  for (const objective of region.objectives) {
    if (!['inspect', 'deduce', 'finish'].includes(objective.kind)) continue;
    const [x, z] = objective.at; const y = heightAt(x, z);
    if (objective.id === 'v-well') continue;
    const archive = region.biome === 'citadel';
    box(statics, x, y + 0.55, z, objective.kind === 'deduce' ? 2.8 : 1.1, 1.1, objective.kind === 'deduce' ? 1.65 : 0.8, archive ? mats.metal : mats.wood);
    if (objective.kind === 'deduce') {
      box(statics, x, y + 1.12, z, 2.65, 0.025, 1.5, mats.cloth);
      for (let p = 0; p < 5; p++) box(statics, x - 0.9 + p * 0.45, y + 1.15, z + Math.sin(p) * 0.4, 0.12, 0.06, 0.12, mats.gold);
    } else {
      const paper = box(statics, x, y + 1.13, z, 0.48, 0.035, 0.36, archive ? lamps : mats.cloth); paper.rotation.y = 0.2;
      if (archive) box(statics, x, y + 1.35, z - 0.2, 0.72, 0.45, 0.08, mats.door);
    }
  }

  if (['mountain', 'citadel', 'port', 'oasis'].includes(region.biome)) {
    for (const [x, z] of [[-4, -8], [5, -23], [-3, -41], [6, -57]] as Point[]) {
      if (mountain && z < bridgeStart && z > bridgeEnd) continue;
      if (region.objectives.some(o => Math.hypot(o.at[0] - x, o.at[1] - z) < 2.2)) continue;
      const y = heightAt(x, z);
      box(statics, x, y + 0.65, z, 1.6, 1.3, 1.5, mats.wood);
      for (const offset of [-0.48, 0.48]) box(statics, x + offset, y + 0.65, z + 0.76, 0.08, 1.3, 0.04, mats.trim);
      colliders.push({ x, z, w: 1.6, d: 1.5, base: y, h: y + 1.3, climb: true });
    }
  }

  let gate: THREE.Group | null = null;
  let gateCollider: Collider | null = null;
  if (region.biome === 'border') {
    for (const x of [-10, 10]) box(statics, x, 3, -46, 1.4, 6, 1.4, mats.wall);
    box(statics, 0, 6.25, -46, 22, 0.9, 1.6, mats.wall);
    sign('MIZAN / OFFICIAL PASSAGE', 0, 6.22, -45.17, 10);
    gate = new THREE.Group(); gate.position.set(-10, 1.1, -46); root.add(gate);
    for (let i = 0; i < 20; i++) box(gate, i + 0.5, 0, 0, 1, 0.3, 0.18, i % 2 ? mats.red : mats.white);
    gateCollider = { x: 0, z: -46, w: 56, d: 0.35, h: 12 };
    colliders.push(gateCollider);
  }
  if (region.biome === 'citadel') {
    for (const side of [-1, 1]) {
      box(statics, side * 19, 6, -52, 10, 12, 55, mats.wall);
      colliders.push({ x: side * 19, z: -52, w: 10, d: 55, h: 12 });
      for (let i = 0; i < 10; i++) box(statics, side * 13.95, 4.2, -29 - i * 5, 0.08, 2.8, 0.5, lamps);
    }
    box(statics, 0, 4, -94, 39, 8, 13, mats.wall);
    add(new THREE.SphereGeometry(9, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2), mats.roof, statics, 0, 8, -94);
    const telescope = add(cylinder, mats.metal, statics, 0, 15, -94, 1, 12, 1); telescope.rotation.z = -0.7;
    sign('ATLAS / CONTROL ARCHIVE', 0, 5, -87.4, 9);
    colliders.push({ x: 0, z: -94, w: 39, d: 13, h: 18 });
  }

  const words: Partial<Record<Biome, string>> = { village: 'TAGHZOUT', plateau: 'STEPPE / STATION 17', city: 'AMAN TIRA / NERAYA', medina: 'DAR NARA / SEFRA', port: 'VEL NAR / ASTER', highland: 'SAI LUM / SARIN', river: 'LUA MIRI / NORIA', allies: 'THE MEETING HOUSE', oasis: 'NAMAR' };
  if (words[region.biome]) {
    box(statics, 7.4, 2, 20, 0.1, 4, 0.1, mats.wood);
    sign(words[region.biome]!, 7.4, 3.25, 20.06, 4.5);
  }
  for (let i = 0; i < 14; i++) {
    const x = -150 + i * 24; const z = bounds.minZ - 95 - random() * 35;
    const peak = add(new THREE.ConeGeometry(1, 1, 7), mats.rock, statics, x, 12, z, 25 + random() * 13, mountain || region.biome === 'citadel' ? 55 + random() * 35 : 23 + random() * 17, 28 + random() * 15);
    peak.rotation.y = random();
  }
  mergeStatic(statics, root);
  // Terrain remains separately culled and never casts a giant shadow over the scene.
  return { root, colliders, water, flags, lamps, bounds, heightAt, waterAt, sky: new THREE.Color(palette.sky), updateProgress(completed) {
    if (gate && gateCollider) {
      const open = completed.includes('b-permit');
      gate.rotation.z = open ? Math.PI / 2 : 0;
      gateCollider.disabled = open;
    }
  } };
}

export function createVehicle(): { root: THREE.Group; wheels: THREE.Group[] } {
  const root = new THREE.Group();
  const wheels: THREE.Group[] = [];
  const paint = new THREE.MeshStandardMaterial({ color: 0xa89970, metalness: 0.35, roughness: 0.6 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x29352f, roughness: 0.88 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x727d6d, metalness: 0.65, roughness: 0.4 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x609c9b, metalness: 0.38, roughness: 0.2, transparent: true, opacity: 0.8 });
  const lamp = new THREE.MeshStandardMaterial({ color: 0xffe3a2, emissive: 0xf5bf67, emissiveIntensity: 1.6 });
  const box = (x: number, y: number, z: number, w: number, h: number, d: number, mat: THREE.Material) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = true; root.add(mesh); return mesh;
  };
  box(0, 0.72, 0, 1.82, 0.53, 3.55, paint);
  box(0, 0.38, 0, 1.48, 0.22, 3.35, dark);
  box(0, 1.18, -1.08, 1.76, 0.26, 1.25, paint);
  box(0, 1.27, 0.14, 1.72, 0.9, 1.65, dark);
  box(0, 1.85, 0.13, 1.9, 0.14, 1.9, paint);
  box(0, 1.48, -0.68, 1.55, 0.58, 0.05, glass);
  box(0, 1.48, 0.98, 1.55, 0.56, 0.05, glass);
  for (const side of [-1, 1]) {
    box(side * 0.875, 1.51, 0.12, 0.045, 0.56, 1.5, glass);
    box(side * 0.88, 1.49, 0.17, 0.06, 0.64, 0.09, paint);
    box(side * 0.99, 1.42, -0.56, 0.26, 0.18, 0.15, dark);
    box(side * 0.9, 0.47, 0, 0.27, 0.12, 1.6, metal);
    box(side * 0.61, 1.07, -1.8, 0.34, 0.2, 0.08, lamp);
    for (const z of [-1.17, 1.17]) {
      const wheel = new THREE.Group(); wheel.position.set(side * 0.99, 0.5, z); root.add(wheel);
      const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.49, 0.49, 0.33, 16), dark); tire.rotation.z = Math.PI / 2; tire.castShadow = true; wheel.add(tire);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.345, 10), metal); hub.rotation.z = Math.PI / 2; wheel.add(hub);
      wheels.push(wheel);
    }
  }
  box(0, 0.56, -1.89, 2, 0.19, 0.18, metal);
  box(0, 0.62, 1.91, 1.96, 0.18, 0.16, metal);
  box(0, 1.94, 0.2, 1.57, 0.06, 1.58, metal);
  box(0.17, 2.08, 0.3, 0.9, 0.23, 0.94, dark);
  return { root, wheels };
}

export function disposeTree(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh || object instanceof THREE.Points || object instanceof THREE.Sprite)) return;
    if (!(object instanceof THREE.Sprite)) geometries.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      materials.add(material);
      Object.values(material).forEach(value => { if (value instanceof THREE.Texture) textures.add(value); });
    }
  });
  geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose());
}