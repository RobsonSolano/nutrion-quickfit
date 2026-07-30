-- anon pode INSERT em generated_workouts e embellishments sem autenticação
-- (é o design: totem sem login). A sanitização da Edge Function (título até
-- 40 chars, cues por exercício) é contornável escrevendo direto na tabela
-- com a chave anon pública. Estes limites não impedem abuso de tráfego (isso
-- é rate limit, fora do escopo do banco), mas impedem que uma linha
-- individual carregue um payload desproporcional.
alter table public.embellishments
  add constraint title_tamanho check (char_length(title) <= 80),
  add constraint cues_tamanho check (length(cues::text) <= 4000);

alter table public.generated_workouts
  add constraint input_tamanho check (length(input::text) <= 4000),
  add constraint exercises_tamanho check (length(exercises::text) <= 40000);
