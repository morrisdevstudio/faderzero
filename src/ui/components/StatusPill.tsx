export type StatusPillTone = 'default' | 'accent' | 'success';

interface StatusPillProps {
  label: string;
  tone?: StatusPillTone;
}

const toneClasses: Record<StatusPillTone, string> = {
  default: 'border-white/10 bg-white/5 text-[var(--fz-text-muted)]',
  accent: 'border-[rgba(255,58,99,0.35)] bg-[rgba(255,58,99,0.14)] text-[var(--fz-accent-strong)]',
  success: 'border-[rgba(74,222,128,0.32)] bg-[rgba(74,222,128,0.12)] text-[var(--fz-success)]',
};

export function StatusPill({ label, tone = 'default' }: StatusPillProps) {
  return (
    <span
      className={`inline-flex max-w-full shrink-0 items-center whitespace-nowrap rounded-full border px-2.5 py-1 text-[0.68rem] font-black uppercase leading-none tracking-[0.16em] ${toneClasses[tone]}`}
    >
      {label}
    </span>
  );
}
