import { useEffect, useState } from 'react';
import { supabase } from '../data/supabase';

type Row = {
  id: string;
  exercises: Array<{
    name: string;
    sets: number;
    reps: string;
    cue: string | null;
    equipment: string[];
    image_url: string | null;
  }>;
};

const CREDIT_MARK = '#credit=';

/**
 * Algumas imagens (wger.de, CC BY-SA) exigem crédito visível — em vez de
 * criar uma coluna nova só para 5 linhas do catálogo, o crédito viaja
 * embutido no fragmento da própria `image_url` (fragmento nunca é enviado
 * ao servidor, então não quebra o carregamento da imagem).
 */
export function splitImageCredit(url: string): { base: string; credit: string | null } {
  const i = url.indexOf(CREDIT_MARK);
  if (i === -1) return { base: url, credit: null };
  return { base: url.slice(0, i), credit: decodeURIComponent(url.slice(i + CREDIT_MARK.length)) };
}

// Só o Free Exercise DB publica 2 fotos por exercício (posição inicial/final
// do movimento) no padrão "<slug>/0.jpg" — as imagens do wger.de são únicas.
export function hasSecondFrame(base: string): boolean {
  return /\/0\.jpg$/.test(base);
}

/**
 * Versão mínima da página do QR. Vídeo, cronômetro e marcar série entram no
 * piloto (spec §10, item 2) — aqui basta o aluno abrir e ver o treino.
 */
export function SharedWorkout({ id }: { id: string }) {
  const [row, setRow] = useState<Row | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState<{ name: string; base: string; credit: string | null } | null>(null);
  const [frame, setFrame] = useState<0 | 1>(0);
  const frameUrl = (base: string, f: 0 | 1) => base.replace(/\/0\.jpg$/, `/${f}.jpg`);

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
            {e.image_url ? (
              <button
                type="button"
                onClick={() => {
                  setFrame(0);
                  setOpen({ name: e.name, ...splitImageCredit(e.image_url!) });
                }}
                className="mt-2 min-h-[40px] rounded-lg border border-border px-3 text-sm font-semibold text-accent"
              >
                🖼 Ver imagem
              </button>
            ) : null}
          </li>
        ))}
      </ol>
      <p className="mt-8 text-sm text-dim">
        Use carga que deixe 2 repetições de reserva na última série. Sentiu dor,
        tontura ou falta de ar? Interrompa e procure a recepção.
      </p>

      {open ? (
        <div
          role="dialog"
          aria-label={open.name}
          onClick={() => setOpen(null)}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-black/85 p-6"
        >
          <div className="relative w-full max-w-sm" onClick={(ev) => ev.stopPropagation()}>
            <img
              src={frameUrl(open.base, frame)}
              alt={hasSecondFrame(open.base) ? `${open.name} — posição ${frame === 0 ? 'inicial' : 'final'}` : open.name}
              className="max-h-[70vh] w-full rounded-xl bg-white object-contain"
            />
            {hasSecondFrame(open.base) ? (
              <>
                <button
                  type="button"
                  aria-label="Posição anterior"
                  onClick={() => setFrame((f) => (f === 0 ? 1 : 0))}
                  className="absolute left-2 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-black/60 text-xl text-white"
                >
                  ‹
                </button>
                <button
                  type="button"
                  aria-label="Próxima posição"
                  onClick={() => setFrame((f) => (f === 0 ? 1 : 0))}
                  className="absolute right-2 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-black/60 text-xl text-white"
                >
                  ›
                </button>
              </>
            ) : null}
          </div>
          {hasSecondFrame(open.base) ? (
            <div className="flex gap-2">
              <span className={`h-2 w-2 rounded-full ${frame === 0 ? 'bg-accent' : 'bg-border'}`} />
              <span className={`h-2 w-2 rounded-full ${frame === 1 ? 'bg-accent' : 'bg-border'}`} />
            </div>
          ) : null}
          <p className="font-semibold text-text">{open.name}</p>
          {open.credit ? <p className="text-xs text-dim">Ilustração: {open.credit}</p> : null}
          <button
            type="button"
            onClick={() => setOpen(null)}
            className="min-h-[44px] rounded-lg border border-border px-5 text-dim"
          >
            ✕ Fechar
          </button>
        </div>
      ) : null}
    </main>
  );
}
