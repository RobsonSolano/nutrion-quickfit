import { describe, it, expect } from 'vitest';
import { reducer, initialState, toInput, SHORTCUTS, type MachineState } from './machine';

const run = (actions: Parameters<typeof reducer>[1][], from = initialState): MachineState =>
  actions.reduce(reducer, from);

describe('fluxo de atalho — 3 toques', () => {
  it('attract → parq → home → result em 3 toques', () => {
    const s = run([
      { type: 'TOUCH_ATTRACT' },
      { type: 'PARQ_NONE' },
      { type: 'PICK_SHORTCUT', index: 0 },
    ]);
    expect(s.screen).toBe('generating');
    expect(s.taps).toBe(3);
    expect(s.path).toBe('atalho');
  });

  it('o atalho preenche objetivo, grupos e tempo de uma vez', () => {
    const s = run([
      { type: 'TOUCH_ATTRACT' },
      { type: 'PARQ_NONE' },
      { type: 'PICK_SHORTCUT', index: 0 },
    ]);
    expect(s.groups).toEqual(SHORTCUTS[0].groups);
    expect(s.minutes).toBe(SHORTCUTS[0].minutes);
    expect(s.goal).toBe(SHORTCUTS[0].goal);
  });

  it('atalho nunca popula `avoid` — só o passo 6 do caminho completo faz isso', () => {
    const s = run([
      { type: 'TOUCH_ATTRACT' },
      { type: 'PARQ_NONE' },
      { type: 'PICK_SHORTCUT', index: 1 },
    ]);
    expect(toInput(s, ['barra']).avoid).toEqual([]);
  });

  it('só o "Treino rápido" tem askTime — os outros três geram direto', () => {
    const comAskTime = SHORTCUTS.filter((s) => s.askTime);
    expect(comAskTime).toHaveLength(1);
    expect(comAskTime[0].label).toBe('Treino rápido');
  });
});

describe('atalho "Treino rápido" — pede o tempo antes de gerar', () => {
  const idx = SHORTCUTS.findIndex((s) => s.askTime);

  const ateOTempo = () =>
    run([{ type: 'TOUCH_ATTRACT' }, { type: 'PARQ_NONE' }, { type: 'PICK_SHORTCUT', index: idx }]);

  it('vai para a tela de tempo, não direto para a geração', () => {
    const s = ateOTempo();
    expect(s.screen).toBe('time');
    expect(s.path).toBe('atalho');
  });

  it('escolher o tempo gera na hora — no atalho não há pergunta de nível', () => {
    const s = reducer(ateOTempo(), { type: 'PICK_TIME', minutes: 40 });
    expect(s.screen).toBe('generating');
    expect(s.minutes).toBe(40);
  });

  it('custa 4 toques, um mais que os outros atalhos', () => {
    const rapido = reducer(ateOTempo(), { type: 'PICK_TIME', minutes: 30 });
    const direto = run([
      { type: 'TOUCH_ATTRACT' },
      { type: 'PARQ_NONE' },
      { type: 'PICK_SHORTCUT', index: 0 },
    ]);
    expect(rapido.taps).toBe(4);
    expect(direto.taps).toBe(3);
  });

  it('BACK da tela de tempo volta para a home, não para os grupos', () => {
    // A mesma tela `time` volta para `groups` no caminho completo — coberto
    // pelo teste de BACK em "caminho completo".
    const s = reducer(ateOTempo(), { type: 'BACK' });
    expect(s.screen).toBe('home');
  });
});

describe('triagem PAR-Q', () => {
  it('marcar qualquer condição leva a blocked e NÃO gera treino', () => {
    const s = run([{ type: 'TOUCH_ATTRACT' }, { type: 'PARQ_TOGGLE', index: 0 }]);
    expect(s.screen).toBe('blocked');
    expect(s.parq).toEqual([0]);
  });

  it('desmarcar a última condição volta para a triagem', () => {
    const s = run([
      { type: 'TOUCH_ATTRACT' },
      { type: 'PARQ_TOGGLE', index: 1 },
      { type: 'PARQ_TOGGLE', index: 1 },
    ]);
    expect(s.screen).toBe('parq');
    expect(s.parq).toEqual([]);
  });

  it('"nenhuma das anteriores" limpa as marcações e libera', () => {
    const s = run([
      { type: 'TOUCH_ATTRACT' },
      { type: 'PARQ_TOGGLE', index: 0 },
      { type: 'PARQ_NONE' },
    ]);
    expect(s.screen).toBe('home');
    expect(s.parq).toEqual([]);
  });
});

