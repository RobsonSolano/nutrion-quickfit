create table if not exists public.gyms (
  id           uuid primary key default gen_random_uuid(),
  slug         text unique not null,
  name         text not null,
  logo_url     text,
  -- accent aqui é DEFAULT_ACCENT (packages/core/src/theme/base.ts) por
  -- extenso — SQL não importa constante TS. Mudou lá, muda aqui também.
  theme        jsonb not null default '{"accent":"#39FF14","mode":"dark"}'::jsonb,
  trainer_name text,
  trainer_cref text,
  created_at   timestamptz not null default now()
);

create table if not exists public.gym_equipment (
  gym_id       uuid not null references public.gyms(id) on delete cascade,
  equipment_id text not null references public.equipment(id),
  -- o gestor desliga aqui quando o aparelho está em manutenção
  is_available boolean not null default true,
  primary key (gym_id, equipment_id)
);

-- O cliente lê SÓ isto para montar Input.availableEquipment.
create or replace view public.gym_available_equipment as
  select gym_id, equipment_id
    from public.gym_equipment
   where is_available;

comment on view public.gym_available_equipment is
  'Equipamento efetivamente utilizável hoje. É o que alimenta o filtro do motor.';
