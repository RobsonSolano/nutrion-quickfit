import {
  AVG_SEC, MAX_EX, REST, SETS_REPS, TARGET_EX, TRANSITION_SEC, WARMUP_SEC,
} from './constants';
import type { Exercise, Input, Scheme } from './types';

/** Ninguém sai do totem com uma série só. */
const MIN_SETS = 2;

/**
 * Piso absoluto de descanso, em segundos. Só se aplica a objetivos cujo
 * descanso base já é maior que isso — mobilidade descansa 30s e continua
 * descansando 30s.
 */
const REST_FLOOR = 35;

/**
 * Descansos que o motor tenta, do ideal ao mínimo aceitável.
 *
 * A escada é SEMPRE decrescente. A versão anterior era
 * `[baseRest, Math.min(baseRest, 60), 45, 35]`, que para mobilidade virava
 * `[30, 30, 45, 35]` — subia no terceiro degrau. Nunca chegava lá na prática,
 * mas era uma escada mal formada esperando um objetivo novo para quebrar.
 *
 * Os degraus são proporcionais, não absolutos, porque 60s é um corte razoável
 * para hipertrofia e absurdo para força: a escada antiga pulava de 150s direto
 * para 60s, e era esse penhasco que fazia força em 50 min devolver 2 séries
 * enquanto 45 min devolvia 3.
 */
function restLadder(baseRest: number): number[] {
  const floor = Math.min(REST_FLOOR, baseRest);
  const rungs = [baseRest, Math.round(baseRest * 0.6), Math.round(baseRest * 0.45)]
    .map((r) => Math.max(r, floor));
  return [...new Set(rungs)];
}

/**
 * Escolhe séries e descanso que fazem o ALVO de exercícios caber no tempo.
 * Sessão curta legitimamente usa menos série — é o que um professor faz com
 * quem tem 20 minutos.
 */
export function schemeFor(input: Input): Scheme {
  const target = Math.min(TARGET_EX[input.minutes], MAX_EX[input.goal]);
  const budget = input.minutes * 60 - WARMUP_SEC;
  const { sets: baseSets, reps } = SETS_REPS[input.goal];
  const baseRest = REST[input.goal];

  // Descanso primeiro, série depois: para cada descanso da escada, esgota as
  // séries antes de encurtar o descanso. Decisão do Robson (jul/2026) — o
  // totem não tem professor ao lado, e um descanso curto demais com aluno
  // iniciante vira execução ruim. Volume menor, cada série executável.
  const ladder = restLadder(baseRest);

  for (const rest of ladder) {
    for (let sets = baseSets; sets >= MIN_SETS; sets--) {
      const perEx = sets * (AVG_SEC + rest) + TRANSITION_SEC;
      if (target * perEx <= budget) return { sets, reps, rest, target };
    }
  }

  // Não deveria acontecer com os 35 pares (tempo × objetivo) de hoje, mas se
  // algum alvo novo não couber, devolve o mínimo e deixa a duração honesta
  // aparecer na ficha em vez de mentir sobre o tempo.
  return { sets: MIN_SETS, reps, rest: ladder[ladder.length - 1]!, target };
}

export function costOf(ex: Exercise, sc: Scheme): number {
  if (ex.pattern === 'cardio') {
    return (ex.durationSec ?? 0) + TRANSITION_SEC;
  }
  return sc.sets * (ex.avgSecPerSet + sc.rest) + TRANSITION_SEC;
}
