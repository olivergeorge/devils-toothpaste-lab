# Reaction Model Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hand-tuned peak formulas with a time-stepped reaction model and add a "Call your shot" Dragology panel (bet → live race → review scrub).

**Architecture:** A pure `reactionModel.ts` integrates four stocks (peroxide, oxygen, foam+spray, temperature) and returns a sampled time series. `simulateReactionPhysics` keeps its outcome classification but takes its numbers from the model and attaches `timeSeries`. A new `ReactionModelPanel` (Dragology `DraggableRenderer`, controlled) owns the bet marker and review cursor; `ThreeViewport` plays the eruption from the series and reports elapsed time.

**Tech Stack:** React 19, TypeScript, Vite 8, Three.js, Tailwind 4, `dragology@0.2.0`, `vitest`.

**Spec:** `docs/superpowers/specs/2026-11-09-reaction-model-panel-design.md`

## Global Constraints

- Kid-facing copy: plain words, no equations, no "stock"/"flow"; units m, s, °C.
- The bet never blocks the eruption button.
- No predicted outcome numbers visible before a run (dock "Predicted height", dock telemetry, AR apex badge show "?" until the run).
- Every `PRESET_EXPERIMENTS` entry keeps its outcome mode; peak heights within ±25 % of baseline:
  classroom_yeast 0.41 m, wrong_order_fizz 3.29 m, steam_vaporization_flash 12.92 m,
  volcano_orbeez_record 159.19 m, devils_toothpaste_crater 286.45 m.
- Orbeez do not enter the kinetics (height multiplier only).
- Dragology rules: position with `transform`, `id` not `key`, `<g>` not fragments.

---

### Task 1: Reaction model + tests

**Files:** Create `src/utils/reactionModel.ts`, `src/utils/reactionModel.test.ts`; modify `package.json` (vitest, `test` script), `src/types/chemistry.ts` (series types).

**Interfaces — produces:**
- `types/chemistry.ts`: `ReactionSample { t; peroxideFraction; oxygenLiters; foamLiters; tempC; heightM }`, `ReactionTimeSeries { samples; timeToPeakS; peakHeightM; peakTempC; totalOxygenLiters; settleS; steamIntensity; boiled }`, optional `ReactionSimulationResult.timeSeries`.
- `reactionModel.ts`: `soapQualityFactor(mlPerLiter): number`, `runReactionModel(config: ExperimentConfig): ReactionTimeSeries`.

Model (per spec): first-order decomposition `dP/dt = −k(T)·a·P`, Arrhenius (Eₐ 56 kJ/mol KI, 20 kJ/mol yeast), yeast denature logistic around 58 °C, heat balance with ΔH 98.2 kJ/mol, boiling cap at 100 °C with excess heat to steam, foam stock fed by trapped gas and drained by `F/τ`, spray stock fed by untrapped gas and steam, height ∝ geometry × ((F+S)/V)^α with α and C fitted to the baselines.

Tests: P never negative; O₂ conserved; hotter start → earlier peak (KI); yeast at 60 °C slower than at 40 °C; no catalyst → flat; heat runaway reaches 100 °C at 50 %.

### Task 2: Engine integration + preset calibration test

**Files:** Modify `src/utils/chemistryEngine.ts`; create `src/utils/chemistryEngine.test.ts`.

Replace the hand formulas for peak temperature, O₂, peak height and steam with model outputs; steam-flash branch decided by `series.boiled && soap < 28`; attach `timeSeries` to every result. Test: preset outcome modes unchanged and heights within ±25 %.

### Task 3: Bet scoring (pure)

**Files:** Create `src/utils/betScoring.ts`, `src/utils/betScoring.test.ts`.

`scoreBet(guess: {tPeak, height}, series): {stars: 1|2|3, error: number}` — error in log-space on both axes; `explainBiggestCause(config, series): string` kid sentence.

### Task 4: ReactionModelPanel (Dragology)

**Files:** Create `src/components/ReactionModelPanel.tsx`; modify `package.json` (dragology).

Phases bet/running/review; rocket marker `d.vary` on guess; live curve up to elapsed; time cursor `d.vary` on `cursorT`; picture diagram (bottle, foam, thermometer) in review; stars + sentence + "New discovery!".

### Task 5: Wiring + spoiler removal + 3D sync

**Files:** Modify `src/App.tsx`, `src/components/ThreeViewport.tsx`, `src/components/LiveScienceReportDock.tsx`.

App owns `{phase, guess, cursorT, elapsed, seenOutcomes}`; viewport height/temp ramp replaced by series lookup at `elapsed / playbackScale`; `onElapsed` callback throttled to ~20 Hz; dock and AR badge hide predictions while no result.

### Task 6: Verify + push

`npm test`, `npm run lint`, `npm run build`, browser check (bet drag, run, curve draws, review scrub), push branch.
