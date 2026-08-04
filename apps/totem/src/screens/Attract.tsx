export function Attract({ gymName, onTouch }: { gymName: string; onTouch: () => void }) {
  return (
    <button
      type="button"
      onClick={onTouch}
      aria-label="Toque para começar"
      className="relative flex h-full w-full flex-col items-center justify-center gap-6 text-center sm:gap-8"
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
      <h1 className="font-display text-qf-hero font-extrabold leading-[1.05] tracking-tight text-balance">
        Monte seu treino
        <br />
        em 1 minuto
      </h1>
      <p className="animate-pulse text-qf-cta uppercase tracking-[0.1em] text-dim motion-reduce:animate-none">
        Toque na tela para começar
      </p>
      <p className="absolute bottom-6 text-qf-body text-dim sm:bottom-10">{gymName}</p>
    </button>
  );
}

/**
 * `size` é o teto (o valor de kiosk, inalterado). No celular o círculo cai
 * pela metade — `clamp()` com o mesmo espírito da escala de texto em
 * tailwind.config.js, só que aqui calculado em JS porque o diâmetro depende
 * do `size` que cada tela escolhe (140 no Attract, 52 no Header, 96 no
 * carregamento).
 */
export function Mark({ size = 52 }: { size?: number }) {
  const diameter = `clamp(${size / 2}px, ${(size / 7).toFixed(1)}vw, ${size}px)`;
  const border = Math.max(3, size * 0.075);
  return (
    <div
      aria-hidden
      className="relative flex-none rounded-full border-accent"
      style={{
        width: diameter,
        height: diameter,
        borderWidth: `clamp(${(border / 2).toFixed(1)}px, ${(border / 7).toFixed(2)}vw, ${border}px)`,
      }}
    >
      <span
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent"
        style={{ width: `calc(${diameter} * 0.33)`, height: `calc(${diameter} * 0.33)` }}
      />
    </div>
  );
}
