import { describe, it, expect } from 'vitest';
import { generateWorkout } from './generate';
import { MAX_EX, MAX_PER_GROUP, WARMUP_SEC } from './constants';
import { CATALOG, ALL_EQUIPMENT } from './__fixtures__/catalog';
import type { Input } from './types';

const input = (over: Partial<Input> = {}): Input => ({
  goal: 'hipertrofia', groups: ['peito', 'triceps'], minutes: 45, level: 3,
  availableEquipment: ALL_EQUIPMENT, avoid: [], seed: 42, ...over,
});

describe('generateWorkout — invariantes de segurança', () => {
  it('nunca prescreve exercício de aparelho que a academia não tem', () => {
    const disponivel = ['halter', 'banco'];
    const w = generateWorkout(input({ availableEquipment: disponivel }), CATALOG);
    for (const it of w.items) {
      expect(it.exercise.equipment.every((eq) => disponivel.includes(eq))).toBe(true);
    }
  });

  it('nunca prescreve acima do nível declarado', () => {
    const w = generateWorkout(input({ groups: ['pernas'], level: 1 }), CATALOG);
    expect(w.items.every((it) => it.exercise.level <= 1)).toBe(true);
    expect(w.items.map((it) => it.exercise.id)).not.toContain('agacho-livre');
  });

  it('nunca prescreve exercício contraindicado', () => {
    const w = generateWorkout(input({ groups: ['pernas'], avoid: ['joelho'] }), CATALOG);
    expect(w.items.every((it) => !it.exercise.contraindications.includes('joelho'))).toBe(true);
  });
});

describe('generateWorkout — volume e tempo', () => {
  it('respeita o orçamento de tempo', () => {
    const w = generateWorkout(input({ minutes: 45 }), CATALOG);
    expect(w.usedSec).toBeLessThanOrEqual(w.budgetSec);
    expect(w.budgetSec).toBe(45 * 60 - WARMUP_SEC);
  });

  it('nunca passa do teto de exercícios do objetivo', () => {
    // O bug original: 90 min com 6 grupos gerava 19 exercícios.
    const w = generateWorkout(
      input({ groups: ['peito', 'costas', 'triceps', 'biceps', 'pernas', 'core'], minutes: 90, goal: 'emagrecimento' }),
      CATALOG,
    );
    expect(w.items.length).toBeLessThanOrEqual(MAX_EX.emagrecimento);
    expect(w.items.length).toBeLessThanOrEqual(w.cap);
  });

  it('nunca passa de 4 exercícios do mesmo grupo muscular', () => {
    const w = generateWorkout(input({ groups: ['pernas'], minutes: 90, goal: 'emagrecimento' }), CATALOG);
    const porGrupo = new Map<string, number>();
    for (const it of w.items) {
      const g = it.exercise.primary;
      porGrupo.set(g, (porGrupo.get(g) ?? 0) + 1);
    }
    for (const n of porGrupo.values()) expect(n).toBeLessThanOrEqual(MAX_PER_GROUP);
  });

  it('20 min de hipertrofia devolve 4 exercícios, não 1', () => {
    const w = generateWorkout(input({ minutes: 20 }), CATALOG);
    expect(w.items.length).toBe(4);
  });

  it('nunca prescreve mais que sets_do_esquema + 1 séries', () => {
    const w = generateWorkout(input({ minutes: 90, goal: 'emagrecimento' }), CATALOG);
    for (const it of w.items) {
      if (it.exercise.pattern === 'cardio') continue;
      expect(it.sets).toBeLessThanOrEqual(w.scheme.sets + 1);
    }
  });

  it('não deixa exercício sem série', () => {
    const w = generateWorkout(input(), CATALOG);
    expect(w.items.every((it) => it.sets >= 1)).toBe(true);
  });
});

