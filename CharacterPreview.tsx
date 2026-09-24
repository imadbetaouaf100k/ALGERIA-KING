import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { createCharacter } from '../game/character';
import type { Profile } from '../game/types';

export default function CharacterPreview({ profile }: { profile: Profile }) {
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!container.current) return;
    const host = container.current;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' }); }
    catch { host.textContent = '3D preview unavailable. Your outfit can still be equipped.'; return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    host.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 30);
    camera.position.set(0.1, 1.65, 4.6);
    camera.lookAt(0, 1.04, 0);
    const hero = createCharacter(profile);
    hero.root.rotation.y = Math.PI + 0.3;
    scene.add(hero.root);
    const ambient = new THREE.HemisphereLight(0xf4e5c8, 0x617e75, 2.5);
    const key = new THREE.DirectionalLight(0xffda9a, 3.5);
    key.position.set(-3, 4, 4);
    const rim = new THREE.DirectionalLight(0x86c8bd, 2.7);
    rim.position.set(3, 2, -3);
    scene.add(ambient, key, rim);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.65, 0.658, 64), new THREE.MeshBasicMaterial({ color: 0x8d815a, transparent: true, opacity: 0.45, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -0.001;
    scene.add(ring);
    const size = () => { camera.aspect = host.clientWidth / Math.max(host.clientHeight, 1); camera.updateProjectionMatrix(); renderer.setSize(host.clientWidth, host.clientHeight); };
    const resize = new ResizeObserver(size);
    resize.observe(host);
    size();
    let dragging = false;
    let lastX = 0;
    let rotation = Math.PI + 0.3;
    const down = (e: PointerEvent) => { dragging = true; lastX = e.clientX; renderer.domElement.setPointerCapture(e.pointerId); };
    const move = (e: PointerEvent) => { if (dragging) { rotation += (e.clientX - lastX) * 0.012; lastX = e.clientX; } };
    const up = () => { dragging = false; };
    renderer.domElement.addEventListener('pointerdown', down);
    renderer.domElement.addEventListener('pointermove', move);
    renderer.domElement.addEventListener('pointerup', up);
    renderer.domElement.addEventListener('pointercancel', up);
    renderer.setAnimationLoop((time) => {
      hero.root.rotation.y = rotation + (dragging ? 0 : Math.sin(time * 0.0003) * 0.13);
      hero.animate(time / 1000, 0, false, false, false, 0);
      renderer.render(scene, camera);
    });
    return () => {
      resize.disconnect(); renderer.setAnimationLoop(null);
      scene.traverse(object => { if (object instanceof THREE.Mesh) { object.geometry.dispose(); (Array.isArray(object.material) ? object.material : [object.material]).forEach(m => m.dispose()); } });
      renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
    };
  }, [profile.outfit, profile.backpack, profile.glasses, profile.hair]);
  return <div ref={container} className="character-preview" aria-label="Interactive 3D preview of Yassine. Drag to rotate." />;
}