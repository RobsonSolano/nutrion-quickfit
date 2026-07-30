import { MAX_EX, MAX_PER_GROUP, WARMUP_SEC } from './constants';
import { costOf, schemeFor } from './budget';
import { eligible } from './filter';
import { mulberry32, weightedPick } from './rng';
import type { Exercise, Input, MuscleGroup, Pattern, Workout, WorkoutItem } from './types';

const MAX_SETS_CEILING = 6;

export function generateWorkout(input: Input, catalog: Exercise[]): Workout {
  const pool = eligible(catalog, input);
  const rng = mulberry32(input.seed);
  const scheme = schemeFor(input);
  const cap = Math.min(MAX_EX[input.goal], scheme.target);
  const budgetSec = input.minutes * 60 - WARMUP_SEC;
  let remaining = budgetSec;

  const picked: Exercise[] = [];
  const usedPatterns = new Map<Pattern, number>();
  const groupCount = new Map<MuscleGroup, number>();

  while (remaining > 0 && picked.length < cap) {
    const candidates = pool
      .filter((ex) => !picked.some((p) => p.id === ex.id))
      .filter((ex) => (groupCount.get(ex.primary) ?? 0) < MAX_PER_GROUP)
      .filter((ex) => costOf(ex, scheme) <= remaining);

    if (candidates.length === 0) break;

    const chosen = weightedPick(
      candidates.map((ex) => ({ item: ex, score: scoreOf(ex, candidates) })),
      rng,
    );

    picked.push(chosen);
    remaining -= costOf(chosen, scheme);
    usedPatterns.set(chosen.pattern, (usedPatterns.get(chosen.pattern) ?? 0) + 1);
    groupCount.set(chosen.primary, (groupCount.get(chosen.primary) ?? 0) + 1);
  }

  const items: WorkoutItem[] = picked.map((exercise) => ({
    exercise,
    sets: exercise.pattern === 'cardio' ? 1 : scheme.sets,
    reps:
      exercise.pattern === 'cardio'
        ? `${(exercise.durationSec ?? 0) / 60} min`
        : scheme.reps,
  }));

  // Sobrou tempo depois do teto? Aumenta VOLUME nos compostos em vez de somar
  // mais aparelho — é o que um professor faz. Round-robin para não empilhar
  // tudo no primeiro exercício, e teto de +1 série: sem ele, 90 min de
  // emagrecimento saía com 9 exercícios × 6 séries = 54 séries.
  const setCap = Math.min(MAX_SETS_CEILING, scheme.sets + 1);
  let extraSets = 0;
  let i = 0;
  let guard = 0;

  while (remaining > 0 && guard++ < 200) {
    const candidates = items.filter(
      (it) => it.exercise.pattern !== 'cardio' && it.sets < setCap,
    );
    // Prefere composto; se não houver (mobilidade, treino só de isolado),
    // aceita qualquer não-cardio em vez de desperdiçar o tempo pedido.
    const compounds = candidates.filter((it) => it.exercise.isCompound);
    const jar = compounds.length > 0 ? compounds : candidates;
    if (jar.length === 0) break;

    const target = jar[i++ % jar.length];
    const cost = target.exercise.avgSecPerSet + scheme.rest;
    if (cost > remaining) break;

    target.sets += 1;
    remaining -= cost;
    extraSets += 1;
  }

  // Sessão só de cardio é treino válido com 1 item: "30 min de esteira" não é
  // treino incompleto. Musculação exige 3 para valer a pena.
  const cardioOnly = pool.length > 0 && pool.every((ex) => ex.pattern === 'cardio');

  return {
    items,
    scheme,
    poolSize: pool.length,
    budgetSec,
    usedSec: budgetSec - remaining,
    cap,
    minItems: cardioOnly ? 1 : 3,
    extraSets,
  };

  function scoreOf(ex: Exercise, candidates: Exercise[]): number {
    let s = 1;

    // Compostos no primeiro TERÇO: o aluno está descansado, então é mais
    // seguro e mais eficaz. Isolados preenchem o final.
    const early = picked.length < Math.max(2, Math.ceil(cap / 3));

    if (early) {
      s *= ex.isCompound ? 4 : 0.3;
    } else if (ex.isCompound) {
      // PORTA DURA, não preferência. Decisão do Robson (jul/2026), medida
      // sobre 1680 gerações: com o multiplicador antigo de 0.5 o composto
      // tardio era só desfavorecido, e a segunda metade tinha 2 ou mais
      // compostos em 24% das sessões — agachamento livre caía no fim em 7.9%
      // delas, com a pessoa exausta e sem professor ao lado. Com a porta,
      // 68% das sessões terminam com ZERO composto tardio e o agachamento
      // tardio cai para 2.4%. A variação não sofre: 184 treinos distintos em
      // 200 contra 187 de antes.
      //
      // Não pode travar o seletor: se TODOS os candidatos forem compostos,
      // `temIsolado` é falso e eles voltam a pontuar. Nunca dá score 0 em
      // todos ao mesmo tempo, então `weightedPick` nunca recebe total 0.
      const temIsolado = candidates.some((c) => !c.isCompound);
      if (temIsolado) return 0;
      s *= 0.5;
    } else {
      s *= 1.4;
    }

    // Cobertura: nenhum grupo dobra antes de todos serem atendidos.
    const untouched = input.groups.filter((g) => !groupCount.has(g));
    if (untouched.length > 0) {
      s *= untouched.includes(ex.primary) ? 5 : 0.2;
    }

    // Não empilha o mesmo padrão de movimento.
    s *= 1 / (1 + (usedPatterns.get(ex.pattern) ?? 0));

    // Não manda o aluno pro mesmo aparelho duas vezes seguidas — fila.
    const last = picked.at(-1);
    if (last && ex.equipment.some((eq) => last.equipment.includes(eq))) {
      s *= 0.4;
    }

    return s;
  }
}
