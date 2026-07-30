import { useEffect, useReducer, useState } from 'react';
import { generateWorkout } from '@quickfit/core/engine';
import { loadCatalog, type CatalogBundle } from './data/loadCatalog';
import { applyTheme } from '@quickfit/core/theme';
import { initialState, reducer, toInput } from './state/machine';
import { useIdleTimeout } from './state/useIdleTimeout';
import { Attract, Mark } from './screens/Attract';
import { Parq } from './screens/Parq';
import { Blocked } from './screens/Blocked';
import { Home } from './screens/Home';
import { Generating } from './screens/Generating';
import { Thin } from './screens/Thin';
import { Unavailable } from './screens/Unavailable';
import { Boundary } from './components/Boundary';
import { Goal } from './screens/Goal';
import { Groups } from './screens/Groups';
import { Time } from './screens/Time';
import { Level } from './screens/Level';
import { Result } from './screens/Result';
import { Ficha } from './screens/Ficha';
import { groupsLabel, LEVEL_OPTIONS } from './screens/labels';
import { embellish, type Embellishment } from './ai/embellish';

export function App() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [bundle, setBundle] = useState<CatalogBundle | null>(null);
  const [failed, setFailed] = useState(false);
  const [flair, setFlair] = useState<Embellishment | null>(null);

  useEffect(() => {
    loadCatalog()
      .then((b) => {
        applyTheme(b.gym.theme);
        setBundle(b);
      })
      .catch((e) => {
        console.error(e);
        setFailed(true);
      });
  }, []);

  // Gera assim que a tela `generating` aparece. O motor é sincronizado; o
  // delay é só para a animação não piscar.
  useEffect(() => {
    if (state.screen !== 'generating' || !bundle) return;
    const t = window.setTimeout(() => {
      const workout = generateWorkout(toInput(state, bundle.availableEquipment), bundle.exercises);
      dispatch({ type: 'GENERATED', workout });
    }, 820);
    return () => window.clearTimeout(t);
  }, [state.screen, state.seed, bundle]);

  // O enfeite de IA chega depois do treino já estar na tela (D5). Não há
  // await no caminho da UI: se falhar, der timeout ou não houver internet,
  // o aluno não vê diferença além do título genérico.
  useEffect(() => {
    if (state.screen !== 'result' || !state.workout) return;
    setFlair(null);
    embellish(state.workout, state.goal, state.groups).then(setFlair);
  }, [state.screen, state.workout, state.goal, state.groups]);

  useIdleTimeout(() => dispatch({ type: 'RESET' }), state.screen !== 'attract');

  if (failed) return <Shell><Unavailable /></Shell>;
  if (!bundle) return <Shell><div className="grid h-full place-items-center"><Mark size={96} /></div></Shell>;

  const gym = bundle.gym;

  return (
    <Shell>
      <Boundary onReset={() => dispatch({ type: 'RESET' })}>
        {state.screen === 'attract' && (
          <Attract gymName={gym.name} onTouch={() => dispatch({ type: 'TOUCH_ATTRACT' })} />
        )}

        {state.screen !== 'attract' && (
          <div className="flex h-full flex-col gap-6 p-10">
            <div className="no-print"><Header gymName={gym.name} /></div>
            <div className="min-h-0 flex-1">
              {state.screen === 'parq' && (
                <Parq
                  marked={state.parq}
                  onToggle={(i) => dispatch({ type: 'PARQ_TOGGLE', index: i })}
                  onNone={() => dispatch({ type: 'PARQ_NONE' })}
                />
              )}
              {state.screen === 'blocked' && <Blocked onReset={() => dispatch({ type: 'RESET' })} />}
              {state.screen === 'home' && (
                <Home
                  onShortcut={(i) => dispatch({ type: 'PICK_SHORTCUT', index: i })}
                  onCustom={() => dispatch({ type: 'OPEN_CUSTOM' })}
                />
              )}
              {state.screen === 'generating' && <Generating />}
              {state.screen === 'thin' && (
                <Thin
                  poolSize={state.workout?.poolSize ?? 0}
                  onBack={() => dispatch({ type: 'PARQ_NONE' })}
                  onReset={() => dispatch({ type: 'RESET' })}
                />
              )}
              {state.screen === 'goal' && (
                <Goal
                  onPick={(goal) => dispatch({ type: 'PICK_GOAL', goal })}
                  onBack={() => dispatch({ type: 'BACK' })}
                />
              )}
              {state.screen === 'groups' && (
                <Groups
                  selected={state.groups}
                  onToggle={(group) => dispatch({ type: 'TOGGLE_GROUP', group })}
                  onConfirm={() => dispatch({ type: 'CONFIRM_GROUPS' })}
                  onBack={() => dispatch({ type: 'BACK' })}
                />
              )}
              {state.screen === 'time' && (
                <Time
                  variant={state.path}
                  onPick={(minutes) => dispatch({ type: 'PICK_TIME', minutes })}
                  onBack={() => dispatch({ type: 'BACK' })}
                />
              )}
              {state.screen === 'level' && (
                <Level
                  onPick={(level) => dispatch({ type: 'PICK_LEVEL', level })}
                  onBack={() => dispatch({ type: 'BACK' })}
                />
              )}
              {state.screen === 'result' && state.workout && (
                <Result
                  workout={state.workout}
                  groupsTitle={groupsLabel(state.groups)}
                  levelLabel={LEVEL_OPTIONS.find((o) => o.level === state.level)!.sub}
                  embellishTitle={flair?.title ?? null}
                  cues={flair?.cues}
                  onPrint={() => dispatch({ type: 'OPEN_FICHA' })}
                  onRegenerate={() => dispatch({ type: 'REGENERATE' })}
                  onExit={() => dispatch({ type: 'RESET' })}
                />
              )}
              {state.screen === 'ficha' && state.workout && (
                <Ficha
                  workout={state.workout}
                  gym={gym}
                  groupsTitle={groupsLabel(state.groups)}
                  workoutId={state.workoutId}
                  onBack={() => dispatch({ type: 'BACK' })}
                />
              )}
            </div>
          </div>
        )}
      </Boundary>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="qf-shell h-full w-full overflow-hidden bg-bg text-text">{children}</main>;
}

function Header({ gymName }: { gymName: string }) {
  return (
    <div className="flex flex-none items-center gap-4">
      <Mark />
      <div>
        <div className="font-display text-[26px] font-bold tracking-tight">{gymName}</div>
        <div className="text-[16px] uppercase tracking-[0.1em] text-dim">QuickFit</div>
      </div>
    </div>
  );
}
