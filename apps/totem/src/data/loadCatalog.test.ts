import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CACHE_KEY, hydrateFromCache, writeCache, type CatalogBundle } from './loadCatalog';
import type { Exercise } from '@quickfit/core/engine';

const ex: Exercise = {
  id: 'supino', name: 'Supino', primary: 'peito', secondary: ['triceps'],
  equipment: ['barra', 'banco'], level: 2, pattern: 'push-h', kind: 'treino',
  isCompound: true, avgSecPerSet: 35, contraindications: ['ombro'],
};

const bundle: CatalogBundle = {
  exercises: [ex],
  gym: {
    id: 'g1', slug: 'demo', name: 'Academia Persona', logoUrl: null,
    theme: { accent: '#39FF14', mode: 'dark' },
    trainerName: 'Prof. Marina Alves', trainerCref: 'CREF 012345-G/SP',
  },
  availableEquipment: ['barra', 'banco'],
  fromCache: false,
};

// jsdom não é o ambiente padrão do vitest neste projeto, então damos um
// localStorage mínimo.
beforeEach(() => {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
});

describe('cache do catálogo', () => {
  it('devolve null quando não há nada gravado', () => {
    expect(hydrateFromCache()).toBeNull();
  });

  it('faz round-trip preservando os dados', () => {
    writeCache(bundle);
    const out = hydrateFromCache()!;
    expect(out.exercises).toEqual(bundle.exercises);
    expect(out.gym.name).toBe('Academia Persona');
    expect(out.availableEquipment).toEqual(['barra', 'banco']);
  });

  it('marca fromCache: true na leitura', () => {
    writeCache(bundle);
    expect(hydrateFromCache()!.fromCache).toBe(true);
  });

  it('devolve null quando o JSON está corrompido, em vez de lançar', () => {
    localStorage.setItem(CACHE_KEY, '{lixo');
    expect(hydrateFromCache()).toBeNull();
  });

  it('devolve null quando o formato mudou (sem exercises)', () => {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ gym: bundle.gym }));
    expect(hydrateFromCache()).toBeNull();
  });

  it('devolve null quando o cache está vazio de exercícios', () => {
    writeCache({ ...bundle, exercises: [] });
    expect(hydrateFromCache()).toBeNull();
  });
});
