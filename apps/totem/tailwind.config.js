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
        danger:   '#F43F5E',
        warn:     '#F59E0B',
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
