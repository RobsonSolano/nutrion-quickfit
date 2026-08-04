type Props = {
  title: string;
  sub?: string;
  pressed?: boolean;
  onClick: () => void;
  className?: string;
};

/**
 * Alvo de toque de 96px, não os 44px de mobile: dedo grosso, mão suada,
 * pessoa em pé a 60–80cm da tela (spec §6).
 */
export function BigButton({ title, sub, pressed, onClick, className }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      className={[
        'flex min-h-touch flex-col justify-center gap-1 rounded-2xl px-4 py-4 text-left sm:px-6 sm:py-5',
        'border transition-colors active:scale-[0.985]',
        'focus-visible:outline focus-visible:outline-4 focus-visible:outline-accent',
        pressed
          ? 'border-accent bg-raised shadow-[inset_0_0_0_2px_var(--qf-accent)]'
          : 'border-border bg-surface hover:border-accent hover:bg-raised',
        className ?? '',
      ].join(' ')}
    >
      <span className="font-display text-qf-button font-semibold leading-tight tracking-tight">
        {title}
        {pressed ? <span className="text-accent"> ✓</span> : null}
      </span>
      {sub ? <span className="text-qf-body text-dim">{sub}</span> : null}
    </button>
  );
}
