import { supabase } from '../data/supabase';
import { cacheKey } from './cacheKey';
import type { Goal, MuscleGroup, Workout } from '@quickfit/core/engine';

export type Embellishment = { title: string; cues: Record<string, string> };

const TIMEOUT_MS = 2000;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    p,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

function valid(x: unknown): x is Embellishment {
  const e = x as Embellishment | null;
  return !!e && typeof e.title === 'string' && e.title.length > 0 && typeof e.cues === 'object';
}

/**
 * Camada deliberadamente descartável (D5). O treino já está na tela quando
 * isto roda; se falhar, der timeout ou não houver internet, o aluno não vê
 * diferença além do nome genérico. NUNCA lança.
 */
export async function embellish(
  workout: Workout,
  goal: Goal,
  groups: MuscleGroup[],
  timeoutMs = TIMEOUT_MS,
): Promise<Embellishment | null> {
  try {
    const ids = workout.items.map((it) => it.exercise.id);
    const key = await cacheKey(goal, groups, ids);

    // 1. Cache. É isto que leva a latência de p50 a zero numa academia real.
    const cached = await withTimeout(
      Promise.resolve(
        supabase
          .from('embellishments')
          .select('title, cues')
          .eq('cache_key', key)
          .maybeSingle(),
      ).then((r) => r.data),
      timeoutMs,
    );

    if (valid(cached)) {
      void supabase.rpc('bump_embellishment_hits', { k: key });
      return cached;
    }

    // 2. Provedor, via Edge Function (a chave nunca vai para o bundle).
    const res = await withTimeout(
      supabase.functions.invoke('embellish', {
        body: {
          goal,
          groups,
          exercises: workout.items.map((it) => ({
            id: it.exercise.id,
            name: it.exercise.name,
          })),
        },
      }),
      timeoutMs,
    );

    if (!res || res.error || !valid(res.data)) return null;
    const out = res.data;

    // 3. Grava para a próxima. Falha de escrita não é problema do aluno.
    void supabase
      .from('embellishments')
      .insert({ cache_key: key, title: out.title, cues: out.cues, model: 'edge' });

    return out;
  } catch {
    return null;
  }
}
