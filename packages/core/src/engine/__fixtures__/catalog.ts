import type { Exercise } from '../types';

const e = (
  id: string,
  primary: Exercise['primary'],
  pattern: Exercise['pattern'],
  isCompound: boolean,
  equipment: string[],
  over: Partial<Exercise> = {},
): Exercise => ({
  id, name: id, primary, secondary: [], equipment,
  level: 1, pattern, isCompound, avgSecPerSet: 30,
  contraindications: [], ...over,
});

/** 24 exercícios cobrindo 6 grupos, compostos e isolados, com variedade de padrão. */
export const CATALOG: Exercise[] = [
  // peito
  e('supino-barra',   'peito',   'push-h', true,  ['barra', 'banco'], { secondary: ['triceps'], avgSecPerSet: 35 }),
  e('supino-halter',  'peito',   'push-h', true,  ['halter', 'banco'], { secondary: ['triceps'] }),
  e('supino-mq',      'peito',   'push-h', true,  ['mq-supino']),
  e('crucifixo-mq',   'peito',   'iso',    false, ['mq-crucifixo'], { avgSecPerSet: 25 }),
  e('crossover',      'peito',   'iso',    false, ['crossover'], { avgSecPerSet: 25 }),
  // costas
  e('puxada',         'costas',  'pull-v', true,  ['polia-alta'], { secondary: ['biceps'] }),
  e('remada-mq',      'costas',  'pull-h', true,  ['mq-remada'], { secondary: ['biceps'] }),
  e('remada-baixa',   'costas',  'pull-h', true,  ['polia-baixa'], { secondary: ['biceps'], avgSecPerSet: 32 }),
  e('pulldown-corda', 'costas',  'iso',    false, ['polia-alta', 'corda'], { avgSecPerSet: 25 }),
  // triceps
  e('triceps-corda',  'triceps', 'iso',    false, ['polia-alta', 'corda'], { avgSecPerSet: 24 }),
  e('triceps-testa',  'triceps', 'iso',    false, ['barra', 'banco'], { avgSecPerSet: 26 }),
  e('triceps-banco',  'triceps', 'iso',    false, [], { avgSecPerSet: 25 }),
  // biceps
  e('rosca-barra',    'biceps',  'iso',    false, ['barra'], { avgSecPerSet: 25 }),
  e('rosca-alt',      'biceps',  'iso',    false, ['halter'], { avgSecPerSet: 25 }),
  e('rosca-polia',    'biceps',  'iso',    false, ['polia-baixa'], { avgSecPerSet: 24 }),
  // pernas
  e('agacho-livre',   'pernas',  'squat',  true,  ['barra'], { level: 3, avgSecPerSet: 45, contraindications: ['joelho', 'lombar'] }),
  e('leg-press',      'pernas',  'squat',  true,  ['leg-press'], { avgSecPerSet: 38, contraindications: ['joelho'] }),
  e('hack',           'pernas',  'squat',  true,  ['hack'], { level: 2, avgSecPerSet: 40, contraindications: ['joelho'] }),
  e('extensora',      'pernas',  'iso',    false, ['extensora'], { avgSecPerSet: 28, contraindications: ['joelho'] }),
  e('flexora',        'pernas',  'iso',    false, ['flexora'], { avgSecPerSet: 28 }),
  e('stiff',          'pernas',  'hinge',  true,  ['barra'], { level: 2, avgSecPerSet: 38, contraindications: ['lombar'] }),
  // core
  e('prancha',        'core',    'core',   false, [], { avgSecPerSet: 30 }),
  e('abd-polia',      'core',    'core',   false, ['polia-alta', 'corda'], { level: 2, avgSecPerSet: 26 }),
  // cardio
  e('esteira',        'cardio',  'cardio', false, ['esteira'], { avgSecPerSet: 0, durationSec: 600 }),
];

/** Tudo o que o CATALOG acima referencia. */
export const ALL_EQUIPMENT = [
  'barra', 'banco', 'halter', 'mq-supino', 'mq-crucifixo', 'crossover',
  'polia-alta', 'polia-baixa', 'mq-remada', 'corda', 'leg-press', 'hack',
  'extensora', 'flexora', 'esteira',
];
