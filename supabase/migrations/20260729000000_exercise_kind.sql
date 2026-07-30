-- Alongamento e liberação não são exercício com séries. Sem esta coluna o
-- motor prescreve "Foam roll quadríceps 3x8-12" numa ficha de hipertrofia.
alter table public.exercises
  add column if not exists kind text not null default 'treino'
  check (kind in ('treino', 'mobilidade'));

comment on column public.exercises.kind is
  'treino = exercício com séries; mobilidade = alongamento ou liberação, só no objetivo mobilidade';
