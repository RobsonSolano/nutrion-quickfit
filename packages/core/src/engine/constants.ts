import type { Goal, Minutes, Scheme } from './types';

export const REST: Record<Goal, number> = {
  forca: 150,
  hipertrofia: 75,
  resistencia: 40,
  emagrecimento: 35,
  mobilidade: 30,
};

export const SETS_REPS: Record<Goal, Pick<Scheme, 'sets' | 'reps'>> = {
  forca:         { sets: 4, reps: '4-6'    },
  hipertrofia:   { sets: 4, reps: '8-12'   },
  resistencia:   { sets: 3, reps: '15-20'  },
  emagrecimento: { sets: 3, reps: '12-15'  },
  mobilidade:    { sets: 2, reps: '30-45s' },
};

/**
 * Quantos exercícios um professor põe numa sessão desse tempo. O motor mira
 * NISSO e deriva as séries — não o contrário. Sem isto, 20 min de hipertrofia
 * com 4 séries de 75s de descanso cabia UM exercício só.
 */
export const TARGET_EX: Record<Minutes, number> = {
  20: 4,
  30: 5,
  40: 6,
  45: 6,   // 40 e 45 caem no mesmo alvo — por isso nunca são oferecidos juntos
  50: 7,
  60: 8,
  90: 9,
};

/** Teto por objetivo. Ficha real de academia tem 4 a 9 exercícios, nunca 19. */
export const MAX_EX: Record<Goal, number> = {
  forca: 6, hipertrofia: 8, resistencia: 9, emagrecimento: 9, mobilidade: 10,
};

/** Não vira treino de perna com 8 aparelhos de perna. */
export const MAX_PER_GROUP = 4;

/** 5 min de aquecimento, sai impresso na ficha. */
export const WARMUP_SEC = 300;

/** Caminhar até o aparelho, ajustar, esperar liberar. */
export const TRANSITION_SEC = 60;

/** Série média, só para dimensionar o esquema em `schemeFor`. */
export const AVG_SEC = 30;
