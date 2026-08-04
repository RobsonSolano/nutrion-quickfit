import { BigButton } from '../components/BigButton';
import { GOAL_OPTIONS } from './labels';
import type { Goal as GoalType } from '@quickfit/core/engine';

type Props = { onPick: (g: GoalType) => void; onBack: () => void };

export function Goal({ onPick, onBack }: Props) {
  return (
    <StepShell step={1} title="Qual seu objetivo?" onBack={onBack}>
      <div className="grid grid-cols-2 content-start gap-4 sm:grid-cols-3">
        {GOAL_OPTIONS.map((o) => (
          <BigButton key={o.label} title={o.label} sub={o.sub} onClick={() => onPick(o.goal)} />
        ))}
      </div>
    </StepShell>
  );
}

export function StepShell({
  step, title, hint, onBack, children, footer,
}: {
  /** Omitido no fluxo de atalho: lá não há "passo 3 de 5". */
  step?: number;
  title: string;
  hint?: string;
  onBack: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="flex h-full flex-col gap-3 sm:gap-5">
      <div className="flex flex-none items-center justify-between">
        <span className="text-qf-label uppercase tracking-[0.1em] text-dim">
          {step ? `Passo ${step} de 5` : ''}
        </span>
        <button
          type="button"
          onClick={onBack}
          className="min-h-[64px] rounded-xl px-5 text-qf-cta text-dim hover:text-text focus-visible:outline focus-visible:outline-4 focus-visible:outline-accent"
        >
          ← Voltar
        </button>
      </div>
      <h2 className="flex-none font-display text-qf-display font-extrabold leading-tight tracking-tight text-balance">
        {title}
      </h2>
      {hint ? <p className="flex-none text-qf-body text-dim">{hint}</p> : null}
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      {footer ? <div className="flex-none">{footer}</div> : null}
    </div>
  );
}
