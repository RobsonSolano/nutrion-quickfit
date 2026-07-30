import type { Goal, MuscleGroup } from '@quickfit/core/engine';

/**
 * Grupos entram ordenados (peito+tríceps é o mesmo treino que tríceps+peito),
 * mas a ORDEM dos exercícios é preservada — ela é parte da prescrição, e a
 * dica do primeiro exercício não serve para o quinto.
 */
export async function cacheKey(
  goal: Goal,
  groups: MuscleGroup[],
  exerciseIds: string[],
): Promise<string> {
  const payload = JSON.stringify({
    goal,
    groups: [...groups].sort(),
    exercises: exerciseIds,
  });
  const bytes = new TextEncoder().encode(payload);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
