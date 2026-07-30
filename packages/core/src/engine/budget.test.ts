import { describe, it, expect } from 'vitest';
import { schemeFor, costOf } from './budget';
import { REST, SETS_REPS } from './constants';
import type { Exercise, Goal, Input, Minutes } from './types';

/** Em ordem crescente — três testes dependem disso para varrer a escada. */
const ALL_MINUTES: Minutes[] = [20, 30, 40, 45, 50, 60, 90];
const GOALS: Goal[] = ['forca', 'hipertrofia', 'resistencia', 'emagrecimento', 'mobilidade'];

const input = (over: Partial<Input> = {}): Input => ({
  goal: 'hipertrofia', groups: ['peito'], minutes: 45, level: 3,
  availableEquipment: [], avoid: [], seed: 1, ...over,
});

const ex = (over: Partial<Exercise> = {}): Exercise => ({
  id: 'x', name: 'X', primary: 'peito', secondary: [], equipment: [],
  level: 1, pattern: 'iso', isCompound: false, avgSecPerSet: 30, kind: 'treino',
  contraindications: [], ...over,
});

describe('schemeFor', () => {
  it('cabe 4 exercícios em 20 min de hipertrofia reduzindo série e descanso', () => {
    // O bug original: 4 séries × 75s de descanso cabia UM exercício em 20 min.
    const sc = schemeFor(input({ minutes: 20, goal: 'hipertrofia' }));
    expect(sc.target).toBe(4);
    expect(sc.sets).toBeLessThanOrEqual(3);
    expect(sc.rest).toBeLessThanOrEqual(60);
    expect(sc.target * (sc.sets * (30 + sc.rest) + 60)).toBeLessThanOrEqual(20 * 60 - 300);
  });

  it('mantém o esquema cheio do objetivo quando o tempo permite', () => {
    const sc = schemeFor(input({ minutes: 90, goal: 'forca' }));
    expect(sc.sets).toBe(4);
    expect(sc.rest).toBe(150);
    expect(sc.reps).toBe('4-6');
  });

  it('preserva as repetições do objetivo mesmo reduzindo séries', () => {
    const sc = schemeFor(input({ minutes: 20, goal: 'resistencia' }));
    expect(sc.reps).toBe('15-20');
  });

  it('nunca desce abaixo de 2 séries', () => {
    for (const minutes of ALL_MINUTES) {
      for (const goal of GOALS) {
        expect(schemeFor(input({ minutes, goal })).sets).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('limita o alvo pelo teto do objetivo, não só pelo tempo', () => {
    // 90 min pede 9; força tem teto 6.
    const sc = schemeFor(input({ minutes: 90, goal: 'forca' }));
    expect(sc.target).toBe(6);
  });

  it('mais tempo nunca produz menos treino, e nunca mais descanso', () => {
    // O defeito que este teste tranca, medido na escada antiga:
    //   força 45 min -> 3 séries × 60s  (volume 18)
    //   força 50 min -> 2 séries × 150s (volume 12)
    // Cinco minutos A MAIS devolviam um treino MENOR. A causa era o penhasco
    // de 150s direto para 60s na escada de descanso.
    for (const goal of GOALS) {
      let volumeAnterior = 0;
      let descansoAnterior = 0;
      for (const minutes of ALL_MINUTES) {
        const sc = schemeFor(input({ minutes, goal }));
        expect(sc.sets * sc.target).toBeGreaterThanOrEqual(volumeAnterior);
        expect(sc.rest).toBeGreaterThanOrEqual(descansoAnterior);
        volumeAnterior = sc.sets * sc.target;
        descansoAnterior = sc.rest;
      }
    }
  });

  it('o descanso fica entre o piso e o descanso base do objetivo', () => {
    // Política escolhida: descanso íntegro, menos série. Um descanso curto
    // demais é o defeito que esta política existe para impedir — o totem não
    // tem professor ao lado para corrigir execução.
    //
    // O limite SUPERIOR é o que tranca a regressão de verdade. Só o piso
    // (`rest >= min(35, base)`) não trancava nada para mobilidade: se o piso
    // virasse `REST_FLOOR` fixo, `restLadder(30)` devolveria `[35]` em vez de
    // `[30]` — e `35 >= 30` passa. O treino de mobilidade ganharia 5s de
    // descanso por série em toda sessão, silenciosamente. Com o teto, falha.
    for (const goal of GOALS) {
      const base = REST[goal];
      const piso = Math.min(35, base);
      for (const minutes of ALL_MINUTES) {
        const { rest } = schemeFor(input({ minutes, goal }));
        expect(rest).toBeGreaterThanOrEqual(piso);
        expect(rest).toBeLessThanOrEqual(base);
      }
    }
  });

  it('devolve o mínimo quando nem o degrau mais apertado cabe', () => {
    // Força em 20 min é o único par dos 35 que esgota a escada. Documentado
    // como teste porque o comportamento é intencional e não óbvio: o esquema
    // NÃO cabe no orçamento, e é o `generateWorkout` que fecha a conta
    // cortando exercício. Se algum dia isto passar a caber, o comentário do
    // fallback fica errado — e este teste avisa.
    const sc = schemeFor(input({ minutes: 20, goal: 'forca' }));
    expect(sc.sets).toBe(2);
    expect(sc.rest).toBe(68);
    expect(sc.target).toBe(4);
    const cabe = sc.target * (sc.sets * (30 + sc.rest) + 60);
    expect(cabe).toBeGreaterThan(20 * 60 - 300);
  });

  it('todo objetivo começa com séries suficientes para o laço rodar', () => {
    // Se um objetivo novo entrar com `sets: 1`, o laço interno
    // (`sets = baseSets; sets >= MIN_SETS`) não executa nenhuma iteração em
    // NENHUM degrau, e todo tempo cai no fallback sem aviso. Guarda barata.
    for (const goal of GOALS) {
      expect(SETS_REPS[goal].sets).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('costOf', () => {
  it('cobra séries × (execução + descanso) + transição', () => {
    const sc = { sets: 4, reps: '8-12', rest: 75, target: 6 };
    expect(costOf(ex({ avgSecPerSet: 35 }), sc)).toBe(4 * (35 + 75) + 60);
  });

  it('cardio cobra a duração cheia, não séries', () => {
    const sc = { sets: 3, reps: '12-15', rest: 35, target: 5 };
    const cardio = ex({ pattern: 'cardio', durationSec: 600, avgSecPerSet: 0 });
    expect(costOf(cardio, sc)).toBe(600 + 60);
  });

  it('confere com a realidade: 45 min de hipertrofia cabe ~5 exercícios', () => {
    const sc = schemeFor(input({ minutes: 45, goal: 'hipertrofia' }));
    const orcamento = 45 * 60 - 300;
    const cabem = Math.floor(orcamento / costOf(ex({ avgSecPerSet: 35 }), sc));
    expect(cabem).toBeGreaterThanOrEqual(5);
    expect(cabem).toBeLessThanOrEqual(7);
  });
});
