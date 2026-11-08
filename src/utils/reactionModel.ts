/**
 * Time-stepped stock-and-flow model of elephant's toothpaste.
 *
 * Stocks: peroxide left (mol), oxygen released (mol), foam above the vessel (L),
 * spray/steam plume (L) and liquid temperature (°C).
 * Flows: catalysed decomposition 2 H₂O₂ → 2 H₂O + O₂ (first order in peroxide,
 * Arrhenius in temperature), heat released by the reaction, cooling to the room,
 * boiling at 100 °C, soap trapping gas as foam, foam and spray collapsing.
 *
 * Pure functions only — no React, no Three.js.
 */
import type {
  ExperimentConfig,
  ReactionSample,
  ReactionTimeSeries,
  ScaleEnvironmentId,
} from '../types/chemistry';

const R_GAS = 8.314; // J/(mol·K)
const DELTA_H = 98_200; // J per mol H₂O₂ decomposed
const WATER_HEAT_CAPACITY = 4184; // J/(kg·K)
const LATENT_HEAT_STEAM = 2.26e6; // J/kg
const ROOM_TEMP_C = 20;
const STEAM_LITERS_PER_KG = 1700;

/** Per-catalyst kinetics: rate constant at 20 °C (1/s, full dose) and activation energy. */
export const CATALYSTS = {
  potassium_iodide: { k20: 0.03, activationEnergy: 56_000, denatureC: null },
  yeast: { k20: 0.22, activationEnergy: 20_000, denatureC: 58 },
} as const;

/** Uncatalysed peroxide barely decomposes: months, not seconds. */
const UNCATALYSED_K20 = 1e-7;

/** Vessel geometry used only to turn foam volume into a plume height. */
const GEOMETRY: Record<ScaleEnvironmentId, { base: number; nozzle: number; capacityL: number }> = {
  lab_beaker: { base: 1.0, nozzle: 1.35, capacityL: 2 },
  kiddie_pool: { base: 3.4, nozzle: 0.95, capacityL: 450 },
  steel_flask: { base: 8.5, nozzle: 2.4, capacityL: 2200 },
  outdoor_crater: { base: 12.0, nozzle: 1.85, capacityL: 5000 },
};

/** Height calibration: height = HEIGHT_C · geometry · (plume litres per litre of liquid)^HEIGHT_ALPHA. */
export const HEIGHT_C = 0.0123;
export const HEIGHT_ALPHA = 1.38;

const DT = 0.01;
const SAMPLE_EVERY = 0.1;
const T_MAX = 60;

/** How well dish soap turns gas into lasting foam (sweet spot ~45 mL/L). */
export function soapQualityFactor(soapMlPerLiter: number): number {
  if (soapMlPerLiter < 30) return Math.max(0.25, soapMlPerLiter / 35);
  if (soapMlPerLiter > 60) return Math.max(0.45, 1 - (soapMlPerLiter - 60) / 110);
  return 1.0 - (Math.abs(soapMlPerLiter - 45) / 30) * 0.15;
}

/** Catalyst activity multiplier from temperature (Arrhenius, and yeast cooking itself). */
export function catalystTemperatureFactor(
  catalyst: ExperimentConfig['catalystType'],
  tempC: number
): number {
  const spec = CATALYSTS[catalyst];
  const arrhenius = Math.exp(
    (spec.activationEnergy / R_GAS) * (1 / 293.15 - 1 / (tempC + 273.15))
  );
  const alive = spec.denatureC === null ? 1 : 1 / (1 + Math.exp((tempC - spec.denatureC) / 3));
  return arrhenius * alive;
}

interface ModelInputs {
  liquidL: number;
  peroxideMol: number;
  catalystDose: number; // 0 = none
  catalyst: ExperimentConfig['catalystType'];
  startTempC: number;
  trap: number; // fraction of gas held as foam
  foamLifetimeS: number;
  heightScale: number; // geometry × fill × orbeez
}

