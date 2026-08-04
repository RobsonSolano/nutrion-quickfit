import { SHORTCUTS } from '../state/machine';
import { BigButton } from '../components/BigButton';
import { Cta } from '../components/Cta';

type Props = { onShortcut: (i: number) => void; onCustom: () => void };

export function Home({ onShortcut, onCustom }: Props) {
  const last = SHORTCUTS.length - 1;
  return (
    <div className="flex h-full flex-col gap-4 sm:gap-6">
      <h2 className="font-display text-qf-display font-extrabold leading-tight tracking-tight text-balance">
        Como vai ser hoje?
      </h2>

      <div className="grid flex-1 grid-cols-1 content-start gap-4 overflow-y-auto sm:grid-cols-2">
        {SHORTCUTS.map((sc, i) => (
          <BigButton
            key={sc.label}
            title={sc.label}
            sub={sc.sub}
            // O último atalho ("Treino rápido") fica sozinho na grade de 2
            // colunas — em vez de deixar meia linha vazia ao lado, ele ocupa
            // a linha inteira.
            className={i === last ? 'sm:col-span-2' : undefined}
            onClick={() => onShortcut(i)}
          />
        ))}
      </div>

      <Cta variant="ghost" onClick={onCustom}>
        ⚙ &nbsp;Montar do zero
      </Cta>
    </div>
  );
}
