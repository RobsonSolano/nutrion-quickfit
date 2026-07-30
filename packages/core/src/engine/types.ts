export type MuscleGroup =
  | 'peito' | 'costas' | 'ombros' | 'biceps'
  | 'triceps' | 'pernas' | 'gluteos' | 'core' | 'cardio';

export type Pattern =
  | 'push-h' | 'push-v' | 'pull-h' | 'pull-v'
  | 'squat' | 'hinge' | 'lunge' | 'iso' | 'core' | 'cardio';

export type Goal =
  | 'hipertrofia' | 'emagrecimento' | 'resistencia' | 'mobilidade' | 'forca';

export type Level = 1 | 2 | 3;

/** Tags de contraindicação. O aluno escolhe estas no passo 6 do fluxo completo. */
export type Contra = 'joelho' | 'lombar' | 'ombro' | 'punho' | 'cervical';

export type Exercise = {
  id: string;
  name: string;
  primary: MuscleGroup;
  secondary: MuscleGroup[];
  /** ids de equipamento normalizados. `[]` significa peso corporal. */
  equipment: string[];
  level: Level;
  pattern: Pattern;
  isCompound: boolean;
  /** segundos de execução de UMA série. 10–60. */
  avgSecPerSet: number;
  /** só para `pattern: 'cardio'` — duração total em segundos. */
  durationSec?: number;
  contraindications: Contra[];
  cue?: string;
  videoUrl?: string;
};

/**
 * Todos os tempos oferecidos em qualquer fluxo. A união é o conjunto, mas
 * nenhuma tela mostra todos: o atalho "Treino rápido" oferece 20/30/40/50
 * (quem escolhe "rápido" é limitado por tempo) e o "Montar do zero" oferece
 * 20/30/45/60/90 (precisa cobrir perna completa e sessão de força).
 *
 * 40 e 45 nunca aparecem juntos de propósito: ambos caem em 6 exercícios no
 * TARGET_EX, então oferecer os dois seria uma escolha sem consequência.
 */
export type Minutes = 20 | 30 | 40 | 45 | 50 | 60 | 90;

export type Input = {
  goal: Goal;
  groups: MuscleGroup[];
  minutes: Minutes;
  level: Level;
  /** vem de gym_equipment onde is_available = true */
  availableEquipment: string[];
  /**
   * Contraindicações a evitar. SEMPRE `[]` no caminho de atalho — só o
   * passo 6 do "Montar do zero" popula este campo.
   */
  avoid: Contra[];
  /** é isto que faz o treino variar entre gerações */
  seed: number;
};

export type Scheme = {
  sets: number;
  reps: string;
  /** segundos de descanso entre séries */
  rest: number;
  /** alvo de exercícios que o esquema foi dimensionado para caber */
  target: number;
};

export type WorkoutItem = {
  exercise: Exercise;
  sets: number;
  reps: string;
};

export type Workout = {
  items: WorkoutItem[];
  scheme: Scheme;
  /** quantos exercícios sobraram elegíveis depois do filtro */
  poolSize: number;
  budgetSec: number;
  usedSec: number;
  /** teto de exercícios aplicado nesta geração */
  cap: number;
  /** abaixo disto a tela mostra "combinação indisponível" em vez do treino */
  minItems: number;
  /** séries somadas nos compostos porque sobrou tempo */
  extraSets: number;
};
