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
  GripVertical,
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
  LabMishap,
  ReactionSimulationResult,
  SafetyGearState,
  SafetyHazardAssessment,
  ScaleEnvironmentId,
} from '../types/chemistry';
import { DYE_COLORS, PRESET_EXPERIMENTS, SCALE_ENVIRONMENTS } from '../utils/chemistryEngine';

interface LiveScienceReportDockProps {
  scientistName: string;
  onChangeScientistName: (name: string) => void;
  config: ExperimentConfig;
  safetyGear: SafetyGearState;
  safetyAssessment: SafetyHazardAssessment;
  activeResult: ReactionSimulationResult | null;
  predictedResult: ReactionSimulationResult;
  /** The kid's bet from Call Your Shot (metres), or null if he hasn't made one. */
  yourGuessM?: number | null;
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
  onUpdateConfig: (partial: Partial<ExperimentConfig>) => void;
  onToggleSafetyGear: (key: keyof SafetyGearState) => void;
  onEquipAllSafety: () => void;
  activePhraseStep: IngredientStep | null;
  onBeginPourPhrase: (step: IngredientStep, e: React.PointerEvent) => void;
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
  yourGuessM = null,
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
  onUpdateConfig,
  onToggleSafetyGear,
  onEquipAllSafety,
  activePhraseStep,
  onBeginPourPhrase,
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

