import * as THREE from 'three';
import { IngredientStep, LabLocationId, SafetyGearState } from '../types/chemistry';
import {
  createGraduatedBeakerTexture,
  createHazardStripeTexture,
  createRadialShadowTexture,
} from './proceduralTextures';

export interface VesselSpawnMetrics {
  nozzleY: number;
  nozzleRadius: number;
  liquidMesh: THREE.Mesh;
  catalystDropperGroup: THREE.Group;
}

export interface ScientistAvatarRig {
  group: THREE.Group;
  bodyGroup: THREE.Group;
  leftLegGroup: THREE.Group;
  rightLegGroup: THREE.Group;
  leftArmGroup: THREE.Group;
  rightArmGroup: THREE.Group;
  gogglesGroup: THREE.Group;
  glovesGroup: THREE.Group;
  bareHandsGroup: THREE.Group;
  bareHandsMat: THREE.MeshStandardMaterial;
  foamSnowmanGroup: THREE.Group;
  foamSnowmanMat: THREE.MeshStandardMaterial;
  hazmatTorsoMesh: THREE.Mesh;
  labCoatTorsoMesh: THREE.Mesh;
  hazmatHelmetRing: THREE.Mesh;
  remoteBoxGroup: THREE.Group;
  carriedBottleGroup: THREE.Group;
  carriedBottleMat: THREE.MeshPhysicalMaterial;
}

export interface SupplyStationRig {
  group: THREE.Group;
  clickableTargets: THREE.Object3D[];
  chemTablePos: THREE.Vector3;
  safetyRackPos: THREE.Vector3;
}

// Helper to add a grounded radial contact shadow plane at y = 0.02
function addContactShadow(parent: THREE.Group, radius: number, shadowTex: THREE.Texture) {
  const geo = new THREE.PlaneGeometry(radius * 2.2, radius * 2.2);
  const mat = new THREE.MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    depthWrite: false,
    opacity: 0.5,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.02;
  parent.add(mesh);
}

/**
 * SCALE 1: Laboratory Beaker & Precision Bench Rig (Composite 10-part THREE.Group)
 */
export function createLabBeakerRig(
  isSoftwareGl: boolean,
  maxAnisotropy: number
): { group: THREE.Group; metrics: VesselSpawnMetrics } {
  const group = new THREE.Group();
  const shadowTex = createRadialShadowTexture();
  const beakerTex = createGraduatedBeakerTexture(maxAnisotropy);

  addContactShadow(group, 2.8, shadowTex);

  const frameSteelMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    metalness: 0.85,
    roughness: 0.22,
  });
  const slateTopMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    metalness: 0.1,
    roughness: 0.75,
  });
  const brushedAluminumMat = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    metalness: 0.9,
    roughness: 0.28,
  });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xe0f2fe,
    metalness: 0.0,
    roughness: 0.08,
    transmission: isSoftwareGl ? 0 : 0.92,
    transparent: true,
    opacity: isSoftwareGl ? 0.38 : 1.0,
    ior: 1.47,
    thickness: 0.25,
    clearcoat: 1.0,
    depthWrite: false,
  });

  // 1. Four Tubular Steel Table Legs + Foot Pads
  const legGeo = new THREE.CylinderGeometry(0.08, 0.08, 1.4, 16);
  const footGeo = new THREE.CylinderGeometry(0.14, 0.16, 0.06, 16);
  const legCoords = [
    [-1.6, -1.0],
    [1.6, -1.0],
    [-1.6, 1.0],
    [1.6, 1.0],
  ];
  legCoords.forEach(([lx, lz]) => {
    const leg = new THREE.Mesh(legGeo, frameSteelMat);
    leg.position.set(lx, 0.7, lz);
    leg.castShadow = true;
    group.add(leg);

    const foot = new THREE.Mesh(footGeo, slateTopMat);
    foot.position.set(lx, 0.03, lz);
    group.add(foot);
  });

  // 2. Lab Bench Tabletop (Slate chemical-resistant deck)
  const topGeo = new THREE.BoxGeometry(3.6, 0.14, 2.3);
  const tabletop = new THREE.Mesh(topGeo, slateTopMat);
  tabletop.position.set(0, 1.47, 0);
  tabletop.receiveShadow = true;
  tabletop.castShadow = true;
  group.add(tabletop);

  // 3. Magnetic Hotplate Stirrer Base under the Beaker
  const stirrerBaseGeo = new THREE.BoxGeometry(0.95, 0.16, 0.95);
  const stirrerBase = new THREE.Mesh(stirrerBaseGeo, brushedAluminumMat);
  stirrerBase.position.set(0, 1.62, 0);
  stirrerBase.castShadow = true;
  group.add(stirrerBase);

  const hotplateDiskGeo = new THREE.CylinderGeometry(0.38, 0.4, 0.04, 32);
  const hotplateDisk = new THREE.Mesh(hotplateDiskGeo, frameSteelMat);
  hotplateDisk.position.set(0, 1.72, 0);
  group.add(hotplateDisk);

  // 4. Stirrer Control Knobs (2x)
  const knobGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.05, 16);
  knobGeo.rotateX(Math.PI / 2);
  [-0.24, 0.24].forEach((kx) => {
    const knob = new THREE.Mesh(knobGeo, slateTopMat);
    knob.position.set(kx, 1.62, 0.49);
    group.add(knob);
  });

  // 5. Graduated Borosilicate Erlenmeyer / Beaker Vessel (LatheGeometry profile)
  const beakerPoints = [
    new THREE.Vector2(0.01, 0.0),
    new THREE.Vector2(0.46, 0.0),
    new THREE.Vector2(0.48, 0.08),
    new THREE.Vector2(0.42, 0.65),
    new THREE.Vector2(0.28, 1.18),
    new THREE.Vector2(0.26, 1.48),
    new THREE.Vector2(0.31, 1.56),
    new THREE.Vector2(0.25, 1.56),
  ];
  const beakerGeo = new THREE.LatheGeometry(beakerPoints, 40);
  const beakerMesh = new THREE.Mesh(beakerGeo, glassMat);
  beakerMesh.position.set(0, 1.74, 0);
  beakerMesh.renderOrder = 3;
  group.add(beakerMesh);

  // 6. Graduation Markings Overlay Cylinder
  const labelGeo = new THREE.CylinderGeometry(0.36, 0.46, 1.0, 32, 1, true);
  const labelMat = new THREE.MeshBasicMaterial({
    map: beakerTex,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const labelMesh = new THREE.Mesh(labelGeo, labelMat);
  labelMesh.position.set(0, 2.28, 0);
  labelMesh.renderOrder = 4;
  group.add(labelMesh);

  // 7. Dynamic Liquid Volume inside the Beaker
  const liquidGeo = new THREE.CylinderGeometry(0.34, 0.44, 0.55, 32);
  const liquidMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    roughness: 0.15,
    metalness: 0.05,
    transparent: true,
    opacity: 0.85,
  });
  const liquidMesh = new THREE.Mesh(liquidGeo, liquidMat);
  liquidMesh.position.set(0, 2.04, 0);
  liquidMesh.renderOrder = 2;
  group.add(liquidMesh);

  // 8. Overhead Ring Stand & Motorized Catalyst Dropper Funnel
  const rodGeo = new THREE.CylinderGeometry(0.035, 0.035, 2.4, 16);
  const standRod = new THREE.Mesh(rodGeo, brushedAluminumMat);
  standRod.position.set(-0.85, 2.7, -0.35);
  standRod.castShadow = true;
  group.add(standRod);

  const armGeo = new THREE.BoxGeometry(0.95, 0.05, 0.08);
  const clampArm = new THREE.Mesh(armGeo, frameSteelMat);
  clampArm.position.set(-0.42, 3.65, -0.18);
  clampArm.rotation.y = -0.35;
  group.add(clampArm);

  const catalystDropperGroup = new THREE.Group();
  catalystDropperGroup.position.set(0, 3.65, 0);
  const cupGeo = new THREE.CylinderGeometry(0.16, 0.09, 0.32, 24);
  const cupMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    metalness: 0.4,
    roughness: 0.35,
  });
  const cupMesh = new THREE.Mesh(cupGeo, cupMat);
  catalystDropperGroup.add(cupMesh);
  group.add(catalystDropperGroup);

  // 9. Auxiliary Reagent Bottles on Side of Bench
  const bottleGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.42, 20);
  const peroxideBottleMat = new THREE.MeshStandardMaterial({
    color: 0x0284c7,
    roughness: 0.3,
    metalness: 0.1,
  });
  const soapBottleMat = new THREE.MeshStandardMaterial({
    color: 0x10b981,
    roughness: 0.35,
    metalness: 0.1,
  });
  const b1 = new THREE.Mesh(bottleGeo, peroxideBottleMat);
  b1.position.set(1.15, 1.75, -0.4);
  b1.castShadow = true;
  group.add(b1);

  const b2 = new THREE.Mesh(bottleGeo, soapBottleMat);
  b2.position.set(1.38, 1.75, 0.05);
  b2.castShadow = true;
  group.add(b2);

  return {
    group,
    metrics: {
      nozzleY: 3.3,
      nozzleRadius: 0.28,
      liquidMesh,
      catalystDropperGroup,
    },
  };
}

