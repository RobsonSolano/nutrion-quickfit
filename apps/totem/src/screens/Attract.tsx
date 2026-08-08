type AttractProps = { gymName: string; logoUrl?: string | null; onTouch: () => void };

export function Attract({ gymName, logoUrl, onTouch }: AttractProps) {
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
      <Mark size={100} logoUrl={logoUrl} />
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
 * do `size` que cada tela escolhe (100 no Attract, 52 no Header, 96 no
 * carregamento).
 *
 * Com `logoUrl`, a academia tem logo próprio: substitui o anel+ponto
 * genérico por esse logo, na mesma caixa size×size — nenhuma tela precisa
 * saber se está desenhando o mark padrão ou o de um cliente específico.
 *
 * O selo branco por trás não é estético — é defensivo: logo de cliente
 * normalmente é desenhado para papel/fundo claro (traço escuro), e o
 * fundo do totem é quase preto (--qf-bg). Sem o selo, um logo assim
 * simplesmente some. Custa nada para um logo que já nasceu claro.
 */
export function Mark({ size = 52, logoUrl }: { size?: number; logoUrl?: string | null }) {
  const diameter = `clamp(${size / 2}px, ${(size / 7).toFixed(1)}vw, ${size}px)`;

  if (logoUrl) {
    // `padding` calculado aqui, não via classe Tailwind `p-[8%]`: essa
    // classe (valor percentual arbitrário) zera a largura do <img> filho
    // neste setup — bug real, medido (a largura ia a 0px mesmo com
    // `width: 100%` inline; a altura, calculada à parte, funcionava normal).
    // Padding fixo em px, na mesma escala de `border` abaixo, não tem esse problema.
    const pad = Math.max(3, size * 0.08);
    return (
      <div
        className="flex-none rounded-xl bg-white shadow-sm"
        style={{
          width: diameter,
          height: diameter,
          padding: `clamp(${(pad / 2).toFixed(1)}px, ${(pad / 7).toFixed(2)}vw, ${pad.toFixed(1)}px)`,
        }}
      >
        <img
          src={logoUrl}
          alt=""
          aria-hidden
          style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
        />
      </div>
    );
  }

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
