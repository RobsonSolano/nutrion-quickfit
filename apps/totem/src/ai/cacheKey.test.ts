import { describe, it, expect } from 'vitest';
import { cacheKey } from './cacheKey';

describe('cacheKey', () => {
  it('é estável para a mesma entrada', async () => {
    const a = await cacheKey('hipertrofia', ['peito', 'triceps'], ['supino', 'triceps-corda']);
    const b = await cacheKey('hipertrofia', ['peito', 'triceps'], ['supino', 'triceps-corda']);
    expect(a).toBe(b);
  });

  it('ignora a ordem dos grupos — "peito+tríceps" é o mesmo treino', async () => {
    const a = await cacheKey('hipertrofia', ['peito', 'triceps'], ['supino']);
    const b = await cacheKey('hipertrofia', ['triceps', 'peito'], ['supino']);
    expect(a).toBe(b);
  });

  it('RESPEITA a ordem dos exercícios — a ordem é parte da prescrição', async () => {
    const a = await cacheKey('hipertrofia', ['peito'], ['supino', 'crucifixo']);
    const b = await cacheKey('hipertrofia', ['peito'], ['crucifixo', 'supino']);
    expect(a).not.toBe(b);
  });

  it('muda quando o objetivo muda', async () => {
    const a = await cacheKey('hipertrofia', ['peito'], ['supino']);
    const b = await cacheKey('forca', ['peito'], ['supino']);
    expect(a).not.toBe(b);
  });

  it('devolve hex de 64 chars (sha-256)', async () => {
    const k = await cacheKey('forca', ['costas'], ['puxada']);
    expect(k).toMatch(/^[0-9a-f]{64}$/);
  });
});
