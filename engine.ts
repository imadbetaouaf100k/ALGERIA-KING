import * as THREE from 'three';
import { createBeacon, createDrone, createTarget, type Collider } from './world';
import { createCharacter, type Character } from './character';
import { createRegionWorld, createVehicle, disposeTree, relicLocations, type RegionWorld } from './regions';
import { ACTORS, CAMPAIGN, L, defaultJourney, local, validJourneySave, validateCampaign, type NpcPlacement, type Objective, type Point } from './campaign';
import { jt } from './journeyText';
import { sound } from './audio';
import { text } from './i18n';
import type { ConversationView, GameCallbacks, GameSnapshot, JourneyMarker, JourneyProgress, JourneyTransition, Localized, Profile, SavedRun, Settings, Weapon } from './types';

export type GameAction = 'jump' | 'crouch' | 'fire' | 'interact' | 'reload' | 'switch';
interface Particle { position: THREE.Vector3; velocity: THREE.Vector3; life: number; max: number; size: number }
interface Enemy { mesh: THREE.Group; hp: number; cooldown: number; phase: number; from: number; boss: boolean }
interface Bolt { position: THREE.Vector3; velocity: THREE.Vector3; life: number }
interface Tracer { from: THREE.Vector3; to: THREE.Vector3; life: number }
interface Npc { placement: NpcPlacement; character: Character; label: THREE.Sprite; home: THREE.Vector3; heard: boolean; trail: number }
interface Conversation { actor: string; lines: Localized[]; line: number; objective?: string; feedback?: string }
type Interaction = { type: 'npc'; actor: string } | { type: 'objective' } | { type: 'vehicle' } | { type: 'climb'; collider: Collider } | null;

export class GameEngine {
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(55, 1, 0.15, 460);
  private renderer: THREE.WebGLRenderer;
  private world!: RegionWorld;
  private regionRoot = new THREE.Group();
  private hero: Character;
  private heroShadow: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  private sun: THREE.DirectionalLight;
  private hemi: THREE.HemisphereLight;
  private npcs: Npc[] = [];
  private enemies: Enemy[] = [];
  private relics: { mesh: THREE.Group; id: string; collected: boolean }[] = [];
  private targets: { mesh: THREE.Group; hp: number; fall: number }[] = [];
  private marker = createBeacon(0xe0c280);
  private car: ReturnType<typeof createVehicle> | null = null;
  private carSpeed = 0;
  private carYaw = 0;
  private carIntegrity = 100;
  private driving = false;
  private braking = false;
  private carImpact = 0;
  private journey: JourneyProgress;
  private conversation: Conversation | null = null;
  private pendingTravel: JourneyTransition | null = null;
  private interaction: Interaction = null;
  private prompt: GameSnapshot['prompt'] = null;
  private promptLabel = '';
  private particles: Particle[] = [];
  private particleMesh: THREE.InstancedMesh;
  private bolts: Bolt[] = [];
  private boltMesh: THREE.InstancedMesh;
  private tracers: Tracer[] = [];
  private tracerMesh: THREE.InstancedMesh;
  private dust: THREE.Points;
  private dummy = new THREE.Object3D();
  private ray = new THREE.Ray();
  private box = new THREE.Box3();
  private temp = new THREE.Vector3();
  private up = new THREE.Vector3(0, 1, 0);
  private keys = new Set<string>();
  private actions = new Set<GameAction>();
  private joystick = new THREE.Vector2();
  private velocity = new THREE.Vector3();
  private verticalVelocity = 0;
  private groundHeight = 0;
  private grounded = true;
  private swimming = false;
  private crouching = false;
  private aiming = false;
  private firing = false;
  private dragging = false;
  private dragPointer = -1;
  private lastPointer = new THREE.Vector2();
  private yaw = 0;
  private pitch = 0.2;
  private health = 100;
  private score = 0;
  private xp = 0;
  private ammo = 12;
  private weapon: Weapon;
  private reloadTime = 0;
  private shotCooldown = 0;
  private recoil = 0;
  private hitFlash = 0;
  private damageFlash = 0;
  private shake = 0;
  private combo = 0;
  private comboTime = 0;
  private bestCombo = 0;
  private kills = 0;
  private regionTime = 0;
  private visualTime = 0;
  private sinceDamage = 0;
  private stepTime = 0;
  private snapshotTime = 0;
  private saveTime = 0;
  private trailTime = 0;
  private trail: THREE.Vector3[] = [];
  private ambientCooldown = 3;
  private lastFrame = 0;
  private fps = 60;
  private slowTime = 0;
  private paused = false;
  private ended = false;
  private disposed = false;
  private checkpointFlash = 0;
  private climb: { from: THREE.Vector3; to: THREE.Vector3; progress: number } | null = null;
  private resizeObserver: ResizeObserver;
  private settings: Settings;
  private profile: Profile;
  private callbacks: GameCallbacks;
  private container: HTMLElement;
  private noticeId = 0;

