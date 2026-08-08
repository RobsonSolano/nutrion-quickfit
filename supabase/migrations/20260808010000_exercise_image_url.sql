-- Botão "Ver imagem" no celular (SharedWorkout): 184 dos 248 exercícios têm
-- foto de demonstração, reaproveitando o mapeamento PT-BR -> Free Exercise
-- DB (CC0) que o Persona Fit já curou manualmente. Guarda a URL pronta
-- (mesmo padrão de `video_url`, que já existe e segue o mesmo caminho:
-- CSV -> aqui -> loadCatalog -> saveWorkout -> generated_workouts.exercises).
alter table public.exercises
  add column if not exists image_url text;
