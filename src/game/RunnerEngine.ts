import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  type GamePhase,
  type LiveRunHUD,
  type PowerUpType,
  type QualityPreset,
  type RunnerSkin,
  getPowerUpDuration,
} from '../types/game';
import { soundEngine } from '../audio/soundEngine';
import { createGameTextures, type GameTextureSet } from './textures';
import {
  createHighBarrierModel,
  createLowHurdleModel,
  createPowerUpMesh,
  createRunnerModel,
  createTallBlockModel,
  createTrainModel,
  type RunnerRig,
} from './models';

const LANE_X = [-2.4, 0, 2.4] as const;
const SEGMENT_LENGTH = 26;
const NUM_SEGMENTS = 7;

type ObstacleKind =
  | 'low_hurdle'
  | 'high_barrier'
  | 'tall_block'
  | 'train_static'
  | 'train_ramp'
  | 'train_moving';

interface PooledObstacle {
  active: boolean;
  kind: ObstacleKind;
  lane: number;
  z: number;
  extraSpeed: number;
  mesh: THREE.Group;
}

interface PooledCoin {
  active: boolean;
  lane: number;
  x: number;
  y: number;
  z: number;
  magnetized: boolean;
  mesh: THREE.Mesh;
}

interface PooledPowerUp {
  active: boolean;
  type: PowerUpType;
  lane: number;
  y: number;
  z: number;
  mesh: THREE.Group;
}

interface PooledParticle {
  active: boolean;
  life: number;
  maxLife: number;
  vx: number;
  vy: number;
  vz: number;
  mesh: THREE.Mesh;
}

export interface EngineCallbacks {
  onHudUpdate: (hud: LiveRunHUD) => void;
  onCrash: (score: number, distance: number, coinsEarned: number) => void;
  onContextLostChange?: (lost: boolean) => void;
}

export interface RunConfig {
  magnetLevel: number;
  jetpackLevel: number;
  multiplierLevel: number;
  hoverboards: number;
  qualityPreset: QualityPreset;
}

// Reusable scratch math objects (zero GC in render loop)
const _vec3A = new THREE.Vector3();

