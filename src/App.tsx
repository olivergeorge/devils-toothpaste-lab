import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FileText, Sparkles } from 'lucide-react';
import {
  CameraPresetId,
  CapturedPhoto,
  ExperimentConfig,
  IngredientStep,
  LabMishap,
  PouredStepRecord,
  ReactionSimulationResult,
  SafetyGearState,
  ScaleEnvironmentId,
  ScienceReport,
} from './types/chemistry';
import {
  DYE_COLORS,
  INGREDIENT_META,
  PRESET_EXPERIMENTS,
  SCALE_ENVIRONMENTS,
  evaluateExperimentMishaps,
  evaluateSafetyHazards,
  simulateReactionPhysics,
} from './utils/chemistryEngine';
import {
  exportReportAsPngCard,
  generateDraftScienceReport,
} from './utils/reportGenerator';
import { soundEngine } from './utils/soundEngine';
import { ThreeViewport } from './components/ThreeViewport';
import { ScienceReportModal } from './components/ScienceReportModal';
import { LiveScienceReportDock } from './components/LiveScienceReportDock';
import { BetPhase, ReactionModelPanel } from './components/ReactionModelPanel';
import { Bet, Stars, defaultBet, explainBiggestCause, scoreBet } from './utils/betScoring';

const STORAGE_KEY_DISCOVERIES = 'elephants_toothpaste_discoveries_v1';

function loadDiscoveries(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DISCOVERIES);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveDiscoveries(list: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY_DISCOVERIES, JSON.stringify(list));
  } catch {
    /* private mode: discoveries just won't persist */
  }
}

const STORAGE_KEY_REPORTS = 'elephants_toothpaste_saved_reports_v1';

function isPointInsideVesselZone(x: number, y: number): boolean {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  return x >= vw * 0.18 && x <= vw * 0.76 && y >= 56 && y <= vh - 92;
}

