import { z } from 'zod';
// Import relativo: este arquivo VIVE em @quickfit/core, então não se
// auto-referencia pelo nome do pacote.
// Só `Exercise`. Os vocabulários (`GROUPS`, `PATTERNS`, `CONTRAS`) são
// declarados abaixo como const arrays porque o zod precisa dos VALORES em
// runtime, e um `import type` não sobrevive à compilação. Importar
// `MuscleGroup`/`Pattern`/`Contra`/`Level` aqui só para documentar a intenção
// quebra o `noUnusedLocals` com TS6196.
import type { Exercise } from '../engine/types';

export class CatalogError extends Error {}

const GROUPS = [
  'peito', 'costas', 'ombros', 'biceps', 'triceps',
  'pernas', 'gluteos', 'core', 'cardio',
] as const;

const PATTERNS = [
  'push-h', 'push-v', 'pull-h', 'pull-v',
  'squat', 'hinge', 'lunge', 'iso', 'core', 'cardio',
] as const;

const CONTRAS = ['joelho', 'lombar', 'ombro', 'punho', 'cervical'] as const;

const CATEGORIES = ['maquina', 'livre', 'cabo', 'cardio', 'acessorio', 'corporal'] as const;

export type EquipmentRow = { id: string; name: string; category: (typeof CATEGORIES)[number] };

const equipmentSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/, 'id deve ser kebab-case minúsculo'),
  name: z.string().min(1, 'name não pode ficar vazio'),
  category: z.enum(CATEGORIES, { message: 'categoria inválida' }),
});

const exerciseSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/, 'id deve ser kebab-case minúsculo'),
  name: z.string().min(1, 'name não pode ficar vazio'),
  primary: z.enum(GROUPS, { message: 'primary inválido' }),
  secondary: z.array(z.enum(GROUPS, { message: 'secondary inválido' })),
  equipment: z.array(z.string()),
  // Cadeia de number em vez de union de literais: `z.union([...], { message })`
  // NÃO aplica a mensagem custom em erro de união — o zod devolve "Invalid
  // input" em inglês, testado. Com min/max a faixa é a mesma e a mensagem sai
  // em pt-BR. O `as Exercise` no fim da função reconcilia `number` com `Level`.
  level: z
    .number({ message: 'level precisa ser um número' })
    .int('level precisa ser inteiro')
    .min(1, 'level precisa ser 1, 2 ou 3')
    .max(3, 'level precisa ser 1, 2 ou 3'),
  pattern: z.enum(PATTERNS, { message: 'pattern inválido' }),
  isCompound: z.boolean(),
  avgSecPerSet: z
    .number({ message: 'avg_sec_per_set precisa ser um número' })
    .int('avg_sec_per_set precisa ser inteiro'),
  durationSec: z
    .number({ message: 'duration_sec precisa ser um número' })
    .int('duration_sec precisa ser inteiro')
    .positive('duration_sec precisa ser positivo')
    .optional(),
  kind: z.enum(['treino', 'mobilidade'], { message: 'kind precisa ser treino ou mobilidade' }),
  contraindications: z.array(z.enum(CONTRAS, { message: 'contraindicação inválida' })),
  cue: z.string().optional(),
});

/** Parser deliberadamente ingênuo: vírgula dentro de célula deve quebrar o build. */
function rows(text: string): { cols: string[]; line: number }[] {
  const lines = text.trim().split('\n');
  const header = lines[0].split(',').map((c) => c.trim());
  return lines.slice(1).map((raw, i) => {
    const cols = raw.split(',').map((c) => c.trim());
    if (cols.length !== header.length) {
      throw new CatalogError(
        `linha ${i + 2}: esperava ${header.length} colunas, achei ${cols.length}. ` +
          `Vírgula dentro de célula? Use "|" para separar valores múltiplos.`,
      );
    }
    return { cols, line: i + 2 };
  });
}

const list = (cell: string): string[] =>
  cell === '' ? [] : cell.split('|').map((s) => s.trim()).filter(Boolean);

export function parseEquipmentCsv(text: string): EquipmentRow[] {
  const out: EquipmentRow[] = [];
  const seen = new Set<string>();

  for (const { cols, line } of rows(text)) {
    const [id, name, category] = cols;
    const parsed = equipmentSchema.safeParse({ id, name, category });
    if (!parsed.success) {
      throw new CatalogError(`linha ${line}: ${parsed.error.issues[0].message}`);
    }
    if (seen.has(id)) throw new CatalogError(`linha ${line}: id duplicado "${id}"`);
    seen.add(id);
    out.push(parsed.data);
  }
  return out;
}

export function parseExercisesCsv(text: string, knownEquipment: Set<string>): Exercise[] {
  const out: Exercise[] = [];
  const seen = new Set<string>();

  for (const { cols, line } of rows(text)) {
    const [
      id, name, primary, secondary, equipment, level, pattern, kind,
      isCompound, avgSecPerSet, durationSec, contraindications, cue,
    ] = cols;

    // `isCompound === 'true'` sozinho aceita QUALQUER coisa e devolve false em
    // silêncio: "True", "TRUE", "1", "ture", célula vazia — todos viravam
    // `false` sem erro. E `isCompound` é o campo que decide a ORDEM do treino
    // (composto no primeiro terço, task 5), então um typo aqui reordena a
    // sessão inteira sem ninguém notar. O `z.boolean()` do schema não pegava
    // porque valida DEPOIS da coerção, quando o valor já é booleano.
    if (isCompound !== 'true' && isCompound !== 'false') {
      throw new CatalogError(
        `linha ${line} (${id}): is_compound = "${isCompound}", ` +
          `precisa ser exatamente "true" ou "false" (minúsculo).`,
      );
    }

    const candidate = {
      id, name, primary,
      secondary: list(secondary),
      equipment: list(equipment),
      level: Number(level),
      pattern,
      kind,
      isCompound: isCompound === 'true',
      avgSecPerSet: Number(avgSecPerSet),
      durationSec: durationSec === '' ? undefined : Number(durationSec),
      contraindications: list(contraindications),
      cue: cue === '' ? undefined : cue,
    };

    const parsed = exerciseSchema.safeParse(candidate);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new CatalogError(
        `linha ${line} (${id}): ${issue.path.join('.')} — ${issue.message}`,
      );
    }
    const ex = parsed.data as Exercise;

    if (seen.has(ex.id)) throw new CatalogError(`linha ${line}: id duplicado "${ex.id}"`);
    seen.add(ex.id);

    for (const eq of ex.equipment) {
      if (!knownEquipment.has(eq)) {
        throw new CatalogError(
          `linha ${line} (${ex.id}): equipamento "${eq}" não existe em equipment.csv`,
        );
      }
    }

    if (ex.pattern === 'cardio') {
      if (!ex.durationSec) {
        throw new CatalogError(`linha ${line} (${ex.id}): cardio exige duration_sec`);
      }
    } else if (ex.avgSecPerSet < 10 || ex.avgSecPerSet > 60) {
      throw new CatalogError(
        `linha ${line} (${ex.id}): avg_sec_per_set = ${ex.avgSecPerSet}, ` +
          `fora da faixa 10–60. Uma série não dura isso.`,
      );
    }

    out.push(ex);
  }
  return out;
}
