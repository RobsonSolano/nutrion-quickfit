/**
 * Classifica os 269 exercícios crus do Persona Fit no formato que o motor
 * aceita. Roda uma vez; depois o CSV revisado vive no git.
 *
 * Escreve em `exercises.classified.csv`, SEPARADO de `exercises.csv`, para que
 * promover a saída a catálogo oficial seja um passo consciente e não acidente.
 * Grava a cada lote e retoma de onde parou, porque 13 chamadas de rede vão
 * falhar em alguma.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const KEY = process.env.GROQ_API_KEY;
if (!KEY) {
  console.error('Falta GROQ_API_KEY no .env.local');
  process.exit(1);
}

const MODEL = process.env.CLASSIFY_MODEL ?? 'openai/gpt-oss-120b';
const BATCH = Number(process.env.CLASSIFY_BATCH ?? 15);
const LIMIT = process.env.CLASSIFY_LIMIT ? Number(process.env.CLASSIFY_LIMIT) : Infinity;

const RAW = 'catalog/exercises.raw.csv';
const OUT = 'catalog/exercises.classified.csv';

/** Grupos do Persona Fit que mapeiam 1:1. `full_body` fica de fora: o LLM decide. */
const GROUP: Record<string, string> = {
  legs: 'pernas', core: 'core', cardio: 'cardio', back: 'costas',
  chest: 'peito', shoulders: 'ombros', biceps: 'biceps', triceps: 'triceps',
};

/** Equipamento com equivalente exato. `[]` é peso corporal: sempre elegível. */
const EQUIP: Record<string, string[]> = {
  'peso corporal': [], 'barra': ['barra'], 'halter': ['halter'],
  'kettlebell': ['kettlebell'], 'corda': ['corda'], 'banco': ['banco'],
  'bike': ['bike'], 'rolo': ['rolo'], 'caixa': ['caixa'],
  'medicine ball': ['medicine-ball'], 'cano/elástico': ['elastico'],
  'bola suíça': ['bola-suica'],
};

/** Vago: o nome do exercício resolve. */
const VAGO = new Set(['máquina', 'cabo', 'equipamento']);

/** Sem equivalente na academia — descartados por decisão do Robson. */
const DESCARTA = new Set(['pista/rua', 'rua', 'argolas', 'remo', 'ski erg', 'sled']);

type Raw = {
  id: string; name: string; group_slug: string;
  equipment_text: string; is_compound: string; modality: string;
};

function lerCsv(texto: string): Raw[] {
  const linhas = texto.trim().split('\n');
  const cab = linhas[0].split(',');
  return linhas.slice(1).map((l) => {
    const c = l.split(',');
    return Object.fromEntries(cab.map((h, i) => [h.trim(), (c[i] ?? '').trim()])) as Raw;
  });
}

const crus = lerCsv(readFileSync(RAW, 'utf8'));
const vivos = crus.filter((r) => !DESCARTA.has(r.equipment_text.toLowerCase()));
console.log(`${crus.length} crus, ${crus.length - vivos.length} descartados, ${vivos.length} a classificar`);

const equipamentos = lerCsv(readFileSync('catalog/equipment.csv', 'utf8'))
  .map((e) => (e as unknown as { id: string }).id);

const CABECALHO =
  'id,name,primary,secondary,equipment,level,pattern,kind,is_compound,avg_sec_per_set,duration_sec,contraindications,cue';

/** Retoma: lê o que já foi gravado e pula esses ids. */
const feitos = new Set<string>();
if (existsSync(OUT)) {
  for (const l of readFileSync(OUT, 'utf8').trim().split('\n').slice(1)) {
    const id = l.split(',')[0];
    if (id) feitos.add(id);
  }
  console.log(`retomando: ${feitos.size} já classificados`);
} else {
  writeFileSync(OUT, CABECALHO + '\n');
}

