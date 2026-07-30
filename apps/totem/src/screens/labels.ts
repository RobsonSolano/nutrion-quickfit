import type { Contra, Goal, Level, Minutes, MuscleGroup, Workout } from '@quickfit/core/engine';

/** Nunca mostre o id ao aluno. "core" é jargão; "Abdômen" é português. */
export const GROUP_LABEL: Record<MuscleGroup, string> = {
  peito: 'Peito',
  costas: 'Costas',
  ombros: 'Ombros',
  biceps: 'Bíceps',
  triceps: 'Tríceps',
  pernas: 'Pernas',
  gluteos: 'Glúteos',
  core: 'Abdômen',
  cardio: 'Cardio',
};

export const GOAL_OPTIONS: Array<{ goal: Goal; label: string; sub: string }> = [
  { goal: 'hipertrofia',   label: 'Ganhar massa',    sub: 'músculo mais volumoso' },
  { goal: 'emagrecimento', label: 'Emagrecer',       sub: 'gastar mais caloria' },
  { goal: 'forca',         label: 'Ficar mais forte', sub: 'levantar mais peso' },
  { goal: 'resistencia',   label: 'Ter mais fôlego', sub: 'aguentar mais tempo' },
  { goal: 'mobilidade',    label: 'Soltar o corpo',  sub: 'mais amplitude e menos dor' },
  { goal: 'hipertrofia',   label: 'Não sei',         sub: 'a gente decide para você' },
];

/** Rótulo + esclarecimento em português simples — aluno não sabe jargão de anatomia. */
export const CONTRA_OPTIONS: Array<{ tag: Contra; label: string; sub?: string }> = [
  { tag: 'joelho',   label: 'Joelho' },
  { tag: 'lombar',   label: 'Lombar',   sub: 'parte baixa das costas' },
  { tag: 'ombro',    label: 'Ombro' },
  { tag: 'punho',    label: 'Punho',    sub: 'ou antebraço' },
  { tag: 'cervical', label: 'Cervical', sub: 'pescoço' },
];

export const TIME_OPTIONS_FULL: Minutes[] = [20, 30, 45, 60, 90];
export const TIME_OPTIONS_QUICK: Minutes[] = [20, 30, 40, 50];

export const LEVEL_OPTIONS: Array<{ level: Level; label: string; sub: string }> = [
  { level: 1, label: 'Iniciante',     sub: 'até 6 meses treinando' },
  { level: 2, label: 'Intermediário', sub: '6 meses a 2 anos' },
  { level: 3, label: 'Avançado',      sub: 'mais de 2 anos' },
  { level: 2, label: 'Não sei',       sub: 'assumimos intermediário' },
];

const WARMUP_MIN = 5;

export function describeWorkout(w: Workout): {
  exercicios: number;
  series: number;
  minutos: number;
} {
  return {
    exercicios: w.items.length,
    series: w.items.reduce((s, it) => s + it.sets, 0),
    minutos: Math.round(w.usedSec / 60) + WARMUP_MIN,
  };
}

export function groupsLabel(groups: MuscleGroup[]): string {
  return groups.map((g) => GROUP_LABEL[g]).join(' + ');
}
