import { useEffect, useState } from 'react';
import { Cta } from '../components/Cta';
import { qrDataUrl, workoutUrl } from '../print/qr';
import { describeWorkout } from './labels';
import type { Gym } from '../data/loadCatalog';
import type { Workout } from '@quickfit/core/engine';

type Props = {
  workout: Workout;
  gym: Gym;
  groupsTitle: string;
  workoutId: string | null;
  onBack: () => void;
};

/**
 * Ficha em formato CUPOM, não A4. Decisão do Robson (jul/2026): impressão
 * térmica em cupom é prática consolidada em academia, e a compatibilidade entre
 * os formatos é de mão única — medido:
 *
 *   cupom (80mm, ~34 caracteres)  ->  imprime aceitável em A4
 *   A4 (tabela de 4 colunas, ~53) ->  NÃO cabe em cupom, estoura 19 caracteres
 *
 * Então uma coluna estreita, sem tabela. Em A4 sai centralizada, com cara de
 * cupom numa folha — que é o que a academia entrega ao aluno.
 */
export function Ficha({ workout, gym, groupsTitle, workoutId, onBack }: Props) {
  const [qr, setQr] = useState<string | null>(null);
  const d = describeWorkout(workout);

  useEffect(() => {
    if (!workoutId) return;
    qrDataUrl(workoutUrl(workoutId)).then(setQr).catch(() => setQr(null));
  }, [workoutId]);

  const hoje = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date());

  return (
    <div className="qf-ficha flex h-full flex-col items-center gap-5 bg-raised p-6">
      {/* 78mm ~= a bobina de 80mm com folga. A pré-visualização usa a MESMA
          largura da impressão, para o que aparece na tela ser o que sai. */}
      <div className="qf-sheet flex min-h-0 w-[78mm] flex-1 flex-col gap-3 bg-white p-5 font-mono text-[13px] leading-snug text-black shadow-2xl">
        <div className="flex-none text-center">
          <div className="gym text-[17px] font-bold uppercase leading-tight">{gym.name}</div>
          <div className="tag text-[11px] uppercase tracking-wide">QuickFit · {hoje}</div>
        </div>

        <div className="rule flex-none border-t border-dashed border-black" />

        <div className="flex-none text-center">
          <div className="text-[15px] font-bold">{groupsTitle}</div>
          <div className="text-[11px]">
            {d.minutos} min · descanso {workout.scheme.rest}s
          </div>
          <div className="text-[11px]">aquecimento 5 min antes</div>
        </div>

        <div className="rule flex-none border-t border-dashed border-black" />

        {/* Rola na TELA; o print.css zera o overflow na impressão, senão
            exercício desaparece do papel sem aviso. */}
        <div className="qf-sheet-body min-h-0 flex-1 overflow-y-auto">
          {workout.items.map((it, i) => (
            <div key={it.exercise.id} className="ex mb-3 last:mb-0">
              <div className="font-bold">
                {i + 1}. {it.exercise.name}
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <span>
                  {it.sets} x {it.reps}
                </span>
                <span className="text-[11px]">
                  carga <span className="carga inline-block min-w-[18mm] border-b border-black" />
                </span>
              </div>
              {it.exercise.cue ? (
                <div className="dim text-[11px] leading-tight">{it.exercise.cue}</div>
              ) : null}
              {it.exercise.equipment.length > 0 ? (
                <div className="eqp text-[10px] uppercase tracking-wide">
                  {it.exercise.equipment.join(' + ')}
                </div>
              ) : (
                <div className="eqp text-[10px] uppercase tracking-wide">peso corporal</div>
              )}
            </div>
          ))}
        </div>

        <div className="qf-sheet-footer flex-none border-t border-dashed border-black pt-2">
          {qr ? (
            <div className="mb-2 flex flex-col items-center gap-1">
              <img src={qr} alt="QR do treino" className="qr h-[34mm] w-[34mm]" />
              <div className="text-[10px]">aponte a câmera para abrir no celular</div>
            </div>
          ) : null}
          <div className="text-center text-[10px] leading-tight">
            {gym.trainerName ? <div>{gym.trainerName}</div> : null}
            {gym.trainerCref ? <div>{gym.trainerCref}</div> : null}
            <div className="mt-1">
              Prescrição homologada por profissional de educação física.
            </div>
            <div>Sinta dor ou tontura, pare e procure a equipe.</div>
          </div>
        </div>
      </div>

      <div className="no-print flex flex-none gap-4">
        <Cta onClick={() => window.print()}>🖨 &nbsp;Imprimir</Cta>
        <Cta variant="ghost" onClick={onBack}>
          ← Voltar
        </Cta>
      </div>
    </div>
  );
}