/**
 * SCALE 2: Backyard Kiddie Pool & Overhead Mechanical Trough Rig (Composite 9-part THREE.Group)
 */
export function createKiddiePoolRig(
  maxAnisotropy: number
): { group: THREE.Group; metrics: VesselSpawnMetrics } {
  const group = new THREE.Group();
  const shadowTex = createRadialShadowTexture();
  const hazardTex = createHazardStripeTexture(maxAnisotropy);

  addContactShadow(group, 4.5, shadowTex);

  const vinylBlueMat = new THREE.MeshPhysicalMaterial({
    color: 0x0284c7,
    roughness: 0.22,
    metalness: 0.05,
    clearcoat: 0.85,
    clearcoatRoughness: 0.15,
  });
  const vinylWhiteRimMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.35,
    metalness: 0.05,
  });
  const gantrySteelMat = new THREE.MeshStandardMaterial({
    color: 0x475569,
    metalness: 0.85,
    roughness: 0.25,
  });
  const troughMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    metalness: 0.65,
    roughness: 0.3,
  });

  const ringRadii = [
    { y: 0.24, tube: 0.24, mat: vinylBlueMat },
    { y: 0.62, tube: 0.24, mat: vinylBlueMat },
    { y: 0.98, tube: 0.22, mat: vinylWhiteRimMat },
  ];
  ringRadii.forEach((r) => {
    const torusGeo = new THREE.TorusGeometry(2.35, r.tube, 20, 48);
    torusGeo.rotateX(Math.PI / 2);
    const ring = new THREE.Mesh(torusGeo, r.mat);
    ring.position.y = r.y;
    ring.castShadow = true;
    ring.receiveShadow = true;
    group.add(ring);
  });

  const floorGeo = new THREE.CylinderGeometry(2.32, 2.35, 0.12, 40);
  const floorMesh = new THREE.Mesh(floorGeo, vinylBlueMat);
  floorMesh.position.y = 0.06;
  floorMesh.receiveShadow = true;
  group.add(floorMesh);

  const liquidGeo = new THREE.CylinderGeometry(2.2, 2.2, 0.65, 40);
  const liquidMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    roughness: 0.15,
    metalness: 0.1,
    transparent: true,
    opacity: 0.88,
  });
  const liquidMesh = new THREE.Mesh(liquidGeo, liquidMat);
  liquidMesh.position.y = 0.42;
  group.add(liquidMesh);

  const postGeo = new THREE.BoxGeometry(0.18, 4.4, 0.18);
  [-2.9, 2.9].forEach((px) => {
    [-0.9, 0.9].forEach((pz) => {
      const post = new THREE.Mesh(postGeo, gantrySteelMat);
      post.position.set(px, 2.1, pz);
      post.rotation.x = pz > 0 ? -0.2 : 0.2;
      post.castShadow = true;
      group.add(post);
    });
  });

  const beamGeo = new THREE.BoxGeometry(6.2, 0.22, 0.24);
  const crossBeam = new THREE.Mesh(beamGeo, gantrySteelMat);
  crossBeam.position.set(0, 4.15, 0);
  crossBeam.castShadow = true;
  group.add(crossBeam);

  const hazardPlateGeo = new THREE.BoxGeometry(3.6, 0.14, 0.26);
  const hazardMat = new THREE.MeshStandardMaterial({
    map: hazardTex,
    roughness: 0.4,
    metalness: 0.2,
  });
  const hazardPlate = new THREE.Mesh(hazardPlateGeo, hazardMat);
  hazardPlate.position.set(0, 4.15, 0);
  group.add(hazardPlate);

  const catalystDropperGroup = new THREE.Group();
  catalystDropperGroup.position.set(0, 3.7, 0);
  const troughGeo = new THREE.CylinderGeometry(0.28, 0.28, 3.1, 24, 1, false, 0, Math.PI);
  troughGeo.rotateZ(Math.PI / 2);
  const troughMesh = new THREE.Mesh(troughGeo, troughMat);
  troughMesh.castShadow = true;
  catalystDropperGroup.add(troughMesh);
  group.add(catalystDropperGroup);

  const coneGeo = new THREE.ConeGeometry(0.24, 0.68, 16);
  const coneMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.4 });
  [
    [-3.4, 2.2],
    [3.4, 2.2],
    [-3.4, -2.2],
    [3.4, -2.2],
  ].forEach(([cx, cz]) => {
    const cone = new THREE.Mesh(coneGeo, coneMat);
    cone.position.set(cx, 0.34, cz);
    cone.castShadow = true;
    group.add(cone);
  });

  return {
    group,
    metrics: {
      nozzleY: 0.95,
      nozzleRadius: 1.85,
      liquidMesh,
      catalystDropperGroup,
    },
  };
}

