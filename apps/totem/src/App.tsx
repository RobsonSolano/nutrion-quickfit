import { useEffect, useReducer, useRef, useState } from 'react';
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
import { Avoid } from './screens/Avoid';
import { Result } from './screens/Result';
import { Ficha } from './screens/Ficha';
import { groupsLabel, LEVEL_OPTIONS } from './screens/labels';
import { embellish, type Embellishment } from './ai/embellish';
import { SharedWorkout } from './screens/SharedWorkout';
import { saveWorkout } from './data/saveWorkout';

/**
 * Sem hook nenhum de propósito: o roteamento de `/w/:id` precisa decidir
 * ANTES de qualquer `useState`/`useEffect` rodar, e um componente com
 * `return` condicional antes de um hook viola a regra dos hooks. Separar
 * em dois componentes — este sem hooks, `TotemApp` com todos — é a forma
 * limpa; a alternativa (early return dentro de `TotemApp`) violaria a
 * regra de verdade, não só o lint.
 */
export function App() {
  const shared = window.location.pathname.match(/^\/w\/([0-9a-z]{6,20})$/);
  if (shared) return <SharedWorkout id={shared[1]} />;
  return <TotemApp />;
}

function TotemApp() {
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
  //
  // O `genToken` NÃO pode ser um `stale` flag comum (`let stale=false` +
  // `stale=true` no cleanup): o próprio `dispatch({type:'GENERATED'})` abaixo
  // muda `state.screen`, que é dependência deste efeito — isso faz o React
  // rodar o cleanup da MESMA geração antes do saveWorkout responder, e o
  // WORKOUT_SAVED nunca dispararia (medido em produção: o POST em
  // generated_workouts completava, mas o QR nunca aparecia). O token só
  // avança quando uma geração NOVA de verdade começa (screen volta a
  // 'generating' com seed diferente), nunca pela própria transição desta.
  const genToken = useRef(0);
  useEffect(() => {
    if (state.screen !== 'generating' || !bundle) return;
    const myToken = ++genToken.current;
    const input = toInput(state, bundle.availableEquipment);
    const t = window.setTimeout(() => {
      const workout = generateWorkout(input, bundle.exercises);
      dispatch({ type: 'GENERATED', workout });
      saveWorkout(bundle.gym.id, input, workout).then((id) => {
        if (id && genToken.current === myToken) dispatch({ type: 'WORKOUT_SAVED', id });
      });
    }, 820);
    return () => window.clearTimeout(t);
  }, [state.screen, state.seed, bundle]);

  // Registra o bloqueio do PAR-Q para o gestor ver nas estatísticas (spec
  // §8) — não gera treino, só telemetria de encaminhamento.
  //
  // parqReported evita duplicar linha: o aluno pode marcar/desmarcar
  // condições várias vezes (blocked -> parq -> blocked de novo) antes de
  // decidir, e cada entrada em 'blocked' reexecutava este efeito. Conta
  // UMA vez por visita; só reseta quando a tela volta pro attract (RESET).
  const parqReported = useRef(false);
  useEffect(() => {
    if (state.screen === 'attract') parqReported.current = false;
    if (state.screen !== 'blocked' || !bundle || parqReported.current) return;
    parqReported.current = true;
    const vazio = { items: [], scheme: { sets: 0, reps: '', rest: 0, target: 0 },
      poolSize: 0, budgetSec: 0, usedSec: 0, cap: 0, minItems: 0, extraSets: 0 };
    void saveWorkout(bundle.gym.id, toInput(state, bundle.availableEquipment), vazio as never, true);
  }, [state.screen, bundle]);

  // O enfeite de IA chega depois do treino já estar na tela (D5). Não há
  // await no caminho da UI: se falhar, der timeout ou não houver internet,
  // o aluno não vê diferença além do título genérico.
  useEffect(() => {
    if (state.screen !== 'result' || !state.workout) return;
    setFlair(null);
    // Guarda contra corrida: "gerar outro" duas vezes rápido pode fazer o
    // enfeite do treino ANTERIOR chegar depois do efeito já ter trocado de
    // treino, e sobrescrever o título certo com o de um treino que não está
    // mais na tela.
    let stale = false;
    embellish(state.workout, state.goal, state.groups).then((f) => {
      if (!stale) setFlair(f);
    });
    return () => {
      stale = true;
    };
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
          <div className="flex h-full flex-col gap-4 p-5 sm:gap-6 sm:p-10">
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
                  variant={state.path}
                  onPick={(level) => dispatch({ type: 'PICK_LEVEL', level })}
                  onBack={() => dispatch({ type: 'BACK' })}
                />
              )}
              {state.screen === 'avoid' && (
                <Avoid
                  selected={state.avoid}
                  onToggle={(tag) => dispatch({ type: 'TOGGLE_AVOID', tag })}
                  onConfirm={() => dispatch({ type: 'CONFIRM_AVOID' })}
                  onBack={() => dispatch({ type: 'BACK' })}
                />
              )}
              {state.screen === 'result' && state.workout && (
                <Result
                  workout={state.workout}
                  groupsTitle={groupsLabel(state.groups)}
                  levelLabel={LEVEL_OPTIONS.find((o) => o.level === state.level)!.label}
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
        <div className="font-display text-qf-body font-bold tracking-tight">{gymName}</div>
        <div className="text-qf-label uppercase tracking-[0.1em] text-dim">QuickFit</div>
      </div>
    </div>
  );
}
