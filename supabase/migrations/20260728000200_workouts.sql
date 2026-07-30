create table if not exists public.generated_workouts (
  -- nanoid de 10 chars: URL curta gera QR de baixa densidade, que lê rápido
  -- em câmera ruim sob luz forte.
  id           text primary key,
  gym_id       uuid not null references public.gyms(id) on delete cascade,
  input        jsonb not null,
  exercises    jsonb not null,
  parq_blocked boolean not null default false,
  created_at   timestamptz not null default now()
);

create index if not exists generated_workouts_gym_created_idx
  on public.generated_workouts (gym_id, created_at desc);

-- As estatísticas do painel saem de views sobre esta tabela. Nenhuma
-- tabela nova de agregação na fase 1.
create or replace view public.stats_por_hora as
  select gym_id,
         date_trunc('hour', created_at) as hora,
         count(*)                       as treinos,
         count(*) filter (where parq_blocked) as encaminhados
    from public.generated_workouts
   group by 1, 2;