/**
 * SCALE 3: Giant Steel Flask Volcano & Orbeez Tank Rig (Composite 10-part THREE.Group)
 */
export function createSteelFlaskRig(
  maxAnisotropy: number
): { group: THREE.Group; metrics: VesselSpawnMetrics } {
  const group = new THREE.Group();
  const shadowTex = createRadialShadowTexture();
  const hazardTex = createHazardStripeTexture(maxAnisotropy);

  addContactShadow(group, 5.5, shadowTex);

  const weldedSteelMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    metalness: 0.88,
    roughness: 0.26,
  });
  const crimsonAccentMat = new THREE.MeshStandardMaterial({
    color: 0xe11d48,
    metalness: 0.55,
    roughness: 0.32,
  });
  const concretePadMat = new THREE.MeshStandardMaterial({
    color: 0x475569,
    metalness: 0.05,
    roughness: 0.85,
  });
  const hazardMat = new THREE.MeshStandardMaterial({
    map: hazardTex,
    roughness: 0.45,
    metalness: 0.2,
  });

  const padGeo = new THREE.CylinderGeometry(4.4, 4.6, 0.3, 40);
  const padMesh = new THREE.Mesh(padGeo, concretePadMat);
  padMesh.position.y = 0.15;
  padMesh.receiveShadow = true;
  group.add(padMesh);

  const volcanoPoints = [
    new THREE.Vector2(0.01, 0.3),
    new THREE.Vector2(2.75, 0.3),
    new THREE.Vector2(2.8, 0.95),
    new THREE.Vector2(1.45, 4.6),
    new THREE.Vector2(0.75, 6.8),
    new THREE.Vector2(0.72, 8.2),
    new THREE.Vector2(0.92, 8.45),
    new THREE.Vector2(0.65, 8.45),
  ];
  const flaskGeo = new THREE.LatheGeometry(volcanoPoints, 40);
  const flaskMesh = new THREE.Mesh(flaskGeo, weldedSteelMat);
  flaskMesh.castShadow = true;
  flaskMesh.receiveShadow = true;
  group.add(flaskMesh);

  const ribSpecs = [
    { y: 1.0, r: 2.76 },
    { y: 2.8, r: 2.12 },
    { y: 4.6, r: 1.48 },
    { y: 6.8, r: 0.78 },
  ];
  ribSpecs.forEach((rib) => {
    const torusGeo = new THREE.TorusGeometry(rib.r, 0.09, 12, 36);
    torusGeo.rotateX(Math.PI / 2);
    const ribMesh = new THREE.Mesh(torusGeo, crimsonAccentMat);
    ribMesh.position.y = rib.y;
    group.add(ribMesh);
  });

  const colGeo = new THREE.BoxGeometry(0.24, 7.6, 0.24);
  const towerOffsets = [
    [-2.8, -2.8],
    [2.8, -2.8],
    [-2.8, 2.8],
    [2.8, 2.8],
  ];
  towerOffsets.forEach(([tx, tz]) => {
    const col = new THREE.Mesh(colGeo, weldedSteelMat);
    col.position.set(tx, 3.95, tz);
    col.castShadow = true;
    group.add(col);
  });

  const upperFrameGeo = new THREE.BoxGeometry(6.0, 0.25, 6.0);
  const upperFrame = new THREE.Mesh(upperFrameGeo, hazardMat);
  upperFrame.position.y = 7.4;
  group.add(upperFrame);

  const tankGeo = new THREE.CapsuleGeometry(0.65, 1.4, 16, 24);
  const tankMat = new THREE.MeshPhysicalMaterial({
    color: 0xc084fc,
    metalness: 0.2,
    roughness: 0.18,
    clearcoat: 0.9,
  });
  const orbeezTank = new THREE.Mesh(tankGeo, tankMat);
  orbeezTank.position.set(3.2, 5.2, 0);
  orbeezTank.castShadow = true;
  group.add(orbeezTank);

  const pipeCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(3.2, 6.2, 0),
    new THREE.Vector3(2.2, 6.9, 0),
    new THREE.Vector3(0.8, 6.6, 0),
  ]);
  const pipeGeo = new THREE.TubeGeometry(pipeCurve, 20, 0.14, 12, false);
  const pipeMesh = new THREE.Mesh(pipeGeo, crimsonAccentMat);
  group.add(pipeMesh);

  const liquidGeo = new THREE.CylinderGeometry(0.62, 1.8, 2.8, 32);
  const liquidMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    roughness: 0.2,
    metalness: 0.1,
  });
  const liquidMesh = new THREE.Mesh(liquidGeo, liquidMat);
  liquidMesh.position.y = 2.0;
  group.add(liquidMesh);

  const catalystDropperGroup = new THREE.Group();
  catalystDropperGroup.position.set(-1.35, 8.85, 0);
  const hopperGeo = new THREE.ConeGeometry(0.45, 0.9, 20);
  hopperGeo.rotateZ(-Math.PI * 0.75);
  const hopperMesh = new THREE.Mesh(hopperGeo, crimsonAccentMat);
  catalystDropperGroup.add(hopperMesh);
  group.add(catalystDropperGroup);

  return {
    group,
    metrics: {
      nozzleY: 8.45,
      nozzleRadius: 0.68,
      liquidMesh,
      catalystDropperGroup,
    },
  };
}

/**
 * SCALE 4: Outdoor Blast Crater & Devil's Toothpaste Steel Bunker (Composite 10-part THREE.Group)
 */
