/**
 * Gerador determinístico em [0, 1). É o que permite testar variação:
 * `seed: 42` sempre produz o mesmo treino, então "seeds diferentes geram
 * treinos diferentes" é uma afirmação verificável.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Sorteia proporcionalmente ao score. Itens com score 0 nunca são
 * escolhidos, a menos que sejam a única opção.
 */
export function weightedPick<T>(
  scored: Array<{ item: T; score: number }>,
  rng: () => number,
): T {
  if (scored.length === 0) {
    throw new Error('weightedPick: lista vazia');
  }

  const total = scored.reduce((s, x) => s + Math.max(0, x.score), 0);

  // Todos zerados: devolve o último em vez de dividir por zero.
  if (total <= 0) return scored[scored.length - 1].item;

  let r = rng() * total;
  for (const x of scored) {
    r -= Math.max(0, x.score);
    if (r < 0) return x.item;
  }
  return scored[scored.length - 1].item;
}
