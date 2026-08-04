export function Attract({ gymName, onTouch }: { gymName: string; onTouch: () => void }) {
  return (
    <button
      type="button"
      onClick={onTouch}
      aria-label="Toque para começar"
      className="relative flex h-full w-full flex-col items-center gap-6 pt-[8vh] text-center sm:justify-center sm:gap-8 sm:pt-0"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(48% 42% at 50% 44%, var(--qf-accent-glow), transparent 72%)',
        }}
      />
      {/* No celular o bloco fica ancorado perto do topo (`pt-[8vh]`), não
          centralizado: centralizar um conteúdo curto numa tela alta e
          estreita deixa um vão vazio enorme e simétrico entre o texto e o
          nome da academia (bug reportado ago/2026) — ancorado no topo, a
          sobra vira margem de rodapé comum, não um buraco estranho no meio.
          No kiosk (tela larga, proporção mais baixa) o vão não incomoda, e
          `sm:justify-center` volta ao layout original. */}
      <Mark size={140} />
      <h1 className="font-display text-qf-hero font-extrabold leading-[1.05] tracking-tight text-balance">
        Monte seu treino
        <br />
        em 1 minuto
      </h1>
      <p className="animate-pulse text-qf-cta uppercase tracking-[0.1em] text-dim motion-reduce:animate-none">
        Toque na tela para começar
      </p>
      {/* No kiosk volta a ficar fixo embaixo, como sempre foi; no celular
          entra no fluxo normal logo depois do prompt — ver comentário acima. */}
      <p className="text-qf-body text-dim sm:absolute sm:bottom-10">{gymName}</p>
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
