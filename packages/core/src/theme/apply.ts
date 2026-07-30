import type { GymTheme } from './types';
import { DARK_BASE, LIGHT_BASE } from './base';
import { bestContrast, rgba, validateAccent } from './contrast';

/**
 * Roda uma vez no boot, antes do primeiro paint. Escreve as custom
 * properties que o Tailwind consome — nenhum componente conhece hex.
 */
export function applyTheme(theme: GymTheme): void {
  const base = theme.mode === 'dark' ? DARK_BASE : LIGHT_BASE;
  const root = document.documentElement.style;

  for (const [k, v] of Object.entries(base)) {
    root.setProperty(`--qf-${k}`, v);
  }

  // Defesa em profundidade: o painel já valida, mas se um tema ruim chegar
  // ao banco por SQL manual, o totem cai para o accent padrão em vez de
  // exibir um botão ilegível.
  const check = validateAccent(theme.accent, theme.mode);
  const accent = check.ok ? theme.accent : (check.suggestion ?? '#39FF14');
  if (!check.ok) {
    console.warn(
      `Accent "${theme.accent}" tem contraste ${check.ratio.toFixed(2)}:1 — ` +
        `usando "${accent}".`,
    );
  }

  root.setProperty('--qf-accent', accent);
  root.setProperty('--qf-on-accent', bestContrast(accent, ['#07080B', '#FFFFFF']));
  root.setProperty('--qf-accent-glow', rgba(accent, 0.22));
  root.setProperty('color-scheme', theme.mode);
}
