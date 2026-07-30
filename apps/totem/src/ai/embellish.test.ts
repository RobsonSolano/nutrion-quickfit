import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Workout } from '@quickfit/core/engine';

const rpc = vi.fn();
const from = vi.fn();
const invoke = vi.fn();

vi.mock('../data/supabase', () => ({
  supabase: {
    rpc: (...a: unknown[]) => rpc(...a),
    from: (...a: unknown[]) => from(...a),
    functions: { invoke: (...a: unknown[]) => invoke(...a) },
  },
}));

const { embellish } = await import('./embellish');

const workout = {
  items: [
    { exercise: { id: 'supino', name: 'Supino reto' }, sets: 4, reps: '8-12' },
    { exercise: { id: 'tri-corda', name: 'Tríceps corda' }, sets: 3, reps: '8-12' },
  ],
} as unknown as Workout;

const semCache = () => ({
  select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
  insert: async () => ({ error: null }),
});

beforeEach(() => {
  rpc.mockReset(); from.mockReset(); invoke.mockReset();
});

describe('embellish', () => {
  it('devolve o cache sem chamar a Edge Function', async () => {
    from.mockReturnValue({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: { title: 'Peito Pesado', cues: { supino: 'Escápulas retraídas' } },
            error: null,
          }),
        }),
      }),
    });
    rpc.mockResolvedValue({ error: null });

    const out = await embellish(workout, 'hipertrofia', ['peito']);
    expect(out?.title).toBe('Peito Pesado');
    expect(invoke).not.toHaveBeenCalled();
  });

  it('chama a Edge Function quando não há cache e grava o resultado', async () => {
    from.mockReturnValue(semCache());
    invoke.mockResolvedValue({
      data: { title: 'Empurrada Forte', cues: { supino: 'Desça controlado' } },
      error: null,
    });

    const out = await embellish(workout, 'hipertrofia', ['peito']);
    expect(out?.title).toBe('Empurrada Forte');
    expect(invoke).toHaveBeenCalledOnce();
  });

  it('devolve null quando a Edge Function falha — nunca lança', async () => {
    from.mockReturnValue(semCache());
    invoke.mockResolvedValue({ data: null, error: new Error('502') });

    await expect(embellish(workout, 'hipertrofia', ['peito'])).resolves.toBeNull();
  });

  it('devolve null quando a Edge Function lança — nunca propaga', async () => {
    from.mockReturnValue(semCache());
    invoke.mockRejectedValue(new Error('rede caiu'));

    await expect(embellish(workout, 'hipertrofia', ['peito'])).resolves.toBeNull();
  });

  it('devolve null quando o banco falha — nunca lança', async () => {
    from.mockImplementation(() => { throw new Error('sem RLS'); });

    await expect(embellish(workout, 'hipertrofia', ['peito'])).resolves.toBeNull();
  });

  it('desiste em 2s e devolve null', async () => {
    from.mockReturnValue(semCache());
    invoke.mockImplementation(() => new Promise(() => {}));   // nunca resolve

    const t0 = Date.now();
    const out = await embellish(workout, 'hipertrofia', ['peito'], 120);
    expect(out).toBeNull();
    expect(Date.now() - t0).toBeLessThan(1000);
  });

  it('descarta resposta sem título', async () => {
    from.mockReturnValue(semCache());
    invoke.mockResolvedValue({ data: { cues: {} }, error: null });

    await expect(embellish(workout, 'hipertrofia', ['peito'])).resolves.toBeNull();
  });
});
