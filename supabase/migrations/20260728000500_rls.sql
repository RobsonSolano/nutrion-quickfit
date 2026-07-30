-- Não há login no totem. Tudo passa pela role `anon`, então cada policy
-- precisa ser escrita como se fosse pública — porque é.

alter table public.equipment                  enable row level security;
alter table public.exercises                  enable row level security;
alter table public.exercise_secondary_groups  enable row level security;
alter table public.exercise_equipment         enable row level security;
alter table public.exercise_contraindications enable row level security;
alter table public.gyms                       enable row level security;
alter table public.gym_equipment              enable row level security;
alter table public.generated_workouts         enable row level security;
alter table public.embellishments             enable row level security;

-- Catálogo: leitura pública. É dado de domínio, não segredo.
create policy anon_read_equipment  on public.equipment
  for select to anon using (true);
create policy anon_read_exercises  on public.exercises
  for select to anon using (true);
create policy anon_read_secondary  on public.exercise_secondary_groups
  for select to anon using (true);
create policy anon_read_ex_equip   on public.exercise_equipment
  for select to anon using (true);
create policy anon_read_contra     on public.exercise_contraindications
  for select to anon using (true);

-- Academias e equipamento da unidade: leitura pública.
-- `theme` e `trainer_cref` são exibidos no totem, então não são sigilosos.
create policy anon_read_gyms       on public.gyms
  for select to anon using (true);
create policy anon_read_gym_equip  on public.gym_equipment
  for select to anon using (true);

-- Treinos gerados: o totem PODE inserir.
create policy anon_insert_workout on public.generated_workouts
  for insert to anon with check (true);

-- Treinos gerados: leitura SÓ por id, nunca listagem.
--
-- Uma policy `using (true)` de SELECT permitiria `select * from
-- generated_workouts` e qualquer pessoa dumparia a telemetria de todas as
-- academias. A função abaixo devolve UM registro pelo nanoid inadivinhável e
-- é a única porta de leitura — nenhuma policy de SELECT é criada.
create or replace function public.get_workout(workout_id text)
returns table (id text, gym_id uuid, input jsonb, exercises jsonb, created_at timestamptz)
language sql
security definer
set search_path = public
as $$
  select w.id, w.gym_id, w.input, w.exercises, w.created_at
    from public.generated_workouts w
   where w.id = workout_id
     and not w.parq_blocked
   limit 1;
$$;

grant execute on function public.get_workout(text) to anon;

-- Cache de enfeite: o totem lê e escreve. Não contém dado de aluno.
create policy anon_read_embellishment   on public.embellishments
  for select to anon using (true);
create policy anon_insert_embellishment on public.embellishments
  for insert to anon with check (true);

grant execute on function public.bump_embellishment_hits(text) to anon;
