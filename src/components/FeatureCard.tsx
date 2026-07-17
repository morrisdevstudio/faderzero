import type { PropsWithChildren } from 'react';

interface FeatureCardProps extends PropsWithChildren {
  eyebrow: string;
  title: string;
  description: string;
  aside?: string;
}

export function FeatureCard({ eyebrow, title, description, aside, children }: FeatureCardProps) {
  return (
    <section className="fz-card rounded-[1.45rem] p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-[0.64rem] font-black uppercase tracking-[0.24em] text-[var(--fz-text-muted)]">
            {eyebrow}
          </p>
          <h2 className="mt-2 text-[1.35rem] font-black tracking-tight text-white">{title}</h2>
          <p className="mt-1.5 text-[0.92rem] leading-6 text-[var(--fz-text-muted)]">{description}</p>
        </div>
        {aside ? (
          <div className="fz-card-soft rounded-[1rem] px-2.5 py-1.5 text-[0.64rem] font-black uppercase tracking-[0.16em] text-white/85">
            {aside}
          </div>
        ) : null}
      </div>
      {children ? <div className="mt-4">{children}</div> : null}
    </section>
  );
}
