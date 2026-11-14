import * as THREE from 'three';
import type { PowerUpType, RunnerSkin } from '../types/game';
import type { GameTextureSet } from './textures';

export interface RunnerRig {
  root: THREE.Group;
  bodyPivot: THREE.Group;
  headGroup: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  jetpackGroup: THREE.Group;
  flameLeft: THREE.Mesh;
  flameRight: THREE.Mesh;
  hoverboardGroup: THREE.Group;
  magnetHalo: THREE.Mesh;
}

export function createRunnerModel(skin: RunnerSkin): RunnerRig {
  const root = new THREE.Group();
  const bodyPivot = new THREE.Group();
  bodyPivot.position.y = 0.85;
  root.add(bodyPivot);

  const jacketMat = new THREE.MeshStandardMaterial({
    color: skin.primaryColor,
    roughness: 0.52,
    metalness: 0.12,
  });
  const pantsMat = new THREE.MeshStandardMaterial({
    color: skin.secondaryColor,
    roughness: 0.78,
    metalness: 0.05,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: skin.accentColor,
    roughness: 0.28,
    metalness: 0.45,
  });
  const skinMat = new THREE.MeshStandardMaterial({
    color: skin.skinTone,
    roughness: 0.65,
    metalness: 0.02,
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.35,
    metalness: 0.6,
  });

  // 1. Torso jacket
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.64, 0.32), jacketMat);
  torso.position.y = 0.28;
  torso.castShadow = true;
  bodyPivot.add(torso);

  // 2. Chest stripe / collar trim
  const chestTrim = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.12, 0.34), accentMat);
  chestTrim.position.y = 0.46;
  bodyPivot.add(chestTrim);

  // 3. Backpack core
  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.44, 0.18), darkMat);
  pack.position.set(0, 0.3, 0.22);
  pack.castShadow = true;
  bodyPivot.add(pack);

  // 4. Head group + headwear + eyewear
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.66, 0);
  bodyPivot.add(headGroup);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.38, 0.38), skinMat);
  head.position.y = 0.18;
  head.castShadow = true;
  headGroup.add(head);

  if (skin.headwear === 'cap') {
    const crown = new THREE.Mesh(new THREE.BoxGeometry(0.41, 0.16, 0.41), accentMat);
    crown.position.set(0, 0.36, 0);
    headGroup.add(crown);
    const brim = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.05, 0.22), darkMat);
    brim.position.set(0, 0.31, -0.24);
    headGroup.add(brim);
  } else if (skin.headwear === 'visor') {
    const helmet = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.2, 0.43), jacketMat);
    helmet.position.set(0, 0.34, 0.01);
    headGroup.add(helmet);
    const visor = new THREE.Mesh(
      new THREE.BoxGeometry(0.41, 0.12, 0.08),
      new THREE.MeshStandardMaterial({
        color: skin.accentColor,
        emissive: skin.accentColor,
        emissiveIntensity: 0.6,
        roughness: 0.15,
        metalness: 0.85,
      }),
    );
    visor.position.set(0, 0.22, -0.2);
    headGroup.add(visor);
  } else if (skin.headwear === 'helmet') {
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 12), accentMat);
    dome.position.set(0, 0.32, 0);
    headGroup.add(dome);
    const goggles = new THREE.Mesh(new THREE.BoxGeometry(0.39, 0.11, 0.1), darkMat);
    goggles.position.set(0, 0.22, -0.19);
    headGroup.add(goggles);
  } else if (skin.headwear === 'beanie') {
    const beanie = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.22, 12), darkMat);
    beanie.position.set(0, 0.39, 0.02);
    headGroup.add(beanie);
  } else {
    // Crown headwear
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.12, 8), accentMat);
    band.position.set(0, 0.38, 0);
    headGroup.add(band);
  }

  // Eyes / shades
  const shades = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.08, 0.04), darkMat);
  shades.position.set(0, 0.21, -0.19);
  headGroup.add(shades);

  // 5 & 6. Articulated Arms
  const buildArm = (xOffset: number): THREE.Group => {
    const arm = new THREE.Group();
    arm.position.set(xOffset, 0.52, 0);
    const sleeve = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.42, 0.16), jacketMat);
    sleeve.position.y = -0.18;
    sleeve.castShadow = true;
    arm.add(sleeve);
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.13, 0.13), skinMat);
    hand.position.y = -0.44;
    arm.add(hand);
    return arm;
  };
  const leftArm = buildArm(-0.37);
  const rightArm = buildArm(0.37);
  bodyPivot.add(leftArm, rightArm);

  // 7 & 8. Articulated Legs + Sneakers
  const buildLeg = (xOffset: number): THREE.Group => {
    const leg = new THREE.Group();
    leg.position.set(xOffset, -0.02, 0);
    const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.52, 0.22), pantsMat);
    thigh.position.y = -0.26;
    thigh.castShadow = true;
    leg.add(thigh);
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, 0.34), accentMat);
    shoe.position.set(0, -0.58, -0.05);
    shoe.castShadow = true;
    leg.add(shoe);
    const sole = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.05, 0.35), new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4 }));
    sole.position.set(0, -0.66, -0.05);
    leg.add(sole);
    return leg;
  };
  const leftLeg = buildLeg(-0.15);
  const rightLeg = buildLeg(0.15);
  bodyPivot.add(leftLeg, rightLeg);

  // 9. Twin-Thruster Jetpack (visible during Jetpack power-up)
  const jetpackGroup = new THREE.Group();
  jetpackGroup.position.set(0, 0.3, 0.26);
  jetpackGroup.visible = false;
  bodyPivot.add(jetpackGroup);

  const thrusterMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.22,
    metalness: 0.85,
  });
  const flameMat = new THREE.MeshBasicMaterial({
    color: 0xf97316,
  });

  const makeThruster = (x: number): THREE.Mesh => {
    const canister = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.46, 10), thrusterMat);
    canister.position.set(x, 0, 0);
    jetpackGroup.add(canister);
    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.13, 0.12, 10), darkMat);
    nozzle.position.set(x, -0.26, 0);
    jetpackGroup.add(nozzle);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.45, 8), flameMat);
    flame.rotation.x = Math.PI;
    flame.position.set(x, -0.52, 0);
    jetpackGroup.add(flame);
    return flame;
  };
  const flameLeft = makeThruster(-0.14);
  const flameRight = makeThruster(0.14);

  // 10. Hoverboard Shield (visible when Hoverboard active)
  const hoverboardGroup = new THREE.Group();
  hoverboardGroup.position.set(0, 0.12, 0);
  hoverboardGroup.visible = false;
  root.add(hoverboardGroup);

  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 0.08, 1.8),
    new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      emissive: 0x0891b2,
      emissiveIntensity: 0.45,
      roughness: 0.2,
      metalness: 0.6,
    }),
  );
  hoverboardGroup.add(deck);
  const rim = new THREE.Mesh(
    new THREE.BoxGeometry(0.76, 0.04, 1.84),
    new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.3, metalness: 0.5 }),
  );
  hoverboardGroup.add(rim);

  // 11. Magnet Halo (visible when Coin Magnet active)
  const magnetHalo = new THREE.Mesh(
    new THREE.TorusGeometry(0.68, 0.04, 8, 24),
    new THREE.MeshBasicMaterial({ color: 0xef4444 }),
  );
  magnetHalo.rotation.x = Math.PI / 2;
  magnetHalo.position.y = 1.05;
  magnetHalo.visible = false;
  root.add(magnetHalo);

  return {
    root,
    bodyPivot,
    headGroup,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    jetpackGroup,
    flameLeft,
    flameRight,
    hoverboardGroup,
    magnetHalo,
  };
}

