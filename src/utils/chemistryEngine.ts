import { runReactionModel, soapQualityFactor as soapQualityFactorFor } from './reactionModel';
import {
  DyeColorId,
  ExperimentConfig,
  IngredientStep,
  LabLocationId,
  LabLocationSpec,
  LabMishap,
  PresetExperiment,
  ReactionSimulationResult,
  ReactionTimeSeries,
  SafetyGearState,
  SafetyHazardAssessment,
  ScaleEnvironmentId,
  ScaleEnvironmentSpec,
} from '../types/chemistry';

export const LAB_LOCATIONS: Record<LabLocationId, LabLocationSpec> = {
  crunchlabs_warehouse: {
    id: 'crunchlabs_warehouse',
    name: 'CrunchLabs Engineering Warehouse',
    shortName: 'CrunchLabs Studio',
    subtitle: 'Mark Rober’s Indoor Prototype Bay · Blueprints & Tool Chests',
    skyHex: 0x0f172a,
    fogHex: 0x0f172a,
    fogDensity: 0.007,
    groundColorHex: 0x1e293b,
  },
  suburban_backyard: {
    id: 'suburban_backyard',
    name: 'Sunny Backyard Lawn & Patio',
    shortName: 'Backyard Lawn',
    subtitle: 'Suburban Grass Yard · Wood Fence & Phat Gus’s Tree Stump',
    skyHex: 0x0284c7,
    fogHex: 0x38bdf8,
    fogDensity: 0.0055,
    groundColorHex: 0x14532d,
  },
  science_gymnasium: {
    id: 'science_gymnasium',
    name: 'School Science Fair Gymnasium',
    shortName: 'Science Fair Gym',
    subtitle: 'Hardwood Basketball Court · 3.0m Hoop & Bleachers',
    skyHex: 0x1e1b4b,
    fogHex: 0x1e1b4b,
    fogDensity: 0.0065,
    groundColorHex: 0x78350f,
  },
  desert_proving_ground: {
    id: 'desert_proving_ground',
    name: 'Mojave Desert Blast Canyon',
    shortName: 'Desert Canyon',
    subtitle: 'Red-Rock Quarry Proving Ground · Golden Hour Canyon',
    skyHex: 0x7c2d12,
    fogHex: 0x9a3412,
    fogDensity: 0.006,
    groundColorHex: 0x7c2d12,
  },
};

export const SCALE_ENVIRONMENTS: Record<ScaleEnvironmentId, ScaleEnvironmentSpec> = {
  lab_beaker: {
    id: 'lab_beaker',
    name: 'Laboratory Beaker Rig',
    subtitle: '2.0 L Borosilicate Vessel · Precision Bench',
    vesselCapacityLiters: 2,
    baseHeightMultiplier: 1.0,
    nozzleConstrictionFactor: 1.35,
    recommendedDistanceMeters: 2,
    description:
      'Standard benchtop graduated borosilicate vessel with magnetic stirrer and thermal probe for controlled stoichiometry tests.',
    realWorldFact:
      'Science Bob and Mark Rober ran over 150 small-scale bench tests to find out how altering dish soap by just 10 mL completely changes foam density.',
  },
  kiddie_pool: {
    id: 'kiddie_pool',
    name: 'Backyard Kiddie Pool',
    subtitle: '450 L Multi-Ring Pool · Gantry Trough Drop',
    vesselCapacityLiters: 450,
    baseHeightMultiplier: 3.4,
    nozzleConstrictionFactor: 0.95,
    recommendedDistanceMeters: 6,
    description:
      '3-meter wide inflatable pool fed by an overhead mechanical dump trough that tips catalyst evenly across the peroxide bath.',
    realWorldFact:
      'Changing chemical temperature by a few degrees or mixing time by 3 seconds meant the difference between filling the pool and burying the backyard.',
  },
  steel_flask: {
    id: 'steel_flask',
    name: 'Giant Steel Flask Volcano',
    subtitle: '2,200 L Welded Cone · Orbeez Booster Tank',
    vesselCapacityLiters: 2200,
    baseHeightMultiplier: 8.5,
    nozzleConstrictionFactor: 2.4,
    recommendedDistanceMeters: 15,
    description:
      'Towering structural steel Erlenmeyer volcano with a pressurized Orbeez water-bead injection manifold to constrict and accelerate the plume.',
    realWorldFact:
      'To build the World’s Tallest Elephant Toothpaste Volcano, Rober’s team welded a giant steel flask and injected thousands of Orbeez to push the foam jet skyward.',
  },
  outdoor_crater: {
    id: 'outdoor_crater',
    name: 'Outdoor Blast Crater',
    subtitle: '5,000 L Devil’s Toothpaste Bunker · Remote Drop',
    vesselCapacityLiters: 5000,
    baseHeightMultiplier: 12.0,
    nozzleConstrictionFactor: 1.85,
    recommendedDistanceMeters: 25,
    description:
      'Excavated quarry crater housing the reinforced trapezoidal Devil’s Toothpaste reaction vat and pneumatic remote-controlled catalyst release.',
    realWorldFact:
      'Devil’s Toothpaste took 8 months, 150 tests, and over 1,000 engineering hours to design a remote mechanical rig that dumps catalyst without putting humans in the blast zone.',
  },
};

