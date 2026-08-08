import { describe, it, expect } from 'vitest';
import { eligible } from './filter';
import type { Exercise, Input } from './types';

const ex = (over: Partial<Exercise>): Exercise => ({
  id: 'x', name: 'X', primary: 'peito', secondary: [], equipment: [],
  level: 1, pattern: 'iso', isCompound: false, avgSecPerSet: 30, kind: 'treino',
  contraindications: [], ...over,
});

const input = (over: Partial<Input> = {}): Input => ({
  goal: 'hipertrofia', groups: ['peito'], minutes: 45, level: 3,
  availableEquipment: ['barra', 'banco', 'halter'], avoid: [], seed: 1, ...over,
});

describe('eligible', () => {
  it('exige TODOS os equipamentos presentes, não apenas um', () => {
    const cat = [
      ex({ id: 'supino', equipment: ['barra', 'banco'] }),
      ex({ id: 'crucifixo-mq', equipment: ['mq-crucifixo'] }),
      ex({ id: 'scott', equipment: ['banco-scott', 'barra'] }),
    ];
    const out = eligible(cat, input());
    expect(out.map(e => e.id)).toEqual(['supino']);
  });

  it('trata equipamento vazio como peso corporal, sempre disponível', () => {
    const cat = [ex({ id: 'flexao', equipment: [] })];
    expect(eligible(cat, input({ availableEquipment: [] }))).toHaveLength(1);
  });

  it('nunca devolve exercício acima do nível declarado', () => {
    const cat = [
      ex({ id: 'facil', level: 1 }),
      ex({ id: 'medio', level: 2 }),
      ex({ id: 'dificil', level: 3 }),
    ];
    const out = eligible(cat, input({ level: 2 }));
    expect(out.map(e => e.id)).toEqual(['facil', 'medio']);
  });

  it('remove exercício com contraindicação que o aluno pediu para evitar', () => {
    const cat = [
      ex({ id: 'agacho', contraindications: ['joelho', 'lombar'] }),
      ex({ id: 'leg', contraindications: [] }),
    ];
    const out = eligible(cat, input({ avoid: ['joelho'] }));
    expect(out.map(e => e.id)).toEqual(['leg']);
  });

  it('aceita exercício DINÂMICO cujo grupo SECUNDÁRIO foi pedido', () => {
    const cat = [ex({ id: 'supino', primary: 'peito', secondary: ['triceps'], pattern: 'push-h' })];
    expect(eligible(cat, input({ groups: ['triceps'] }))).toHaveLength(1);
  });

  it('descarta exercício que não toca nenhum grupo pedido', () => {
    const cat = [ex({ id: 'rosca', primary: 'biceps', secondary: [] })];
    expect(eligible(cat, input({ groups: ['pernas'] }))).toHaveLength(0);
  });

  it('ISOMÉTRICO não conta pelo grupo secundário — só pelo primário', () => {
    // Bug real (ago/2026): "Prancha" (primary: core, secondary: gluteos)
    // aparecia em "Perna completa" (groups: pernas, gluteos) por causa do
    // secundário, mesmo sendo uma postura sustentada, não um exercício de perna.
    const cat = [
      ex({ id: 'prancha', primary: 'core', secondary: ['gluteos'], pattern: 'iso' }),
    ];
    expect(eligible(cat, input({ groups: ['pernas', 'gluteos'] }))).toHaveLength(0);
    expect(eligible(cat, input({ groups: ['core'] }))).toHaveLength(1);
  });

  it('objetivo mobilidade traz só alongamento, e nunca treino', () => {
    const cat = [
      ex({ id: 'supino', kind: 'treino' }),
      ex({ id: 'along-peito', kind: 'mobilidade' }),
    ];
    const out = eligible(cat, input({ goal: 'mobilidade' }));
    expect(out.map((e) => e.id)).toEqual(['along-peito']);
  });

  it('os outros quatro objetivos nunca trazem alongamento', () => {
    const cat = [
      ex({ id: 'supino', kind: 'treino' }),
      ex({ id: 'along-peito', kind: 'mobilidade' }),
    ];
    // O defeito que este teste tranca: "Foam roll quadríceps 3x8-12" numa
    // ficha de hipertrofia, medido com o catálogo real de 153 exercícios.
    for (const goal of ['hipertrofia', 'emagrecimento', 'resistencia', 'forca'] as const) {
      expect(eligible(cat, input({ goal })).map((e) => e.id)).toEqual(['supino']);
    }
  });
});
