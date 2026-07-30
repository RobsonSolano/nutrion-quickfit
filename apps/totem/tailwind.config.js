/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg:       'var(--qf-bg)',
        surface:  'var(--qf-surface)',
        raised:   'var(--qf-raised)',
        border:   'var(--qf-border)',
        text:     'var(--qf-text)',
        dim:      'var(--qf-dim)',
        accent:   'var(--qf-accent)',
        onAccent: 'var(--qf-on-accent)',
        violet:   'var(--qf-violet)',
        // `danger` também é token, não hex. Não porque a academia troque a cor
        // de erro — ela não troca — mas porque no modo claro `#F43F5E` precisa
        // escurecer para continuar legível, e é o `applyTheme` que decide isso
        // (task 12). Hex aqui congelaria a cor nos dois modos.
        danger:   'var(--qf-danger)',
        // Não vem do white-label (nenhuma academia escolhe esta cor): é o
        // aviso "precisa de atenção humana" usado por Blocked/Thin, distinto
        // do vermelho de erro `danger`.
        warn:     'var(--qf-warn)',
      },
      fontFamily: {
        display: ['Sora', 'system-ui', 'sans-serif'],
        sans:    ['Inter', 'system-ui', 'sans-serif'],
      },
      minHeight: {
        touch: '96px',   // o alvo mínimo de toque do totem
      },
    },
  },
  plugins: [],
};
