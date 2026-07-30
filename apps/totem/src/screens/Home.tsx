import { SHORTCUTS } from '../state/machine';
import { BigButton } from '../components/BigButton';
import { Cta } from '../components/Cta';

type Props = { onShortcut: (i: number) => void; onCustom: () => void };

export function Home({ onShortcut, onCustom }: Props) {
  return (
    <div className="flex h-full flex-col gap-6">
      <h2 className="font-display text-[56px] font-extrabold leading-tight tracking-tight">
        Como vai ser hoje?
      </h2>

      <div className="grid flex-1 grid-cols-2 content-start gap-4">
        {SHORTCUTS.map((sc, i) => (
          <BigButton
            key={sc.label}
            title={sc.label}
            sub={sc.sub}
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
