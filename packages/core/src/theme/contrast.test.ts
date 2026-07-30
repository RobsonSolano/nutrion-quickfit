import { describe, it, expect } from 'vitest';
import { contrastRatio, bestContrast, validateAccent } from './contrast';
import { DARK_BASE, LIGHT_BASE } from './base';

describe('contrastRatio', () => {
  it('preto contra branco é 21:1', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 1);
  });

  it('cor contra ela mesma é 1:1', () => {
    expect(contrastRatio('#39FF14', '#39FF14')).toBeCloseTo(1, 2);
  });

  it('é simétrico', () => {
    expect(contrastRatio('#39FF14', '#07080B')).toBeCloseTo(
      contrastRatio('#07080B', '#39FF14'),
      4,
    );
  });

  it('aceita hex de 3 dígitos', () => {
    expect(contrastRatio('#000', '#fff')).toBeCloseTo(21, 1);
  });

  it('é insensível a maiúsculas', () => {
    expect(contrastRatio('#39ff14', '#07080B')).toBeCloseTo(
      contrastRatio('#39FF14', '#07080b'),
      4,
    );
  });
});

describe('bestContrast', () => {
  it('escolhe preto sobre o verde neon', () => {
    expect(bestContrast('#39FF14', ['#07080B', '#FFFFFF'])).toBe('#07080B');
  });

  it('escolhe branco sobre um violeta escuro', () => {
    expect(bestContrast('#6D28D9', ['#07080B', '#FFFFFF'])).toBe('#FFFFFF');
  });
});

describe('validateAccent', () => {
  it('aprova o verde neon no modo escuro', () => {
    const r = validateAccent('#39FF14', 'dark');
    expect(r.ok).toBe(true);
    expect(r.ratio).toBeGreaterThan(4.5);
  });

  it('aprova laranja no modo escuro', () => {
    expect(validateAccent('#FF6B1A', 'dark').ok).toBe(true);
  });

  it('reprova grafite no modo escuro e sugere alternativa', () => {
    const r = validateAccent('#2B313C', 'dark');
    expect(r.ok).toBe(false);
    expect(r.ratio).toBeLessThan(4.5);
    expect(r.suggestion).toBeDefined();
  });

  it('a sugestão devolvida sempre passa a validação', () => {
    for (const cor of ['#2B313C', '#1A1D25', '#3D3D3D', '#0F1115']) {
      const r = validateAccent(cor, 'dark');
      expect(r.ok).toBe(false);
      expect(validateAccent(r.suggestion!, 'dark').ok).toBe(true);
    }
  });

  it('reprova amarelo claro no modo claro', () => {
    expect(validateAccent('#FFE100', 'light').ok).toBe(false);
  });

  it('rejeita hex inválido em vez de devolver NaN', () => {
    expect(() => validateAccent('vermelho', 'dark')).toThrow(/hex/i);
  });
});

describe('danger por modo', () => {
  // O motivo de `--qf-danger` existir como token: o vermelho do escuro reprova
  // no claro. Se alguém "simplificar" para um hex único, este teste cai.
  it('o danger de cada modo passa 4.5:1 contra o fundo daquele modo', () => {
    expect(contrastRatio(DARK_BASE.danger, DARK_BASE.bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(LIGHT_BASE.danger, LIGHT_BASE.bg)).toBeGreaterThanOrEqual(4.5);
  });

  it('o danger do escuro reprovaria no claro — é por isso que são dois', () => {
    expect(contrastRatio(DARK_BASE.danger, LIGHT_BASE.bg)).toBeLessThan(4.5);
  });
});
