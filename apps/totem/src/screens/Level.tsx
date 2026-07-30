import { BigButton } from '../components/BigButton';
import { StepShell } from './Goal';
import { LEVEL_OPTIONS } from './labels';
import type { Level as LevelType } from '@quickfit/core/engine';

type Props = { onPick: (l: LevelType) => void; onBack: () => void };

export function Level({ onPick, onBack }: Props) {
  return (
    <StepShell step={4} title="Qual sua experiência?" onBack={onBack}>
      <div className="grid grid-cols-2 content-start gap-4">
        {LEVEL_OPTIONS.map((o) => (
          <BigButton key={o.label} title={o.label} sub={o.sub} onClick={() => onPick(o.level)} />
        ))}
      </div>
    </StepShell>
  );
}
