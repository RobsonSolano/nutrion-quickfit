-- Catálogo global, compartilhado por todas as academias.

create table if not exists public.equipment (
  id       text primary key,
  name     text not null,
  category text not null
    check (category in ('maquina','livre','cabo','cardio','acessorio','corporal'))
);

create table if not exists public.exercises (
  id              text primary key,
  name            text not null,
  primary_group   text not null
    check (primary_group in ('peito','costas','ombros','biceps','triceps',
                             'pernas','gluteos','core','cardio')),
  level           smallint not null check (level between 1 and 3),
  pattern         text not null
    check (pattern in ('push-h','push-v','pull-h','pull-v','squat','hinge',
                       'lunge','iso','core','cardio')),
  is_compound     boolean not null default false,
  avg_sec_per_set smallint not null check (avg_sec_per_set between 0 and 60),
  duration_sec    integer check (duration_sec is null or duration_sec > 0),
  cue             text,
  video_url       text,
  -- cardio precisa de duração; o resto precisa de série com tempo plausível
  constraint cardio_tem_duracao check (
    (pattern = 'cardio' and duration_sec is not null)
    or (pattern <> 'cardio' and avg_sec_per_set between 10 and 60)
  )
);

create table if not exists public.exercise_secondary_groups (
  exercise_id text not null references public.exercises(id) on delete cascade,
  group_id    text not null
    check (group_id in ('peito','costas','ombros','biceps','triceps',
                        'pernas','gluteos','core','cardio')),
  primary key (exercise_id, group_id)
);

create table if not exists public.exercise_equipment (
  exercise_id  text not null references public.exercises(id) on delete cascade,
  equipment_id text not null references public.equipment(id),
  primary key (exercise_id, equipment_id)
);

create table if not exists public.exercise_contraindications (
  exercise_id text not null references public.exercises(id) on delete cascade,
  tag         text not null
    check (tag in ('joelho','lombar','ombro','punho','cervical')),
  primary key (exercise_id, tag)
);

create index if not exists exercises_primary_group_idx
  on public.exercises (primary_group);

comment on table public.exercises is
  'Catálogo do QuickFit. Fonte de autoria é catalog/exercises.csv no repo.';
