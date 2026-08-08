-- O rodapé da ficha com nome/CREF do professor foi substituído por uma
-- instrução genérica ("procure o professor ou recepção") + nome da
-- academia (Ficha.tsx) — decisão de ago/2026, no primeiro cliente pagante.
-- As colunas ficam órfãs sem essa troca: nada mais lê `trainer_name`/
-- `trainer_cref` no código.
alter table public.gyms
  drop column if exists trainer_name,
  drop column if exists trainer_cref;
