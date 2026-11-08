import React, { useState } from 'react';
import {
  Camera,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Download,
  Eye,
  FileText,
  Footprints,
  GripVertical,
  MapPin,
  Play,
  RotateCcw,
  Ruler,
  ShieldCheck,
  Sparkles,
  Square,
  Trash2,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  CameraPresetId,
  CapturedPhoto,
  DyeColorId,
  ExperimentConfig,
  IngredientStep,
  LabLocationId,
  LabMishap,
  ReactionSimulationResult,
  SafetyGearState,
  SafetyHazardAssessment,
  ScaleEnvironmentId,
} from '../types/chemistry';
import {
  DYE_COLORS,
  LAB_LOCATIONS,
  PRESET_EXPERIMENTS,
  SCALE_ENVIRONMENTS,
} from '../utils/chemistryEngine';

interface LiveScienceReportDockProps {
  scientistName: string;
  onChangeScientistName: (name: string) => void;
  config: ExperimentConfig;
  safetyGear: SafetyGearState;
  safetyAssessment: SafetyHazardAssessment;
  activeResult: ReactionSimulationResult | null;
  predictedResult: ReactionSimulationResult;
  activeMishaps: LabMishap[];
  photos: CapturedPhoto[];
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  showArMeasures: boolean;
  onToggleArMeasures: () => void;
  cameraPreset: CameraPresetId;
  onSelectCameraPreset: (preset: CameraPresetId) => void;
  isMuted: boolean;
  onToggleMute: () => void;
  onSelectScale: (scaleId: ScaleEnvironmentId) => void;
  onSelectLocation: (locationId: LabLocationId) => void;
  onUpdateConfig: (partial: Partial<ExperimentConfig>) => void;
  onToggleSafetyGear: (key: keyof SafetyGearState) => void;
  onEquipAllSafety: () => void;
  activePhraseStep: IngredientStep | null;
  onBeginPourPhrase: (step: IngredientStep, e: React.PointerEvent) => void;
  onTriggerScientistFetchStep: (step: IngredientStep) => void;
  onTriggerScientistFetchSafety: () => void;
  onEmptyContainer: () => void;
  onApplyPreset: (presetId: string) => void;
  onTriggerEruption: () => void;
  onHoseCleanup: () => void;
  onSnapPhoto: () => void;
  onOpenFullReportModal: () => void;
  onQuickDownloadPoster: () => void;
  isDownloadingPoster: boolean;
}

function getSquirrelComparison(meters: number): string {
  if (meters <= 0.05) return '0 Phat Gus Squirrels (No Foam!)';
  const squirrels = Math.max(1, Math.round(meters / 0.25));
  if (meters < 0.4) return `${squirrels} Phat Gus tall`;
  if (meters < 1.8) return `Lab Desk (~${squirrels} Squirrels)`;
  if (meters < 3.5) return `Basketball Hoop (~${squirrels} Squirrels)`;
  if (meters < 6.5) return `Taller than a Giraffe (~${squirrels} Squirrels)`;
  if (meters < 15) return `4-Story School (~${squirrels} Squirrels)`;
  if (meters < 26) return `Brachiosaurus Dino (~${squirrels} Squirrels)`;
  return `10-Story Skyscraper (~${squirrels} Squirrels!)`;
}

