import { describe, it, expect } from 'vitest';
import { mulberry32, weightedPick } from './rng';

describe('mulberry32', () => {
  it('mesma seed produz a mesma sequência', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const seqA = Array.from({ length: 20 }, () => a());
    const seqB = Array.from({ length: 20 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it('seeds diferentes produzem sequências diferentes', () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    expect(a()).not.toBe(b());
  });

  it('devolve sempre valores em [0, 1)', () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 5000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('weightedPick', () => {
  it('sempre devolve um item da lista', () => {
    const rng = mulberry32(3);
    const scored = [
      { item: 'a', score: 1 },
      { item: 'b', score: 1 },
      { item: 'c', score: 1 },
    ];
    for (let i = 0; i < 100; i++) {
      expect(['a', 'b', 'c']).toContain(weightedPick(scored, rng));
    }
  });

  it('respeita o peso: score muito maior domina a amostragem', () => {
    const rng = mulberry32(11);
    const scored = [
      { item: 'raro', score: 1 },
      { item: 'comum', score: 999 },
    ];
    const picks = Array.from({ length: 500 }, () => weightedPick(scored, rng));
    const comuns = picks.filter((p) => p === 'comum').length;
    expect(comuns).toBeGreaterThan(480);
  });

  it('nunca escolhe item com score zero quando há alternativa', () => {
    const rng = mulberry32(5);
    const scored = [
      { item: 'zerado', score: 0 },
      { item: 'valido', score: 1 },
    ];
    const picks = Array.from({ length: 200 }, () => weightedPick(scored, rng));
    expect(picks.every((p) => p === 'valido')).toBe(true);
  });

  it('devolve o único item quando a lista tem tamanho 1', () => {
    expect(weightedPick([{ item: 'só', score: 0 }], mulberry32(1))).toBe('só');
  });

  it('lança em lista vazia em vez de devolver undefined', () => {
    // O `generateWorkout` já garante `candidates.length > 0` antes de chamar,
    // então isto nunca deveria acontecer — mas devolver `undefined` como se
    // fosse um exercício colocaria lixo na ficha em silêncio. Falhar alto.
    expect(() => weightedPick([], mulberry32(1))).toThrow(/vazia/i);
  });
});
