import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  CACHE_KEY, hydrateFromCache, writeCache, mapExercises,
  type CatalogBundle, type ExerciseRow,
} from './loadCatalog';
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

const row = (over: Partial<ExerciseRow>): ExerciseRow => ({
  id: 'x', name: 'X', primary_group: 'pernas', level: 2, pattern: 'squat',
  kind: 'treino', is_compound: true, avg_sec_per_set: 30, duration_sec: null,
  cue: null, video_url: null, image_url: null,
  exercise_secondary_groups: [], exercise_equipment: [], exercise_contraindications: [],
  ...over,
});

describe('mapExercises', () => {
  it('remove exatamente os ids excluídos pela academia — não outros', () => {
    // Bug real (ago/2026): N1 Iron House pediu pra tirar Burpee/Box jump/
    // etc. do cardápio deles, e nenhum `every equipment` resolvia porque
    // são exercícios de peso corporal.
    const rows = [row({ id: 'burpee', name: 'Burpee' }), row({ id: 'leg-press', name: 'Leg press' })];
    const out = mapExercises(rows, new Set(['burpee']));
    expect(out.map((e) => e.id)).toEqual(['leg-press']);
  });

  it('sem exclusão, devolve todo o catálogo', () => {
    const rows = [row({ id: 'a' }), row({ id: 'b' })];
    expect(mapExercises(rows, new Set())).toHaveLength(2);
  });

  it('mapeia video_url e image_url pra videoUrl/imageUrl, null vira undefined', () => {
    const rows = [
      row({ id: 'com-imagem', image_url: 'https://exemplo.com/x.jpg', video_url: null }),
    ];
    const [out] = mapExercises(rows, new Set());
    expect(out.imageUrl).toBe('https://exemplo.com/x.jpg');
    expect(out.videoUrl).toBeUndefined();
  });
});
