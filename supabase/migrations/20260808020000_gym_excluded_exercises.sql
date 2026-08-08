-- Academia pode não querer um exercício específico no "cardápio" por
-- estilo, não por falta de equipamento (ex.: N1 Iron House é musculação
-- clássica e não quer Bear crawl/Burpee/Mountain climber — nenhum desses
-- exige aparelho, então `gym_equipment` não resolve).
create table if not exists public.gym_excluded_exercises (
  gym_id      uuid not null references public.gyms(id) on delete cascade,
  -- text, não uuid: `exercises.id` é text (mesmo formato de UUID, mas a
  -- coluna nunca foi tipada como uuid nativo — ver 20260728000000_catalog.sql).
  exercise_id text not null references public.exercises(id) on delete cascade,
  primary key (gym_id, exercise_id)
);

alter table public.gym_excluded_exercises enable row level security;

-- Mesma lógica de `gym_equipment`: o totem PRECISA ler isso pra montar
-- o catálogo elegível da unidade, então leitura pública.
create policy anon_read_gym_excluded on public.gym_excluded_exercises
  for select to anon using (true);
