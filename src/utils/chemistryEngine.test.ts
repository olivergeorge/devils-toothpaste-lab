import { describe, expect, it } from 'vitest';
import { PRESET_EXPERIMENTS, simulateReactionPhysics } from './chemistryEngine';

// Outcomes and peak heights from the hand-tuned engine before the reaction model (2026-11-09).
const BASELINE: Record<string, { mode: string; heightM: number }> = {
  classroom_yeast: { mode: 'classic_foam_geyser', heightM: 0.41 },
  wrong_order_fizz: { mode: 'catalyst_first_fizz_boiloff', heightM: 3.29 },
  steam_vaporization_flash: { mode: 'steam_flash_vaporization', heightM: 12.92 },
  volcano_orbeez_record: { mode: 'colossal_volcano_eruption', heightM: 159.19 },
  devils_toothpaste_crater: { mode: 'devils_toothpaste_detonation', heightM: 286.45 },
};

describe('simulateReactionPhysics with the reaction model', () => {
  it('covers every preset in the baseline', () => {
    expect(PRESET_EXPERIMENTS.map((p) => p.id).sort()).toEqual(Object.keys(BASELINE).sort());
  });

  for (const preset of PRESET_EXPERIMENTS) {
    it(`${preset.id} keeps its outcome and lands within ±25 % of its old height`, () => {
      const r = simulateReactionPhysics(preset.config);
      const base = BASELINE[preset.id];
      expect(r.outcomeMode).toBe(base.mode);
      expect(r.peakHeightMeters).toBeGreaterThan(base.heightM * 0.75);
      expect(r.peakHeightMeters).toBeLessThan(base.heightM * 1.25);
      expect(r.timeSeries?.samples.length).toBeGreaterThan(5);
    });
  }

  it('attaches a series even when nothing was poured', () => {
    const cfg = { ...PRESET_EXPERIMENTS[0].config, additionOrder: [] };
    const r = simulateReactionPhysics(cfg);
    expect(r.outcomeMode).toBe('empty_vessel_crickets');
    expect(r.timeSeries?.peakHeightM).toBe(0);
  });
});
