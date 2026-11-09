/**
 * "Call your shot": axes for the bet, star scoring and the one-line kid explanation.
 * Pure functions only.
 */
import type {
  ExperimentConfig,
  ReactionSimulationResult,
  ScaleEnvironmentId,
} from '../types/chemistry';

export interface Bet {
  tPeakS: number; // how fast: seconds until the foam is highest
  heightM: number; // how high: metres
}

/** Fixed time axis so the axis itself never hints at the answer. */
export const TIME_AXIS_MAX_S = 8;

/** Height axis per rig: big enough for that rig's wildest run, the same for every recipe. */
export const HEIGHT_AXIS_MAX_M: Record<ScaleEnvironmentId, number> = {
  lab_beaker: 3,
  kiddie_pool: 30,
  steel_flask: 250,
  outdoor_crater: 400,
};

export function defaultBet(scaleId: ScaleEnvironmentId): Bet {
  return { tPeakS: TIME_AXIS_MAX_S / 2, heightM: HEIGHT_AXIS_MAX_M[scaleId] / 2 };
}

export type Stars = 1 | 2 | 3;

/**
 * Closeness in ratio terms, so "0.4 m vs 0.5 m" counts the same as "40 m vs 50 m".
 * Height matters twice as much as timing. Everyone gets at least one star for trying.
 */
export function scoreBet(
  bet: Bet,
  actual: { tPeakS: number; heightM: number },
  scaleId: ScaleEnvironmentId
): { stars: Stars; error: number } {
  const floorH = 0.05 * HEIGHT_AXIS_MAX_M[scaleId];
  const errH = Math.abs(Math.log((bet.heightM + floorH) / (actual.heightM + floorH)));
  const errT = Math.abs(Math.log((bet.tPeakS + 0.3) / (actual.tPeakS + 0.3)));
  const error = errH + 0.5 * errT;
  const stars: Stars = error <= 0.35 ? 3 : error <= 0.8 ? 2 : 1;
  return { stars, error };
}

/** One plain sentence on the biggest reason it came out the way it did. */
export function explainBiggestCause(
  config: ExperimentConfig,
  result: ReactionSimulationResult
): string {
  switch (result.outcomeMode) {
    case 'empty_vessel_crickets':
      return 'Nothing in the bottle means nothing to react!';
    case 'only_soap_bubble_bath':
    case 'no_peroxide_dud':
      return 'No peroxide means no oxygen, so no foam.';
    case 'only_orbeez_spill':
      return 'Orbeez are fun, but they don’t make any gas.';
    case 'no_catalyst_unreacted':
      return 'Without a catalyst, peroxide takes months to break down.';
    case 'catalyst_first_fizz_boiloff':
      return 'Soap has to go in BEFORE the catalyst, or the bubbles escape!';
    case 'steam_flash_vaporization':
      return 'It got so hot it boiled! Not enough soap to hold the bubbles.';
    case 'sluggish_soap_sludge':
      return 'Too much soap made the foam heavy and slow.';
    default:
      break;
  }
  if (config.catalystType === 'yeast' && result.peakTempCelsius >= 58) {
    return 'The yeast got too hot and slowed down!';
  }
  if (config.peroxideConcentration >= 30) return 'Stronger peroxide = way more oxygen!';
  if (config.chemicalTempCelsius >= 40) return 'Warmer peroxide = faster foam!';
  if (config.chemicalTempCelsius <= 20) return 'Cold peroxide reacts slowly.';
  if (config.catalystType === 'potassium_iodide') return 'Potassium iodide is a super-fast catalyst!';
  return 'Yeast breaks peroxide into oxygen, and soap turns the oxygen into foam!';
}
