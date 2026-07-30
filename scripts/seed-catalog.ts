import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { parseEquipmentCsv, parseExercisesCsv } from '../packages/core/src/catalog/schema';

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE;
if (!url || !key) {
  console.error('Faltam VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE no .env.local');
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false } });

const equipment = parseEquipmentCsv(readFileSync('catalog/equipment.csv', 'utf8'));
const exercises = parseExercisesCsv(
  readFileSync('catalog/exercises.csv', 'utf8'),
  new Set(equipment.map((e) => e.id)),
);

const die = (label: string, error: { message: string } | null) => {
  if (error) {
    console.error(`${label}: ${error.message}`);
    process.exit(1);
  }
};

// 1. Equipamento
die('equipment', (await db.from('equipment').upsert(equipment)).error);
console.log(`equipment: ${equipment.length}`);

// 2. Exercícios (upsert por id — idempotente)
die(
  'exercises',
  (
    await db.from('exercises').upsert(
      exercises.map((e) => ({
        id: e.id,
        name: e.name,
        primary_group: e.primary,
        level: e.level,
        pattern: e.pattern,
        kind: e.kind,
        is_compound: e.isCompound,
        avg_sec_per_set: e.avgSecPerSet,
        duration_sec: e.durationSec ?? null,
        cue: e.cue ?? null,
      })),
    )
  ).error,
);
console.log(`exercises: ${exercises.length}`);

// 3. Junções: apaga e reinsere, porque remover um equipamento de um
// exercício no CSV tem que remover a linha no banco.
const ids = exercises.map((e) => e.id);
for (const table of [
  'exercise_secondary_groups',
  'exercise_equipment',
  'exercise_contraindications',
]) {
  die(`limpar ${table}`, (await db.from(table).delete().in('exercise_id', ids)).error);
}

const secondary = exercises.flatMap((e) =>
  e.secondary.map((g) => ({ exercise_id: e.id, group_id: g })),
);
const equip = exercises.flatMap((e) =>
  e.equipment.map((eq) => ({ exercise_id: e.id, equipment_id: eq })),
);
const contra = exercises.flatMap((e) =>
  e.contraindications.map((t) => ({ exercise_id: e.id, tag: t })),
);

if (secondary.length) die('secondary', (await db.from('exercise_secondary_groups').insert(secondary)).error);
if (equip.length)     die('equip',     (await db.from('exercise_equipment').insert(equip)).error);
if (contra.length)    die('contra',    (await db.from('exercise_contraindications').insert(contra)).error);

console.log(`junções: ${secondary.length} secundários, ${equip.length} equipamentos, ${contra.length} contraindicações`);

// 4. Academia da demo, com TODO o equipamento ligado.
const { data: gym, error: gymErr } = await db
  .from('gyms')
  .upsert(
    {
      slug: 'demo',
      name: 'Academia Persona',
      theme: { accent: '#39FF14', mode: 'dark' },
      trainer_name: 'Prof. Marina Alves',
      trainer_cref: 'CREF 012345-G/SP',
    },
    { onConflict: 'slug' },
  )
  .select('id')
  .single();
die('gym', gymErr);

die(
  'gym_equipment',
  (
    await db.from('gym_equipment').upsert(
      equipment.map((e) => ({ gym_id: gym!.id, equipment_id: e.id, is_available: true })),
    )
  ).error,
);
console.log(`academia demo: ${gym!.id} com ${equipment.length} aparelhos ligados`);
console.log('\nSeed completo.');
