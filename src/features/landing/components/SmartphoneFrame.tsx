import type { ReactNode } from 'react';

interface SmartphoneFrameProps {
  children: ReactNode;
  className?: string;
  notchLabel?: string;
}

export function SmartphoneFrame({ children, className = '', notchLabel }: SmartphoneFrameProps) {
  return (
    <div
      className={`relative mx-auto w-full max-w-[320px] sm:max-w-[340px] rounded-[3.2rem] border-[7px] border-[#202430] bg-[#0c0d12] p-1.5 shadow-[0_25px_80px_rgba(0,0,0,0.9),0_0_0_1px_rgba(255,255,255,0.08)] ${className}`}
    >
      {/* Outer Titanium Rim Gradient Effect */}
      <div className="absolute inset-0 rounded-[3rem] pointer-events-none ring-1 ring-white/10" />

      {/* Screen Container */}
      <div className="relative flex h-[580px] sm:h-[620px] w-full flex-col overflow-hidden rounded-[2.6rem] bg-[#090a0f] text-white">
        {/* Dynamic Island / Notch + Status Bar */}
        <div className="sticky top-0 z-30 flex h-10 w-full items-center justify-between px-6 pt-1.5 bg-[#090a0f]/90 backdrop-blur-md">
          <span className="font-mono text-[0.68rem] font-bold text-white/80">21:45</span>

          {/* Dynamic Island Pill */}
          <div className="flex h-4 w-20 items-center justify-center rounded-full bg-black shadow-inner">
            <div className="h-2 w-2 rounded-full bg-white/20 ml-auto mr-1.5" />
            <div className="h-1.5 w-1.5 rounded-full bg-indigo-500/60 mr-2" />
          </div>

          <div className="flex items-center gap-1.5 text-[0.65rem] text-white/80 font-bold">
            <span>5G</span>
            <span>100%</span>
          </div>
        </div>

        {/* Dynamic Notch Notification badge (Optional) */}
        {notchLabel && (
          <div className="flex justify-center -mt-2 mb-1 z-30">
            <span className="rounded-full bg-rose-500/20 px-2.5 py-0.5 text-[0.62rem] font-black tracking-wider text-rose-300 border border-rose-500/30 animate-pulse">
              {notchLabel}
            </span>
          </div>
        )}

        {/* Scrollable Viewport with Real App DOM */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-3.5 scrollbar-none font-sans">
          {children}
        </div>

        {/* Home Indicator bar */}
        <div className="sticky bottom-0 z-30 flex h-5 w-full items-center justify-center bg-[#090a0f]/80 backdrop-blur-md">
          <div className="h-1 w-28 rounded-full bg-white/30" />
        </div>
      </div>
    </div>
  );
}