export default function App() {
  const [scientistName, setScientistName] = useState<string>('CrunchLabs Explorer');
  const [config, setConfig] = useState<ExperimentConfig>(PRESET_EXPERIMENTS[0].config);
  const [safetyGear, setSafetyGear] = useState<SafetyGearState>(PRESET_EXPERIMENTS[0].safetyGear);

  const [activeResult, setActiveResult] = useState<ReactionSimulationResult | null>(null);
  const [eruptionTriggerCount, setEruptionTriggerCount] = useState(0);
  const [cleanupTriggerCount, setCleanupTriggerCount] = useState(0);
  const [pourStepTrigger, setPourStepTrigger] = useState<{ step: string; count: number }>({
    step: 'peroxide',
    count: 0,
  });

  // Unified Pointer-Phrased State 2 Pouring & Spatial Drag State (Mouse, Touch & Pen)
  const [activePhraseStep, setActivePhraseStep] = useState<IngredientStep | null>(null);
  const [pointerPos, setPointerPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [hasDraggedFromBench, setHasDraggedFromBench] = useState(false);
  const [isInsideVesselTarget, setIsInsideVesselTarget] = useState(true);

  const phraseRef = useRef<{
    step: IngredientStep | null;
    startX: number;
    startY: number;
    startTime: number;
    hasDragged: boolean;
    insideTarget: boolean;
    ticksPoured: number;
  }>({
    step: null,
    startX: 0,
    startY: 0,
    startTime: 0,
    hasDragged: false,
    insideTarget: true,
    ticksPoured: 0,
  });

  const configRef = useRef(config);
  configRef.current = config;

  const safetyGearRef = useRef(safetyGear);
  safetyGearRef.current = safetyGear;

  // Hilarious "Soap & Foam in Your Eyes!" Screen Splat State (when Goggles are off!)
  const [soapInEyeActive, setSoapInEyeActive] = useState(false);
  const [soapInEyeReason, setSoapInEyeReason] = useState<string>(
    'You squirted Dish Soap without wearing Splash Goggles!'
  );

  // Mark Rober Live Commentary & 3-2-1 Countdown State
  const [roberQuote, setRoberQuote] = useState<string>(
    'Press & hold any bottle on the bench (or drag it over the 3D container) to pour! Watch out: your Splash Goggles are UNCHECKED—squirting too much soap without goggles will splat soap in your eyes!'
  );
  const [countdownNumber, setCountdownNumber] = useState<number | null>(null);
  const [showArMeasures, setShowArMeasures] = useState<boolean>(true);

  const [isDockCollapsed, setIsDockCollapsed] = useState(false);
  const [cameraPreset, setCameraPreset] = useState<CameraPresetId>('orbit_overview');
  const [isMuted, setIsMuted] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isDownloadingPoster, setIsDownloadingPoster] = useState(false);
  const [photoFlashToast, setPhotoFlashToast] = useState<string | null>(null);

  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  // "Call your shot": bet → running → review
  const [betPhase, setBetPhase] = useState<BetPhase>('bet');
  const [bet, setBet] = useState<Bet>(() => defaultBet(PRESET_EXPERIMENTS[0].config.scaleId));
  const [betTouched, setBetTouched] = useState(false);
  const [elapsedModelS, setElapsedModelS] = useState(0);
  const [cursorS, setCursorS] = useState(0);
  const [betOutcome, setBetOutcome] = useState<{
    stars: Stars;
    sentence: string;
    newDiscovery: boolean;
  } | null>(null);
  // Phones start with the panel folded into its header so it doesn't cover the scene.
  const [isBetPanelCollapsed, setIsBetPanelCollapsed] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < 640
  );
  const discoveriesRef = useRef<string[]>(loadDiscoveries());

  const [savedReports, setSavedReports] = useState<ScienceReport[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_REPORTS);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const snapshotFnRef = useRef<(() => string) | null>(null);

  const handleRegisterSnapshotFn = useCallback((fn: () => string) => {
    snapshotFnRef.current = fn;
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        isReportModalOpen
      ) {
        return;
      }
      if (e.key.toLowerCase() === 'h') {
        setIsDockCollapsed((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isReportModalOpen]);

  const predictedResult = useMemo(() => simulateReactionPhysics(config), [config]);

  // Changing the recipe after a run starts a new round: clear the curves, keep the rocket where it was.
  const betPhaseRef = useRef(betPhase);
  betPhaseRef.current = betPhase;
  useEffect(() => {
    if (betPhaseRef.current === 'review') {
      setBetPhase('bet');
      setBetTouched(false);
      setBetOutcome(null);
    }
  }, [config]);

  // A new rig has a different height scale, so re-centre the rocket.
  useEffect(() => {
    setBet(defaultBet(config.scaleId));
    setBetTouched(false);
  }, [config.scaleId]);
  const safetyAssessment = useMemo(
    () => evaluateSafetyHazards(config, safetyGear),
    [config, safetyGear]
  );

  const activeMishaps: LabMishap[] = useMemo(
    () => evaluateExperimentMishaps(config, safetyGear, activeResult || predictedResult),
    [config, safetyGear, activeResult, predictedResult]
  );

  // Switch Scale Environment from Top Bar
  const handleSelectScale = (scaleId: ScaleEnvironmentId) => {
    soundEngine.playUiClick(580);
    const recommendedDist = SCALE_ENVIRONMENTS[scaleId].recommendedDistanceMeters;
    setActiveResult(null);
    setConfig((prev) => ({
      ...prev,
      scaleId,
      includeOrbeez:
        scaleId === 'steel_flask' || scaleId === 'outdoor_crater' ? true : prev.includeOrbeez,
    }));
    setSafetyGear((prev) => ({
      ...prev,
      standBackMeters: Math.max(prev.standBackMeters, recommendedDist),
    }));

    if (scaleId === 'lab_beaker') {
      setRoberQuote(
        'Aim updated to the 2L Lab Beaker! Hold or drag Peroxide, Soap, and Catalyst into the beaker to measure your mix!'
      );
    } else if (scaleId === 'kiddie_pool') {
      setRoberQuote(
        'Aim updated to the 450L Backyard Kiddie Pool! Look—Phat Gus the Squirrel is wearing his mini safety goggles on the tree stump!'
      );
    } else if (scaleId === 'steel_flask') {
      setRoberQuote(
        'Aim updated to the 2,200L Giant Steel Volcano! Pour Orbeez beads into the cone to boost the foam jet height!'
      );
    } else {
      setRoberQuote(
        'Aim updated to the 5,000L DEVIL’S TOOTHPASTE CRATER! Don’t forget your Goggles & Hazmat Suit or you’ll turn into a Foam Snowman!'
      );
    }
  };

  // Update chemical parameters
  const handleUpdateConfig = (partial: Partial<ExperimentConfig>) => {
    soundEngine.playUiClick(540);
    setActiveResult(null);
    setConfig((prev) => {
      const next = { ...prev, ...partial };
      if (partial.peroxideConcentration === 50) {
        setRoberQuote(
          '50% DEVIL’S TOOTHPASTE GRADE! That is 16× stronger than store peroxide—if you only pour a tiny bit of soap (<28 mL/L), it’ll flash straight to >100°C STEAM!'
        );
      }
      return next;
    });
  };

  // Toggle individual Safety Checkboxes
  const handleToggleSafetyGear = (key: keyof SafetyGearState) => {
    soundEngine.playUiClick(560);
    setSafetyGear((prev) => {
      if (key === 'standBackMeters') return prev;
      const nextVal = !prev[key];
      if (key === 'goggles' && nextVal) {
        setSoapInEyeActive(false);
        setRoberQuote(
          'Splash Goggles ON! Your eyes are now protected from flying dish soap and foam!'
        );
      } else if (key === 'goggles' && !nextVal) {
        setRoberQuote(
          'Uh oh! You took off your Splash Goggles! Watch out for flying soap bubbles!'
        );
      } else if (key === 'gloves' && nextVal) {
        setRoberQuote('Nitrile Gloves ON! No more Smurf-stained fingers!');
      }
      return {
        ...prev,
        [key]: nextVal,
      };
    });
  };

  // Incrementally pour a step (either continuous tick during State 2 hold/drag or 1 discrete scoop on tap)
  const applyIncrementalPour = useCallback(
    (step: IngredientStep, isQuickTapScoop: boolean) => {
      setActiveResult(null);
      setPourStepTrigger((prev) => ({ step, count: prev.count + 1 }));

      setConfig((prev) => {
        const alreadyAdded = prev.additionOrder.includes(step);
        const nextOrder = alreadyAdded ? prev.additionOrder : [...prev.additionOrder, step];

        let nextPeroxideVol = prev.peroxideVolumePercent;
        let nextSoapMl = prev.soapVolumeMlPerLiter;
        let nextOrbeezCount = prev.orbeezCount || 0;
        let nextCatalystRatio = prev.catalystRatio;
        let nextIncludeOrbeez = prev.includeOrbeez;

        if (step === 'peroxide') {
          const delta = isQuickTapScoop ? 25 : 5;
          nextPeroxideVol = alreadyAdded
            ? Math.min(125, prev.peroxideVolumePercent + delta)
            : isQuickTapScoop
            ? 25
            : 10;
          soundEngine.playPourPulse('peroxide', nextPeroxideVol / 100);
        } else if (step === 'soap') {
          const delta = isQuickTapScoop ? 22 : 4;
          nextSoapMl = alreadyAdded
            ? Math.min(110, prev.soapVolumeMlPerLiter + delta)
            : isQuickTapScoop
            ? 22
            : 8;
          soundEngine.playPourPulse('soap', nextSoapMl / 90);
        } else if (step === 'orbeez') {
          nextIncludeOrbeez = true;
          const delta = isQuickTapScoop ? 2500 : 500;
          nextOrbeezCount = alreadyAdded
            ? Math.min(10000, (prev.orbeezCount || 0) + delta)
            : isQuickTapScoop
            ? 2500
            : 500;
          soundEngine.playPourPulse('orbeez', nextOrbeezCount / 10000);
        } else if (step === 'catalyst') {
          const delta = isQuickTapScoop ? 35 : 7;
          nextCatalystRatio = alreadyAdded
            ? Math.min(100, prev.catalystRatio + delta)
            : isQuickTapScoop
            ? 35
            : 14;
          soundEngine.playPourPulse('catalyst', nextCatalystRatio / 100);
        }

        return {
          ...prev,
          peroxideVolumePercent: nextPeroxideVol,
          soapVolumeMlPerLiter: nextSoapMl,
          orbeezCount: nextOrbeezCount,
          catalystRatio: nextCatalystRatio,
          includeOrbeez: nextIncludeOrbeez,
          additionOrder: nextOrder,
        };
      });
    },
    []
  );

  // Commit the completed phrase to the Science Report Method Log when State 2 muscle tension releases!
  const commitCompletedPhraseToReport = useCallback((step: IngredientStep) => {
    const cur = configRef.current;
    const gear = safetyGearRef.current;
    const scale = SCALE_ENVIRONMENTS[cur.scaleId];
    let logLabel = '';

    if (step === 'peroxide') {
      const liters = ((scale.vesselCapacityLiters * cur.peroxideVolumePercent) / 100).toFixed(1);
      logLabel = `Measured ${liters} L (${cur.peroxideVolumePercent}% full) of ${cur.peroxideConcentration}% H₂O₂${
        cur.peroxideVolumePercent > 100 ? ' [OVERFLOWING RIM!]' : ''
      }`;
      if (cur.peroxideVolumePercent > 100) {
        setRoberQuote(
          `WHOA! ${cur.peroxideVolumePercent}% FULL! You poured ${liters} L into a ${scale.vesselCapacityLiters} L container—peroxide is sloshing over the rim!`
        );
      } else {
        setRoberQuote(
          `Measured ${liters} L (${cur.peroxideVolumePercent}% full) of ${cur.peroxideConcentration}% Hydrogen Peroxide into the ${scale.name}!`
        );
      }
    } else if (step === 'soap') {
      const status =
        cur.soapVolumeMlPerLiter < 28
          ? 'Too Little — Steam Risk!'
          : cur.soapVolumeMlPerLiter <= 58
          ? 'Golden Ratio Sweet Spot!'
          : cur.soapVolumeMlPerLiter < 75
          ? 'Extra Bubbly!'
          : 'SOAP OVERDOSE! (Slime Slug!)';
      logLabel = `Squirted ${cur.soapVolumeMlPerLiter} mL/L Dish Soap (${status})`;

      if (cur.soapVolumeMlPerLiter >= 75) {
        soundEngine.playSlimeBurpSound();
        setRoberQuote(
          `BWAHAHA! ${cur.soapVolumeMlPerLiter} mL/L OF DISH SOAP?! Science Bob warned us: that much soap will turn the eruption into a heavy, slow-oozing SLIME SLUG!`
        );
      } else if (cur.soapVolumeMlPerLiter < 28) {
        setRoberQuote(
          `Measured ${cur.soapVolumeMlPerLiter} mL/L Dish Soap! Careful: if you use 50% Peroxide with <28 mL/L soap, it flashes straight to >100°C STEAM!`
        );
      } else {
        setRoberQuote(
          `SWEET SPOT! ${cur.soapVolumeMlPerLiter} mL/L of Dish Soap—right in Science Bob’s Golden Ratio for maximum foam height!`
        );
      }

      // Funny Mistake: Squirting soap without Splash Goggles -> SPLAT! Soap in Eye!
      if (!gear.goggles && cur.soapVolumeMlPerLiter >= 40) {
        soundEngine.playSoapSplatSound();
        setSoapInEyeReason(
          `You squirted ${cur.soapVolumeMlPerLiter} mL/L of Dish Soap with NO Splash Goggles on, and soap bubbles splattered right into your eyes!`
        );
        setSoapInEyeActive(true);
      }
    } else if (step === 'orbeez') {
      logLabel = `Measured ${(cur.orbeezCount || 2500).toLocaleString()} Orbeez Water Beads`;
      setRoberQuote(
        `BOING! Measured ${(cur.orbeezCount || 2500).toLocaleString()} squishy Orbeez beads into the container!`
      );
    } else if (step === 'catalyst') {
      const catName =
        cur.catalystType === 'potassium_iodide' ? 'Potassium Iodide' : 'Warm Yeast';
      const beforeSoap = !cur.additionOrder.includes('soap');
      logLabel = `Measured ${cur.catalystRatio}% ${catName} Catalyst${
        beforeSoap ? ' [BEFORE SOAP — MISTAKE!]' : ''
      }`;
      if (beforeSoap) {
        setRoberQuote(
          `HOLD EVERYTHING! You poured ${catName} BEFORE Dish Soap! Hit SEND IT to see why all the oxygen boils away without soap!`
        );
      } else {
        setRoberQuote(
          `Measured ${cur.catalystRatio}% ${catName} Catalyst! Hit SEND IT to test your mix!`
        );
      }
    }

    const newRecord: PouredStepRecord = {
      id: `pour_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      step,
      amountLabel: logLabel,
      timestamp: new Date().toLocaleTimeString([], { minute: '2-digit', second: '2-digit' }),
    };

    setConfig((prev) => ({
      ...prev,
      pouredLog: [...(prev.pouredLog || []), newRecord],
    }));
  }, []);

  // Begin State 2 Pouring Phrase on PointerDown
  const handleBeginPourPhrase = (step: IngredientStep, e: React.PointerEvent) => {
    const clientX = e.clientX || window.innerWidth / 2;
    const clientY = e.clientY || window.innerHeight - 40;
    phraseRef.current = {
      step,
      startX: clientX,
      startY: clientY,
      startTime: performance.now(),
      hasDragged: false,
      insideTarget: true,
      ticksPoured: 0,
    };
    setPointerPos({ x: clientX, y: clientY });
    setHasDraggedFromBench(false);
    setIsInsideVesselTarget(true);
    setActivePhraseStep(step);
  };

  // Global State 2 Pointer Tracking, Continuous Pour Interval, & Honest Release Handler
  useEffect(() => {
    if (!activePhraseStep) return;

    const handlePointerMove = (e: PointerEvent) => {
      const p = phraseRef.current;
      if (!p.step) return;
      setPointerPos({ x: e.clientX, y: e.clientY });

      const dist = Math.hypot(e.clientX - p.startX, e.clientY - p.startY);
      if (dist > 24 && !p.hasDragged) {
        p.hasDragged = true;
        setHasDraggedFromBench(true);
      }

      if (p.hasDragged) {
        const inside = isPointInsideVesselZone(e.clientX, e.clientY);
        p.insideTarget = inside;
        setIsInsideVesselTarget(inside);
      }
    };

    const pourInterval = window.setInterval(() => {
      const p = phraseRef.current;
      if (!p.step) return;
      const elapsed = performance.now() - p.startTime;

      // Pour continuously if either:
      // (a) Held stationary on the bench bottle for > 160ms, OR
      // (b) Dragged upward into the honest 3D Vessel Target Zone!
      const shouldPourTick = (!p.hasDragged && elapsed >= 160) || (p.hasDragged && p.insideTarget);
      if (shouldPourTick) {
        p.ticksPoured += 1;
        applyIncrementalPour(p.step, false);
      }
    }, 115);

    const handlePointerUpOrCancel = () => {
      const p = phraseRef.current;
      const finishedStep = p.step;
      if (!finishedStep) return;

      // Honest Release Rule:
      // - If the user tapped quickly without dragging away, pour 1 standard scoop and commit.
      // - If the user dragged into the vessel or held to pour (`ticksPoured > 0`) AND is inside the target on release, commit the phrase!
      // - If the user dragged OUTSIDE the vessel target (`p.hasDragged && !p.insideTarget`) with 0 ticks poured, cancel honestly!
      if (!p.hasDragged && p.ticksPoured === 0) {
        applyIncrementalPour(finishedStep, true);
        setTimeout(() => commitCompletedPhraseToReport(finishedStep), 20);
      } else if (p.ticksPoured > 0) {
        setTimeout(() => commitCompletedPhraseToReport(finishedStep), 20);
      } else {
        soundEngine.playUiClick(340);
        setRoberQuote(
          `Pour cancelled—you released the ${INGREDIENT_META[finishedStep].shortLabel} bottle outside the container!`
        );
      }

      phraseRef.current.step = null;
      setActivePhraseStep(null);
      setHasDraggedFromBench(false);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUpOrCancel);
    window.addEventListener('pointercancel', handlePointerUpOrCancel);

    return () => {
      window.clearInterval(pourInterval);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUpOrCancel);
      window.removeEventListener('pointercancel', handlePointerUpOrCancel);
    };
  }, [activePhraseStep, applyIncrementalPour, commitCompletedPhraseToReport]);

  // Empty Container to 0 L so the child can measure everything from scratch!
  const handleEmptyContainer = () => {
    soundEngine.playUiClick(420);
    setActiveResult(null);
    setCleanupTriggerCount((c) => c + 1);
    setConfig((prev) => ({
      ...prev,
      peroxideVolumePercent: 0,
      soapVolumeMlPerLiter: 0,
      orbeezCount: 0,
      catalystRatio: 0,
      includeOrbeez: false,
      additionOrder: [],
      pouredLog: [],
    }));
    setRoberQuote(
      'Container emptied to 0 L! Hold or drag any bottle on the bottom bench to measure in a fresh mix (or hit SEND IT on an empty container!).'
    );
  };

  const handleApplyPreset = (presetId: string) => {
    const found = PRESET_EXPERIMENTS.find((p) => p.id === presetId);
    if (!found) return;
    soundEngine.playUiClick(640);
    setConfig({
      ...found.config,
      additionOrder: [...found.config.additionOrder],
      pouredLog: found.config.pouredLog ? [...found.config.pouredLog] : [],
    });
    setSafetyGear({ ...found.safetyGear });
    setActiveResult(null);
    setSoapInEyeActive(false);
    setRoberQuote(
      `Loaded "${found.name}"! Hold or drag bottles to adjust the amounts or uncheck Goggles to see what happens!`
    );
  };

  const handleEquipAllRequiredPpe = () => {
    soundEngine.playUiClick(720);
    setSoapInEyeActive(false);
    setSafetyGear({
      goggles: true,
      gloves: true,
      hazmatSuit:
        safetyAssessment.requiresHazmat || config.peroxideConcentration >= 25,
      remoteTriggerArmed:
        safetyAssessment.requiresRemoteTrigger || config.peroxideConcentration >= 25,
      standBackMeters: Math.max(
        safetyGear.standBackMeters,
        safetyAssessment.minSafeDistanceMeters
      ),
    });
    setRoberQuote(
      'All Safety Equipment checked! Goggles, Gloves, and Hazmat Suit are equipped on your 3D Scientist!'
    );
  };

  // Snap Live 3D Photo
  const handleSnapLivePhoto = useCallback((): CapturedPhoto | null => {
    if (!snapshotFnRef.current) return null;
    soundEngine.playUiClick(880);
    const dataUrl = snapshotFnRef.current();
    const currentSim = activeResult || predictedResult;
    const newPhoto: CapturedPhoto = {
      id: `photo_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      dataUrl,
      caption: `${SCALE_ENVIRONMENTS[config.scaleId].name} — ${config.peroxideConcentration}% Peroxide (${currentSim.peakHeightMeters}m)`,
      timestamp: new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
      scaleId: config.scaleId,
      peakHeightMeters: currentSim.peakHeightMeters,
    };
    setPhotos((prev) => [newPhoto, ...prev]);
    setPhotoFlashToast('3D Photo Added to Your Live Science Report!');
    setTimeout(() => setPhotoFlashToast(null), 2200);
    return newPhoto;
  }, [activeResult, predictedResult, config.scaleId, config.peroxideConcentration]);

  const handleAutoPhotoCaptured = useCallback(
    (dataUrl: string, caption: string) => {
      const currentSim = activeResult || predictedResult;
      const autoPhoto: CapturedPhoto = {
        id: `auto_${Date.now()}`,
        dataUrl,
        caption,
        timestamp: new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
        scaleId: config.scaleId,
        peakHeightMeters: currentSim.peakHeightMeters,
      };
      setPhotos((prev) => [autoPhoto, ...prev.slice(0, 7)]);
    },
    [activeResult, predictedResult, config.scaleId]
  );

  // Execute the actual reaction after 3-2-1 countdown (NO forced auto-fill!)
  const executeReactionNow = (activeConfig: ExperimentConfig) => {
    const result = simulateReactionPhysics(activeConfig);
    setActiveResult(result);
    setEruptionTriggerCount((c) => c + 1);

    // Score the bet now; the panel reveals it once the curve has finished drawing.
    const series = result.timeSeries;
    const { stars } = scoreBet(
      bet,
      { tPeakS: series?.timeToPeakS ?? 0, heightM: result.peakHeightMeters },
      activeConfig.scaleId
    );
    const newDiscovery = !discoveriesRef.current.includes(result.outcomeMode);
    if (newDiscovery) {
      discoveriesRef.current = [...discoveriesRef.current, result.outcomeMode];
      saveDiscoveries(discoveriesRef.current);
    }
    setBetOutcome({ stars, sentence: explainBiggestCause(activeConfig, result), newDiscovery });
    setElapsedModelS(0);
    setCursorS(series?.timeToPeakS ?? 0);
    setBetPhase('running');

    const mishaps = evaluateExperimentMishaps(activeConfig, safetyGear, result);

    if (mishaps.some((m) => m.id === 'soap_in_eye')) {
      soundEngine.playSoapSplatSound();
      setSoapInEyeReason(
        `You launched ${result.outcomeTitle} WITHOUT Splash Goggles! Warm soapy foam splattered right into your eyes!`
      );
      setSoapInEyeActive(true);
    }

    if (
      result.outcomeMode === 'empty_vessel_crickets' ||
      result.outcomeMode === 'no_catalyst_unreacted' ||
      result.outcomeMode === 'no_peroxide_dud' ||
      result.outcomeMode === 'only_soap_bubble_bath'
    ) {
      soundEngine.playCricketChirpSound();
    } else if (result.outcomeMode === 'sluggish_soap_sludge') {
      soundEngine.playSlimeBurpSound();
      const intensity = Math.min(1, result.peakHeightMeters / 25);
      soundEngine.playEruptionSound(intensity, false, result.durationSeconds);
    } else {
      const intensity = Math.min(1, result.peakHeightMeters / 25);
      const isSteamFlash =
        result.outcomeMode === 'steam_flash_vaporization' ||
        result.outcomeMode === 'catalyst_first_fizz_boiloff';
      soundEngine.playEruptionSound(intensity, isSteamFlash, result.durationSeconds);
    }

    if (result.outcomeMode === 'empty_vessel_crickets') {
      setRoberQuote(
        '*CRICKETS CHIRPING* 🦗 You pulled the lever on an EMPTY container! Your Science Report just logged "0 m — Forgot to Pour Anything!"'
      );
    } else if (result.outcomeMode === 'only_soap_bubble_bath') {
      setRoberQuote(
        'BUBBLE BATH FAIL! 🫧 You only measured in Dish Soap with zero Peroxide or Catalyst! Your Science Report logged a squeaky dishwater puddle!'
      );
    } else if (result.outcomeMode === 'no_peroxide_dud') {
      setRoberQuote(
        'ZERO BOOM! You forgot to pour the Hydrogen Peroxide fuel! Without H₂O₂, there is no extra oxygen atom to release!'
      );
    } else if (result.outcomeMode === 'no_catalyst_unreacted') {
      setRoberQuote(
        '*CRICKETS CHIRPING* 🦗 You measured in Peroxide and Soap, but forgot to drop the Catalyst! At this speed it’ll take 6 months to bubble!'
      );
    } else if (result.outcomeMode === 'catalyst_first_fizz_boiloff') {
      setRoberQuote(
        'ORDER MISTAKE LOGGED! Because Catalyst went in BEFORE Dish Soap, the oxygen gas boiled away before soap bubbles could trap it!'
      );
    } else if (result.outcomeMode === 'steam_flash_vaporization') {
      setRoberQuote(
        `BWAHAHA! At ${result.peakTempCelsius}°C with only ${activeConfig.soapVolumeMlPerLiter} mL/L soap, it got SO hot it flashed straight into a STEAM GEYSER!`
      );
    } else if (result.outcomeMode === 'sluggish_soap_sludge') {
      setRoberQuote(
        `SLIME SLUG OVERDOSE! Because you squirted ${activeConfig.soapVolumeMlPerLiter} mL/L of Dish Soap, the extra soap weighed down the foam into slow lava sludge!`
      );
    } else if (mishaps.some((m) => m.id === 'foam_snowman_buried')) {
      setRoberQuote(
        `BURIED IN FOAM! ⛄ ${result.peakHeightMeters}m eruption without a Hazmat Suit—look at your 3D Scientist, they turned into a giant Foam Snowman!`
      );
    } else if (
      result.outcomeMode === 'devils_toothpaste_detonation' ||
      result.outcomeMode === 'colossal_volcano_eruption'
    ) {
      soundEngine.playVictoryFanfare();
      setRoberQuote(
        `SWEET MOTHER OF SCIENCE!! ${result.peakHeightMeters} METERS HIGH! Your Science Report automatically updated with the real amounts and results!`
      );
    } else {
      setRoberQuote(
        `AWESOME ERUPTION! ${result.peakHeightMeters}m tall and ${result.peakTempCelsius}°C! Check the right-hand Science Report—updated with what really happened!`
      );
    }
  };

  const handlePlaybackTick = useCallback((modelT: number, done: boolean) => {
    setElapsedModelS(modelT);
    if (done) setBetPhase((p) => (p === 'running' ? 'review' : p));
  }, []);

  const handleTriggerEruption = () => {
    if (countdownNumber !== null) return;

    if (!safetyAssessment.isCompliant) {
      soundEngine.playSafetyAlert();
    }

    setCountdownNumber(3);
    soundEngine.playCountdownBeep(false);
    setRoberQuote('Testing what you measured in... 3...');

    setTimeout(() => {
      setCountdownNumber(2);
      soundEngine.playCountdownBeep(false);
      setRoberQuote('Hold onto your goggles, Phat Gus... 2...');
    }, 320);

    setTimeout(() => {
      setCountdownNumber(1);
      soundEngine.playCountdownBeep(false);
      setRoberQuote('Dumping trough... 1...');
    }, 640);

    setTimeout(() => {
      setCountdownNumber(null);
      soundEngine.playCountdownBeep(true);
      executeReactionNow(config);
    }, 960);
  };

  const handleHoseCleanup = () => {
    soundEngine.playHoseCleanup();
    setCleanupTriggerCount((c) => c + 1);
    setActiveResult(null);
    setBetPhase('bet');
    setBetTouched(false);
    setBetOutcome(null);
    setSoapInEyeActive(false);
    setRoberQuote(
      'Hosing down the foam and washing off your 3D Scientist! Ready to measure a new experiment!'
    );
  };

  const handleSaveReport = (report: ScienceReport) => {
    setSavedReports((prev) => {
      const exists = prev.some((r) => r.id === report.id);
      const updated = exists
        ? prev.map((r) => (r.id === report.id ? report : r))
        : [report, ...prev];
      try {
        localStorage.setItem(STORAGE_KEY_REPORTS, JSON.stringify(updated));
      } catch {
        // Ignore
      }
      return updated;
    });
  };

  const handleDeleteSavedReport = (id: string) => {
    setSavedReports((prev) => {
      const updated = prev.filter((r) => r.id !== id);
      try {
        localStorage.setItem(STORAGE_KEY_REPORTS, JSON.stringify(updated));
      } catch {
        // Ignore
      }
      return updated;
    });
  };

  const draftReport = useMemo(
    () =>
      generateDraftScienceReport(
        config,
        safetyGear,
        activeResult || predictedResult,
        photos,
        scientistName
      ),
    [config, safetyGear, activeResult, predictedResult, photos, scientistName]
  );

  const handleQuickDownloadPoster = async () => {
    setIsDownloadingPoster(true);
    try {
      let currentPhotos = photos;
      if (currentPhotos.length === 0 && snapshotFnRef.current) {
        const snapped = handleSnapLivePhoto();
        if (snapped) currentPhotos = [snapped];
      }
      const reportToExport = generateDraftScienceReport(
        config,
        safetyGear,
        activeResult || predictedResult,
        currentPhotos,
        scientistName
      );
      handleSaveReport(reportToExport);
      const pngUrl = await exportReportAsPngCard(reportToExport);
      if (pngUrl) {
        const a = document.createElement('a');
        a.href = pngUrl;
        a.download = `elephants-toothpaste-report-${config.scaleId}.png`;
        a.click();
      }
    } finally {
      setIsDownloadingPoster(false);
    }
  };

  const scaleSpec = SCALE_ENVIRONMENTS[config.scaleId];
  const measuredLiters = config.additionOrder.includes('peroxide')
    ? ((scaleSpec.vesselCapacityLiters * config.peroxideVolumePercent) / 100).toFixed(1)
    : '0';

  const isPouringActiveNow =
    activePhraseStep !== null && (!hasDraggedFromBench || isInsideVesselTarget);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 text-slate-100 select-none">
      {/* 1. Full-Viewport 3D WebGL Scene + Staged AR Measurement Overlay */}
      <ThreeViewport
        config={config}
        safetyGear={safetyGear}
        activeResult={activeResult}
        predictedResult={predictedResult}
        eruptionTriggerCount={eruptionTriggerCount}
        cleanupTriggerCount={cleanupTriggerCount}
        pourStepTrigger={pourStepTrigger}
        cameraPreset={cameraPreset}
        showArMeasures={showArMeasures}
        onRegisterSnapshotFn={handleRegisterSnapshotFn}
        onAutoPhotoCaptured={handleAutoPhotoCaptured}
        onPlaybackTick={handlePlaybackTick}
        scrubModelS={betPhase === 'review' ? cursorS : null}
      />

      {/* Call Your Shot: bet on the foam, watch the real curve race it, replay what happened inside */}
      <ReactionModelPanel
        scaleId={config.scaleId}
        phase={betPhase}
        bet={bet}
        betTouched={betTouched}
        onBetChange={(b) => {
          setBet(b);
          setBetTouched(true);
        }}
        series={betPhase === 'bet' ? null : activeResult?.timeSeries ?? null}
        elapsedModelS={elapsedModelS}
        cursorS={cursorS}
        onCursorChange={setCursorS}
        stars={betOutcome?.stars ?? null}
        sentence={betOutcome?.sentence ?? null}
        newDiscovery={betOutcome?.newDiscovery ?? false}
        collapsed={isBetPanelCollapsed}
        onToggleCollapsed={() => setIsBetPanelCollapsed((v) => !v)}
      />

      {/* State 2 Honest Spatial Vessel Target & Live Graduated Pouring Gauge (Staged ONLY during active Pour Phrase!) */}
      {activePhraseStep && (
        <>
          {/* Honest Spatial Boundary over the 3D Container */}
          <div
            className={`pointer-events-none fixed left-[18vw] right-[24vw] top-16 bottom-24 z-30 rounded-3xl border-2 border-dashed transition-colors flex flex-col items-center justify-between p-4 ${
              isPouringActiveNow
                ? 'border-emerald-400/90 bg-emerald-500/5'
                : 'border-rose-400/80 bg-rose-500/5'
            }`}
          >
            <div
              className="px-4 py-2 rounded-xl border border-slate-700 shadow-2xl text-center"
              style={{ backgroundColor: 'rgba(9, 13, 22, 0.92)' }}
            >
              <div
                className={`text-xs font-bold font-mono-tabular ${
                  isPouringActiveNow ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {isPouringActiveNow
                  ? `POURING ${INGREDIENT_META[activePhraseStep].label.toUpperCase()} INTO ${scaleSpec.name.toUpperCase()}...`
                  : 'OUTSIDE CONTAINER — MOVE BACK INSIDE TO POUR (OR RELEASE TO CANCEL)'}
              </div>
              <div className="text-sm font-extrabold text-white mt-0.5 font-mono-tabular">
                {activePhraseStep === 'peroxide' &&
                  `Volume: ${measuredLiters} L (${config.peroxideVolumePercent}% full)${
                    config.peroxideVolumePercent > 100 ? ' — OVERFLOWING RIM!' : ''
                  }`}
                {activePhraseStep === 'soap' &&
                  `Dish Soap: ${config.soapVolumeMlPerLiter} mL/L ${
                    config.soapVolumeMlPerLiter < 28
                      ? '(LOW — STEAM FLASH ZONE)'
                      : config.soapVolumeMlPerLiter <= 58
                      ? '(★ GOLDEN RATIO SWEET SPOT ★)'
                      : config.soapVolumeMlPerLiter >= 75
                      ? '(⚠️ SLIME SLUG OVERDOSE!)'
                      : '(EXTRA BUBBLY)'
                  }`}
                {activePhraseStep === 'orbeez' &&
                  `Orbeez Beads: ${(config.orbeezCount || 0).toLocaleString()} beads`}
                {activePhraseStep === 'catalyst' &&
                  `Catalyst Load: ${config.catalystRatio}% (${
                    config.catalystType === 'potassium_iodide' ? 'Potassium Iodide' : 'Warm Yeast'
                  })`}
              </div>

              {/* Graduated Cylinder Bar with Sweet Spot & Overdose Zones */}
              <div className="w-64 h-3 bg-slate-900 rounded-full overflow-hidden border border-slate-700 mt-1.5 relative">
                {activePhraseStep === 'soap' && (
                  <div
                    className="absolute inset-y-0 bg-emerald-400/25 border-x border-emerald-400"
                    style={{ left: '29%', width: '24%' }}
                    title="Golden Ratio Sweet Spot (32-58 mL/L)"
                  />
                )}
                <div
                  className="h-full transition-all duration-75"
                  style={{
                    width: `${
                      activePhraseStep === 'peroxide'
                        ? Math.min(100, (config.peroxideVolumePercent / 125) * 100)
                        : activePhraseStep === 'soap'
                        ? Math.min(100, (config.soapVolumeMlPerLiter / 110) * 100)
                        : activePhraseStep === 'orbeez'
                        ? Math.min(100, ((config.orbeezCount || 0) / 10000) * 100)
                        : Math.min(100, config.catalystRatio)
                    }%`,
                    backgroundColor: INGREDIENT_META[activePhraseStep].color,
                  }}
                />
              </div>
              <div className="text-[10px] text-slate-400 mt-1">
                Hold tension to keep pouring · Release to lock in amount
              </div>
            </div>
          </div>

          {/* Tilted Pouring Bottle Follower attached to Pointer */}
          <div
            className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2 px-3 py-1.5 rounded-xl border-2 shadow-2xl font-bold text-xs whitespace-nowrap transition-transform"
            style={{
              left: pointerPos.x,
              top: pointerPos.y - 28,
              backgroundColor: 'rgba(15, 23, 42, 0.95)',
              borderColor: INGREDIENT_META[activePhraseStep].color,
              color: '#ffffff',
              transform: `translate(-50%, -50%) rotate(${isPouringActiveNow ? '-28deg' : '0deg'})`,
            }}
          >
            🧪 {INGREDIENT_META[activePhraseStep].shortLabel}{' '}
            {isPouringActiveNow ? '💧 Pouring...' : '⏸ Paused'}
          </div>
        </>
      )}

      {/* Hilarious "SPLAT! SOAP & FOAM IN YOUR EYES!" Overlay when Splash Goggles are forgotten! */}
      {soapInEyeActive && (
        <div className="fixed inset-0 z-40 pointer-events-auto flex flex-col items-center justify-center p-4">
          <div
            className="pointer-events-none absolute -top-12 -left-12 w-72 h-72 rounded-full opacity-85"
            style={{
              backgroundColor: DYE_COLORS[config.dyeColor].hex,
              border: '8px solid rgba(255,255,255,0.8)',
            }}
          />
          <div
            className="pointer-events-none absolute top-8 right-6 w-64 h-64 rounded-full opacity-85"
            style={{
              backgroundColor: '#34d399',
              border: '8px solid rgba(255,255,255,0.85)',
            }}
          />
          <div
            className="pointer-events-none absolute bottom-24 left-12 w-80 h-60 rounded-full opacity-85"
            style={{
              backgroundColor: '#f8fafc',
              border: '6px solid #38bdf8',
            }}
          />
          <div
            className="pointer-events-none absolute bottom-16 right-12 w-72 h-72 rounded-full opacity-85"
            style={{
              backgroundColor: DYE_COLORS[config.dyeColor].hex,
              border: '8px solid rgba(255,255,255,0.85)',
            }}
          />

          <div
            className="relative z-10 max-w-md w-full rounded-2xl border-2 border-amber-400 p-5 text-center shadow-2xl space-y-3"
            style={{ backgroundColor: 'rgba(9, 13, 22, 0.96)' }}
          >
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-rose-500/20 border border-rose-400/60 text-rose-300 text-xs font-bold font-mono-tabular">
              <Sparkles className="w-3.5 h-3.5" />
              LAB BLOOPER ADDED TO YOUR SCIENCE REPORT!
            </div>
            <h2 className="text-2xl font-extrabold font-display text-white">
              🫧👀 SPLAT! SOAP IN YOUR EYES!
            </h2>
            <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
              {soapInEyeReason} Everything looks blurry and squeaky!
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  soundEngine.playUiClick(740);
                  setSoapInEyeActive(false);
                  setSafetyGear((prev) => ({ ...prev, goggles: true }));
                  setRoberQuote(
                    'Phew! Eyes wiped clean and Splash Goggles strapped on! That blooper was recorded in your Science Report!'
                  );
                }}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs sm:text-sm shadow-lg transition-transform active:scale-95"
              >
                🧻 Wipe Eyes & Put On Splash Goggles!
              </button>
              <button
                type="button"
                onClick={() => {
                  soundEngine.playUiClick(520);
                  setSoapInEyeActive(false);
                }}
                className="w-full sm:w-auto px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs"
              >
                Just Wipe Eyes (Keep Goggles Off)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Big 3-2-1 Countdown Overlay in Center of Screen */}
      {countdownNumber !== null && (
        <div className="pointer-events-none fixed inset-0 z-30 flex items-center justify-center">
          <div
            className="px-10 py-6 rounded-2xl border-2 border-amber-400 text-center shadow-2xl"
            style={{ backgroundColor: 'rgba(9, 13, 22, 0.92)' }}
          >
            <div className="text-xs font-bold font-mono-tabular text-amber-400">
              TESTING YOUR MEASURED MIX
            </div>
            <div className="text-6xl font-extrabold font-display text-white mt-1">
              {countdownNumber}
            </div>
          </div>
        </div>
      )}

      {/* 2. Top Navigation Bar (Strict 3-Zone Contract: Brand — 4 Scale Links — 1 Primary Action) */}
      <header
        className="relative z-20 flex items-center justify-between gap-4 sm:gap-8 px-4 sm:px-6 py-2.5 border-b border-slate-800"
        style={{ backgroundColor: 'rgba(9, 13, 22, 0.94)' }}
      >
        {/* Zone 1: Brand Wordmark */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setCameraPreset('orbit_overview');
          }}
          className="text-base sm:text-lg font-bold tracking-tight text-white font-display whitespace-nowrap shrink-0"
        >
          Elephant’s Toothpaste 3D World
        </a>

        {/* Zone 2: 4 Scale Environment Links */}
        <nav className="flex items-center gap-3 sm:gap-6 text-xs sm:text-sm font-medium text-slate-300 overflow-x-auto">
          {(
            [
              { id: 'lab_beaker', label: '1. Lab Beaker' },
              { id: 'kiddie_pool', label: '2. Kiddie Pool' },
              { id: 'steel_flask', label: '3. Giant Volcano' },
              { id: 'outdoor_crater', label: '4. Blast Crater' },
            ] as { id: ScaleEnvironmentId; label: string }[]
          ).map((item) => {
            const isSelected = config.scaleId === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectScale(item.id)}
                className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                  isSelected
                    ? 'text-amber-400 border-amber-400 font-bold'
                    : 'text-slate-300 border-transparent hover:text-white'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: 1 Primary Action (Full Science Report Poster & Saved Notebook) */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick(660);
              if (photos.length === 0) {
                handleSnapLivePhoto();
              }
              setIsReportModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Saved Reports & Poster ({photos.length})</span>
          </button>
        </div>
      </header>

      {/* Mark Rober's Compact Commentary Bubble (Top-Left) */}
      <div
        className="fixed top-14 left-3 z-10 max-w-[260px] sm:max-w-[300px] rounded-xl border border-slate-700/90 px-2.5 py-2 pointer-events-auto shadow-lg"
        style={{ backgroundColor: 'rgba(9, 13, 22, 0.88)' }}
      >
        <div className="flex items-start gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-amber-500 text-slate-950 font-extrabold font-display flex items-center justify-center text-xs shrink-0 mt-0.5">
            MR
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-bold font-mono-tabular text-amber-400">
              MARK ROBER’S LAB BUDDY
            </div>
            <p className="text-xs text-slate-100 leading-snug mt-0.5">{roberQuote}</p>
            {photoFlashToast && (
              <div className="mt-1 text-[11px] font-bold text-emerald-400">
                {photoFlashToast}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. The Interactive Live Science Report Dock & Slim Lab Bench */}
      <LiveScienceReportDock
        scientistName={scientistName}
        onChangeScientistName={setScientistName}
        config={config}
        safetyGear={safetyGear}
        safetyAssessment={safetyAssessment}
        activeResult={activeResult}
        predictedResult={predictedResult}
        yourGuessM={betTouched ? bet.heightM : null}
        activeMishaps={activeMishaps}
        photos={photos}
        isCollapsed={isDockCollapsed}
        onToggleCollapse={() => setIsDockCollapsed((prev) => !prev)}
        showArMeasures={showArMeasures}
        onToggleArMeasures={() => {
          soundEngine.playUiClick(620);
          setShowArMeasures((prev) => !prev);
        }}
        cameraPreset={cameraPreset}
        onSelectCameraPreset={(cam) => {
          soundEngine.playUiClick(600);
          setCameraPreset(cam);
        }}
        isMuted={isMuted}
        onToggleMute={() => {
          const next = !isMuted;
          setIsMuted(next);
          soundEngine.setMuted(next);
        }}
        onSelectScale={handleSelectScale}
        onUpdateConfig={handleUpdateConfig}
        onToggleSafetyGear={handleToggleSafetyGear}
        onEquipAllSafety={handleEquipAllRequiredPpe}
        activePhraseStep={activePhraseStep}
        onBeginPourPhrase={handleBeginPourPhrase}
        onEmptyContainer={handleEmptyContainer}
        onApplyPreset={handleApplyPreset}
        onTriggerEruption={handleTriggerEruption}
        onHoseCleanup={handleHoseCleanup}
        onSnapPhoto={handleSnapLivePhoto}
        onOpenFullReportModal={() => {
          soundEngine.playUiClick(660);
          if (photos.length === 0) {
            handleSnapLivePhoto();
          }
          setIsReportModalOpen(true);
        }}
        onQuickDownloadPoster={handleQuickDownloadPoster}
        isDownloadingPoster={isDownloadingPoster}
      />

      {/* 4. Full-Screen Science Fair Report & Saved Notebook Modal */}
      <ScienceReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        draftReport={draftReport}
        savedReports={savedReports}
        onSaveReport={handleSaveReport}
        onDeleteSavedReport={handleDeleteSavedReport}
        onSnapLivePhoto={handleSnapLivePhoto}
      />
    </div>
  );
}
