# Reaction Model panel: "Call your shot" — design

Date: 2026-11-09 · Status: draft for review

## Goal

Make the lab more scientific and more fun for its real player: a 9-year-old Mark Rober fan
who wants to do "science experiments". Two changes, one feature:

1. **A real model.** Replace the hand-tuned peak formulas with a small time-stepped
   stock-and-flow model of the reaction, so the game has curves over time, not just peak numbers.
2. **A predict → test → explain loop.** A 2D panel beside the 3D scene where he bets on the
   result before pressing the button, watches the real curve race his bet during the eruption,
   then scrubs back through "what happened inside".

The library is [Dragology](https://declarative-dragging.github.io/dragology/) (`dragology@0.2.0`,
MIT, React 18/19 peer — compatible with our React 19 + Vite 8). The stock-and-flow demo is
inspiration only; we do not copy its editor.

## Decisions taken (and why)

| Decision | Why |
|---|---|
| Guess-then-test (A), not live sliders (B) | Live curves spoil the eruption: pressing the button just renders a spoiler. Betting makes the 3D payoff a reveal. Confirmed by a Gemini review as a children's science-game designer (cid `01m6yj5dghg2x0hgzptarn4xj8`). |
| Bet with **one marker**, not a drawn curve | Drawing a curve is a coordinate-plane task a 9-year-old will hate. One point = "how high" × "how fast", two seconds. |
| Plot only **foam height** and **temperature** | Four curves is visual soup at age 9. |
| Keep a simple **picture** stock-and-flow, review phase only | Abstract boxes and pipes mean nothing to him; a peroxide bottle draining into bubbles with a thermometer does. Shown after the run, as the explanation, not before. |
| No "what-if ghost curve" after a run | It would leak the answer to his next bet. |
| No cumulative score | Points invite farming one known combo. Stars per run + "new discovery!" for a first-time outcome reward variety instead. |
| Orbeez stay **out** of the kinetics | They are a visual/physical modifier, not chemistry. Keep the existing visual boost only. |
| The bet never blocks the button | Skipping the bet is allowed; the panel just says "no guess this time". |

## The loop (moment to moment)

1. **Mix** (existing flow, unchanged): drag ingredients into the vessel.
2. **Call your shot**: the panel shows empty axes — *Foam height (m)* up, *Time (s)* across —
   with a draggable target marker (rocket icon). It starts at his previous guess, or the middle
   on the first run. Prompt: "How high? How fast? Drag the rocket."
3. **Go**: he presses the existing eruption button. The real foam curve draws live, in sync with
   the 3D eruption, racing towards his marker. Temperature draws on a thin second strip below.
4. **Result**: 1–3 stars for closeness, plus one plain sentence on the biggest cause
   ("Warmer peroxide = faster foam!", "Yeast stopped working when it got too hot!").
   A first-time outcome mode shows "New discovery!".
5. **What happened inside**: the picture diagram appears. He drags a time cursor along the
   finished curves; the bottle level, bubble count and thermometer animate to that moment.
6. Change something → the curves clear and step 2 starts again.

## Science model

New pure module `src/utils/reactionModel.ts`. Explicit Euler (or RK4) at a fixed step,
in real seconds. Plain functions, no React.

**Stocks**
- `P` — peroxide left (mol H₂O₂)
- `O` — oxygen released (mol O₂, cumulative)
- `F` — foam volume (L)
- `T` — liquid temperature (°C)

**Flows**
- Decomposition `r = k(T) · c_cat · P / V`, with Arrhenius `k(T) = k₂₀ · exp(Eₐ/R · (1/293 − 1/(T+273)))`.
  Eₐ per catalyst from published values (about 56 kJ/mol for iodide, about 20 kJ/mol for catalase in yeast);
  `k₂₀` tuned per catalyst so presets keep their current feel.
- **Yeast denatures**: catalase activity falls off sharply above ~45–55 °C. This is the best
  kid-level surprise in the model and it is true.