export const DYE_COLORS: Record<
  DyeColorId,
  { label: string; hex: string; secondaryHex: string; accentHex: string }
> = {
  rober_blue: {
    label: 'Rober Cyan Blue',
    hex: '#38bdf8',
    secondaryHex: '#0284c7',
    accentHex: '#e0f2fe',
  },
  crimson_red: {
    label: 'Volcano Crimson',
    hex: '#f43f5e',
    secondaryHex: '#e11d48',
    accentHex: '#ffe4e6',
  },
  emerald_green: {
    label: 'Catalyst Emerald',
    hex: '#34d399',
    secondaryHex: '#059669',
    accentHex: '#d1fae5',
  },
  amber_gold: {
    label: 'Iodide Gold',
    hex: '#fbbf24',
    secondaryHex: '#d97706',
    accentHex: '#fef3c7',
  },
  ' classic_white': {
    label: 'Pure Oxygen White',
    hex: '#f8fafc',
    secondaryHex: '#cbd5e1',
    accentHex: '#ffffff',
  },
};

export const INGREDIENT_META: Record<
  IngredientStep,
  { label: string; shortLabel: string; formula: string; role: string; color: string }
> = {
  peroxide: {
    label: 'Hydrogen Peroxide',
    shortLabel: 'H₂O₂ Peroxide',
    formula: '2 H₂O₂ (aq)',
    role: 'Primary oxidizer & oxygen gas fuel source',
    color: '#38bdf8',
  },
  soap: {
    label: 'Dish Soap Surfactant',
    shortLabel: 'Dish Soap',
    formula: 'R-SO₃⁻Na⁺',
    role: 'Forms viscoelastic micelles that trap O₂ gas bubbles',
    color: '#34d399',
  },
  orbeez: {
    label: 'Orbeez Water Beads',
    shortLabel: 'Orbeez Beads',
    formula: 'Polyacrylate Gel',
    role: 'Increases momentum & nozzle constriction in the plume',
    color: '#c084fc',
  },
  catalyst: {
    label: 'Chemical Catalyst',
    shortLabel: 'Catalyst (KI / Yeast)',
    formula: 'I⁻ / Catalase',
    role: 'Lowers activation energy to rapidly strip O atoms from H₂O₂',
    color: '#f59e0b',
  },
};