export function createTrainModel(
  variant: 0 | 1 | 2,
  hasRamp: boolean,
  textures: GameTextureSet,
): THREE.Group {
  const group = new THREE.Group();
  const sideTex =
    variant === 0 ? textures.trainTeal : variant === 1 ? textures.trainCrimson : textures.trainAmber;
  const bodyColor = variant === 0 ? 0x0284c7 : variant === 1 ? 0xdc2626 : 0x0d9488;

  const sideMat = new THREE.MeshStandardMaterial({
    map: sideTex,
    roughness: 0.32,
    metalness: 0.35,
  });
  const roofMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.45,
    metalness: 0.3,
  });
  const chassisMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.8,
    metalness: 0.25,
  });
  const cabMat = new THREE.MeshStandardMaterial({
    color: bodyColor,
    roughness: 0.3,
    metalness: 0.4,
  });

  // 1. Undercarriage chassis
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.42, 9.6), chassisMat);
  chassis.position.set(0, 0.25, 0);
  group.add(chassis);

  // 2. Main carriage body (with livery texture on sides)
  const bodyGeo = new THREE.BoxGeometry(2.12, 2.45, 9.4);
  const body = new THREE.Mesh(bodyGeo, [
    sideMat,
    sideMat,
    roofMat,
    chassisMat,
    cabMat,
    cabMat,
  ]);
  body.position.set(0, 1.68, 0);
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // 3. Roof bevel / AC pods
  const acMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.5, metalness: 0.5 });
  const ac1 = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.28, 1.8), acMat);
  ac1.position.set(0, 3.04, -2.2);
  const ac2 = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.28, 1.8), acMat);
  ac2.position.set(0, 3.04, 2.2);
  group.add(ac1, ac2);

  // 4. Front cab windshield (facing +Z toward player)
  const windshield = new THREE.Mesh(
    new THREE.BoxGeometry(1.72, 0.85, 0.12),
    new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.1,
      metalness: 0.9,
    }),
  );
  windshield.position.set(0, 2.15, 4.71);
  group.add(windshield);

  // 5. Dual glowing headlights
  const headlightMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
  const hlLeft = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.2, 0.1), headlightMat);
  hlLeft.position.set(-0.66, 0.95, 4.72);
  const hlRight = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.2, 0.1), headlightMat);
  hlRight.position.set(0.66, 0.95, 4.72);
  group.add(hlLeft, hlRight);

  // 6. Front bumper
  const bumper = new THREE.Mesh(
    new THREE.BoxGeometry(2.18, 0.24, 0.3),
    new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.4, metalness: 0.4 }),
  );
  bumper.position.set(0, 0.56, 4.75);
  group.add(bumper);

  // 7. Optional sloped ramp at +Z front so player can climb onto train roof
  if (hasRamp) {
    const rampShape = new THREE.Shape();
    rampShape.moveTo(0, 0);
    rampShape.lineTo(4.2, 0);
    rampShape.lineTo(4.2, 2.9);
    rampShape.closePath();

    const rampGeo = new THREE.ExtrudeGeometry(rampShape, {
      depth: 1.9,
      bevelEnabled: false,
    });
    rampGeo.rotateY(Math.PI / 2);
    rampGeo.translate(-0.95, 0, 8.9);

    const rampMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      roughness: 0.5,
      metalness: 0.3,
    });
    const rampMesh = new THREE.Mesh(rampGeo, rampMat);
    rampMesh.castShadow = true;
    rampMesh.receiveShadow = true;
    group.add(rampMesh);
  }

  return group;
}