describe('caminho completo', () => {
  it('percorre os 4 passos e chega a generating', () => {
    const s = run([
      { type: 'TOUCH_ATTRACT' },
      { type: 'PARQ_NONE' },
      { type: 'OPEN_CUSTOM' },
      { type: 'PICK_GOAL', goal: 'hipertrofia' },
      { type: 'TOGGLE_GROUP', group: 'peito' },
      { type: 'CONFIRM_GROUPS' },
      { type: 'PICK_TIME', minutes: 45 },
      { type: 'PICK_LEVEL', level: 2 },
    ]);
    expect(s.screen).toBe('generating');
    expect(s.path).toBe('completo');
  });

  it('não deixa confirmar grupos sem escolher nenhum', () => {
    const s = run([
      { type: 'TOUCH_ATTRACT' },
      { type: 'PARQ_NONE' },
      { type: 'OPEN_CUSTOM' },
      { type: 'PICK_GOAL', goal: 'forca' },
      { type: 'CONFIRM_GROUPS' },
    ]);
    expect(s.screen).toBe('groups');
  });

  it('alterna grupo dentro e fora da seleção', () => {
    let s = run([
      { type: 'TOUCH_ATTRACT' },
      { type: 'PARQ_NONE' },
      { type: 'OPEN_CUSTOM' },
      { type: 'PICK_GOAL', goal: 'forca' },
      { type: 'TOGGLE_GROUP', group: 'peito' },
      { type: 'TOGGLE_GROUP', group: 'costas' },
    ]);
    expect(s.groups).toEqual(['peito', 'costas']);
    s = reducer(s, { type: 'TOGGLE_GROUP', group: 'peito' });
    expect(s.groups).toEqual(['costas']);
  });

  it('"não sei" no nível assume intermediário', () => {
    const s = run([
      { type: 'TOUCH_ATTRACT' },
      { type: 'PARQ_NONE' },
      { type: 'OPEN_CUSTOM' },
      { type: 'PICK_GOAL', goal: 'hipertrofia' },
      { type: 'TOGGLE_GROUP', group: 'peito' },
      { type: 'CONFIRM_GROUPS' },
      { type: 'PICK_TIME', minutes: 45 },
      { type: 'PICK_LEVEL', level: 2 },
    ]);
    expect(s.level).toBe(2);
  });

  it('BACK volta um passo sem perder a seleção anterior', () => {
    let s = run([
      { type: 'TOUCH_ATTRACT' },
      { type: 'PARQ_NONE' },
      { type: 'OPEN_CUSTOM' },
      { type: 'PICK_GOAL', goal: 'forca' },
      { type: 'TOGGLE_GROUP', group: 'pernas' },
      { type: 'CONFIRM_GROUPS' },
    ]);
    expect(s.screen).toBe('time');
    s = reducer(s, { type: 'BACK' });
    expect(s.screen).toBe('groups');
    expect(s.groups).toEqual(['pernas']);
  });
});

describe('resultado e reset', () => {
  it('treino magro vai para a tela thin, não para result', () => {
    const s = reducer(
      { ...initialState, screen: 'generating' },
      { type: 'GENERATED', workout: { items: [], minItems: 3 } as never },
    );
    expect(s.screen).toBe('thin');
  });

  it('treino completo vai para result', () => {
    const s = reducer(
      { ...initialState, screen: 'generating' },
      { type: 'GENERATED', workout: { items: [1, 2, 3], minItems: 3 } as never },
    );
    expect(s.screen).toBe('result');
  });

  it('REGENERATE incrementa a seed e volta a gerar', () => {
    const antes = { ...initialState, screen: 'result' as const, seed: 5 };
    const s = reducer(antes, { type: 'REGENERATE' });
    expect(s.seed).toBe(6);
    expect(s.screen).toBe('generating');
  });

  it('RESET descarta TODO o estado do aluno anterior', () => {
    const sujo: MachineState = {
      ...initialState,
      screen: 'result',
      parq: [0, 1],
      groups: ['peito', 'costas'],
      avoid: ['joelho'],
      taps: 17,
      workout: { items: [] } as never,
      goal: 'forca',
      minutes: 90,
      level: 3,
    };
    const s = reducer(sujo, { type: 'RESET' });
    expect(s.screen).toBe('attract');
    expect(s.parq).toEqual([]);
    expect(s.groups).toEqual([]);
    expect(s.avoid).toEqual([]);
    expect(s.taps).toBe(0);
    expect(s.workout).toBeNull();
    // a seed sobrevive de propósito: o próximo aluno não repete o treino
    expect(s.seed).toBe(sujo.seed);
  });
});

describe('toInput', () => {
  it('monta o Input que o motor espera', () => {
    const s = run([
      { type: 'TOUCH_ATTRACT' },
      { type: 'PARQ_NONE' },
      { type: 'PICK_SHORTCUT', index: 2 },
    ]);
    const input = toInput(s, ['barra', 'banco']);
    expect(input.availableEquipment).toEqual(['barra', 'banco']);
    expect(input.groups).toEqual(SHORTCUTS[2].groups);
    expect(input.seed).toBe(s.seed);
  });
});