export const PRESET_EXPERIMENTS: PresetExperiment[] = [
  {
    id: 'classroom_yeast',
    name: 'Classroom 6% Yeast Demo',
    badge: 'Starter Lab',
    description: 'Standard 6% hydrogen peroxide with warm active yeast in a 2L laboratory beaker. Drag & drop more scoops or check your safety goggles!',
    config: {
      scaleId: 'lab_beaker',
      peroxideConcentration: 6,
      peroxideVolumePercent: 50,
      catalystType: 'yeast',
      catalystRatio: 70,
      soapVolumeMlPerLiter: 44,
      orbeezCount: 0,
      chemicalTempCelsius: 30,
      dyeColor: 'rober_blue',
      includeOrbeez: false,
      additionOrder: ['peroxide', 'soap', 'catalyst'],
      pouredLog: [
        { id: 'init_1', step: 'peroxide', amountLabel: '1.0 L (50% full) of 6% H₂O₂ Peroxide', timestamp: 'Start' },
        { id: 'init_2', step: 'soap', amountLabel: '44 mL/L Dish Soap (2 squirts — Golden Ratio!)', timestamp: 'Start' },
        { id: 'init_3', step: 'catalyst', amountLabel: '70% Warm Yeast Catalyst (2 scoops)', timestamp: 'Start' },
      ],
    },
    // Unforced safety gear by default so the child remembers (or forgets!) to put on Goggles & Gloves!
    safetyGear: {
      goggles: false,
      gloves: false,
      hazmatSuit: false,
      remoteTriggerArmed: false,
      standBackMeters: 2,
    },
  },
  {
    id: 'wrong_order_fizz',
    name: 'Botched Order: Catalyst Before Soap',
    badge: 'Order Mistake',
    description:
      'What happens when you dump Potassium Iodide into 30% Peroxide BEFORE adding Dish Soap? Violent oxygen boil-off without foam!',
    config: {
      scaleId: 'kiddie_pool',
      peroxideConcentration: 30,
      peroxideVolumePercent: 75,
      catalystType: 'potassium_iodide',
      catalystRatio: 70,
      soapVolumeMlPerLiter: 44,
      orbeezCount: 0,
      chemicalTempCelsius: 35,
      dyeColor: 'amber_gold',
      includeOrbeez: false,
      additionOrder: ['peroxide', 'catalyst', 'soap'],
      pouredLog: [
        { id: 'p_1', step: 'peroxide', amountLabel: '337.5 L (75% full) of 30% H₂O₂ Peroxide', timestamp: 'Step 1' },
        { id: 'p_2', step: 'catalyst', amountLabel: '70% Potassium Iodide BEFORE Soap (Mistake!)', timestamp: 'Step 2' },
        { id: 'p_3', step: 'soap', amountLabel: '44 mL/L Dish Soap (Added too late!)', timestamp: 'Step 3' },
      ],
    },
    safetyGear: {
      goggles: false,
      gloves: true,
      hazmatSuit: false,
      remoteTriggerArmed: false,
      standBackMeters: 4,
    },
  },
  {
    id: 'steam_vaporization_flash',
    name: '50% Peroxide Steam Flash',
    badge: 'Too Little Soap',
    description:
      'Replicates Rober’s behind-the-scenes test where 50% H₂O₂ + KI with only 1 tiny squirt of soap generated >105°C heat and flashed straight to steam!',
    config: {
      scaleId: 'kiddie_pool',
      peroxideConcentration: 50,
      peroxideVolumePercent: 75,
      catalystType: 'potassium_iodide',
      catalystRatio: 100,
      soapVolumeMlPerLiter: 18,
      orbeezCount: 0,
      chemicalTempCelsius: 48,
      dyeColor: ' classic_white',
      includeOrbeez: false,
      additionOrder: ['peroxide', 'soap', 'catalyst'],
      pouredLog: [
        { id: 's_1', step: 'peroxide', amountLabel: '337.5 L of 50% Industrial H₂O₂', timestamp: 'Step 1' },
        { id: 's_2', step: 'soap', amountLabel: 'Only 18 mL/L Dish Soap (Too Little!)', timestamp: 'Step 2' },
        { id: 's_3', step: 'catalyst', amountLabel: '100% Potassium Iodide Dump', timestamp: 'Step 3' },
      ],
    },
    safetyGear: {
      goggles: true,
      gloves: true,
      hazmatSuit: true,
      remoteTriggerArmed: true,
      standBackMeters: 12,
    },
  },
  {
    id: 'volcano_orbeez_record',
    name: 'World’s Tallest Steel Volcano',
    badge: '20m Nozzle Jet',
    description:
      'Giant welded steel flask loaded with 35% H₂O₂, precision soap ratio, Orbeez water beads, and Potassium Iodide.',
    config: {
      scaleId: 'steel_flask',
      peroxideConcentration: 35,
      peroxideVolumePercent: 100,
      catalystType: 'potassium_iodide',
      catalystRatio: 100,
      soapVolumeMlPerLiter: 44,
      orbeezCount: 5000,
      chemicalTempCelsius: 32,
      dyeColor: 'crimson_red',
      includeOrbeez: true,
      additionOrder: ['peroxide', 'soap', 'orbeez', 'catalyst'],
      pouredLog: [
        { id: 'v_1', step: 'peroxide', amountLabel: '2,200 L (100% full) of 35% H₂O₂', timestamp: 'Step 1' },
        { id: 'v_2', step: 'soap', amountLabel: '44 mL/L Dish Soap (Golden Ratio)', timestamp: 'Step 2' },
        { id: 'v_3', step: 'orbeez', amountLabel: '5,000 Hydrated Orbeez Beads', timestamp: 'Step 3' },
        { id: 'v_4', step: 'catalyst', amountLabel: '100% Potassium Iodide Dump', timestamp: 'Step 4' },
      ],
    },
    safetyGear: {
      goggles: true,
      gloves: true,
      hazmatSuit: true,
      remoteTriggerArmed: true,
      standBackMeters: 18,
    },
  },
  {
    id: 'devils_toothpaste_crater',
    name: 'Devil’s Toothpaste World Record',
    badge: 'Maximum Scale',
    description:
      '5,000L outdoor blast crater bunker with 50% H₂O₂, remote pneumatic KI dump, and optimal surfactant balance.',
    config: {
      scaleId: 'outdoor_crater',
      peroxideConcentration: 50,
      peroxideVolumePercent: 100,
      catalystType: 'potassium_iodide',
      catalystRatio: 100,
      soapVolumeMlPerLiter: 44,
      orbeezCount: 7500,
      chemicalTempCelsius: 34,
      dyeColor: 'rober_blue',
      includeOrbeez: true,
      additionOrder: ['peroxide', 'soap', 'orbeez', 'catalyst'],
      pouredLog: [
        { id: 'd_1', step: 'peroxide', amountLabel: '5,000 L (100% full) of 50% Devil’s Grade H₂O₂', timestamp: 'Step 1' },
        { id: 'd_2', step: 'soap', amountLabel: '44 mL/L Dish Soap (Golden Ratio)', timestamp: 'Step 2' },
        { id: 'd_3', step: 'orbeez', amountLabel: '7,500 Hydrated Orbeez Beads', timestamp: 'Step 3' },
        { id: 'd_4', step: 'catalyst', amountLabel: '100% Remote Pneumatic KI Dump', timestamp: 'Step 4' },
      ],
    },
    safetyGear: {
      goggles: true,
      gloves: true,
      hazmatSuit: true,
      remoteTriggerArmed: true,
      standBackMeters: 28,
    },
  },
];

