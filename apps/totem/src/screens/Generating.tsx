import { useEffect, useState } from 'react';
import { Mark } from './Attract';

const STEPS = [
  'filtrando exercícios disponíveis nesta unidade…',
  'encaixando no seu tempo…',
  'ordenando por padrão de movimento…',
];

export function Generating() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setI((n) => Math.min(n + 1, STEPS.length - 1)), 260);
    return () => window.clearInterval(t);
  }, []);

  return (
    <div className="relative flex h-full flex-col items-center justify-center gap-6 text-center">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(48% 42% at 50% 44%, var(--qf-accent-glow), transparent 72%)',
        }}
      />
      <div className="animate-pulse motion-reduce:animate-none">
        <Mark size={96} />
      </div>
      <h2 className="font-display text-qf-title font-extrabold tracking-tight">
        Montando seu treino
      </h2>
      <p aria-live="polite" className="text-qf-body text-dim">
        {STEPS[i]}
      </p>
    </div>
  );
}