const SISTEMA = `Você classifica exercícios de academia para um motor que monta treino.
Responda SOMENTE um objeto json: {"itens":[{...}]}, um item por exercício, na mesma ordem.

(A palavra "json" acima precisa aparecer literalmente: a Groq recusa
response_format json_object com HTTP 400 se ela não estiver em nenhuma
mensagem. Descoberto com um 400 durante a validação.)

Campos de cada item:
- n: repita o número recebido para o exercício
- primary: um de peito|costas|ombros|biceps|triceps|pernas|gluteos|core|cardio
- secondary: array dos mesmos valores, sem repetir o primary. [] se não houver.
- equipment: array de ids EXATAMENTE desta lista: ${equipamentos.join(', ')}
  Use [] para exercício de peso corporal.
- level: 1 (qualquer iniciante), 2 (precisa de técnica), 3 (exige experiência)
- pattern: push-h|push-v|pull-h|pull-v|squat|hinge|lunge|iso|core|cardio
- avg_sec_per_set: segundos de UMA série, entre 10 e 60. Cardio use 0.
- duration_sec: só para pattern cardio, duração total em segundos. Senão null.
- contraindications: array de joelho|lombar|ombro|punho|cervical. [] se nenhuma.
- cue: uma dica curta de execução, em português, segunda pessoa, até 90 caracteres.
  Sem vírgula — o CSV de destino tem parser ingênuo e vírgula quebra o build.

REGRAS QUE NÃO PODEM SER VIOLADAS:
1. contraindications é campo de SEGURANÇA. Marque toda articulação que o
   movimento carrega sob carga. Agachamento carrega joelho e lombar. Supino
   carrega ombro. Na dúvida, INCLUA — um humano vai revisar e remover excesso
   é mais seguro que adicionar o que faltou.
2. equipment só aceita ids da lista. Se o exercício exige algo fora dela,
   devolva "equipment": ["__FORA__"] e um humano decide.
3. Nada de vírgula em nenhum campo de texto.`;

function prompt(lote: Raw[]): string {
  return lote.map((r, idx) => {
    const eqTxt = r.equipment_text.toLowerCase();
    const g = GROUP[r.group_slug];
    const e = EQUIP[eqTxt];
    const dicas: string[] = [];
    if (g) dicas.push(`primary JÁ DECIDIDO: ${g}`);
    else dicas.push(`grupo de origem: full_body — VOCÊ escolhe o primary dominante`);

    if (eqTxt === 'peso corporal') {
      // NÃO dizer "equipment JÁ DECIDIDO: []" aqui. A primeira versão dizia, e
      // o modelo obedecia: barra fixa saía com equipment vazio, o que faria o
      // totem prescrevê-la numa academia sem barra. "Peso corporal" descreve a
      // CARGA, não o aparelho.
      dicas.push(
        'origem diz "peso corporal", o que descreve a CARGA e não o aparelho. ' +
          'Se o movimento exige aparelho (barra fixa, paralelas, banco, caixa), LISTE. ' +
          'Só devolva [] se der para fazer no chão sem nada.',
      );
    } else if (e !== undefined) {
      dicas.push(
        `equipment MÍNIMO: ${JSON.stringify(e)} — acrescente o que mais for necessário ` +
          '(supino com barra também precisa de banco)',
      );
    } else if (VAGO.has(eqTxt)) {
      dicas.push(`equipamento de origem vago ("${r.equipment_text}") — INFIRA do nome`);
    }
    dicas.push(`is_compound JÁ DECIDIDO: ${r.is_compound.toLowerCase() === 'true'}`);
    if (r.modality !== 'musculacao') dicas.push(`modalidade: ${r.modality}`);
    // A chave de eco é o ÍNDICE, não o uuid. Medido: pedir ao modelo que
    // reproduza 20 uuids de 36 caracteres dentro de um JSON de 12 campos faz
    // ele errar pelo menos um — a primeira versão deste script morria com
    // "lote sem resposta para <uuid>". E o eco de uuid custa 2.5x mais tokens
    // de saída (1633 contra 645 por lote de 20), o que num tier de 100 mil
    // tokens/dia é a diferença entre caber e não caber.
    return `n=${idx + 1}\n  nome: ${r.name}\n  ${dicas.join('\n  ')}`;
  }).join('\n\n');
}

const lista = (a: unknown): string =>
  Array.isArray(a) ? a.filter(Boolean).join('|') : '';

const limpa = (s: unknown): string =>
  String(s ?? '').replace(/[,\n\r]/g, ' ').trim();