export function createOutdoorCraterRig(
  maxAnisotropy: number
): { group: THREE.Group; metrics: VesselSpawnMetrics } {
  const group = new THREE.Group();
  const shadowTex = createRadialShadowTexture();
  const hazardTex = createHazardStripeTexture(maxAnisotropy);

  addContactShadow(group, 8.5, shadowTex);

  const craterRockMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.92,
    metalness: 0.05,
    flatShading: true,
  });
  const bunkerSteelMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: 0.85,
    roughness: 0.28,
  });
  const hazardMat = new THREE.MeshStandardMaterial({
    map: hazardTex,
    roughness: 0.4,
    metalness: 0.25,
  });
  const actuatorAmberMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    metalness: 0.65,
    roughness: 0.25,
  });

  const craterRimGeo = new THREE.TorusGeometry(6.8, 1.35, 10, 36);
  craterRimGeo.rotateX(Math.PI / 2);
  craterRimGeo.scale(1, 0.55, 1);
  const craterRim = new THREE.Mesh(craterRimGeo, craterRockMat);
  craterRim.position.y = 0.45;
  craterRim.receiveShadow = true;
  craterRim.castShadow = true;
  group.add(craterRim);

  const vatGeo = new THREE.CylinderGeometry(2.6, 1.85, 2.5, 4);
  vatGeo.rotateY(Math.PI / 4);
  const vatMesh = new THREE.Mesh(vatGeo, bunkerSteelMat);
  vatMesh.position.y = 1.25;
  vatMesh.castShadow = true;
  vatMesh.receiveShadow = true;
  group.add(vatMesh);

  const collarGeo = new THREE.CylinderGeometry(2.72, 2.65, 0.35, 4);
  collarGeo.rotateY(Math.PI / 4);
  const collarMesh = new THREE.Mesh(collarGeo, hazardMat);
  collarMesh.position.y = 2.42;
  group.add(collarMesh);

  const liquidGeo = new THREE.CylinderGeometry(2.3, 1.75, 1.6, 4);
  liquidGeo.rotateY(Math.PI / 4);
  const liquidMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    roughness: 0.15,
    metalness: 0.1,
  });
  const liquidMesh = new THREE.Mesh(liquidGeo, liquidMat);
  liquidMesh.position.y = 1.1;
  group.add(liquidMesh);

  const bridgePillarGeo = new THREE.BoxGeometry(0.45, 5.4, 0.45);
  [-3.8, 3.8].forEach((bx) => {
    const pillar = new THREE.Mesh(bridgePillarGeo, bunkerSteelMat);
    pillar.position.set(bx, 2.7, 0);
    pillar.castShadow = true;
    group.add(pillar);
  });

  const bridgeBeamGeo = new THREE.BoxGeometry(8.2, 0.4, 0.6);
  const bridgeBeam = new THREE.Mesh(bridgeBeamGeo, bunkerSteelMat);
  bridgeBeam.position.set(0, 5.3, 0);
  bridgeBeam.castShadow = true;
  group.add(bridgeBeam);

  const catalystDropperGroup = new THREE.Group();
  catalystDropperGroup.position.set(0, 4.6, 0);
  const bigTroughGeo = new THREE.BoxGeometry(3.8, 0.65, 1.1);
  const bigTrough = new THREE.Mesh(bigTroughGeo, actuatorAmberMat);
  bigTrough.castShadow = true;
  catalystDropperGroup.add(bigTrough);
  group.add(catalystDropperGroup);

  const shieldGeo = new THREE.BoxGeometry(2.2, 1.4, 0.16);
  [
    [0, 4.6, 0],
    [0, -4.6, Math.PI],
    [4.6, 0, Math.PI / 2],
    [-4.6, 0, -Math.PI / 2],
  ].forEach(([sx, sz, rotY]) => {
    const shield = new THREE.Mesh(shieldGeo, hazardMat);
    shield.position.set(sx, 0.85, sz);
    shield.rotation.y = rotY;
    shield.rotation.x = -0.25;
    shield.castShadow = true;
    group.add(shield);
  });

  return {
    group,
    metrics: {
      nozzleY: 2.5,
      nozzleRadius: 2.1,
      liquidMesh,
      catalystDropperGroup,
    },
  };
}

/**
 * SCIENTIST AVATAR WITH WALKING LIMB RIG, CARRIED ITEM BOTTLE, & LIVE VR SAFETY PPE
 */