function inputsFromConfig(config: ExperimentConfig): ModelInputs {
  const order = config.additionOrder;
  const geo = GEOMETRY[config.scaleId];
  const hasPeroxide = order.includes('peroxide') && config.peroxideVolumePercent > 0;
  const hasCatalyst = order.includes('catalyst') && config.catalystRatio > 0;
  const hasSoap = order.includes('soap') && config.soapVolumeMlPerLiter >= 4;
  const hasOrbeez =
    order.includes('orbeez') && config.includeOrbeez && (config.orbeezCount ?? 2500) > 0;

  const liquidL = hasPeroxide ? geo.capacityL * (config.peroxideVolumePercent / 100) : 0;
  // 3 % is ~0.9 M, 30 % ~9.5 M, 50 % ~15.8 M
  const molarity = (config.peroxideConcentration / 3) * 0.95;

  const soapIdx = order.indexOf('soap');
  const catalystIdx = order.indexOf('catalyst');
  const catalystBeforeSoap =
    !hasSoap || (catalystIdx !== -1 && soapIdx !== -1 && catalystIdx < soapIdx);
  const soapQ = soapQualityFactor(config.soapVolumeMlPerLiter);
  const trap = !hasSoap ? 0.03 : catalystBeforeSoap ? 0.14 : soapQ;

  const orbeezBoost = hasOrbeez ? 1.15 + Math.min(0.25, (config.orbeezCount || 2500) / 25000) : 1;
  const fill = 0.5 + 0.5 * (config.peroxideVolumePercent / 100);

  return {
    liquidL,
    peroxideMol: liquidL * molarity,
    catalystDose: hasCatalyst ? 0.35 + 0.65 * (config.catalystRatio / 100) : 0,
    catalyst: config.catalystType,
    startTempC: config.chemicalTempCelsius,
    trap,
    foamLifetimeS: 2 + 6 * (hasSoap ? soapQ : 0.1),
    heightScale: geo.base * geo.nozzle * fill * orbeezBoost,
  };
}

/** Run the model for an experiment. Always returns a series (flat when nothing reacts). */
export function runReactionModel(config: ExperimentConfig): ReactionTimeSeries {
  return integrate(inputsFromConfig(config));
}

