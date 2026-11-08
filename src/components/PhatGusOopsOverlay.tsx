import React, { useEffect, useState } from 'react';
import { Check, Search, ShieldAlert, Sparkles } from 'lucide-react';

export type PhatGusToolMode = 'magnifying_glass' | 'mop';

export interface PhatGusOopsEvent {
  id: string;
  tool: PhatGusToolMode;
  badgeText: string;
  headline: string;
  explanation: string;
  fixButtonLabel: string;
  ignoreButtonLabel: string;
  dyeHex: string;
  showScreenSplatters?: boolean;
}

interface PhatGusOopsOverlayProps {
  event: PhatGusOopsEvent | null;
  onFixAndClean: () => void;
  onIgnoreOrKeepAsIs: () => void;
  onTriggerMopSound: () => void;
}

export const PhatGusOopsOverlay: React.FC<PhatGusOopsOverlayProps> = ({
  event,
  onFixAndClean,
  onIgnoreOrKeepAsIs,
  onTriggerMopSound,
}) => {
  const [isMopSweeping, setIsMopSweeping] = useState(false);
  const [mopSweepProgress, setMopSweepProgress] = useState(0); // 0 to 100
  const [animTick, setAnimTick] = useState(0);

  useEffect(() => {
    setIsMopSweeping(false);
    setMopSweepProgress(0);
  }, [event?.id]);

  // Gentle cartoon bobbing & magnifying glass / mop idle motion
  useEffect(() => {
    if (!event) return;
    let rafId = 0;
    const start = performance.now();
    const step = (now: number) => {
      setAnimTick((now - start) / 1000);
      rafId = requestAnimationFrame(step);
    };
    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [event]);

  if (!event) return null;

  const isMop = event.tool === 'mop';
  const swingAngle = Math.sin(animTick * 4.5) * (isMop ? 14 : 9);
  const tailWag = Math.sin(animTick * 6) * 6;

  // Trigger the animated Phat Gus Mop Sweep across the screen before completing cleanup!
  const handleRunMopSweep = (alsoApplyFix: boolean) => {
    if (!isMop) {
      if (alsoApplyFix) onFixAndClean();
      else onIgnoreOrKeepAsIs();
      return;
    }

    onTriggerMopSound();
    setIsMopSweeping(true);
    const start = performance.now();
    const duration = 680;

    const animateWipe = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      setMopSweepProgress(Math.round(p * 100));
      if (p < 1) {
        requestAnimationFrame(animateWipe);
      } else {
        setIsMopSweeping(false);
        if (alsoApplyFix) onFixAndClean();
        else onIgnoreOrKeepAsIs();
      }
    };
    requestAnimationFrame(animateWipe);
  };

  // Opacity of soap splatters fades out as Phat Gus's mop sweeps across!
  const splatterOpacity = Math.max(0, 0.88 * (1 - mopSweepProgress / 100));

  return (
    <div className="fixed inset-0 z-40 pointer-events-auto flex items-center justify-center p-4 overflow-hidden select-none">
      {/* 1. If it's a Mop Mishap (Soap in Eye / Overflow / Slime Overdose), show Foam & Soap Blobs that get wiped away! */}
      {event.showScreenSplatters && (
        <div
          className="pointer-events-none fixed inset-0 overflow-hidden"
          style={{ opacity: splatterOpacity }}
        >
          <div
            className="absolute -top-10 -left-10 w-72 h-72 rounded-full"
            style={{
              backgroundColor: event.dyeHex,
              border: '8px solid rgba(255,255,255,0.85)',
            }}
          />
          <div
            className="absolute top-10 right-8 w-64 h-64 rounded-full"
            style={{
              backgroundColor: '#34d399',
              border: '8px solid rgba(255,255,255,0.85)',
            }}
          />
          <div
            className="absolute bottom-24 left-12 w-80 h-60 rounded-full"
            style={{
              backgroundColor: '#f8fafc',
              border: '6px solid #38bdf8',
            }}
          />
          <div
            className="absolute bottom-16 right-12 w-72 h-72 rounded-full"
            style={{
              backgroundColor: event.dyeHex,
              border: '8px solid rgba(255,255,255,0.85)',
            }}
          />
        </div>
      )}

      {/* 2. Active Full-Screen Sudsy Mop Wiper Bar during Mop Sweep Animation */}
      {isMopSweeping && (
        <div
          className="pointer-events-none fixed inset-y-0 z-50 w-28 flex flex-col items-center justify-center"
          style={{
            left: `${mopSweepProgress}%`,
            transform: 'translateX(-50%)',
          }}
        >
          <div className="w-4 h-full bg-amber-400 shadow-2xl border-x-2 border-white" />
          <div className="absolute top-1/2 -translate-y-1/2 px-4 py-2 rounded-full bg-sky-400 text-slate-950 font-extrabold text-sm shadow-2xl whitespace-nowrap">
            🧹 SQUEAK-SQUEAK-CLEAN! ✨
          </div>
        </div>
      )}

      {/* 3. Cartoon Phat Gus "OOPS!" Inspection / Cleanup Card */}
      <div
        className="relative z-10 max-w-lg w-full rounded-2xl border-2 border-amber-400 p-4 sm:p-5 shadow-2xl transition-transform"
        style={{
          backgroundColor: 'rgba(9, 13, 22, 0.96)',
          transform: isMopSweeping
            ? `translateX(${Math.sin((mopSweepProgress / 100) * Math.PI * 2) * 35}px) scale(0.96)`
            : 'translateX(0) scale(1)',
        }}
      >
        <div className="flex flex-col sm:flex-row items-center gap-4">
          {/* Illustrated Cartoon "Phat Gus" Squirrel with Animated Mop or Magnifying Glass */}
          <div className="relative w-36 h-36 shrink-0 flex items-center justify-center bg-slate-900/90 rounded-2xl border border-slate-700 overflow-visible">
            <svg
              viewBox="0 0 180 180"
              className="w-36 h-36 overflow-visible"
              aria-label="Cartoon Phat Gus the Squirrel"
            >
              {/* Fluffy Bushy Squirrel Tail (Wagging!) */}
              <g
                style={{
                  transform: `rotate(${tailWag}deg)`,
                  transformOrigin: '45px 130px',
                }}
              >
                <path
                  d="M 48 135 C 5 130, 0 65, 38 45 C 65 30, 82 58, 66 85 C 56 102, 62 122, 48 135 Z"
                  fill="#b45309"
                  stroke="#78350f"
                  strokeWidth="3.5"
                />
                <path
                  d="M 42 118 C 18 110, 18 68, 42 56"
                  fill="none"
                  stroke="#d97706"
                  strokeWidth="5"
                  strokeLinecap="round"
                />
              </g>

              {/* Chubby Phat Gus Body */}
              <ellipse
                cx="95"
                cy="122"
                rx="40"
                ry="38"
                fill="#b45309"
                stroke="#78350f"
                strokeWidth="3.5"
              />
              {/* Cream Belly Patch */}
              <ellipse cx="98" cy="126" rx="26" ry="27" fill="#fde68a" />

              {/* Little Squirrel Feet */}
              <ellipse cx="76" cy="156" rx="13" ry="7" fill="#92400e" />
              <ellipse cx="114" cy="156" rx="13" ry="7" fill="#92400e" />

              {/* Squirrel Head */}
              <circle
                cx="96"
                cy="74"
                r="30"
                fill="#b45309"
                stroke="#78350f"
                strokeWidth="3.5"
              />
              {/* Chubby Cheeks */}
              <ellipse cx="74" cy="82" rx="12" ry="9" fill="#d97706" />
              <ellipse cx="118" cy="82" rx="12" ry="9" fill="#d97706" />

              {/* Perky Squirrel Ears */}
              <ellipse cx="75" cy="46" rx="8" ry="13" fill="#b45309" stroke="#78350f" strokeWidth="3" />
              <ellipse cx="75" cy="47" rx="4" ry="8" fill="#fca5a5" />
              <ellipse cx="117" cy="46" rx="8" ry="13" fill="#b45309" stroke="#78350f" strokeWidth="3" />
              <ellipse cx="117" cy="47" rx="4" ry="8" fill="#fca5a5" />

              {/* Hat: Yellow Janitor Helmet for Mop Mode, Detective Cap for Magnifying Glass Mode */}
              {isMop ? (
                <g>
                  <path
                    d="M 68 52 C 68 30, 124 30, 124 52 Z"
                    fill="#facc15"
                    stroke="#ca8a04"
                    strokeWidth="3"
                  />
                  <rect x="62" y="49" width="68" height="6" rx="3" fill="#eab308" />
                </g>
              ) : (
                <g>
                  <path
                    d="M 68 52 C 70 32, 122 32, 124 52 Z"
                    fill="#38bdf8"
                    stroke="#0284c7"
                    strokeWidth="3"
                  />
                  <path d="M 90 48 L 136 52 L 96 55 Z" fill="#0284c7" />
                </g>
              )}

              {/* Mini Lab Splash Goggles on Phat Gus! */}
              <rect
                x="71"
                y="58"
                width="50"
                height="18"
                rx="6"
                fill="#bae6fd"
                stroke="#0284c7"
                strokeWidth="3"
              />
              <line x1="96" y1="58" x2="96" y2="76" stroke="#0284c7" strokeWidth="2.5" />
              {/* Expressive Eyes inside Goggles */}
              <circle cx="84" cy="67" r="4.5" fill="#0f172a" />
              <circle cx="85.5" cy="65.5" r="1.5" fill="#ffffff" />
              <circle cx="108" cy="67" r="4.5" fill="#0f172a" />
              <circle cx="109.5" cy="65.5" r="1.5" fill="#ffffff" />

              {/* Cute Nose & Buck Teeth */}
              <ellipse cx="96" cy="80" rx="5" ry="3.5" fill="#451a03" />
              <rect
                x="91"
                y="85"
                width="5"
                height="7"
                rx="1"
                fill="#ffffff"
                stroke="#451a03"
                strokeWidth="1.2"
              />
              <rect
                x="96"
                y="85"
                width="5"
                height="7"
                rx="1"
                fill="#ffffff"
                stroke="#451a03"
                strokeWidth="1.2"
              />

              {/* Animated Prop in Phat Gus's Paws: SUDSY MOP vs GIANT MAGNIFYING GLASS */}
              {isMop ? (
                <g
                  style={{
                    transform: `rotate(${swingAngle}deg)`,
                    transformOrigin: '130px 110px',
                  }}
                >
                  {/* Wooden Mop Handle */}
                  <line
                    x1="115"
                    y1="72"
                    x2="152"
                    y2="154"
                    stroke="#f59e0b"
                    strokeWidth="6"
                    strokeLinecap="round"
                  />
                  {/* Fluffy Cotton Mop Head at Bottom */}
                  <path
                    d="M 128 152 C 132 136, 168 136, 172 152 C 176 165, 124 165, 128 152 Z"
                    fill="#e0f2fe"
                    stroke="#38bdf8"
                    strokeWidth="3"
                  />
                  {/* Floating Soap Bubbles around Mop */}
                  <circle cx="164" cy="132" r="6" fill="#38bdf8" opacity="0.85" />
                  <circle cx="135" cy="126" r="4.5" fill="#34d399" opacity="0.85" />
                  <circle cx="154" cy="116" r="3.5" fill="#f43f5e" opacity="0.85" />
                </g>
              ) : (
                <g
                  style={{
                    transform: `rotate(${swingAngle}deg)`,
                    transformOrigin: '124px 108px',
                  }}
                >
                  {/* Magnifying Glass Handle */}
                  <line
                    x1="122"
                    y1="112"
                    x2="146"
                    y2="145"
                    stroke="#f59e0b"
                    strokeWidth="7"
                    strokeLinecap="round"
                  />
                  {/* Giant Magnifying Glass Rim & Glinting Cyan Lens */}
                  <circle
                    cx="138"
                    cy="82"
                    r="24"
                    fill="rgba(56, 189, 248, 0.28)"
                    stroke="#f59e0b"
                    strokeWidth="5"
                  />
                  {/* Lens Glint Line */}
                  <path
                    d="M 126 70 A 14 14 0 0 1 146 68"
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                  {/* Exclamation Clue inside Magnifying Lens */}
                  <text
                    x="138"
                    y="90"
                    textAnchor="middle"
                    fill="#fef08a"
                    fontSize="22"
                    fontWeight="bold"
                  >
                    !
                  </text>
                </g>
              )}
            </svg>

            {/* Mini Role Tag under Phat Gus */}
            <div className="absolute -bottom-2 inset-x-2 px-2 py-0.5 rounded-md bg-amber-500 text-slate-950 font-extrabold text-[10px] text-center truncate shadow">
              {isMop ? '🧹 JANITOR PHAT GUS' : '🔍 DETECTIVE PHAT GUS'}
            </div>
          </div>

          {/* Right Column: Oops / Safety Alert Message & Action Buttons */}
          <div className="flex-1 text-center sm:text-left space-y-2">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-amber-500/20 border border-amber-400/60 text-amber-300 text-[11px] font-bold font-mono-tabular">
              {isMop ? (
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              ) : (
                <Search className="w-3.5 h-3.5 text-amber-400" />
              )}
              <span>{event.badgeText}</span>
            </div>

            <h2 className="text-lg sm:text-xl font-extrabold font-display text-white leading-tight">
              {event.headline}
            </h2>

            <p className="text-xs text-slate-200 leading-relaxed">{event.explanation}</p>

            <div className="flex flex-col sm:flex-row items-center gap-2 pt-1.5">
              <button
                type="button"
                onClick={() => handleRunMopSweep(true)}
                className="w-full sm:w-auto flex-1 flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs shadow-lg transition-transform active:scale-95 whitespace-nowrap"
              >
                <Check className="w-3.5 h-3.5 stroke-[3]" />
                <span>{event.fixButtonLabel}</span>
              </button>

              <button
                type="button"
                onClick={() => handleRunMopSweep(false)}
                className="w-full sm:w-auto px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-semibold text-xs border border-slate-700 whitespace-nowrap"
              >
                {event.ignoreButtonLabel}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Re-Trigger / Safety Check Tip at Bottom */}
      <div className="pointer-events-none fixed bottom-24 inset-x-0 flex justify-center">
        <div
          className="px-3 py-1 rounded-full border border-slate-700 text-[11px] text-slate-300 flex items-center gap-1.5"
          style={{ backgroundColor: 'rgba(9, 13, 22, 0.9)' }}
        >
          <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
          <span>
            Phat Gus recorded this moment in your <strong>Live Science Report</strong>!
          </span>
        </div>
      </div>
    </div>
  );
};
