import { describe, expect, it } from 'vitest';
import type { ExperimentConfig } from '../types/chemistry';
import { PRESET_EXPERIMENTS } from './chemistryEngine';
import { catalystTemperatureFactor, runReactionModel, sampleAt } from './reactionModel';

const preset = (id: string): ExperimentConfig => {
  const p = PRESET_EXPERIMENTS.find((x) => x.id === id);
  if (!p) throw new Error(`no preset ${id}`);
  return { ...p.config };
};

describe('runReactionModel', () => {
  it('never lets peroxide go negative and only ever uses it up', () => {
    for (const p of PRESET_EXPERIMENTS) {
      const s = runReactionModel(p.config).samples;
      for (let i = 0; i < s.length; i++) {
        expect(s[i].peroxideFraction).toBeGreaterThanOrEqual(0);
        if (i > 0) expect(s[i].peroxideFraction).toBeLessThanOrEqual(s[i - 1].peroxideFraction + 1e-12);
      }
    }
  });

  it('releases one O₂ for every two H₂O₂ (oxygen only grows)', () => {
    const s = runReactionModel(preset('classroom_yeast')).samples;
    for (let i = 1; i < s.length; i++) {
      // litres can wobble with temperature, so compare moles via a generous tolerance
      expect(s[i].oxygenLiters).toBeGreaterThanOrEqual(s[i - 1].oxygenLiters * 0.9);
    }
    expect(s[s.length - 1].oxygenLiters).toBeGreaterThan(0);
  });

  it('peaks sooner when the peroxide starts warmer (iodide)', () => {
    const cold = { ...preset('classroom_yeast'), catalystType: 'potassium_iodide' as const, chemicalTempCelsius: 15 };
    const warm = { ...cold, chemicalTempCelsius: 45 };
    expect(runReactionModel(warm).timeToPeakS).toBeLessThan(runReactionModel(cold).timeToPeakS);
  });

  it('yeast slows down once it gets too hot', () => {
    expect(catalystTemperatureFactor('yeast', 70)).toBeLessThan(catalystTemperatureFactor('yeast', 40));
    expect(catalystTemperatureFactor('potassium_iodide', 70)).toBeGreaterThan(
      catalystTemperatureFactor('potassium_iodide', 40)
    );
  });

  it('makes nothing happen without a catalyst', () => {
    const cfg = { ...preset('classroom_yeast'), additionOrder: ['peroxide', 'soap'] as ExperimentConfig['additionOrder'] };
    const s = runReactionModel(cfg);
    expect(s.peakHeightM).toBeLessThan(0.01);
    expect(s.peakTempC).toBeLessThanOrEqual(cfg.chemicalTempCelsius + 1);
  });

  it('runs away to boiling with 50 % peroxide and iodide', () => {
    const s = runReactionModel(preset('devils_toothpaste_crater'));
    expect(s.peakTempC).toBe(100);
    expect(s.boiled).toBe(true);
  });

  it('interpolates between samples', () => {
    const series = runReactionModel(preset('classroom_yeast'));
    const a = series.samples[10];
    const b = series.samples[11];
    const mid = sampleAt(series, (a.t + b.t) / 2);
    expect(mid.heightM).toBeCloseTo((a.heightM + b.heightM) / 2, 6);
  });
});
