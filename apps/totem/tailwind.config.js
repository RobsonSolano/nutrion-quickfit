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
      // Escala tipográfica fluida: encolhe suave no celular (o app abre em
      // qualquer navegador durante teste/demo, mesmo sendo pensado para o
      // totem), e trava exatamente no valor de kiosk de hoje a partir de uma
      // tela larga — o 3º número do clamp() é o teto, então o totem em si
      // não muda nem 1px. Não se aplica ao `.qf-sheet` (Ficha.tsx): aquele
      // preview imita papel térmico de 72mm e tem que ficar do mesmo
      // tamanho em qualquer tela.
      fontSize: {
        'qf-hero':    ['clamp(2.25rem, 9vw, 4.5rem)',    { lineHeight: '1.05' }],
        'qf-display': ['clamp(1.75rem, 7.5vw, 3.5rem)',  { lineHeight: '1.1' }],
        'qf-title':   ['clamp(1.5rem, 6vw, 2.75rem)',    { lineHeight: '1.15' }],
        'qf-button':  ['clamp(1.25rem, 4.5vw, 2rem)',    { lineHeight: '1.2' }],
        'qf-cta':     ['clamp(1.125rem, 4vw, 1.875rem)', { lineHeight: '1.2' }],
        'qf-body':    ['clamp(0.9375rem, 3vw, 1.625rem)',{ lineHeight: '1.35' }],
        'qf-label':   ['clamp(0.75rem, 2vw, 1.125rem)',  { lineHeight: '1.3' }],
      },
    },
  },
  plugins: [],
};
