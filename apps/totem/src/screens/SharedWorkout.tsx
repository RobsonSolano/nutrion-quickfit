import { useEffect, useState } from 'react';
import { supabase } from '../data/supabase';

type Row = {
  id: string;
  exercises: Array<{ name: string; sets: number; reps: string; cue: string | null; equipment: string[] }>;
};

/**
 * Versão mínima da página do QR. Vídeo, cronômetro e marcar série entram no
 * piloto (spec §10, item 2) — aqui basta o aluno abrir e ver o treino.
 */
export function SharedWorkout({ id }: { id: string }) {
  const [row, setRow] = useState<Row | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    // `Promise.resolve` converte o thenable do postgrest-js num Promise de
    // verdade — sem isto `.then(...)` devolve `PromiseLike<void>`, que não
    // tem `.catch` (TS2339).
    Promise.resolve(supabase.rpc('get_workout', { workout_id: id }))
      .then(({ data, error }) => {
        const first = Array.isArray(data) ? data[0] : data;
        if (error || !first) setFailed(true);
        else setRow(first as Row);
      })
      .catch(() => setFailed(true));
  }, [id]);

  if (failed) {
    return (
      <main className="mx-auto max-w-xl p-8">
        <h1 className="font-display text-3xl font-extrabold">Treino não encontrado</h1>
        <p className="mt-3 text-dim">
          O link pode ter expirado. Gere um treino novo no totem da academia.
        </p>
      </main>
    );
  }

  if (!row) return <main className="p-8 text-dim">Carregando…</main>;

  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="font-display text-3xl font-extrabold tracking-tight">Seu treino</h1>
      <ol className="mt-6 flex flex-col gap-3">
        {row.exercises.map((e, i) => (
          <li key={i} className="rounded-lg border-l-4 border-accent bg-surface px-4 py-3">
            <div className="flex items-baseline justify-between gap-4">
              <span className="font-semibold">{e.name}</span>
              <span className="font-display font-extrabold tabular-nums">
                {e.sets}×{e.reps}
              </span>
            </div>
            <p className="mt-1 text-sm text-dim">
              {e.cue ?? (e.equipment.length > 0 ? e.equipment.join(' · ') : 'peso corporal')}
            </p>
          </li>
        ))}
      </ol>
      <p className="mt-8 text-sm text-dim">
        Use carga que deixe 2 repetições de reserva na última série. Sentiu dor,
        tontura ou falta de ar? Interrompa e procure a recepção.
      </p>
    </main>
  );
}
