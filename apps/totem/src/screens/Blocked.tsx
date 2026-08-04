import { Cta } from '../components/Cta';

export function Blocked({ onReset }: { onReset: () => void }) {
  return (
    <div className="flex h-full flex-col gap-5 sm:gap-8">
      <div className="my-auto rounded-xl border-l-4 border-warn bg-warn/10 px-8 py-7">
        <h2 className="font-display text-qf-title font-extrabold leading-tight tracking-tight text-balance">
          Fale com o professor da unidade
        </h2>
        <p className="mt-5 text-qf-body leading-relaxed text-dim">
          Pelo que você marcou, seu treino de hoje precisa ser montado por um
          profissional. Procure a recepção — leva menos de dois minutos.
        </p>
      </div>
      <Cta variant="ghost" onClick={onReset}>
        Voltar ao início
      </Cta>
    </div>
  );
}
