import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseEquipmentCsv, parseExercisesCsv, CatalogError } from './schema';

// Caminhos relativos ao CWD, não ao arquivo de teste. Isso só é válido por
// causa da Global Constraint "npm test roda sempre na RAIZ" — rodar o vitest
// de dentro de um workspace dá `ENOENT: catalog/equipment.csv`. Se você vir
// esse erro, o problema é de onde você chamou, não do caminho.
const equipCsv = readFileSync('catalog/equipment.csv', 'utf8');
const exCsv = readFileSync('catalog/exercises.csv', 'utf8');

describe('parseEquipmentCsv', () => {
  it('lê o arquivo real do repo', () => {
    const rows = parseEquipmentCsv(equipCsv);
    expect(rows.length).toBeGreaterThan(10);
    expect(rows[0]).toHaveProperty('id');
    expect(rows[0]).toHaveProperty('category');
  });

  it('rejeita id duplicado', () => {
    const bad = 'id,name,category\nbarra,Barra,livre\nbarra,Outra,maquina\n';
    expect(() => parseEquipmentCsv(bad)).toThrow(CatalogError);
  });

  it('rejeita categoria desconhecida', () => {
    const bad = 'id,name,category\nx,X,teletransporte\n';
    expect(() => parseEquipmentCsv(bad)).toThrow(/categoria/i);
  });
});

describe('parseExercisesCsv', () => {
  const known = () => new Set(parseEquipmentCsv(equipCsv).map((e) => e.id));

  it('lê o arquivo real do repo', () => {
    const out = parseExercisesCsv(exCsv, known());
    expect(out.length).toBeGreaterThanOrEqual(3);
  });

  it('separa arrays por pipe', () => {
    const out = parseExercisesCsv(exCsv, known());
    const supino = out.find((e) => e.id === 'supino-reto')!;
    expect(supino.secondary).toEqual(['triceps', 'ombros']);
    expect(supino.equipment).toEqual(['barra', 'banco']);
    expect(supino.contraindications).toEqual(['ombro']);
  });

  it('trata célula vazia como array vazio, não como [""]', () => {
    const out = parseExercisesCsv(exCsv, known());
    const esteira = out.find((e) => e.id === 'esteira-moderada')!;
    expect(esteira.secondary).toEqual([]);
    expect(esteira.contraindications).toEqual([]);
  });

  it('converte is_compound para boolean de verdade', () => {
    const out = parseExercisesCsv(exCsv, known());
    expect(out.find((e) => e.id === 'supino-reto')!.isCompound).toBe(true);
    expect(out.find((e) => e.id === 'esteira-moderada')!.isCompound).toBe(false);
  });

  it('rejeita equipamento que não existe no equipment.csv', () => {
    const bad = exCsv + 'fake,Fake,peito,,teletransportador,1,iso,false,20,,,\n';
    expect(() => parseExercisesCsv(bad, known())).toThrow(/teletransportador/);
  });

  it('rejeita avg_sec_per_set fora de 10-60 para não-cardio', () => {
    const bad = exCsv + 'lento,Lento,peito,,barra,1,iso,false,900,,,\n';
    expect(() => parseExercisesCsv(bad, known())).toThrow(/avg_sec_per_set/);
  });

  it('exige duration_sec em exercício de cardio', () => {
    const bad = exCsv + 'bike-x,Bike,cardio,,bike,1,cardio,false,0,,,\n';
    expect(() => parseExercisesCsv(bad, known())).toThrow(/duration_sec/);
  });

  it('rejeita grupo muscular inválido', () => {
    const bad = exCsv + 'x,X,panturrilha,,barra,1,iso,false,20,,,\n';
    expect(() => parseExercisesCsv(bad, known())).toThrow(/primary/);
  });

  it('rejeita contraindicação fora do vocabulário', () => {
    const bad = exCsv + 'x,X,peito,,barra,1,iso,false,20,,dedao,\n';
    expect(() => parseExercisesCsv(bad, known())).toThrow(/contraindic/i);
  });

  it('rejeita id de exercício duplicado', () => {
    // O parser tem essa guarda; sem teste ela podia ser removida num refactor
    // sem ninguém notar. Um id duplicado no catálogo faria o motor tratar dois
    // exercícios diferentes como o mesmo na deduplicação do `generateWorkout`.
    const bad = exCsv + 'supino-reto,Outro supino,peito,,barra,1,iso,false,30,,,\n';
    expect(() => parseExercisesCsv(bad, known())).toThrow(/duplicado/i);
  });

  it('aponta o número da linha no erro', () => {
    // A linha é DERIVADA do arquivo, não fixada em 5. Hoje o CSV tem 4 linhas
    // físicas e a linha ruim cai na 5 — mas a task 9 enche o catálogo com 269
    // exercícios, e aí a mesma linha ruim cai na 271. Um `/linha 5/` fixo
    // quebraria nessa task sem que nada em `schema.ts` tivesse regredido.
    const linhaEsperada = exCsv.trim().split('\n').length + 1;
    const bad = exCsv + 'x,X,inexistente,,barra,1,iso,false,20,,,\n';
    try {
      parseExercisesCsv(bad, known());
      expect.unreachable('deveria ter lançado');
    } catch (e) {
      expect((e as CatalogError).message).toMatch(new RegExp(`linha ${linhaEsperada}`));
    }
  });

  it('rejeita is_compound que não seja exatamente true ou false', () => {
    // "1", "ture", "True" e célula vazia viravam `false` em silêncio, e este
    // campo decide a ordem dos exercícios na sessão.
    for (const v of ['1', 'ture', 'True', '']) {
      const bad = exCsv + `z,Z,peito,,barra,1,iso,${v},30,,,\n`;
      expect(() => parseExercisesCsv(bad, known())).toThrow(/is_compound/);
    }
  });
});