  constructor(container: HTMLElement, settings: Settings, profile: Profile, callbacks: GameCallbacks, saved?: SavedRun | null) {
    validateCampaign();
    this.container = container; this.settings = settings; this.profile = profile; this.callbacks = callbacks;
    const checkpoint = validJourneySave(saved) ? structuredClone(saved) : null;
    // Recover a checkpoint captured between committing an exit and loading its region.
    if (checkpoint?.journey && !checkpoint.journey.finished) {
      const progress = checkpoint.journey;
      const region = CAMPAIGN[progress.region];
      if (progress.step >= region.objectives.length) {
        if (progress.region === CAMPAIGN.length - 1) progress.finished = true;
        else {
          progress.region++; progress.step = 0; progress.vehicle = undefined; progress.companions = undefined; progress.trail = undefined;
          if (!progress.visited.includes(progress.region)) progress.visited.push(progress.region);
          checkpoint.position = [0, 0, 19]; checkpoint.yaw = 0; checkpoint.enemies = []; checkpoint.targets = [];
        }
      }
    }
    this.journey = checkpoint ? structuredClone(checkpoint.journey!) : defaultJourney();
    this.weapon = checkpoint?.weapon ?? profile.weapon; this.ammo = this.capacity;
    this.renderer = new THREE.WebGLRenderer({ antialias: settings.quality !== 'Low', powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.setAttribute('aria-label', 'Lions of Algeria story campaign. WASD to move, E to talk or interact, M for atlas, J for journal.');
    this.renderer.domElement.tabIndex = 0;
    container.appendChild(this.renderer.domElement);
    this.scene.background = new THREE.Color(0xc7d2b7); this.scene.fog = new THREE.Fog(0xc7d2b7, 55, 235);
    this.hemi = new THREE.HemisphereLight(0xf4edcf, 0x65796a, 2.2); this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffdba0, 2.7); this.sun.castShadow = true;
    Object.assign(this.sun.shadow.camera, { left: -39, right: 39, top: 42, bottom: -42, near: 1, far: 160 });
    this.sun.shadow.camera.updateProjectionMatrix();
    this.sun.shadow.bias = -0.0003; this.sun.shadow.normalBias = 0.06;
    this.scene.add(this.sun, this.sun.target);
    this.hero = createCharacter(profile); this.scene.add(this.hero.root);
    const shadowCanvas = document.createElement('canvas'); shadowCanvas.width = shadowCanvas.height = 64;
    const ctx = shadowCanvas.getContext('2d')!;
    const gradient = ctx.createRadialGradient(32, 32, 3, 32, 32, 31);
    gradient.addColorStop(0, 'rgba(0,0,0,.8)'); gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 64, 64);
    this.heroShadow = new THREE.Mesh(new THREE.PlaneGeometry(1.65, 1.65), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(shadowCanvas), transparent: true, depthWrite: false, opacity: 0.5 }));
    this.heroShadow.rotation.x = -Math.PI / 2; this.scene.add(this.heroShadow, this.marker);
    this.particleMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1), new THREE.MeshBasicMaterial({ color: 0xffffff }), 180);
    this.particleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.particleMesh.frustumCulled = false;
    for (let i = 0; i < 180; i++) {
      this.particles.push({ position: new THREE.Vector3(), velocity: new THREE.Vector3(), life: 0, max: 1, size: 0.06 });
      this.particleMesh.setColorAt(i, new THREE.Color(0xe8c889));
    }
    this.boltMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.12, 6, 5), new THREE.MeshBasicMaterial({ color: 0xf29b69 }), 32); this.boltMesh.frustumCulled = false;
    this.tracerMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.034, 0.02, 1, 6), new THREE.MeshBasicMaterial({ color: 0xc3f3d8, transparent: true, opacity: 0.9 }), 12); this.tracerMesh.frustumCulled = false;
    this.scene.add(this.particleMesh, this.boltMesh, this.tracerMesh);
    const dustGeometry = new THREE.BufferGeometry(); const dustPositions = new Float32Array(180 * 3);
    for (let i = 0; i < 180; i++) { dustPositions[i * 3] = Math.random() * 56 - 28; dustPositions[i * 3 + 1] = Math.random() * 18; dustPositions[i * 3 + 2] = Math.random() * 70 - 45; }
    dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
    this.dust = new THREE.Points(dustGeometry, new THREE.PointsMaterial({ color: 0xf2dfbb, size: 0.04, transparent: true, opacity: 0.4, depthWrite: false })); this.scene.add(this.dust);
    if (checkpoint) { this.health = checkpoint.health; this.score = checkpoint.score; this.xp = checkpoint.xp; this.ammo = checkpoint.ammo; this.kills = checkpoint.kills; this.bestCombo = checkpoint.bestCombo; }
    this.loadRegion(checkpoint);
    this.configure(settings);
    this.resizeObserver = new ResizeObserver(this.resize); this.resizeObserver.observe(container); this.resize();
    this.attachEvents(); this.animateWorld(0); this.updateEffects(0); this.updateCamera(1);
    this.renderer.render(this.scene, this.camera);
    this.lastFrame = performance.now(); this.renderer.setAnimationLoop(this.frame);
    this.checkpoint(); this.emit();
  }

  private get region() { return CAMPAIGN[this.journey.region]; }
  private get objective(): Objective | undefined { return this.journey.finished ? undefined : this.region.objectives[this.journey.step]; }
  private get capacity() { return this.weapon === 'azru' ? 12 : 6; }
  private loc(value: Localized) { return local(value, this.settings.language); }
  private say(key: Parameters<typeof jt>[1]) { return jt(this.settings.language, key); }

  private label(name: string) {
    const canvas = document.createElement('canvas'); canvas.width = 384; canvas.height = 96;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'rgba(18,35,26,.7)'; ctx.fillRect(0, 10, 384, 71);
    ctx.fillStyle = '#ead5a4'; ctx.font = '500 33px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.direction = this.settings.language === 'ar' ? 'rtl' : 'ltr';
    ctx.fillText(name, 192, 47, 362);
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false }));
    sprite.scale.set(2.45, 0.61, 1); sprite.position.y = 2.65;
    return sprite;
  }

  private loadRegion(saved?: SavedRun | null) {
    this.scene.remove(this.regionRoot); disposeTree(this.regionRoot); this.regionRoot = new THREE.Group();
    this.world = createRegionWorld(this.region); this.regionRoot.add(this.world.root); this.scene.add(this.regionRoot);
    this.npcs = []; this.enemies = []; this.relics = []; this.targets = []; this.bolts = []; this.tracers = [];
    this.particles.forEach(p => { p.life = 0; });
    this.clearInput(); this.carSpeed = 0; this.driving = false; this.carIntegrity = 100; this.carYaw = 0;
    this.verticalVelocity = 0; this.crouching = false; this.climb = null; this.conversation = null;
    this.swimming = false; this.grounded = true; this.regionTime = 0; this.ambientCooldown = 2.5;
    this.hero.root.visible = true;
    const position = saved?.position ?? [0, this.world.heightAt(0, 19), 19];
    this.hero.root.position.set(position[0], position[1], position[2]); this.yaw = saved?.yaw ?? 0;
    this.hero.root.rotation.y = this.yaw; this.groundHeight = this.world.heightAt(position[0], position[2]);
    this.trail = saved?.journey?.trail?.length ? saved.journey.trail.map(p => new THREE.Vector3(...p)) : [this.hero.root.position.clone()]; this.trailTime = 0;
    for (const placement of this.region.npcs) {
      const actor = ACTORS[placement.actor];
      const character = createCharacter(this.profile, true, actor);
      character.root.position.set(placement.at[0], this.world.heightAt(...placement.at), placement.at[1]);
      character.root.rotation.y = Math.PI * 0.8;
      const label = this.label(this.loc(actor.name)); character.root.add(label);
      const companionSave = saved?.journey?.companions?.[placement.actor];
      if (companionSave && placement.companionAfter && this.journey.completed.includes(placement.companionAfter)) character.root.position.fromArray(companionSave.position);
      if (placement.actor === 'shadow' && this.journey.finished) character.root.visible = false;
      this.regionRoot.add(character.root);
      this.npcs.push({ placement, character, label, home: character.root.position.clone(), heard: false, trail: companionSave?.trail ?? 0 });
    }
    for (const [i, definition] of (this.region.enemies ?? []).entries()) {
      const mesh = createDrone(); const [x, z] = definition.at;
      mesh.position.set(x, this.world.heightAt(x, z) + 2.2, z);
      if (definition.boss) mesh.scale.setScalar(1.65);
      const hp = saved?.enemies[i] ?? definition.hp;
      mesh.visible = hp > 0 && !this.journey.finished;
      this.enemies.push({ mesh, hp, cooldown: 2.8 + i, phase: i * 2.1, from: definition.from, boss: Boolean(definition.boss) });
      this.regionRoot.add(mesh);
    }
    for (const [i, point] of relicLocations(this.region).entries()) {
      const id = `${this.region.id}-memory-${i}`; const collected = this.journey.souvenirs.includes(id);
      const mesh = createBeacon(0x98c8b7); mesh.scale.setScalar(0.42);
      mesh.position.set(point[0], this.world.heightAt(...point) + 0.2, point[1]); mesh.visible = !collected;
      this.relics.push({ id, mesh, collected }); this.regionRoot.add(mesh);
    }
    if (this.journey.region === 0) {
      for (const [i, at] of ([[6, -38], [7, -45], [-5, -48]] as Point[]).entries()) {
        const mesh = createTarget(); mesh.position.set(at[0], this.world.heightAt(...at), at[1]);
        this.targets.push({ mesh, hp: this.journey.completed.includes(`v-target-${i}`) ? 0 : saved?.targets[i] ?? 1, fall: 0 }); this.regionRoot.add(mesh);
      }
    }
    this.car = this.region.vehicle ? createVehicle() : null;
    if (this.car && this.region.vehicle) {
      const at = saved?.journey?.vehicle;
      const [x, z] = this.region.vehicle;
      this.car.root.position.fromArray(at?.position ?? [x, this.world.heightAt(x, z), z]);
      this.carYaw = at?.yaw ?? 0; this.carIntegrity = at?.integrity ?? 100;
      this.car.root.rotation.y = this.carYaw; this.driving = at?.driving ?? false;
      this.hero.root.visible = !this.driving; this.regionRoot.add(this.car.root);
      if (this.driving) this.hero.root.position.copy(this.car.root.position);
    }
    this.world.updateProgress(this.journey.completed);
    if (this.journey.finished) this.world.updateProgress([...this.journey.completed, 'b-permit']);
    this.journey.chaseRemaining = this.objective?.kind === 'chase' ? saved?.journey?.chaseRemaining || this.objective.seconds || 65 : 0;
    this.camera.position.copy(this.hero.root.position).add(new THREE.Vector3(0, 4.5, 8));
    this.shake = 0; this.damageFlash = 0; this.hitFlash = 0; this.sinceDamage = 0;
    this.marker.visible = !this.journey.finished;
    sound.stopVoice(); sound.vehicle(0, false); sound.setRegion(this.region.biome);
    this.updatePrompts();
  }

  configure(settings: Settings) {
    const languageChanged = settings.language !== this.settings.language;
    this.settings = settings;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, { Low: 0.8, Medium: 1, High: 1.5, Ultra: 2 }[settings.quality]));
    this.renderer.shadowMap.enabled = settings.quality !== 'Low';
    const size = settings.quality === 'Ultra' ? 2048 : 1024;
    if (this.sun.shadow.mapSize.x !== size) { this.sun.shadow.mapSize.set(size, size); this.sun.shadow.map?.dispose(); this.sun.shadow.map = null; }
    if (languageChanged) {
      this.npcs.forEach(npc => {
        const old = npc.label; npc.character.root.remove(old); old.material.map?.dispose(); old.material.dispose();
        npc.label = this.label(this.loc(ACTORS[npc.placement.actor].name)); npc.character.root.add(npc.label);
      });
      sound.stopVoice();
    }
    sound.configure(settings); this.resize(); this.updatePrompts(); this.emit();
    this.animateWorld(0); this.renderer.render(this.scene, this.camera);
  }

  private resize = () => {
    const w = this.container.clientWidth; const h = this.container.clientHeight;
    if (!w || !h) return;
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); this.renderer.setSize(w, h);
  };
  private attachEvents() {
    window.addEventListener('keydown', this.keyDown); window.addEventListener('keyup', this.keyUp); window.addEventListener('blur', this.blur);
    document.addEventListener('visibilitychange', this.visibility);
    this.renderer.domElement.addEventListener('pointerdown', this.pointerDown); this.renderer.domElement.addEventListener('pointermove', this.pointerMove);
    this.renderer.domElement.addEventListener('contextmenu', this.contextMenu);
    window.addEventListener('pointerup', this.pointerUp); window.addEventListener('pointercancel', this.pointerUp);
  }
  private keyDown = (event: KeyboardEvent) => {
    if (this.paused || this.ended || this.pendingTravel || event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return;
    if (this.conversation) {
      if (['KeyE', 'Space', 'Enter', 'Digit1', 'Digit2', 'Digit3'].includes(event.code)) {
        if (['Space', 'Enter'].includes(event.code) && event.target instanceof HTMLElement && event.target.closest('button')) return;
        event.preventDefault(); if (event.repeat) return;
        if (event.code.startsWith('Digit')) this.chooseDialogue(Number(event.code.slice(5)) - 1);
        else this.advanceDialogue();
      }
      return;
    }
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyE', 'KeyF', 'KeyR', 'KeyC', 'KeyQ'].includes(event.code)) event.preventDefault();
    this.keys.add(event.code);
    if (event.repeat) return;
    const action: Record<string, GameAction> = { Space: 'jump', KeyC: 'crouch', ControlLeft: 'crouch', KeyE: 'interact', KeyR: 'reload', KeyQ: 'switch' };
    if (action[event.code]) this.actions.add(action[event.code]);
  };
  private keyUp = (event: KeyboardEvent) => { this.keys.delete(event.code); };
  private blur = () => { if (!this.paused && !this.ended && !this.pendingTravel) this.callbacks.pause(); this.clearInput(); sound.vehicle(0, false); sound.stopVoice(); };
  private visibility = () => { if (document.hidden) this.blur(); };
  private contextMenu = (event: MouseEvent) => event.preventDefault();
  private pointerDown = (event: PointerEvent) => {
    if (this.paused || this.ended || this.pendingTravel || this.conversation) return;
    sound.start();
    if (event.pointerType === 'touch' || event.button === 2) {
      this.dragging = true; this.dragPointer = event.pointerId;
      if (event.pointerType !== 'touch') this.aiming = true;
      this.lastPointer.set(event.clientX, event.clientY); this.renderer.domElement.setPointerCapture(event.pointerId);
    } else if (event.button === 0) this.firing = true;
  };
  private pointerMove = (event: PointerEvent) => {
    if (!this.dragging || this.paused || event.pointerId !== this.dragPointer) return;
    const sensitivity = 0.0018 + this.settings.sensitivity * 0.000042;
    this.yaw -= (event.clientX - this.lastPointer.x) * sensitivity;
    this.pitch = THREE.MathUtils.clamp(this.pitch + (event.clientY - this.lastPointer.y) * sensitivity * 0.5, -0.1, 0.8);
    this.lastPointer.set(event.clientX, event.clientY);
  };
  private pointerUp = (event: PointerEvent) => { if (event.pointerId === this.dragPointer) { this.dragging = false; this.dragPointer = -1; } if (event.pointerType === 'mouse') { this.aiming = false; this.firing = false; } };
  setJoystick(x: number, y: number) { if (!this.conversation) this.joystick.set(x, y); }
  action(action: GameAction) { if (!this.paused && !this.conversation) this.actions.add(action); }
  hold(action: 'fire' | 'aim' | 'brake', value: boolean) { if (action === 'fire') this.firing = value; else if (action === 'brake') this.braking = value; else this.aiming = value; }
  setPaused(value: boolean) { this.paused = value; this.clearInput(); if (value) { sound.vehicle(0, false); sound.stopVoice(); if (!this.ended) this.checkpoint(); } }
  private clearInput() { this.keys.clear(); this.actions.clear(); this.joystick.set(0, 0); this.velocity.set(0, 0, 0); this.firing = false; this.aiming = false; this.braking = false; this.dragging = false; }

  private frame = (now: number) => {
    if (this.disposed) return;
    const raw = Math.max(0.001, (now - this.lastFrame) / 1000); const dt = Math.min(raw, 0.04); this.lastFrame = now;
    if (this.paused || this.ended || this.pendingTravel) return;
    this.fps = THREE.MathUtils.lerp(this.fps, Math.min(144, 1 / raw), 0.025);
    this.slowTime = this.fps < 43 ? this.slowTime + dt : Math.max(0, this.slowTime - dt);
    if (this.slowTime > 4 && this.renderer.getPixelRatio() > 0.8) { this.renderer.setPixelRatio(Math.max(0.75, this.renderer.getPixelRatio() - 0.2)); this.slowTime = 0; }
    this.visualTime += dt;
    if (this.conversation) { this.hero.animate(this.visualTime, 0, this.crouching, this.swimming, false, 0); this.updateNpcs(dt, true); this.updateCamera(dt); }
    else this.update(dt);
    this.renderer.render(this.scene, this.camera);
  };

  private update(dt: number) {
    this.regionTime += dt; this.journey.elapsed += dt; this.sinceDamage += dt;
    this.ambientCooldown -= dt; this.checkpointFlash = Math.max(0, this.checkpointFlash - dt);
    this.shotCooldown = Math.max(0, this.shotCooldown - dt); this.recoil = Math.max(0, this.recoil - dt * 5.5);
    this.hitFlash = Math.max(0, this.hitFlash - dt * 3); this.damageFlash = Math.max(0, this.damageFlash - dt * 1.8);
    this.shake = Math.max(0, this.shake - dt * 1.3); this.carImpact = Math.max(0, this.carImpact - dt);
    this.comboTime = Math.max(0, this.comboTime - dt); if (!this.comboTime) this.combo = 0;
    if (this.sinceDamage > 9) this.health = Math.min(100, this.health + dt * 3);
    if (this.objective?.kind === 'chase') this.journey.chaseRemaining = Math.max(0, this.journey.chaseRemaining - dt);
    if (this.reloadTime > 0) { this.reloadTime -= dt; if (this.reloadTime <= 0) this.ammo = this.capacity; }
    if (this.actions.has('interact')) this.interact();
    if (this.conversation || this.pendingTravel || this.ended) { this.actions.clear(); this.emit(); return; }
    if (this.actions.has('crouch') && !this.driving) this.crouching = !this.crouching;
    if (this.actions.has('switch') && !this.driving) { this.weapon = this.weapon === 'azru' ? 'sirocco' : 'azru'; this.ammo = 0; this.reloadTime = 0; this.reload(); }
    if (this.actions.has('reload')) this.reload();
    if (this.driving) this.moveVehicle(dt); else this.move(dt);
    if (!this.driving && (this.firing || this.keys.has('KeyF') || this.actions.has('fire'))) this.fire();
    this.actions.clear();
    this.updateNpcs(dt); this.updateEnemies(dt); this.updateObjective();
    if (this.ended || this.pendingTravel) return;
    this.animateWorld(dt); this.updateEffects(dt); this.updatePrompts(); this.updateCamera(dt);
    if (this.health <= 0 || (this.objective?.kind === 'chase' && this.journey.chaseRemaining <= 0)) { this.finish(false); return; }
    this.snapshotTime += dt; this.saveTime += dt;
    if (this.snapshotTime > 0.1) { this.emit(); this.snapshotTime = 0; }
    if (this.saveTime > 5) { this.callbacks.save(this.getSave()); this.saveTime = 0; }
  }

  private input() {
    const x = (this.keys.has('KeyD') || this.keys.has('ArrowRight') ? 1 : 0) - (this.keys.has('KeyA') || this.keys.has('ArrowLeft') ? 1 : 0) + this.joystick.x;
    const y = (this.keys.has('KeyW') || this.keys.has('KeyZ') || this.keys.has('ArrowUp') ? 1 : 0) - (this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : 0) - this.joystick.y;
    return { x: THREE.MathUtils.clamp(x, -1, 1), y: THREE.MathUtils.clamp(y, -1, 1) };
  }
  private move(dt: number) {
    const p = this.hero.root.position;
    this.swimming = this.world.waterAt(p.x, p.z) && p.y < 0.3;
    if (this.climb) {
      this.climb.progress = Math.min(1, this.climb.progress + dt * 2.3); const t = this.climb.progress;
      p.lerpVectors(this.climb.from, this.climb.to, t * t * (3 - 2 * t)); p.y += Math.sin(t * Math.PI) * 0.5;
      this.hero.animate(this.regionTime, 2, false, false, true, 0);
      if (t === 1) { this.groundHeight = this.climb.to.y; this.climb = null; this.grounded = true; this.verticalVelocity = 0; }
      return;
    }
    const { x, y } = this.input();
    const sprint = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') || this.joystick.length() > 0.86;
    const speed = this.swimming ? 3.2 : this.crouching ? 2.5 : sprint ? 8.2 : 5.1;
    this.temp.set(x, 0, -y); if (this.temp.lengthSq() > 1) this.temp.normalize(); this.temp.applyAxisAngle(this.up, this.yaw).multiplyScalar(speed);
    this.velocity.lerp(this.temp, 1 - Math.exp(-dt * 18));
    this.moveWithCollision(p, this.velocity.x * dt, this.velocity.z * dt, 0.33);
    if (this.actions.has('jump') && (this.grounded || this.swimming)) { this.verticalVelocity = this.swimming ? 7.7 : 7.6; this.grounded = false; this.crouching = false; sound.jump(); this.burst(p, 0xc7b68b, 5, 1.7); }
    this.verticalVelocity -= dt * 17;
    const lastY = p.y; p.y += this.verticalVelocity * dt;
    let ground = this.world.heightAt(p.x, p.z);
    for (const c of this.world.colliders) {
      if (!c.disabled && Math.abs(p.x - c.x) < c.w / 2 + 0.12 && Math.abs(p.z - c.z) < c.d / 2 + 0.12 && lastY >= c.h - 0.08 && this.verticalVelocity <= 0) ground = Math.max(ground, c.h);
    }
    this.groundHeight = ground;
    if (p.y <= ground + 0.07) {
      if (!this.grounded && this.verticalVelocity < -4) { this.burst(p, this.swimming ? 0xa0cab8 : 0xc9b990, 8, 2); this.shake = Math.max(this.shake, 0.07); sound.footstep(); }
      p.y = ground; this.verticalVelocity = 0; this.grounded = true;
    } else this.grounded = false;
    if (this.swimming) p.y = Math.max(p.y, -0.8 + Math.sin(this.regionTime * 3) * 0.035);
    const actualSpeed = this.velocity.length();
    if (actualSpeed > 0.25 && !this.aiming) { const angle = Math.atan2(-this.velocity.x, -this.velocity.z); this.hero.root.rotation.y += this.angleDelta(this.hero.root.rotation.y, angle) * Math.min(1, dt * 15); }
    else if (this.aiming || this.recoil > 0) this.hero.root.rotation.y = this.yaw;
    this.hero.animate(this.regionTime, actualSpeed, this.crouching, this.swimming, this.aiming, this.recoil);
    this.stepTime += dt * actualSpeed;
    if (this.stepTime > 2.3 && Math.hypot(x, y) > 0.1 && this.grounded) { this.stepTime = 0; sound.footstep(); if (!this.crouching) this.burst(p, this.swimming ? 0x8dbbae : 0xbda87d, 2, 0.6); }
    this.trailTime += dt;
    if (this.trailTime > 0.23 && p.distanceToSquared(this.trail[this.trail.length - 1]) > 0.8) {
      this.trail.push(p.clone()); this.trailTime = 0;
      if (this.trail.length > 300) { this.trail.shift(); this.npcs.forEach(n => { n.trail = Math.max(0, n.trail - 1); }); }
    }
  }
  private angleDelta(a: number, b: number) { return Math.atan2(Math.sin(b - a), Math.cos(b - a)); }
  private moveWithCollision(p: THREE.Vector3, dx: number, dz: number, radius: number) {
    const b = this.world.bounds;
    const x = THREE.MathUtils.clamp(p.x + dx, b.minX + radius, b.maxX - radius);
    if (!this.collides(x, p.z, p.y, radius)) p.x = x;
    const z = THREE.MathUtils.clamp(p.z + dz, b.minZ + radius, b.maxZ - radius);
    if (!this.collides(p.x, z, p.y, radius)) p.z = z;
  }
  private collides(x: number, z: number, y: number, radius = 0.33) {
    for (const c of this.world.colliders) {
      if (c.disabled || y >= c.h - 0.1 || y + 1.7 < (c.base ?? 0)) continue;
      const cx = THREE.MathUtils.clamp(x, c.x - c.w / 2, c.x + c.w / 2); const cz = THREE.MathUtils.clamp(z, c.z - c.d / 2, c.z + c.d / 2);
      if ((x - cx) ** 2 + (z - cz) ** 2 < radius ** 2) return true;
    }
    return false;
  }
  private clearLine(from: THREE.Vector3, to: THREE.Vector3) {
    const distance = from.distanceTo(to); this.ray.set(from, to.clone().sub(from).normalize());
    for (const c of this.world.colliders) {
      if (c.disabled) continue;
      this.box.min.set(c.x - c.w / 2, c.base ?? 0, c.z - c.d / 2); this.box.max.set(c.x + c.w / 2, c.h, c.z + c.d / 2);
      const point = this.ray.intersectBox(this.box, this.temp); if (point && from.distanceTo(point) < distance - 0.2) return false;
    }
    return true;
  }

  private moveVehicle(dt: number) {
    if (!this.car) return;
    const { x, y } = this.input();
    const braking = this.braking || this.keys.has('Space') || this.actions.has('jump');
    const friction = this.region.biome === 'desert' ? 1.5 : 1;
    this.carSpeed += y * 12 * dt;
    this.carSpeed *= Math.exp(-dt * (braking ? 7 : Math.abs(y) < 0.1 ? 1.2 : 0.26 * friction));
    this.carSpeed = THREE.MathUtils.clamp(this.carSpeed, -7, this.carIntegrity < 25 ? 10 : 20);
    if (Math.abs(this.carSpeed) < 0.08) this.carSpeed = 0;
    this.carYaw -= x * Math.min(1.55, Math.abs(this.carSpeed) * 0.18) * dt * Math.sign(this.carSpeed || 1);
    const p = this.car.root.position; const before = p.clone();
    this.moveWithCollision(p, -Math.sin(this.carYaw) * this.carSpeed * dt, -Math.cos(this.carYaw) * this.carSpeed * dt, 1.08);
    if ((before.distanceTo(p) < Math.abs(this.carSpeed) * dt * 0.45 || this.world.waterAt(p.x, p.z)) && Math.abs(this.carSpeed) > 2.2) {
      if (this.world.waterAt(p.x, p.z)) p.copy(before);
      if (!this.carImpact) { this.carIntegrity = Math.max(5, this.carIntegrity - Math.abs(this.carSpeed) * 1.35); this.shake = 0.2; sound.damage(); this.burst(p, 0xd5bd80, 12, 3); this.carImpact = 0.7; }
      this.carSpeed *= -0.28;
    }
    p.y = this.world.heightAt(p.x, p.z);
    this.car.root.rotation.set(Math.sin(this.regionTime * 12) * Math.abs(this.carSpeed) * 0.0007, this.carYaw, -x * Math.abs(this.carSpeed) * 0.0017);
    this.car.wheels.forEach(w => { w.rotation.x -= this.carSpeed * dt * 2; });
    this.hero.root.position.copy(p); this.groundHeight = p.y;
    if (!this.dragging) this.yaw += this.angleDelta(this.yaw, this.carYaw) * Math.min(1, dt * 3.5);
    this.stepTime += dt;
    if (this.stepTime > 0.09 && Math.abs(this.carSpeed) > 2) { this.stepTime = 0; this.burst(p.clone().add(new THREE.Vector3(Math.sin(this.carYaw) * 1.6, 0.1, Math.cos(this.carYaw) * 1.6)), 0xd7bd84, 3, Math.abs(this.carSpeed) * 0.12); }
    sound.vehicle(this.carSpeed, true);
  }
  private toggleVehicle() {
    if (!this.car) return;
    if (this.driving) {
      const p = this.car.root.position;
      const options: Point[] = [[p.x + Math.cos(this.carYaw) * 2.1, p.z - Math.sin(this.carYaw) * 2.1], [p.x - Math.cos(this.carYaw) * 2.1, p.z + Math.sin(this.carYaw) * 2.1], [p.x, p.z + 2.4]];
      const at = options.find(([x, z]) => !this.collides(x, z, this.world.heightAt(x, z)) && !this.world.waterAt(x, z)) ?? [p.x, p.z];
      this.hero.root.position.set(at[0], this.world.heightAt(...at), at[1]);
      this.driving = false; this.hero.root.visible = true; this.carSpeed = 0; sound.vehicle(0, false);
      this.trail = [this.hero.root.position.clone()];
      this.npcs.filter(n => this.isCompanion(n)).forEach((npc, i) => { npc.character.root.position.copy(this.hero.root.position).add(new THREE.Vector3(i + 1.3, 0, 2)); npc.character.root.position.y = this.world.heightAt(npc.character.root.position.x, npc.character.root.position.z); npc.trail = 0; npc.character.root.visible = true; });
    } else if (this.carIntegrity < 25) {
      this.carIntegrity = 100; this.notice('mission', this.say('repairVehicle'), this.loc(L('أعاد ياسين وصل الملف المتضرر. أسفار جاهزة للطريق.', 'Yassine reconnects the damaged coil. Asfar is ready for the road.', 'Yassine reconnecte la bobine. Asfar est prête à repartir.'))); sound.collect();
    } else { this.driving = true; this.hero.root.visible = false; this.crouching = false; this.yaw = this.carYaw; this.hero.root.position.copy(this.car.root.position); }
    this.clearInput(); this.checkpoint();
  }

  private isCompanion(npc: Npc) { return Boolean(npc.placement.companionAfter && this.journey.completed.includes(npc.placement.companionAfter)); }
  private updateNpcs(dt: number, talking = false) {
    const p = this.hero.root.position;
    for (const [i, npc] of this.npcs.entries()) {
      const root = npc.character.root; const follows = this.isCompanion(npc);
      if (follows && this.driving) { root.visible = false; continue; }
      if (npc.placement.actor === 'shadow' && this.journey.finished) continue;
      root.visible = true;
      const distance = root.position.distanceTo(p);
      npc.label.visible = distance < 13 && !this.driving;
      npc.label.material.opacity = THREE.MathUtils.clamp((13 - distance) / 5, 0, 0.93);
      let speed = 0;
      if (follows && !talking && distance > 3.1) {
        const maxIndex = Math.max(0, this.trail.length - 4);
        npc.trail = Math.min(npc.trail, maxIndex);
        while (npc.trail < maxIndex && root.position.distanceTo(this.trail[npc.trail]) < 1.9) npc.trail++;
        const destination = this.trail[npc.trail] ?? p;
        const dir = destination.clone().sub(root.position); dir.y = 0;
        if (dir.length() > 0.6) {
          speed = distance > 10 ? 8.1 : 5.4; dir.normalize();
          const before = root.position.clone(); this.moveWithCollision(root.position, dir.x * speed * dt, dir.z * speed * dt, 0.3);
          if (before.distanceToSquared(root.position) < 0.00001) this.moveWithCollision(root.position, dir.z * speed * dt, -dir.x * speed * dt, 0.3);
          root.position.y = this.world.heightAt(root.position.x, root.position.z);
          root.rotation.y += this.angleDelta(root.rotation.y, Math.atan2(-dir.x, -dir.z)) * Math.min(1, dt * 9);
        }
      } else if (distance < 5) root.rotation.y += this.angleDelta(root.rotation.y, Math.atan2(root.position.x - p.x, root.position.z - p.z)) * Math.min(1, dt * 3);
      else if (!talking && !follows && npc.placement.activity === 'walk') {
        const destination = npc.home.clone().add(new THREE.Vector3(Math.sin(this.regionTime * 0.17) * 1.6, 0, Math.cos(this.regionTime * 0.17) * 1.2));
        const direction = destination.sub(root.position); direction.y = 0;
        if (direction.length() > 0.2) { direction.normalize(); speed = 0.65; this.moveWithCollision(root.position, direction.x * dt * speed, direction.z * dt * speed, 0.3); root.rotation.y += this.angleDelta(root.rotation.y, Math.atan2(-direction.x, -direction.z)) * Math.min(1, dt * 3); }
      }
      npc.character.animate(this.visualTime + i * 1.7, speed, false, this.world.waterAt(root.position.x, root.position.z), false, 0, talking && this.conversation?.actor === npc.placement.actor ? 'talk' : npc.placement.activity === 'work' ? 'work' : undefined);
      if (!talking && !npc.heard && distance < 9.5 && this.ambientCooldown <= 0) {
        npc.heard = true; this.ambientCooldown = 20;
        const line = this.journey.finished ? this.say('afterStory') : this.loc(npc.placement.ambient);
        this.notice('dialogue', this.loc(ACTORS[npc.placement.actor].name), line, this.loc(ACTORS[npc.placement.actor].name));
        sound.speak(line, this.settings.language, npc.placement.actor);
      }
    }
  }

  private objectivePosition(): THREE.Vector3 | null {
    const obj = this.objective; if (!obj) return null;
    if (obj.actor) { const npc = this.npcs.find(n => n.placement.actor === obj.actor); if (npc) return npc.character.root.position.clone(); }
    return new THREE.Vector3(obj.at[0], this.world.heightAt(...obj.at), obj.at[1]);
  }
  private updatePrompts() {
    this.prompt = null; this.promptLabel = ''; this.interaction = null;
    if (this.conversation || this.pendingTravel || this.ended) return;
    if (this.driving) { this.prompt = 'murad'; this.promptLabel = this.say('exitVehicle'); this.interaction = { type: 'vehicle' }; return; }
    const p = this.hero.root.position; const objective = this.objective; const point = this.objectivePosition();
    if (objective && point && p.distanceTo(point) < 2.7 && ['inspect', 'deduce', 'finish', 'travel'].includes(objective.kind)) {
      this.interaction = { type: 'objective' }; this.prompt = objective.kind === 'travel' ? 'exit' : 'clue';
      this.promptLabel = this.say(objective.kind === 'travel' ? 'travel' : objective.kind === 'deduce' ? 'deduce' : objective.kind === 'finish' ? 'ending' : 'inspect');
    }
    if (!this.interaction) {
      const npc = [...this.npcs].filter(n => n.character.root.visible).sort((a, b) => a.character.root.position.distanceToSquared(p) - b.character.root.position.distanceToSquared(p))[0];
      if (npc && npc.character.root.position.distanceTo(p) < 2.8) { this.interaction = { type: 'npc', actor: npc.placement.actor }; this.prompt = 'murad'; this.promptLabel = `${this.say('talk')} ${this.loc(ACTORS[npc.placement.actor].name)}`; }
    }
    if (!this.interaction && this.car && p.distanceTo(this.car.root.position) < 3.1) { this.interaction = { type: 'vehicle' }; this.prompt = 'murad'; this.promptLabel = this.say(this.carIntegrity < 25 ? 'repairVehicle' : 'enterVehicle'); }
    if (!this.interaction) for (const c of this.world.colliders) {
      if (!c.climb || c.disabled || p.y > c.h - 0.3 || c.h - p.y > 2.4) continue;
      const x = THREE.MathUtils.clamp(p.x, c.x - c.w / 2, c.x + c.w / 2); const z = THREE.MathUtils.clamp(p.z, c.z - c.d / 2, c.z + c.d / 2);
      if (Math.hypot(p.x - x, p.z - z) < 1.1) { this.interaction = { type: 'climb', collider: c }; this.prompt = 'climb'; this.promptLabel = text(this.settings.language, 'climb'); break; }
    }
  }
  private interact() {
    this.updatePrompts();
    const interaction = this.interaction; if (!interaction) return;
    if (interaction.type === 'vehicle') { this.toggleVehicle(); return; }
    if (interaction.type === 'climb') { const c = interaction.collider; this.climb = { from: this.hero.root.position.clone(), to: new THREE.Vector3(c.x, c.h, c.z), progress: 0 }; sound.jump(); return; }
    if (interaction.type === 'npc') {
      const npc = this.npcs.find(n => n.placement.actor === interaction.actor)!;
      if (!this.journey.met.includes(interaction.actor)) this.journey.met.push(interaction.actor);
      const objective = this.objective?.actor === interaction.actor ? this.objective : undefined;
      this.openConversation(interaction.actor, objective?.lines ?? [this.journey.finished ? L(jt('ar', 'afterStory'), jt('en', 'afterStory'), jt('fr', 'afterStory')) : npc.placement.ambient], objective?.id);
      return;
    }
    const obj = this.objective; if (!obj) return;
    if (obj.stealth && !this.crouching) { this.notice('mission', this.say('crouchFirst')); return; }
    if (obj.kind === 'travel') { this.requestTravel(this.journey.region + 1, 'travel'); return; }
    if (obj.kind === 'finish') { this.completeObjective(); this.finish(true); return; }
    this.openConversation('yassine', obj.lines ?? [obj.detail], obj.id);
  }
  private openConversation(actor: string, lines: Localized[], objective?: string) {
    this.conversation = { actor, lines, line: 0, objective }; this.clearInput(); sound.vehicle(0, false); sound.ui();
    sound.speak(this.loc(lines[0]), this.settings.language, actor); this.emit();
  }
  advanceDialogue() {
    const c = this.conversation; if (!c || this.paused) return;
    if (c.line < c.lines.length - 1) { c.line++; c.feedback = undefined; sound.ui(); sound.speak(this.loc(c.lines[c.line]), this.settings.language, c.actor); this.emit(); return; }
    if (c.objective && this.objective?.choices?.length) return;
    const shouldComplete = c.objective === this.objective?.id;
    this.conversation = null; sound.stopVoice(); this.clearInput();
    if (shouldComplete) this.completeObjective();
    this.checkpoint(); this.emit();
  }
  chooseDialogue(index: number) {
    const c = this.conversation; const obj = this.objective;
    if (!c || !obj || this.paused || c.objective !== obj.id || c.line !== c.lines.length - 1 || !obj.choices?.[index]) return;
    if (!obj.choices[index].correct) { c.feedback = this.say('wrong'); sound.ui(); this.emit(); return; }
    this.conversation = null; sound.stopVoice(); this.completeObjective(); this.clearInput(); this.emit();
  }
  closeDialogue() { this.conversation = null; sound.stopVoice(); this.clearInput(); this.checkpoint(); this.emit(); }

  private updateObjective() {
    const p = this.hero.root.position;
    for (const relic of this.relics) {
      if (!relic.collected && p.distanceTo(relic.mesh.position) < 1.45) {
        relic.collected = true; relic.mesh.visible = false; this.journey.souvenirs.push(relic.id);
        this.reward(250, 90, { relics: 1 }); this.notice('score', this.say('memory'), '+250 / +90 XP');
        this.burst(relic.mesh.position, 0xa4dfc4, 22, 3.3); sound.collect(); this.checkpoint();
      }
    }
    const obj = this.objective; if (!obj) return;
    const distance = Math.hypot(p.x - obj.at[0], p.z - obj.at[1]);
    if (['reach', 'drive', 'chase'].includes(obj.kind) && distance < (obj.kind === 'drive' ? 4.8 : 3.0) && (obj.kind !== 'drive' || this.driving)) this.completeObjective();
    else if (obj.kind === 'fight' && distance < 30 && this.enemies.filter(e => e.from <= this.journey.step).every(e => e.hp <= 0)) this.completeObjective();
  }
  private completeObjective() {
    const obj = this.objective; if (!obj) return;
    if (!this.journey.completed.includes(obj.id)) {
      this.journey.completed.push(obj.id);
      if (obj.evidence || obj.kind === 'talk') this.journey.evidence.push(obj.id);
      const chapterCompleted = obj.kind === 'travel' && CAMPAIGN[this.journey.region + 1]?.chapter !== this.region.chapter;
      this.reward(obj.kind === 'fight' ? 600 : obj.kind === 'travel' ? 400 : 220, obj.kind === 'fight' ? 180 : obj.kind === 'travel' ? 150 : 100, { fragments: obj.evidence ? 1 : 0, completion: chapterCompleted });
    }
    this.npcs.filter(n => n.placement.companionAfter === obj.id).forEach(n => { n.trail = this.trail.length - 1; });
    this.journey.step++; this.journey.chaseRemaining = this.objective?.kind === 'chase' ? this.objective.seconds ?? 65 : 0;
    this.world.updateProgress(this.journey.completed);
    this.notice('mission', this.say('objectiveComplete'), this.loc(obj.title));
    this.burst(this.hero.root.position.clone().add(new THREE.Vector3(0, 1, 0)), 0xd9c486, 14, 2.2);
    sound.collect(); this.checkpoint(); this.emit();
  }

  private requestTravel(to: number, kind: 'travel' | 'visit') {
    if (this.pendingTravel || to < 0 || to >= CAMPAIGN.length) return;
    if (kind === 'visit' && !this.journey.finished) return;
    if (kind === 'travel' && this.objective?.kind !== 'travel') return;
    this.pendingTravel = { from: this.journey.region, to, kind }; this.clearInput(); sound.stopVoice(); sound.vehicle(0, false);
    this.checkpoint(); this.callbacks.transition(this.pendingTravel);
  }
  visitRegion(index: number) { if (this.journey.finished && index !== this.journey.region) this.requestTravel(index, 'visit'); }
  completeTravel() {
    if (!this.pendingTravel) return;
    const next = this.pendingTravel;
    if (next.kind === 'travel') this.completeObjective();
    this.journey.region = next.to; this.journey.step = 0; this.journey.vehicle = undefined; this.journey.companions = undefined; this.journey.trail = undefined;
    if (!this.journey.visited.includes(next.to)) this.journey.visited.push(next.to);
    this.health = Math.min(100, this.health + 40); this.ammo = this.capacity; this.reloadTime = 0;
    this.loadRegion(); this.pendingTravel = null; this.ended = false;
    this.animateWorld(0); this.updateEffects(0); this.updateCamera(1); this.renderer.render(this.scene, this.camera);
    this.checkpoint(); this.emit();
  }
  resumeExploration() { if (!this.journey.finished) return; this.ended = false; this.paused = false; this.enemies.forEach(e => { e.mesh.visible = false; }); this.marker.visible = false; this.npcs.filter(n => n.placement.actor === 'shadow').forEach(n => { n.character.root.visible = false; }); this.clearInput(); this.checkpoint(); this.emit(); }

  restartCheckpoint() {
    const recovery = this.recoverySave();
    this.health = 100; this.ammo = this.capacity; this.reloadTime = 0;
    this.pendingTravel = null; this.ended = false; this.paused = false;
    this.loadRegion(recovery); this.animateWorld(0); this.updateEffects(0); this.updateCamera(1);
    this.renderer.render(this.scene, this.camera); this.checkpoint(); this.emit();
  }

  private recoverySave() {
    const recovery = this.getSave();
    recovery.health = 100; recovery.position = [0, this.world.heightAt(0, 19), 19]; recovery.yaw = 0; recovery.ammo = this.capacity;
    if (recovery.journey) {
      recovery.journey.companions = undefined; recovery.journey.trail = undefined;
      recovery.journey.chaseRemaining = this.objective?.kind === 'chase' ? this.objective.seconds ?? 65 : 0;
      if (this.region.vehicle) recovery.journey.vehicle = { position: [this.region.vehicle[0], this.world.heightAt(...this.region.vehicle), this.region.vehicle[1]], yaw: 0, integrity: 100, driving: false };
    }
    return recovery;
  }

  private reload() { if (this.reloadTime > 0 || this.ammo === this.capacity || this.driving) return; this.reloadTime = this.weapon === 'azru' ? 1.15 : 1.55; sound.reload(); }
  private enemyActive(enemy: Enemy) { return !this.journey.finished && this.journey.step >= enemy.from; }
  private fire() {
    if (this.shotCooldown > 0 || this.reloadTime > 0) return;
    if (this.ammo <= 0) { this.reload(); return; }
    this.ammo--; this.shotCooldown = this.weapon === 'azru' ? 0.27 : 0.53; this.recoil = 1; this.shake = this.weapon === 'azru' ? 0.065 : 0.12;
    this.hero.root.rotation.y = this.yaw; sound.fire();
    const from = this.hero.root.position.clone().add(new THREE.Vector3(Math.cos(this.yaw) * 0.4, this.crouching ? 0.95 : 1.4, -Math.sin(this.yaw) * 0.4));
    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const candidates: { kind: 'target' | 'enemy'; index: number; position: THREE.Vector3; rank: number }[] = [];
    const consider = (kind: 'target' | 'enemy', index: number, position: THREE.Vector3) => {
      const direction = position.clone().sub(from); const distance = direction.length(); direction.y = 0;
      const dot = direction.normalize().dot(forward);
      if (distance < (this.weapon === 'azru' ? 30 : 24) && dot > 0.53 && this.clearLine(from, position)) candidates.push({ kind, index, position, rank: distance * (1.3 - dot * 0.3) });
    };
    this.targets.forEach((target, i) => { if (target.hp > 0) consider('target', i, target.mesh.position.clone().add(new THREE.Vector3(0, 1.6, 0))); });
    this.enemies.forEach((enemy, i) => { if (enemy.hp > 0 && this.enemyActive(enemy)) consider('enemy', i, enemy.mesh.position.clone()); });
    const hit = candidates.sort((a, b) => a.rank - b.rank)[0];
    const to = hit ? hit.position : from.clone().addScaledVector(forward, 27);
    this.tracers.push({ from, to, life: 0.11 }); this.burst(from, 0xb6e9ce, 5, 1.4);
    if (hit) {
      this.combo = Math.min(8, this.combo + 1); this.comboTime = 4.5; this.bestCombo = Math.max(this.bestCombo, this.combo); this.hitFlash = 1;
      this.burst(hit.position, hit.kind === 'target' ? 0xe8c785 : 0x9bdbc1, 22, 4); sound.hit();
      if (hit.kind === 'target') {
        this.targets[hit.index].hp = 0; this.journey.completed.push(`v-target-${hit.index}`); this.reward(100 * this.combo, 55, { targets: 1, combo: this.combo });
        this.notice('score', text(this.settings.language, 'targetHit'), `+${100 * this.combo}`);
        this.checkpoint();
      } else {
        const enemy = this.enemies[hit.index]; enemy.hp -= (this.weapon === 'azru' ? 1 : 2) + this.profile.upgrade;
        if (enemy.hp <= 0) {
          this.kills++; enemy.mesh.visible = false; this.burst(enemy.mesh.position, 0xe0bc79, 28, enemy.boss ? 7 : 4.5); this.shake = enemy.boss ? 0.35 : 0.17;
          const score = (enemy.boss ? 650 : 180) * this.combo; this.reward(score, enemy.boss ? 240 : 85, { combo: this.combo });
          this.notice('score', text(this.settings.language, 'droneDown'), `+${score}`); this.checkpoint();
        }
      }
    }
    if (this.ammo === 0) this.reload();
  }
  private updateEnemies(dt: number) {
    if (this.journey.finished) return;
    const p = this.hero.root.position;
    const chase = this.objective?.kind === 'chase';
    const escaped = this.region.id === 'mountains' && this.journey.completed.includes('m-chase');
    for (const enemy of this.enemies) {
      if (enemy.hp <= 0 || !this.enemyActive(enemy)) { enemy.mesh.visible = false; continue; }
      enemy.mesh.visible = true;
      const e = enemy.mesh.position;
      e.y = this.world.heightAt(e.x, e.z) + (enemy.boss ? 3.1 : 2.15) + Math.sin(this.regionTime * 2.2 + enemy.phase) * 0.22;
      enemy.mesh.rotation.y = Math.atan2(p.x - e.x, p.z - e.z); enemy.mesh.rotation.z = Math.sin(this.regionTime * 3 + enemy.phase) * 0.06;
      enemy.mesh.children.forEach(child => { if (child.name === 'rotor') child.rotation.y += dt * 46; });
      const distance = Math.hypot(p.x - e.x, p.z - e.z);
      if (escaped || distance > (chase ? 70 : 28)) continue;
      if (distance > (chase ? 4.8 : 7.5)) {
        const speed = chase ? 6.4 : enemy.boss ? 2.2 : 1.7;
        this.moveWithCollision(e, (p.x - e.x) / distance * dt * speed, (p.z - e.z) / distance * dt * speed, 0.42);
      }
      enemy.cooldown -= dt;
      if (enemy.cooldown <= 0 && distance < 20 && this.sinceDamage > 2.2) {
        const aim = p.clone().add(new THREE.Vector3(0, this.crouching ? 0.55 : 1.05, 0));
        if (this.clearLine(e, aim)) { this.bolts.push({ position: e.clone(), velocity: aim.sub(e).normalize().multiplyScalar(enemy.boss ? 11 : 9.2), life: 3.3 }); this.burst(e, 0xf0a16b, 4, 1); }
        enemy.cooldown = this.crouching ? 3.4 : enemy.boss ? 1.5 : 2.45;
      }
    }
    for (const bolt of this.bolts) {
      bolt.life -= dt; bolt.position.addScaledVector(bolt.velocity, dt);
      const body = p.clone().add(new THREE.Vector3(0, this.crouching ? 0.55 : 1.05, 0));
      if (bolt.position.distanceToSquared(body) < (this.crouching ? 0.3 : 0.68)) {
        bolt.life = 0; this.health = Math.max(0, this.health - (chase ? 9 : 12)); this.sinceDamage = 0; this.damageFlash = 0.8; this.shake = 0.23; this.combo = 0;
        sound.damage(); this.burst(body, 0xd99972, 9, 2);
      } else if (this.collides(bolt.position.x, bolt.position.z, bolt.position.y, 0.09)) { bolt.life = 0; this.burst(bolt.position, 0xb8ad88, 4, 1.6); }
    }
    this.bolts = this.bolts.filter(b => b.life > 0).slice(-32);
  }

  private animateWorld(dt: number) {
    const t = this.regionTime; const p = this.hero.root.position;
    this.heroShadow.position.set(p.x, this.groundHeight + 0.025, p.z); this.heroShadow.visible = !this.swimming && !this.driving;
    this.heroShadow.material.opacity = 0.48 / (1 + Math.max(0, p.y - this.groundHeight) * 0.7);
    this.targets.forEach(target => {
      if (target.hp > 0) target.mesh.rotation.y = Math.atan2(p.x - target.mesh.position.x, p.z - target.mesh.position.z);
      else { target.fall = Math.min(1, target.fall + dt * 4); const disc = target.mesh.userData.disc as THREE.Group; disc.rotation.x = -target.fall * 1.8; disc.position.y = 1.6 - target.fall * 0.6; }
    });
    const position = this.objectivePosition();
    this.marker.visible = !!position;
    if (position) this.marker.position.copy(position);
    for (const item of [this.marker, ...this.relics.map(r => r.mesh)]) {
      const diamond = item.getObjectByName('diamond');
      if (diamond) { diamond.rotation.y = t * 1.2; diamond.position.y = 1.7 + Math.sin(t * 2.4) * 0.15; }
    }
    this.world.flags.forEach((flag, i) => { flag.rotation.x = Math.sin(t * 1.2 + i) * 0.12; flag.rotation.y = Math.sin(t * 0.9 + i) * 0.04; });
    if (this.world.water.visible) {
      const pos = this.world.water.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin(pos.getX(i) * 2 + t * 1.7) * Math.cos(pos.getY(i) * 2 + t) * 0.035);
      pos.needsUpdate = true;
    }
    const weather = this.settings.weather === 'clear' ? this.region.weather : this.settings.weather;
    const dust = this.dust.geometry.attributes.position; this.dust.position.z = p.z - 8;
    for (let i = 0; i < dust.count; i++) { let y = dust.getY(i) + dt * (weather === 'rain' ? -12 : 0.18); if (y > 18) y = 0; if (y < 0) y = 18; dust.setY(i, y); }
    dust.needsUpdate = true;
    const material = this.dust.material as THREE.PointsMaterial; material.opacity = weather === 'clear' ? 0.27 : 0.6; material.size = weather === 'rain' ? 0.067 : weather === 'dust' ? 0.08 : 0.04;
    const cycle = this.region.night && !this.journey.finished ? 0.13 : this.settings.dayCycle ? 0.55 + (Math.sin(t / 115 + 0.8) + 1) * 0.21 : 0.94;
    this.sun.intensity = (weather === 'rain' ? 1.55 : 2.8) * cycle; this.hemi.intensity = this.region.night && !this.journey.finished ? 1.1 : 0.9 + cycle * 1.4;
    this.sun.color.set(this.region.night && !this.journey.finished ? 0xb7d5eb : 0xffdca4);
    this.sun.position.set(p.x - 30 + Math.sin(t / 150) * 10, p.y + 32, p.z + 24); this.sun.target.position.set(p.x, p.y, p.z - 8);
    this.world.lamps.emissiveIntensity = 0.3 + (1 - cycle) * 3;
    const sky = new THREE.Color(0x182d45).lerp(this.world.sky, cycle);
    (this.scene.background as THREE.Color).copy(sky); const fog = this.scene.fog as THREE.Fog; fog.color.copy(sky); fog.near = weather === 'dust' ? 34 : weather === 'rain' ? 48 : 60;
  }
  private updateCamera(dt: number) {
    const p = this.hero.root.position; const distance = this.driving ? 10.5 : this.aiming ? 5.3 : 7.8;
    const target = p.clone().add(new THREE.Vector3(0, this.driving ? 1.8 : this.crouching ? 1 : 1.6, 0));
    const desired = new THREE.Vector3(p.x + Math.sin(this.yaw) * distance * Math.cos(this.pitch), target.y + 1.8 + Math.sin(this.pitch) * distance, p.z + Math.cos(this.yaw) * distance * Math.cos(this.pitch));
    const direction = desired.clone().sub(target).normalize(); const cameraDistance = desired.distanceTo(target); this.ray.set(target, direction);
    let allowed = cameraDistance;
    for (const c of this.world.colliders) {
      if (c.disabled) continue;
      this.box.min.set(c.x - c.w / 2 - 0.12, c.base ?? 0, c.z - c.d / 2 - 0.12); this.box.max.set(c.x + c.w / 2 + 0.12, c.h + 0.12, c.z + c.d / 2 + 0.12);
      const hit = this.ray.intersectBox(this.box, this.temp); if (hit) allowed = Math.min(allowed, target.distanceTo(hit) - 0.2);
    }
    if (allowed < cameraDistance) desired.copy(target).addScaledVector(direction, Math.max(1.25, allowed));
    this.camera.position.lerp(desired, 1 - Math.exp(-dt * 10));
    if (this.settings.shake && this.shake > 0) { this.camera.position.x += (Math.random() - 0.5) * this.shake; this.camera.position.y += (Math.random() - 0.5) * this.shake; }
    target.x -= Math.sin(this.yaw) * 2; target.z -= Math.cos(this.yaw) * 2;
    if (this.conversation && this.conversation.actor !== 'yassine') { const npc = this.npcs.find(n => n.placement.actor === this.conversation?.actor); if (npc) target.lerp(npc.character.root.position.clone().add(new THREE.Vector3(0, 1.55, 0)), 0.42); }
    this.camera.lookAt(target);
    this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, this.driving ? 61 + Math.abs(this.carSpeed) * 0.15 : this.aiming ? 46 : this.velocity.length() > 6 ? 61 : 55, Math.min(1, dt * 6)); this.camera.updateProjectionMatrix();
  }
  private burst(position: THREE.Vector3, color: number, count: number, force: number) {
    let spawned = 0;
    for (let i = 0; i < this.particles.length && spawned < count; i++) {
      const p = this.particles[i]; if (p.life > 0) continue;
      p.position.copy(position); p.position.y += 0.1; p.velocity.set((Math.random() - 0.5) * force * 2, Math.random() * force + 0.5, (Math.random() - 0.5) * force * 2);
      p.life = p.max = 0.35 + Math.random() * 0.5; p.size = 0.035 + Math.random() * 0.075;
      this.particleMesh.setColorAt(i, new THREE.Color(color)); spawned++;
    }
    if (this.particleMesh.instanceColor) this.particleMesh.instanceColor.needsUpdate = true;
  }
  private updateEffects(dt: number) {
    this.particles.forEach((p, i) => {
      p.life = Math.max(0, p.life - dt);
      if (p.life > 0) { p.velocity.y -= dt * 8; p.position.addScaledVector(p.velocity, dt); this.dummy.position.copy(p.position); this.dummy.scale.setScalar(p.size * Math.min(1, p.life / p.max * 2)); this.dummy.rotation.set(p.life * 3, p.life, 0); }
      else this.dummy.scale.setScalar(0);
      this.dummy.updateMatrix(); this.particleMesh.setMatrixAt(i, this.dummy.matrix);
    }); this.particleMesh.instanceMatrix.needsUpdate = true;
    this.boltMesh.count = this.bolts.length;
    this.bolts.forEach((bolt, i) => { this.dummy.position.copy(bolt.position); this.dummy.scale.setScalar(1); this.dummy.updateMatrix(); this.boltMesh.setMatrixAt(i, this.dummy.matrix); }); this.boltMesh.instanceMatrix.needsUpdate = true;
    this.tracers = this.tracers.filter(tracer => (tracer.life -= dt) > 0).slice(-12); this.tracerMesh.count = this.tracers.length;
    this.tracers.forEach((tracer, i) => {
      const direction = this.temp.subVectors(tracer.to, tracer.from); const length = direction.length();
      this.dummy.position.copy(tracer.from).lerp(tracer.to, 0.5); this.dummy.quaternion.setFromUnitVectors(this.up, direction.normalize()); this.dummy.scale.set(tracer.life / 0.11, length, tracer.life / 0.11); this.dummy.updateMatrix(); this.tracerMesh.setMatrixAt(i, this.dummy.matrix);
    }); this.tracerMesh.instanceMatrix.needsUpdate = true;
  }

  private reward(score: number, xp: number, extra: Partial<Parameters<GameCallbacks['reward']>[0]> = {}) { this.score += score; this.xp += xp; this.callbacks.reward({ xp, ...extra }); }
  private notice(kind: 'mission' | 'dialogue' | 'score', title: string, body?: string, speaker?: string) { this.callbacks.notice({ id: ++this.noticeId, kind, title, body, speaker }); }
  private checkpoint() { this.checkpointFlash = 3; this.saveTime = 0; this.callbacks.save(this.getSave()); }
  private conversationView(): ConversationView | null {
    const c = this.conversation; if (!c) return null;
    const actor = ACTORS[c.actor];
    const obj = c.objective === this.objective?.id ? this.objective : undefined;
    return { actor: c.actor, speaker: actor ? this.loc(actor.name) : text(this.settings.language, 'you'), role: actor ? this.loc(actor.role) : this.say('evidence'), line: this.loc(c.lines[c.line]), index: c.line, total: c.lines.length, choices: c.line === c.lines.length - 1 ? obj?.choices?.map(choice => this.loc(choice.label)) ?? [] : [], feedback: c.feedback };
  }
  private emit() {
    const p = this.hero.root.position; const point = this.objectivePosition(); const obj = this.objective;
    const markers: JourneyMarker[] = this.npcs.filter(n => n.character.root.visible).map(n => ({ id: n.placement.actor, type: 'npc', position: [n.character.root.position.x, n.character.root.position.z], label: this.loc(ACTORS[n.placement.actor].name), active: obj?.actor === n.placement.actor }));
    if (point && obj && !obj.actor) markers.push({ id: obj.id, type: obj.kind === 'travel' ? 'travel' : ['drive', 'reach', 'chase', 'fight'].includes(obj.kind) ? 'waypoint' : 'evidence', position: [point.x, point.z], label: this.loc(obj.title), active: true });
    if (this.car) markers.push({ id: 'asfar', type: 'vehicle', position: [this.car.root.position.x, this.car.root.position.z], label: 'ASFAR', active: false });
    for (const relic of this.relics) if (!relic.collected) markers.push({ id: relic.id, type: 'relic', position: [relic.mesh.position.x, relic.mesh.position.z], label: this.say('memory'), active: false });
    const companion = this.npcs.filter(n => this.isCompanion(n)).map(n => this.loc(ACTORS[n.placement.actor].name)).join(' / ');
    this.callbacks.snapshot({
      health: Math.ceil(this.health), score: this.score, xp: this.xp, time: this.journey.chaseRemaining || this.journey.elapsed,
      stage: this.journey.step, targets: this.targets.filter(t => t.hp <= 0).length, clues: this.journey.evidence.length, relics: this.journey.souvenirs.length,
      ammo: this.ammo, capacity: this.capacity, reloading: this.reloadTime > 0, weapon: this.weapon, combo: this.combo, hit: this.hitFlash, damage: this.damageFlash,
      crouching: this.crouching, swimming: this.swimming, aiming: this.aiming, prompt: this.prompt, position: [p.x, p.z], yaw: this.yaw,
      enemies: this.enemies.filter(e => e.hp > 0 && this.enemyActive(e)).map(e => [e.mesh.position.x, e.mesh.position.z]), collectedClues: [], fps: Math.round(this.fps),
      journey: { region: this.journey.region, chapter: this.region.chapter, title: this.loc(this.region.title), location: `${this.loc(this.region.place)} / ${this.loc(this.region.country)}`, objective: obj ? this.loc(obj.title) : this.say('freeExploreTitle'), detail: obj ? this.loc(obj.detail) : this.say('freeExploreDetail'),
        step: this.journey.step, totalSteps: this.region.objectives.length, completed: [...this.journey.completed], visited: [...this.journey.visited], met: [...this.journey.met], evidence: [...this.journey.evidence], finished: this.journey.finished, elapsed: this.journey.elapsed, chaseRemaining: this.journey.chaseRemaining,
        promptLabel: this.promptLabel, markers, destination: point ? [point.x, point.z] : null, distance: point ? Math.round(Math.hypot(p.x - point.x, p.z - point.z)) : 0,
        conversation: this.conversationView(), driving: this.driving, speed: Math.round(Math.abs(this.carSpeed) * 3.6), integrity: Math.ceil(this.carIntegrity), companion: companion || null, checkpoint: this.checkpointFlash > 0 ? this.say('checkpoint') : '',
      },
    });
  }
  getSave(): SavedRun {
    const journey = structuredClone(this.journey);
    journey.trail = this.trail.map(p => p.toArray() as [number, number, number]);
    journey.companions = Object.fromEntries(this.npcs.filter(n => this.isCompanion(n)).map(n => [n.placement.actor, { position: n.character.root.position.toArray() as [number, number, number], trail: n.trail }]));
    if (this.car) journey.vehicle = { position: this.car.root.position.toArray() as [number, number, number], yaw: this.carYaw, integrity: this.carIntegrity, driving: this.driving };
    else journey.vehicle = undefined;
    return { version: 2, journey, position: this.hero.root.position.toArray() as [number, number, number], yaw: this.yaw, health: this.health, score: this.score, xp: this.xp, time: this.journey.elapsed, stage: this.journey.step, targets: this.targets.map(t => t.hp), clues: [], relics: this.relics.map(r => r.collected), enemies: this.enemies.map(e => e.hp), ammo: this.ammo, weapon: this.weapon, kills: this.kills, bestCombo: this.bestCombo };
  }
  private finish(won: boolean) {
    if (this.ended) return;
    this.ended = true; this.clearInput(); sound.vehicle(0, false); sound.stopVoice();
    if (won) {
      this.journey.finished = true; this.journey.visited = CAMPAIGN.map((_, i) => i); this.journey.chaseRemaining = 0;
      this.reward(3500, 750, { completion: true }); this.health = 100; this.marker.visible = false; sound.win(); this.checkpoint();
    } else {
      sound.damage(); this.callbacks.save(this.recoverySave());
    }
    this.emit();
    this.callbacks.end({ won, campaignComplete: won, chapter: this.region.chapter, score: this.score, xp: this.xp, elapsed: this.journey.elapsed, targets: this.targets.filter(t => t.hp <= 0).length, fragments: this.journey.evidence.length, relics: this.journey.souvenirs.length, bestCombo: this.bestCombo, kills: this.kills });
  }
  dispose() {
    if (this.disposed) return; this.disposed = true;
    this.renderer.setAnimationLoop(null); this.resizeObserver.disconnect();
    window.removeEventListener('keydown', this.keyDown); window.removeEventListener('keyup', this.keyUp); window.removeEventListener('blur', this.blur); document.removeEventListener('visibilitychange', this.visibility);
    window.removeEventListener('pointerup', this.pointerUp); window.removeEventListener('pointercancel', this.pointerUp);
    const canvas = this.renderer.domElement;
    canvas.removeEventListener('pointerdown', this.pointerDown); canvas.removeEventListener('pointermove', this.pointerMove); canvas.removeEventListener('contextmenu', this.contextMenu);
    sound.vehicle(0, false); sound.stopVoice(); disposeTree(this.scene);
    this.renderer.dispose(); this.renderer.forceContextLoss(); canvas.remove();
  }
}