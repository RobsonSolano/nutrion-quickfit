import type { Contra, Goal, Input, Level, Minutes, MuscleGroup, Workout } from '@quickfit/core/engine';

export type Screen =
  | 'attract' | 'parq' | 'blocked' | 'home'
  | 'goal' | 'groups' | 'time' | 'level' | 'avoid'
  | 'generating' | 'result' | 'thin' | 'ficha';

export type Shortcut = {
  label: string;
  sub: string;
  groups: MuscleGroup[];
  /** Tempo assumido. Ignorado quando `askTime` é true. */
  minutes: Minutes;
  goal: Goal;
  /**
   * Quando true, o atalho abre a tela de tempo antes de gerar. Só o "Treino
   * rápido" usa: quem escolhe "rápido" está limitado por tempo, e assumir 20
   * min para quem tem 45 entrega menos treino do que a pessoa podia fazer.
   * Custo: este atalho leva 4 toques, os outros três levam 3.
   */
  askTime?: true;
};

/** Os 5 atalhos da home. D4: a maioria dos alunos sai em 4 toques por aqui. */
export const SHORTCUTS: Shortcut[] = [
  { label: 'Peito + Tríceps', sub: '45 min', groups: ['peito', 'triceps'],  minutes: 45, goal: 'hipertrofia' },
  { label: 'Costas + Bíceps', sub: '45 min', groups: ['costas', 'biceps'],  minutes: 45, goal: 'hipertrofia' },
  { label: 'Perna completa',  sub: '60 min', groups: ['pernas', 'gluteos'], minutes: 60, goal: 'hipertrofia' },
  { label: 'Corpo todo',      sub: '60 min', groups: ['peito', 'costas', 'pernas', 'ombros', 'core'], minutes: 60, goal: 'hipertrofia' },
  {
    label: 'Treino rápido',
    sub: 'você escolhe o tempo',
    groups: ['peito', 'costas', 'pernas'],
    minutes: 20,
    goal: 'emagrecimento',
    askTime: true,
  },
];

/** As 3 condições críticas do PAR-Q reduzido (D6). */
export const PARQ_QUESTIONS = [
  'Dor no peito ao se esforçar',
  'Tontura ou desmaio recente',
  'Médico pediu para você não treinar',
] as const;

export type MachineState = {
  screen: Screen;
  path: 'atalho' | 'completo';
  parq: number[];
  goal: Goal;
  groups: MuscleGroup[];
  minutes: Minutes;
  level: Level;
  avoid: Contra[];
  /** Só existe para o BACK de 'level' saber se veio de 'time' ou direto da home. */
  askedTime: boolean;
  seed: number;
  taps: number;
  workout: Workout | null;
  workoutId: string | null;
};

export const initialState: MachineState = {
  screen: 'attract',
  path: 'atalho',
  parq: [],
  goal: 'hipertrofia',
  groups: [],
  minutes: 45,
  level: 2,
  avoid: [],
  askedTime: false,
  seed: 1,
  taps: 0,
  workout: null,
  workoutId: null,
};

export type Action =
  | { type: 'TOUCH_ATTRACT' }
  | { type: 'PARQ_TOGGLE'; index: number }
  | { type: 'PARQ_NONE' }
  | { type: 'PICK_SHORTCUT'; index: number }
  | { type: 'OPEN_CUSTOM' }
  | { type: 'PICK_GOAL'; goal: Goal }
  | { type: 'TOGGLE_GROUP'; group: MuscleGroup }
  | { type: 'CONFIRM_GROUPS' }
  | { type: 'PICK_TIME'; minutes: Minutes }
  | { type: 'PICK_LEVEL'; level: Level }
  | { type: 'TOGGLE_AVOID'; tag: Contra }
  | { type: 'CONFIRM_AVOID' }
  | { type: 'GENERATED'; workout: Workout }
  | { type: 'WORKOUT_SAVED'; id: string }
  | { type: 'REGENERATE' }
  | { type: 'OPEN_FICHA' }
  | { type: 'BACK' }
  | { type: 'RESET' };

/**
 * De onde cada tela volta. `time` depende do caminho: no atalho ela veio da
 * home, no completo veio da seleção de grupos.
 */
const BACK_TO: Partial<Record<Screen, Screen>> = {
  goal: 'home',
  groups: 'goal',
  avoid: 'level',
  ficha: 'result',
};

