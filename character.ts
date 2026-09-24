import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Profile } from './types';
import type { ActorDefinition } from './campaign';

export interface Character {
  root: THREE.Group;
  rig: THREE.Group;
  weapon: THREE.Group;
  animate: (time: number, speed: number, crouch: boolean, swimming: boolean, aiming: boolean, recoil: number, activity?: 'work' | 'talk') => void;
}

const OUTFITS = { olive: 0x526052, sand: 0xb7a17a, midnight: 0x334b5c };

export function createCharacter(profile: Profile, npc = false, appearance?: ActorDefinition): Character {
  const root = new THREE.Group();
  const rig = new THREE.Group();
  root.add(rig);
  const materials = {
    jacket: new THREE.MeshStandardMaterial({ color: appearance?.color ?? (npc ? 0xb1a17e : OUTFITS[profile.outfit]), roughness: 0.87 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x293332, roughness: 0.95 }),
    skin: new THREE.MeshStandardMaterial({ color: 0xb47f5d, roughness: 0.83 }),
    hair: new THREE.MeshStandardMaterial({ color: appearance?.hair ?? 0x252522, roughness: 1 }),
    leather: new THREE.MeshStandardMaterial({ color: 0x675641, roughness: 0.92 }),
    brass: new THREE.MeshStandardMaterial({ color: 0xbba377, metalness: 0.58, roughness: 0.37 }),
    cloth: new THREE.MeshStandardMaterial({ color: 0x9c8d68, roughness: 1 }),
    glow: new THREE.MeshStandardMaterial({ color: 0x8dddd5, emissive: 0x41aaa3, emissiveIntensity: 1.4, metalness: 0.2 }),
  };
  const box = (parent: THREE.Object3D, size: [number, number, number], at: [number, number, number], material: THREE.Material, round = false) => {
    const mesh = new THREE.Mesh(round ? new THREE.CapsuleGeometry(size[0] / 2, Math.max(0.01, size[1] - size[0]), 4, 8) : new THREE.BoxGeometry(...size), material);
    if (round) mesh.scale.z = size[2] / size[0];
    mesh.position.set(...at);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };

  box(rig, [0.62, 0.7, 0.37], [0, 1.23, 0], materials.jacket, true);
  box(rig, [0.57, 0.13, 0.38], [0, 0.93, 0], materials.dark);
  box(rig, [0.12, 0.09, 0.03], [0, 0.94, -0.208], materials.brass);
  box(rig, [0.035, 0.57, 0.025], [0, 1.25, -0.19], materials.brass);

  const head = new THREE.Group();
  head.position.y = 1.72;
  rig.add(head);
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.205, 12, 10), materials.skin);
  face.scale.set(0.9, 1.15, 0.94);
  face.castShadow = true;
  head.add(face);
  box(head, [0.11, 0.065, 0.065], [0, -0.015, -0.19], materials.skin, true);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.214, 12, 8, 0, Math.PI * 2, 0, profile.hair === 'cropped' ? 1.45 : 1.68), materials.hair);
  hair.position.set(0, 0.055, 0.016);
  hair.scale.y = profile.hair === 'cropped' ? 0.93 : 1.12;
  head.add(hair);
  if (appearance?.female) {
    const bun = new THREE.Mesh(new THREE.SphereGeometry(0.13, 9, 8), materials.hair);
    bun.position.set(0, 0.12, 0.19); head.add(bun);
  }
  if (appearance?.elder) box(head, [0.23, 0.12, 0.12], [0, -0.17, -0.09], materials.hair, true);
  if (appearance?.scarf) {
    const scarf = new THREE.MeshStandardMaterial({ color: appearance.scarf, roughness: 1 });
    box(rig, [0.37, 0.12, 0.32], [0, 1.56, 0], scarf, true);
    box(rig, [0.14, 0.41, 0.04], [-0.12, 1.36, -0.23], scarf);
  }
  for (const side of [-1, 1]) {
    box(head, [0.065, 0.095, 0.06], [side * 0.178, -0.015, 0], materials.skin, true);
    box(head, [0.036, 0.025, 0.022], [side * 0.079, 0.023, -0.18], materials.hair);
    box(rig, [0.075, 0.59, 0.055], [side * 0.21, 1.24, -0.17], materials.leather);
    box(rig, [0.18, 0.16, 0.045], [side * 0.16, 1.25, -0.19], materials.jacket);
  }
  if (profile.glasses && !npc) {
    for (const side of [-1, 1]) box(head, [0.14, 0.075, 0.035], [side * 0.078, 0.035, -0.185], materials.dark);
    box(head, [0.06, 0.025, 0.04], [0, 0.045, -0.19], materials.brass);
  }

  if (profile.backpack && !npc) {
    box(rig, [0.49, 0.54, 0.26], [0, 1.28, 0.265], materials.cloth, true);
    box(rig, [0.4, 0.18, 0.08], [0, 1.12, 0.41], materials.leather, true);
    for (const side of [-1, 1]) {
      box(rig, [0.05, 0.48, 0.025], [side * 0.14, 1.28, 0.4], materials.leather);
      box(rig, [0.075, 0.07, 0.03], [side * 0.14, 1.2, 0.43], materials.brass);
    }
  }

  const arms: THREE.Group[] = [];
  const forearms: THREE.Group[] = [];
  const legs: THREE.Group[] = [];
  const knees: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(side * 0.39, 1.49, 0);
    rig.add(arm);
    box(arm, [0.21, 0.37, 0.23], [0, -0.15, 0], materials.jacket, true);
    const forearm = new THREE.Group();
    forearm.position.y = -0.32;
    arm.add(forearm);
    box(forearm, [0.16, 0.3, 0.18], [0, -0.13, 0], materials.jacket, true);
    box(forearm, [0.15, 0.15, 0.17], [0, -0.3, -0.02], materials.dark, true);
    arms.push(arm);
    forearms.push(forearm);
    const leg = new THREE.Group();
    leg.position.set(side * 0.17, 0.93, 0);
    rig.add(leg);
    box(leg, [0.25, 0.46, 0.27], [0, -0.19, 0], materials.dark, true);
    box(leg, [0.055, 0.18, 0.23], [side * 0.13, -0.2, 0.015], materials.jacket);
    const knee = new THREE.Group();
    knee.position.y = -0.39;
    leg.add(knee);
    box(knee, [0.21, 0.39, 0.23], [0, -0.16, 0], materials.dark, true);
    box(knee, [0.25, 0.19, 0.4], [0, -0.42, -0.075], materials.leather, true);
    legs.push(leg);
    knees.push(knee);
  }
  const weapon = new THREE.Group();
  weapon.position.set(0, -0.33, -0.13);
  forearms[1].add(weapon);
  box(weapon, [0.13, 0.13, 0.46], [0, 0, -0.14], materials.dark);
  box(weapon, [0.16, 0.11, 0.14], [0, 0, -0.3], materials.brass);
  box(weapon, [0.175, 0.065, 0.075], [0, 0.015, -0.37], materials.glow);
  box(weapon, [0.06, 0.06, 0.3], [0, 0.095, -0.14], materials.brass);
  if (npc) weapon.visible = false;

  const animate: Character['animate'] = (time, speed, crouch, swimming, aiming, recoil, activity) => {
    const stride = Math.min(1, speed / 4.8);
    const phase = time * (speed > 6 ? 14 : 10);
    const wave = Math.sin(phase) * stride;
    rig.position.y = (crouch ? -0.44 : 0) + Math.abs(Math.sin(phase)) * stride * 0.065;
    rig.rotation.x = swimming ? -0.95 : crouch ? -0.22 : -stride * 0.06;
    rig.rotation.z = Math.sin(phase) * stride * 0.025;
    head.rotation.x = crouch ? 0.18 : Math.sin(time * 1.2) * 0.018;
    for (let i = 0; i < 2; i++) {
      const sign = i === 0 ? 1 : -1;
      legs[i].rotation.x = wave * 0.72 * sign - (crouch ? 0.8 : 0);
      knees[i].rotation.x = Math.max(0, -wave * sign) * 0.9 + (crouch ? 1.3 : 0);
      arms[i].rotation.x = swimming ? Math.sin(phase + i * Math.PI) * 1.3 - 1 : wave * -0.62 * sign;
      arms[i].rotation.z = sign * 0.055;
      forearms[i].rotation.x = -0.17 - Math.max(0, wave * sign) * 0.25;
    }
    if (aiming || recoil > 0.02) {
      arms[1].rotation.x = 1.25 + recoil * 0.9;
      forearms[1].rotation.x = 0.22;
      arms[0].rotation.x = 0.85;
      arms[0].rotation.z = -0.35;
    }
    if (npc && activity && speed < 0.2) {
      const gesture = Math.sin(time * (activity === 'work' ? 1.7 : 1.1));
      arms[1].rotation.x = activity === 'work' ? 0.55 + gesture * 0.2 : Math.max(0, gesture) * 0.45;
      forearms[1].rotation.x = activity === 'work' ? 0.35 : Math.max(0, gesture) * 0.3;
      head.rotation.x += Math.sin(time * 1.5) * 0.025;
    }
    weapon.position.z = -0.13 + recoil * 0.12;
  };
  // Merge the fixed details within each joint while preserving the articulated rig.
  const joints: THREE.Group[] = [];
  root.traverse(object => { if (object instanceof THREE.Group) joints.push(object); });
  for (const joint of joints) {
    const batches = new Map<THREE.Material, THREE.Mesh[]>();
    for (const child of joint.children) {
      if (!(child instanceof THREE.Mesh) || Array.isArray(child.material)) continue;
      const batch = batches.get(child.material) ?? [];
      batch.push(child);
      batches.set(child.material, batch);
    }
    for (const [material, meshes] of batches) {
      if (meshes.length < 2) continue;
      const geometries = meshes.map(mesh => {
        mesh.updateMatrix();
        return mesh.geometry.clone().applyMatrix4(mesh.matrix);
      });
      const geometry = mergeGeometries(geometries);
      if (geometry) {
        const merged = new THREE.Mesh(geometry, material);
        merged.castShadow = merged.receiveShadow = true;
        joint.add(merged);
        meshes.forEach(mesh => { joint.remove(mesh); mesh.geometry.dispose(); });
      }
      geometries.forEach(g => g.dispose());
    }
  }
  animate(0, 0, false, false, false, 0);
  return { root, rig, weapon, animate };
}