export function evaluateSafetyHazards(
  config: ExperimentConfig,
  gear: SafetyGearState
): SafetyHazardAssessment {
  const scale = SCALE_ENVIRONMENTS[config.scaleId];
  const conc = config.peroxideConcentration;
  const isKI = config.catalystType === 'potassium_iodide';

  let riskScore = 10;
  riskScore += ((conc - 3) / 47) * 55;
  if (isKI) riskScore += 12;
  if (config.scaleId === 'kiddie_pool') riskScore += 8;
  if (config.scaleId === 'steel_flask') riskScore += 16;
  if (config.scaleId === 'outdoor_crater') riskScore += 24;
  if (config.chemicalTempCelsius > 38) riskScore += 8;
  riskScore = Math.min(100, Math.round(riskScore));

  let riskLevel: SafetyHazardAssessment['riskLevel'] = 'LOW';
  if (riskScore >= 75) riskLevel = 'EXTREME';
  else if (riskScore >= 50) riskLevel = 'HIGH';
  else if (riskScore >= 25) riskLevel = 'MODERATE';

  const requiresGoggles = true; // Always required in chemistry lab
  const requiresGloves = conc >= 6 || isKI;
  const requiresHazmat = conc >= 25 || config.scaleId === 'steel_flask' || config.scaleId === 'outdoor_crater';
  const requiresRemoteTrigger =
    conc >= 30 || config.scaleId === 'steel_flask' || config.scaleId === 'outdoor_crater';

  const minSafeDistanceMeters = Math.max(
    scale.recommendedDistanceMeters,
    conc >= 35 ? Math.round(scale.recommendedDistanceMeters * 1.25) : scale.recommendedDistanceMeters
  );

  const missingPrecautions: string[] = [];
  if (requiresGoggles && !gear.goggles) {
    missingPrecautions.push('Equip Chemical Splash Goggles (corneal oxidizer hazard)');
  }
  if (requiresGloves && !gear.gloves) {
    missingPrecautions.push('Equip Nitrile/Neoprene Gloves (H₂O₂ skin bleaching & burn risk)');
  }
  if (requiresHazmat && !gear.hazmatSuit) {
    missingPrecautions.push('Equip Thermal Hazmat Suit (>90°C exothermic steam & caustic splatter)');
  }
  if (requiresRemoteTrigger && !gear.remoteTriggerArmed) {
    missingPrecautions.push('Enable Remote Mechanical Dump Trigger (blast zone hazard)');
  }
  if (gear.standBackMeters < minSafeDistanceMeters) {
    missingPrecautions.push(
      `Increase avatar standoff distance to ≥ ${minSafeDistanceMeters}m (currently ${gear.standBackMeters}m)`
    );
  }

  const activeWarnings: string[] = [];
  if (conc >= 35) {
    activeWarnings.push(
      `HIGH-STRENGTH OXIDIZER (${conc}% H₂O₂): Industrial-grade hydrogen peroxide causes severe chemical burns on contact and boils violently above 95°C.`
    );
  } else if (conc >= 12) {
    activeWarnings.push(
      `CORROSIVE PEROXIDE (${conc}% H₂O₂): Concentrated solution irritates mucous membranes and bleaches skin on contact.`
    );
  }

  if (isKI && conc >= 25) {
    activeWarnings.push(
      'RAPID EXOTHERMIC RUNAWAY: Potassium Iodide (I⁻) triggers instantaneous O₂ release (-98.2 kJ/mol). Unreacted peroxide may be aerosolized in the steam plume.'
    );
  }

  if (config.scaleId === 'outdoor_crater' || config.scaleId === 'steel_flask') {
    activeWarnings.push(
      'BLAST PERIMETER ACTIVE: High-volume vessel generates rapid pressure expansion. Never dump catalyst by hand—use the remote gantry release.'
    );
  }

  let chemicalEducationNote =
    'Standard 3%–6% household peroxide with yeast produces warm, touch-safe soapy water foam (~40°C).';
  if (conc >= 30) {
    chemicalEducationNote =
      'While the finished foam is mostly soapy water and trace iodine, unreacted 30%–50% H₂O₂ and >100°C steam require full hazmat PPE before hosing down the drain.';
  } else if (conc >= 12) {
    chemicalEducationNote =
      '12%–25% peroxide releases significant exothermic heat (~65°C–85°C) and iodine vapor tint. Always wear splash goggles and chemical gloves.';
  }

  return {
    riskLevel,
    riskScore,
    requiresGoggles,
    requiresGloves,
    requiresHazmat,
    requiresRemoteTrigger,
    minSafeDistanceMeters,
    isCompliant: missingPrecautions.length === 0,
    missingPrecautions,
    activeWarnings,
    chemicalEducationNote,
  };
}

export function simulateReactionPhysics(config: ExperimentConfig): ReactionSimulationResult {
  const series = runReactionModel(config);
  return { ...classifyOutcome(config, series), timeSeries: series };
}

/**
 * Picks the outcome story (empty vessel, order mistake, steam flash, sludge, geyser...) and
 * fills in its numbers from the time-stepped reaction model.
 */
