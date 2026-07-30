export function Attract({ gymName, onTouch }: { gymName: string; onTouch: () => void }) {
  return (
    <button
      type="button"
      onClick={onTouch}
      aria-label="Toque para começar"
      className="relative flex h-full w-full flex-col items-center justify-center gap-8 text-center"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(48% 42% at 50% 44%, var(--qf-accent-glow), transparent 72%)',
        }}
      />
      <Mark size={140} />
      <h1 className="font-display text-[72px] font-extrabold leading-[1.05] tracking-tight">
        Monte seu treino
        <br />
        em 1 minuto
      </h1>
      <p className="animate-pulse text-[28px] uppercase tracking-[0.1em] text-dim motion-reduce:animate-none">
        Toque na tela para começar
      </p>
      <p className="absolute bottom-10 text-[20px] text-dim">{gymName}</p>
    </button>
  );
}

export function Mark({ size = 52 }: { size?: number }) {
  return (
    <div
      aria-hidden
      className="relative flex-none rounded-full border-accent"
      style={{ width: size, height: size, borderWidth: Math.max(3, size * 0.075) }}
    >
      <span
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent"
        style={{ width: size * 0.33, height: size * 0.33 }}
      />
    </div>
  );
}