export function createScientistAvatar(isSoftwareGl: boolean): ScientistAvatarRig {
  const group = new THREE.Group();
  const bodyGroup = new THREE.Group();
  group.add(bodyGroup);

  const shadowTex = createRadialShadowTexture();
  addContactShadow(group, 0.75, shadowTex);

  const bootMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.7, metalness: 0.1 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.65, metalness: 0.05 });
  const labCoatMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.45, metalness: 0.05 });
  const hazmatMat = new THREE.MeshPhysicalMaterial({
    color: 0xf59e0b,
    roughness: 0.25,
    metalness: 0.15,
    clearcoat: 0.6,
  });
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xfdba74, roughness: 0.55, metalness: 0.02 });
  const nitrileGloveMat = new THREE.MeshPhysicalMaterial({
    color: 0x06b6d4,
    roughness: 0.22,
    metalness: 0.1,
    clearcoat: 0.7,
  });
  const goggleFrameMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.3,
    metalness: 0.5,
  });
  const goggleLensMat = new THREE.MeshPhysicalMaterial({
    color: 0x38bdf8,
    roughness: 0.08,
    metalness: 0.1,
    transmission: isSoftwareGl ? 0 : 0.85,
    transparent: true,
    opacity: isSoftwareGl ? 0.55 : 0.95,
    ior: 1.5,
  });

  // 1. Articulated Left & Right Legs (Pivoted at Hip y = 0.72 for Walking Animation!)
  const bootGeo = new THREE.BoxGeometry(0.16, 0.14, 0.26);
  const legGeo = new THREE.CapsuleGeometry(0.08, 0.52, 8, 12);

  const leftLegGroup = new THREE.Group();
  leftLegGroup.position.set(-0.13, 0.72, 0);
  const leftLegMesh = new THREE.Mesh(legGeo, pantsMat);
  leftLegMesh.position.set(0, -0.27, 0);
  leftLegMesh.castShadow = true;
  const leftBootMesh = new THREE.Mesh(bootGeo, bootMat);
  leftBootMesh.position.set(0, -0.65, 0.03);
  leftBootMesh.castShadow = true;
  leftLegGroup.add(leftLegMesh, leftBootMesh);
  bodyGroup.add(leftLegGroup);

  const rightLegGroup = new THREE.Group();
  rightLegGroup.position.set(0.13, 0.72, 0);
  const rightLegMesh = new THREE.Mesh(legGeo, pantsMat);
  rightLegMesh.position.set(0, -0.27, 0);
  rightLegMesh.castShadow = true;
  const rightBootMesh = new THREE.Mesh(bootGeo, bootMat);
  rightBootMesh.position.set(0, -0.65, 0.03);
  rightBootMesh.castShadow = true;
  rightLegGroup.add(rightLegMesh, rightBootMesh);
  bodyGroup.add(rightLegGroup);

  // 2. Torso: Lab Coat vs Thermal Hazmat Suit
  const torsoGeo = new THREE.CapsuleGeometry(0.22, 0.48, 12, 20);
  const labCoatTorsoMesh = new THREE.Mesh(torsoGeo, labCoatMat);
  labCoatTorsoMesh.position.set(0, 1.05, 0);
  labCoatTorsoMesh.castShadow = true;
  bodyGroup.add(labCoatTorsoMesh);

  const hazmatGeo = new THREE.CapsuleGeometry(0.245, 0.5, 12, 20);
  const hazmatTorsoMesh = new THREE.Mesh(hazmatGeo, hazmatMat);
  hazmatTorsoMesh.position.set(0, 1.05, 0);
  hazmatTorsoMesh.castShadow = true;
  bodyGroup.add(hazmatTorsoMesh);

  // 3. Head & Hair/Cap
  const headGeo = new THREE.SphereGeometry(0.17, 20, 20);
  const headMesh = new THREE.Mesh(headGeo, skinMat);
  headMesh.position.set(0, 1.56, 0);
  headMesh.castShadow = true;
  bodyGroup.add(headMesh);

  const capGeo = new THREE.SphereGeometry(0.178, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.55);
  const capMesh = new THREE.Mesh(capGeo, bootMat);
  capMesh.position.set(0, 1.58, -0.01);
  bodyGroup.add(capMesh);

  // 4. Hazmat Helmet Collar Ring
  const collarRingGeo = new THREE.TorusGeometry(0.2, 0.05, 12, 24);
  collarRingGeo.rotateX(Math.PI / 2);
  const hazmatHelmetRing = new THREE.Mesh(collarRingGeo, hazmatMat);
  hazmatHelmetRing.position.set(0, 1.38, 0);
  bodyGroup.add(hazmatHelmetRing);

  // 5. Chemical Splash Goggles & Face Visor (Toggleable PPE)
  const gogglesGroup = new THREE.Group();
  gogglesGroup.position.set(0, 1.57, 0.14);
  const frameGeo = new THREE.BoxGeometry(0.26, 0.09, 0.08);
  const frameMesh = new THREE.Mesh(frameGeo, goggleFrameMat);
  gogglesGroup.add(frameMesh);

  const lensGeo = new THREE.BoxGeometry(0.24, 0.07, 0.09);
  const lensMesh = new THREE.Mesh(lensGeo, goggleLensMat);
  gogglesGroup.add(lensMesh);
  bodyGroup.add(gogglesGroup);

  // 6. Articulated Arms & Hands (Pivoted at Shoulder y = 1.24 for Walking & Carrying!)
  const armGeo = new THREE.CapsuleGeometry(0.065, 0.36, 8, 12);

  const leftArmGroup = new THREE.Group();
  leftArmGroup.position.set(-0.28, 1.24, 0);
  const leftArmMesh = new THREE.Mesh(armGeo, labCoatMat);
  leftArmMesh.position.set(0, -0.18, 0.08);
  leftArmMesh.rotation.x = -0.45;
  leftArmMesh.castShadow = true;
  leftArmGroup.add(leftArmMesh);
  bodyGroup.add(leftArmGroup);

  const rightArmGroup = new THREE.Group();
  rightArmGroup.position.set(0.28, 1.24, 0);
  const rightArmMesh = new THREE.Mesh(armGeo, labCoatMat);
  rightArmMesh.position.set(0, -0.18, 0.08);
  rightArmMesh.rotation.x = -0.45;
  rightArmMesh.castShadow = true;
  rightArmGroup.add(rightArmMesh);
  bodyGroup.add(rightArmGroup);

  const glovesGroup = new THREE.Group();
  const gloveGeo = new THREE.CapsuleGeometry(0.075, 0.16, 8, 12);
  [-0.28, 0.28].forEach((gx) => {
    const glove = new THREE.Mesh(gloveGeo, nitrileGloveMat);
    glove.position.set(gx, 0.92, 0.24);
    glove.rotation.x = -0.65;
    glovesGroup.add(glove);
  });
  bodyGroup.add(glovesGroup);

  // 6b. Bare Hands (Visible when Gloves are unchecked — gets dyed bright colors when pouring!)
  const bareHandsGroup = new THREE.Group();
  const bareHandsMat = new THREE.MeshStandardMaterial({
    color: 0xfdba74,
    roughness: 0.45,
    metalness: 0.05,
  });
  const bareHandGeo = new THREE.SphereGeometry(0.072, 12, 12);
  [-0.28, 0.28].forEach((hx) => {
    const hand = new THREE.Mesh(bareHandGeo, bareHandsMat);
    hand.position.set(hx, 0.89, 0.28);
    bareHandsGroup.add(hand);
  });
  bodyGroup.add(bareHandsGroup);

  // 6c. 3D Foam Snowman Suit (Appears when buried in a big eruption without Hazmat Suit!)
  const foamSnowmanGroup = new THREE.Group();
  const foamSnowmanMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    roughness: 0.55,
    metalness: 0.02,
  });
  const snowBottom = new THREE.Mesh(new THREE.SphereGeometry(0.52, 18, 18), foamSnowmanMat);
  snowBottom.position.set(0, 0.52, 0);
  snowBottom.scale.set(1.15, 0.92, 1.15);
  const snowMid = new THREE.Mesh(new THREE.SphereGeometry(0.42, 18, 18), foamSnowmanMat);
  snowMid.position.set(0, 1.15, 0);
  const snowTop = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 16), foamSnowmanMat);
  snowTop.position.set(0, 1.65, 0);
  foamSnowmanGroup.add(snowBottom, snowMid, snowTop);
  foamSnowmanGroup.visible = false;
  bodyGroup.add(foamSnowmanGroup);

  // 7. Remote Detonator Trigger Box in Hands
  const remoteBoxGroup = new THREE.Group();
  remoteBoxGroup.position.set(0, 0.9, 0.34);
  const boxGeo = new THREE.BoxGeometry(0.24, 0.14, 0.16);
  const boxMesh = new THREE.Mesh(boxGeo, goggleFrameMat);
  remoteBoxGroup.add(boxMesh);

  const btnGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.04, 16);
  const btnMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.2 });
  const btnMesh = new THREE.Mesh(btnGeo, btnMat);
  btnMesh.position.set(0, 0.08, 0);
  remoteBoxGroup.add(btnMesh);
  bodyGroup.add(remoteBoxGroup);

  // 8. Carried 3D Chemical Bottle in Hands (Shown when walking to fetch/pour an ingredient!)
  const carriedBottleGroup = new THREE.Group();
  carriedBottleGroup.position.set(0, 0.98, 0.38);
  const carriedBottleMat = new THREE.MeshPhysicalMaterial({
    color: 0x38bdf8,
    roughness: 0.18,
    metalness: 0.1,
    clearcoat: 0.85,
  });
  const cBody = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.38, 18), carriedBottleMat);
  const cNeck = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.08, 0.12, 14),
    new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3 })
  );
  cNeck.position.y = 0.24;
  carriedBottleGroup.add(cBody, cNeck);
  carriedBottleGroup.visible = false;
  bodyGroup.add(carriedBottleGroup);

  return {
    group,
    bodyGroup,
    leftLegGroup,
    rightLegGroup,
    leftArmGroup,
    rightArmGroup,
    gogglesGroup,
    glovesGroup,
    bareHandsGroup,
    bareHandsMat,
    foamSnowmanGroup,
    foamSnowmanMat,
    hazmatTorsoMesh,
    labCoatTorsoMesh,
    hazmatHelmetRing,
    remoteBoxGroup,
    carriedBottleGroup,
    carriedBottleMat,
  };
}