export function createLowHurdleModel(textures: GameTextureSet): THREE.Group {
  const group = new THREE.Group();
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.85 });
  const postMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.4, metalness: 0.5 });
  const barMat = new THREE.MeshStandardMaterial({ map: textures.hazard, roughness: 0.45 });

  const baseL = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.25, 0.48), baseMat);
  baseL.position.set(-0.85, 0.125, 0);
  const baseR = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.25, 0.48), baseMat);
  baseR.position.set(0.85, 0.125, 0);

  const postL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.85, 0.14), postMat);
  postL.position.set(-0.85, 0.65, 0);
  const postR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.85, 0.14), postMat);
  postR.position.set(0.85, 0.65, 0);

  const bar = new THREE.Mesh(new THREE.BoxGeometry(1.98, 0.34, 0.18), barMat);
  bar.position.set(0, 0.92, 0);
  bar.castShadow = true;

  group.add(baseL, baseR, postL, postR, bar);
  return group;
}

export function createHighBarrierModel(textures: GameTextureSet): THREE.Group {
  const group = new THREE.Group();
  const postMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.45, metalness: 0.6 });
  const beamMat = new THREE.MeshStandardMaterial({ map: textures.hazard, roughness: 0.4 });
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });

  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.35, 0.24), postMat);
  legL.position.set(-0.92, 1.175, 0);
  legL.castShadow = true;
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.35, 0.24), postMat);
  legR.position.set(0.92, 1.175, 0);
  legR.castShadow = true;

  const topBeam = new THREE.Mesh(new THREE.BoxGeometry(2.04, 0.68, 0.28), beamMat);
  topBeam.position.set(0, 1.72, 0);
  topBeam.castShadow = true;

  const beaconL = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.16, 8), beaconMat);
  beaconL.position.set(-0.75, 2.16, 0);
  const beaconR = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.16, 8), beaconMat);
  beaconR.position.set(0.75, 2.16, 0);

  group.add(legL, legR, topBeam, beaconL, beaconR);
  return group;
}