  const scaleSpec = SCALE_ENVIRONMENTS[config.scaleId];

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
    title: string;
    actionHint: string;
    measuredBadge: string;
    fillPct: number;
    barColor: string;
    colorClass: string;
  }[] = [
    {
      step: 'peroxide',
      title: 'H₂O₂ Peroxide',
      actionHint: 'Hold/Drag',
      measuredBadge: hasPeroxide ? `${measuredPeroxideLiters}L (${config.peroxideVolumePercent}%)` : '0L',
      fillPct: Math.min(100, (config.peroxideVolumePercent / 100) * 100),
      barColor: config.peroxideVolumePercent > 100 ? '#f43f5e' : '#38bdf8',
      colorClass: hasPeroxide
        ? 'border-sky-400 bg-sky-500/20 text-sky-100'
        : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-sky-500/60',
    },
    {
      step: 'soap',
      title: 'Dish Soap',
      actionHint: 'Hold/Drag',
      measuredBadge: hasSoap
        ? `${config.soapVolumeMlPerLiter}mL${
            config.soapVolumeMlPerLiter >= 75
              ? ' OVER!'
              : config.soapVolumeMlPerLiter < 28
              ? ' LOW'
              : ' SWEET!'
          }`
        : '0mL',
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
        : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-emerald-500/60',
    },
    {
      step: 'orbeez',
      title: 'Orbeez',
      actionHint: 'Hold/Drag',
      measuredBadge: hasOrbeez ? `${((config.orbeezCount || 0) / 1000).toFixed(1)}k` : '0',
      fillPct: Math.min(100, ((config.orbeezCount || 0) / 10000) * 100),
      barColor: '#c084fc',
      colorClass: hasOrbeez
        ? 'border-purple-400 bg-purple-500/20 text-purple-100'
        : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-purple-500/60',
    },
    {
      step: 'catalyst',
      title: 'Catalyst',
      actionHint: 'Hold/Drag',
      measuredBadge: hasCatalyst ? `${config.catalystRatio}%` : '0%',
      fillPct: Math.min(100, config.catalystRatio),
      barColor: '#f59e0b',
      colorClass: hasCatalyst
        ? 'border-amber-400 bg-amber-500/20 text-amber-100'
        : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-amber-500/60',
    },
  ];

  return (
    <>
      {/* 1. COMPACT RIGHT-SIDE LIVE SCIENCE REPORT CLIPBOARD (Never blocks the center 3D experiment!) */}
      <aside
        className="fixed top-14 right-3 z-20 w-[268px] sm:w-[288px] transition-transform duration-200 ease-out pointer-events-auto"
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
          className="border border-slate-700/90 rounded-xl shadow-2xl overflow-hidden max-h-[calc(100vh-175px)] flex flex-col"
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

            {/* 1. AIM & PREDICTION */}
            <div className="p-2 rounded-lg bg-slate-950/90 border border-slate-800/90 space-y-1">
              <div className="text-[10px] font-bold font-mono-tabular text-amber-400">
                1. AIM & PREDICTION
              </div>
              <p className="text-[11px] text-slate-300 leading-snug">
                Testing <strong className="text-white">{scaleSpec.name.replace(' Rig', '')}</strong>{' '}
                with <strong className="text-sky-300">{config.peroxideConcentration}% H₂O₂</strong>{' '}
                +{' '}
                <strong className="text-amber-300">
                  {config.catalystType === 'potassium_iodide' ? 'KI' : 'Yeast'}
                </strong>
                .{' '}
                {yourGuessM !== null ? (
                  <>
                    Your guess:{' '}
                    <strong className="text-amber-400">
                      {yourGuessM >= 10 ? Math.round(yourGuessM) : yourGuessM.toFixed(1)}m
                    </strong>
                    .
                  </>
                ) : (
                  <span className="text-sky-300">Make your guess with the rocket 🚀</span>
                )}
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
                    Empty! Hold or drag any bottle on the bottom bench to measure it in!
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
                  {activeResult ? 'UPDATED ✓' : 'NOT TESTED YET'}
                </span>
              </div>

              <div className="text-[11px] font-bold text-white leading-tight">
                {activeResult ? activeResult.outcomeTitle : 'Press SEND IT! to find out…'}
              </div>

              <div className="grid grid-cols-3 gap-1 text-center py-1 bg-slate-900 rounded border border-slate-800">
                <div>
                  <span className="text-[9px] text-slate-400 block">HEIGHT</span>
                  <span className="text-xs font-bold font-mono-tabular text-amber-400">
                    {activeResult ? `${activeResult.peakHeightMeters}m` : '?'}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 block">HEAT</span>
                  <span className="text-xs font-bold font-mono-tabular text-rose-400">
                    {activeResult ? `${activeResult.peakTempCelsius}°C` : '?'}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 block">FOAM</span>
                  <span className="text-xs font-bold font-mono-tabular text-sky-400">
                    {activeResult ? `${activeResult.foamVolumeCubicMeters}m³` : '?'}
                  </span>
                </div>
              </div>

              <div className="text-[10px] text-sky-300 text-center truncate">
                {activeResult ? getSquirrelComparison(activeResult.peakHeightMeters) : '…'}
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

      {/* 2. ULTRA-SLIM BOTTOM LAB BENCH BAR (~68px tall — leaves center 3D experiment 100% uncovered!) */}
      <div
        className="fixed inset-x-2 sm:inset-x-4 bottom-2 z-20 mx-auto max-w-[1160px] transition-transform duration-200 ease-out"
        style={{
          transform: isCollapsed ? 'translateY(calc(100% - 26px))' : 'translateY(0)',
        }}
      >
        {/* Top Micro-Lip for Collapse + Camera/AR Toggles */}
        <div className="flex items-center justify-between px-2">
          <button
            type="button"
            onClick={onToggleCollapse}
            className="flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-bold text-amber-300 border border-b-0 border-slate-700 rounded-t-md hover:text-white whitespace-nowrap shrink-0"
            style={{ backgroundColor: 'rgba(15, 23, 42, 0.95)' }}
          >
            <Sparkles className="w-3 h-3 text-amber-400" />
            <span>
              {isCollapsed
                ? 'Show Lab Bench Controls (H)'
                : 'HOLD OR DRAG BOTTLES UP TO THE 3D CONTAINER TO MEASURE IN!'}
            </span>
            {isCollapsed ? (
              <ChevronUp className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3 text-slate-400" />
            )}
          </button>

          {!isCollapsed && (
            <div
              className="hidden md:flex items-center gap-1.5 px-2.5 py-0.5 border border-b-0 border-slate-700 rounded-t-md text-[11px]"
              style={{ backgroundColor: 'rgba(15, 23, 42, 0.95)' }}
            >
              <button
                type="button"
                onClick={onToggleArMeasures}
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  showArMeasures
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-400/60'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Ruler className="w-3 h-3" />
                <span>AR Sensors: {showArMeasures ? 'ON' : 'OFF'}</span>
              </button>

              <span className="text-slate-700">|</span>

              <Eye className="w-3 h-3 text-slate-400" />
              {(
                [
                  { id: 'orbit_overview', label: 'Lab View' },
                  { id: 'vessel_closeup', label: 'Close-Up' },
                  { id: 'vr_first_person', label: 'VR Goggles' },
                  { id: 'aerial_drone', label: 'Drone' },
                ] as { id: CameraPresetId; label: string }[]
              ).map((cam) => (
                <button
                  key={cam.id}
                  type="button"
                  onClick={() => onSelectCameraPreset(cam.id)}
                  className={`px-1.5 py-0.5 rounded font-medium transition-colors whitespace-nowrap shrink-0 ${
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
                  <VolumeX className="w-3.5 h-3.5 text-rose-400" />
                ) : (
                  <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                )}
              </button>
            </div>
          )}
        </div>

        {/* Single-Row Slim Lab Bench Bar */}
        <div
          className="border border-slate-700 rounded-xl shadow-2xl px-3 py-2 flex flex-wrap lg:flex-nowrap items-center justify-between gap-2.5"
          style={{ backgroundColor: 'rgba(15, 23, 42, 0.95)' }}
        >
          {/* LEFT GROUP: Fuel Strength, Catalyst Type, Dye, & Safety Gear */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Peroxide Strength Pills */}
            <div className="flex items-center gap-1 bg-slate-950/90 px-2 py-1 rounded-lg border border-slate-800">
              <span className="text-[10px] font-bold text-sky-400 mr-0.5">H₂O₂:</span>
              {[6, 20, 35, 50].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => onUpdateConfig({ peroxideConcentration: pct })}
                  className={`px-1.5 py-0.5 text-[11px] font-bold rounded transition-colors whitespace-nowrap ${
                    config.peroxideConcentration === pct
                      ? 'bg-sky-500 text-slate-950'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {pct}%
                </button>
              ))}
            </div>

            {/* Catalyst Toggle */}
            <div className="flex items-center gap-1 bg-slate-950/90 px-2 py-1 rounded-lg border border-slate-800">
              <button
                type="button"
                onClick={() => onUpdateConfig({ catalystType: 'yeast' })}
                className={`px-1.5 py-0.5 text-[11px] font-semibold rounded whitespace-nowrap ${
                  config.catalystType === 'yeast'
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Yeast
              </button>
              <button
                type="button"
                onClick={() => onUpdateConfig({ catalystType: 'potassium_iodide' })}
                className={`px-1.5 py-0.5 text-[11px] font-semibold rounded whitespace-nowrap ${
                  config.catalystType === 'potassium_iodide'
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                KI
              </button>
            </div>

            {/* Dye Swatches */}
            <div className="hidden sm:flex items-center gap-1 bg-slate-950/90 px-2 py-1.5 rounded-lg border border-slate-800">
              {(Object.keys(DYE_COLORS) as DyeColorId[]).map((dyeId) => (
                <button
                  key={dyeId}
                  type="button"
                  onClick={() => onUpdateConfig({ dyeColor: dyeId })}
                  title={DYE_COLORS[dyeId].label}
                  className={`w-3.5 h-3.5 rounded-full border transition-transform ${
                    config.dyeColor === dyeId
                      ? 'border-white scale-125'
                      : 'border-slate-700 opacity-70 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: DYE_COLORS[dyeId].hex }}
                />
              ))}
            </div>

            {/* Safety Gear Toggles (Unforced — Forget Goggles = Soap in Eye!) */}
            <div className="flex items-center gap-1 bg-slate-950/90 px-2 py-1 rounded-lg border border-slate-800">
              {(
                [
                  { key: 'goggles', label: 'Goggles' },
                  { key: 'gloves', label: 'Gloves' },
                  { key: 'hazmatSuit', label: 'Hazmat' },
                  { key: 'remoteTriggerArmed', label: 'Remote' },
                ] as { key: keyof SafetyGearState; label: string }[]
              ).map((item) => {
                const checked = Boolean(safetyGear[item.key]);
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => onToggleSafetyGear(item.key)}
                    className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-semibold transition-colors whitespace-nowrap ${
                      checked
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50'
                        : item.key === 'goggles'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/50'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {checked ? (
                      <CheckSquare className="w-3 h-3 text-emerald-400 shrink-0" />
                    ) : (
                      <Square className="w-3 h-3 text-rose-400 shrink-0" />
                    )}
                    <span>{item.label}</span>
                  </button>
                );
              })}
              {!safetyAssessment.isCompliant && (
                <button
                  type="button"
                  onClick={onEquipAllSafety}
                  className="px-1.5 py-0.5 text-[10px] font-bold bg-emerald-500 text-slate-950 rounded whitespace-nowrap"
                  title="Check all safety gear"
                >
                  All Safe
                </button>
              )}
            </div>
          </div>

          {/* CENTER GROUP: 4 Pointer-Phrased Ingredient Bottles (Press & Hold OR Drag to Vessel!) */}
          <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
            {ingredientCards.map((card) => {
              const isEngaged = activePhraseStep === card.step;
              return (
                <div
                  key={card.step}
                  onPointerDown={(e) => {
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
                  className={`cursor-grab active:cursor-grabbing select-none px-2.5 py-1 rounded-lg border transition-transform flex flex-col justify-between min-w-[112px] whitespace-nowrap shrink-0 ${
                    isEngaged ? 'scale-105 ring-2 ring-amber-400' : ''
                  } ${card.colorClass}`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[11px] font-bold leading-none flex items-center gap-0.5">
                      <GripVertical className="w-3 h-3 opacity-60 shrink-0" />
                      <span>{card.title}</span>
                    </span>
                    <span className="text-[9px] font-mono-tabular px-1 py-0.5 rounded bg-slate-950/80 text-amber-300">
                      {isEngaged ? 'POURING...' : card.actionHint}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] font-mono-tabular opacity-95 mt-0.5">
                    <span>{card.measuredBadge}</span>
                  </div>
                  {/* Mini Graduated Fill Bar inside the bottle card */}
                  <div className="w-full h-1 bg-slate-950 rounded-full overflow-hidden mt-1">
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

            <button
              type="button"
              onClick={onEmptyContainer}
              className="px-2 py-1.5 rounded-lg bg-slate-900 hover:bg-rose-500/20 border border-slate-700 hover:border-rose-500/50 text-rose-300 text-[11px] font-semibold flex items-center gap-1 whitespace-nowrap shrink-0"
              title="Empty Container to 0 L"
            >
              <Trash2 className="w-3 h-3" />
              <span>0L</span>
            </button>
          </div>

          {/* RIGHT GROUP: SEND IT!, Hose Down, Snap Photo, & Toggle Report */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={onTriggerEruption}
              className="flex items-center justify-center gap-1.5 py-2 px-4 text-xs font-extrabold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg shadow-lg transition-transform active:scale-95 whitespace-nowrap"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>SEND IT!</span>
            </button>

            <button
              type="button"
              onClick={onHoseCleanup}
              className="p-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-emerald-300 rounded-lg transition-colors"
              title="Hose Down Foam"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={onSnapPhoto}
              className="p-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-sky-300 rounded-lg transition-colors"
              title="Snap 3D Photo"
            >
              <Camera className="w-3.5 h-3.5" />
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
              <span className="hidden xl:inline">Report</span>
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
