import { describe, it, expect } from 'vitest';
import { generateWorkout } from './generate';
import { MAX_EX, MAX_PER_GROUP } from './constants';
import { mulberry32 } from './rng';
import { CATALOG, ALL_EQUIPMENT } from './__fixtures__/catalog';
import type { Contra, Goal, Input, Level, Minutes, MuscleGroup } from './types';

const GOALS: Goal[] = ['hipertrofia', 'emagrecimento', 'resistencia', 'mobilidade', 'forca'];
const MINUTES: Minutes[] = [20, 30, 40, 45, 50, 60, 90];
/**
 * Os 9 grupos, de propósito — inclusive `ombros` e `gluteos`, que o CATALOG
 * de teste não cobre. Um input pedindo só `ombros` produz pool vazio, e é
 * justamente esse caminho degenerado que precisa ser varrido: o motor tem de
 * devolver treino vazio sem lançar. Não "conserte" removendo os dois.
 */
const GROUPS: MuscleGroup[] = ['peito', 'costas', 'ombros', 'biceps', 'triceps', 'pernas', 'gluteos', 'core', 'cardio'];
const CONTRAS: Contra[] = ['joelho', 'lombar', 'ombro', 'punho', 'cervical'];

/** Gera um Input aleatório mas determinístico a partir de uma seed. */
function randomInput(rng: () => number): Input {
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];

  /**
   * Fisher-Yates, não `sort(() => rng() - 0.5)`.
   *
   * O sort com comparador inconsistente é um embaralhamento enviesado — não
   * amostra o espaço uniformemente — e consome uma quantidade de `rng()` que
   * depende do algoritmo de ordenação da engine. Num property test isso é
   * duplamente ruim: enviesa a cobertura E amarra o resultado à versão do V8.
   * Fisher-Yates consome exatamente `arr.length - 1` números, sempre.
   */
  const subset = <T,>(arr: T[], max: number): T[] => {
    const n = 1 + Math.floor(rng() * max);
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j]!, a[i]!];
    }
    return a.slice(0, n);
  };

  return {
    goal: pick(GOALS),
    groups: subset(GROUPS, 4),
    minutes: pick(MINUTES),
    level: (1 + Math.floor(rng() * 3)) as Level,
    availableEquipment: subset(ALL_EQUIPMENT, ALL_EQUIPMENT.length),
    avoid: rng() > 0.7 ? subset(CONTRAS, 2) : [],
    seed: Math.floor(rng() * 1_000_000),
  };
}

describe('generateWorkout — invariantes sobre 1000 inputs aleatórios', () => {
  it('nunca viola nenhuma invariante', () => {
    const rng = mulberry32(20260728);
    const falhas: string[] = [];

    for (let n = 0; n < 1000; n++) {
      const input = randomInput(rng);
      const w = generateWorkout(input, CATALOG);
      const ctx = JSON.stringify({
        goal: input.goal, minutes: input.minutes, level: input.level,
        groups: input.groups, avoid: input.avoid,
        equip: input.availableEquipment.length, seed: input.seed,
      });

      const gymHas = new Set(input.availableEquipment);

      for (const it of w.items) {
        const ex = it.exercise;
        if (!ex.equipment.every((eq) => gymHas.has(eq))) {
          falhas.push(`equipamento indisponível (${ex.id}) — ${ctx}`);
        }
        if (ex.level > input.level) {
          falhas.push(`nível acima do declarado (${ex.id}) — ${ctx}`);
        }
        if (ex.contraindications.some((c) => input.avoid.includes(c))) {
          falhas.push(`contraindicação violada (${ex.id}) — ${ctx}`);
        }
        if (it.sets < 1) {
          falhas.push(`exercício sem série (${ex.id}) — ${ctx}`);
        }
        if (ex.pattern !== 'cardio' && it.sets > w.scheme.sets + 1) {
          falhas.push(`séries acima do teto (${ex.id}: ${it.sets}) — ${ctx}`);
        }
      }

      if (w.usedSec > w.budgetSec) {
        falhas.push(`estourou o orçamento (${w.usedSec} > ${w.budgetSec}) — ${ctx}`);
      }
      if (w.items.length > w.cap || w.items.length > MAX_EX[input.goal]) {
        falhas.push(`acima do teto de exercícios (${w.items.length}) — ${ctx}`);
      }

      const ids = w.items.map((it) => it.exercise.id);
      if (new Set(ids).size !== ids.length) {
        falhas.push(`exercício repetido — ${ctx}`);
      }

      const porGrupo = new Map<string, number>();
      for (const it of w.items) {
        const g = it.exercise.primary;
        porGrupo.set(g, (porGrupo.get(g) ?? 0) + 1);
      }
      for (const [g, count] of porGrupo) {
        if (count > MAX_PER_GROUP) {
          falhas.push(`${count} exercícios do grupo ${g} — ${ctx}`);
        }
      }
    }

    // Mostra no máximo 5 falhas — o suficiente para diagnosticar sem poluir.
    expect(falhas.slice(0, 5)).toEqual([]);
  });

  it('é determinístico: 1000 inputs geram exatamente o mesmo resultado duas vezes', () => {
    const rodar = () => {
      const rng = mulberry32(999);
      return Array.from({ length: 1000 }, () =>
        generateWorkout(randomInput(rng), CATALOG).items.map((it) => it.exercise.id).join(','),
      );
    };
    expect(rodar()).toEqual(rodar());
  });
});
