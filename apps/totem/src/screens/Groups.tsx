import { BigButton } from '../components/BigButton';
import { Cta } from '../components/Cta';
import { StepShell } from './Goal';
import { GROUP_LABEL } from './labels';
import type { MuscleGroup } from '@quickfit/core/engine';

type Props = {
  selected: MuscleGroup[];
  onToggle: (g: MuscleGroup) => void;
  onConfirm: () => void;
  onBack: () => void;
};

export function Groups({ selected, onToggle, onConfirm, onBack }: Props) {
  const n = selected.length;
  return (
    <StepShell
      step={2}
      title="O que você vai treinar?"
      hint="Pode escolher mais de um."
      onBack={onBack}
      footer={
        <Cta onClick={onConfirm} disabled={n === 0}>
          {n === 0 ? 'Escolha ao menos um grupo' : `Continuar com ${n} grupo${n > 1 ? 's' : ''} →`}
        </Cta>
      }
    >
      <div className="grid grid-cols-2 content-start gap-3 sm:grid-cols-3">
        {(Object.keys(GROUP_LABEL) as MuscleGroup[]).map((g) => (
          <BigButton
            key={g}
            title={GROUP_LABEL[g]}
            pressed={selected.includes(g)}
            onClick={() => onToggle(g)}
          />
        ))}
      </div>
    </StepShell>
  );
}