function classifyOutcome(
  config: ExperimentConfig,
  series: ReactionTimeSeries
): ReactionSimulationResult {
  const scale = SCALE_ENVIRONMENTS[config.scaleId];
  const order = config.additionOrder;

  const hasPeroxide = order.includes('peroxide') && config.peroxideVolumePercent > 0;
  const hasCatalyst = order.includes('catalyst') && config.catalystRatio > 0;
  const hasSoap = order.includes('soap') && config.soapVolumeMlPerLiter >= 4;
  const hasOrbeez = order.includes('orbeez') && config.includeOrbeez && (config.orbeezCount ?? 2500) > 0;

  const soapIdx = order.indexOf('soap');
  const catalystIdx = order.indexOf('catalyst');

  // 0. Completely Empty Container!
  if (order.length === 0 || (!hasPeroxide && !hasCatalyst && !hasSoap && !hasOrbeez)) {
    return {
      outcomeMode: 'empty_vessel_crickets',
      outcomeTitle: 'Awkward Cricket Silence — Forgot to Pour Anything!',
      outcomeSummary:
        'The dump gantry flipped over an empty container! Even Phat Gus the Squirrel is confused.',
      chemistryExplanation:
        'You need fuel (Hydrogen Peroxide), bubble-maker (Dish Soap), and a spark (Catalyst) to make Elephant’s Toothpaste!',
      peakHeightMeters: 0,
      foamVolumeCubicMeters: 0,
      peakTempCelsius: config.chemicalTempCelsius,
      oxygenGasLiters: 0,
      eruptionVelocityMps: 0,
      foamTrapEfficiency: 0,
      steamIntensity: 0,
      fizzIntensity: 0,
      durationSeconds: 2.5,
      roberComparisonText: 'Blooper Reel #1: Pulling the detonation lever before loading the chemicals!',
    };
  }

  // 1. Only Dish Soap poured (Bubble Bath Fail!)
  if (!hasPeroxide && !hasCatalyst && hasSoap && !hasOrbeez) {
    return {
      outcomeMode: 'only_soap_bubble_bath',
      outcomeTitle: 'Squeaky Dish-Washing Puddle (Only Soap!)',
      outcomeSummary:
        'You squirted Dish Soap into the container without any Peroxide or Catalyst! Congratulations, you made a sink full of dishwater.',
      chemistryExplanation:
        'Dish soap traps gas bubbles, but it cannot create oxygen gas by itself—it needs Hydrogen Peroxide (H₂O₂) and a Catalyst!',
      peakHeightMeters: 0.08,
      foamVolumeCubicMeters: 0.01,
      peakTempCelsius: config.chemicalTempCelsius,
      oxygenGasLiters: 0,
      eruptionVelocityMps: 0.1,
      foamTrapEfficiency: 1,
      steamIntensity: 0,
      fizzIntensity: 0.05,
      durationSeconds: 3,
      roberComparisonText: 'Great for washing dishes, terrible for breaking world records!',
    };
  }

  // 1b. Only Orbeez poured!
  if (!hasPeroxide && !hasCatalyst && !hasSoap && hasOrbeez) {
    return {
      outcomeMode: 'only_orbeez_spill',
      outcomeTitle: 'Bouncy Orbeez Marble Spill (No Chemicals!)',
      outcomeSummary:
        'You dumped thousands of squishy Orbeez beads into a dry container with zero chemicals! Boing, boing, boing.',
      chemistryExplanation:
        'Orbeez are super-absorbent polymer beads that constrict the nozzle throat, but they need a chemical foam jet behind them!',
      peakHeightMeters: 0.15,
      foamVolumeCubicMeters: 0.01,
      peakTempCelsius: config.chemicalTempCelsius,
      oxygenGasLiters: 0,
      eruptionVelocityMps: 0.5,
      foamTrapEfficiency: 0,
      steamIntensity: 0,
      fizzIntensity: 0.2,
      durationSeconds: 3,
      roberComparisonText: 'Now we have to sweep up 10,000 bouncy water beads off the floor.',
    };
  }

  // 1c. Check if Peroxide is missing (e.g. Soap + Catalyst only)
  if (!hasPeroxide) {
    return {
      outcomeMode: 'no_peroxide_dud',
      outcomeTitle: 'Zero Boom — Forgot the Hydrogen Peroxide Fuel!',
      outcomeSummary:
        'You mixed Catalyst and Dish Soap together, but forgot the Hydrogen Peroxide! It’s like striking a match with no campfire wood.',
      chemistryExplanation:
        'Elephant’s Toothpaste works by ripping the extra oxygen atom off H₂O₂ (2H₂O₂ → 2H₂O + O₂). Without H₂O₂, there is zero oxygen gas to release!',
      peakHeightMeters: 0.06,
      foamVolumeCubicMeters: 0.01,
      peakTempCelsius: config.chemicalTempCelsius,
      oxygenGasLiters: 0,
      eruptionVelocityMps: 0.1,
      foamTrapEfficiency: 0,
      steamIntensity: 0,
      fizzIntensity: 0.05,
      durationSeconds: 3,
      roberComparisonText: 'Always drag & drop the Hydrogen Peroxide rocket fuel in first!',
    };
  }

  // 2. Check if Catalyst is missing (Peroxide + Soap sitting there doing nothing!)
  if (!hasCatalyst) {
    return {
      outcomeMode: 'no_catalyst_unreacted',
      outcomeTitle: 'The 6-Month Wait — Forgot to Drop the Catalyst!',
      outcomeSummary:
        '3... 2... 1... *Crickets chirping!* You loaded Peroxide and Soap, but forgot to drop the Catalyst! At this rate it will take 6 months to bubble.',
      chemistryExplanation:
        'Hydrogen Peroxide breaks down into water and oxygen naturally, but super slowly. Yeast or Potassium Iodide acts as the catalyst to speed it up 10,000×!',
      peakHeightMeters: 0.12,
      foamVolumeCubicMeters: 0.02,
      peakTempCelsius: config.chemicalTempCelsius + 0.5,
      oxygenGasLiters: 0.2,
      eruptionVelocityMps: 0.08,
      foamTrapEfficiency: 0.2,
      steamIntensity: 0,
      fizzIntensity: 0.1,
      durationSeconds: 3.5,
      roberComparisonText:
        'Drag & drop the Catalyst scoop into the container in Section 3 (Method)!',
    };
  }

  // Compute stoichiometric amounts
  const activeLiquidLiters = scale.vesselCapacityLiters * (config.peroxideVolumePercent / 100);
  // Molarity of H2O2: 3% is ~0.9M, 30% is ~9.8M, 50% is ~17.6M
  const molarity = (config.peroxideConcentration / 3) * 0.95;
  const totalMolesH2O2 = activeLiquidLiters * molarity;
  const catalystEfficiency =
    (config.catalystType === 'potassium_iodide' ? 1.35 : 0.62) *
    (0.35 + 0.65 * (config.catalystRatio / 100));

  // Numbers from the time-stepped reaction model (see reactionModel.ts)
  const peakTempCelsius = series.peakTempC;
  const oxygenGasLiters = series.totalOxygenLiters;

  // 3. Check Order of Addition Mistake: Catalyst added BEFORE Dish Soap, or No Dish Soap!
  const catalystBeforeSoap = !hasSoap || (catalystIdx !== -1 && soapIdx !== -1 && catalystIdx < soapIdx);
  if (catalystBeforeSoap) {
    const partialLateSoap = hasSoap && catalystIdx < soapIdx ? 0.14 : 0.03;
    const rawFizzHeight = series.peakHeightM;

    return {
      outcomeMode: 'catalyst_first_fizz_boiloff',
      outcomeTitle: !hasSoap
        ? 'Raw Oxygen Boil-Off — No Dish Soap Surfactant!'
        : 'Order Error: Catalyst Added Before Dish Soap!',
      outcomeSummary: !hasSoap
        ? 'Without dish soap, rapidly expanding O₂ gas escapes straight into the atmosphere as violent boiling fizz and steam!'
        : 'Because Catalyst met H₂O₂ before Dish Soap was mixed in, 85%+ of the oxygen gas boiled away into steam before soap micelles could trap it!',
      chemistryExplanation:
        'Sequence is critical: Dish soap must be thoroughly dissolved in the H₂O₂ first so surfactant molecules immediately coat every microscopic O₂ bubble at the moment of catalytic breakdown.',
      peakHeightMeters: Number(Math.max(0.25, rawFizzHeight).toFixed(2)),
      foamVolumeCubicMeters: Number(((oxygenGasLiters * partialLateSoap) / 1000).toFixed(2)),
      peakTempCelsius,
      oxygenGasLiters,
      eruptionVelocityMps: Number((rawFizzHeight * 1.8).toFixed(1)),
      foamTrapEfficiency: partialLateSoap,
      steamIntensity: series.steamIntensity,
      fizzIntensity: 1.0,
      durationSeconds: 5.5,
      roberComparisonText:
        'When Rober’s team tested catalyst without pre-mixed surfactant, the vat boiled like a cauldron and vented pure oxygen and steam with almost zero foam.',
    };
  }

  // 4. Check Exothermic Steam Vaporization Flash (High H2O2 + KI + High Temp + Low Soap)
  if (series.boiled && config.soapVolumeMlPerLiter < 28) {
    const steamJetHeight = series.peakHeightM;

    return {
      outcomeMode: 'steam_flash_vaporization',
      outcomeTitle: 'Exothermic Steam Flash — Vaporized Before Foaming!',
      outcomeSummary: `Reaction reached ${peakTempCelsius}°C with insufficient surfactant (${config.soapVolumeMlPerLiter} mL/L), flashing water into a roaring steam geyser before foam walls could stabilize!`,
      chemistryExplanation:
        'At 35%–50% H₂O₂, exothermic decomposition releases 98.2 kJ/mol. Above 100°C with low soap film elasticity, liquid water flashes to steam and ruptures nascent bubbles.',
      peakHeightMeters: Number(steamJetHeight.toFixed(2)),
      foamVolumeCubicMeters: Number(((oxygenGasLiters * 0.18) / 1000).toFixed(2)),
      peakTempCelsius,
      oxygenGasLiters,
      eruptionVelocityMps: Number((steamJetHeight * 2.4).toFixed(1)),
      foamTrapEfficiency: 0.18,
      steamIntensity: 1.0,
      fizzIntensity: 0.95,
      durationSeconds: 6.5,
      roberComparisonText:
        'In Mark Rober’s behind-the-scenes tests with 50% peroxide, several prototypes reacted so violently they vaporized into a cloud of steam before any foam could form!',
    };
  }

  // 5. Dish soap precision curve (sweet spot ~45 mL/L) and the model's plume height
  const soapQualityFactor = soapQualityFactorFor(config.soapVolumeMlPerLiter);
  const rawPeakHeight = series.peakHeightM;

  const peakHeightMeters = Number(Math.max(0.3, rawPeakHeight).toFixed(2));
  const foamTrapEfficiency = Number(Math.min(0.98, Math.max(0.2, soapQualityFactor)).toFixed(2));
  const foamVolumeCubicMeters = Number(
    ((oxygenGasLiters * foamTrapEfficiency * 1.35) / 1000).toFixed(2)
  );
  const eruptionVelocityMps = Number(
    Math.min(48, Math.max(0.8, peakHeightMeters * 1.45 * catalystEfficiency)).toFixed(1)
  );

  // Check if Excessive Soap caused sluggish sludge
  if (config.soapVolumeMlPerLiter >= 75) {
    return {
      outcomeMode: 'sluggish_soap_sludge',
      outcomeTitle: 'Heavy Surfactant Overdose — Viscous Foam Sludge',
      outcomeSummary: `At ${config.soapVolumeMlPerLiter} mL/L of dish soap, excess surfactant weighs down the reaction, creating ultra-dense, slow-oozing lava foam instead of a high-altitude jet.`,
      chemistryExplanation:
        'Mark Rober and Science Bob proved that adding even 10–20 mL too much soap increases liquid film viscosity and mass, choking the vertical nozzle velocity.',
      peakHeightMeters,
      foamVolumeCubicMeters,
      peakTempCelsius,
      oxygenGasLiters,
      eruptionVelocityMps: Number((eruptionVelocityMps * 0.55).toFixed(1)),
      foamTrapEfficiency: 0.92,
      steamIntensity: Math.min(0.7, peakTempCelsius / 110),
      fizzIntensity: 0.4,
      durationSeconds: 11,
      roberComparisonText:
        'Like the Kiddie Pool overflow tests, heavy soap loads create a slow-moving wall of dense foam that creeps across the floor.',
    };
  }

  // Determine signature eruption tier
  if (config.scaleId === 'outdoor_crater' && config.peroxideConcentration >= 35) {
    return {
      outcomeMode: 'devils_toothpaste_detonation',
      outcomeTitle: 'Devil’s Toothpaste World-Record Eruption!',
      outcomeSummary: `Massive ${foamVolumeCubicMeters} m³ exothermic foam tsunami launching ${peakHeightMeters}m into the sky at ${eruptionVelocityMps} m/s!`,
      chemistryExplanation:
        'Concentrated H₂O₂ + Potassium Iodide in the trapezoidal crater vat liberates thousands of liters of O₂ gas in milliseconds, instantly trapped by optimal surfactant micelles.',
      peakHeightMeters,
      foamVolumeCubicMeters,
      peakTempCelsius,
      oxygenGasLiters,
      eruptionVelocityMps,
      foamTrapEfficiency,
      steamIntensity: Math.min(0.95, Math.max(0.25, (peakTempCelsius - 50) / 60)),
      fizzIntensity: 0.9,
      durationSeconds: 12,
      roberComparisonText:
        'Matches Mark Rober’s iconic Devil’s Toothpaste explosion—an avalanche of hot, soapy foam engulfing the entire blast zone!',
    };
  }

  if (config.scaleId === 'steel_flask' || peakHeightMeters >= 15) {
    return {
      outcomeMode: 'colossal_volcano_eruption',
      outcomeTitle: hasOrbeez
        ? 'Supersonic Orbeez & Foam Volcano Jet!'
        : 'Towering Steel Flask Volcano Eruption!',
      outcomeSummary: `Conical nozzle constriction propels a ${peakHeightMeters}m vertical column of ${
        hasOrbeez ? 'Orbeez-infused ' : ''
      }foam at ${eruptionVelocityMps} m/s!`,
      chemistryExplanation:
        'Narrowing the vessel throat (Venturi/nozzle effect) converts volumetric foam expansion into axial kinetic velocity, shooting the column high into the air.',
      peakHeightMeters,
      foamVolumeCubicMeters,
      peakTempCelsius,
      oxygenGasLiters,
      eruptionVelocityMps,
      foamTrapEfficiency,
      steamIntensity: Math.min(0.85, Math.max(0.15, (peakTempCelsius - 45) / 65)),
      fizzIntensity: 0.75,
      durationSeconds: 10,
      roberComparisonText:
        'Replicates the World’s Tallest Elephant Toothpaste Volcano where steel flask geometry and Orbeez pushed the plume to record heights.',
    };
  }

  return {
    outcomeMode: 'classic_foam_geyser',
    outcomeTitle: 'Optimal Elephant’s Toothpaste Eruption',
    outcomeSummary: `Clean catalytic breakdown producing a ${peakHeightMeters}m foam plume (${foamVolumeCubicMeters} m³) at ${peakTempCelsius}°C.`,
    chemistryExplanation: `2H₂O₂ decomposes via ${
      config.catalystType === 'potassium_iodide' ? 'iodide ion (I⁻)' : 'yeast catalase'
    } into H₂O + O₂(g), with ${config.soapVolumeMlPerLiter} mL/L surfactant trapping ${Math.round(
      foamTrapEfficiency * 100
    )}% of evolved gas.`,
    peakHeightMeters,
    foamVolumeCubicMeters,
    peakTempCelsius,
    oxygenGasLiters,
    eruptionVelocityMps,
    foamTrapEfficiency,
    steamIntensity: Math.min(0.75, Math.max(0.1, (peakTempCelsius - 40) / 70)),
    fizzIntensity: 0.55,
    durationSeconds: 8.5,
    roberComparisonText:
      'Balanced stoichiometry and addition order: Peroxide first, Dish Soap second, Catalyst dropped last.',
  };
}