function integrate(m: ModelInputs): ReactionTimeSeries {
  const massKg = Math.max(m.liquidL, 1e-6);
  // Small vessels lose heat faster (more surface per litre): ~0.06/s for 2 L, ~0.005/s for 5,000 L.
  const coolingPerS = 0.08 * Math.pow(massKg, -1 / 3);
  let P = m.peroxideMol;
  let O2mol = 0;
  let foamL = 0;
  let sprayL = 0;
  let T = m.startTempC;
  let steamKg = 0;
  let peakTemp = T;

  const samples: ReactionSample[] = [];
  let peakHeight = 0;
  let timeToPeak = 0;
  let settle = T_MAX;
  let nextSample = 0;

  const heightOf = (plumeL: number) =>
    m.liquidL > 0 ? HEIGHT_C * m.heightScale * Math.pow(plumeL / m.liquidL, HEIGHT_ALPHA) : 0;

  for (let t = 0; t <= T_MAX + 1e-9; t += DT) {
    const height = heightOf(foamL + sprayL);
    if (height > peakHeight) {
      peakHeight = height;
      timeToPeak = t;
    }
    if (t + 1e-9 >= nextSample) {
      samples.push({
        t: round(t, 2),
        peroxideFraction: m.peroxideMol > 0 ? P / m.peroxideMol : 1,
        oxygenLiters: O2mol * 22.4 * ((T + 273.15) / 273.15),
        foamLiters: foamL + sprayL,
        tempC: T,
        heightM: height,
      });
      nextSample += SAMPLE_EVERY;
    }
    // Over once the plume has fallen back and the peroxide is (nearly) spent.
    if (t > timeToPeak + 0.5 && height < 0.05 * peakHeight && t > 1) {
      settle = t;
      break;
    }

    // Flows
    const k =
      m.catalystDose > 0
        ? CATALYSTS[m.catalyst].k20 * m.catalystDose * catalystTemperatureFactor(m.catalyst, T)
        : UNCATALYSED_K20;
    const rate = k * P; // mol H₂O₂ per second
    const reacted = Math.min(P, rate * DT);
    P -= reacted;
    O2mol += reacted / 2;

    // Heat: reaction warms the liquid, the room cools it, boiling caps it at 100 °C.
    T += (DELTA_H * reacted) / (massKg * WATER_HEAT_CAPACITY);
    T -= coolingPerS * (T - ROOM_TEMP_C) * DT;
    let steamThisStep = 0;
    if (T > 100) {
      steamThisStep = ((T - 100) * massKg * WATER_HEAT_CAPACITY) / LATENT_HEAT_STEAM;
      steamKg += steamThisStep;
      T = 100;
    }
    peakTemp = Math.max(peakTemp, T);

    // Gas → foam (trapped by soap) or spray (escapes); boiling pops bubbles.
    const gasL = (reacted / 2) * 22.4 * ((T + 273.15) / 273.15);
    const trap = steamThisStep > 0 ? m.trap * 0.35 : m.trap;
    foamL += gasL * trap - (foamL / m.foamLifetimeS) * DT;
    sprayL +=
      gasL * (1 - trap) * 0.15 + steamThisStep * STEAM_LITERS_PER_KG * 0.02 - (sprayL / 0.8) * DT;
  }

  const steamFromBoiling = m.liquidL > 0 ? Math.min(1, steamKg / (0.02 * m.liquidL)) : 0;
  const steamFromHeat = Math.min(0.75, Math.max(0.05, (peakTemp - 40) / 70));

  return {
    samples,
    timeToPeakS: round(timeToPeak, 2),
    peakHeightM: round(peakHeight, 2),
    peakTempC: Math.round(peakTemp),
    totalOxygenLiters: Math.round(O2mol * 22.4 * ((peakTemp + 273.15) / 273.15)),
    settleS: round(settle, 2),
    steamIntensity: round(Math.max(steamFromBoiling, steamFromHeat), 2),
    boiled: steamKg > 0,
  };
}

function round(x: number, dp: number): number {
  const f = 10 ** dp;
  return Math.round(x * f) / f;
}

/** Height at an arbitrary model time, interpolated between samples. */
export function sampleAt(series: ReactionTimeSeries, t: number): ReactionSample {
  const s = series.samples;
  if (s.length === 0) {
    return { t, peroxideFraction: 1, oxygenLiters: 0, foamLiters: 0, tempC: ROOM_TEMP_C, heightM: 0 };
  }
  if (t <= s[0].t) return s[0];
  if (t >= s[s.length - 1].t) return s[s.length - 1];
  const i = Math.min(s.length - 2, Math.floor(t / SAMPLE_EVERY));
  const a = s[i];
  const b = s[i + 1];
  const u = (t - a.t) / Math.max(1e-9, b.t - a.t);
  const lerp = (x: number, y: number) => x + (y - x) * u;
  return {
    t,
    peroxideFraction: lerp(a.peroxideFraction, b.peroxideFraction),
    oxygenLiters: lerp(a.oxygenLiters, b.oxygenLiters),
    foamLiters: lerp(a.foamLiters, b.foamLiters),
    tempC: lerp(a.tempC, b.tempC),
    heightM: lerp(a.heightM, b.heightM),
  };
}

/** Real seconds the 3D show takes to play the whole model run (2–7 s, like the old show). */
export function playbackWindowS(series: ReactionTimeSeries): number {
  return Math.min(7, Math.max(2, series.settleS));
}

/** Model time reached after `elapsedS` real seconds of 3D playback. */
export function modelTimeAtPlayback(series: ReactionTimeSeries, elapsedS: number): number {
  return (elapsedS * series.settleS) / playbackWindowS(series);
}
