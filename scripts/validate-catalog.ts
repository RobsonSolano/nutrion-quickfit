import { readFileSync } from 'node:fs';
import { parseEquipmentCsv, parseExercisesCsv } from '../packages/core/src/catalog/schema';

try {
  const equip = parseEquipmentCsv(readFileSync('catalog/equipment.csv', 'utf8'));
  const known = new Set(equip.map((e) => e.id));
  const ex = parseExercisesCsv(readFileSync('catalog/exercises.csv', 'utf8'), known);

  // Arquivo vazio ou só com header parseia para `[]` sem erro — não há linha
  // para violar a contagem de colunas. Um merge ruim, um `git checkout` errado
  // ou um editor que salvou vazio passariam pelo portão com
  // "OK — 0 equipamentos, 0 exercícios" e exit 0. O piso mora aqui e não no
  // parser porque os testes parseiam strings pequenas de propósito.
  if (equip.length === 0) {
    throw new Error('catalog/equipment.csv não tem nenhuma linha. Arquivo truncado?');
  }
  if (ex.length === 0) {
    throw new Error('catalog/exercises.csv não tem nenhuma linha. Arquivo truncado?');
  }

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
