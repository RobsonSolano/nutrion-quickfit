type Props = {
  children: React.ReactNode;
  onClick: () => void;
  variant?: 'solid' | 'ghost';
  disabled?: boolean;
};

export function Cta({ children, onClick, variant = 'solid', disabled }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        'flex min-h-touch w-full items-center justify-center gap-3 rounded-2xl px-6',
        'font-display font-extrabold tracking-tight transition-[filter,transform]',
        'active:scale-[0.99] disabled:opacity-35',
        'focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2',
        variant === 'solid'
          ? 'bg-accent text-onAccent text-qf-cta hover:brightness-110 focus-visible:outline-text'
          : 'border border-border bg-transparent text-qf-body font-semibold text-dim hover:border-accent hover:text-text focus-visible:outline-accent',
      ].join(' ')}
    >
      {children}
    </button>
  );
}
