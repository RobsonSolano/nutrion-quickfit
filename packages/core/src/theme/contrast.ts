import { DARK_BASE, LIGHT_BASE, MIN_CONTRAST } from './base';

function toRgb(hex: string): [number, number, number] {
  const h = hex.trim().replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) {
    throw new Error(`Cor inválida: "${hex}". Use hex de 3 ou 6 dígitos.`);
  }
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as [number, number, number];
}

function luminance(hex: string): number {
  const [r, g, b] = toRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

export function bestContrast(color: string, options: string[]): string {
  return options.reduce((best, o) =>
    contrastRatio(color, o) > contrastRatio(color, best) ? o : best,
  );
}

export function rgba(hex: string, alpha: number): string {
  const [r, g, b] = toRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Clareia (modo escuro) ou escurece (modo claro) até passar o mínimo. */
function nudge(hex: string, mode: 'dark' | 'light'): string | undefined {
  const bg = mode === 'dark' ? DARK_BASE.bg : LIGHT_BASE.bg;
  let [r, g, b] = toRgb(hex);

  for (let step = 0; step < 32; step++) {
    if (mode === 'dark') {
      r = Math.min(255, Math.round(r + (255 - r) * 0.15) + 4);
      g = Math.min(255, Math.round(g + (255 - g) * 0.15) + 4);
      b = Math.min(255, Math.round(b + (255 - b) * 0.15) + 4);
    } else {
      r = Math.max(0, Math.round(r * 0.85) - 4);
      g = Math.max(0, Math.round(g * 0.85) - 4);
      b = Math.max(0, Math.round(b * 0.85) - 4);
    }
    const candidate =
      '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
    if (contrastRatio(candidate, bg) >= MIN_CONTRAST) return candidate;
  }
  return undefined;
}

/**
 * Roda no PAINEL DO GESTOR, nunca no totem. Se a cor da academia reprovar,
 * o painel oferece a variante ajustada — o gestor sente que personalizou e
 * você garante que dá para ler sob luz de galpão.
 */
export function validateAccent(
  accent: string,
  mode: 'dark' | 'light',
): { ok: boolean; ratio: number; suggestion?: string } {
  const bg = mode === 'dark' ? DARK_BASE.bg : LIGHT_BASE.bg;
  const ratio = contrastRatio(accent, bg);
  if (ratio >= MIN_CONTRAST) return { ok: true, ratio };
  return { ok: false, ratio, suggestion: nudge(accent, mode) };
}