export function syncScientistAvatarPpe(
  rig: ScientistAvatarRig,
  gear: SafetyGearState,
  dyeHex = '#fdba74',
  hasPouredAnything = false,
  isBuriedSnowman = false
) {
  rig.gogglesGroup.visible = gear.goggles;
  rig.glovesGroup.visible = gear.gloves;
  rig.bareHandsGroup.visible = !gear.gloves;
  rig.bareHandsMat.color.set(!gear.gloves && hasPouredAnything ? dyeHex : '#fdba74');
  rig.foamSnowmanGroup.visible = isBuriedSnowman && !gear.hazmatSuit;
  rig.foamSnowmanMat.color.set(dyeHex);
  rig.hazmatTorsoMesh.visible = gear.hazmatSuit;
  rig.hazmatHelmetRing.visible = gear.hazmatSuit;
  rig.labCoatTorsoMesh.visible = !gear.hazmatSuit;
  rig.remoteBoxGroup.visible = gear.remoteTriggerArmed && !rig.carriedBottleGroup.visible;
}

/**
 * Interactive 3D Supply Stations (Chemical Cart & Safety Locker Rack) that the Scientist can walk to!
 */
export function createLabSupplyStations(): SupplyStationRig {
  const group = new THREE.Group();
  const clickableTargets: THREE.Object3D[] = [];
  const shadowTex = createRadialShadowTexture();

  const chemTablePos = new THREE.Vector3(-4.2, 0, 3.2);
  const safetyRackPos = new THREE.Vector3(4.2, 0, 3.2);

  // --- STATION A: 3D CHEMICAL SUPPLY TABLE (Left Flank) ---
  const chemCart = new THREE.Group();
  chemCart.position.copy(chemTablePos);
  chemCart.rotation.y = 0.35;
  addContactShadow(chemCart, 1.5, shadowTex);

  const cartSteelMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    metalness: 0.8,
    roughness: 0.28,
  });
  const cartTopMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: 0.2,
    roughness: 0.65,
  });

  const cartTop = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.1, 1.1), cartTopMat);
  cartTop.position.y = 0.95;
  cartTop.castShadow = true;
  cartTop.receiveShadow = true;
  chemCart.add(cartTop);

  const cartShelf = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.08, 0.95), cartSteelMat);
  cartShelf.position.y = 0.35;
  chemCart.add(cartShelf);

  const legGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.95, 12);
  [
    [-1.0, -0.45],
    [1.0, -0.45],
    [-1.0, 0.45],
    [1.0, 0.45],
  ].forEach(([lx, lz]) => {
    const leg = new THREE.Mesh(legGeo, cartSteelMat);
    leg.position.set(lx, 0.475, lz);
    chemCart.add(leg);
  });

  // 4 Interactive 3D Ingredient Containers on the Cart
  const bottleSpecs: { step: IngredientStep; x: number; color: number; radius: number; h: number }[] = [
    { step: 'peroxide', x: -0.78, color: 0x38bdf8, radius: 0.18, h: 0.52 },
    { step: 'soap', x: -0.26, color: 0x10b981, radius: 0.14, h: 0.46 },
    { step: 'orbeez', x: 0.26, color: 0xc084fc, radius: 0.16, h: 0.42 },
    { step: 'catalyst', x: 0.78, color: 0xf59e0b, radius: 0.15, h: 0.44 },
  ];

  bottleSpecs.forEach((b) => {
    const bGroup = new THREE.Group();
    bGroup.position.set(b.x, 1.0 + b.h * 0.5, 0);
    const bMat = new THREE.MeshPhysicalMaterial({
      color: b.color,
      roughness: 0.2,
      metalness: 0.1,
      clearcoat: 0.8,
    });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(b.radius * 0.85, b.radius, b.h, 18), bMat);
    body.castShadow = true;
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(b.radius * 0.35, b.radius * 0.4, 0.1, 12),
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3 })
    );
    cap.position.y = b.h * 0.5 + 0.05;
    bGroup.add(body, cap);

    // Tag for 3D raycast click-to-fetch!
    body.userData = { interactType: 'fetch_ingredient', step: b.step };
    cap.userData = { interactType: 'fetch_ingredient', step: b.step };
    clickableTargets.push(body, cap);
    chemCart.add(bGroup);
  });

  group.add(chemCart);

  // --- STATION B: 3D SAFETY GEAR LOCKER RACK (Right Flank) ---
  const safetyRack = new THREE.Group();
  safetyRack.position.copy(safetyRackPos);
  safetyRack.rotation.y = -0.35;
  addContactShadow(safetyRack, 1.3, shadowTex);

  const rackFrame = new THREE.Mesh(
    new THREE.BoxGeometry(1.5, 1.9, 0.65),
    new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.6, metalness: 0.3 })
  );
  rackFrame.position.y = 0.95;
  rackFrame.castShadow = true;
  safetyRack.add(rackFrame);

  // Hazmat Suit hanging inside Locker
  const hangingHazmat = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.24, 0.55, 10, 16),
    new THREE.MeshPhysicalMaterial({ color: 0xf59e0b, roughness: 0.25, clearcoat: 0.6 })
  );
  hangingHazmat.position.set(-0.28, 1.0, 0.22);
  hangingHazmat.userData = { interactType: 'fetch_safety' };
  clickableTargets.push(hangingHazmat);
  safetyRack.add(hangingHazmat);

  // Goggles on Locker Shelf
  const shelfGoggles = new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 0.14, 0.16),
    new THREE.MeshStandardMaterial({ color: 0x38bdf8, metalness: 0.4, roughness: 0.15 })
  );
  shelfGoggles.position.set(0.32, 1.35, 0.24);
  shelfGoggles.userData = { interactType: 'fetch_safety' };
  clickableTargets.push(shelfGoggles);
  safetyRack.add(shelfGoggles);

  // Gloves on Locker Shelf
  const shelfGloves = new THREE.Mesh(
    new THREE.SphereGeometry(0.15, 14, 14),
    new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.3 })
  );
  shelfGloves.position.set(0.32, 0.85, 0.24);
  shelfGloves.userData = { interactType: 'fetch_safety' };
  clickableTargets.push(shelfGloves);
  safetyRack.add(shelfGloves);

  rackFrame.userData = { interactType: 'fetch_safety' };
  clickableTargets.push(rackFrame);

  group.add(safetyRack);

  return {
    group,
    clickableTargets,
    chemTablePos,
    safetyRackPos,
  };
}