export const LiveScienceReportDock: React.FC<LiveScienceReportDockProps> = ({
  scientistName,
  onChangeScientistName,
  config,
  safetyGear,
  safetyAssessment,
  activeResult,
  predictedResult,
  activeMishaps,
  photos,
  isCollapsed,
  onToggleCollapse,
  showArMeasures,
  onToggleArMeasures,
  cameraPreset,
  onSelectCameraPreset,
  isMuted,
  onToggleMute,
  onSelectLocation,
  onUpdateConfig,
  onToggleSafetyGear,
  onEquipAllSafety,
  activePhraseStep,
  onBeginPourPhrase,
  onTriggerScientistFetchStep,
  onTriggerScientistFetchSafety,
  onEmptyContainer,
  onApplyPreset,
  onTriggerEruption,
  onHoseCleanup,
  onSnapPhoto,
  onOpenFullReportModal,
  onQuickDownloadPoster,
  isDownloadingPoster,
}) => {
  const [isSideReportOpen, setIsSideReportOpen] = useState(true);

  const displayedTelemetry = activeResult || predictedResult;
  const scaleSpec = SCALE_ENVIRONMENTS[config.scaleId];
  const currentLocationId: LabLocationId = config.locationId || 'crunchlabs_warehouse';

  const hasPeroxide = config.additionOrder.includes('peroxide') && config.peroxideVolumePercent > 0;
  const hasSoap = config.additionOrder.includes('soap') && config.soapVolumeMlPerLiter > 0;
  const hasOrbeez = config.additionOrder.includes('orbeez') && (config.orbeezCount || 0) > 0;
  const hasCatalyst = config.additionOrder.includes('catalyst') && config.catalystRatio > 0;

  const measuredPeroxideLiters = hasPeroxide
    ? ((scaleSpec.vesselCapacityLiters * config.peroxideVolumePercent) / 100).toFixed(1)
    : '0';

  const isWrongOrder =
    config.additionOrder.includes('catalyst') &&
    config.additionOrder.includes('soap') &&
    config.additionOrder.indexOf('catalyst') < config.additionOrder.indexOf('soap');

  const ingredientCards: {
    step: IngredientStep;
    numberBadge: string;
    title: string;
    subtitle: string;
    measuredBadge: string;
    fillPct: number;
    barColor: string;
    colorClass: string;
  }[] = [
    {
      step: 'peroxide',
      numberBadge: '1',
      title: 'H₂O₂ Peroxide',
      subtitle: `${config.peroxideConcentration}% Fuel`,
      measuredBadge: hasPeroxide
        ? `${measuredPeroxideLiters}L (${config.peroxideVolumePercent}%)`
        : '0L (Hold/Drag)',
      fillPct: Math.min(100, (config.peroxideVolumePercent / 100) * 100),
      barColor: config.peroxideVolumePercent > 100 ? '#f43f5e' : '#38bdf8',
      colorClass: hasPeroxide
        ? 'border-sky-400 bg-sky-500/20 text-sky-100'
        : 'border-slate-700 bg-slate-900/95 text-slate-200 hover:border-sky-400',
    },
    {
      step: 'soap',
      numberBadge: '2',
      title: 'Dish Soap',
      subtitle: 'Bubble Maker',
      measuredBadge: hasSoap
        ? `${config.soapVolumeMlPerLiter}mL/L${
            config.soapVolumeMlPerLiter >= 75
              ? ' OVER!'
              : config.soapVolumeMlPerLiter < 28
              ? ' LOW'
              : ' ★'
          }`
        : '0mL (Hold/Drag)',
      fillPct: Math.min(100, (config.soapVolumeMlPerLiter / 110) * 100),
      barColor:
        config.soapVolumeMlPerLiter >= 75
          ? '#f43f5e'
          : config.soapVolumeMlPerLiter >= 32
          ? '#34d399'
          : '#fbbf24',
      colorClass: hasSoap
        ? config.soapVolumeMlPerLiter >= 75
          ? 'border-rose-400 bg-rose-500/20 text-rose-100'
          : 'border-emerald-400 bg-emerald-500/20 text-emerald-100'
        : 'border-slate-700 bg-slate-900/95 text-slate-200 hover:border-emerald-400',
    },
    {
      step: 'orbeez',
      numberBadge: '3',
      title: 'Orbeez Beads',
      subtitle: 'Nozzle Booster',
      measuredBadge: hasOrbeez
        ? `${((config.orbeezCount || 0) / 1000).toFixed(1)}k beads`
        : '0 (Hold/Drag)',
      fillPct: Math.min(100, ((config.orbeezCount || 0) / 10000) * 100),
      barColor: '#c084fc',
      colorClass: hasOrbeez
        ? 'border-purple-400 bg-purple-500/20 text-purple-100'
        : 'border-slate-700 bg-slate-900/95 text-slate-200 hover:border-purple-400',
    },
    {
      step: 'catalyst',
      numberBadge: '4',
      title: config.catalystType === 'potassium_iodide' ? 'Catalyst (KI)' : 'Catalyst (Yeast)',
      subtitle: 'Reaction Spark',
      measuredBadge: hasCatalyst ? `${config.catalystRatio}% loaded` : '0% (Hold/Drag)',
      fillPct: Math.min(100, config.catalystRatio),
      barColor: '#f59e0b',
      colorClass: hasCatalyst
        ? 'border-amber-400 bg-amber-500/20 text-amber-100'
        : 'border-slate-700 bg-slate-900/95 text-slate-200 hover:border-amber-400',
    },
  ];

  return (
    <>
      {/* 1. COMPACT RIGHT-SIDE LIVE SCIENCE REPORT CLIPBOARD (Never blocks the center 3D experiment!) */}
      <aside
        className="fixed top-14 right-3 z-20 w-[268px] sm:w-[286px] transition-transform duration-200 ease-out pointer-events-auto"
        style={{
          transform: isSideReportOpen ? 'translateX(0)' : 'translateX(calc(100% + 16px))',
        }}
      >
        {!isSideReportOpen && (
          <button
            type="button"
            onClick={() => setIsSideReportOpen(true)}
            className="fixed top-2 right-0 -translate-x-full mr-3 px-3 py-2 rounded-l-xl border border-slate-700 text-xs font-bold text-amber-300 shadow-xl flex items-center gap-1.5 whitespace-nowrap"
            style={{ backgroundColor: 'rgba(15, 23, 42, 0.95)' }}
          >
            <FileText className="w-3.5 h-3.5 text-amber-400" />
            <span>Open Live Report</span>
          </button>
        )}

        <div
          className="border border-slate-700/90 rounded-xl shadow-2xl overflow-hidden max-h-[calc(100vh-195px)] flex flex-col"
          style={{ backgroundColor: 'rgba(15, 23, 42, 0.94)' }}
        >
          {/* Clipboard Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800 bg-slate-950/90">
            <div className="flex items-center gap-1.5 min-w-0">
              <FileText className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="text-xs font-bold text-white truncate">
                LIVE SCIENCE REPORT
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsSideReportOpen(false)}
              className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-semibold text-slate-300"
              title="Minimize Report to Right Edge"
            >
              <span>Hide</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          {/* Scrollable Report Body */}
          <div className="p-2.5 space-y-2 overflow-y-auto text-[11px]">
            {/* Scientist & Preset Selector */}
            <div className="flex items-center justify-between gap-1.5">
              <input
                type="text"
                value={scientistName}
                onChange={(e) => onChangeScientistName(e.target.value)}
                className="w-28 px-2 py-0.5 text-[11px] font-semibold bg-slate-900 border border-slate-700 rounded text-white focus:outline-none focus:border-amber-400"
                aria-label="Scientist Name"
              />
              <select
                onChange={(e) => {
                  if (e.target.value) onApplyPreset(e.target.value);
                }}
                defaultValue=""
                className="flex-1 px-1.5 py-0.5 text-[10px] font-medium bg-slate-900 border border-slate-700 rounded text-amber-300 focus:outline-none"
                aria-label="Load Famous Experiment Preset"
              >
                <option value="" disabled>
                  ✨ Load Preset...
                </option>
                {PRESET_EXPERIMENTS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 1. AIM, LOCATION & PREDICTION */}
            <div className="p-2 rounded-lg bg-slate-950/90 border border-slate-800/90 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold font-mono-tabular text-amber-400">
                  1. AIM & LOCATION
                </span>
                <span className="text-[9px] text-sky-300 font-semibold">
                  {LAB_LOCATIONS[currentLocationId].shortName}
                </span>
              </div>
              <p className="text-[11px] text-slate-300 leading-snug">
                Testing <strong className="text-white">{scaleSpec.name.replace(' Rig', '')}</strong>{' '}
                with <strong className="text-sky-300">{config.peroxideConcentration}% H₂O₂</strong>{' '}
                +{' '}
                <strong className="text-amber-300">
                  {config.catalystType === 'potassium_iodide' ? 'KI' : 'Yeast'}
                </strong>
                . Predicted height:{' '}
                <strong className="text-amber-400">{predictedResult.peakHeightMeters}m</strong>.
              </p>
            </div>

            {/* 2. ACTUAL AMOUNTS MEASURED */}
            <div className="p-2 rounded-lg bg-slate-950/90 border border-slate-800/90 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold font-mono-tabular text-sky-400">
                  2. MEASURED AMOUNTS
                </span>
                <button
                  type="button"
                  onClick={onEmptyContainer}
                  className="text-[10px] text-rose-400 hover:text-rose-300 flex items-center gap-0.5 font-semibold"
                >
                  <Trash2 className="w-2.5 h-2.5" />
                  <span>Empty (0L)</span>
                </button>
              </div>
              <div className="grid grid-cols-2 gap-1 text-[10px] font-mono-tabular text-slate-200">
                <div className="bg-slate-900 px-1.5 py-0.5 rounded">
                  H₂O₂: <strong className="text-sky-300">{measuredPeroxideLiters}L</strong>
                </div>
                <div className="bg-slate-900 px-1.5 py-0.5 rounded">
                  Soap:{' '}
                  <strong
                    className={
                      config.soapVolumeMlPerLiter >= 75 ? 'text-rose-400' : 'text-emerald-300'
                    }
                  >
                    {hasSoap ? `${config.soapVolumeMlPerLiter}mL/L` : '0mL'}
                  </strong>
                </div>
                <div className="bg-slate-900 px-1.5 py-0.5 rounded">
                  Catalyst:{' '}
                  <strong className="text-amber-300">
                    {hasCatalyst ? `${config.catalystRatio}%` : '0%'}
                  </strong>
                </div>
                <div className="bg-slate-900 px-1.5 py-0.5 rounded">
                  Orbeez:{' '}
                  <strong className="text-purple-300">
                    {hasOrbeez ? config.orbeezCount : 0}
                  </strong>
                </div>
              </div>
            </div>

            {/* 3. METHOD LOG (Chronological Phrase Log) */}
            <div className="p-2 rounded-lg bg-slate-950/90 border border-slate-800/90 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold font-mono-tabular text-emerald-400">
                  3. METHOD LOG (POUR ORDER)
                </span>
                {isWrongOrder && (
                  <span className="text-[9px] font-bold text-amber-300">⚠️ Wrong Order!</span>
                )}
              </div>
              <div className="max-h-20 overflow-y-auto space-y-1 pr-0.5">
                {(!config.pouredLog || config.pouredLog.length === 0) &&
                config.additionOrder.length === 0 ? (
                  <p className="text-[10px] text-amber-300 italic py-1">
                    Empty! Hold/drag any bottle below or click 🚶 Fetch so your Scientist walks to get it!
                  </p>
                ) : (
                  (config.pouredLog && config.pouredLog.length > 0
                    ? config.pouredLog
                    : config.additionOrder.map((s, idx) => ({
                        id: `${s}_${idx}`,
                        step: s,
                        amountLabel: s,
                        timestamp: '',
                      }))
                  ).map((entry, i) => (
                    <div
                      key={entry.id}
                      className="text-[10px] text-slate-200 flex items-center gap-1 bg-slate-900/80 px-1.5 py-0.5 rounded"
                    >
                      <span className="font-mono-tabular font-bold text-amber-400 shrink-0">
                        #{i + 1}
                      </span>
                      <span className="truncate">{entry.amountLabel}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* 4. WHAT REALLY HAPPENED & BLOOPERS */}
            <div className="p-2 rounded-lg bg-slate-950/90 border border-slate-800/90 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold font-mono-tabular text-purple-400">
                  4. WHAT REALLY HAPPENED
                </span>
                <span className="text-[9px] font-mono-tabular text-amber-400">
                  {activeResult ? 'UPDATED ✓' : 'LIVE PREVIEW'}
                </span>
              </div>

              <div className="text-[11px] font-bold text-white leading-tight">
                {displayedTelemetry.outcomeTitle}
              </div>

              <div className="grid grid-cols-3 gap-1 text-center py-1 bg-slate-900 rounded border border-slate-800">
                <div>
                  <span className="text-[9px] text-slate-400 block">HEIGHT</span>
                  <span className="text-xs font-bold font-mono-tabular text-amber-400">
                    {displayedTelemetry.peakHeightMeters}m
                  </span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 block">HEAT</span>
                  <span className="text-xs font-bold font-mono-tabular text-rose-400">
                    {displayedTelemetry.peakTempCelsius}°C
                  </span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 block">FOAM</span>
                  <span className="text-xs font-bold font-mono-tabular text-sky-400">
                    {displayedTelemetry.foamVolumeCubicMeters}m³
                  </span>
                </div>
              </div>

              <div className="text-[10px] text-sky-300 text-center truncate">
                {getSquirrelComparison(displayedTelemetry.peakHeightMeters)}
              </div>

              {activeMishaps.length > 0 && (
                <div className="pt-1 border-t border-slate-800 space-y-0.5">
                  {activeMishaps.slice(0, 2).map((m) => (
                    <div
                      key={m.id}
                      className="text-[10px] font-semibold text-rose-300 truncate"
                      title={m.funnyDescription}
                    >
                      ⚠️ {m.title}
                    </div>
                  ))}
                </div>
              )}

              {/* Export Poster & Open Full Report Buttons */}
              <div className="flex items-center gap-1 pt-0.5">
                <button
                  type="button"
                  onClick={onQuickDownloadPoster}
                  disabled={isDownloadingPoster}
                  className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2 text-[10px] font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded transition-colors whitespace-nowrap"
                >
                  <Download className="w-3 h-3" />
                  <span>{isDownloadingPoster ? 'Saving...' : 'Download Poster'}</span>
                </button>
                <button
                  type="button"
                  onClick={onOpenFullReportModal}
                  className="px-2 py-1.5 text-[10px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition-colors whitespace-nowrap"
                >
                  Edit ({photos.length})
                </button>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* 2. TWO-STRIP SLIM BOTTOM LAB BENCH (Guarantees all 4 Ingredient Bottles are 100% visible side-by-side!) */}
      <div
        className="fixed inset-x-2 sm:inset-x-4 bottom-2 z-20 mx-auto max-w-[1220px] transition-transform duration-200 ease-out"
        style={{
          transform: isCollapsed ? 'translateY(calc(100% - 28px))' : 'translateY(0)',
        }}
      >
        {/* STRIP 1: Top Micro-Bar for Collapse + 4 Lab Locations + H2O2 % + Yeast/KI + Dye + Safety Gear + Camera */}
        <div
          className="flex flex-wrap items-center justify-between gap-1.5 px-2.5 py-1 border border-b-0 border-slate-700 rounded-t-xl text-[11px]"
          style={{ backgroundColor: 'rgba(9, 13, 22, 0.96)' }}
        >
          {/* Collapse Toggle */}
          <button
            type="button"
            onClick={onToggleCollapse}
            className="flex items-center gap-1 px-2 py-0.5 font-bold text-amber-300 hover:text-white rounded bg-slate-900 border border-slate-700 whitespace-nowrap shrink-0"
          >
            <Sparkles className="w-3 h-3 text-amber-400" />
            <span>{isCollapsed ? 'Show Lab Bench (H)' : 'Hide Bench'}</span>
            {isCollapsed ? (
              <ChevronUp className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3 text-slate-400" />
            )}
          </button>

          {!isCollapsed && (
            <>
              {/* 4 Switchable 3D Lab Locations / Settings */}
              <div className="flex items-center gap-1 bg-slate-900/90 px-2 py-0.5 rounded border border-slate-800">
                <MapPin className="w-3 h-3 text-amber-400 shrink-0" />
                {(
                  [
                    { id: 'crunchlabs_warehouse', label: 'Warehouse' },
                    { id: 'suburban_backyard', label: 'Backyard' },
                    { id: 'science_gymnasium', label: 'School Gym' },
                    { id: 'desert_proving_ground', label: 'Desert Canyon' },
                  ] as { id: LabLocationId; label: string }[]
                ).map((loc) => (
                  <button
                    key={loc.id}
                    type="button"
                    onClick={() => onSelectLocation(loc.id)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors whitespace-nowrap ${
                      currentLocationId === loc.id
                        ? 'bg-amber-500 text-slate-950'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    {loc.label}
                  </button>
                ))}
              </div>

              {/* Peroxide Strength + Catalyst Type + Dye Swatches */}
              <div className="flex items-center gap-1.5 bg-slate-900/90 px-2 py-0.5 rounded border border-slate-800">
                <span className="text-[10px] font-bold text-sky-400">H₂O₂:</span>
                {[6, 20, 35, 50].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => onUpdateConfig({ peroxideConcentration: pct })}
                    className={`px-1.5 py-0.5 text-[10px] font-bold rounded transition-colors whitespace-nowrap ${
                      config.peroxideConcentration === pct
                        ? 'bg-sky-500 text-slate-950'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    {pct}%
                  </button>
                ))}

                <span className="text-slate-700">|</span>

                <button
                  type="button"
                  onClick={() => onUpdateConfig({ catalystType: 'yeast' })}
                  className={`px-1.5 py-0.5 text-[10px] font-bold rounded whitespace-nowrap ${
                    config.catalystType === 'yeast'
                      ? 'bg-amber-500 text-slate-950'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Yeast
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateConfig({ catalystType: 'potassium_iodide' })}
                  className={`px-1.5 py-0.5 text-[10px] font-bold rounded whitespace-nowrap ${
                    config.catalystType === 'potassium_iodide'
                      ? 'bg-amber-500 text-slate-950'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  KI
                </button>

                <span className="text-slate-700 hidden sm:inline">|</span>

                <div className="hidden sm:flex items-center gap-1">
                  {(Object.keys(DYE_COLORS) as DyeColorId[]).map((dyeId) => (
                    <button
                      key={dyeId}
                      type="button"
                      onClick={() => onUpdateConfig({ dyeColor: dyeId })}
                      title={DYE_COLORS[dyeId].label}
                      className={`w-3 h-3 rounded-full border transition-transform ${
                        config.dyeColor === dyeId
                          ? 'border-white scale-125'
                          : 'border-slate-700 opacity-70 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: DYE_COLORS[dyeId].hex }}
                    />
                  ))}
                </div>
              </div>

              {/* Safety Gear Checkboxes + Walk to Locker */}
              <div className="flex items-center gap-1 bg-slate-900/90 px-2 py-0.5 rounded border border-slate-800">
                {(
                  [
                    { key: 'goggles', label: 'Goggles' },
                    { key: 'gloves', label: 'Gloves' },
                    { key: 'hazmatSuit', label: 'Hazmat' },
                  ] as { key: keyof SafetyGearState; label: string }[]
                ).map((item) => {
                  const checked = Boolean(safetyGear[item.key]);
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => onToggleSafetyGear(item.key)}
                      className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold transition-colors whitespace-nowrap ${
                        checked
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50'
                          : item.key === 'goggles'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/50'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {checked ? (
                        <CheckSquare className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
                      ) : (
                        <Square className="w-2.5 h-2.5 text-rose-400 shrink-0" />
                      )}
                      <span>{item.label}</span>
                    </button>
                  );
                })}
                {!safetyAssessment.isCompliant && (
                  <button
                    type="button"
                    onClick={onTriggerScientistFetchSafety}
                    className="flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded whitespace-nowrap"
                    title="Have your 3D Scientist walk over to the Safety Locker and equip all gear!"
                  >
                    <Footprints className="w-2.5 h-2.5" />
                    <span>Walk & Equip</span>
                  </button>
                )}
              </div>

              {/* Camera & AR Toggles */}
              <div className="hidden xl:flex items-center gap-1 bg-slate-900/90 px-2 py-0.5 rounded border border-slate-800">
                <button
                  type="button"
                  onClick={onToggleArMeasures}
                  className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold transition-colors whitespace-nowrap ${
                    showArMeasures
                      ? 'bg-sky-500/20 text-sky-300 border border-sky-400/60'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Ruler className="w-2.5 h-2.5" />
                  <span>AR</span>
                </button>
                <Eye className="w-2.5 h-2.5 text-slate-400 ml-0.5" />
                {(
                  [
                    { id: 'orbit_overview', label: 'Orbit' },
                    { id: 'vessel_closeup', label: 'Close' },
                    { id: 'vr_first_person', label: 'VR' },
                    { id: 'aerial_drone', label: 'Drone' },
                  ] as { id: CameraPresetId; label: string }[]
                ).map((cam) => (
                  <button
                    key={cam.id}
                    type="button"
                    onClick={() => onSelectCameraPreset(cam.id)}
                    className={`px-1 py-0.5 rounded text-[10px] font-medium transition-colors whitespace-nowrap ${
                      cameraPreset === cam.id
                        ? 'bg-slate-800 text-white font-semibold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {cam.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={onToggleMute}
                  className="p-0.5 text-slate-300 hover:text-white"
                  title={isMuted ? 'Unmute Lab Sound' : 'Mute Lab Sound'}
                >
                  {isMuted ? (
                    <VolumeX className="w-3 h-3 text-rose-400" />
                  ) : (
                    <Volume2 className="w-3 h-3 text-emerald-400" />
                  )}
                </button>
              </div>
            </>
          )}
        </div>

        {/* STRIP 2: MAIN FULL-WIDTH 4-BOTTLE INGREDIENT BENCH + SEND IT! (All 4 Bottles 100% Visible!) */}
        <div
          className="border border-slate-700 rounded-b-xl shadow-2xl px-2.5 py-2 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2"
          style={{ backgroundColor: 'rgba(15, 23, 42, 0.96)' }}
        >
          {/* FULL 4-COLUMN GRID FOR ALL 4 INGREDIENT BOTTLES (Never hidden or clipped!) */}
          <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-2 min-w-0">
            {ingredientCards.map((card) => {
              const isEngaged = activePhraseStep === card.step;
              return (
                <div
                  key={card.step}
                  onPointerDown={(e) => {
                    // Ignore if clicking the Walk & Fetch sub-button
                    if ((e.target as HTMLElement).closest('[data-fetch-btn="true"]')) return;
                    e.preventDefault();
                    onBeginPourPhrase(card.step, e);
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onBeginPourPhrase(card.step, e as unknown as React.PointerEvent);
                    }
                  }}
                  style={{ touchAction: 'none' }}
                  className={`cursor-grab active:cursor-grabbing select-none px-2.5 py-1.5 rounded-lg border transition-transform flex flex-col justify-between min-w-0 ${
                    isEngaged ? 'scale-[1.03] ring-2 ring-amber-400' : ''
                  } ${card.colorClass}`}
                >
                  <div className="flex items-center justify-between gap-1 min-w-0">
                    <span className="text-xs font-extrabold leading-none flex items-center gap-1 truncate">
                      <GripVertical className="w-3 h-3 opacity-60 shrink-0" />
                      <span className="px-1 py-0.5 rounded bg-slate-950/70 text-[10px] font-mono-tabular text-amber-300 shrink-0">
                        #{card.numberBadge}
                      </span>
                      <span className="truncate">{card.title}</span>
                    </span>

                    <button
                      type="button"
                      data-fetch-btn="true"
                      onClick={(e) => {
                        e.stopPropagation();
                        onTriggerScientistFetchStep(card.step);
                      }}
                      className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-slate-950/90 hover:bg-amber-500 hover:text-slate-950 text-[9px] font-bold text-amber-300 border border-amber-400/40 transition-colors whitespace-nowrap shrink-0"
                      title={`Have your 3D Scientist walk over to the Supply Cart to grab ${card.title}!`}
                    >
                      <Footprints className="w-2.5 h-2.5" />
                      <span>Fetch</span>
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-1 text-[10px] font-mono-tabular mt-1">
                    <span className="font-bold truncate">
                      {isEngaged ? 'POURING...' : card.measuredBadge}
                    </span>
                    <span className="text-[9px] opacity-75 hidden xl:inline whitespace-nowrap">
                      {card.subtitle}
                    </span>
                  </div>

                  {/* Mini Graduated Fill Bar inside the bottle card */}
                  <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden mt-1">
                    <div
                      className="h-full transition-all duration-75"
                      style={{
                        width: `${card.fillPct}%`,
                        backgroundColor: card.barColor,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* RIGHT ACTION CLUSTER: Empty 0L, SEND IT!, Hose Down, Snap Photo, & Report */}
          <div className="flex items-center justify-end gap-1.5 shrink-0">
            <button
              type="button"
              onClick={onEmptyContainer}
              className="px-2.5 py-2 rounded-lg bg-slate-900 hover:bg-rose-500/20 border border-slate-700 hover:border-rose-500/50 text-rose-300 text-xs font-bold flex items-center gap-1 whitespace-nowrap shrink-0"
              title="Empty Container to 0 L"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>0L</span>
            </button>

            <button
              type="button"
              onClick={onTriggerEruption}
              className="flex items-center justify-center gap-1.5 py-2 px-4 text-xs sm:text-sm font-extrabold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg shadow-lg transition-transform active:scale-95 whitespace-nowrap shrink-0"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>SEND IT!</span>
            </button>

            <button
              type="button"
              onClick={onHoseCleanup}
              className="p-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-emerald-300 rounded-lg border border-slate-700 transition-colors"
              title="Hose Down Collected Foam"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onSnapPhoto}
              className="p-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-sky-300 rounded-lg border border-slate-700 transition-colors"
              title="Snap 3D Photo"
            >
              <Camera className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => setIsSideReportOpen((prev) => !prev)}
              className={`flex items-center gap-1 px-2.5 py-2 text-xs font-bold rounded-lg border transition-colors whitespace-nowrap ${
                isSideReportOpen
                  ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                  : 'bg-slate-800 border-slate-700 text-slate-200 hover:text-white'
              }`}
              title="Toggle Side Science Report Clipboard"
            >
              <FileText className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Report</span>
              {safetyAssessment.isCompliant ? (
                <ShieldCheck className="w-3 h-3 text-emerald-400" />
              ) : null}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
