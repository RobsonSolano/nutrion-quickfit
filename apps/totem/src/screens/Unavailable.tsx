/** Nenhum caminho termina em tela branca (spec §8). */
export function Unavailable() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 text-center">
      <h2 className="font-display text-[48px] font-extrabold tracking-tight">
        Totem indisponível
      </h2>
      <p className="max-w-[24ch] text-[26px] leading-relaxed text-dim">
        Procure a recepção para montar seu treino de hoje.
      </p>
    </div>
  );
}