- `dP/dt = −r`, `dO/dt = r/2`.
- Foam in = O₂ gas volume (ideal gas at T) × trap efficiency (soap amount, catalyst-before-soap
  mistake, as today's soap quality curve). Foam out = `F / τ_collapse` (τ from soap).
- Heat: `dT/dt = ΔH·r / (m·c) − h·(T − T_room)`, ΔH = 98.2 kJ/mol. At 100 °C excess heat goes
  into steam instead of temperature; steam rate feeds `steamIntensity`. This is the runaway
  loop behind "steam flash".

**Outputs**: sampled series `{t, P, O, F, T, heightM, steam}`, plus peak height, time-to-peak,
peak temperature, total O₂.

**Integration with the existing engine** — `simulateReactionPhysics` keeps its outcome
classification (empty vessel, no catalyst, order mistakes, sludge, the funny titles and
explanations) but takes `peakTempCelsius`, `oxygenGasLiters`, `peakHeightMeters`,
`steamIntensity` and `durationSeconds` from the model, and returns the series on a new
optional `ReactionSimulationResult.timeSeries` field. The steam-flash branch is decided by the
model's peak temperature rather than a hand rule.

**Calibration target**: every entry in `PRESET_EXPERIMENTS` keeps its current outcome mode,
and peak heights stay within ±25 % of today's values. Tests pin this.

## Panel UI

New component `src/components/ReactionModelPanel.tsx`, one `DraggableRenderer` (controlled
mode: App owns the bet and the cursor time).

- **State**: `{ phase: 'bet' | 'running' | 'review', guess: {tPeak, height}, cursorT }`.
- **Rocket marker**: `d.vary(state, [param('guess','tPeak'), param('guess','height')])` with
  `inOrder` constraints to the axes. Active in `bet` only.
- **Live curve** (`running`): App passes the current elapsed time from the viewport; the panel
  draws the series up to that time. Not draggable.
- **Time cursor** (`review`): `d.vary` on `cursorT`, constrained to `[0, duration]`.
- **Picture diagram** (`review`): bottle fill = P/P₀, bubble cluster size = F, thermometer = T,
  arrows between them. Plain labels: "Peroxide left", "Foam", "Heat".
- **Placement**: a collapsible card above the existing Live Science Report dock; collapses on
  narrow screens to a "Make a guess" pill.
- **Words**: no equations, no "stock"/"flow" jargon. Units: metres, seconds, °C.

## 3D sync

`ThreeViewport` today ramps height and temperature with a fixed 1.85 s ease-out. Replace that
ramp with a lookup into `timeSeries` at `rState.elapsed` (model time maps linearly onto a playback
window of clamp(model settle time, 2 s, 7 s), matching today's show length). Expose elapsed time to App via a callback throttled to
~20 Hz for the panel.

Scrubbing in `review` drives the panel and the in-scene height/temperature readouts only. Rewinding
the 3D particle system is **out of scope** (spawn-based particles are not reversible).

## Testing

- Add `vitest`. Unit tests for `reactionModel.ts`: peroxide never negative; O₂ = (P₀ − P)/2;
  hotter start → earlier peak (iodide); yeast slows above its denature temperature; no catalyst →
  flat curves; each preset keeps its outcome mode and stays within the ±25 % height band.
- Star scoring is a pure function, tested at its boundaries.
- UI: manual check in the headless browser — drag the rocket, run, check the curve draws while
  the eruption plays, drag the cursor in review. `npm run lint` and `npm run build` pass.

## Out of scope (park for later)

- **Home-safety split** — a "Kitchen kit" (3 % peroxide + yeast, safe at home with an adult)
  versus a clearly-labelled "Pros only" lab (30–50 % peroxide, potassium iodide, craters).
  Real-world risk for this player; deserves its own design pass, next after this one.
- Fair-test missions with locked variables (ruled out for now).
- Rewinding 3D particles on scrub.
- What-if ghost curves.