async function classificar(lote: Raw[]): Promise<string[]> {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0,
      response_format: { type: 'json_object' },
      // O teto e o tamanho do lote são um par, e os dois somados têm que caber
      // no TPM de 8000 do tier gratuito, porque a Groq conta `max_tokens`
      // RESERVADO contra ele. Medido, batendo nos dois lados:
      //   lote 20 + max_tokens 8000 -> HTTP 413 (10.251 > 8.000)
      //   lote 20 + max_tokens 4000 -> truncou em 16 de 20 itens
      //   lote 15 + max_tokens 5000 -> ~1.600 de entrada + 5.000 = 6.600, cabe
      max_tokens: 5000,
      messages: [
        { role: 'system', content: SISTEMA },
        { role: 'user', content: prompt(lote) },
      ],
    }),
  });

  if (!res.ok) throw new Error(`Groq ${res.status}: ${(await res.text()).slice(0, 300)}`);

  const json = (await res.json()) as { choices: { message: { content: string } }[] };
  const itens = (JSON.parse(json.choices[0].message.content) as {
    itens: Record<string, unknown>[];
  }).itens;

  const porIndice = new Map(itens.map((i) => [Number(i.n), i]));

  return lote.map((r, idx) => {
    const i = porIndice.get(idx + 1);
    if (!i) throw new Error(`lote sem resposta para n=${idx + 1} (${r.name})`);

    // Grupo: o determinístico ganha, porque `legs -> pernas` não tem exceção.
    const g = GROUP[r.group_slug] ?? limpa(i.primary);

    // Equipamento: UNIÃO, não substituição. O determinístico é piso.
    // "peso corporal" na origem descreve a CARGA, não o APARELHO — barra fixa
    // é peso corporal e ainda assim precisa de uma barra. Errar para mais só
    // tira variedade; errar para menos prescreve aparelho inexistente.
    const base = EQUIP[r.equipment_text.toLowerCase()] ?? [];
    const proposto = Array.isArray(i.equipment) ? (i.equipment as string[]) : [];
    const e = [...new Set([...base, ...proposto])].filter(
      (id) => id === '__FORA__' || equipamentos.includes(id),
    );
    const composto = r.is_compound.toLowerCase() === 'true';
    const cardio = limpa(i.pattern) === 'cardio';

    return [
      r.id,
      limpa(r.name),
      g,
      lista(i.secondary),
      lista(e),
      String(i.level ?? 1),
      limpa(i.pattern),
      r.modality === 'generico' ? 'mobilidade' : 'treino',
      String(composto),
      String(cardio ? 0 : (i.avg_sec_per_set ?? 30)),
      cardio ? String(i.duration_sec ?? 600) : '',
      lista(i.contraindications),
      limpa(i.cue),
    ].join(',');
  });
}

const pendentes = vivos.filter((r) => !feitos.has(r.id)).slice(0, LIMIT);
console.log(`${pendentes.length} pendentes, lotes de ${BATCH}, modelo ${MODEL}\n`);

for (let i = 0; i < pendentes.length; i += BATCH) {
  const lote = pendentes.slice(i, i + BATCH);
  const n = Math.floor(i / BATCH) + 1;
  const total = Math.ceil(pendentes.length / BATCH);
  try {
    const linhas = await classificar(lote);
    // Grava lote a lote: se a próxima chamada falhar, nada se perde.
    writeFileSync(OUT, linhas.join('\n') + '\n', { flag: 'a' });
    console.log(`lote ${n}/${total}: ${linhas.length} classificados`);
  } catch (err) {
    console.error(`lote ${n}/${total} FALHOU: ${(err as Error).message}`);
    console.error('  rode de novo — o script retoma de onde parou');
    process.exit(1);
  }
  // O gargalo NÃO é requisições por minuto (30) nem tokens por dia (100k): é
  // tokens por MINUTO, 8000. Cada lote reserva ~6.600, então cabe pouco mais
  // de um por minuto. 50s deixa o job em ~15 min para os 258, sem 429.
  if (i + BATCH < pendentes.length) await new Promise((r) => setTimeout(r, 50_000));
}

const fora = readFileSync(OUT, 'utf8').split('\n').filter((l) => l.includes('__FORA__'));
console.log(`\n${OUT} pronto.`);
if (fora.length) {
  console.log(`ATENÇÃO: ${fora.length} exercícios com equipamento fora da lista:`);
  for (const l of fora) console.log(`  ${l.split(',')[1]}`);
}
