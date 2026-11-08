import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  CameraPresetId,
  ExperimentConfig,
  IngredientStep,
  LabLocationId,
  ReactionSimulationResult,
  SafetyGearState,
  ScaleEnvironmentId,
} from '../types/chemistry';
import {
  DYE_COLORS,
  INGREDIENT_META,
  LAB_LOCATIONS,
  SCALE_ENVIRONMENTS,
  evaluateSafetyHazards,
} from '../utils/chemistryEngine';
import { createFoamBumpTexture, createTestPadGridTexture } from '../three/proceduralTextures';
import {
  ScientistAvatarRig,
  SupplyStationRig,
  VesselSpawnMetrics,
  createAllLocationEnvironments,
  createKiddiePoolRig,
  createLabBeakerRig,
  createLabSupplyStations,
  createOutdoorCraterRig,
  createScientistAvatar,
  createSteelFlaskRig,
  syncScientistAvatarPpe,
} from '../three/sceneModels';

// Pre-allocated scratch math helpers at module scope (Zero GC in tick loop)
const _dummy = new THREE.Object3D();
const _color = new THREE.Color();
const _targetCamPos = new THREE.Vector3();
const _targetLookAt = new THREE.Vector3();
const _projVec = new THREE.Vector3();
const _raycaster = new THREE.Raycaster();
const _pointerNdc = new THREE.Vector2();

const FOAM_INSTANCE_COUNT = 1280;
const STEAM_INSTANCE_COUNT = 140;
const ORBEEZ_INSTANCE_COUNT = 180;
const MOUND_LOBE_COUNT = 36;

interface FoamParticle {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  radius: number;
  targetRadius: number;
  age: number;
  settled: boolean;
  colorVariation: number;
}

interface SteamParticle {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  scale: number;
  age: number;
  maxAge: number;
}

interface OrbeezParticle {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  scale: number;
  hue: number;
}

interface ScientistErrand {
  type: 'walk_to_point' | 'fetch_ingredient' | 'fetch_safety';
  phase: 'to_station' | 'to_vessel' | 'returning' | 'walking';
  targetX: number;
  targetZ: number;
  returnX: number;
  returnZ: number;
  step?: IngredientStep;
}

const AR_BENCHMARKS = [
  { meters: 1.5, label: '1.5m · Lab Table' },
  { meters: 3.0, label: '3.0m · Basketball Hoop' },
  { meters: 5.5, label: '5.5m · Grown Giraffe' },
  { meters: 10.0, label: '10m · 3-Story House' },
  { meters: 16.0, label: '16m · 5-Story Building' },
  { meters: 25.0, label: '25m · Brachiosaurus' },
  { meters: 35.0, label: '35m · 10-Story Tower' },
];

function getShortComparison(meters: number): string {
  const squirrels = Math.max(1, Math.round(meters / 0.25));
  if (meters < 0.4) return `Tabletop Fizz (${squirrels} Phat Gus tall)`;
  if (meters < 1.8) return `Lab Desk Height (~${squirrels} Squirrels tall!)`;
  if (meters < 3.5) return `Basketball Hoop! (~${squirrels} Squirrels tall!)`;
  if (meters < 6.5) return `Taller than a Giraffe! (~${squirrels} Squirrels!)`;
  if (meters < 15) return `4-Story Building! (~${squirrels} Squirrels!)`;
  if (meters < 26) return `Brachiosaurus Height! (~${squirrels} Squirrels!)`;
  return `WORLD RECORD! 10-Story Skyscraper (${squirrels} Squirrels!)`;
}

export interface ThreeViewportProps {
  config: ExperimentConfig;
  safetyGear: SafetyGearState;
  activeResult: ReactionSimulationResult | null;
  predictedResult: ReactionSimulationResult;
  eruptionTriggerCount: number;
  cleanupTriggerCount: number;
  pourStepTrigger: { step: string; count: number };
  fetchErrandTrigger?: { type: 'ingredient' | 'safety'; step?: IngredientStep; count: number };
  cameraPreset: CameraPresetId;
  showArMeasures?: boolean;
  onRegisterSnapshotFn: (fn: () => string) => void;
  onAutoPhotoCaptured?: (dataUrl: string, caption: string) => void;
  onUpdateStandBackMeters?: (meters: number, isManualWalk?: boolean) => void;
  onScientistFetchedIngredient?: (step: IngredientStep) => void;
  onScientistFetchedSafety?: () => void;
}

