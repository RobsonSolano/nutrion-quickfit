/** Herdado do tailwind.config.js do Persona Fit. Fixo — a academia não mexe. */
export const DARK_BASE = {
  bg: '#07080B',
  surface: '#12141A',
  raised: '#1A1D25',
  border: '#1F232B',
  text: '#F4F5F7',
  dim: '#A1A6B2',
  violet: '#8B5CF6',
  danger: '#F43F5E',
} as const;

export const LIGHT_BASE = {
  bg: '#F7F8FA',
  surface: '#FFFFFF',
  raised: '#F0F2F5',
  border: '#DCE0E6',
  text: '#0B0D12',
  dim: '#5B6270',
  violet: '#6D28D9',
  danger: '#BE123C',
} as const;

/**
 * Por que `danger` muda entre os modos, medido (WCAG, fórmula do contrast.ts):
 *
 *   #F43F5E  sobre #07080B (escuro) = 5.45:1  ✓
 *   #F43F5E  sobre #F7F8FA (claro)  = 3.46:1  ✗ reprova para texto normal
 *   #BE123C  sobre #F7F8FA (claro)  = 5.91:1  ✓
 *
 * É o único caso onde a mudança de modo não é cosmética: o mesmo vermelho que
 * funciona no escuro fica ilegível no claro. Daí `--qf-danger` ser token e não
 * hex no `tailwind.config.js` — a academia não escolhe esta cor, mas o modo
 * escolhe. O chip de contraindicação (`bg-danger text-white`) fica em 3.67:1 no
 * escuro e 6.29:1 no claro: passa AA porque o alvo de toque tem 96px e o rótulo
 * conta como texto grande (mínimo 3:1), não como corpo de texto.
 */

/** Mínimo WCAG AA para texto grande. Abaixo disto o painel recusa a cor. */
export const MIN_CONTRAST = 4.5;

/**
 * Verde de marca padrão — usado quando uma academia ainda não tem tema
 * próprio ou quando o accent salvo reprova o contraste (apply.ts). Fonte
 * única para o código; `index.css` (`--qf-accent` inicial, antes do JS
 * rodar) e a migration `20260728000100_gyms.sql` (`theme` default da
 * coluna) precisam ser atualizados manualmente se este valor mudar — CSS
 * e SQL não importam constante TS.
 */
export const DEFAULT_ACCENT = '#39FF14';
