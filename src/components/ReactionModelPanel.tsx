import React, { useCallback, useMemo } from 'react';
import { Draggable, DraggableRenderer, inOrder, param, translate } from 'dragology';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { ReactionTimeSeries, ScaleEnvironmentId } from '../types/chemistry';
import { Bet, HEIGHT_AXIS_MAX_M, Stars, TIME_AXIS_MAX_S } from '../utils/betScoring';
import { sampleAt } from '../utils/reactionModel';

export type BetPhase = 'bet' | 'running' | 'review';

export interface ReactionModelPanelProps {
  scaleId: ScaleEnvironmentId;
  phase: BetPhase;
  bet: Bet;
  betTouched: boolean;
  onBetChange: (bet: Bet) => void;
  /** Only passed once the button is pressed, so the answer is never on screen early. */
  series: ReactionTimeSeries | null;
  elapsedModelS: number;
  cursorS: number;
  onCursorChange: (t: number) => void;
  stars: Stars | null;
  sentence: string | null;
  newDiscovery: boolean;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

// Graph geometry (SVG user units)
const W = 300;
const H = 196;
const PLOT = { left: 34, top: 10, width: 254, height: 120 };
const TEMP = { top: 150, height: 30 };
const TEMP_MAX_C = 110;

interface GraphState {
  bet: Bet;
  cursorS: number;
}

const fmtHeight = (m: number) => (m === 0 ? '0' : m >= 10 ? `${Math.round(m)}` : m >= 1 ? m.toFixed(1) : m.toFixed(2));

export const ReactionModelPanel: React.FC<ReactionModelPanelProps> = (props) => {
  const {
    scaleId,
    phase,
    bet,
    betTouched,
    onBetChange,
    series,
    elapsedModelS,
    cursorS,
    onCursorChange,
    stars,
    sentence,
    newDiscovery,
    collapsed,
    onToggleCollapsed,
  } = props;

  const hMax = HEIGHT_AXIS_MAX_M[scaleId];
  const x = useCallback((t: number) => PLOT.left + (Math.min(t, TIME_AXIS_MAX_S) / TIME_AXIS_MAX_S) * PLOT.width, []);
  const y = useCallback(
    (h: number) => PLOT.top + PLOT.height * (1 - Math.min(h, hMax) / hMax),
    [hMax]
  );
  const yTemp = (c: number) => TEMP.top + TEMP.height * (1 - Math.min(c, TEMP_MAX_C) / TEMP_MAX_C);

  // How much of the real curve is visible: none while betting, growing while running, all in review.
  const visibleUntil = phase === 'bet' || !series ? -1 : phase === 'running' ? elapsedModelS : Infinity;
  const lastT = series ? series.samples[series.samples.length - 1].t : 0;
  const cursorMax = Math.max(0.1, Math.min(TIME_AXIS_MAX_S, lastT));

  const curves = useMemo(() => {
    if (!series || visibleUntil < 0) return { height: '', temp: '' };
    const pts = series.samples.filter((s) => s.t <= Math.min(visibleUntil, TIME_AXIS_MAX_S));
    if (pts.length < 2) return { height: '', temp: '' };
    const height = pts.map((s, i) => `${i ? 'L' : 'M'}${x(s.t).toFixed(1)},${y(s.heightM).toFixed(1)}`).join('');
    const temp = pts.map((s, i) => `${i ? 'L' : 'M'}${x(s.t).toFixed(1)},${yTemp(s.tempC).toFixed(1)}`).join('');
    return { height, temp };
  }, [series, visibleUntil, x, y]);

  const draggable: Draggable<GraphState> = useCallback(
    ({ state, d }) => {
      const yTicks = [0, hMax / 2, hMax];
      const xTicks = [0, 2, 4, 6, 8];
      const cursorSample = series && phase === 'review' ? sampleAt(series, state.cursorS) : null;
      return (
        <g>
          {/* Axes and grid */}
          <rect transform={translate(PLOT.left, PLOT.top)} width={PLOT.width} height={PLOT.height} rx={4} fill="#0f172a" stroke="#334155" />
          {yTicks.map((h) => (
            <g id={`ytick-${h}`} transform={translate(PLOT.left - 4, y(h))}>
              <text textAnchor="end" dominantBaseline="middle" fontSize={9} fill="#94a3b8">
                {fmtHeight(h)}
              </text>
            </g>
          ))}
          {xTicks.map((t) => (
            <g id={`xtick-${t}`} transform={translate(x(t), PLOT.top + PLOT.height + 10)}>
              <text textAnchor="middle" fontSize={9} fill="#94a3b8">
                {t === 8 ? '8 s' : t}
              </text>
            </g>
          ))}
          <g transform={translate(PLOT.left + 4, PLOT.top + 10)}>
            <text fontSize={9} fill="#fbbf24">Foam height (m)</text>
          </g>

          {/* Heat strip */}
          <rect transform={translate(PLOT.left, TEMP.top)} width={PLOT.width} height={TEMP.height} rx={4} fill="#0f172a" stroke="#334155" />
          <g transform={translate(PLOT.left - 4, TEMP.top + TEMP.height / 2)}>
            <text textAnchor="end" dominantBaseline="middle" fontSize={9} fill="#fb7185">
              Heat
            </text>
          </g>
          <line x1={PLOT.left} x2={PLOT.left + PLOT.width} y1={yTemp(100)} y2={yTemp(100)} stroke="#fb7185" strokeDasharray="2 3" strokeOpacity={0.5} />
          <g transform={translate(PLOT.left + PLOT.width - 4, yTemp(100) - 2)}>
            <text textAnchor="end" fontSize={8} fill="#fb7185" fillOpacity={0.8}>
              boiling
            </text>
          </g>

          {/* The real curves (drawn only after the button is pressed) */}
          {curves.height && <path d={curves.height} fill="none" stroke="#fbbf24" strokeWidth={2.5} strokeLinejoin="round" />}
          {curves.temp && <path d={curves.temp} fill="none" stroke="#fb7185" strokeWidth={1.5} />}

          {/* Review: the time cursor he can drag through the finished run */}
          {phase === 'review' && cursorSample && (
            <g
              id="cursor"
              transform={translate(x(state.cursorS), 0)}
              dragologyOnDrag={() =>
                d.vary(state, param<GraphState>('cursorS'), {
                  constraint: (s) => inOrder([0, s.cursorS, cursorMax]),
                })
              }
              style={{ cursor: 'ew-resize' }}
            >
              <line x1={0} x2={0} y1={PLOT.top} y2={TEMP.top + TEMP.height} stroke="#e2e8f0" strokeWidth={1.5} />
              <rect transform={translate(-9, PLOT.top + PLOT.height + 14)} width={18} height={10} rx={3} fill="#e2e8f0" />
              <circle transform={translate(0, y(cursorSample.heightM))} r={4} fill="#fbbf24" stroke="#0f172a" />
              <circle transform={translate(0, yTemp(cursorSample.tempC))} r={3} fill="#fb7185" stroke="#0f172a" />
              <rect transform={translate(-12, PLOT.top)} width={24} height={TEMP.top + TEMP.height - PLOT.top} fill="transparent" />
            </g>
          )}

          {/* The bet: a rocket he drags to "how high, how fast" */}
          <g
            id="rocket"
            transform={translate(x(state.bet.tPeakS), y(state.bet.heightM))}
            dragologyOnDrag={
              phase === 'bet'
                ? () =>
                    d.vary(state, [param<GraphState>('bet', 'tPeakS'), param<GraphState>('bet', 'heightM')], {
                      constraint: (s) => [
                        ...inOrder([0.1, s.bet.tPeakS, TIME_AXIS_MAX_S]),
                        ...inOrder([0, s.bet.heightM, hMax]),
                      ],
                    })
                : undefined
            }
            style={{ cursor: phase === 'bet' ? 'grab' : 'default' }}
            opacity={phase === 'bet' || betTouched ? 1 : 0.35}
          >
            <circle r={13} fill={phase === 'bet' ? '#1e3a8a' : '#1e293b'} stroke="#60a5fa" strokeWidth={1.5} strokeDasharray={phase === 'bet' ? undefined : '3 2'} />
            <text textAnchor="middle" dominantBaseline="central" fontSize={14}>
              🚀
            </text>
          </g>
        </g>
      );
    },
    [series, phase, hMax, x, y, curves, cursorMax, betTouched]
  );

  const graphState: GraphState = { bet, cursorS };
  const handleState = (s: GraphState) => {
    if (phase === 'bet') onBetChange(s.bet);
    if (phase === 'review') onCursorChange(s.cursorS);
  };

  const headline =
    phase === 'bet'
      ? 'How high? How fast? Drag the rocket 🚀'
      : phase === 'running'
      ? betTouched
        ? 'Here it comes… will it beat your rocket?'
        : 'Here it comes!'
      : betTouched
      ? 'How close was your guess?'
      : 'No guess this time — drag the rocket next time!';

  return (
    <div
      className="fixed left-3 top-[200px] z-20 w-[316px] rounded-xl border border-slate-700/90 bg-slate-900/90 shadow-xl backdrop-blur pointer-events-auto"
      data-testid="reaction-model-panel"
    >
      <button
        type="button"
        onClick={onToggleCollapsed}
        className="flex w-full items-center justify-between px-3 py-2 text-left"
      >
        <span className="text-[11px] font-bold tracking-wide text-sky-300">CALL YOUR SHOT</span>
        {collapsed ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronUp className="h-4 w-4 text-slate-400" />}
      </button>

      {!collapsed && (
        <div className="px-2 pb-2">
          <p className="px-1 pb-1 text-[12px] font-semibold text-white">{headline}</p>
          <DraggableRenderer<GraphState>
            draggable={draggable}
            state={graphState}
            onDragState={handleState}
            onDropState={handleState}
            width={W}
            height={H}
          />

          {phase === 'review' && (
            <div className="mt-1 space-y-1 px-1">
              <div className="flex items-center gap-2">
                {betTouched && stars && (
                  <span className="text-base" aria-label={`${stars} stars`}>
                    {'⭐'.repeat(stars)}
                    <span className="opacity-25">{'⭐'.repeat(3 - stars)}</span>
                  </span>
                )}
                {newDiscovery && (
                  <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300">
                    NEW DISCOVERY!
                  </span>
                )}
              </div>
              {sentence && <p className="text-[12px] leading-snug text-amber-200">{sentence}</p>}
              {series && <InsideDiagram series={series} t={cursorS} />}
              <p className="text-[10px] text-slate-400">Drag the white bar to replay what happened inside.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/** "What happened inside": peroxide bottle → oxygen → foam, with a thermometer for heat. */
const InsideDiagram: React.FC<{ series: ReactionTimeSeries; t: number }> = ({ series, t }) => {
  const s = sampleAt(series, t);
  const maxFoam = Math.max(1e-9, ...series.samples.map((x) => x.foamLiters));
  const foam = s.foamLiters / maxFoam; // 0..1
  const bottleFill = Math.max(0, Math.min(1, s.peroxideFraction));
  const heat = Math.max(0, Math.min(1, s.tempC / TEMP_MAX_C));
  const bubbles = [
    [0, 0], [-9, 4], [9, 4], [-5, -7], [6, -7], [-14, -4], [14, -4], [0, -13],
  ];
  return (
    <svg viewBox="0 0 300 74" width="100%" role="img" aria-label="What happened inside the bottle">
      {/* Peroxide bottle */}
      <g transform="translate(36,8)">
        <rect x={-14} y={0} width={28} height={50} rx={5} fill="#0f172a" stroke="#38bdf8" />
        <rect x={-13} y={1 + 48 * (1 - bottleFill)} width={26} height={48 * bottleFill} rx={4} fill="#38bdf8" fillOpacity={0.55} />
        <text x={0} y={63} textAnchor="middle" fontSize={9} fill="#7dd3fc">Peroxide left</text>
      </g>
      {/* Arrow: oxygen */}
      <g>
        <line x1={58} y1={30} x2={118} y2={30} stroke="#94a3b8" strokeWidth={1.5} markerEnd="url(#arrow)" />
        <text x={88} y={24} textAnchor="middle" fontSize={8} fill="#94a3b8">oxygen</text>
      </g>
      {/* Foam */}
      <g transform="translate(150,32)">
        {bubbles.map(([bx, by], i) => (
          <circle key={i} cx={bx * (0.5 + foam)} cy={by * (0.5 + foam)} r={3 + 6 * foam} fill="#fde68a" fillOpacity={0.15 + 0.6 * foam} />
        ))}
        <text x={0} y={39} textAnchor="middle" fontSize={9} fill="#fde68a">Foam</text>
      </g>
      {/* Arrow: heat */}
      <g>
        <line x1={186} y1={30} x2={236} y2={30} stroke="#94a3b8" strokeWidth={1.5} markerEnd="url(#arrow)" />
        <text x={211} y={24} textAnchor="middle" fontSize={8} fill="#94a3b8">heat</text>
      </g>
      {/* Thermometer */}
      <g transform="translate(262,6)">
        <rect x={-5} y={0} width={10} height={44} rx={5} fill="#0f172a" stroke="#fb7185" />
        <rect x={-4} y={1 + 42 * (1 - heat)} width={8} height={42 * heat} rx={4} fill="#fb7185" />
        <circle cx={0} cy={50} r={7} fill="#fb7185" />
        <text x={0} y={68} textAnchor="middle" fontSize={9} fill="#fda4af">{Math.round(s.tempC)}°C</text>
      </g>
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX={9} refY={5} markerWidth={6} markerHeight={6} orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="#94a3b8" />
        </marker>
      </defs>
    </svg>
  );
};
