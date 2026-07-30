import { customAlphabet } from 'nanoid';
import { supabase } from './supabase';
import type { Input, Workout } from '@quickfit/core/engine';

// 10 chars sem ambíguos (0/O, 1/l/I): URL curta gera QR de baixa densidade,
// que lê rápido em câmera ruim sob luz forte.
const nanoid = customAlphabet('23456789abcdefghijkmnpqrstuvwxyz', 10);

/**
 * Nunca lança. Se falhar, o treino aparece e imprime — só o QR fica
 * indisponível, com aviso na ficha (spec §8).
 */
export async function saveWorkout(
  gymId: string,
  input: Input,
  workout: Workout,
  parqBlocked = false,
): Promise<string | null> {
  try {
    const id = nanoid();
    const { error } = await supabase.from('generated_workouts').insert({
      id,
      gym_id: gymId,
      input,
      exercises: workout.items.map((it) => ({
        id: it.exercise.id,
        name: it.exercise.name,
        equipment: it.exercise.equipment,
        sets: it.sets,
        reps: it.reps,
        cue: it.exercise.cue ?? null,
        video_url: it.exercise.videoUrl ?? null,
      })),
      parq_blocked: parqBlocked,
    });
    if (error) throw error;
    return id;
  } catch (e) {
    console.warn('Não foi possível salvar o treino — QR indisponível.', e);
    return null;
  }
}
