import { readFileSync } from 'node:fs';
import { parseEquipmentCsv, parseExercisesCsv } from '../packages/core/src/catalog/schema';

try {
  const equip = parseEquipmentCsv(readFileSync('catalog/equipment.csv', 'utf8'));
  const known = new Set(equip.map((e) => e.id));
  const ex = parseExercisesCsv(readFileSync('catalog/exercises.csv', 'utf8'), known);

  const porGrupo = new Map<string, number>();
  for (const e of ex) porGrupo.set(e.primary, (porGrupo.get(e.primary) ?? 0) + 1);

  console.log(`OK — ${equip.length} equipamentos, ${ex.length} exercícios`);
  for (const [g, n] of [...porGrupo].sort()) console.log(`  ${g}: ${n}`);

  // Aviso, não erro: o motor precisa de profundidade para variar o treino.
  for (const [g, n] of porGrupo) {
    if (n < 5) console.warn(`  AVISO: só ${n} exercícios em "${g}" — treino vai repetir`);
  }
} catch (e) {
  console.error(`FALHOU: ${(e as Error).message}`);
  process.exit(1);
}
