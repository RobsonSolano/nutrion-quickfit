import { BigButton } from '../components/BigButton';
import { StepShell } from './Goal';
import { LEVEL_OPTIONS } from './labels';
import type { Level as LevelType } from '@quickfit/core/engine';

type Props = {
  onPick: (l: LevelType) => void;
  onBack: () => void;
  /** 'atalho' também pergunta nível agora, mas não numera o passo. */
  variant: 'atalho' | 'completo';
};

export function Level({ onPick, onBack, variant }: Props) {
  return (
    <StepShell step={variant === 'completo' ? 4 : undefined} title="Qual sua experiência?" onBack={onBack}>
      <div className="grid grid-cols-1 content-start gap-4 sm:grid-cols-2">
        {LEVEL_OPTIONS.map((o) => (
          <BigButton key={o.label} title={o.label} sub={o.sub} onClick={() => onPick(o.level)} />
        ))}
      </div>
    </StepShell>
  );
}
