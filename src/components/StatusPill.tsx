interface StatusPillProps {
  label: string;
  tone?: 'default' | 'accent' | 'success';
}

export function StatusPill({ label, tone = 'default' }: StatusPillProps) {
  return (
    <span
      className={[
        'inline-flex rounded-full border px-2.5 py-1 text-[0.68rem] font-black uppercase tracking-[0.16em]',
        tone === 'accent'
          ? 'border-[rgba(255,58,99,0.35)] bg-[rgba(255,58,99,0.14)] text-[var(--fz-accent-strong)]'
          : tone === 'success'
            ? 'border-[rgba(74,222,128,0.32)] bg-[rgba(74,222,128,0.12)] text-[var(--fz-success)]'
            : 'border-white/10 bg-white/5 text-[var(--fz-text-muted)]',
      ].join(' ')}
    >
      {label}
    </span>
  );
}
