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

const STORAGE_KEY_REPORTS = 'elephants_toothpaste_saved_reports_v1';

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

  // Drag & Drop State for Measuring Into the 3D Container
  const [draggingStep, setDraggingStep] = useState<IngredientStep | null>(null);
  const [is3dDropHover, setIs3dDropHover] = useState(false);

  // Hilarious "Soap & Foam in Your Eyes!" Screen Splat State (when Goggles are off!)
  const [soapInEyeActive, setSoapInEyeActive] = useState(false);
  const [soapInEyeReason, setSoapInEyeReason] = useState<string>(
    'You squirted Dish Soap without wearing Splash Goggles!'
  );

  // Mark Rober Live Commentary & 3-2-1 Countdown State
  const [roberQuote, setRoberQuote] = useState<string>(
    'Drag & drop bottles from Section 3 onto the 3D container to measure them in! Watch out: your Splash Goggles are UNCHECKED—if you squirt too much soap or launch without goggles, you’ll get soap in your eyes!'
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
  const safetyAssessment = useMemo(
    () => evaluateSafetyHazards(config, safetyGear),
    [config, safetyGear]
  );

  const activeMishaps: LabMishap[] = useMemo(
    () => evaluateExperimentMishaps(config, safetyGear, activeResult || predictedResult),
    [config, safetyGear, activeResult, predictedResult]
  );

  // Switch Scale Environment from Top Bar or Section 1 (Aim) of the Live Report
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
        'Aim updated to the 2L Lab Beaker! Drag & drop Peroxide, Soap, and Catalyst onto the beaker to measure your mix!'
      );
    } else if (scaleId === 'kiddie_pool') {
      setRoberQuote(
        'Aim updated to the 450L Backyard Kiddie Pool! Look—Phat Gus the Squirrel is wearing his mini safety goggles on the tree stump!'
      );
    } else if (scaleId === 'steel_flask') {
      setRoberQuote(
        'Aim updated to the 2,200L Giant Steel Volcano! Drag & drop Orbeez beads into the cone to boost the foam jet height!'
      );
    } else {
      setRoberQuote(
        'Aim updated to the 5,000L DEVIL’S TOOTHPASTE CRATER! Don’t forget your Goggles & Hazmat Suit or you’ll turn into a Foam Snowman!'
      );
    }
  };

  // Update chemical parameters from Section 1 & Section 2 of the Live Science Report
  const handleUpdateConfig = (partial: Partial<ExperimentConfig>) => {
    soundEngine.playUiClick(540);
    setActiveResult(null);
    setConfig((prev) => {
      const next = { ...prev, ...partial };
      if (partial.peroxideConcentration === 50) {
        setRoberQuote(
          '50% DEVIL’S TOOTHPASTE GRADE! That is 16× stronger than store peroxide—if you only put 1 squirt of soap, it’ll flash straight to >100°C STEAM!'
        );
      }
      return next;
    });
  };

  // Toggle individual Safety Checkboxes in Section 2 of the Live Science Report
  const handleToggleSafetyGear = (key: keyof SafetyGearState) => {
    soundEngine.playUiClick(560);
    setSafetyGear((prev) => {
      if (key === 'standBackMeters') return prev;
      const nextVal = !prev[key];
      if (key === 'goggles' && nextVal) {
        setSoapInEyeActive(false);
        setRoberQuote('Splash Goggles ON! Your eyes are now protected from flying dish soap and foam!');
      } else if (key === 'goggles' && !nextVal) {
        setRoberQuote('Uh oh! You took off your Splash Goggles! Watch out for flying soap bubbles!');
      } else if (key === 'gloves' && nextVal) {
        setRoberQuote('Nitrile Gloves ON! No more Smurf-stained fingers!');
      }
      return {
        ...prev,
        [key]: nextVal,
      };
    });
  };

  // Measure in an ingredient via Drag & Drop (or Click) — updates amounts & Science Report log!
  const handleMeasureInIngredient = (step: IngredientStep) => {
    soundEngine.playIngredientPour(step);
    setActiveResult(null);
    setPourStepTrigger((prev) => ({ step, count: prev.count + 1 }));

    setConfig((prev) => {
      const scale = SCALE_ENVIRONMENTS[prev.scaleId];
      const alreadyAdded = prev.additionOrder.includes(step);
      const nextOrder = alreadyAdded ? prev.additionOrder : [...prev.additionOrder, step];

      let nextPeroxideVol = prev.peroxideVolumePercent;
      let nextSoapMl = prev.soapVolumeMlPerLiter;
      let nextOrbeezCount = prev.orbeezCount || 0;
      let nextCatalystRatio = prev.catalystRatio;
      let nextIncludeOrbeez = prev.includeOrbeez;
      let logLabel = '';

      if (step === 'peroxide') {
        nextPeroxideVol = alreadyAdded ? Math.min(125, prev.peroxideVolumePercent + 25) : 25;
        const liters = ((scale.vesselCapacityLiters * nextPeroxideVol) / 100).toFixed(1);
        logLabel = `Poured +25% Jug → Now ${liters} L (${nextPeroxideVol}% full) of ${prev.peroxideConcentration}% H₂O₂${
          nextPeroxideVol > 100 ? ' [OVERFLOWING RIM!]' : ''
        }`;

        if (nextPeroxideVol > 100) {
          setRoberQuote(
            `WHOA! ${nextPeroxideVol}% FULL! You poured ${liters} L into a ${scale.vesselCapacityLiters} L container—peroxide is sloshing over the rim!`
          );
        } else {
          setRoberQuote(
            `Measured in ${liters} L (${nextPeroxideVol}% full) of ${prev.peroxideConcentration}% Hydrogen Peroxide! Drag again to add more!`
          );
        }
      } else if (step === 'soap') {
        nextSoapMl = alreadyAdded ? Math.min(110, prev.soapVolumeMlPerLiter + 22) : 22;
        const status =
          nextSoapMl < 28
            ? '1 Squirt — Low Soap (Steam Flash Risk!)'
            : nextSoapMl <= 55
            ? 'Golden Ratio Sweet Spot!'
            : nextSoapMl < 75
            ? 'Extra Bubbly!'
            : 'SOAP OVERDOSE! (Slime Slug Warning!)';
        logLabel = `Squirted +22 mL/L Dish Soap → Total ${nextSoapMl} mL/L (${status})`;

        if (nextSoapMl >= 75) {
          soundEngine.playSlimeBurpSound();
          setRoberQuote(
            `BWAHAHA! ${nextSoapMl} mL/L OF DISH SOAP?! Science Bob warned us: that much soap will turn the eruption into a heavy, slow-oozing SLIME SLUG!`
          );
        } else if (nextSoapMl < 28) {
          setRoberQuote(
            `Measured ${nextSoapMl} mL/L Dish Soap (1 squirt)! Careful: if you use 50% Peroxide with only 1 squirt of soap, it flashes straight to STEAM! Drag again for the 44 mL/L sweet spot!`
          );
        } else {
          setRoberQuote(
            `NICE! ${nextSoapMl} mL/L of Dish Soap—that’s right in Science Bob’s Golden Ratio sweet spot for maximum foam height!`
          );
        }

        // Funny Mistake: Squirting lots of soap without Splash Goggles -> SPLAT! Soap in Eye!
        if (!safetyGear.goggles && nextSoapMl >= 44) {
          soundEngine.playSoapSplatSound();
          setSoapInEyeReason(
            `You squirted ${nextSoapMl} mL/L of Dish Soap with NO Splash Goggles on, and the bottle burped soap bubbles right into your eyes!`
          );
          setSoapInEyeActive(true);
        }
      } else if (step === 'orbeez') {
        nextIncludeOrbeez = true;
        nextOrbeezCount = alreadyAdded ? Math.min(10000, (prev.orbeezCount || 0) + 2500) : 2500;
        logLabel = `Dumped +2,500 Orbeez → Total ${nextOrbeezCount.toLocaleString()} Water Beads`;
        setRoberQuote(
          `BOING! Measured ${nextOrbeezCount.toLocaleString()} squishy Orbeez water beads into the container! Your Science Report is updated!`
        );
      } else if (step === 'catalyst') {
        nextCatalystRatio = alreadyAdded ? Math.min(100, prev.catalystRatio + 35) : 35;
        const catName =
          prev.catalystType === 'potassium_iodide' ? 'Potassium Iodide' : 'Warm Yeast';
        const beforeSoap = !nextOrder.includes('soap');
        logLabel = `Measured ${nextCatalystRatio}% ${catName} Catalyst${
          beforeSoap ? ' [BEFORE SOAP — MISTAKE!]' : ''
        }`;

        if (beforeSoap) {
          setRoberQuote(
            `HOLD EVERYTHING! You dragged in ${catName} BEFORE Dish Soap! Hit SEND IT to see why all the oxygen boils away without soap!`
          );
        } else {
          setRoberQuote(
            `Measured ${nextCatalystRatio}% ${catName} Catalyst into the dump trough! Hit SEND IT in Section 4 to see what really happens!`
          );
        }
      }

      const newRecord: PouredStepRecord = {
        id: `pour_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
        step,
        amountLabel: logLabel,
        timestamp: new Date().toLocaleTimeString([], { minute: '2-digit', second: '2-digit' }),
      };

      return {
        ...prev,
        peroxideVolumePercent: nextPeroxideVol,
        soapVolumeMlPerLiter: nextSoapMl,
        orbeezCount: nextOrbeezCount,
        catalystRatio: nextCatalystRatio,
        includeOrbeez: nextIncludeOrbeez,
        additionOrder: nextOrder,
        pouredLog: [...(prev.pouredLog || []), newRecord],
      };
    });
  };

  // Empty Container to 0 L so the child can measure everything from scratch via Drag & Drop!
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
      'Container emptied to 0 L! Now drag & drop any bottles from Section 3 onto the 3D container (or click SEND IT right now to see what happens when it’s empty!).'
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
      `Loaded "${found.name}"! You can still drag & drop extra scoops into the container or uncheck safety gear to test mistakes!`
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

    const mishaps = evaluateExperimentMishaps(activeConfig, safetyGear, result);

    // Check if they forgot Splash Goggles during a soapy/fizzy reaction!
    if (mishaps.some((m) => m.id === 'soap_in_eye')) {
      soundEngine.playSoapSplatSound();
      setSoapInEyeReason(
        `You launched ${result.outcomeTitle} WITHOUT Splash Goggles! Warm soapy foam splattered right into your eyes!`
      );
      setSoapInEyeActive(true);
    }

    // Play appropriate sound effect for what REALLY happened
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

    // Update Mark Rober's commentary based on what REALLY happened
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
        'ZERO BOOM! You forgot to drag in the Hydrogen Peroxide fuel! Without H₂O₂, there is no extra oxygen atom to release!'
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
        `AWESOME ERUPTION! ${result.peakHeightMeters}m tall and ${result.peakTempCelsius}°C! Check Section 4—your Science Report is updated with what really happened!`
      );
    }
  };

  // Trigger Eruption — Unforced! Runs whatever the child actually measured in!
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

  // 1-Click Direct Poster PNG Download from Section 4 of the Live Report Dock
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

  return (
    <div
      className="relative w-screen h-screen overflow-hidden bg-slate-950 text-slate-100 select-none"
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      }}
      onDrop={(e) => {
        e.preventDefault();
        setIs3dDropHover(false);
        const step = e.dataTransfer.getData('text/plain') as IngredientStep;
        if (
          step === 'peroxide' ||
          step === 'soap' ||
          step === 'orbeez' ||
          step === 'catalyst'
        ) {
          handleMeasureInIngredient(step);
        }
        setDraggingStep(null);
      }}
    >
      {/* 1. Full-Viewport 3D WebGL Scene + Superimposed AR Measurement Overlay */}
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
      />

      {/* Interactive 3D Container Drag-and-Drop Measuring Target Overlay */}
      {draggingStep && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = 'copy';
            if (!is3dDropHover) setIs3dDropHover(true);
          }}
          onDragLeave={() => setIs3dDropHover(false)}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIs3dDropHover(false);
            const step = (e.dataTransfer.getData('text/plain') ||
              draggingStep) as IngredientStep;
            if (step) {
              handleMeasureInIngredient(step);
            }
            setDraggingStep(null);
          }}
          className="fixed inset-x-0 top-14 bottom-20 z-30 flex items-center justify-center pointer-events-auto"
        >
          <div
            className={`px-8 py-6 rounded-2xl border-4 border-dashed text-center transition-transform shadow-2xl ${
              is3dDropHover
                ? 'border-amber-400 scale-105 bg-slate-950/90'
                : 'border-sky-400/90 bg-slate-950/80'
            }`}
          >
            <div className="text-xs font-bold font-mono-tabular text-amber-400">
              DRAG & DROP MEASURING TARGET
            </div>
            <div className="text-lg sm:text-xl font-extrabold font-display text-white mt-1">
              🎯 Drop Here to Pour into the {scaleSpec.name}!
            </div>
            <div className="text-xs text-sky-300 mt-1 font-mono-tabular">
              Currently inside: {measuredLiters}L Peroxide · {config.soapVolumeMlPerLiter} mL/L Soap ·{' '}
              {config.catalystRatio}% Catalyst
            </div>
          </div>
        </div>
      )}

      {/* Hilarious "SPLAT! SOAP & FOAM IN YOUR EYES!" Overlay when Splash Goggles are forgotten! */}
      {soapInEyeActive && (
        <div className="fixed inset-0 z-40 pointer-events-auto flex flex-col items-center justify-center p-4">
          {/* Translucent Soap Suds & Colored Foam Blobs Across the Screen */}
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

          {/* Center Interactive Wipe-Your-Eyes Card */}
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

      {/* 3. The Interactive Live Science Report Dock (Drag & Drop Measuring + Live Results & Bloopers) */}
      <LiveScienceReportDock
        scientistName={scientistName}
        onChangeScientistName={setScientistName}
        config={config}
        safetyGear={safetyGear}
        safetyAssessment={safetyAssessment}
        activeResult={activeResult}
        predictedResult={predictedResult}
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
        onMeasureInIngredient={handleMeasureInIngredient}
        onStartDragIngredient={setDraggingStep}
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