export const ThreeViewport: React.FC<ThreeViewportProps> = ({
  config,
  safetyGear,
  activeResult,
  predictedResult,
  eruptionTriggerCount,
  cleanupTriggerCount,
  pourStepTrigger,
  fetchErrandTrigger,
  cameraPreset,
  showArMeasures = true,
  onRegisterSnapshotFn,
  onAutoPhotoCaptured,
  onUpdateStandBackMeters,
  onScientistFetchedIngredient,
  onScientistFetchedSafety,
}) => {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);

  // Direct DOM refs for 60fps 3D-to-2D projected AR measurement overlays (zero React re-renders)
  const arApexBadgeRef = useRef<HTMLDivElement | null>(null);
  const arApexTitleRef = useRef<HTMLSpanElement | null>(null);
  const arApexSubRef = useRef<HTMLSpanElement | null>(null);

  const arVesselBadgeRef = useRef<HTMLDivElement | null>(null);
  const arVesselTempRef = useRef<HTMLSpanElement | null>(null);
  const arVesselStatsRef = useRef<HTMLSpanElement | null>(null);

  const arAvatarBadgeRef = useRef<HTMLDivElement | null>(null);
  const arAvatarTextRef = useRef<HTMLSpanElement | null>(null);

  const arChemCartBadgeRef = useRef<HTMLDivElement | null>(null);
  const arSafetyRackBadgeRef = useRef<HTMLDivElement | null>(null);

  const arBenchmarkRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Store latest props in refs so the single WebGL lifecycle never re-mounts on UI state updates
  const configRef = useRef(config);
  configRef.current = config;

  const safetyGearRef = useRef(safetyGear);
  safetyGearRef.current = safetyGear;

  const activeResultRef = useRef(activeResult);
  activeResultRef.current = activeResult;

  const predictedResultRef = useRef(predictedResult);
  predictedResultRef.current = predictedResult;

  const showArRef = useRef(showArMeasures);
  showArRef.current = showArMeasures;

  const onAutoPhotoRef = useRef(onAutoPhotoCaptured);
  onAutoPhotoRef.current = onAutoPhotoCaptured;

  const onUpdateStandBackRef = useRef(onUpdateStandBackMeters);
  onUpdateStandBackRef.current = onUpdateStandBackMeters;

  const onFetchedIngredientRef = useRef(onScientistFetchedIngredient);
  onFetchedIngredientRef.current = onScientistFetchedIngredient;

  const onFetchedSafetyRef = useRef(onScientistFetchedSafety);
  onFetchedSafetyRef.current = onScientistFetchedSafety;

  // Mutable scene references for prop-driven updates
  const sceneRefs = useRef<{
    scene?: THREE.Scene;
    groundMat?: THREE.MeshStandardMaterial;
    rigs?: Record<ScaleEnvironmentId, { group: THREE.Group; metrics: VesselSpawnMetrics }>;
    locationGroups?: Record<LabLocationId, THREE.Group>;
    supplyStations?: SupplyStationRig;
    avatar?: ScientistAvatarRig;
    walkTargetMarker?: THREE.Group;
    safetyRingMesh?: THREE.Mesh;
    safetyZoneDisc?: THREE.Mesh;
    arRulerGroup?: THREE.Group;
    arPeakMarkerGroup?: THREE.Group;
    foamMesh?: THREE.InstancedMesh;
    foamMat?: THREE.MeshPhysicalMaterial;
    accumulatedMoundGroup?: THREE.Group;
    accumulatedMoundMat?: THREE.MeshPhysicalMaterial;
    steamMesh?: THREE.InstancedMesh;
    orbeezMesh?: THREE.InstancedMesh;
    pourStreamMesh?: THREE.Mesh;
    hoseSprayMesh?: THREE.Mesh;
    cameraTransitionActive: boolean;
    desiredCamPos: THREE.Vector3;
    desiredLookAt: THREE.Vector3;
    avatarWalkState: {
      x: number;
      z: number;
      targetX: number;
      targetZ: number;
      walkPhase: number;
      isWalking: boolean;
      errand: ScientistErrand | null;
      keysPressed: Set<string>;
    };
    reactionState: {
      isRunning: boolean;
      elapsed: number;
      currentLiveHeightMeters: number;
      currentLiveTempCelsius: number;
      isCleaningUp: boolean;
      cleanupElapsed: number;
      pourTimer: number;
      pourColorHex: string;
      autoPhotoTakenForRun: boolean;
      collectedFoamVolume: number; // Accumulates and NEVER fades until hosed down!
      targetMoundScale: number;
      currentMoundScale: number;
    };
  }>({
    cameraTransitionActive: false,
    desiredCamPos: new THREE.Vector3(0, 6, 12),
    desiredLookAt: new THREE.Vector3(0, 2, 0),
    avatarWalkState: {
      x: 0,
      z: 3.5,
      targetX: 0,
      targetZ: 3.5,
      walkPhase: 0,
      isWalking: false,
      errand: null,
      keysPressed: new Set(),
    },
    reactionState: {
      isRunning: false,
      elapsed: 0,
      currentLiveHeightMeters: 0,
      currentLiveTempCelsius: 25,
      isCleaningUp: false,
      cleanupElapsed: 0,
      pourTimer: 0,
      pourColorHex: '#38bdf8',
      autoPhotoTakenForRun: false,
      collectedFoamVolume: 0,
      targetMoundScale: 0,
      currentMoundScale: 0,
    },
  });

  const computeCameraTargets = (
    scaleId: ScaleEnvironmentId,
    preset: CameraPresetId,
    standBack: number
  ) => {
    const scaleFactor =
      scaleId === 'lab_beaker'
        ? 1.0
        : scaleId === 'kiddie_pool'
        ? 1.65
        : scaleId === 'steel_flask'
        ? 3.1
        : 3.8;

    const avState = sceneRefs.current.avatarWalkState;

    if (preset === 'vr_first_person') {
      const camX = avState ? avState.x : 0;
      const camZ = avState ? avState.z - 0.25 : Math.max(3.2, Math.min(28, standBack * 0.72));
      _targetCamPos.set(camX, 1.66, camZ);
      _targetLookAt.set(0, 1.8 * (scaleFactor * 0.65), 0);
    } else if (preset === 'vessel_closeup') {
      _targetCamPos.set(2.2 * scaleFactor, 2.5 * scaleFactor, 3.6 * scaleFactor);
      _targetLookAt.set(0, 1.45 * scaleFactor, 0);
    } else if (preset === 'aerial_drone') {
      _targetCamPos.set(-6.5 * scaleFactor, 11.5 * scaleFactor, 9.5 * scaleFactor);
      _targetLookAt.set(0, 2.4 * scaleFactor, 0);
    } else {
      _targetCamPos.set(4.5 * scaleFactor, 4.0 * scaleFactor, 7.6 * scaleFactor);
      _targetLookAt.set(0, 1.4 * scaleFactor, 0);
    }
  };

  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    // 1. Software WebGL Guard
    const isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setSize(
      container.clientWidth || window.innerWidth,
      container.clientHeight || window.innerHeight
    );

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();

    // 2. Scene, Sky/Horizon Fog, & RoomEnvironment PMREM Reflection
    const scene = new THREE.Scene();
    const initialLoc = LAB_LOCATIONS[configRef.current.locationId || 'crunchlabs_warehouse'];
    scene.background = new THREE.Color(initialLoc.skyHex);
    scene.fog = new THREE.FogExp2(initialLoc.fogHex, initialLoc.fogDensity);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    // 3. Camera & OrbitControls
    const camera = new THREE.PerspectiveCamera(
      52,
      (container.clientWidth || window.innerWidth) / (container.clientHeight || window.innerHeight),
      0.1,
      300
    );
    camera.position.set(5, 4.5, 9);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.maxPolarAngle = Math.PI / 2 - 0.03;
    controls.minDistance = 2.0;
    controls.maxDistance = 85;
    controls.target.set(0, 1.8, 0);

    controls.addEventListener('start', () => {
      sceneRefs.current.cameraTransitionActive = false;
    });

    // 4. Studio 3-Point + Warm/Cool Hemisphere Lighting Rig
    const hemiLight = new THREE.HemisphereLight(0xbae6fd, 0x1e293b, 1.15);
    hemiLight.position.set(0, 50, 0);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfffbeb, 2.5);
    keyLight.position.set(16, 28, 18);
    keyLight.castShadow = !isSoftwareGl;
    const d = 24;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 80;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.1);
    rimLight.position.set(-18, 15, -16);
    scene.add(rimLight);

    // 5. Ground Test Pad & All 4 Switchable 3D Location Environments
    const groundTex = createTestPadGridTexture(maxAnisotropy);
    const groundGeo = new THREE.PlaneGeometry(220, 220);
    const groundMat = new THREE.MeshStandardMaterial({
      map: groundTex,
      color: initialLoc.groundColorHex,
      roughness: 0.82,
      metalness: 0.08,
    });
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.position.y = 0;
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);

    const locationGroups = createAllLocationEnvironments();
    (Object.keys(locationGroups) as LabLocationId[]).forEach((locId) => {
      locationGroups[locId].visible =
        locId === (configRef.current.locationId || 'crunchlabs_warehouse');
      scene.add(locationGroups[locId]);
    });

    // 5b. Interactive 3D Chemical Supply Cart & Safety Gear Locker Rack
    const supplyStations = createLabSupplyStations();
    scene.add(supplyStations.group);

    // 5c. 3D Footstep Target Marker Ring on the Floor (shows where Scientist is walking!)
    const walkTargetMarker = new THREE.Group();
    const walkRingGeo = new THREE.RingGeometry(0.28, 0.38, 32);
    walkRingGeo.rotateX(-Math.PI / 2);
    const walkRingMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    const walkRingMesh = new THREE.Mesh(walkRingGeo, walkRingMat);
    walkRingMesh.position.y = 0.04;
    walkTargetMarker.add(walkRingMesh);
    walkTargetMarker.visible = false;
    scene.add(walkTargetMarker);

    // 6. Safety Blast Perimeter Ring on the Ground
    const ringGeo = new THREE.RingGeometry(0.94, 1.0, 64);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x10b981,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.75,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const safetyRingMesh = new THREE.Mesh(ringGeo, ringMat);
    safetyRingMesh.position.y = 0.03;
    scene.add(safetyRingMesh);

    const zoneDiscGeo = new THREE.CircleGeometry(1.0, 64);
    zoneDiscGeo.rotateX(-Math.PI / 2);
    const zoneDiscMat = new THREE.MeshBasicMaterial({
      color: 0xef4444,
      transparent: true,
      opacity: 0.08,
      depthWrite: false,
    });
    const safetyZoneDisc = new THREE.Mesh(zoneDiscGeo, zoneDiscMat);
    safetyZoneDisc.position.y = 0.025;
    scene.add(safetyZoneDisc);

    // 7. 3D Holographic AR Altitude Ruler & Rising Peak Laser Ring
    const arRulerGroup = new THREE.Group();
    const poleMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.55,
    });
    const poleGeo = new THREE.CylinderGeometry(0.035, 0.035, 40, 8);
    poleGeo.translate(0, 20, 0);
    const poleMesh = new THREE.Mesh(poleGeo, poleMat);
    arRulerGroup.add(poleMesh);

    const rungGeo = new THREE.BoxGeometry(0.65, 0.04, 0.04);
    for (let h = 2; h <= 38; h += 2) {
      const rung = new THREE.Mesh(rungGeo, poleMat);
      rung.position.set(0.32, h, 0);
      arRulerGroup.add(rung);
    }
    arRulerGroup.position.set(-2.6, 0, 0);
    scene.add(arRulerGroup);

    const arPeakMarkerGroup = new THREE.Group();
    const peakRingGeo = new THREE.RingGeometry(1.1, 1.22, 48);
    peakRingGeo.rotateX(-Math.PI / 2);
    const peakRingMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
    });
    const peakRingMesh = new THREE.Mesh(peakRingGeo, peakRingMat);
    arPeakMarkerGroup.add(peakRingMesh);

    const laserBarGeo = new THREE.BoxGeometry(5.2, 0.045, 0.045);
    const laserBarMesh = new THREE.Mesh(laserBarGeo, peakRingMat);
    laserBarMesh.position.set(-1.2, 0, 0);
    arPeakMarkerGroup.add(laserBarMesh);
    arPeakMarkerGroup.position.set(0, 3.0, 0);
    scene.add(arPeakMarkerGroup);

    // 8. Create All 4 Multi-Part Scale Rigs & Scientist Avatar
    const rigs: Record<ScaleEnvironmentId, { group: THREE.Group; metrics: VesselSpawnMetrics }> = {
      lab_beaker: createLabBeakerRig(isSoftwareGl, maxAnisotropy),
      kiddie_pool: createKiddiePoolRig(maxAnisotropy),
      steel_flask: createSteelFlaskRig(maxAnisotropy),
      outdoor_crater: createOutdoorCraterRig(maxAnisotropy),
    };

    Object.values(rigs).forEach((r) => {
      r.group.visible = false;
      scene.add(r.group);
    });
    rigs[configRef.current.scaleId].group.visible = true;

    const avatar = createScientistAvatar(isSoftwareGl);
    const initialZ = Math.max(2.6, Math.min(26, safetyGearRef.current.standBackMeters * 0.72));
    avatar.group.position.set(0, 0, initialZ);
    avatar.group.rotation.y = Math.PI;
    sceneRefs.current.avatarWalkState.x = 0;
    sceneRefs.current.avatarWalkState.z = initialZ;
    sceneRefs.current.avatarWalkState.targetX = 0;
    sceneRefs.current.avatarWalkState.targetZ = initialZ;

    syncScientistAvatarPpe(avatar, safetyGearRef.current);
    scene.add(avatar.group);

    // 9. Pouring Stream & Water Hose Cleanup Spray Meshes
    const pourGeo = new THREE.CylinderGeometry(0.08, 0.14, 1.8, 16);
    const pourMat = new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      roughness: 0.1,
      transmission: isSoftwareGl ? 0 : 0.7,
      transparent: true,
      opacity: 0.85,
    });
    const pourStreamMesh = new THREE.Mesh(pourGeo, pourMat);
    pourStreamMesh.visible = false;
    scene.add(pourStreamMesh);

    const hoseGeo = new THREE.ConeGeometry(1.4, 7.5, 20, 1, true);
    hoseGeo.rotateX(Math.PI / 2);
    const hoseMat = new THREE.MeshBasicMaterial({
      color: 0x7dd3fc,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const hoseSprayMesh = new THREE.Mesh(hoseGeo, hoseMat);
    hoseSprayMesh.visible = false;
    scene.add(hoseSprayMesh);

    // 10. InstancedMesh for Viscoelastic Foam Billows + Persistent Accumulated Foam Mound!
    const foamBumpTex = createFoamBumpTexture();
    const foamGeo = new THREE.IcosahedronGeometry(1, 2);
    const foamMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.38,
      metalness: 0.02,
      bumpMap: foamBumpTex,
      bumpScale: 0.06,
      clearcoat: 0.45,
      clearcoatRoughness: 0.25,
      sheen: 0.6,
      sheenRoughness: 0.4,
      sheenColor: new THREE.Color(0xffffff),
    });
    const foamMesh = new THREE.InstancedMesh(foamGeo, foamMat, FOAM_INSTANCE_COUNT);
    foamMesh.castShadow = !isSoftwareGl;
    foamMesh.receiveShadow = !isSoftwareGl;
    foamMesh.frustumCulled = false;
    scene.add(foamMesh);

    // Persistent 3D Accumulated Foam Mound & Spreading Blanket on the Ground (Collects up and never fades!)
    const accumulatedMoundGroup = new THREE.Group();
    const accumulatedMoundMat = new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      roughness: 0.38,
      metalness: 0.02,
      bumpMap: foamBumpTex,
      bumpScale: 0.08,
      clearcoat: 0.45,
      clearcoatRoughness: 0.25,
      sheen: 0.6,
      sheenRoughness: 0.4,
    });

    // Build a multi-lobe organic foam mountain + spreading blanket that scales up as foam lands
    for (let m = 0; m < MOUND_LOBE_COUNT; m++) {
      const ringIdx = Math.floor(m / 9); // 4 concentric rings (0..3)
      const angle = ((m % 9) / 9) * Math.PI * 2 + ringIdx * 0.35;
      const dist = ringIdx === 0 ? 0.35 : ringIdx * 1.15;
      const lobeRadius =
        ringIdx === 0 ? 1.15 : ringIdx === 1 ? 0.95 : ringIdx === 2 ? 0.78 : 0.62;
      const lobeMesh = new THREE.Mesh(
        new THREE.IcosahedronGeometry(lobeRadius, 2),
        accumulatedMoundMat
      );
      const ySquash = ringIdx === 0 ? 0.85 : ringIdx === 1 ? 0.62 : 0.42;
      lobeMesh.position.set(
        Math.cos(angle) * dist,
        lobeRadius * ySquash * 0.45,
        Math.sin(angle) * dist
      );
      lobeMesh.scale.set(1.25, ySquash, 1.25);
      lobeMesh.castShadow = !isSoftwareGl;
      lobeMesh.receiveShadow = !isSoftwareGl;
      accumulatedMoundGroup.add(lobeMesh);
    }
    accumulatedMoundGroup.scale.setScalar(0.001);
    accumulatedMoundGroup.visible = false;
    scene.add(accumulatedMoundGroup);

    // 11. InstancedMesh for Exothermic Steam / Oxygen Vapor Clouds
    const steamGeo = new THREE.DodecahedronGeometry(1, 1);
    const steamMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.95,
      metalness: 0.0,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
    });
    const steamMesh = new THREE.InstancedMesh(steamGeo, steamMat, STEAM_INSTANCE_COUNT);
    steamMesh.frustumCulled = false;
    scene.add(steamMesh);

    // 12. InstancedMesh for Orbeez Water Beads & Oxygen Fizz Micro-Droplets
    const orbeezGeo = new THREE.SphereGeometry(0.18, 12, 12);
    const orbeezMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.1,
      metalness: 0.05,
      clearcoat: 1.0,
    });
    const orbeezMesh = new THREE.InstancedMesh(orbeezGeo, orbeezMat, ORBEEZ_INSTANCE_COUNT);
    orbeezMesh.frustumCulled = false;
    scene.add(orbeezMesh);

    const foamParticles: FoamParticle[] = Array.from({ length: FOAM_INSTANCE_COUNT }, () => ({
      active: false,
      x: 0,
      y: -50,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      radius: 0.001,
      targetRadius: 0.5,
      age: 0,
      settled: false,
      colorVariation: 1,
    }));

    // Radial height rings so falling foam blobs stack ON TOP of already-collected foam on the ground!
    const foamStackRings = new Float32Array(24);

    const steamParticles: SteamParticle[] = Array.from({ length: STEAM_INSTANCE_COUNT }, () => ({
      active: false,
      x: 0,
      y: -50,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      scale: 0.001,
      age: 0,
      maxAge: 3,
    }));

    const orbeezParticles: OrbeezParticle[] = Array.from({ length: ORBEEZ_INSTANCE_COUNT }, () => ({
      active: false,
      x: 0,
      y: -50,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      scale: 0.001,
      hue: 0.5,
    }));

    _dummy.position.set(0, -50, 0);
    _dummy.scale.setScalar(0.001);
    _dummy.updateMatrix();
    for (let i = 0; i < FOAM_INSTANCE_COUNT; i++) {
      foamMesh.setMatrixAt(i, _dummy.matrix);
      foamMesh.setColorAt(i, _color.setHex(0xffffff));
    }
    for (let i = 0; i < STEAM_INSTANCE_COUNT; i++) {
      steamMesh.setMatrixAt(i, _dummy.matrix);
    }
    for (let i = 0; i < ORBEEZ_INSTANCE_COUNT; i++) {
      orbeezMesh.setMatrixAt(i, _dummy.matrix);
      orbeezMesh.setColorAt(i, _color.setHex(0x38bdf8));
    }
    foamMesh.instanceMatrix.needsUpdate = true;
    steamMesh.instanceMatrix.needsUpdate = true;
    orbeezMesh.instanceMatrix.needsUpdate = true;

    sceneRefs.current.scene = scene;
    sceneRefs.current.groundMat = groundMat;
    sceneRefs.current.rigs = rigs;
    sceneRefs.current.locationGroups = locationGroups;
    sceneRefs.current.supplyStations = supplyStations;
    sceneRefs.current.avatar = avatar;
    sceneRefs.current.walkTargetMarker = walkTargetMarker;
    sceneRefs.current.safetyRingMesh = safetyRingMesh;
    sceneRefs.current.safetyZoneDisc = safetyZoneDisc;
    sceneRefs.current.arRulerGroup = arRulerGroup;
    sceneRefs.current.arPeakMarkerGroup = arPeakMarkerGroup;
    sceneRefs.current.foamMesh = foamMesh;
    sceneRefs.current.foamMat = foamMat;
    sceneRefs.current.accumulatedMoundGroup = accumulatedMoundGroup;
    sceneRefs.current.accumulatedMoundMat = accumulatedMoundMat;
    sceneRefs.current.steamMesh = steamMesh;
    sceneRefs.current.orbeezMesh = orbeezMesh;
    sceneRefs.current.pourStreamMesh = pourStreamMesh;
    sceneRefs.current.hoseSprayMesh = hoseSprayMesh;

    onRegisterSnapshotFn(() => {
      renderer.render(scene, camera);
      return renderer.domElement.toDataURL('image/jpeg', 0.88);
    });

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    computeCameraTargets(
      configRef.current.scaleId,
      'orbit_overview',
      safetyGearRef.current.standBackMeters
    );
    camera.position.copy(_targetCamPos);
    controls.target.copy(_targetLookAt);
    controls.update();

    // Pointer Click Raycasting on Canvas: Click 3D Supply Cart / Safety Locker to Fetch, OR Click Floor to Walk!
    let pointerDownPos = { x: 0, y: 0, time: 0 };
    const onCanvasPointerDown = (e: PointerEvent) => {
      pointerDownPos = { x: e.clientX, y: e.clientY, time: performance.now() };
    };

    const onCanvasPointerUp = (e: PointerEvent) => {
      const moveDist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
      const elapsed = performance.now() - pointerDownPos.time;
      // Only treat as a walk/fetch click if the user didn't drag the OrbitControls camera
      if (moveDist > 9 || elapsed > 550) return;

      const rect = renderer.domElement.getBoundingClientRect();
      _pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      _pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      _raycaster.setFromCamera(_pointerNdc, camera);

      const avWalk = sceneRefs.current.avatarWalkState;

      // 1. Check if user clicked a 3D Bottle on the Supply Cart or the 3D Safety Gear Locker!
      const stationHits = _raycaster.intersectObjects(supplyStations.clickableTargets, false);
      if (stationHits.length > 0) {
        const hitData = stationHits[0].object.userData;
        if (hitData.interactType === 'fetch_ingredient' && hitData.step) {
          avWalk.errand = {
            type: 'fetch_ingredient',
            phase: 'to_station',
            targetX: supplyStations.chemTablePos.x + 0.5,
            targetZ: supplyStations.chemTablePos.z + 0.9,
            returnX: avWalk.x,
            returnZ: avWalk.z,
            step: hitData.step as IngredientStep,
          };
          avWalk.targetX = avWalk.errand.targetX;
          avWalk.targetZ = avWalk.errand.targetZ;
          walkTargetMarker.position.set(avWalk.targetX, 0, avWalk.targetZ);
          walkTargetMarker.visible = true;
          return;
        }
        if (hitData.interactType === 'fetch_safety') {
          avWalk.errand = {
            type: 'fetch_safety',
            phase: 'to_station',
            targetX: supplyStations.safetyRackPos.x - 0.5,
            targetZ: supplyStations.safetyRackPos.z + 0.9,
            returnX: avWalk.x,
            returnZ: avWalk.z,
          };
          avWalk.targetX = avWalk.errand.targetX;
          avWalk.targetZ = avWalk.errand.targetZ;
          walkTargetMarker.position.set(avWalk.targetX, 0, avWalk.targetZ);
          walkTargetMarker.visible = true;
          return;
        }
      }

      // 2. Otherwise check if user clicked on the Lab Floor to walk their Scientist there!
      const groundHits = _raycaster.intersectObject(groundMesh, false);
      if (groundHits.length > 0) {
        const pt = groundHits[0].point;
        // Keep outside the central vessel core so the scientist stands around the vessel, not inside it
        const distFromCenter = Math.hypot(pt.x, pt.z);
        const minVesselClearance =
          configRef.current.scaleId === 'lab_beaker'
            ? 1.75
            : configRef.current.scaleId === 'kiddie_pool'
            ? 2.8
            : configRef.current.scaleId === 'steel_flask'
            ? 3.8
            : 5.2;

        let destX = THREE.MathUtils.clamp(pt.x, -22, 22);
        let destZ = THREE.MathUtils.clamp(pt.z, -18, 24);
        if (distFromCenter < minVesselClearance) {
          const pushAngle = Math.atan2(destZ || 1, destX || 0.1);
          destX = Math.cos(pushAngle) * minVesselClearance;
          destZ = Math.sin(pushAngle) * minVesselClearance;
        }

        avWalk.errand = null;
        avatar.carriedBottleGroup.visible = false;
        avWalk.targetX = destX;
        avWalk.targetZ = destZ;
        walkTargetMarker.position.set(destX, 0, destZ);
        walkTargetMarker.visible = true;
      }
    };

    renderer.domElement.addEventListener('pointerdown', onCanvasPointerDown);
    renderer.domElement.addEventListener('pointerup', onCanvasPointerUp);

    // Keyboard WASD / Arrow Keys for walking the Scientist around directly!
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const k = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
        sceneRefs.current.avatarWalkState.keysPressed.add(k);
        sceneRefs.current.avatarWalkState.errand = null;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      sceneRefs.current.avatarWalkState.keysPressed.delete(e.key.toLowerCase());
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    // Helper to project a 3D world point (x, y, z) to 2D screen pixels and position a DOM element
    const positionArElement = (
      el: HTMLElement | null,
      wx: number,
      wy: number,
      wz: number,
      width: number,
      height: number
    ) => {
      if (!el) return;
      if (!showArRef.current) {
        el.style.opacity = '0';
        return;
      }
      _projVec.set(wx, wy, wz);
      _projVec.project(camera);

      if (
        _projVec.z > 1.0 ||
        _projVec.x < -0.96 ||
        _projVec.x > 0.96 ||
        _projVec.y < -0.92 ||
        _projVec.y > 0.88
      ) {
        el.style.opacity = '0';
        return;
      }

      const sx = ((_projVec.x + 1) * 0.5) * width;
      const sy = ((-_projVec.y + 1) * 0.5) * height;
      el.style.opacity = '1';
      el.style.transform = `translate3d(${Math.round(sx)}px, ${Math.round(sy)}px, 0)`;
    };

    const clock = new THREE.Clock();
    let frameId = 0;
    let spawnCursorFoam = 0;
    let spawnCursorSteam = 0;
    let spawnCursorOrbeez = 0;

    // Helper to find the next available foam particle slot without erasing settled ground foam!
    const acquireFoamSlot = (): FoamParticle => {
      for (let attempt = 0; attempt < FOAM_INSTANCE_COUNT; attempt++) {
        const idx = (spawnCursorFoam + attempt) % FOAM_INSTANCE_COUNT;
        if (!foamParticles[idx].active) {
          spawnCursorFoam = (idx + 1) % FOAM_INSTANCE_COUNT;
          return foamParticles[idx];
        }
      }
      // If all 1,280 slots are active, prefer an airborne one so settled ground foam stays intact
      for (let attempt = 0; attempt < FOAM_INSTANCE_COUNT; attempt++) {
        const idx = (spawnCursorFoam + attempt) % FOAM_INSTANCE_COUNT;
        if (!foamParticles[idx].settled) {
          spawnCursorFoam = (idx + 1) % FOAM_INSTANCE_COUNT;
          return foamParticles[idx];
        }
      }
      const fallback = foamParticles[spawnCursorFoam];
      spawnCursorFoam = (spawnCursorFoam + 1) % FOAM_INSTANCE_COUNT;
      return fallback;
    };

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function tick() {
      const rawDelta = clock.getDelta();
      const dt = Math.min(0.1, rawDelta);
      const currentConfig = configRef.current;
      const currentGear = safetyGearRef.current;
      const currentResult = activeResultRef.current;
      const predResult = predictedResultRef.current;
      const rState = sceneRefs.current.reactionState;
      const avWalk = sceneRefs.current.avatarWalkState;
      const activeRig = rigs[currentConfig.scaleId];

      // Smooth exponential camera transition
      if (sceneRefs.current.cameraTransitionActive) {
        const dampFactor = 1 - Math.exp(-5.5 * dt);
        camera.position.lerp(sceneRefs.current.desiredCamPos, dampFactor);
        controls.target.lerp(sceneRefs.current.desiredLookAt, dampFactor);
        if (
          camera.position.distanceToSquared(sceneRefs.current.desiredCamPos) < 0.02 &&
          controls.target.distanceToSquared(sceneRefs.current.desiredLookAt) < 0.02
        ) {
          sceneRefs.current.cameraTransitionActive = false;
        }
      }
      controls.update();

      // Update Safety Blast Ring
      const safetyEval = evaluateSafetyHazards(currentConfig, currentGear);
      const visualRingRadius = Math.max(2.6, Math.min(26, safetyEval.minSafeDistanceMeters * 0.72));
      safetyRingMesh.scale.setScalar(visualRingRadius);
      safetyZoneDisc.scale.setScalar(visualRingRadius);
      (safetyRingMesh.material as THREE.MeshBasicMaterial).color.setHex(
        safetyEval.isCompliant ? 0x10b981 : 0xf59e0b
      );
      (safetyZoneDisc.material as THREE.MeshBasicMaterial).opacity = safetyEval.isCompliant
        ? 0.03
        : 0.11;

      // --- SCIENTIST WALKING, KEYBOARD CONTROL, & FETCH ERRAND STATE MACHINE ---
      const walkSpeed = 5.4;
      if (avWalk.keysPressed.size > 0) {
        let kx = 0;
        let kz = 0;
        if (avWalk.keysPressed.has('w') || avWalk.keysPressed.has('arrowup')) kz -= 1;
        if (avWalk.keysPressed.has('s') || avWalk.keysPressed.has('arrowdown')) kz += 1;
        if (avWalk.keysPressed.has('a') || avWalk.keysPressed.has('arrowleft')) kx -= 1;
        if (avWalk.keysPressed.has('d') || avWalk.keysPressed.has('arrowright')) kx += 1;
        if (kx !== 0 || kz !== 0) {
          const len = Math.hypot(kx, kz);
          avWalk.targetX = THREE.MathUtils.clamp(avWalk.x + (kx / len) * walkSpeed * dt * 2.5, -22, 22);
          avWalk.targetZ = THREE.MathUtils.clamp(avWalk.z + (kz / len) * walkSpeed * dt * 2.5, -18, 24);
          walkTargetMarker.visible = false;
        }
      }

      const dx = avWalk.targetX - avWalk.x;
      const dz = avWalk.targetZ - avWalk.z;
      const distToTarget = Math.hypot(dx, dz);

      if (distToTarget > 0.09) {
        avWalk.isWalking = true;
        const stepDist = Math.min(distToTarget, walkSpeed * dt);
        avWalk.x += (dx / distToTarget) * stepDist;
        avWalk.z += (dz / distToTarget) * stepDist;
        avWalk.walkPhase += dt * 13.5;

        // Smoothly rotate Scientist to face walking direction
        const targetHeading = Math.atan2(dx, dz);
        avatar.group.rotation.y = THREE.MathUtils.damp(
          avatar.group.rotation.y,
          targetHeading,
          10,
          dt
        );

        // Articulated limb swing & walking bounce!
        const swing = Math.sin(avWalk.walkPhase);
        avatar.leftLegGroup.rotation.x = swing * 0.65;
        avatar.rightLegGroup.rotation.x = -swing * 0.65;
        const carrying = avatar.carriedBottleGroup.visible;
        avatar.leftArmGroup.rotation.x = carrying ? -0.55 : -swing * 0.45;
        avatar.rightArmGroup.rotation.x = carrying ? -0.55 : swing * 0.45;
        avatar.bodyGroup.position.y = Math.abs(Math.sin(avWalk.walkPhase)) * 0.075;
      } else {
        avWalk.isWalking = false;
        avatar.leftLegGroup.rotation.x = THREE.MathUtils.damp(
          avatar.leftLegGroup.rotation.x,
          0,
          10,
          dt
        );
        avatar.rightLegGroup.rotation.x = THREE.MathUtils.damp(
          avatar.rightLegGroup.rotation.x,
          0,
          10,
          dt
        );
        const carrying = avatar.carriedBottleGroup.visible;
        avatar.leftArmGroup.rotation.x = THREE.MathUtils.damp(
          avatar.leftArmGroup.rotation.x,
          carrying ? -0.55 : 0,
          10,
          dt
        );
        avatar.rightArmGroup.rotation.x = THREE.MathUtils.damp(
          avatar.rightArmGroup.rotation.x,
          carrying ? -0.55 : 0,
          10,
          dt
        );
        avatar.bodyGroup.position.y = THREE.MathUtils.damp(avatar.bodyGroup.position.y, 0, 10, dt);

        // Advance Errand Phase if Scientist arrived at a station or vessel!
        if (avWalk.errand) {
          const err = avWalk.errand;
          if (err.type === 'fetch_ingredient' && err.step) {
            if (err.phase === 'to_station') {
              // Pick up the 3D bottle from the Chemical Supply Cart and walk to the Reaction Vessel!
              avatar.carriedBottleMat.color.set(INGREDIENT_META[err.step].color);
              avatar.carriedBottleGroup.visible = true;
              avatar.remoteBoxGroup.visible = false;
              const vesselStopDist =
                currentConfig.scaleId === 'lab_beaker'
                  ? 1.9
                  : currentConfig.scaleId === 'kiddie_pool'
                  ? 2.9
                  : 3.9;
              err.phase = 'to_vessel';
              avWalk.targetX = -0.8;
              avWalk.targetZ = vesselStopDist;
              walkTargetMarker.position.set(avWalk.targetX, 0, avWalk.targetZ);
            } else if (err.phase === 'to_vessel') {
              // Pour the carried ingredient into the vessel!
              if (onFetchedIngredientRef.current) {
                onFetchedIngredientRef.current(err.step);
              }
              rState.pourTimer = 0.85;
              rState.pourColorHex = INGREDIENT_META[err.step].color;
              avatar.carriedBottleGroup.visible = false;
              avatar.remoteBoxGroup.visible = currentGear.remoteTriggerArmed;
              err.phase = 'returning';
              avWalk.targetX = err.returnX;
              avWalk.targetZ = err.returnZ;
              walkTargetMarker.position.set(avWalk.targetX, 0, avWalk.targetZ);
            } else {
              avWalk.errand = null;
              walkTargetMarker.visible = false;
            }
          } else if (err.type === 'fetch_safety') {
            if (err.phase === 'to_station') {
              if (onFetchedSafetyRef.current) {
                onFetchedSafetyRef.current();
              }
              err.phase = 'returning';
              avWalk.targetX = err.returnX;
              avWalk.targetZ = err.returnZ;
              walkTargetMarker.position.set(avWalk.targetX, 0, avWalk.targetZ);
            } else {
              avWalk.errand = null;
              walkTargetMarker.visible = false;
            }
          }
        } else {
          walkTargetMarker.visible = false;
          // Face the reaction vessel at (0, 0) when standing still
          const lookToVesselAngle = Math.atan2(-avWalk.x, -avWalk.z);
          avatar.group.rotation.y = THREE.MathUtils.damp(
            avatar.group.rotation.y,
            lookToVesselAngle,
            8,
            dt
          );
        }

        // Report updated standoff distance in meters back to App state when scientist settles
        const realWorldMeters = Math.max(
          1,
          Math.round(Math.hypot(avWalk.x, avWalk.z) / 0.72)
        );
        if (
          realWorldMeters !== currentGear.standBackMeters &&
          !avWalk.errand &&
          onUpdateStandBackRef.current
        ) {
          onUpdateStandBackRef.current(realWorldMeters, true);
        }
      }

      avatar.group.position.set(avWalk.x, 0, avWalk.z);

      // Update Pouring Stream Animation
      if (rState.pourTimer > 0) {
        rState.pourTimer -= dt;
        pourStreamMesh.visible = true;
        pourStreamMesh.position.set(0, activeRig.metrics.nozzleY + 0.9, 0);
        (pourStreamMesh.material as THREE.MeshPhysicalMaterial).color.set(rState.pourColorHex);
      } else {
        pourStreamMesh.visible = false;
      }

      // Update Catalyst Mechanical Dropper Trough Rotation during Eruption
      const targetTroughRot = rState.isRunning && rState.elapsed < 2.5 ? Math.PI * 0.65 : 0;
      activeRig.metrics.catalystDropperGroup.rotation.z = THREE.MathUtils.damp(
        activeRig.metrics.catalystDropperGroup.rotation.z,
        targetTroughRot,
        7,
        dt
      );

      const dyeSpec = DYE_COLORS[currentConfig.dyeColor];
      let foamNeedsUpdate = false;
      let steamNeedsUpdate = false;
      let orbeezNeedsUpdate = false;

      if (rState.isRunning && currentResult) {
        rState.elapsed += dt;

        const rampProgress = Math.min(1, rState.elapsed / 1.85);
        const easedProgress = 1 - Math.pow(1 - rampProgress, 3);
        rState.currentLiveHeightMeters = Number(
          (currentResult.peakHeightMeters * easedProgress).toFixed(1)
        );
        rState.currentLiveTempCelsius = Math.round(
          currentConfig.chemicalTempCelsius +
            (currentResult.peakTempCelsius - currentConfig.chemicalTempCelsius) * easedProgress
        );

        if (!rState.autoPhotoTakenForRun && rState.elapsed >= 2.1 && onAutoPhotoRef.current) {
          rState.autoPhotoTakenForRun = true;
          renderer.render(scene, camera);
          const snapUrl = renderer.domElement.toDataURL('image/jpeg', 0.85);
          onAutoPhotoRef.current(
            snapUrl,
            `${currentResult.outcomeTitle} (${currentResult.peakHeightMeters}m peak)`
          );
        }

        const activeSpawnWindow = Math.min(6.5, currentResult.durationSeconds * 0.65);
        if (rState.elapsed <= activeSpawnWindow) {
          const nozzleY = activeRig.metrics.nozzleY;
          const nozzleR = activeRig.metrics.nozzleRadius;

          if (currentResult.foamTrapEfficiency > 0.05) {
            // Tuned spawn count so 1,280 foam billows never overwrite settled ground foam!
            const spawnCount =
              currentResult.outcomeMode === 'catalyst_first_fizz_boiloff' ||
              currentResult.outcomeMode === 'steam_flash_vaporization'
                ? 1
                : currentResult.outcomeMode === 'devils_toothpaste_detonation'
                ? 4
                : 3;

            const moundGrowthRate =
              currentConfig.scaleId === 'lab_beaker'
                ? 0.24
                : currentConfig.scaleId === 'kiddie_pool'
                ? 0.65
                : currentConfig.scaleId === 'steel_flask'
                ? 1.05
                : 1.55;
            rState.targetMoundScale = Math.min(
              currentConfig.scaleId === 'lab_beaker' ? 1.45 : 4.2,
              rState.targetMoundScale + dt * moundGrowthRate * currentResult.foamTrapEfficiency
            );

            for (let s = 0; s < spawnCount; s++) {
              const p = acquireFoamSlot();

              const angle = Math.random() * Math.PI * 2;
              const radialOffset = Math.random() * nozzleR * 0.65;
              p.active = true;
              p.settled = false;
              p.age = 0;
              p.x = Math.cos(angle) * radialOffset;
              p.y = nozzleY;
              p.z = Math.sin(angle) * radialOffset;

              const jetSpeed = Math.min(28, Math.max(2.2, currentResult.eruptionVelocityMps * 0.58));
              const spread =
                currentConfig.scaleId === 'steel_flask'
                  ? 1.3
                  : currentConfig.scaleId === 'outdoor_crater'
                  ? 4.5
                  : 2.2;

              p.vx = Math.cos(angle) * (0.4 + Math.random() * spread);
              p.vy = jetSpeed * (0.78 + Math.random() * 0.38);
              p.vz = Math.sin(angle) * (0.4 + Math.random() * spread);

              const baseBlobSize =
                currentConfig.scaleId === 'lab_beaker'
                  ? 0.25
                  : currentConfig.scaleId === 'kiddie_pool'
                  ? 0.64
                  : currentConfig.scaleId === 'steel_flask'
                  ? 0.82
                  : 1.15;

              p.radius = baseBlobSize * 0.35;
              p.targetRadius = baseBlobSize * (0.85 + Math.random() * 0.7);
              p.colorVariation = Math.random();
            }
          }

          if (currentResult.steamIntensity > 0.05) {
            const steamSpawnCount =
              currentResult.outcomeMode === 'steam_flash_vaporization' ||
              currentResult.outcomeMode === 'catalyst_first_fizz_boiloff'
                ? 6
                : 2;
            for (let s = 0; s < steamSpawnCount; s++) {
              const sp = steamParticles[spawnCursorSteam];
              spawnCursorSteam = (spawnCursorSteam + 1) % STEAM_INSTANCE_COUNT;

              const angle = Math.random() * Math.PI * 2;
              const rOff = Math.random() * nozzleR * 0.8;
              sp.active = true;
              sp.age = 0;
              sp.maxAge = 2.4 + Math.random() * 1.8;
              sp.x = Math.cos(angle) * rOff;
              sp.y = nozzleY + 0.2;
              sp.z = Math.sin(angle) * rOff;
              sp.vx = (Math.random() - 0.5) * 2.4;
              sp.vy = 4.5 + currentResult.steamIntensity * 9.5 + Math.random() * 4;
              sp.vz = (Math.random() - 0.5) * 2.4;
              sp.scale =
                currentConfig.scaleId === 'lab_beaker'
                  ? 0.32
                  : currentConfig.scaleId === 'kiddie_pool'
                  ? 0.85
                  : 1.35;
            }
          }

          if (
            (currentConfig.includeOrbeez && currentConfig.additionOrder.includes('orbeez')) ||
            currentResult.fizzIntensity > 0.5
          ) {
            for (let b = 0; b < 4; b++) {
              const op = orbeezParticles[spawnCursorOrbeez];
              spawnCursorOrbeez = (spawnCursorOrbeez + 1) % ORBEEZ_INSTANCE_COUNT;

              const angle = Math.random() * Math.PI * 2;
              op.active = true;
              op.x = Math.cos(angle) * (nozzleR * 0.4);
              op.y = nozzleY + 0.1;
              op.z = Math.sin(angle) * (nozzleR * 0.4);
              op.vx = Math.cos(angle) * (1.5 + Math.random() * 4.5);
              op.vy = 5.0 + Math.random() * Math.min(22, currentResult.eruptionVelocityMps * 0.65);
              op.vz = Math.sin(angle) * (1.5 + Math.random() * 4.5);
              op.scale = currentConfig.scaleId === 'lab_beaker' ? 0.45 : 1.15;
              op.hue = Math.random();
            }
          }
        }
      } else {
        rState.currentLiveHeightMeters = predResult.peakHeightMeters;
        rState.currentLiveTempCelsius = currentConfig.chemicalTempCelsius;
      }

      // Water Hose Cleanup Dissolution (ONLY washes away collected foam when Hose Down is triggered!)
      if (rState.isCleaningUp) {
        rState.cleanupElapsed += dt;
        hoseSprayMesh.visible = true;
        hoseSprayMesh.position.set(
          avatar.group.position.x,
          1.3,
          avatar.group.position.z - 2.4
        );
        hoseSprayMesh.rotation.y = Math.sin(rState.cleanupElapsed * 5) * 0.45;

        rState.targetMoundScale = 0;
        rState.currentMoundScale *= Math.pow(0.12, dt);
        foamStackRings.fill(0);

        for (let i = 0; i < FOAM_INSTANCE_COUNT; i++) {
          const p = foamParticles[i];
          if (p.active) {
            p.targetRadius *= Math.pow(0.15, dt);
            p.radius *= Math.pow(0.15, dt);
            if (p.radius < 0.03) {
              p.active = false;
              p.settled = false;
              p.y = -50;
            }
            foamNeedsUpdate = true;
          }
        }

        if (rState.cleanupElapsed > 1.6) {
          rState.isCleaningUp = false;
          rState.currentMoundScale = 0;
          accumulatedMoundGroup.visible = false;
          hoseSprayMesh.visible = false;
        }
      } else {
        hoseSprayMesh.visible = false;
      }

      // Smoothly grow the Persistent 3D Accumulated Foam Mound on the table/ground!
      if (rState.targetMoundScale > 0.01 || rState.currentMoundScale > 0.01) {
        rState.currentMoundScale = THREE.MathUtils.damp(
          rState.currentMoundScale,
          rState.targetMoundScale,
          2.2,
          dt
        );
        accumulatedMoundGroup.visible = rState.currentMoundScale > 0.02;
        const moundBaseY = currentConfig.scaleId === 'lab_beaker' ? 1.54 : 0.02;
        accumulatedMoundGroup.position.set(0, moundBaseY, 0);
        accumulatedMoundGroup.scale.set(
          rState.currentMoundScale * 1.35,
          rState.currentMoundScale * 0.85,
          rState.currentMoundScale * 1.35
        );
        accumulatedMoundMat.color.set(dyeSpec.hex);
        accumulatedMoundMat.sheenColor.set(dyeSpec.accentHex);
      }

      // Advance Active Foam Particles (They collect up in a mound on the ground and NEVER fade away!)
      for (let i = 0; i < FOAM_INSTANCE_COUNT; i++) {
        const p = foamParticles[i];
        if (!p.active) continue;
        foamNeedsUpdate = true;
        p.age += dt;
        p.radius = THREE.MathUtils.damp(p.radius, p.targetRadius, 4.5, dt);

        if (!p.settled) {
          p.vy -= 9.8 * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.z += p.vz * dt;

          const radialDist = Math.hypot(p.x, p.z);
          const ringBin = Math.min(23, Math.floor(radialDist * 1.4));
          const stackedHeight = foamStackRings[ringBin];

          const baseFloorY =
            currentConfig.scaleId === 'lab_beaker' && radialDist < 1.65
              ? 1.55 + p.radius * 0.52
              : p.radius * 0.52;

          const landingY = baseFloorY + stackedHeight;

          if (p.y <= landingY) {
            p.y = landingY;
            p.vy = 0;
            // Foam creeps outward radially as it piles up!
            const creepOut = 0.55;
            p.vx *= creepOut;
            p.vz *= creepOut;
            if (Math.hypot(p.vx, p.vz) < 0.28 || p.age > 3.0) {
              p.settled = true;
              // Increment the radial foam pile height so subsequent foam stacks higher on top!
              const maxPileH =
                currentConfig.scaleId === 'lab_beaker'
                  ? 1.35
                  : currentConfig.scaleId === 'kiddie_pool'
                  ? 2.6
                  : 4.5;
              foamStackRings[ringBin] = Math.min(
                maxPileH,
                foamStackRings[ringBin] + p.targetRadius * 0.11
              );
            }
          }
        }

        _dummy.position.set(p.x, p.y, p.z);
        const squash = p.settled ? 0.78 : 1.0;
        const spreadFactor = p.settled ? 1.18 : 1.0;
        _dummy.scale.set(p.radius * spreadFactor, p.radius * squash, p.radius * spreadFactor);
        _dummy.updateMatrix();
        foamMesh.setMatrixAt(i, _dummy.matrix);

        _color.set(
          p.colorVariation > 0.72
            ? dyeSpec.accentHex
            : p.colorVariation > 0.35
            ? dyeSpec.hex
            : dyeSpec.secondaryHex
        );
        foamMesh.setColorAt(i, _color);
      }

      if (foamNeedsUpdate) {
        foamMesh.instanceMatrix.needsUpdate = true;
        if (foamMesh.instanceColor) foamMesh.instanceColor.needsUpdate = true;
      }

      // Advance Steam Particles
      for (let i = 0; i < STEAM_INSTANCE_COUNT; i++) {
        const sp = steamParticles[i];
        if (!sp.active) continue;
        steamNeedsUpdate = true;
        sp.age += dt;
        if (sp.age >= sp.maxAge) {
          sp.active = false;
          _dummy.position.set(0, -50, 0);
          _dummy.scale.setScalar(0.001);
          _dummy.updateMatrix();
          steamMesh.setMatrixAt(i, _dummy.matrix);
          continue;
        }
        sp.x += sp.vx * dt;
        sp.y += sp.vy * dt;
        sp.z += sp.vz * dt;
        const lifeRatio = sp.age / sp.maxAge;
        const currentScale = sp.scale * (1 + lifeRatio * 2.2) * (1 - lifeRatio * 0.65);
        _dummy.position.set(sp.x, sp.y, sp.z);
        _dummy.scale.setScalar(Math.max(0.01, currentScale));
        _dummy.updateMatrix();
        steamMesh.setMatrixAt(i, _dummy.matrix);
      }
      if (steamNeedsUpdate) {
        steamMesh.instanceMatrix.needsUpdate = true;
      }

      // Advance Orbeez / Fizz Particles
      for (let i = 0; i < ORBEEZ_INSTANCE_COUNT; i++) {
        const op = orbeezParticles[i];
        if (!op.active) continue;
        orbeezNeedsUpdate = true;
        op.vy -= 12.5 * dt;
        op.x += op.vx * dt;
        op.y += op.vy * dt;
        op.z += op.vz * dt;

        if (op.y <= 0.12) {
          op.y = 0.12;
          op.vy = Math.abs(op.vy) * 0.45;
          op.vx *= 0.75;
          op.vz *= 0.75;
          if (op.vy < 0.4) {
            op.vy = 0;
          }
        }

        _dummy.position.set(op.x, op.y, op.z);
        _dummy.scale.setScalar(op.scale);
        _dummy.updateMatrix();
        orbeezMesh.setMatrixAt(i, _dummy.matrix);
        _color.setHSL(op.hue, 0.85, 0.58);
        orbeezMesh.setColorAt(i, _color);
      }
      if (orbeezNeedsUpdate) {
        orbeezMesh.instanceMatrix.needsUpdate = true;
        if (orbeezMesh.instanceColor) orbeezMesh.instanceColor.needsUpdate = true;
      }

      // Update 3D AR Laser Pole & Peak Target Ring + Screen-Space Projected AR Callouts
      const poleX =
        currentConfig.scaleId === 'lab_beaker'
          ? -1.8
          : currentConfig.scaleId === 'kiddie_pool'
          ? -3.4
          : currentConfig.scaleId === 'steel_flask'
          ? -4.5
          : -6.2;

      const isEruptionPhase = rState.isRunning || Boolean(currentResult);

      arRulerGroup.visible = showArRef.current && isEruptionPhase;
      arPeakMarkerGroup.visible = showArRef.current && isEruptionPhase;
      arRulerGroup.position.x = THREE.MathUtils.damp(arRulerGroup.position.x, poleX, 6, dt);

      const visualScaleY =
        currentConfig.scaleId === 'lab_beaker'
          ? 0.9
          : currentConfig.scaleId === 'kiddie_pool'
          ? 0.68
          : 0.55;
      const targetVisualApexY = Math.min(
        36,
        activeRig.metrics.nozzleY + rState.currentLiveHeightMeters * visualScaleY
      );
      arPeakMarkerGroup.position.y = THREE.MathUtils.damp(
        arPeakMarkerGroup.position.y,
        targetVisualApexY,
        6,
        dt
      );

      // Update 2D AR Projected DOM Callout Positions
      const vw = container?.clientWidth || window.innerWidth;
      const vh = container?.clientHeight || window.innerHeight;

      if (!isEruptionPhase) {
        if (arApexBadgeRef.current) arApexBadgeRef.current.style.opacity = '0';
      } else {
        positionArElement(arApexBadgeRef.current, 0, arPeakMarkerGroup.position.y, 0, vw, vh);
        if (arApexTitleRef.current && arApexSubRef.current) {
          const prefix = rState.isRunning ? 'LIVE FOAM HEIGHT' : 'FINAL HEIGHT';
          const feet = Math.round(rState.currentLiveHeightMeters * 3.28084);
          arApexTitleRef.current.textContent = `${prefix}: ${rState.currentLiveHeightMeters} m (${feet} ft)`;
          arApexSubRef.current.textContent = getShortComparison(rState.currentLiveHeightMeters);
        }
      }

      const vesselY = activeRig.metrics.nozzleY * 0.55;
      const vesselOffsetX = Math.abs(poleX) * 0.68;
      positionArElement(arVesselBadgeRef.current, vesselOffsetX, vesselY, 0, vw, vh);
      if (arVesselTempRef.current && arVesselStatsRef.current) {
        if (!isEruptionPhase) {
          const cap = SCALE_ENVIRONMENTS[currentConfig.scaleId].vesselCapacityLiters;
          const hasP =
            currentConfig.additionOrder.includes('peroxide') &&
            currentConfig.peroxideVolumePercent > 0;
          const liters = hasP
            ? ((cap * currentConfig.peroxideVolumePercent) / 100).toFixed(1)
            : '0';
          const soapVal = currentConfig.additionOrder.includes('soap')
            ? currentConfig.soapVolumeMlPerLiter
            : 0;
          const catVal = currentConfig.additionOrder.includes('catalyst')
            ? currentConfig.catalystRatio
            : 0;
          arVesselTempRef.current.textContent = `MEASURED IN VESSEL: ${liters} L (${currentConfig.peroxideConcentration}% H₂O₂)`;
          arVesselStatsRef.current.textContent = `SOAP: ${soapVal} mL/L · CATALYST: ${catVal}%${
            currentConfig.includeOrbeez && currentConfig.orbeezCount
              ? ` · ORBEEZ: ${currentConfig.orbeezCount}`
              : ''
          }`;
        } else {
          const activeSim = currentResult || predResult;
          arVesselTempRef.current.textContent = `CORE TEMP: ${rState.currentLiveTempCelsius} °C`;
          arVesselStatsRef.current.textContent = `FOAM COLLECTED: ${activeSim.foamVolumeCubicMeters} m³ · SPEED: ${activeSim.eruptionVelocityMps} m/s`;
        }
      }

      // 3. AR Scientist Safety & Walking Status Callout
      positionArElement(
        arAvatarBadgeRef.current,
        avatar.group.position.x,
        2.15,
        avatar.group.position.z,
        vw,
        vh
      );
      if (arAvatarTextRef.current) {
        const distM = Math.max(
          1,
          Math.round(Math.hypot(avatar.group.position.x, avatar.group.position.z) / 0.72)
        );
        if (avWalk.errand) {
          arAvatarTextRef.current.textContent =
            avWalk.errand.type === 'fetch_ingredient'
              ? `🚶 Walking to Fetch ${
                  INGREDIENT_META[avWalk.errand.step || 'peroxide'].shortLabel
                }...`
              : `🚶 Walking to Safety Locker...`;
        } else if (avWalk.isWalking) {
          arAvatarTextRef.current.textContent = `🚶 Walking (${distM}m from vessel)...`;
        } else if (!currentGear.goggles) {
          arAvatarTextRef.current.textContent = `NO GOGGLES! ⚠️ · ${distM}m (Click Floor/WASD to Walk)`;
        } else {
          const isSafeDist = distM >= safetyEval.minSafeDistanceMeters;
          arAvatarTextRef.current.textContent = `GOGGLES ON ✓ · ${distM}m ${
            isSafeDist ? '(SAFE ✓)' : `(WALK BACK ≥${safetyEval.minSafeDistanceMeters}m ⚠️)`
          }`;
        }
      }

      // 3b. AR Supply Cart & Safety Locker Callouts (Shown when mixing)
      if (isEruptionPhase) {
        if (arChemCartBadgeRef.current) arChemCartBadgeRef.current.style.opacity = '0';
        if (arSafetyRackBadgeRef.current) arSafetyRackBadgeRef.current.style.opacity = '0';
      } else {
        positionArElement(
          arChemCartBadgeRef.current,
          supplyStations.chemTablePos.x,
          1.75,
          supplyStations.chemTablePos.z,
          vw,
          vh
        );
        positionArElement(
          arSafetyRackBadgeRef.current,
          supplyStations.safetyRackPos.x,
          2.1,
          supplyStations.safetyRackPos.z,
          vw,
          vh
        );
      }

      // 4. AR Vertical Scale Ruler Benchmarks
      AR_BENCHMARKS.forEach((bm, idx) => {
        const el = arBenchmarkRefs.current[idx];
        if (!isEruptionPhase) {
          if (el) el.style.opacity = '0';
          return;
        }
        const bmVisualY = activeRig.metrics.nozzleY + bm.meters * visualScaleY;
        const maxVisibleMeters =
          currentConfig.scaleId === 'lab_beaker'
            ? 7
            : currentConfig.scaleId === 'kiddie_pool'
            ? 18
            : 40;
        if (bm.meters > maxVisibleMeters) {
          if (el) el.style.opacity = '0';
        } else {
          positionArElement(el, arRulerGroup.position.x, bmVisualY, 0, vw, vh);
        }
      });

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    frameId = requestAnimationFrame(tick);

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      renderer.domElement.removeEventListener('pointerdown', onCanvasPointerDown);
      renderer.domElement.removeEventListener('pointerup', onCanvasPointerUp);
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      controls.dispose();
      renderer.dispose();
    };
  }, []);

  // Synchronize 3D Lab Location / Environment Setting
  useEffect(() => {
    const s = sceneRefs.current;
    if (!s.locationGroups || !s.scene || !s.groundMat) return;
    const locId: LabLocationId = config.locationId || 'crunchlabs_warehouse';
    const locSpec = LAB_LOCATIONS[locId];

    (Object.keys(s.locationGroups) as LabLocationId[]).forEach((id) => {
      s.locationGroups![id].visible = id === locId;
    });

    s.scene.background = new THREE.Color(locSpec.skyHex);
    s.scene.fog = new THREE.FogExp2(locSpec.fogHex, locSpec.fogDensity);
    s.groundMat.color.setHex(locSpec.groundColorHex);
  }, [config.locationId]);

  // Synchronize Scale Rig Visibility & Camera Target
  useEffect(() => {
    const s = sceneRefs.current;
    if (!s.rigs) return;

    (Object.keys(s.rigs) as ScaleEnvironmentId[]).forEach((id) => {
      s.rigs![id].group.visible = id === config.scaleId;
    });

    const dyeSpec = DYE_COLORS[config.dyeColor];
    const activeRig = s.rigs[config.scaleId];
    const stepFillRatio =
      config.additionOrder.length === 0
        ? 0.05
        : Math.min(1, 0.25 + config.additionOrder.length * 0.22) *
          (config.peroxideVolumePercent / 100);
    activeRig.metrics.liquidMesh.visible = config.additionOrder.length > 0;
    (activeRig.metrics.liquidMesh.material as THREE.MeshStandardMaterial).color.set(dyeSpec.hex);
    activeRig.metrics.liquidMesh.scale.y = Math.max(0.12, stepFillRatio);

    // Ensure Scientist isn't standing inside the new vessel if the vessel got wider
    const minClearance =
      config.scaleId === 'lab_beaker'
        ? 2.2
        : config.scaleId === 'kiddie_pool'
        ? 3.4
        : config.scaleId === 'steel_flask'
        ? 4.4
        : 5.8;
    const curDist = Math.hypot(s.avatarWalkState.x, s.avatarWalkState.z);
    if (curDist < minClearance) {
      s.avatarWalkState.targetZ = Math.max(minClearance, safetyGear.standBackMeters * 0.72);
    }

    computeCameraTargets(config.scaleId, cameraPreset, safetyGear.standBackMeters);
    s.desiredCamPos.copy(_targetCamPos);
    s.desiredLookAt.copy(_targetLookAt);
    s.cameraTransitionActive = true;
  }, [config.scaleId, cameraPreset]);

  // Update Liquid Color & Level
  useEffect(() => {
    const s = sceneRefs.current;
    if (!s.rigs) return;
    const dyeSpec = DYE_COLORS[config.dyeColor];
    const activeRig = s.rigs[config.scaleId];
    const stepFillRatio =
      config.additionOrder.length === 0
        ? 0.05
        : Math.min(1, 0.25 + config.additionOrder.length * 0.22) *
          (config.peroxideVolumePercent / 100);
    activeRig.metrics.liquidMesh.visible = config.additionOrder.length > 0;
    (activeRig.metrics.liquidMesh.material as THREE.MeshStandardMaterial).color.set(dyeSpec.hex);
    activeRig.metrics.liquidMesh.scale.y = Math.max(0.12, stepFillRatio);
  }, [config.dyeColor, config.peroxideVolumePercent, config.scaleId, config.additionOrder]);

  // Synchronize Scientist Avatar PPE gear, Dyed Bare Hands, & 3D Foam Snowman state
  useEffect(() => {
    const s = sceneRefs.current;
    if (!s.avatar) return;
    const dyeHex = DYE_COLORS[config.dyeColor].hex;
    const hasPoured = config.additionOrder.length > 0;
    const isBuriedSnowman = Boolean(
      activeResult && activeResult.peakHeightMeters >= 2.5 && !safetyGear.hazmatSuit
    );
    syncScientistAvatarPpe(s.avatar, safetyGear, dyeHex, hasPoured, isBuriedSnowman);
    if (cameraPreset === 'vr_first_person') {
      computeCameraTargets(config.scaleId, cameraPreset, safetyGear.standBackMeters);
      s.desiredCamPos.copy(_targetCamPos);
      s.desiredLookAt.copy(_targetLookAt);
      s.cameraTransitionActive = true;
    }
  }, [safetyGear, cameraPreset, config.scaleId, config.dyeColor, config.additionOrder, activeResult]);

  // Trigger Scientist Walk-and-Fetch Errand when requested from UI
  useEffect(() => {
    if (!fetchErrandTrigger || fetchErrandTrigger.count === 0) return;
    const s = sceneRefs.current;
    if (!s.supplyStations || !s.walkTargetMarker) return;
    const avWalk = s.avatarWalkState;

    if (fetchErrandTrigger.type === 'ingredient' && fetchErrandTrigger.step) {
      avWalk.errand = {
        type: 'fetch_ingredient',
        phase: 'to_station',
        targetX: s.supplyStations.chemTablePos.x + 0.5,
        targetZ: s.supplyStations.chemTablePos.z + 0.9,
        returnX: avWalk.x,
        returnZ: avWalk.z,
        step: fetchErrandTrigger.step,
      };
      avWalk.targetX = avWalk.errand.targetX;
      avWalk.targetZ = avWalk.errand.targetZ;
      s.walkTargetMarker.position.set(avWalk.targetX, 0, avWalk.targetZ);
      s.walkTargetMarker.visible = true;
    } else if (fetchErrandTrigger.type === 'safety') {
      avWalk.errand = {
        type: 'fetch_safety',
        phase: 'to_station',
        targetX: s.supplyStations.safetyRackPos.x - 0.5,
        targetZ: s.supplyStations.safetyRackPos.z + 0.9,
        returnX: avWalk.x,
        returnZ: avWalk.z,
      };
      avWalk.targetX = avWalk.errand.targetX;
      avWalk.targetZ = avWalk.errand.targetZ;
      s.walkTargetMarker.position.set(avWalk.targetX, 0, avWalk.targetZ);
      s.walkTargetMarker.visible = true;
    }
  }, [fetchErrandTrigger]);

  // Trigger Pouring Stream Visual when an ingredient is poured
  useEffect(() => {
    if (pourStepTrigger.count === 0) return;
    const s = sceneRefs.current;
    const colorMap: Record<string, string> = {
      peroxide: '#38bdf8',
      soap: '#34d399',
      orbeez: '#c084fc',
      catalyst: '#f59e0b',
    };
    s.reactionState.pourColorHex = colorMap[pourStepTrigger.step] || '#38bdf8';
    s.reactionState.pourTimer = 0.65;
  }, [pourStepTrigger]);

  // Trigger Reaction Eruption
  useEffect(() => {
    if (eruptionTriggerCount === 0) return;
    const s = sceneRefs.current;
    s.reactionState.isRunning = true;
    s.reactionState.elapsed = 0;
    s.reactionState.isCleaningUp = false;
    s.reactionState.autoPhotoTakenForRun = false;
  }, [eruptionTriggerCount]);

  // Trigger Water Hose Cleanup (Washes away all collected ground foam!)
  useEffect(() => {
    if (cleanupTriggerCount === 0) return;
    const s = sceneRefs.current;
    s.reactionState.isRunning = false;
    s.reactionState.isCleaningUp = true;
    s.reactionState.cleanupElapsed = 0;
  }, [cleanupTriggerCount]);

  return (
    <>
      {/* Dedicated Isolated WebGL Canvas Mount Container */}
      <div
        ref={canvasMountRef}
        className="fixed inset-0 w-screen h-screen overflow-hidden z-0 cursor-pointer"
        aria-label="Interactive 3D Elephant's Toothpaste Science World Viewport"
      />

      {/* Superimposed 3D-Tracked AR Measurement Layer (Sibling to WebGL Canvas) */}
      <div className="pointer-events-none fixed inset-0 z-10 overflow-hidden select-none">
        {/* 1. AR Plume Apex Laser Tracker */}
        <div
          ref={arApexBadgeRef}
          className="absolute top-0 left-0 -translate-x-1/2 -translate-y-full pb-2 transition-opacity duration-150"
          style={{ opacity: 0, willChange: 'transform' }}
        >
          <div
            className="px-3 py-1.5 rounded-lg border border-amber-400/90 shadow-lg text-center whitespace-nowrap"
            style={{ backgroundColor: 'rgba(9, 13, 22, 0.88)' }}
          >
            <span
              ref={arApexTitleRef}
              className="block text-xs sm:text-sm font-bold font-mono-tabular text-amber-400"
            >
              TARGET HEIGHT: 2.5 m (8 ft)
            </span>
            <span
              ref={arApexSubRef}
              className="block text-[11px] font-semibold text-white"
            >
              Basketball Hoop Height!
            </span>
          </div>
          <div className="mx-auto w-0.5 h-3 bg-amber-400" />
        </div>

        {/* 2. AR Vessel Core Thermal & Speed Readout */}
        <div
          ref={arVesselBadgeRef}
          className="absolute top-0 left-0 translate-x-3 -translate-y-1/2 flex items-center transition-opacity duration-150"
          style={{ opacity: 0, willChange: 'transform' }}
        >
          <div className="w-6 h-px bg-sky-400" />
          <div
            className="px-2.5 py-1 rounded-md border border-sky-400/80 whitespace-nowrap"
            style={{ backgroundColor: 'rgba(9, 13, 22, 0.86)' }}
          >
            <span
              ref={arVesselTempRef}
              className="block text-xs font-bold font-mono-tabular text-rose-400"
            >
              CORE TEMP: 30 °C
            </span>
            <span
              ref={arVesselStatsRef}
              className="block text-[10px] font-mono-tabular text-sky-300"
            >
              FOAM VOL: 0.4 m³ · SPEED: 4.2 m/s
            </span>
          </div>
        </div>

        {/* 3. AR Scientist Standoff Distance & Walk Status */}
        <div
          ref={arAvatarBadgeRef}
          className="absolute top-0 left-0 -translate-x-1/2 -translate-y-full pb-1 transition-opacity duration-150"
          style={{ opacity: 0, willChange: 'transform' }}
        >
          <div
            className="px-2.5 py-1 rounded-md border border-emerald-400/80 whitespace-nowrap"
            style={{ backgroundColor: 'rgba(9, 13, 22, 0.86)' }}
          >
            <span
              ref={arAvatarTextRef}
              className="block text-[11px] font-bold font-mono-tabular text-emerald-300"
            >
              STANDOFF: 6m (Click Floor or WASD to Walk!)
            </span>
          </div>
        </div>

        {/* 3b. AR 3D Chemical Supply Cart Label */}
        <div
          ref={arChemCartBadgeRef}
          className="absolute top-0 left-0 -translate-x-1/2 -translate-y-full pb-1 transition-opacity duration-150"
          style={{ opacity: 0, willChange: 'transform' }}
        >
          <div
            className="px-2 py-0.5 rounded border border-sky-400/60 whitespace-nowrap"
            style={{ backgroundColor: 'rgba(9, 13, 22, 0.82)' }}
          >
            <span className="block text-[10px] font-bold font-mono-tabular text-sky-300">
              🧪 Supply Cart (Click Bottles to Walk & Fetch!)
            </span>
          </div>
        </div>

        {/* 3c. AR 3D Safety Gear Locker Label */}
        <div
          ref={arSafetyRackBadgeRef}
          className="absolute top-0 left-0 -translate-x-1/2 -translate-y-full pb-1 transition-opacity duration-150"
          style={{ opacity: 0, willChange: 'transform' }}
        >
          <div
            className="px-2 py-0.5 rounded border border-amber-400/60 whitespace-nowrap"
            style={{ backgroundColor: 'rgba(9, 13, 22, 0.82)' }}
          >
            <span className="block text-[10px] font-bold font-mono-tabular text-amber-300">
              🥽 Safety Locker (Click to Walk & Equip!)
            </span>
          </div>
        </div>

        {/* 4. AR Vertical Height Ruler Benchmarks */}
        {AR_BENCHMARKS.map((bm, idx) => (
          <div
            key={bm.meters}
            ref={(el) => {
              arBenchmarkRefs.current[idx] = el;
            }}
            className="absolute top-0 left-0 -translate-x-full -translate-y-1/2 pr-2 flex items-center transition-opacity duration-150"
            style={{ opacity: 0, willChange: 'transform' }}
          >
            <span
              className="px-2 py-0.5 rounded text-[10px] font-mono-tabular font-semibold text-sky-200 border border-sky-500/40 whitespace-nowrap"
              style={{ backgroundColor: 'rgba(9, 13, 22, 0.82)' }}
            >
              {bm.label}
            </span>
            <div className="w-2.5 h-px bg-sky-400/80" />
          </div>
        ))}
      </div>
    </>
  );
};
