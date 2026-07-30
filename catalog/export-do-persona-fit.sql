-- Export dos exercícios do Persona Fit para o QuickFit.
--
-- Rode no SQL Editor do Supabase do PERSONA FIT (não o do QuickFit), e use o
-- botão "Download CSV" do resultado. Salve como `catalog/exercises.raw.csv`
-- aqui no repositório do QuickFit.
--
-- Somente leitura. Nenhum INSERT, UPDATE, DELETE ou DDL.
--
-- Schema de origem (lido de app/supabase/migrations/):
--   public.exercises        (id, group_id, name, equipment, is_compound,
--                            video_url, image_urls, modality, sort_order)
--   public.exercise_groups  (id, slug, name, icon, sort_order)


-- ---------------------------------------------------------------------------
-- 1. Confira o volume antes de exportar
-- ---------------------------------------------------------------------------
select
  count(*)                                          as total,
  count(*) filter (where equipment is null)         as sem_equipamento,
  count(*) filter (where modality = 'musculacao')   as musculacao,
  count(*) filter (where modality <> 'musculacao')  as outras_modalidades,
  count(distinct g.slug)                            as grupos
from public.exercises e
join public.exercise_groups g on g.id = e.group_id;


-- ---------------------------------------------------------------------------
-- 2. O export. É este resultado que vira o CSV.
-- ---------------------------------------------------------------------------
select
  e.id::text                                   as id,
  e.name                                       as name,
  g.slug                                       as group_slug,
  coalesce(e.equipment, '')                    as equipment_text,
  e.is_compound                                as is_compound,
  coalesce(e.modality, 'musculacao')           as modality,
  coalesce(e.video_url, '')                    as video_url
from public.exercises e
join public.exercise_groups g on g.id = e.group_id
-- `sort_order` existe em exercise_groups, NÃO em exercises. A primeira versão
-- desta consulta ordenava por `e.sort_order` e quebrava com
-- `42703: column e.sort_order does not exist`. Erro meu: inferi a coluna de um
-- grep solto nas migrations e atribuí à tabela errada.
order by g.sort_order, g.slug, e.name;


-- ---------------------------------------------------------------------------
-- 3. Alternativa, se o CSV vier com acento ou vírgula estranhos
-- ---------------------------------------------------------------------------
-- O "Download CSV" do Studio cita células com vírgula corretamente, então o
-- normal é a consulta 2 bastar. Mas se o arquivo chegar mangled, rode esta e
-- me mande o resultado da coluna única `linha_json` — JSON não tem problema
-- de escape de vírgula, e eu converto para CSV aqui.
select json_agg(x order by x.group_slug, x.name)::text as linha_json
from (
  select
    e.id::text                         as id,
    e.name                             as name,
    g.slug                             as group_slug,
    coalesce(e.equipment, '')          as equipment_text,
    e.is_compound                      as is_compound,
    coalesce(e.modality, 'musculacao') as modality,
    coalesce(e.video_url, '')          as video_url
  from public.exercises e
  join public.exercise_groups g on g.id = e.group_id
) x;


-- ---------------------------------------------------------------------------
-- 4. Útil para eu calibrar a classificação: que equipamentos existem em texto
--    livre, e com que frequência
-- ---------------------------------------------------------------------------
select
  coalesce(nullif(trim(equipment), ''), '(vazio)') as equipamento_texto,
  count(*)                                         as quantos
from public.exercises
group by 1
order by 2 desc, 1;
