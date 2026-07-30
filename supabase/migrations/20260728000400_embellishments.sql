-- Cache do enfeite de IA. O enfeite de "peito+tríceps, hipertrofia, 45min" é
-- praticamente idêntico toda vez — cachear derruba ~90% das chamadas de LLM
-- numa academia real e leva a latência de p50 a zero.
create table if not exists public.embellishments (
  -- sha256 de (goal, groups ordenados, ids dos exercícios em ordem)
  cache_key  text primary key,
  title      text not null,
  cues       jsonb not null,   -- { "<exercise_id>": "dica curta" }
  model      text not null,
  created_at timestamptz not null default now(),
  hits       integer not null default 0
);

create or replace function public.bump_embellishment_hits(k text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.embellishments set hits = hits + 1 where cache_key = k;
$$;
