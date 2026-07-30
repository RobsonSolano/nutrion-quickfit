-- security_invoker faz a view respeitar o RLS da tabela por baixo, em vez de
-- rodar com o privilégio de quem criou a view (o dono, que ignora RLS por
-- padrão). Sem isto, `stats_por_hora` devolvia a telemetria (contagem de
-- treinos e encaminhamentos de PAR-Q) de QUALQUER academia para a chave anon
-- pública — o exato vazamento que a ausência de policy de SELECT em
-- `generated_workouts` foi desenhada para impedir. Achado na revisão final
-- de branch, confirmado ao vivo com a chave anon contra o projeto real.
alter view public.stats_por_hora set (security_invoker = true);
alter view public.gym_available_equipment set (security_invoker = true);
