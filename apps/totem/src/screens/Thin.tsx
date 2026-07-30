import { Cta } from '../components/Cta';

type Props = { poolSize: number; onBack: () => void; onReset: () => void };

/**
 * A mensagem tem que dizer a CAUSA CERTA: falta de aparelho é diferente de
 * combinação apertada. Errar aqui faz o gestor achar que a academia dele é pobre.
 */
export function Thin({ poolSize, onBack, onReset }: Props) {
  const causa =
    poolSize < 6
      ? 'Esta unidade não tem aparelhos suficientes para montar um treino seguro com essa combinação.'
      : 'Não deu para montar um treino completo com esse tempo e essa combinação.';

  return (
    <div className="flex h-full flex-col gap-8">
      <div className="my-auto rounded-xl border-l-4 border-warn bg-warn/10 px-8 py-7">
        <h2 className="font-display text-[40px] font-extrabold leading-tight tracking-tight">
          Combinação indisponível
        </h2>
        <p className="mt-5 text-[26px] leading-relaxed text-dim">
          {causa} Tente outro grupo muscular ou fale com o professor da unidade.
        </p>
      </div>
      <div className="flex gap-4">
        <Cta onClick={onBack}>Escolher outro</Cta>
        <Cta variant="ghost" onClick={onReset}>Sair</Cta>
      </div>
    </div>
  );
}