describe('generateWorkout — qualidade da prescrição', () => {
  it('cobre todos os grupos pedidos antes de repetir algum', () => {
    const w = generateWorkout(input({ groups: ['peito', 'triceps'], minutes: 45 }), CATALOG);
    const grupos = new Set(w.items.flatMap((it) => [it.exercise.primary, ...it.exercise.secondary]));
    expect(grupos).toContain('peito');
    expect(grupos).toContain('triceps');
  });

  it('não põe composto na segunda metade da sessão', () => {
    // `peito+triceps` de propósito, NÃO `pernas+costas`. O fixture tem 3
    // compostos e 5 isolados para peito+triceps, então a regra é expressável.
    // Para pernas+costas são 7 compostos e 3 isolados: com 8 vagas, no mínimo
    // 5 compostos entram, e 5 não cabem nas 4 primeiras vagas — o limite
    // seria matematicamente impossível e o teste estaria medindo a magreza do
    // fixture, não a regra. Conferido em 200 seeds: com pool folgado o máximo
    // observado é 1; com pool magro, o mínimo é 2.
    const w = generateWorkout(input({ groups: ['peito', 'triceps'], minutes: 60 }), CATALOG);
    const metade = Math.ceil(w.items.length / 2);
    const compostosNaSegundaMetade = w.items
      .slice(metade)
      .filter((it) => it.exercise.isCompound).length;
    expect(compostosNaSegundaMetade).toBeLessThanOrEqual(1);
  });

  it('quando falta isolado, preenche com composto em vez de encurtar o treino', () => {
    // O risco que a porta dura introduz: se ela zerasse o score de todo
    // composto tardio sem exceção, o seletor ficaria sem candidato e o treino
    // sairia curto. `pernas+costas` é justamente o caso de pool magro — tem
    // que chegar ao teto mesmo tendo que usar composto no fim.
    const w = generateWorkout(input({ groups: ['pernas', 'costas'], minutes: 60 }), CATALOG);
    expect(w.items.length).toBe(w.cap);
  });

  it('não repete o mesmo exercício', () => {
    const w = generateWorkout(input({ minutes: 90, goal: 'emagrecimento' }), CATALOG);
    const ids = w.items.map((it) => it.exercise.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('seeds diferentes produzem treinos diferentes', () => {
    const a = generateWorkout(input({ seed: 1 }), CATALOG);
    const b = generateWorkout(input({ seed: 2 }), CATALOG);
    expect(a.items.map((i) => i.exercise.id)).not.toEqual(b.items.map((i) => i.exercise.id));
  });

  it('mesma seed produz o mesmo treino', () => {
    const a = generateWorkout(input({ seed: 7 }), CATALOG);
    const b = generateWorkout(input({ seed: 7 }), CATALOG);
    expect(a.items.map((i) => i.exercise.id)).toEqual(b.items.map((i) => i.exercise.id));
  });
});

describe('generateWorkout — casos degenerados', () => {
  it('devolve menos de 3 exercícios quando o pool elegível é pequeno', () => {
    const w = generateWorkout(input({ availableEquipment: ['crossover'] }), CATALOG);
    expect(w.items.length).toBeLessThan(3);
    expect(w.minItems).toBe(3);
  });

  it('sessão só de cardio é válida com 1 item', () => {
    const w = generateWorkout(input({ groups: ['cardio'], minutes: 30, goal: 'emagrecimento' }), CATALOG);
    expect(w.minItems).toBe(1);
    expect(w.items.length).toBeGreaterThanOrEqual(1);
  });

  it('catálogo vazio devolve treino vazio sem lançar', () => {
    const w = generateWorkout(input(), []);
    expect(w.items).toEqual([]);
    expect(w.poolSize).toBe(0);
  });

  it('reporta poolSize para a tela distinguir a causa da falha', () => {
    const w = generateWorkout(input({ availableEquipment: ['crossover'] }), CATALOG);
    expect(w.poolSize).toBeLessThan(6);
  });
});
