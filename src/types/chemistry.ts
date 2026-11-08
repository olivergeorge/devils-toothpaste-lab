export type ScaleEnvironmentId =
  | 'lab_beaker'
  | 'kiddie_pool'
  | 'steel_flask'
  | 'outdoor_crater';

export type CatalystType = 'yeast' | 'potassium_iodide';

export type IngredientStep = 'peroxide' | 'soap' | 'orbeez' | 'catalyst';

export type DyeColorId = 'rober_blue' | 'crimson_red' | 'emerald_green' | 'amber_gold' | ' classic_white';

export type CameraPresetId = 'orbit_overview' | 'vessel_closeup' | 'vr_first_person' | 'aerial_drone';

export type ReactionOutcomeMode =
  | 'idle'
  | 'empty_vessel_crickets'
  | 'only_soap_bubble_bath'
  | 'only_orbeez_spill'
  | 'no_peroxide_dud'
  | 'no_catalyst_unreacted'
  | 'catalyst_first_fizz_boiloff'
  | 'steam_flash_vaporization'
  | 'sluggish_soap_sludge'
  | 'classic_foam_geyser'
  | 'colossal_volcano_eruption'
  | 'devils_toothpaste_detonation';

export interface LabMishap {
  id:
    | 'soap_in_eye'
    | 'dyed_fizzy_hands'
    | 'foam_snowman_buried'
    | 'eyebrows_steamed'
    | 'cricket_silence'
    | 'slime_slug_overdose';
  title: string;
  funnyDescription: string;
  reportBlooperLine: string;
}

export interface ScaleEnvironmentSpec {
  id: ScaleEnvironmentId;
  name: string;
  subtitle: string;
  vesselCapacityLiters: number;
  baseHeightMultiplier: number;
  nozzleConstrictionFactor: number;
  recommendedDistanceMeters: number;
  description: string;
  realWorldFact: string;
}

export interface SafetyGearState {
  goggles: boolean;
  gloves: boolean;
  hazmatSuit: boolean;
  remoteTriggerArmed: boolean;
  standBackMeters: number;
}

export interface SafetyHazardAssessment {
  riskLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'EXTREME';
  riskScore: number; // 0 to 100
  requiresGoggles: boolean;
  requiresGloves: boolean;
  requiresHazmat: boolean;
  requiresRemoteTrigger: boolean;
  minSafeDistanceMeters: number;
  isCompliant: boolean;
  missingPrecautions: string[];
  activeWarnings: string[];
  chemicalEducationNote: string;
}

export interface PouredStepRecord {
  id: string;
  step: IngredientStep;
  amountLabel: string;
  timestamp: string;
}

export interface ExperimentConfig {
  scaleId: ScaleEnvironmentId;
  peroxideConcentration: number; // 3% to 50%
  peroxideVolumePercent: number; // 0% to 125% of vessel capacity (measured via drag & drop!)
  catalystType: CatalystType;
  catalystRatio: number; // 0% to 100% stoichiometric loading (measured via drag & drop!)
  soapVolumeMlPerLiter: number; // 0 to 120 mL/L (measured via drag & drop squirts!)
  orbeezCount: number; // 0 to 10,000 beads (measured via drag & drop scoops!)
  chemicalTempCelsius: number; // 15°C to 55°C initial temp
  dyeColor: DyeColorId;
  includeOrbeez: boolean;
  additionOrder: IngredientStep[];
  pouredLog?: PouredStepRecord[];
}

export interface ReactionSimulationResult {
  outcomeMode: ReactionOutcomeMode;
  outcomeTitle: string;
  outcomeSummary: string;
  chemistryExplanation: string;
  peakHeightMeters: number;
  foamVolumeCubicMeters: number;
  peakTempCelsius: number;
  oxygenGasLiters: number;
  eruptionVelocityMps: number;
  foamTrapEfficiency: number; // 0 to 1
  steamIntensity: number; // 0 to 1
  fizzIntensity: number; // 0 to 1
  durationSeconds: number;
  roberComparisonText: string;
}

export interface PresetExperiment {
  id: string;
  name: string;
  badge: string;
  description: string;
  config: ExperimentConfig;
  safetyGear: SafetyGearState;
}

export interface CapturedPhoto {
  id: string;
  dataUrl: string;
  caption: string;
  timestamp: string;
  scaleId: ScaleEnvironmentId;
  peakHeightMeters: number;
}

export interface ScienceReport {
  id: string;
  title: string;
  scientistName: string;
  createdAt: string;
  aim: string;
  hypothesis: string;
  actualAmountsMeasured: string[];
  equipmentList: string[];
  safetyNotes: string;
  methodSteps: string[];
  whatReallyHappened: string;
  bloopersAndMishaps: string[];
  resultsSummary: string;
  conclusion: string;
  config: ExperimentConfig;
  safetyGear: SafetyGearState;
  telemetry: ReactionSimulationResult;
  photos: CapturedPhoto[];
}


