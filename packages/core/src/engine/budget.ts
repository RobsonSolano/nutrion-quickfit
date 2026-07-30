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
 * Escolhe séries e descanso MIRANDO no alvo de exercícios do tempo pedido.
 * Sessão curta legitimamente usa menos série — é o que um professor faz com
 * quem tem 20 minutos.
 *
 * Mira, não garante. Existe combinação onde nem o degrau mais apertado faz o
 * alvo caber: força em 20 min quer 4 exercícios e o mínimo (2 séries × 68s)
 * custa 1024s contra 900s de orçamento. Nesse caso devolve o mínimo mesmo
 * assim, e quem faz o orçamento fechar é o `generateWorkout`, que para de
 * escolher quando nada mais cabe em `remaining` — força em 20 min sai com 3
 * exercícios, não 4, e `usedSec <= budgetSec`. O alvo é aspiração; o teto de
 * tempo é do gerador.
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

  // Este caminho É alcançado hoje, por exatamente um dos 35 pares: força em
  // 20 min. Nem o degrau mais apertado (2 × 68s = 1024s) cabe nos 900s. Não é
  // defensivo — é o caso real de "o aluno pediu força numa janela curta".
  // Devolve o mínimo e deixa o `generateWorkout` cortar exercício até fechar
  // o orçamento, em vez de encurtar o descanso abaixo do que a política
  // escolhida permite.
  return { sets: MIN_SETS, reps, rest: ladder[ladder.length - 1]!, target };
}

export function costOf(ex: Exercise, sc: Scheme): number {
  if (ex.pattern === 'cardio') {
    return (ex.durationSec ?? 0) + TRANSITION_SEC;
  }
  return sc.sets * (ex.avgSecPerSet + sc.rest) + TRANSITION_SEC;
}
