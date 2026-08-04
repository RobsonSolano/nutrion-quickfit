import { BigButton } from '../components/BigButton';
import { Cta } from '../components/Cta';
import { StepShell } from './Goal';
import { CONTRA_OPTIONS } from './labels';
import type { Contra } from '@quickfit/core/engine';

type Props = {
  selected: Contra[];
  onToggle: (tag: Contra) => void;
  onConfirm: () => void;
  onBack: () => void;
};

/**
 * Único passo que popula `avoid` (spec — nunca no caminho de atalho). Ao
 * contrário de Groups, zero selecionado é uma resposta válida: nem todo
 * aluno tem dor ou lesão, então o botão nunca fica desabilitado.
 */
export function Avoid({ selected, onToggle, onConfirm, onBack }: Props) {
  const n = selected.length;
  return (
    <StepShell
      step={5}
      title="Alguma dessas áreas te incomoda?"
      hint="A gente evita exercícios que sobrecarreguem esses pontos."
      onBack={onBack}
      footer={
        <Cta onClick={onConfirm}>
          {n === 0 ? 'Continuar sem restrições →' : `Continuar evitando ${n} área${n > 1 ? 's' : ''} →`}
        </Cta>
      }
    >
      <div className="grid grid-cols-1 content-start gap-4 sm:grid-cols-2">
        {CONTRA_OPTIONS.map((o) => (
          <BigButton
            key={o.tag}
            title={o.label}
            sub={o.sub}
            pressed={selected.includes(o.tag)}
            onClick={() => onToggle(o.tag)}
          />
        ))}
      </div>
    </StepShell>
  );
}