/**
 * Phat Gus the Squirrel helper so he appears in every location!
 */
function createPhatGusProp(): THREE.Group {
  const gusGroup = new THREE.Group();
  const stumpMat = new THREE.MeshStandardMaterial({ color: 0x5c2d0c, roughness: 0.88 });
  const furMat = new THREE.MeshStandardMaterial({ color: 0x9a5b25, roughness: 0.72 });
  const bellyMat = new THREE.MeshStandardMaterial({ color: 0xfde68a, roughness: 0.65 });
  const goggleMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, metalness: 0.4, roughness: 0.15 });

  const stumpMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.52, 0.65, 16), stumpMat);
  stumpMesh.position.y = 0.325;
  stumpMesh.castShadow = true;
  gusGroup.add(stumpMesh);

  const bodyMesh = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 16), furMat);
  bodyMesh.scale.set(1.0, 1.25, 0.95);
  bodyMesh.position.set(0, 0.92, 0);
  bodyMesh.castShadow = true;
  gusGroup.add(bodyMesh);

  const bellyMesh = new THREE.Mesh(new THREE.SphereGeometry(0.19, 14, 14), bellyMat);
  bellyMesh.scale.set(0.85, 1.1, 0.6);
  bellyMesh.position.set(0, 0.9, 0.1);
  gusGroup.add(bellyMesh);

  const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 16), furMat);
  headMesh.position.set(0, 1.26, 0.04);
  gusGroup.add(headMesh);

  const earGeo = new THREE.ConeGeometry(0.05, 0.12, 8);
  [-0.09, 0.09].forEach((ex) => {
    const ear = new THREE.Mesh(earGeo, furMat);
    ear.position.set(ex, 1.42, 0.02);
    gusGroup.add(ear);
  });

  const goggleMesh = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.07, 0.08), goggleMat);
  goggleMesh.position.set(0, 1.28, 0.16);
  gusGroup.add(goggleMesh);

  const tailCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.78, -0.18),
    new THREE.Vector3(0, 1.15, -0.38),
    new THREE.Vector3(0, 1.48, -0.24),
  ]);
  const tailGeo = new THREE.TubeGeometry(tailCurve, 12, 0.13, 10, false);
  const tailMesh = new THREE.Mesh(tailGeo, furMat);
  tailMesh.castShadow = true;
  gusGroup.add(tailMesh);

  return gusGroup;
}

/**
 * Creates all 4 switchable 3D Lab Environments / Locations!
 * 1. crunchlabs_warehouse (CrunchLabs Studio)
 * 2. suburban_backyard (Backyard Lawn & Pine Grove)
 * 3. science_gymnasium (School Science Fair Gym with 3.05m Basketball Hoop & Bleachers)
 * 4. desert_proving_ground (Mojave Red-Rock Canyon & Bunker)
 */
