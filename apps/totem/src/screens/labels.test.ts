import { describe, it, expect } from 'vitest';
import {
  GROUP_LABEL, GOAL_OPTIONS, LEVEL_OPTIONS, CONTRA_OPTIONS,
  TIME_OPTIONS_FULL, TIME_OPTIONS_QUICK, describeWorkout,
} from './labels';
import { TARGET_EX } from '@quickfit/core/engine';
import type { Workout } from '@quickfit/core/engine';

describe('rótulos', () => {
  it('todo grupo muscular tem rótulo em pt-BR', () => {
    const grupos = ['peito','costas','ombros','biceps','triceps','pernas','gluteos','core','cardio'] as const;
    for (const g of grupos) {
      expect(GROUP_LABEL[g]).toBeTruthy();
      expect(GROUP_LABEL[g]).not.toBe(g);   // "core" não pode aparecer como "core"
    }
  });

  it('abdômen é o rótulo de core — "core" é jargão', () => {
    expect(GROUP_LABEL.core).toBe('Abdômen');
  });

  it('oferece uma opção "Não sei" que assume intermediário', () => {
    const naoSei = LEVEL_OPTIONS.find((o) => o.label === 'Não sei');
    expect(naoSei).toBeDefined();
    expect(naoSei!.level).toBe(2);
  });

  it('todo objetivo tem descrição sem jargão', () => {
    for (const o of GOAL_OPTIONS) {
      expect(o.sub.length).toBeGreaterThan(3);
      expect(o.sub).not.toMatch(/hipertrofia|catabolismo/i);
    }
  });

  it('o caminho completo cobre perna longa e sessão de força', () => {
    expect(TIME_OPTIONS_FULL).toEqual([20, 30, 45, 60, 90]);
  });

  it('o atalho rápido oferece só tempos curtos', () => {
    expect(TIME_OPTIONS_QUICK).toEqual([20, 30, 40, 50]);
    expect(Math.max(...TIME_OPTIONS_QUICK)).toBeLessThan(60);
  });

  it('toda contraindicação tem rótulo, e as 5 tags do motor estão cobertas', () => {
    const tags = ['joelho', 'lombar', 'ombro', 'punho', 'cervical'] as const;
    expect(CONTRA_OPTIONS.map((o) => o.tag).sort()).toEqual([...tags].sort());
    for (const o of CONTRA_OPTIONS) {
      expect(o.label).toBeTruthy();
    }
  });

  it('nenhuma tela oferece dois tempos com o mesmo alvo de exercícios', () => {
    // 40 e 45 caem ambos em 6. Oferecer os dois na mesma tela seria uma
    // escolha sem consequência para o aluno.
    for (const escada of [TIME_OPTIONS_FULL, TIME_OPTIONS_QUICK]) {
      const alvos = escada.map((m) => TARGET_EX[m]);
      expect(new Set(alvos).size).toBe(alvos.length);
    }
  });
});

describe('describeWorkout', () => {
  const w = (items: Array<{ sets: number }>, usedSec: number): Workout =>
    ({ items: items.map((i) => ({ ...i, exercise: {}, reps: '8-12' })), usedSec } as never);

  it('conta exercícios e soma séries', () => {
    const d = describeWorkout(w([{ sets: 4 }, { sets: 4 }, { sets: 3 }], 1800));
    expect(d.exercicios).toBe(3);
    expect(d.series).toBe(11);
  });

  it('soma os 5 min de aquecimento na duração exibida', () => {
    const d = describeWorkout(w([{ sets: 3 }], 1800));
    expect(d.minutos).toBe(35);
  });
});
