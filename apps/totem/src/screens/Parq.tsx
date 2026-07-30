import { PARQ_QUESTIONS } from '../state/machine';
import { Cta } from '../components/Cta';

type Props = {
  marked: number[];
  onToggle: (i: number) => void;
  onNone: () => void;
};

/** D6: uma tela, 1 toque no caminho felizeu, e responde a objeção do gestor. */
export function Parq({ marked, onToggle, onNone }: Props) {
  return (
    <div className="flex h-full flex-col gap-6">
      <h2 className="font-display text-[56px] font-extrabold leading-tight tracking-tight text-balance">
        Algum destes se aplica a você hoje?
      </h2>

      <div className="flex flex-col gap-3">
        {PARQ_QUESTIONS.map((q, i) => {
          const on = marked.includes(i);
          return (
            <button
              key={q}
              type="button"
              onClick={() => onToggle(i)}
              aria-pressed={on}
              className={[
                'flex min-h-touch w-full items-center gap-5 rounded-2xl border px-6 text-left',
                'focus-visible:outline focus-visible:outline-4 focus-visible:outline-accent',
                on ? 'border-danger bg-surface' : 'border-border bg-surface hover:border-dim',
              ].join(' ')}
            >
              <span
                aria-hidden
                className={[
                  'grid h-9 w-9 flex-none place-items-center rounded-md border-2 text-xl font-extrabold',
                  on ? 'border-danger bg-danger text-white' : 'border-dim',
                ].join(' ')}
              >
                {on ? '✕' : ''}
              </span>
              <span className="text-[28px] font-semibold">{q}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-auto">
        <Cta onClick={onNone}>Nenhuma das anteriores &nbsp;→</Cta>
      </div>
    </div>
  );
}