export function createAllLocationEnvironments(): Record<LabLocationId, THREE.Group> {
  // 1. SUBURBAN BACKYARD (Pine Grove, Wooden Fence, & Phat Gus Stump)
  const backyardGroup = new THREE.Group();
  const treeCount = 44;
  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.35, 2.2, 8);
  trunkGeo.translate(0, 1.1, 0);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.9 });

  const foliageLowerGeo = new THREE.ConeGeometry(1.6, 3.6, 9);
  foliageLowerGeo.translate(0, 3.2, 0);
  const foliageUpperGeo = new THREE.ConeGeometry(1.2, 3.0, 9);
  foliageUpperGeo.translate(0, 5.0, 0);
  const foliageMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 });

  const trunkInstanced = new THREE.InstancedMesh(trunkGeo, trunkMat, treeCount);
  const foliageLowerInstanced = new THREE.InstancedMesh(foliageLowerGeo, foliageMat, treeCount);
  const foliageUpperInstanced = new THREE.InstancedMesh(foliageUpperGeo, foliageMat, treeCount);

  const dummy = new THREE.Object3D();
  const tintColor = new THREE.Color();

  for (let i = 0; i < treeCount; i++) {
    const angle = (i / treeCount) * Math.PI * 2 + (i % 3) * 0.08;
    const radius = 32 + (i % 5) * 6.0;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const s = 0.85 + ((i * 17) % 30) / 100;

    dummy.position.set(x, 0, z);
    dummy.rotation.set(0, (i * 1.3) % Math.PI, 0);
    dummy.scale.set(s, s * (0.9 + (i % 4) * 0.08), s);
    dummy.updateMatrix();

    trunkInstanced.setMatrixAt(i, dummy.matrix);
    foliageLowerInstanced.setMatrixAt(i, dummy.matrix);
    foliageUpperInstanced.setMatrixAt(i, dummy.matrix);

    tintColor.setHSL(0.36 + (i % 5) * 0.015, 0.62, 0.26 + (i % 4) * 0.03);
    foliageLowerInstanced.setColorAt(i, tintColor);
    foliageUpperInstanced.setColorAt(i, tintColor.clone().multiplyScalar(1.12));
  }
  trunkInstanced.instanceMatrix.needsUpdate = true;
  foliageLowerInstanced.instanceMatrix.needsUpdate = true;
  foliageUpperInstanced.instanceMatrix.needsUpdate = true;
  if (foliageLowerInstanced.instanceColor) foliageLowerInstanced.instanceColor.needsUpdate = true;
  if (foliageUpperInstanced.instanceColor) foliageUpperInstanced.instanceColor.needsUpdate = true;
  trunkInstanced.computeBoundingSphere();
  foliageLowerInstanced.computeBoundingSphere();
  foliageUpperInstanced.computeBoundingSphere();
  backyardGroup.add(trunkInstanced, foliageLowerInstanced, foliageUpperInstanced);

  // Cedar Backyard Fence Arc behind the yard
  const fenceMat = new THREE.MeshStandardMaterial({ color: 0x7c2d12, roughness: 0.85 });
  const fenceGeo = new THREE.BoxGeometry(3.8, 2.2, 0.16);
  for (let f = -5; f <= 5; f++) {
    const angle = f * 0.16 + Math.PI;
    const fx = Math.sin(angle) * 22;
    const fz = Math.cos(angle) * 22;
    const fencePanel = new THREE.Mesh(fenceGeo, fenceMat);
    fencePanel.position.set(fx, 1.1, fz);
    fencePanel.rotation.y = angle;
    fencePanel.castShadow = true;
    backyardGroup.add(fencePanel);
  }

  const gusBackyard = createPhatGusProp();
  gusBackyard.position.set(-2.9, 0, 2.4);
  gusBackyard.rotation.y = 0.65;
  backyardGroup.add(gusBackyard);

  // 2. CRUNCHLABS WAREHOUSE STUDIO (Steel Trusses, Orange Tool Chests, Blueprint Boards)
  const warehouseGroup = new THREE.Group();
  const steelTrussMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    metalness: 0.8,
    roughness: 0.3,
  });
  const crunchOrangeMat = new THREE.MeshStandardMaterial({
    color: 0xf97316,
    metalness: 0.4,
    roughness: 0.35,
  });
  const crunchBlueMat = new THREE.MeshStandardMaterial({
    color: 0x0284c7,
    metalness: 0.4,
    roughness: 0.35,
  });
  const boardWhiteMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.25,
  });

  // Warehouse Steel Columns & Overhead Roof Trusses
  const pillarGeo = new THREE.BoxGeometry(0.55, 16, 0.55);
  const trussBeamGeo = new THREE.BoxGeometry(32, 0.55, 0.55);
  [-14, -7, 0, 7, 14].forEach((zPos) => {
    [-16, 16].forEach((xPos) => {
      const col = new THREE.Mesh(pillarGeo, steelTrussMat);
      col.position.set(xPos, 8, zPos);
      warehouseGroup.add(col);
    });
    const beam = new THREE.Mesh(trussBeamGeo, steelTrussMat);
    beam.position.set(0, 15.8, zPos);
    warehouseGroup.add(beam);
  });

  // Giant CrunchLabs Rolling Tool Cabinets & Blueprint Whiteboards along the back
  [-8.5, 8.5].forEach((xPos) => {
    const toolChest = new THREE.Mesh(new THREE.BoxGeometry(3.6, 1.6, 1.2), crunchOrangeMat);
    toolChest.position.set(xPos, 0.8, -11);
    toolChest.castShadow = true;
    warehouseGroup.add(toolChest);

    const whiteboard = new THREE.Mesh(new THREE.BoxGeometry(4.2, 2.6, 0.15), boardWhiteMat);
    whiteboard.position.set(xPos * 0.55, 2.6, -12.5);
    warehouseGroup.add(whiteboard);

    const frame = new THREE.Mesh(new THREE.BoxGeometry(4.4, 2.8, 0.1), crunchBlueMat);
    frame.position.set(xPos * 0.55, 2.6, -12.55);
    warehouseGroup.add(frame);
  });

  const gusWarehouse = createPhatGusProp();
  gusWarehouse.position.set(-2.9, 0, 2.4);
  gusWarehouse.rotation.y = 0.65;
  warehouseGroup.add(gusWarehouse);

  // 3. SCHOOL SCIENCE FAIR GYMNASIUM (3.05m Basketball Hoop, Bleachers, & Science Fair Banners)
  const gymGroup = new THREE.Group();
  const bleacherWoodMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.55 });
  const hoopPoleMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.25 });
  const rimOrangeMat = new THREE.MeshStandardMaterial({ color: 0xea580c, metalness: 0.5, roughness: 0.3 });

  // Regulation 3.05m (10-ft) Basketball Hoop right beside the vessel for visual height comparison!
  const hoopGroup = new THREE.Group();
  hoopGroup.position.set(4.8, 0, -3.5);
  hoopGroup.rotation.y = -0.5;
  const hoopPost = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 3.8, 16), hoopPoleMat);
  hoopPost.position.set(0, 1.9, -1.2);
  const hoopArm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 1.2), hoopPoleMat);
  hoopArm.position.set(0, 3.5, -0.6);
  const backboard = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 1.15, 0.08),
    new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.15 })
  );
  backboard.position.set(0, 3.45, 0);
  const hoopRim = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.03, 12, 24), rimOrangeMat);
  hoopRim.rotation.x = Math.PI / 2;
  hoopRim.position.set(0, 3.05, 0.34);
  hoopGroup.add(hoopPost, hoopArm, backboard, hoopRim);
  gymGroup.add(hoopGroup);

  // Wooden Gym Bleachers on Left & Right Flanks
  [-13, 13].forEach((bx) => {
    for (let tier = 0; tier < 4; tier++) {
      const bench = new THREE.Mesh(
        new THREE.BoxGeometry(1.2, 0.45 * (tier + 1), 16),
        bleacherWoodMat
      );
      bench.position.set(bx + (bx > 0 ? tier * 1.1 : -tier * 1.1), 0.225 * (tier + 1), -2);
      bench.castShadow = true;
      gymGroup.add(bench);
    }
  });

  const gusGym = createPhatGusProp();
  gusGym.position.set(-2.9, 0, 2.4);
  gusGym.rotation.y = 0.65;
  gymGroup.add(gusGym);

  // 4. MOJAVE DESERT BLAST CANYON (Red-Rock Mesas, Boulders, & Concrete Bunker)
  const desertGroup = new THREE.Group();
  const mesaMat = new THREE.MeshStandardMaterial({
    color: 0x9a3412,
    roughness: 0.92,
    metalness: 0.04,
    flatShading: true,
  });
  const cactusMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.75 });

  // Perimeter Red-Rock Canyon Butte Pillars & Boulders
  const rockCount = 32;
  const rockGeo = new THREE.DodecahedronGeometry(1.8, 1);
  rockGeo.translate(0, 0.9, 0);
  const rockInstanced = new THREE.InstancedMesh(rockGeo, mesaMat, rockCount);
  for (let i = 0; i < rockCount; i++) {
    const angle = (i / rockCount) * Math.PI * 2 + 0.12;
    const radius = 26 + (i % 4) * 5.5;
    const sx = 1.2 + (i % 5) * 0.65;
    const sy = 1.0 + (i % 4) * 1.6;
    const sz = 1.2 + (i % 3) * 0.65;
    dummy.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
    dummy.rotation.set(0, i * 0.9, 0);
    dummy.scale.set(sx, sy, sz);
    dummy.updateMatrix();
    rockInstanced.setMatrixAt(i, dummy.matrix);
  }
  rockInstanced.instanceMatrix.needsUpdate = true;
  rockInstanced.computeBoundingSphere();
  desertGroup.add(rockInstanced);

  // Saguaro Cacti around the desert perimeter
  for (let c = 0; c < 12; c++) {
    const angle = (c / 12) * Math.PI * 2 + 0.3;
    const r = 19 + (c % 3) * 3.5;
    const cactus = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 1.8, 8, 12), cactusMat);
    cactus.position.set(Math.cos(angle) * r, 1.1, Math.sin(angle) * r);
    cactus.castShadow = true;
    desertGroup.add(cactus);
  }

  const gusDesert = createPhatGusProp();
  gusDesert.position.set(-2.9, 0, 2.4);
  gusDesert.rotation.y = 0.65;
  desertGroup.add(gusDesert);

  return {
    crunchlabs_warehouse: warehouseGroup,
    suburban_backyard: backyardGroup,
    science_gymnasium: gymGroup,
    desert_proving_ground: desertGroup,
  };
}
