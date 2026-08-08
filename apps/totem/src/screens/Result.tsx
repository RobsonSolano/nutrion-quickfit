import { useEffect, useRef, useState } from 'react';
import { Cta } from '../components/Cta';
import { useHasMore } from './useHasMore';
import { describeWorkout } from './labels';
import { qrDataUrl, workoutUrl } from '../print/qr';
import type { Workout } from '@quickfit/core/engine';

type Props = {
  workout: Workout;
  groupsTitle: string;
  levelLabel: string;
  embellishTitle: string | null;
  cues?: Record<string, string>;
  workoutId: string | null;
  onPrint: () => void;
  onRegenerate: () => void;
  onExit: () => void;
};

export function Result({
  workout, groupsTitle, levelLabel, embellishTitle, cues, workoutId, onPrint, onRegenerate, onExit,
}: Props) {
  const listRef = useRef<HTMLDivElement>(null);
  const { hasMore, below } = useHasMore(listRef);
  const d = describeWorkout(workout);
  const dense = workout.items.length > 7;
  const [qr, setQr] = useState<string | null>(null);

  // Nova geração começa do topo, senão o aluno vê o meio da lista.
  useEffect(() => {
    listRef.current?.scrollTo({ top: 0 });
  }, [workout]);

  // `workoutId` só existe depois que o POST em `generated_workouts`
  // completa (§ genToken em App.tsx) — até lá o QR fica em "gerando…".
  useEffect(() => {
    setQr(null);
    if (!workoutId) return;
    qrDataUrl(workoutUrl(workoutId)).then(setQr).catch(() => setQr(null));
  }, [workoutId]);

  return (
    <div className="flex h-full flex-col gap-5">
      <div className="flex flex-none items-start justify-between gap-6">
        <div>
          <h2 className="font-display text-qf-title font-extrabold leading-tight tracking-tight text-balance">
            {embellishTitle ?? `Treino A — ${groupsTitle}`}
          </h2>
          <div className="mt-2 flex flex-wrap gap-x-8 gap-y-1 text-qf-body text-dim">
            <span><b className="text-text">{d.exercicios}</b> exercícios</span>
            <span><b className="text-text">{d.series}</b> séries</span>
            <span>~<b className="text-text">{d.minutos}</b> min com aquecimento</span>
            <span>nível <b className="text-text">{levelLabel}</b></span>
          </div>
        </div>
        <button
          type="button"
          onClick={onExit}
          className="min-h-[64px] flex-none rounded-xl px-5 text-qf-cta text-dim hover:text-text focus-visible:outline focus-visible:outline-4 focus-visible:outline-accent"
        >
          ✕ Sair
        </button>
      </div>

      <div className="relative min-h-0 flex-1">
        <div
          ref={listRef}
          className={[
            'absolute inset-0 flex flex-col overflow-y-auto pr-2',
            dense ? 'gap-2' : 'gap-3',
            '[scrollbar-color:var(--qf-accent)_var(--qf-surface)] [scrollbar-width:thin]',
          ].join(' ')}
          style={{ scrollbarGutter: 'stable' }}
        >
          {workout.items.map((it, i) => (
            <div
              key={it.exercise.id}
              className={[
                'flex flex-none items-center gap-5 rounded-lg border-l-4 border-accent bg-surface',
                dense ? 'px-5 py-2' : 'px-5 py-3',
              ].join(' ')}
            >
              <span className="w-10 flex-none font-display text-qf-cta font-extrabold tabular-nums text-accent">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-display text-qf-button font-semibold">
                  {it.exercise.name}
                </span>
                <span className="block truncate text-qf-label text-dim">
                  {cues?.[it.exercise.id] ?? it.exercise.cue ?? it.exercise.equipment.join(' · ')}
                </span>
              </span>
              <span className="flex-none font-display text-qf-cta font-extrabold tabular-nums">
                {it.exercise.pattern === 'cardio' ? it.reps : `${it.sets}×${it.reps}`}
              </span>
            </div>
          ))}
        </div>

        {hasMore && (
          <>
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bottom-0 h-16"
              style={{ background: 'linear-gradient(to top, var(--qf-bg), transparent)' }}
            />
            <span className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-accent px-4 py-1 text-qf-label font-extrabold text-onAccent">
              ↓ mais {below} exercício{below > 1 ? 's' : ''} — role a lista
            </span>
          </>
        )}
      </div>

      <p className="flex-none text-qf-label text-dim">
        Descanso de {workout.scheme.rest}s entre séries
        {embellishTitle ? ' · nome e dicas escritos pela IA' : ''}
      </p>

      <div className="flex flex-none items-center gap-6">
        <div className="flex flex-1 flex-col items-center gap-2">
          <p className="text-center text-qf-label text-dim">
            Escaneie o QR code e visualize pelo celular
          </p>
          {qr ? (
            <div className="rounded-xl bg-white p-3">
              <img src={qr} alt="QR do treino" className="h-[104px] w-[104px]" />
            </div>
          ) : (
            <div className="grid h-[130px] w-[130px] place-items-center rounded-xl border border-dashed border-border text-center text-qf-label text-dim">
              gerando…
            </div>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-3">
          <Cta onClick={onPrint}>🖨 &nbsp;Imprimir ficha</Cta>
          <Cta variant="ghost" onClick={onRegenerate}>↻ &nbsp;Gerar outro</Cta>
        </div>
      </div>
    </div>
  );
}
