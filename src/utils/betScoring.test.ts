import { describe, expect, it } from 'vitest';
import { PRESET_EXPERIMENTS, simulateReactionPhysics } from './chemistryEngine';
import { explainBiggestCause, scoreBet } from './betScoring';

describe('scoreBet', () => {
  const actual = { tPeakS: 2, heightM: 10 };
  it('gives 3 stars for a spot-on guess', () => {
    expect(scoreBet({ tPeakS: 2, heightM: 10 }, actual, 'kiddie_pool').stars).toBe(3);
  });
  it('gives 2 stars for the right ballpark', () => {
    expect(scoreBet({ tPeakS: 3, heightM: 16 }, actual, 'kiddie_pool').stars).toBe(2);
  });
  it('still gives 1 star for a wild guess', () => {
    expect(scoreBet({ tPeakS: 8, heightM: 30 }, actual, 'kiddie_pool').stars).toBe(1);
  });
  it('treats small and big rigs the same way (ratio, not metres)', () => {
    const small = scoreBet({ tPeakS: 2, heightM: 0.6 }, { tPeakS: 2, heightM: 0.5 }, 'lab_beaker');
    const big = scoreBet({ tPeakS: 2, heightM: 60 }, { tPeakS: 2, heightM: 50 }, 'steel_flask');
    expect(small.stars).toBe(big.stars);
  });
});

describe('explainBiggestCause', () => {
  it('has a sentence for every preset, with no jargon', () => {
    for (const p of PRESET_EXPERIMENTS) {
      const line = explainBiggestCause(p.config, simulateReactionPhysics(p.config));
      expect(line.length).toBeGreaterThan(10);
      expect(line).not.toMatch(/stock|flow|Arrhenius|stoichiometr/i);
    }
  });
  it('blames the order when catalyst went in before soap', () => {
    const p = PRESET_EXPERIMENTS.find((x) => x.id === 'wrong_order_fizz')!;
    expect(explainBiggestCause(p.config, simulateReactionPhysics(p.config))).toMatch(/BEFORE/);
  });
});