/**
 * Evaluates hilarious slapstick mishaps when the child forgets safety gear or uses wild proportions!
 */
export function evaluateExperimentMishaps(
  config: ExperimentConfig,
  gear: SafetyGearState,
  result: ReactionSimulationResult
): LabMishap[] {
  const mishaps: LabMishap[] = [];
  const safety = evaluateSafetyHazards(config, gear);

  // 1. Forgot Splash Goggles! -> Soap & Foam Splat in the Eye!
  if (
    !gear.goggles &&
    (config.additionOrder.includes('soap') ||
      result.foamTrapEfficiency > 0 ||
      result.fizzIntensity > 0)
  ) {
    mishaps.push({
      id: 'soap_in_eye',
      title: 'SPLAT! Dish Soap & Foam in Your Eyes!',
      funnyDescription:
        'You forgot to check [ ] Splash Goggles! Bubbly dish soap and foam splattered right across your eyeballs!',
      reportBlooperLine:
        'Forgot Splash Goggles — Scientist got a faceful of squeaky dish soap bubbles in the eyes!',
    });
  }

  // 2. Forgot Nitrile Gloves! -> Hands dyed bright color & fizzy!
  if (!gear.gloves && config.additionOrder.length > 0) {
    const dyeName = DYE_COLORS[config.dyeColor].label;
    mishaps.push({
      id: 'dyed_fizzy_hands',
      title: `Tingly ${dyeName} Hands!`,
      funnyDescription: `You forgot to check [ ] Nitrile Gloves! Your bare hands got stained bright ${dyeName} and tingly from the peroxide!`,
      reportBlooperLine: `Forgot Nitrile Gloves — Scientist’s bare hands were dyed bright ${dyeName} for a week!`,
    });
  }

  // 3. Buried in a 3D Foam Snowman! (Big eruption without Hazmat Suit or standing too close)
  if (
    result.peakHeightMeters >= 2.5 &&
    (!gear.hazmatSuit || gear.standBackMeters < safety.minSafeDistanceMeters)
  ) {
    mishaps.push({
      id: 'foam_snowman_buried',
      title: 'Buried into a 3D Foam Snowman!',
      funnyDescription:
        'A giant warm wave of Elephant’s Toothpaste buried your 3D Scientist head-to-toe like a giant marshmallow snowman!',
      reportBlooperLine:
        'Stood in the blast zone without Hazmat gear — Scientist was buried inside a giant warm Foam Snowman!',
    });
  }

  // 4. Steam Flash Frizzy Eyebrows!
  if (result.outcomeMode === 'steam_flash_vaporization' && !gear.hazmatSuit) {
    mishaps.push({
      id: 'eyebrows_steamed',
      title: '100°C Steam Sauna Hairdo!',
      funnyDescription:
        '50% Peroxide with too little soap flashed into a roaring steam geyser and gave your scientist poofy sauna hair!',
      reportBlooperLine:
        'Wrong Proportions (50% Peroxide + Too Little Soap) — Reaction flashed to >100°C steam and frizzed our eyebrows!',
    });
  }

  // 5. Wrong Proportions: Soap Overdose Slime Slug!
  if (result.outcomeMode === 'sluggish_soap_sludge' || config.soapVolumeMlPerLiter >= 75) {
    mishaps.push({
      id: 'slime_slug_overdose',
      title: `Giant Soap Slime Slug (${config.soapVolumeMlPerLiter} mL/L)!`,
      funnyDescription:
        'You squirted WAY too much Dish Soap! Instead of shooting into the sky, it oozed out like a giant heavy slime monster!',
      reportBlooperLine: `Wrong Proportions (${config.soapVolumeMlPerLiter} mL/L Dish Soap) — Overdosed surfactant weighed down the foam into slow lava sludge!`,
    });
  }

  // 6. Cricket Silence!
  if (
    result.outcomeMode === 'empty_vessel_crickets' ||
    result.outcomeMode === 'no_catalyst_unreacted' ||
    result.outcomeMode === 'no_peroxide_dud' ||
    result.outcomeMode === 'only_soap_bubble_bath'
  ) {
    mishaps.push({
      id: 'cricket_silence',
      title: 'Awkward Cricket Chirps!',
      funnyDescription: result.outcomeSummary,
      reportBlooperLine: `Missing Ingredient Blooper — ${result.outcomeTitle}`,
    });
  }

  return mishaps;
}