export function createTallBlockModel(textures: GameTextureSet): THREE.Group {
  const group = new THREE.Group();
  const concreteMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.82 });
  const hazardMat = new THREE.MeshStandardMaterial({ map: textures.hazard, roughness: 0.4 });

  const base = new THREE.Mesh(new THREE.BoxGeometry(1.96, 1.85, 0.65), concreteMat);
  base.position.set(0, 0.925, 0);
  base.castShadow = true;
  base.receiveShadow = true;

  const cap = new THREE.Mesh(new THREE.BoxGeometry(2.04, 0.36, 0.72), hazardMat);
  cap.position.set(0, 1.98, 0);
  cap.castShadow = true;

  const panel = new THREE.Mesh(new THREE.BoxGeometry(1.76, 0.5, 0.7), hazardMat);
  panel.position.set(0, 1.1, 0);

  group.add(base, cap, panel);
  return group;
}

export function createPowerUpMesh(type: PowerUpType): THREE.Group {
  const group = new THREE.Group();

  const haloColor =
    type === 'jetpack'
      ? 0xf97316
      : type === 'magnet'
        ? 0xef4444
        : type === 'multiplier'
          ? 0xa855f7
          : 0x06b6d4;

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.56, 0.045, 8, 24),
    new THREE.MeshBasicMaterial({ color: haloColor }),
  );
  ring.position.y = 0.85;
  group.add(ring);

  if (type === 'jetpack') {
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.25, metalness: 0.65 });
    const trimMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3, metalness: 0.7 });
    const tankL = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.58, 10), trimMat);
    tankL.position.set(-0.16, 0.85, 0);
    const tankR = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.58, 10), trimMat);
    tankR.position.set(0.16, 0.85, 0);
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.28, 0.24), bodyMat);
    bridge.position.set(0, 0.9, 0);
    group.add(tankL, tankR, bridge);
  } else if (type === 'magnet') {
    const redMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.3, metalness: 0.45 });
    const tipMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.2, metalness: 0.85 });
    const arch = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.09, 8, 16, Math.PI), redMat);
    arch.position.set(0, 0.8, 0);
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.22, 0.16), tipMat);
    legL.position.set(-0.28, 0.68, 0);
    const legR = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.22, 0.16), tipMat);
    legR.position.set(0.28, 0.68, 0);
    group.add(arch, legL, legR);
  } else if (type === 'multiplier') {
    const gem = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.36, 0),
      new THREE.MeshStandardMaterial({
        color: 0xa855f7,
        emissive: 0x7e22ce,
        emissiveIntensity: 0.45,
        roughness: 0.2,
        metalness: 0.6,
      }),
    );
    gem.position.y = 0.85;
    group.add(gem);
  } else {
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(0.38, 0.08, 0.82),
      new THREE.MeshStandardMaterial({
        color: 0x06b6d4,
        emissive: 0x0891b2,
        emissiveIntensity: 0.5,
        roughness: 0.2,
        metalness: 0.6,
      }),
    );
    board.position.y = 0.85;
    board.rotation.x = 0.45;
    board.rotation.z = 0.3;
    group.add(board);
  }

  return group;
}
