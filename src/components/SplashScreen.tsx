import { useCallback, useEffect, useRef } from 'react';

export const SPLASH_ANIMATION_DURATION_MS = 3600;
const SPLASH_COMPLETION_FALLBACK_MS = SPLASH_ANIMATION_DURATION_MS + 250;

interface SplashScreenProps {
  subtitle?: string;
  onComplete?: () => void;
  animated?: boolean;
}

export function SplashScreen({ subtitle = 'Chargement...', onComplete, animated = true }: SplashScreenProps) {
  const completedRef = useRef(false);

  const complete = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    onComplete?.();
  }, [onComplete]);

  useEffect(() => {
    if (!animated) return;

    const fallbackId = window.setTimeout(complete, SPLASH_COMPLETION_FALLBACK_MS);
    return () => window.clearTimeout(fallbackId);
  }, [animated, complete]);

  return (
    <div
      role="status"
      aria-label="Chargement de FaderZero"
      onAnimationEnd={animated ? complete : undefined}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#000000] text-white select-none"
    >
      <style>{`
        @keyframes faderMove {
          0% { transform: translateY(410px); opacity: 1; }
          76% { transform: translateY(49px); opacity: 1; }
          100% { transform: translateY(49px); opacity: 1; }
        }
        .animate-fader-cap {
          transform-box: fill-box;
          transform-origin: center;
          transform: translateY(410px);
          animation: faderMove ${SPLASH_ANIMATION_DURATION_MS}ms cubic-bezier(.45, 0, .15, 1) 1 both;
          will-change: transform, opacity;
        }
        .completed-fader-cap {
          transform-box: fill-box;
          transform-origin: center;
          transform: translateY(49px);
        }
      `}</style>

      {/* App Title */}
      <h1 className="mb-6 font-sans font-medium text-2xl sm:text-3xl tracking-[0.2em] text-white">
        FADERZERO
      </h1>

      {/* Fader Loader Pro */}
      <div className="w-[170px] max-w-[48vw] aspect-[3/8] text-white">
        <svg viewBox="0 0 240 640" className="block w-full h-full overflow-visible" aria-hidden="true">
          <defs>
            <filter id="softGlow" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            <linearGradient id="capFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#171717" />
              <stop offset="48%" stopColor="#050505" />
              <stop offset="100%" stopColor="#141414" />
            </linearGradient>

            <linearGradient id="capEdge" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#fff" stopOpacity=".45" />
              <stop offset="15%" stopColor="#fff" stopOpacity="1" />
              <stop offset="85%" stopColor="#fff" stopOpacity="1" />
              <stop offset="100%" stopColor="#fff" stopOpacity=".45" />
            </linearGradient>
          </defs>

          <g fill="none" stroke="currentColor" strokeLinecap="round">
            {/* Rail extérieur */}
            <rect
              x="114"
              y="68"
              width="12"
              height="500"
              rx="6"
              strokeWidth="1.5"
              opacity=".75"
            />

            {/* Fente intérieure */}
            <rect
              x="118"
              y="74"
              width="4"
              height="488"
              rx="2"
              fill="currentColor"
              opacity=".16"
              stroke="none"
            />

            {/* Marque de position 0 */}
            <g opacity=".6">
              <line x1="55" y1="193" x2="75" y2="193" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <text x="45" y="199" fill="currentColor" fontFamily="sans-serif" fontWeight="600" fontSize="18" textAnchor="end" stroke="none">0</text>
            </g>
          </g>

          {/* Fader animé */}
          <g className={animated ? 'animate-fader-cap' : 'completed-fader-cap'}>
            {/* Ombre */}
            <rect
              x="80.8"
              y="84"
              width="78.4"
              height="128"
              rx="12"
              fill="#fff"
              opacity=".08"
              filter="url(#softGlow)"
            />

            {/* Corps */}
            <rect
              x="84.8"
              y="80"
              width="70.4"
              height="128"
              rx="11"
              fill="url(#capFill)"
              stroke="url(#capEdge)"
              strokeWidth="2"
            />

            {/* Biseaux */}
            <path
              d="M92 200 H148"
              stroke="currentColor"
              strokeWidth="1.2"
              opacity=".28"
            />

            {/* Rainures */}
            <g stroke="currentColor" strokeLinecap="round">
              <line x1="92" y1="105" x2="148" y2="105" strokeWidth="2" opacity=".72" />
              <line x1="92" y1="118" x2="148" y2="118" strokeWidth="2" opacity=".8" />
              <line x1="92" y1="131" x2="148" y2="131" strokeWidth="2" opacity=".9" />
              <line x1="92" y1="144" x2="148" y2="144" strokeWidth="3.2" />
              <line x1="92" y1="157" x2="148" y2="157" strokeWidth="2" opacity=".9" />
              <line x1="92" y1="170" x2="148" y2="170" strokeWidth="2" opacity=".8" />
              <line x1="92" y1="183" x2="148" y2="183" strokeWidth="2" opacity=".72" />
            </g>

            {/* Repère central */}
            <rect
              x="84.8"
              y="141"
              width="70.4"
              height="6"
              fill="currentColor"
            />

            <line
              x1="91"
              y1="144"
              x2="149"
              y2="144"
              stroke="#000"
              strokeWidth="1.5"
              opacity=".65"
            />
          </g>
        </svg>
      </div>

      <p className="mt-8 text-[0.7rem] font-bold uppercase tracking-[0.2em] text-white/50 animate-pulse">
        {subtitle}
      </p>
    </div>
  );
}
