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

export function App() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [bundle, setBundle] = useState<CatalogBundle | null>(null);
  const [failed, setFailed] = useState(false);

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
            <Header gymName={gym.name} />
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
              {/* result, ficha e o caminho completo entram nas tasks 15 e 16 */}
            </div>
          </div>
        )}
      </Boundary>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="h-full w-full overflow-hidden bg-bg text-text">{children}</main>;
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
