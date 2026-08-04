import { BigButton } from '../components/BigButton';
import { StepShell } from './Goal';
import { TIME_OPTIONS_FULL, TIME_OPTIONS_QUICK } from './labels';
import type { Minutes } from '@quickfit/core/engine';

type Props = {
  onPick: (m: Minutes) => void;
  onBack: () => void;
  /** 'atalho' mostra a escada curta e não numera o passo. */
  variant: 'atalho' | 'completo';
};

export function Time({ onPick, onBack, variant }: Props) {
  const quick = variant === 'atalho';
  const options = quick ? TIME_OPTIONS_QUICK : TIME_OPTIONS_FULL;

  return (
    <StepShell
      step={quick ? undefined : 3}
      title="Quanto tempo você tem?"
      hint={quick ? 'A gente monta um treino de corpo inteiro nesse tempo.' : undefined}
      onBack={onBack}
    >
      <div className="grid grid-cols-1 content-start gap-4 sm:grid-cols-2">
        {options.map((m) => (
          <BigButton key={m} title={`${m} min`} onClick={() => onPick(m)} />
        ))}
      </div>
    </StepShell>
  );
}