/**
 * `time` e `level` não têm destino fixo: dependem de qual caminho trouxe o
 * aluno até ali. `time` distingue por `path`; `level` distingue por
 * `askedTime` porque no atalho ela é alcançada tanto direto da home (os
 * shortcuts de tempo fixo) quanto depois de `time` ("Treino rápido", o único
 * com askTime).
 */
const backFrom = (state: MachineState): Screen | undefined => {
  if (state.screen === 'time') return state.path === 'atalho' ? 'home' : 'groups';
  if (state.screen === 'level') return state.askedTime ? 'time' : 'home';
  return BACK_TO[state.screen];
};

export function reducer(state: MachineState, action: Action): MachineState {
  const tap = (s: MachineState): MachineState => ({ ...s, taps: s.taps + 1 });

  switch (action.type) {
    case 'TOUCH_ATTRACT':
      return tap({ ...state, screen: 'parq' });

    case 'PARQ_TOGGLE': {
      const parq = state.parq.includes(action.index)
        ? state.parq.filter((i) => i !== action.index)
        : [...state.parq, action.index];
      // Marcar qualquer condição bloqueia na hora. Desmarcar a última libera.
      return tap({ ...state, parq, screen: parq.length > 0 ? 'blocked' : 'parq' });
    }

    case 'PARQ_NONE':
      return tap({ ...state, parq: [], screen: 'home' });

    case 'PICK_SHORTCUT': {
      const sc = SHORTCUTS[action.index];
      if (!sc) return state;
      return tap({
        ...state,
        path: 'atalho',
        goal: sc.goal,
        groups: sc.groups,
        minutes: sc.minutes,
        avoid: [],          // atalho nunca popula avoid
        askedTime: false,
        // "Treino rápido" pede o tempo antes do nível; os outros quatro já
        // têm tempo fixo e vão direto para o nível.
        screen: sc.askTime ? 'time' : 'level',
      });
    }

    case 'OPEN_CUSTOM':
      return tap({ ...state, path: 'completo', screen: 'goal' });

    case 'PICK_GOAL':
      return tap({ ...state, goal: action.goal, screen: 'groups' });

    case 'TOGGLE_GROUP': {
      const groups = state.groups.includes(action.group)
        ? state.groups.filter((g) => g !== action.group)
        : [...state.groups, action.group];
      return tap({ ...state, groups });
    }

    case 'CONFIRM_GROUPS':
      if (state.groups.length === 0) return state;   // o botão está desabilitado
      return tap({ ...state, screen: 'time' });

    case 'PICK_TIME':
      // Nos dois caminhos, depois do tempo vem o nível.
      return tap({ ...state, minutes: action.minutes, askedTime: true, screen: 'level' });

    case 'PICK_LEVEL':
      // Atalho nunca pergunta contraindicação (D4: velocidade); só o
      // caminho completo passa por 'avoid'.
      return tap({ ...state, level: action.level, screen: state.path === 'atalho' ? 'generating' : 'avoid' });

    case 'TOGGLE_AVOID': {
      const avoid = state.avoid.includes(action.tag)
        ? state.avoid.filter((t) => t !== action.tag)
        : [...state.avoid, action.tag];
      return tap({ ...state, avoid });
    }

    case 'CONFIRM_AVOID':
      return tap({ ...state, screen: 'generating' });

    case 'GENERATED':
      return {
        ...state,
        workout: action.workout,
        workoutId: null,
        screen: action.workout.items.length >= action.workout.minItems ? 'result' : 'thin',
      };

    case 'WORKOUT_SAVED':
      return { ...state, workoutId: action.id };

    case 'REGENERATE':
      return tap({ ...state, seed: state.seed + 1, screen: 'generating' });

    case 'OPEN_FICHA':
      return tap({ ...state, screen: 'ficha' });

    case 'BACK': {
      const to = backFrom(state);
      return to ? tap({ ...state, screen: to }) : state;
    }

    case 'RESET':
      // Descarta TODO o estado do aluno. A seed sobrevive de propósito: o
      // próximo aluno com o mesmo pedido não recebe o mesmo treino.
      return { ...initialState, seed: state.seed };
  }
}

export function toInput(state: MachineState, availableEquipment: string[]): Input {
  return {
    goal: state.goal,
    groups: state.groups,
    minutes: state.minutes,
    level: state.level,
    availableEquipment,
    avoid: state.avoid,
    seed: state.seed,
  };
}