function detectSoftwareWebGL(): boolean {
  try {
    const probeCanvas = document.createElement('canvas');
    const gl = probeCanvas.getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export class RunnerEngine {
  private container: HTMLElement;
  private callbacks: EngineCallbacks;
  private isSoftwareGl: boolean;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private keyLight: THREE.DirectionalLight;
  private textures: GameTextureSet;

  private runnerRig: RunnerRig;
  private runnerShadow: THREE.Mesh;
  private skyPlane: THREE.Mesh;
  private segments: THREE.Group[] = [];

  // Object pools
  private obstaclePool: PooledObstacle[] = [];
  private coinPool: PooledCoin[] = [];
  private powerUpPool: PooledPowerUp[] = [];
  private particlePool: PooledParticle[] = [];

  // Game state
  private phase: GamePhase = 'menu';
  private config: RunConfig = {
    magnetLevel: 1,
    jetpackLevel: 1,
    multiplierLevel: 1,
    hoverboards: 2,
    qualityPreset: 'auto',
  };

  private targetLane = 1;
  private runnerX = 0;
  private runnerY = 0;
  private velocityY = 0;
  private isGrounded = true;
  private rollTimer = 0;
  private invulnTimer = 0;

  private speed = 18;
  private distance = 0;
  private score = 0;
  private runCoins = 0;
  private nextWaveZ = -38;
  private jetpackTimer = 0;
  private jetpackMax = 6;
  private magnetTimer = 0;
  private magnetMax = 8;
  private multiplierTimer = 0;
  private multiplierMax = 10;
  private hoverboardTimer = 0;
  private hoverboardsLeft = 0;
  private lastTapTime = 0;
  private hudEmitAccum = 0;
  private runAnimTime = 0;
  private shakeTimer = 0;

  // Touch tracking
  private touchStartX = 0;
  private touchStartY = 0;
  private touchSwipeConsumed = false;

  // Loop
  private clock = new THREE.Clock();
  private frameId = 0;
  private disposed = false;

  // Shared disposal lists
  private geometriesToDispose: THREE.BufferGeometry[] = [];
  private materialsToDispose: THREE.Material[] = [];

  constructor(container: HTMLElement, initialSkin: RunnerSkin, callbacks: EngineCallbacks) {
    this.container = container;
    this.callbacks = callbacks;
    this.isSoftwareGl = detectSoftwareWebGL();

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.setSize(width, height);
    this.applyQualitySettings('auto');

    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    const fogColor = new THREE.Color(0x1e293b);
    this.scene.background = fogColor;
    this.scene.fog = new THREE.Fog(0x1e293b, 38, 128);

    // Studio Environment Reflection (mandatory on all devices)
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    this.camera = new THREE.PerspectiveCamera(62, width / height, 0.2, 180);
    this.camera.position.set(0, 4.4, 7.2);
    this.camera.lookAt(0, 1.8, -12);

    // Lighting rig: warm directional key + cool hemisphere fill + subtle rim
    const hemiLight = new THREE.HemisphereLight(0x93c5fd, 0x334155, 0.85);
    this.scene.add(hemiLight);

    this.keyLight = new THREE.DirectionalLight(0xfff1d6, 2.0);
    this.keyLight.position.set(12, 22, 10);
    this.keyLight.castShadow = !this.isSoftwareGl;
    this.keyLight.shadow.mapSize.set(1024, 1024);
    this.keyLight.shadow.camera.near = 2;
    this.keyLight.shadow.camera.far = 75;
    this.keyLight.shadow.camera.left = -16;
    this.keyLight.shadow.camera.right = 16;
    this.keyLight.shadow.camera.top = 24;
    this.keyLight.shadow.camera.bottom = -16;
    this.keyLight.shadow.bias = -0.0005;
    this.keyLight.shadow.normalBias = 0.02;
    this.scene.add(this.keyLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.7);
    rimLight.position.set(-10, 10, -25);
    this.scene.add(rimLight);

    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    this.textures = createGameTextures(maxAniso);

    // Horizon sunset sky backdrop plane
    const skyGeo = new THREE.PlaneGeometry(240, 95);
    const skyMat = new THREE.MeshBasicMaterial({
      map: this.textures.skyBackdrop,
      fog: false,
      depthWrite: false,
    });
    this.skyPlane = new THREE.Mesh(skyGeo, skyMat);
    this.skyPlane.position.set(0, 26, -135);
    this.scene.add(this.skyPlane);
    this.geometriesToDispose.push(skyGeo);
    this.materialsToDispose.push(skyMat);

    // Build infinite track segments
    this.buildTrackSegments();

    // Build runner
    this.runnerRig = createRunnerModel(initialSkin);
    this.scene.add(this.runnerRig.root);

    // Grounded contact shadow beneath runner
    const shadowGeo = new THREE.PlaneGeometry(1.35, 1.35);
    shadowGeo.rotateX(-Math.PI / 2);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: this.textures.contactShadow,
      transparent: true,
      depthWrite: false,
      opacity: 0.65,
    });
    this.runnerShadow = new THREE.Mesh(shadowGeo, shadowMat);
    this.runnerShadow.position.y = 0.02;
    this.scene.add(this.runnerShadow);
    this.geometriesToDispose.push(shadowGeo);
    this.materialsToDispose.push(shadowMat);

    // Build object pools (obstacles, coins, power-ups, particles)
    this.buildPools();

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.bindEvents();
    this.clock.start();
    this.tick();
  }

  private buildTrackSegments(): void {
    const bedGeo = new THREE.PlaneGeometry(8.6, SEGMENT_LENGTH);
    bedGeo.rotateX(-Math.PI / 2);
    const bedMat = new THREE.MeshStandardMaterial({
      map: this.textures.trackBed,
      roughness: 0.88,
      metalness: 0.05,
    });

    const railGeo = new THREE.BoxGeometry(0.11, 0.1, SEGMENT_LENGTH);
    const railMat = new THREE.MeshStandardMaterial({
      color: 0xcbd5e1,
      roughness: 0.25,
      metalness: 0.85,
    });

    const platformGeo = new THREE.BoxGeometry(3.2, 1.1, SEGMENT_LENGTH);
    const platformMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.85,
    });

    const wallGeo = new THREE.BoxGeometry(0.6, 5.2, SEGMENT_LENGTH);
    const wallMatA = new THREE.MeshStandardMaterial({ map: this.textures.wallA, roughness: 0.8 });
    const wallMatB = new THREE.MeshStandardMaterial({ map: this.textures.wallB, roughness: 0.8 });

    const gantryPostGeo = new THREE.BoxGeometry(0.32, 6.2, 0.32);
    const gantryBeamGeo = new THREE.BoxGeometry(11.4, 0.35, 0.35);
    const gantryMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.45,
      metalness: 0.7,
    });
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xfde047 });
    const lampGeo = new THREE.BoxGeometry(1.4, 0.12, 0.2);

    const bldgGeo = new THREE.BoxGeometry(1, 1, 1);
    const bldgMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.9,
    });
    const bldgWinMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });

    this.geometriesToDispose.push(
      bedGeo,
      railGeo,
      platformGeo,
      wallGeo,
      gantryPostGeo,
      gantryBeamGeo,
      lampGeo,
      bldgGeo,
    );
    this.materialsToDispose.push(
      bedMat,
      railMat,
      platformMat,
      wallMatA,
      wallMatB,
      gantryMat,
      lampMat,
      bldgMat,
      bldgWinMat,
    );

    const railOffsets = [-0.62, 0.62];

    for (let i = 0; i < NUM_SEGMENTS; i++) {
      const seg = new THREE.Group();
      seg.position.z = -i * SEGMENT_LENGTH;

      const bed = new THREE.Mesh(bedGeo, bedMat);
      bed.receiveShadow = true;
      seg.add(bed);

      // 6 steel rails (2 per lane)
      for (const laneX of LANE_X) {
        for (const rOff of railOffsets) {
          const rail = new THREE.Mesh(railGeo, railMat);
          rail.position.set(laneX + rOff, 0.05, 0);
          seg.add(rail);
        }
      }

      // Side concrete viaduct curbs
      const platL = new THREE.Mesh(platformGeo, platformMat);
      platL.position.set(-5.9, 0.45, 0);
      platL.receiveShadow = true;
      const platR = new THREE.Mesh(platformGeo, platformMat);
      platR.position.set(5.9, 0.45, 0);
      platR.receiveShadow = true;
      seg.add(platL, platR);

      // Painted mural walls
      const wallMat = i % 2 === 0 ? wallMatA : wallMatB;
      const wallL = new THREE.Mesh(wallGeo, wallMat);
      wallL.position.set(-7.6, 2.6, 0);
      const wallR = new THREE.Mesh(wallGeo, wallMat);
      wallR.position.set(7.6, 2.6, 0);
      seg.add(wallL, wallR);

      // Overhead steel gantry arch
      const postL = new THREE.Mesh(gantryPostGeo, gantryMat);
      postL.position.set(-5.5, 3.1, 0);
      const postR = new THREE.Mesh(gantryPostGeo, gantryMat);
      postR.position.set(5.5, 3.1, 0);
      const beam = new THREE.Mesh(gantryBeamGeo, gantryMat);
      beam.position.set(0, 6.2, 0);
      const lamp = new THREE.Mesh(lampGeo, lampMat);
      lamp.position.set(0, 5.98, 0);
      seg.add(postL, postR, beam, lamp);

      // Stylized city skyline silhouettes beyond viaduct walls
      for (const side of [-1, 1]) {
        const bHeight = 14 + ((i * 7 + (side > 0 ? 5 : 2)) % 14);
        const bWidth = 5 + ((i * 3) % 4);
        const bldg = new THREE.Mesh(bldgGeo, bldgMat);
        bldg.scale.set(bWidth, bHeight, 9);
        bldg.position.set(side * (14 + ((i * 2) % 5)), bHeight / 2 - 2, -3);
        seg.add(bldg);

        const winStrip = new THREE.Mesh(bldgGeo, bldgWinMat);
        winStrip.scale.set(0.35, bHeight * 0.4, 0.35);
        winStrip.position.set(side * 11.4, bHeight * 0.48, -3);
        seg.add(winStrip);
      }

      this.scene.add(seg);
      this.segments.push(seg);
    }
  }

  private buildPools(): void {
    // 1. Obstacles Pool
    const trainEntries: Array<{ kind: ObstacleKind; count: number; builder: (idx: number) => THREE.Group }> = [
      {
        kind: 'low_hurdle',
        count: 8,
        builder: () => createLowHurdleModel(this.textures),
      },
      {
        kind: 'high_barrier',
        count: 7,
        builder: () => createHighBarrierModel(this.textures),
      },
      {
        kind: 'tall_block',
        count: 6,
        builder: () => createTallBlockModel(this.textures),
      },
      {
        kind: 'train_static',
        count: 5,
        builder: (idx) => createTrainModel((idx % 3) as 0 | 1 | 2, false, this.textures),
      },
      {
        kind: 'train_ramp',
        count: 3,
        builder: (idx) => createTrainModel(((idx + 1) % 3) as 0 | 1 | 2, true, this.textures),
      },
      {
        kind: 'train_moving',
        count: 4,
        builder: (idx) => createTrainModel(((idx + 2) % 3) as 0 | 1 | 2, false, this.textures),
      },
    ];

    for (const entry of trainEntries) {
      for (let i = 0; i < entry.count; i++) {
        const mesh = entry.builder(i);
        mesh.visible = false;
        this.scene.add(mesh);
        this.obstaclePool.push({
          active: false,
          kind: entry.kind,
          lane: 1,
          z: 50,
          extraSpeed: 0,
          mesh,
        });
      }
    }

    // 2. Coin Pool
    const coinGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.11, 14);
    coinGeo.rotateX(Math.PI / 2);
    const coinMat = new THREE.MeshStandardMaterial({
      map: this.textures.coin,
      color: 0xfbbf24,
      emissive: 0xb45309,
      emissiveIntensity: 0.25,
      roughness: 0.2,
      metalness: 0.85,
    });
    this.geometriesToDispose.push(coinGeo);
    this.materialsToDispose.push(coinMat);

    for (let i = 0; i < 90; i++) {
      const mesh = new THREE.Mesh(coinGeo, coinMat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.coinPool.push({
        active: false,
        lane: 1,
        x: 0,
        y: 0.75,
        z: 50,
        magnetized: false,
        mesh,
      });
    }

    // 3. Power-up Pool
    const powerTypes: PowerUpType[] = ['jetpack', 'magnet', 'multiplier', 'hoverboard'];
    for (const pType of powerTypes) {
      for (let i = 0; i < 2; i++) {
        const mesh = createPowerUpMesh(pType);
        mesh.visible = false;
        this.scene.add(mesh);
        this.powerUpPool.push({
          active: false,
          type: pType,
          lane: 1,
          y: 0,
          z: 50,
          mesh,
        });
      }
    }

    // 4. Particle Burst Pool
    const partGeo = new THREE.BoxGeometry(0.18, 0.18, 0.18);
    const partMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });
    this.geometriesToDispose.push(partGeo);
    this.materialsToDispose.push(partMat);

    for (let i = 0; i < 32; i++) {
      const mesh = new THREE.Mesh(partGeo, partMat.clone());
      mesh.visible = false;
      this.scene.add(mesh);
      this.particlePool.push({
        active: false,
        life: 0,
        maxLife: 0.5,
        vx: 0,
        vy: 0,
        vz: 0,
        mesh,
      });
    }
  }

  public applyQualitySettings(preset: QualityPreset): void {
    this.config.qualityPreset = preset;
    if (this.isSoftwareGl) {
      this.renderer.setPixelRatio(1);
      this.renderer.shadowMap.enabled = false;
      return;
    }
    if (preset === 'low') {
      this.renderer.setPixelRatio(1);
      this.renderer.shadowMap.enabled = false;
    } else if (preset === 'high') {
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    } else {
      const isMobile = window.innerWidth < 768;
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));
      this.renderer.shadowMap.enabled = !isMobile;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }
  }

  public setSkin(skin: RunnerSkin): void {
    const pos = this.runnerRig.root.position.clone();
    const rotY = this.runnerRig.root.rotation.y;
    this.scene.remove(this.runnerRig.root);
    this.disposeObject3D(this.runnerRig.root);

    this.runnerRig = createRunnerModel(skin);
    this.runnerRig.root.position.copy(pos);
    this.runnerRig.root.rotation.y = rotY;
    this.scene.add(this.runnerRig.root);
  }

  public startNewRun(cfg: RunConfig): void {
    this.config = { ...cfg };
    this.applyQualitySettings(cfg.qualityPreset);

    this.clearActiveEntities();
    this.phase = 'playing';
    this.targetLane = 1;
    this.runnerX = 0;
    this.runnerY = 0;
    this.velocityY = 0;
    this.isGrounded = true;
    this.rollTimer = 0;
    this.invulnTimer = 0;

    this.speed = 18.5;
    this.distance = 0;
    this.score = 0;
    this.runCoins = 0;
    this.nextWaveZ = -34;

    this.jetpackTimer = 0;
    this.jetpackMax = getPowerUpDuration('jetpack', cfg.jetpackLevel);
    this.magnetTimer = 0;
    this.magnetMax = getPowerUpDuration('magnet', cfg.magnetLevel);
    this.multiplierTimer = 0;
    this.multiplierMax = getPowerUpDuration('multiplier', cfg.multiplierLevel);
    this.hoverboardTimer = 0;
    this.hoverboardsLeft = cfg.hoverboards;

    this.runnerRig.root.position.set(0, 0, 0);
    this.runnerRig.bodyPivot.scale.set(1, 1, 1);
    this.runnerRig.bodyPivot.rotation.set(0, 0, 0);

    // Pre-populate initial runway waves
    for (let i = 0; i < 4; i++) {
      this.spawnWave();
    }

    soundEngine.unlock();
    soundEngine.startMusic();
    this.emitHud();
  }

  public setPhase(nextPhase: GamePhase): void {
    this.phase = nextPhase;
    if (nextPhase === 'playing') {
      soundEngine.startMusic();
    } else {
      soundEngine.stopMusic();
    }
  }

  public reviveRun(): void {
    // Clear immediate danger ahead of runner
    for (const obs of this.obstaclePool) {
      if (obs.active && obs.z > -32 && obs.z < 12) {
        obs.active = false;
        obs.mesh.visible = false;
      }
    }
    this.phase = 'playing';
    this.invulnTimer = 2.8;
    this.runnerY = 0;
    this.velocityY = 0;
    this.isGrounded = true;
    this.rollTimer = 0;
    this.spawnBurst(this.runnerX, 1.2, 0, 0x06b6d4, 16);
    soundEngine.playPowerUp();
    soundEngine.startMusic();
  }

  public moveLeft(): void {
    if (this.phase !== 'playing') return;
    if (this.targetLane > 0) {
      this.targetLane -= 1;
      soundEngine.playLaneSwitch();
    }
  }

  public moveRight(): void {
    if (this.phase !== 'playing') return;
    if (this.targetLane < 2) {
      this.targetLane += 1;
      soundEngine.playLaneSwitch();
    }
  }

  public jump(): void {
    if (this.phase !== 'playing') return;
    if (this.jetpackTimer > 0) return;
    if (this.isGrounded) {
      this.velocityY = 14.4;
      this.isGrounded = false;
      this.rollTimer = 0;
      soundEngine.playJump();
    }
  }

  public roll(): void {
    if (this.phase !== 'playing') return;
    if (this.jetpackTimer > 0) return;
    this.rollTimer = 0.62;
    if (!this.isGrounded) {
      this.velocityY = Math.min(this.velocityY, -24);
    }
    soundEngine.playRoll();
  }

  public activateHoverboard(): boolean {
    if (this.phase !== 'playing') return false;
    if (this.hoverboardTimer > 0 || this.hoverboardsLeft <= 0) return false;
    this.hoverboardsLeft -= 1;
    this.hoverboardTimer = 14;
    this.spawnBurst(this.runnerX, this.runnerY + 0.5, 0, 0x06b6d4, 12);
    soundEngine.playPowerUp();
    this.emitHud();
    return true;
  }

  private clearActiveEntities(): void {
    for (const o of this.obstaclePool) {
      o.active = false;
      o.mesh.visible = false;
    }
    for (const c of this.coinPool) {
      c.active = false;
      c.magnetized = false;
      c.mesh.visible = false;
    }
    for (const p of this.powerUpPool) {
      p.active = false;
      p.mesh.visible = false;
    }
    for (const pt of this.particlePool) {
      pt.active = false;
      pt.mesh.visible = false;
    }
  }

  private spawnObstacle(kind: ObstacleKind, lane: number, z: number): PooledObstacle | null {
    const item = this.obstaclePool.find((o) => !o.active && o.kind === kind);
    if (!item) return null;
    item.active = true;
    item.lane = lane;
    item.z = z;
    item.extraSpeed = kind === 'train_moving' ? 11.5 : 0;
    item.mesh.position.set(LANE_X[lane], 0, z);
    item.mesh.visible = true;
    return item;
  }

  private spawnCoin(lane: number, y: number, z: number): void {
    const c = this.coinPool.find((item) => !item.active);
    if (!c) return;
    c.active = true;
    c.magnetized = false;
    c.lane = lane;
    c.x = LANE_X[lane];
    c.y = y;
    c.z = z;
    c.mesh.position.set(c.x, y, z);
    c.mesh.visible = true;
  }

  private spawnPowerUp(type: PowerUpType, lane: number, y: number, z: number): void {
    const p = this.powerUpPool.find((item) => !item.active && item.type === type);
    if (!p) return;
    p.active = true;
    p.lane = lane;
    p.y = y;
    p.z = z;
    p.mesh.position.set(LANE_X[lane], y, z);
    p.mesh.visible = true;
  }

  private spawnBurst(x: number, y: number, z: number, colorHex: number, count: number): void {
    const effectiveCount = this.config.qualityPreset === 'low' || this.isSoftwareGl ? Math.ceil(count / 2) : count;
    let spawned = 0;
    for (const pt of this.particlePool) {
      if (pt.active) continue;
      pt.active = true;
      pt.life = 0;
      pt.maxLife = 0.38 + Math.random() * 0.25;
      pt.vx = (Math.random() - 0.5) * 8;
      pt.vy = Math.random() * 6 + 2;
      pt.vz = (Math.random() - 0.5) * 6;
      pt.mesh.position.set(x, y, z);
      (pt.mesh.material as THREE.MeshBasicMaterial).color.setHex(colorHex);
      pt.mesh.scale.setScalar(1);
      pt.mesh.visible = true;
      spawned += 1;
      if (spawned >= effectiveCount) break;
    }
  }

  private spawnWave(): void {
    const zBase = this.nextWaveZ;
    const roll = Math.random();

    // Always leave at least 1 passable lane or jump/roll path!
    if (roll < 0.28) {
      // Classic 2-lane obstacles + 1 open lane with coins
      const openLane = Math.floor(Math.random() * 3);
      for (let lane = 0; lane < 3; lane++) {
        if (lane === openLane) {
          for (let i = 0; i < 5; i++) {
            this.spawnCoin(lane, 0.75, zBase - i * 2.4);
          }
        } else {
          const kind: ObstacleKind = Math.random() < 0.5 ? 'low_hurdle' : 'high_barrier';
          this.spawnObstacle(kind, lane, zBase - 2);
        }
      }
      this.nextWaveZ -= 24;
    } else if (roll < 0.55) {
      // Parked train + ramp with rooftop coins!
      const trainLane = Math.floor(Math.random() * 3);
      const otherLanes = [0, 1, 2].filter((l) => l !== trainLane);
      this.spawnObstacle('train_ramp', trainLane, zBase - 6);
      // Rooftop coin line
      for (let i = 0; i < 4; i++) {
        this.spawnCoin(trainLane, 3.85, zBase - 3 - i * 2.2);
      }
      // One adjacent lane has a hurdle or tall block, other is open
      this.spawnObstacle(Math.random() < 0.5 ? 'low_hurdle' : 'tall_block', otherLanes[0], zBase - 4);
      this.spawnCoin(otherLanes[1], 0.75, zBase - 4);
      this.nextWaveZ -= 28;
    } else if (roll < 0.8) {
      // Moving train in 1 lane + jumpable hurdle with coin arc in another
      const movingLane = Math.floor(Math.random() * 3);
      const hurdleLane = (movingLane + 1) % 3;
      this.spawnObstacle('train_moving', movingLane, zBase - 14);
      this.spawnObstacle('low_hurdle', hurdleLane, zBase - 4);
      // Coin jump arc over hurdle
      this.spawnCoin(hurdleLane, 1.3, zBase - 1.5);
      this.spawnCoin(hurdleLane, 2.2, zBase - 4);
      this.spawnCoin(hurdleLane, 1.3, zBase - 6.5);
      this.nextWaveZ -= 27;
    } else {
      // High barrier + train combo with power-up spawn chance
      const safeLane = Math.floor(Math.random() * 3);
      const trainLane = (safeLane + 1) % 3;
      const barrierLane = (safeLane + 2) % 3;
      this.spawnObstacle('train_static', trainLane, zBase - 5);
      this.spawnObstacle('high_barrier', barrierLane, zBase - 3);
      for (let i = 0; i < 4; i++) {
        this.spawnCoin(barrierLane, 0.65, zBase - i * 2.2);
      }
      for (let i = 0; i < 4; i++) {
        this.spawnCoin(safeLane, 0.75, zBase - i * 2.2);
      }
      this.nextWaveZ -= 26;
    }

    // Occasional power-up spawn in an accessible spot
    if (Math.random() < 0.36) {
      const pTypes: PowerUpType[] = ['jetpack', 'magnet', 'multiplier', 'hoverboard'];
      const pType = pTypes[Math.floor(Math.random() * pTypes.length)];
      const pLane = Math.floor(Math.random() * 3);
      this.spawnPowerUp(pType, pLane, 0.1, zBase + 3);
    }
  }

  private getFloorHeightAtPlayer(): number {
    let floorY = 0;
    for (const obs of this.obstaclePool) {
      if (!obs.active) continue;
      if (obs.lane !== this.targetLane && Math.abs(this.runnerX - LANE_X[obs.lane]) > 1.0) {
        continue;
      }
      if (obs.kind === 'train_static' || obs.kind === 'train_moving' || obs.kind === 'train_ramp') {
        // Carriage roof bounds [-4.8, +4.8] relative to obs.z
        if (obs.z >= -4.8 && obs.z <= 4.8) {
          if (this.runnerY >= 2.35) {
            floorY = Math.max(floorY, 3.05);
          }
        } else if (obs.kind === 'train_ramp' && obs.z < -4.8 && obs.z >= -9.0) {
          // Ramp extends from obs.z + 4.7 to obs.z + 8.9
          const t = (0 - (obs.z + 8.9)) / -4.2;
          const rampY = THREE.MathUtils.clamp(t, 0, 1) * 3.05;
          if (this.runnerY >= rampY - 0.85) {
            floorY = Math.max(floorY, rampY);
          }
        }
      }
    }
    return floorY;
  }

  private handleObstacleHit(): void {
    if (this.invulnTimer > 0 || this.jetpackTimer > 0) return;

    if (this.hoverboardTimer > 0) {
      // Hoverboard absorbs crash and blasts obstacles ahead!
      this.hoverboardTimer = 0;
      this.invulnTimer = 1.6;
      this.shakeTimer = 0.25;
      for (const obs of this.obstaclePool) {
        if (obs.active && obs.z > -18 && obs.z < 8) {
          obs.active = false;
          obs.mesh.visible = false;
        }
      }
      this.spawnBurst(this.runnerX, this.runnerY + 1, 0, 0x06b6d4, 18);
      soundEngine.playShieldBreak();
      this.emitHud();
      return;
    }

    // Crash!
    this.phase = 'crashed';
    this.shakeTimer = 0.35;
    this.spawnBurst(this.runnerX, this.runnerY + 1, 0, 0xef4444, 20);
    soundEngine.stopMusic();
    soundEngine.playCrash();
    this.emitHud();
    this.callbacks.onCrash(Math.floor(this.score), Math.floor(this.distance), this.runCoins);
  }

  private updatePlaying(dt: number): void {
    // Progressive speed ramp
    const speedCap = 40;
    this.speed = Math.min(speedCap, this.speed + dt * 0.26);
    const activeSpeed = this.jetpackTimer > 0 ? this.speed * 1.35 : this.speed;

    // Power-up timers
    if (this.jetpackTimer > 0) this.jetpackTimer = Math.max(0, this.jetpackTimer - dt);
    if (this.magnetTimer > 0) this.magnetTimer = Math.max(0, this.magnetTimer - dt);
    if (this.multiplierTimer > 0) this.multiplierTimer = Math.max(0, this.multiplierTimer - dt);
    if (this.hoverboardTimer > 0) this.hoverboardTimer = Math.max(0, this.hoverboardTimer - dt);
    if (this.invulnTimer > 0) this.invulnTimer = Math.max(0, this.invulnTimer - dt);
    if (this.rollTimer > 0) this.rollTimer = Math.max(0, this.rollTimer - dt);

    // Distance & Score
    const distStep = activeSpeed * dt;
    this.distance += distStep;
    const mult = this.multiplierTimer > 0 ? 2 : 1;
    this.score += distStep * 3.5 * mult;

    // Smooth lane damping
    const targetX = LANE_X[this.targetLane];
    this.runnerX = THREE.MathUtils.damp(this.runnerX, targetX, 15, dt);

    // Vertical physics (Jetpack vs Gravity)
    if (this.jetpackTimer > 0) {
      this.runnerY = THREE.MathUtils.damp(this.runnerY, 5.8, 7, dt);
      this.velocityY = 0;
      this.isGrounded = false;
      this.rollTimer = 0;

      // Spawn sky coin rows ahead occasionally
      if (Math.random() < dt * 2.2) {
        const skyLane = Math.floor(Math.random() * 3);
        for (let i = 0; i < 4; i++) {
          this.spawnCoin(skyLane, 6.2, -55 - i * 2.4);
        }
      }
    } else {
      const floorY = this.getFloorHeightAtPlayer();
      this.velocityY -= 36 * dt;
      this.runnerY += this.velocityY * dt;
      if (this.runnerY <= floorY) {
        this.runnerY = floorY;
        this.velocityY = 0;
        this.isGrounded = true;
      } else {
        this.isGrounded = false;
      }
    }

    // Recycle infinite track segments
    for (const seg of this.segments) {
      seg.position.z += distStep;
      if (seg.position.z > SEGMENT_LENGTH) {
        seg.position.z -= NUM_SEGMENTS * SEGMENT_LENGTH;
      }
    }

    // Advance wave spawning trigger
    this.nextWaveZ += distStep;
    while (this.nextWaveZ > -115) {
      this.spawnWave();
    }

    // Update obstacles & check collisions
    for (const obs of this.obstaclePool) {
      if (!obs.active) continue;
      obs.z += (activeSpeed + obs.extraSpeed) * dt;
      obs.mesh.position.z = obs.z;

      if (obs.z > 18) {
        obs.active = false;
        obs.mesh.visible = false;
        continue;
      }

      // Collision check against runner at z = 0
      const dx = Math.abs(this.runnerX - LANE_X[obs.lane]);
      if (dx < 0.85) {
        if (obs.kind === 'low_hurdle') {
          if (Math.abs(obs.z) < 0.65 && this.runnerY < 0.92) {
            this.handleObstacleHit();
          }
        } else if (obs.kind === 'high_barrier') {
          if (Math.abs(obs.z) < 0.65 && this.rollTimer <= 0 && this.runnerY < 2.2 && this.runnerY > -0.1) {
            this.handleObstacleHit();
          }
        } else if (obs.kind === 'tall_block') {
          if (Math.abs(obs.z) < 0.72 && this.runnerY < 2.1) {
            this.handleObstacleHit();
          }
        } else {
          // Trains: carriage spans [-4.7, +4.7]
          if (obs.z > -4.65 && obs.z < 4.65 && this.runnerY < 2.38) {
            this.handleObstacleHit();
          }
        }
      }
    }

    // Update coins & Magnet attraction
    const magnetActive = this.magnetTimer > 0;
    for (const coin of this.coinPool) {
      if (!coin.active) continue;
      coin.z += activeSpeed * dt;

      if (magnetActive) {
        _vec3A.set(this.runnerX - coin.x, this.runnerY + 0.9 - coin.y, -coin.z);
        if (_vec3A.lengthSq() < 144) {
          coin.magnetized = true;
        }
      }

      if (coin.magnetized) {
        coin.x = THREE.MathUtils.damp(coin.x, this.runnerX, 14, dt);
        coin.y = THREE.MathUtils.damp(coin.y, this.runnerY + 0.9, 14, dt);
        coin.z = THREE.MathUtils.damp(coin.z, 0, 14, dt);
      }

      coin.mesh.position.set(coin.x, coin.y, coin.z);
      coin.mesh.rotation.y += dt * 4.5;

      // Pickup check
      const distSq =
        (coin.x - this.runnerX) * (coin.x - this.runnerX) +
        (coin.y - (this.runnerY + 0.85)) * (coin.y - (this.runnerY + 0.85)) +
        coin.z * coin.z;

      if (distSq < 1.35) {
        coin.active = false;
        coin.magnetized = false;
        coin.mesh.visible = false;
        this.runCoins += 1;
        this.score += 15 * mult;
        this.spawnBurst(coin.x, coin.y, coin.z, 0xfbbf24, 5);
        soundEngine.playCoin();
      } else if (coin.z > 12) {
        coin.active = false;
        coin.magnetized = false;
        coin.mesh.visible = false;
      }
    }

    // Update power-ups
    for (const pu of this.powerUpPool) {
      if (!pu.active) continue;
      pu.z += activeSpeed * dt;
      pu.mesh.position.set(LANE_X[pu.lane], pu.y + Math.sin(this.runAnimTime * 4) * 0.14, pu.z);
      pu.mesh.rotation.y += dt * 2.2;

      const dx = Math.abs(this.runnerX - LANE_X[pu.lane]);
      const dy = Math.abs(this.runnerY - pu.y);
      if (dx < 0.95 && dy < 1.6 && Math.abs(pu.z) < 0.95) {
        pu.active = false;
        pu.mesh.visible = false;
        soundEngine.playPowerUp();

        if (pu.type === 'jetpack') {
          this.jetpackTimer = this.jetpackMax;
          this.spawnBurst(this.runnerX, this.runnerY + 1, 0, 0xf97316, 14);
        } else if (pu.type === 'magnet') {
          this.magnetTimer = this.magnetMax;
          this.spawnBurst(this.runnerX, this.runnerY + 1, 0, 0xef4444, 14);
        } else if (pu.type === 'multiplier') {
          this.multiplierTimer = this.multiplierMax;
          this.spawnBurst(this.runnerX, this.runnerY + 1, 0, 0xa855f7, 14);
        } else {
          this.hoverboardTimer = 14;
          this.spawnBurst(this.runnerX, this.runnerY + 1, 0, 0x06b6d4, 14);
        }
        this.emitHud();
      } else if (pu.z > 12) {
        pu.active = false;
        pu.mesh.visible = false;
      }
    }

    this.hudEmitAccum += dt;
    if (this.hudEmitAccum >= 0.08) {
      this.hudEmitAccum = 0;
      this.emitHud();
    }
  }

  private updateRunnerVisuals(dt: number): void {
    this.runAnimTime += dt * (this.phase === 'playing' ? 1.0 + (this.speed - 18) * 0.025 : 0.45);
    this.runnerRig.root.position.set(this.runnerX, this.runnerY, 0);

    // Invulnerability blink
    if (this.invulnTimer > 0) {
      this.runnerRig.root.visible = Math.floor(this.invulnTimer * 18) % 2 === 0;
    } else {
      this.runnerRig.root.visible = true;
    }

    // Contact shadow tracking
    const shadowScale = Math.max(0.3, 1 - this.runnerY * 0.1);
    this.runnerShadow.position.set(this.runnerX, 0.02, 0);
    this.runnerShadow.scale.setScalar(shadowScale);
    (this.runnerShadow.material as THREE.MeshBasicMaterial).opacity = 0.6 * shadowScale;

    // Power-up attachments
    const jetActive = this.jetpackTimer > 0;
    this.runnerRig.jetpackGroup.visible = jetActive;
    if (jetActive) {
      const flicker = 0.8 + Math.sin(this.runAnimTime * 42) * 0.3;
      this.runnerRig.flameLeft.scale.set(1, flicker, 1);
      this.runnerRig.flameRight.scale.set(1, flicker, 1);
    }

    this.runnerRig.hoverboardGroup.visible = this.hoverboardTimer > 0 && !jetActive;
    this.runnerRig.magnetHalo.visible = this.magnetTimer > 0;
    if (this.magnetTimer > 0) {
      this.runnerRig.magnetHalo.rotation.z += dt * 4;
    }

    // Limb animation
    const laneDiff = LANE_X[this.targetLane] - this.runnerX;
    this.runnerRig.bodyPivot.rotation.z = -laneDiff * 0.14;

    if (this.phase === 'menu') {
      // Idle showcase animation on live tracks
      this.runnerRig.root.rotation.y = Math.sin(this.runAnimTime * 0.7) * 0.25;
      this.runnerRig.leftArm.rotation.x = Math.sin(this.runAnimTime * 2) * 0.12;
      this.runnerRig.rightArm.rotation.x = -Math.sin(this.runAnimTime * 2) * 0.12;
      this.runnerRig.leftLeg.rotation.x = 0;
      this.runnerRig.rightLeg.rotation.x = 0;
      this.runnerRig.bodyPivot.position.y = 0.85 + Math.sin(this.runAnimTime * 3) * 0.03;
      this.runnerRig.bodyPivot.scale.set(1, 1, 1);
    } else if (this.rollTimer > 0) {
      this.runnerRig.root.rotation.y = 0;
      this.runnerRig.bodyPivot.scale.set(1.08, 0.52, 1.08);
      this.runnerRig.bodyPivot.position.y = 0.44;
      this.runnerRig.bodyPivot.rotation.x = 0.45;
    } else if (jetActive) {
      this.runnerRig.root.rotation.y = 0;
      this.runnerRig.bodyPivot.scale.set(1, 1, 1);
      this.runnerRig.bodyPivot.position.y = 0.85;
      this.runnerRig.bodyPivot.rotation.x = -0.35;
      this.runnerRig.leftLeg.rotation.x = 0.35;
      this.runnerRig.rightLeg.rotation.x = 0.2;
      this.runnerRig.leftArm.rotation.x = -0.3;
      this.runnerRig.rightArm.rotation.x = -0.3;
    } else if (this.hoverboardTimer > 0) {
      this.runnerRig.root.rotation.y = 0.35;
      this.runnerRig.bodyPivot.scale.set(1, 1, 1);
      this.runnerRig.bodyPivot.position.y = 0.94 + Math.sin(this.runAnimTime * 6) * 0.04;
      this.runnerRig.bodyPivot.rotation.x = 0.06;
      this.runnerRig.leftLeg.rotation.x = -0.15;
      this.runnerRig.rightLeg.rotation.x = 0.15;
    } else if (!this.isGrounded) {
      this.runnerRig.root.rotation.y = 0;
      this.runnerRig.bodyPivot.scale.set(1, 1, 1);
      this.runnerRig.bodyPivot.position.y = 0.85;
      this.runnerRig.bodyPivot.rotation.x = 0.14;
      this.runnerRig.leftLeg.rotation.x = 0.65;
      this.runnerRig.rightLeg.rotation.x = -0.45;
      this.runnerRig.leftArm.rotation.x = -0.8;
      this.runnerRig.rightArm.rotation.x = 0.45;
    } else {
      this.runnerRig.root.rotation.y = 0;
      this.runnerRig.bodyPivot.scale.set(1, 1, 1);
      this.runnerRig.bodyPivot.rotation.x = 0.12;
      const swing = Math.sin(this.runAnimTime * 11);
      this.runnerRig.leftLeg.rotation.x = swing * 0.85;
      this.runnerRig.rightLeg.rotation.x = -swing * 0.85;
      this.runnerRig.leftArm.rotation.x = -swing * 0.75;
      this.runnerRig.rightArm.rotation.x = swing * 0.75;
      this.runnerRig.bodyPivot.position.y = 0.85 + Math.abs(Math.cos(this.runAnimTime * 11)) * 0.07;
    }

    // Update burst particles
    for (const pt of this.particlePool) {
      if (!pt.active) continue;
      pt.life += dt;
      if (pt.life >= pt.maxLife) {
        pt.active = false;
        pt.mesh.visible = false;
        continue;
      }
      pt.vy -= 14 * dt;
      pt.mesh.position.x += pt.vx * dt;
      pt.mesh.position.y += pt.vy * dt;
      pt.mesh.position.z += pt.vz * dt;
      const remain = 1 - pt.life / pt.maxLife;
      pt.mesh.scale.setScalar(remain);
    }
  }

  private updateCamera(dt: number): void {
    const targetCamX = this.phase === 'menu' ? this.runnerX * 0.35 + 1.4 : this.runnerX * 0.68;
    const targetCamY =
      this.phase === 'menu'
        ? 2.8
        : this.jetpackTimer > 0
          ? 7.8
          : 4.35 + this.runnerY * 0.62;
    const targetCamZ = this.phase === 'menu' ? 4.9 : 7.4;

    this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, targetCamX, 8, dt);
    this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, targetCamY, 7, dt);
    this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, targetCamZ, 7, dt);

    if (this.shakeTimer > 0) {
      this.shakeTimer = Math.max(0, this.shakeTimer - dt);
      this.camera.position.x += (Math.random() - 0.5) * 0.32;
      this.camera.position.y += (Math.random() - 0.5) * 0.32;
    }

    const targetFov = this.phase === 'playing' ? 62 + Math.max(0, (this.speed - 18) * 0.45) : 54;
    if (Math.abs(this.camera.fov - targetFov) > 0.05) {
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 5, dt);
      this.camera.updateProjectionMatrix();
    }

    const lookY = this.phase === 'menu' ? 1.55 : 1.7 + this.runnerY * 0.55;
    const lookZ = this.phase === 'menu' ? -3.5 : -12;
    this.camera.lookAt(this.runnerX * 0.45, lookY, lookZ);
  }

  private emitHud(): void {
    this.callbacks.onHudUpdate({
      score: Math.floor(this.score),
      distance: Math.floor(this.distance),
      runCoins: this.runCoins,
      speed: Math.round(this.speed),
      multiplier: this.multiplierTimer > 0 ? 2 : 1,
      hoverboardsLeft: this.hoverboardsLeft,
      powerUps: {
        jetpack: this.jetpackTimer,
        jetpackMax: this.jetpackMax,
        magnet: this.magnetTimer,
        magnetMax: this.magnetMax,
        multiplier: this.multiplierTimer,
        multiplierMax: this.multiplierMax,
        hoverboardActive: this.hoverboardTimer > 0,
      },
    });
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) : null;
    if (!sync) {
      this.frameId = window.setTimeout(cb, 80);
      return;
    }
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const state = gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private tick = (): void => {
    if (this.disposed) return;
    const rawDelta = this.clock.getDelta();
    const dt = Math.min(rawDelta, 0.05);

    if (this.phase === 'playing') {
      this.updatePlaying(dt);
    } else if (this.phase === 'menu') {
      // Gentle idle world ambiance in menu
      for (const seg of this.segments) {
        seg.position.z += 4.5 * dt;
        if (seg.position.z > SEGMENT_LENGTH) {
          seg.position.z -= NUM_SEGMENTS * SEGMENT_LENGTH;
        }
      }
    }

    if (this.phase !== 'paused') {
      this.updateRunnerVisuals(dt);
      this.updateCamera(dt);
    }

    this.renderer.render(this.scene, this.camera);

    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  };

  private handleResize = (): void => {
    if (this.disposed) return;
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.applyQualitySettings(this.config.qualityPreset);
  };

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (this.phase !== 'playing') return;
    if (e.repeat) return;

    switch (e.code) {
      case 'ArrowLeft':
      case 'KeyA':
        this.moveLeft();
        break;
      case 'ArrowRight':
      case 'KeyD':
        this.moveRight();
        break;
      case 'ArrowUp':
      case 'KeyW':
      case 'Space':
        e.preventDefault();
        this.jump();
        break;
      case 'ArrowDown':
      case 'KeyS':
        e.preventDefault();
        this.roll();
        break;
      case 'KeyE':
      case 'ShiftLeft':
      case 'ShiftRight':
        this.activateHoverboard();
        break;
    }
  };

  private handleTouchStart = (e: TouchEvent): void => {
    if (this.phase !== 'playing' || e.touches.length === 0) return;
    this.touchStartX = e.touches[0].clientX;
    this.touchStartY = e.touches[0].clientY;
    this.touchSwipeConsumed = false;

    const now = performance.now();
    if (now - this.lastTapTime < 260) {
      this.activateHoverboard();
      this.lastTapTime = 0;
    } else {
      this.lastTapTime = now;
    }
  };

  private handleTouchMove = (e: TouchEvent): void => {
    if (this.phase !== 'playing' || this.touchSwipeConsumed || e.touches.length === 0) return;
    const dx = e.touches[0].clientX - this.touchStartX;
    const dy = e.touches[0].clientY - this.touchStartY;
    const threshold = 26;

    if (Math.abs(dx) > threshold || Math.abs(dy) > threshold) {
      this.touchSwipeConsumed = true;
      if (Math.abs(dx) > Math.abs(dy)) {
        if (dx < 0) this.moveLeft();
        else this.moveRight();
      } else {
        if (dy < 0) this.jump();
        else this.roll();
      }
    }
  };

  private handleContextLost = (e: Event): void => {
    e.preventDefault();
    this.callbacks.onContextLostChange?.(true);
  };

  private handleContextRestored = (): void => {
    this.callbacks.onContextLostChange?.(false);
  };

  private bindEvents(): void {
    window.addEventListener('resize', this.handleResize);
    window.addEventListener('keydown', this.handleKeyDown);
    const canvas = this.renderer.domElement;
    canvas.addEventListener('touchstart', this.handleTouchStart, { passive: true });
    canvas.addEventListener('touchmove', this.handleTouchMove, { passive: true });
    canvas.addEventListener('webglcontextlost', this.handleContextLost);
    canvas.addEventListener('webglcontextrestored', this.handleContextRestored);
  }

  private disposeObject3D(obj: THREE.Object3D): void {
    obj.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    window.clearTimeout(this.frameId);
    soundEngine.stopMusic();

    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('keydown', this.handleKeyDown);
    const canvas = this.renderer.domElement;
    canvas.removeEventListener('touchstart', this.handleTouchStart);
    canvas.removeEventListener('touchmove', this.handleTouchMove);
    canvas.removeEventListener('webglcontextlost', this.handleContextLost);
    canvas.removeEventListener('webglcontextrestored', this.handleContextRestored);

    this.textures.dispose();
    this.geometriesToDispose.forEach((g) => g.dispose());
    this.materialsToDispose.forEach((m) => m.dispose());
    this.obstaclePool.forEach((o) => this.disposeObject3D(o.mesh));
    this.powerUpPool.forEach((p) => this.disposeObject3D(p.mesh));
    this.disposeObject3D(this.runnerRig.root);

    this.renderer.dispose();
    if (canvas.parentElement === this.container) {
      this.container.removeChild(canvas);
    }
  }
}
